# 🎏 Samudera Harapan — 3D Ocean Wish Aquarium
Dokumentasi teknis lengkap untuk aplikasi interaktif **Samudera Harapan**. Aplikasi ini awalnya dirancang khusus untuk pameran fisik di **Pancer Pacitan**, namun kemudian disesuaikan dan di-deploy agar bisa diakses secara online oleh masyarakat umum. Aplikasi ini memungkinkan pengguna menggambar ikan dan menulis harapan di HP mereka, lalu mengirimkannya secara langsung (*real-time*) ke layar akuarium 3D.

---

## 🏗️ 1. Arsitektur & Teknologi
Aplikasi dibangun menggunakan teknologi berbasis web modern yang ringan tanpa memerlukan koneksi internet (dapat berjalan sepenuhnya secara *offline* di jaringan lokal / LAN):

* **Backend (Server):** Node.js dengan kerangka Express.js untuk REST API.
* **Real-time Engine:** WebSockets (`ws`) untuk penyiaran data ikan baru, penghapusan, dan pembaruan pengaturan dari panel admin secara instan tanpa membebani server.
* **Database lokal:** `db.json` (penyimpanan ikan berformat JSON) & `settings.json` (penyimpanan konfigurasi tombol).
* **Frontend (3D Engine):** [Three.js r128](https://threejs.org/) dengan custom shader untuk liukan ekor ikan, pencahayaan, gelembung air, dan model 3D pendukung.
* **Canvas Drawing:** HTML5 2D Canvas API dengan fitur *Flood Fill* (Ember Cat) untuk optimalisasi pewarnaan ikan.

---

## 📁 2. Struktur Proyek
```text
PAMERAN PANCER PACITAN/
├── public/                 # Folder aset statis (Frontend)
│   ├── models/             # Berisi model 3D (seperti sekumpulan ikan default .glb)
│   ├── admin.html          # Dashboard moderasi & pengaturan pameran
│   ├── display.html        # Layar utama akuarium 3D (tampilan proyektor)
│   ├── display.js          # Logika Three.js, WebSocket, & manipulasi objek 3D
│   ├── draw.js             # Logika melukis kanvas, kompresi gambar, & zoom kanvas
│   ├── index.html          # Jendela menggambar ikan dan menulis doa (tampilan HP)
│   └── style.css           # Seluruh desain visual & layout responsif desktop/mobile
├── db.json                 # Database lokal penyimpanan data ikan pengunjung
├── settings.json           # Database penyimpanan pengaturan tombol display
├── server.js               # Node.js Express server + WebSocket setup
├── package.json            # Node.js dependencies (express, ws)
└── README.md               # Dokumentasi proyek (File Ini)
```

---

## 🌟 3. Fitur Utama & Cara Kerja

### A. Jendela Menggambar (`index.html` / `draw.js`)
* **Kanvas Menggambar:** Pengunjung melukis menggunakan kuas atau penghapus. Tersedia juga fitur **Ember Cat (Flood Fill)** untuk mengisi warna kontur ikan secara otomatis.
* **Panduan Siluet Ikan:** Mengarahkan kepala ikan menghadap ke kanan agar liukan badan 3D tidak terbalik.
* **Validasi Cerdas (isCanvasDirty):** Mengetik nama/doa di HP menjadi sangat mulus tanpa *lag* karena pemindaian piksel kanvas hanya terjadi ketika kuas diangkat (bukan pada setiap tombol keyboard ditekan).
* **Deteksi Garis Tipis:** Peringatan konfirmasi jika ikan yang digambar terdeteksi terlalu tipis (tanpa warna isi) agar tidak hilang saat dirender dalam model 3D.
* **Auto-Scale Iframe:** Saat dimuat di dalam display pameran, layout otomatis mengecil menyesuaikan sisa ruang dan menyembunyikan footer kredit. Halaman dapat di-scroll menggunakan mouse wheel atau touchpad jika layar di bawah resolusi minimum.

### B. Display Akuarium 3D (`display.html` / `display.js`)
* **Renderer 3D:** Menampilkan laut 3D lengkap dengan sinar cahaya dinamis (*volumetric rays*), efek kedalaman kabut (*fog*), dan gelembung air laut (*bubble particles*).
* **Konversi Ikan 2D ke 3D:** Gambar ikan 2D pengunjung dilacak garis tepinya (menggunakan *Moore-Neighbor Contour Tracing*), diekstrusi setipis kertas, dan diberikan efek melengkung mulus (bikonveks) layaknya ikan asli.
* **Animasi GPU Shader:** Kibasan ekor ikan dibuat menggunakan custom shader pada GPU. Dengan `customProgramCacheKey`, liukan ekor ikan dihitung berdasarkan dimensinya sendiri, mencegah distorsi (ikan tertarik/sobek) baik bagi ikan berukuran panjang maupun bulat.
* **Visual Tanpa Batas:** Ukuran latar belakang lautan diatur sebesar `1000x600 unit` agar saat di-zoom out maksimal, tepian layar tidak membentur ruang kosong hitam.
* **Interaktivitas Klik:** Pengunjung dapat mengklik ikan mana saja untuk menampilkan gelembung doa mereka kembali ke permukaan air selama 15 detik.

### C. Panel Admin (`admin.html`)
* **Pengaturan Display:** Menyediakan checkbox untuk menampilkan/menyembunyikan tombol "Menggambar Ikan", "Sembunyikan Doa", "Layar Penuh", atau tombol "Toggle Toolbar" di layar display secara instan.
* **Daftar Galeri Ikan:** Menampilkan seluruh ikan yang tersimpan secara *real-time* terurut dari yang terbaru dikirim.
* **Moderasi Konten:** Admin dapat menghapus ikan secara permanen atau menyembunyikannya dari display 3D (ikan langsung hilang dari akuarium tanpa reload halaman).
* **Bulk Download & Delete:** Mengunduh seluruh ikan pilihan sebagai satu file ZIP, mendownload semua ikan sekaligus, atau membersihkan akuarium dalam satu klik.

---

## 🚀 4. Cara Menjalankan Aplikasi di Pameran

### Langkah 1: Persiapan Server di PC Pameran
1. Pastikan PC Pameran sudah terinstal [Node.js](https://nodejs.org/).
2. Hubungkan PC Pameran dan router Wi-Fi lokal pameran ke jaringan yang sama.
3. Buka Terminal/PowerShell di folder proyek, lalu jalankan perintah:
   ```bash
   npm install
   ```
4. Jalankan server dengan port tertentu (misalnya port `3001`):
   ```bash
   $env:PORT=3001; node server.js
   ```

### Langkah 2: Menampilkan Akuarium di Proyektor
1. Buka browser di PC Pameran (sangat disarankan Google Chrome).
2. Akses alamat: **`http://localhost:3001/display.html`**
3. Hubungkan tampilan browser tersebut ke proyektor. Tekan tombol **Layar Penuh** di kanan atas, atau tekan tombol **F11** pada keyboard Anda untuk tampilan pameran maksimal.
4. Anda dapat menyembunyikan panel tombol menu di layar dengan menekan tombol **"H"** di keyboard atau lewat panel admin.

### Langkah 3: Menghubungkan HP Pengunjung (via Jaringan Wi-Fi Lokal)
1. Sambungkan HP pengunjung ke Wi-Fi pameran.
2. Cari tahu IP lokal PC Pameran Anda (misalnya: `192.168.1.20`).
3. Pengunjung dapat mengakses alamat berikut di HP mereka untuk mulai menggambar:
   ```text
   http://192.168.1.20:3001
   ```
4. Harapan yang dikirim dari HP pengunjung akan langsung meluncur ke layar proyektor akuarium secara *real-time*!

### Langkah 4: Membuka Panel Admin (Moderasi)
1. Akses panel admin di PC pameran atau laptop operator terpisah melalui alamat:
   ```text
   http://localhost:3001/admin.html
   ```

---

## 🔧 5. Troubleshooting & Catatan Teknis
* **Ikan Terlihat Distorsi/Tertarik Saat Berenang:** 
  Masalah ini telah diatasi dengan me-refaktor custom GPU Shader di `display.js`. Batas ekor dihitung secara spesifik menggunakan `#define NOSE_X` dan dibedakan identifikasinya melalui `customProgramCacheKey` agar Three.js tidak salah menggunakan shader ikan lain.
* **Form Doa di HP Lagging saat Mengetik:**
  Masalah ini diatasi di `draw.js` dengan menghentikan pemindaian piksel kanvas (`validateForm`) pada setiap penekanan tombol. Pemindaian hanya dipicu saat kanvas mendeteksi perubahan goresan gambar (`isCanvasDirty`).
* **Halaman Menggambar Terpotong / Susah di-scroll:**
  Di `index.html`, kami telah menambahkan style dinamis khusus iframe yang menonaktifkan footer dan memaksa `overflow-y: auto` pada element `body`. Jika menggunakan mouse atau touchpad, pastikan menggulirkan/men-scroll di sisi **panel kanan (bagian formulir)** karena area kanvas kiri diproteksi untuk fitur zoom kanvas.

---

## ☁️ 6. Panduan Deploy ke GitHub & Hosting Online
Karena aplikasi ini memiliki **backend aktif (Node.js + WebSockets + Database JSON)**, aplikasi ini **tidak bisa di-deploy menggunakan GitHub Pages** (yang hanya mendukung file statis HTML/CSS/JS saja).

Untuk mengunggahnya ke internet agar bisa diakses umum, Anda perlu menyimpannya di GitHub lalu menghubungkannya ke layanan hosting Node.js seperti **Render** (Gratis/Berbayar) atau **Railway**.

### Langkah A: Mengunggah Kode ke GitHub
1. Pastikan Anda sudah menginstal Git di komputer Anda.
2. Buat repositori baru di [GitHub](https://github.com/) (misal bernama `samudera-harapan`).
3. Buka terminal di folder proyek Anda, lalu jalankan perintah berikut:
   ```bash
   # Inisialisasi git
   git init

   # Tambahkan file .gitignore untuk mengabaikan folder node_modules
   echo "node_modules/" > .gitignore

   # Tambahkan semua file dan lakukan commit pertama
   git add .
   git commit -m "First commit - Samudera Harapan"

   # Hubungkan ke repositori GitHub Anda (ganti username & nama-repo dengan milik Anda)
   git branch -M main
   git remote add origin https://github.com/username/nama-repo.git

   # Unggah kode ke GitHub
   git push -u origin main
   ```

### Langkah B: Deploy Online Gratis Menggunakan Render.com
Setelah kode Anda berada di GitHub, Anda bisa mem-publish-nya secara online dengan mudah lewat Render:
1. Daftar atau masuk ke [Render.com](https://render.com/).
2. Klik tombol **New +** dan pilih **Web Service**.
3. Hubungkan akun GitHub Anda dan pilih repositori `samudera-harapan` yang baru dibuat.
4. Pada form konfigurasi layanan, masukkan detail berikut:
   * **Name:** `samudera-harapan`
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `node server.js`
   * **Instance Type:** Pilih **Free** (Gratis)
5. Klik **Create Web Service**.
6. Render akan secara otomatis mengunduh kode Anda dari GitHub, menginstal dependencies, dan meluncurkan server Anda. Anda akan mendapatkan URL publik gratis seperti `https://samudera-harapan.onrender.com`.

> [!WARNING]
> **Catatan untuk Disk Ephemeral pada Render Free Tier:** 
> Server gratis Render menggunakan disk yang akan ter-reset setiap kali server dalam posisi tidur (idle). Hal ini mengakibatkan data ikan di `db.json` akan kembali kosong. Jika ingin data ikan tersimpan permanen di cloud, Anda direkomendasikan untuk memasang fitur *Persistent Disk* di Render (berbayar $1/bulan) atau menghubungkan aplikasi ini ke database eksternal seperti MongoDB/PostgreSQL.

### Langkah C: Bagaimana dengan Firebase?
Firebase memiliki beberapa skenario jika Anda ingin menggunakannya:

1. **Firebase Hosting (Hanya untuk Frontend/Statis):**
   Sama seperti GitHub Pages, Firebase Hosting gratis hanya mendukung file statis. Anda dapat memisahkan folder `public/` untuk di-deploy ke Firebase Hosting, namun server Node.js (`server.js`) dan database tetap harus di-hosting di tempat lain (seperti Render).

2. **Firebase Cloud Run / Google App Engine (Untuk Server Node.js + WebSockets):**
   Karena Firebase berjalan di atas Google Cloud Platform (GCP), Anda dapat men-deploy aplikasi Node.js lengkap ini ke **Google Cloud Run** atau **Google App Engine** yang mendukung WebSockets secara penuh. 

3. **Skenario Serverless (Rombak Kode ke Firebase SDK):**
   Jika Anda ingin aplikasi ini berjalan murni di Firebase secara gratis dan mandiri (tanpa perlu sewa server Node.js aktif), arsitektur kodenya harus dirombak agar tidak menggunakan file lokal `db.json` dan custom WebSockets.
   * **Database & Real-time:** Menggunakan **Firebase Realtime Database** atau **Firestore**. Database ini memiliki fitur *real-time listener* bawaan yang menggantikan fungsi WebSocket server.
   * **Penyimpanan Gambar:** Menggunakan **Firebase Storage** untuk mengunggah gambar ikan pengunjung secara online.
   * **Hosting:** Semua file frontend (`public/`) di-deploy ke **Firebase Hosting**. Frontend akan langsung berkomunikasi dengan Firestore & Storage menggunakan Firebase Client SDK.


