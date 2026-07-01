const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve index.html for root path to prevent "Not Found" on Render
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Helpers ───
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// Global state variables
let fishes = [];
let settings = {
  hideDrawBtn: false,
  hideToggleBubblesBtn: false,
  hideFullscreenBtn: false,
  hideToolbarToggleBtn: false
};

// MongoDB Setup
const MONGODB_URI = process.env.MONGODB_URI;
let db = null;
let useMongo = false;
let dbClient = null;

if (MONGODB_URI) {
  console.log("Menghubungkan ke MongoDB Atlas...");
  dbClient = new MongoClient(MONGODB_URI);
  dbClient.connect()
    .then(async () => {
      db = dbClient.db();
      useMongo = true;
      console.log("✅ Berhasil terhubung ke MongoDB Atlas!");
      await syncFishesFromMongo();
      await syncSettingsFromMongo();
    })
    .catch(err => {
      console.error("❌ Gagal terhubung ke MongoDB, fallback ke database lokal db.json:", err);
      loadLocalDb();
    });
} else {
  console.log("ℹ️ MONGODB_URI tidak ditemukan. Menggunakan database lokal db.json.");
  loadLocalDb();
}

function loadLocalDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      fishes = JSON.parse(data);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
  } catch (error) {
    console.error("Failed to load/initialize db.json:", error);
  }

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data);
    } else {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    }
  } catch (error) {
    console.error("Failed to load/initialize settings.json:", error);
  }
}

async function syncFishesFromMongo() {
  try {
    const list = await db.collection('fishes').find({}).toArray();
    fishes = list;
    console.log(`Berhasil memuat ${fishes.length} ikan dari MongoDB.`);
  } catch (err) {
    console.error("Gagal sinkronisasi ikan dari MongoDB:", err);
  }
}

async function syncSettingsFromMongo() {
  try {
    const doc = await db.collection('settings').findOne({ id: 'display_settings' });
    if (doc) {
      delete doc._id;
      delete doc.id;
      settings = doc;
      console.log("Berhasil memuat pengaturan dari MongoDB:", settings);
    } else {
      await db.collection('settings').updateOne(
        { id: 'display_settings' },
        { $set: { id: 'display_settings', ...settings } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("Gagal sinkronisasi pengaturan dari MongoDB:", err);
  }
}

function saveDb() {
  if (!useMongo) {
    fs.writeFile(DB_FILE, JSON.stringify(fishes, null, 2), (err) => {
      if (err) console.error("Error saving db.json:", err);
    });
  }
}

// REST API for Settings
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const { hideDrawBtn, hideToggleBubblesBtn, hideFullscreenBtn, hideToolbarToggleBtn } = req.body;
  
  settings = {
    hideDrawBtn: !!hideDrawBtn,
    hideToggleBubblesBtn: !!hideToggleBubblesBtn,
    hideFullscreenBtn: !!hideFullscreenBtn,
    hideToolbarToggleBtn: !!hideToolbarToggleBtn
  };
  
  if (useMongo) {
    db.collection('settings').updateOne(
      { id: 'display_settings' },
      { $set: settings },
      { upsert: true }
    ).catch(err => console.error("Error saving settings to Mongo:", err));
  } else {
    fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), (err) => {
      if (err) console.error("Error saving settings.json:", err);
    });
  }
  
  broadcast({ type: 'settings_update', settings });
  res.json({ status: "success", settings });
});

// REST API for Fishes
app.get('/api/fishes', (req, res) => {
  res.json(fishes);
});

app.post('/api/fish', (req, res) => {
  const { name, wish, image } = req.body;
  
  if (!name || !wish || !image) {
    return res.status(400).json({ error: "Missing name, wish, or image" });
  }

  const newFish = {
    id: "fish_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
    name: name.substring(0, 30),
    wish: wish.substring(0, 200),
    image: image,
    hidden: false,
    created_at: new Date().toISOString()
  };

  fishes.push(newFish);
  saveDb();
  
  if (useMongo) {
    db.collection('fishes').insertOne(newFish)
      .catch(err => console.error("Error inserting fish to Mongo:", err));
  }

  broadcast({ type: 'new_fish', data: newFish });
  console.log(`Fish added: ${newFish.name} - "${newFish.wish}"`);
  res.status(201).json({ status: "success", fish: newFish });
});

app.post('/api/fish/:id/toggle-hidden', (req, res) => {
  const { id } = req.params;
  const fish = fishes.find(f => f.id === id);

  if (!fish) {
    return res.status(404).json({ error: 'Fish not found' });
  }

  fish.hidden = !fish.hidden;
  saveDb();

  if (useMongo) {
    db.collection('fishes').updateOne({ id: id }, { $set: { hidden: fish.hidden } })
      .catch(err => console.error("Error updating fish in Mongo:", err));
  }

  broadcast({ type: 'toggle_hidden', id, hidden: fish.hidden });
  console.log(`Fish ${id} hidden=${fish.hidden}`);
  res.json({ status: 'ok', id, hidden: fish.hidden });
});

app.post('/api/fishes/hide-all', (req, res) => {
  let count = 0;
  fishes.forEach(f => {
    if (!f.hidden) {
      f.hidden = true;
      count++;
    }
  });

  saveDb();

  if (useMongo) {
    db.collection('fishes').updateMany({ hidden: false }, { $set: { hidden: true } })
      .catch(err => console.error("Error hiding all fishes in Mongo:", err));
  }

  broadcast({ type: 'hide_all' });
  console.log(`Hide-all: ${count} ikan disembunyikan`);
  res.json({ status: 'ok', hidden_count: count });
});

app.delete('/api/fish/:id', (req, res) => {
  const { id } = req.params;
  const before = fishes.length;
  fishes = fishes.filter(f => f.id !== id);

  if (fishes.length === before) {
    return res.status(404).json({ error: 'Fish not found' });
  }

  saveDb();

  if (useMongo) {
    db.collection('fishes').deleteOne({ id: id })
      .catch(err => console.error("Error deleting fish in Mongo:", err));
  }

  broadcast({ type: 'delete_fish', id });
  console.log(`Fish deleted: ${id}`);
  res.json({ status: 'deleted', id });
});

app.delete('/api/fishes/all', (req, res) => {
  const count = fishes.length;
  fishes = [];
  saveDb();

  if (useMongo) {
    db.collection('fishes').deleteMany({})
      .catch(err => console.error("Error clearing fishes in Mongo:", err));
  }

  broadcast({ type: 'clear_all' });
  console.log(`Aquarium cleared: ${count} fish removed.`);
  res.json({ status: 'cleared', removed: count });
});

// WebSocket logic
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  3D OCEAN WISH AQUARIUM SERVER RUNNING`);
  console.log(`  PORT: ${PORT}`);
  console.log(`  Drawing HP: http://localhost:${PORT}`);
  console.log(`  Display 3D: http://localhost:${PORT}/display.html`);
  console.log(`====================================================`);
});
