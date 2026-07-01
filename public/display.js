// 3D Ocean Wish Aquarium Display Script
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("aquarium-container");
  const bubblesLayer = document.getElementById("bubbles-layer");
  const newFishOverlay = document.getElementById("new-fish-overlay");
  const announcementName = document.getElementById("announcement-name");
  const announcementWish = document.getElementById("announcement-wish");
  const announcementImg = document.getElementById("announcement-img");

  let scene, camera, renderer;
  let fishes = [];
  let bubbleParticles;
  let raysGroup;
  let showAllBubbles = true;
  let gltfMixer;
  const uniformTime = { value: 0 };
  const clock = new THREE.Clock();

  // Batas ruang akuarium 3D (XYZ)
  const BOUNDS = {
    xMin: -60, xMax: 60,
    yMin: -35, yMax: 35,
    zMin: -50, zMax: 10
  };

  // SOUND SYNTHESIZER (Web Audio API)
  function playSplashSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Sound 1: Chime (High frequency)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4); // A5

      gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.8);

      // Sound 2: Bubble Pop (Low frequency rising)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(150, audioCtx.currentTime + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.3);

      gain2.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(audioCtx.currentTime + 0.1);
      osc2.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn("Audio Context blocked or not supported:", e);
    }
  }

  // 1. SCENE SETUP
  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a2d4a); // Biru laut dasar lebih terang
    // Efek kabut laut yang lebih cerah
    scene.fog = new THREE.FogExp2(0x092b47, 0.012); // Fog lebih tipis agar proyeksi terlihat jelas

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 75);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Latar Belakang Gradien Kedalaman Laut yang sangat cerah (suasana laut tropis yang terang)
    const gradCanvas = document.createElement("canvas");
    gradCanvas.width = 256;
    gradCanvas.height = 256;
    const gradCtx = gradCanvas.getContext("2d");
    const grad = gradCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5ce1e6'); // Atas: Turquoise/Cyan sangat cerah terkena matahari
    grad.addColorStop(0.3, '#00a2e8'); // Tengah: Biru laut tropis yang kaya
    grad.addColorStop(1, '#0c4978'); // Dasar: Biru tua pekat (bukan hitam) agar tetap terang diproyeksikan
    gradCtx.fillStyle = grad;
    gradCtx.fillRect(0, 0, 256, 256);

    const bgTexture = new THREE.CanvasTexture(gradCanvas);
    // Perbesar ukuran background plane agar menutupi layar penuh saat zoom out
    const bgGeometry = new THREE.PlaneGeometry(1000, 600);
    const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false });
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.set(0, 0, -52); // Jauh di belakang
    scene.add(bgMesh);

    // Lightings (Diperkuat secara keseluruhan agar ikan terlihat sangat cerah dan jelas)
    const ambientLight = new THREE.AmbientLight(0x0e507d, 2.5); // Meningkat dari 1.2 ke 2.5
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xccf8ff, 0x0c4978, 2.5); // Meningkat dari 1.4 ke 2.5
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.6); // Meningkat dari 2.0 ke 2.6
    dirLight.position.set(15, 60, 20);
    dirLight.castShadow = true;
    
    // Perbesar ukuran kamera bayangan agar tidak membentuk "kotak terpotong" saat di-zoom out
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005;

    scene.add(dirLight);

    // Light Shafts / Volumetric Ray Sim
    createLightRays();

    // Bubble Particles
    createBubbles();

    // Load default school of fish GLB (Disabled for speed/bandwidth optimization)
    // loadDefaultSchoolOfFish();

    // Listeners
    window.addEventListener("resize", onWindowResize);
  }

  // 1.5. LOAD DEFAULT SCHOOL OF FISH GLB MODEL
  function loadDefaultSchoolOfFish() {
    const loader = new THREE.GLTFLoader();
    loader.load(
      'models/school-of-fish.glb',
      (gltf) => {
        const model = gltf.scene;

        // Atur posisi, skala, dan rotasi agar muat dengan indah di akuarium
        model.scale.set(1.4, 1.4, 1.4);
        model.position.set(0, -5, -20); // Tempatkan agak ke belakang sebagai background

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
              child.material.roughness = 0.3;
              child.material.metalness = 0.2;
              child.material.side = THREE.DoubleSide;
            }
          }
        });

        scene.add(model);
        console.log("School of fish GLB loaded successfully!");

        // Mainkan animasi bawaan model (sekumpulan ikan berenang)
        if (gltf.animations && gltf.animations.length > 0) {
          gltfMixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            const action = gltfMixer.clipAction(clip);
            action.play();
          });
          console.log(`Memainkan ${gltf.animations.length} klip animasi untuk default ikan.`);
        }

        // Sembunyikan loading indicator
        const loaderEl = document.getElementById("model-loading-indicator");
        if (loaderEl) {
          loaderEl.style.opacity = '0';
          loaderEl.style.transform = 'translateY(-10px)';
          setTimeout(() => loaderEl.remove(), 500);
        }
      },
      (xhr) => {
        let percent = 0;
        if (xhr.total > 0) {
          percent = Math.round((xhr.loaded / xhr.total) * 100);
        } else {
          // Fallback jika header Content-Length tidak ada
          percent = Math.round(xhr.loaded / (37.2 * 1024 * 1024) * 100);
          percent = Math.min(99, percent);
        }
        const text = document.getElementById("model-loading-text");
        if (text) text.textContent = `Memuat ikan hiasan... (${percent}%)`;
      },
      (error) => {
        console.error("Gagal memuat default school of fish GLB:", error);
        const loaderEl = document.getElementById("model-loading-indicator");
        if (loaderEl) loaderEl.remove();
      }
    );
  }

  // Membuat Efek Sinar Cahaya Menembus Air (Realistis, Halus & Dinamis)
  function createLightRays() {
    // Membuat tekstur gradien lembut pada canvas offscreen
    // Ini menghilangkan pinggiran tajam (kotak) dan membuat sinar cahaya tampak bervolume
    const rayCanvas = document.createElement("canvas");
    rayCanvas.width = 128;
    rayCanvas.height = 256;
    const rCtx = rayCanvas.getContext("2d");

    // Membuat gradien linier dari atas ke bawah yang memudar di kedua ujungnya agar tidak terpotong saat zoom out
    const rGrad = rCtx.createLinearGradient(0, 0, 0, 256);
    rGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');   // Ujung atas memudar sepenuhnya
    rGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.7)'); // Puncak terang sinar di permukaan air
    rGrad.addColorStop(0.3, 'rgba(180, 245, 255, 0.45)');  // Berangsur redup biru-putih
    rGrad.addColorStop(0.7, 'rgba(120, 230, 255, 0.15)');  // Semakin redup
    rGrad.addColorStop(1, 'rgba(120, 230, 255, 0.0)');    // Ujung bawah memudar sepenuhnya

    rCtx.fillStyle = rGrad;

    // Kita gambar segitiga/trapesium memanjang dengan ujung atas sempit, bawah lebar
    rCtx.beginPath();
    rCtx.moveTo(64 - 12, 0); // Atas sempit
    rCtx.lineTo(64 + 12, 0);
    rCtx.lineTo(128, 256);    // Bawah lebar kanan
    rCtx.lineTo(0, 256);      // Bawah lebar kiri
    rCtx.closePath();
    rCtx.fill();

    // Uji filter blur pada kanvas agar tepian sinar cahaya menyebar halus (feathered)
    try {
      rCtx.filter = 'blur(6px)';
    } catch (e) {
      // Fallback jika browser tidak mendukung filter canvas
    }

    const rayTexture = new THREE.CanvasTexture(rayCanvas);
    rayTexture.minFilter = THREE.LinearFilter;

    // Perpanjang geometri sinar (dari 140 ke 180) agar menjangkau area lebih luas saat zoom out
    const rayGeometry = new THREE.PlaneGeometry(35, 180);

    // Material dengan AdditiveBlending agar tumpang tindih terasa bersinar nyata
    const rayMaterial = new THREE.MeshBasicMaterial({
      map: rayTexture,
      transparent: true,
      opacity: 0.28,             // Ditingkatkan agar lebih terang saat diproyeksikan!
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    raysGroup = new THREE.Group();
    // Tambah jumlah sinar menjadi 10 dan sebar lebih lebar agar tidak terpusat di tengah saat zoom out
    for (let i = 0; i < 10; i++) {
      const ray = new THREE.Mesh(rayGeometry, rayMaterial.clone());
      ray.position.set(-150 + i * 33 + Math.random() * 10, 30, -35 + Math.random() * 20);
      ray.rotation.z = -0.22 - Math.random() * 0.12;
      ray.scale.x = 0.8 + Math.random() * 1.5;
      raysGroup.add(ray);
    }
    scene.add(raysGroup);
  }

  // Membuat Efek Partikel Gelembung
  function createBubbles() {
    const count = 250; // Tambah jumlah gelembung agar tetap ramai saat ruang melebar
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Sebar gelembung lebih lebar secara horizontal (X) dan kedalaman (Z)
      positions[i * 3] = Math.random() * 300 - 150; 
      positions[i * 3 + 1] = Math.random() * (BOUNDS.yMax - BOUNDS.yMin) + BOUNDS.yMin;
      positions[i * 3 + 2] = Math.random() * 100 - 80;
      speeds[i] = 0.05 + Math.random() * 0.08;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Material titik gelembung (glowing point)
    const material = new THREE.PointsMaterial({
      color: 0x00f2fe,
      size: 0.6,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    bubbleParticles = new THREE.Points(geometry, material);
    bubbleParticles.userData = { speeds };
    scene.add(bubbleParticles);
  }

  // Update Partikel Gelembung
  function updateBubbles(dt) {
    if (!bubbleParticles) return;
    const positions = bubbleParticles.geometry.attributes.position.array;
    const speeds = bubbleParticles.userData.speeds;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += speeds[i]; // Bergerak ke atas Y
      // Goyangan horisontal halus
      positions[i * 3] += Math.sin(uniformTime.value + i) * 0.02;

      // Jika gelembung melampaui atas akuarium, reset ke dasar
      if (positions[i * 3 + 1] > BOUNDS.yMax + 15) {
        positions[i * 3 + 1] = BOUNDS.yMin - 10;
        positions[i * 3] = Math.random() * 300 - 150; // Reset ke posisi horizontal acak yang lebar
      }
    }
    bubbleParticles.geometry.attributes.position.needsUpdate = true;
  }

  // 2. LOGIKA MEMBUAT IKAN 3D (Lensa Bikonveks: Melengkung Mulus dari Tepian ke Tengah, Tanpa Celah)
  function createFishMesh3D(imageDataUrl, callback) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageDataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Lacak kontur luar ikan
      const contourPoints = traceContour(canvas);
      if (contourPoints.length < 3) {
        // Fallback: plane sederhana (hampir tidak pernah terjadi)
        const planeGeo = new THREE.PlaneGeometry(12, 9);
        const planeTex = new THREE.CanvasTexture(canvas);
        const planeMat = new THREE.MeshStandardMaterial({ map: planeTex, transparent: true, side: THREE.DoubleSide });
        callback(new THREE.Mesh(planeGeo, planeMat));
        return;
      }

      // Sederhanakan kontur
      const step = Math.max(1, Math.round(contourPoints.length / 80));
      const simplified = [];
      for (let i = 0; i < contourPoints.length; i += step) {
        simplified.push(contourPoints[i]);
      }

      // Centroid untuk pivot tengah
      let sumX = 0, sumY = 0;
      simplified.forEach(p => { sumX += p.x; sumY += p.y; });
      const centerX = sumX / simplified.length;
      const centerY = sumY / simplified.length;

      // Buat THREE.Shape dari kontur
      const scaleFactor = 12 / canvas.width;
      const to3D = (pt) => ({
        x: (pt.x - centerX) * scaleFactor,
        y: -(pt.y - centerY) * scaleFactor
      });

      const shape = new THREE.Shape();
      const start = to3D(simplified[0]);
      shape.moveTo(start.x, start.y);
      for (let i = 1; i < simplified.length; i++) {
        const pt = to3D(simplified[i]);
        shape.lineTo(pt.x, pt.y);
      }
      shape.closePath();

      // ─── PAPER-THIN EXTRUSION ───
      // Ikan setipis kertas dengan sedikit bevel untuk kesan organik
      const extrudeSettings = {
        depth: 0,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.3,
        bevelThickness: 0.06   // Total tebal ~0.12 unit — setipis kertas
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.center(); // Pusatkan di Z=0

      // Normalize ukuran ikan agar seragam
      geometry.computeBoundingBox();
      const sizeVec = new THREE.Vector3();
      geometry.boundingBox.getSize(sizeVec);
      const maxDim = Math.max(sizeVec.x, sizeVec.y);
      if (maxDim > 0) {
        const sf = 12.0 / maxDim;
        geometry.scale(sf, sf, 1.0); // Z tidak discale agar tebal seragam
      }
      geometry.computeBoundingBox();
      const noseX = geometry.boundingBox.max.x;

      // Buat tekstur dari gambar pengunjung
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      // Sesuaikan UV agar gambar memetakan tepat di muka depan & belakang
      const bb = geometry.boundingBox;
      const rangeX = bb.max.x - bb.min.x;
      const rangeY = bb.max.y - bb.min.y;
      const uvAttr = geometry.attributes.uv;
      const posAttr = geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        uvAttr.setXY(i,
          (posAttr.getX(i) - bb.min.x) / rangeX,
          (posAttr.getY(i) - bb.min.y) / rangeY
        );
      }
      uvAttr.needsUpdate = true;

      // Material muka (gambar pengunjung)
      const faceMat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.08,
        side: THREE.DoubleSide,
        roughness: 0.3,
        metalness: 0.12
      });

      // Ambil warna rata-rata dari piksel TEPIAN/KONTUR ikan
      // (bukan seluruh gambar) karena bevel menyambung tepat di garis tepi siluet
      const edgeCtx = canvas.getContext('2d');
      const edgeImgData = edgeCtx.getImageData(0, 0, canvas.width, canvas.height);
      const edgePx = edgeImgData.data;
      let rSum = 0, gSum = 0, bSum = 0, eCount = 0;
      // Gunakan titik-titik kontur yang sudah dihitung sebelumnya
      for (const pt of simplified) {
        const px = Math.min(canvas.width - 1, Math.max(0, Math.round(pt.x)));
        const py = Math.min(canvas.height - 1, Math.max(0, Math.round(pt.y)));
        const idx = (py * canvas.width + px) * 4;
        if (edgePx[idx + 3] > 20) { // Pastikan piksel cukup solid
          rSum += edgePx[idx];
          gSum += edgePx[idx + 1];
          bSum += edgePx[idx + 2];
          eCount++;
        }
      }
      const edgeColor = eCount > 0
        ? new THREE.Color(rSum / eCount / 255, gSum / eCount / 255, bSum / eCount / 255)
        : new THREE.Color(0x8ecae6); // Fallback jika tidak ada piksel valid

      // Material bevel/samping: pakai warna tepi ikan agar menyatu natural
      const sideMat = new THREE.MeshStandardMaterial({
        color: edgeColor,
        roughness: 0.25,
        metalness: 0.4,
        flatShading: false
      });


      const mesh = new THREE.Mesh(geometry, [faceMat, sideMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { noseX };

      setupWiggleShader(faceMat, noseX);
      setupWiggleShader(sideMat, noseX);

      callback(mesh);
    };
  }


  // Moore-Neighbor Contour Tracing Algorithm
  function traceContour(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const isSolid = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return data[(y * width + x) * 4 + 3] > 40; // Alpha threshold
    };

    // Cari piksel padat pertama dari kiri-atas
    let startX = -1, startY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isSolid(x, y)) {
          startX = x;
          startY = y;
          break;
        }
      }
      if (startX !== -1) break;
    }

    if (startX === -1) return []; // Kosong

    const points = [];
    let cx = startX;
    let cy = startY;

    // Arah tetangga (0: Atas, 1: Atas-Kanan, 2: Kanan, 3: Bawah-Kanan, 4: Bawah, 5: Bawah-Kiri, 6: Kiri, 7: Atas-Kiri)
    const dx = [0, 1, 1, 1, 0, -1, -1, -1];
    const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

    let enterDir = 6; // Mulai memeriksa dari kiri
    let loopGuard = 0;
    const maxLoops = 6000;

    do {
      points.push({ x: cx, y: cy });
      let found = false;

      for (let i = 0; i < 8; i++) {
        const checkDir = (enterDir + i) % 8;
        const nx = cx + dx[checkDir];
        const ny = cy + dy[checkDir];

        if (isSolid(nx, ny)) {
          cx = nx;
          cy = ny;
          enterDir = (checkDir + 5) % 8; // Arah hadap masuk berikutnya
          found = true;
          break;
        }
      }

      if (!found) break; // Coretan terisolasi
      loopGuard++;
    } while ((cx !== startX || cy !== startY) && loopGuard < maxLoops);

    return points;
  }

  // WIGGLE VERTEX SHADER DEFORMATION
  // Membengkokkan ekor ikan di GPU secara real-time berdasarkan posisi sumbu X lokal
  function setupWiggleShader(material, noseX) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.time = uniformTime;
      shader.uniforms.wiggleSpeed = { value: 13.0 };
      shader.uniforms.wiggleAmp = { value: 0.12 }; // Amplitudo kibasan
      shader.uniforms.wiggleFreq = { value: 0.35 }; // Frekuensi kelenturan badan

      shader.vertexShader = `
        uniform float time;
        uniform float wiggleSpeed;
        uniform float wiggleAmp;
        uniform float wiggleFreq;
        #define NOSE_X ${noseX.toFixed(5)}
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        // Menggoyangkan bagian belakang (local X < noseX) di sumbu Z lokal
        // Semakin jauh dari hidung, goyangan ekor semakin besar
        float distFromNose = max(0.0, float(NOSE_X) - position.x);
        float wiggle = sin(time * wiggleSpeed + position.x * wiggleFreq) * wiggleAmp * distFromNose;
        transformed.z += wiggle;
        `
      );
    };
    
    // Memberikan Cache Key unik berdasarkan noseX agar shader tidak tercampur/bertabrakan
    material.customProgramCacheKey = function() {
      return noseX.toFixed(5);
    };
  }

  // 3. LOGIKA POPUP PRAYER BUBBLE HTML
  function createHtmlPrayerBubble(fishObj) {
    const bubble = document.createElement("div");
    bubble.className = "prayer-bubble";
    bubble.id = `bubble-${fishObj.id}`;

    // Isi teks balon doa (aman dari XSS karena pakai textContent)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'bubble-name';
    nameSpan.textContent = fishObj.name;

    const wishSpan = document.createElement('span');
    wishSpan.className = 'bubble-wish';
    wishSpan.textContent = fishObj.wish;

    bubble.appendChild(nameSpan);
    bubble.appendChild(wishSpan);

    bubblesLayer.appendChild(bubble);
    fishObj.htmlElement = bubble;
  }

  function updateHtmlBubblesProjection() {
    const tempV = new THREE.Vector3();

    fishes.forEach(fish => {
      if (!fish.mesh || !fish.htmlElement) return;

      // Jika balon doa global disembunyikan ATAU waktu balon ikan ini telah habis, sembunyikan balon
      if (!showAllBubbles || fish.wishTimer <= 0) {
        fish.htmlElement.style.display = 'none';
        return;
      }

      // Dapatkan posisi dunia 3D ikan
      fish.mesh.getWorldPosition(tempV);

      // Naikkan sedikit Y agar melayang di atas punggung ikan
      tempV.y += 6.5;

      // Proyeksikan koordinat 3D ke ruang klip 2D kamera
      tempV.project(camera);

      // Periksa apakah ikan berada di belakang kamera
      if (tempV.z > 1) {
        fish.htmlElement.style.display = 'none';
        return;
      }

      // Konversi koordinat klip (-1 ke 1) ke posisi piksel layar CSS
      const x = (tempV.x * .5 + .5) * window.innerWidth;
      const y = (tempV.y * -.5 + .5) * window.innerHeight;

      fish.htmlElement.style.display = 'flex';
      fish.htmlElement.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;

      // Efek parallax skala balon doa berdasarkan kedalaman Z kamera
      const depthScale = Math.max(0.4, 1.0 - (fish.mesh.position.z + 10) / -80);
      fish.htmlElement.style.scale = depthScale.toFixed(2);
    });
  }

  // 4. ANIMASI IKAN BERENANG (XYZ)
  function createFishObject(data, isNew = false) {
    createFishMesh3D(data.image, (mesh) => {
      // SPAWN POSITION: Tempatkan ikan ke bagian DEPAN (Z = 10) saat pertama kali spawn
      // X dan Y ditempatkan di sekitar tengah agar langsung terlihat di layar
      const px = (Math.random() - 0.5) * 22;
      const py = (Math.random() - 0.5) * 12;
      const pz = 10; // ZMax adalah 10 (Depan)

      mesh.position.set(px, py, pz);

      // Ukuran fisik disamakan. Mesh sudah dinormalisasi geometri 12.0 unit.
      // Kita beri sedikit variasi kecil saja agar tidak monoton (95% - 105%)
      const scale = 0.95 + Math.random() * 0.1;
      mesh.scale.set(scale, scale, scale);

      scene.add(mesh);

      const fishObj = {
        id: data.id,
        name: data.name,
        wish: data.wish,
        mesh: mesh,
        htmlElement: null,
        // Parameter gerak
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 6
        ),
        target: new THREE.Vector3(),
        speed: 8 + Math.random() * 6,
        changeTargetTimer: 0,
        wishTimer: isNew ? 15.0 : 0 // Tampilkan balon doa selama 15 detik hanya untuk ikan baru!
      };

      chooseNewTarget(fishObj);
      createHtmlPrayerBubble(fishObj);
      fishes.push(fishObj);
    });
  }

  // Hapus semua ikan dari scene 3D (dipanggil via WebSocket clear_all)
  function removeAllFishes() {
    console.log('Menghapus semua ikan dari akuarium...');
    fishes.forEach(fish => {
      if (fish.mesh) {
        scene.remove(fish.mesh);
        if (fish.mesh.geometry) fish.mesh.geometry.dispose();
        if (fish.mesh.material) {
          const mats = Array.isArray(fish.mesh.material) ? fish.mesh.material : [fish.mesh.material];
          mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      }
      if (fish.htmlElement) {
        fish.htmlElement.remove();
      }
    });
    fishes = [];
    console.log('Akuarium bersih.');
  }

  // Hapus satu ikan dari scene 3D berdasarkan ID
  function removeFishById(id) {
    try {
      const idx = fishes.findIndex(f => f.id === id);
      if (idx === -1) return;
      const fish = fishes[idx];
      console.log(`Menghapus ikan ${id} (${fish.name}) dari scene...`);
      if (fish.mesh) {
        scene.remove(fish.mesh);
        if (fish.mesh.geometry) fish.mesh.geometry.dispose();
        if (fish.mesh.material) {
          const mats = Array.isArray(fish.mesh.material) ? fish.mesh.material : [fish.mesh.material];
          mats.forEach(m => {
            try { if (m.map) m.map.dispose(); } catch(e) {}
            try { m.dispose(); } catch(e) {}
          });
        }
      }
      if (fish.htmlElement && fish.htmlElement.parentNode) {
        fish.htmlElement.remove();
      }
      fishes.splice(idx, 1);
      console.log(`Ikan ${id} berhasil dihapus dari scene.`);
    } catch (e) {
      console.error(`Gagal menghapus ikan ${id}:`, e);
    }
  }

  function chooseNewTarget(fish) {
    fish.target.set(
      Math.random() * (BOUNDS.xMax - BOUNDS.xMin) + BOUNDS.xMin,
      Math.random() * (BOUNDS.yMax - BOUNDS.yMin) + BOUNDS.yMin,
      Math.random() * (BOUNDS.zMax - BOUNDS.zMin) + BOUNDS.zMin
    );
    fish.changeTargetTimer = 8 + Math.random() * 12; // Ganti target setiap 8-20 detik
  }

  function updateFishes(dt) {
    fishes.forEach(fish => {
      if (!fish.mesh) return;

      fish.changeTargetTimer -= dt;

      // Update timer tayang balon doa
      if (fish.wishTimer > 0) {
        fish.wishTimer -= dt;
        if (fish.wishTimer <= 0) {
          if (fish.htmlElement) {
            fish.htmlElement.classList.add('fade-out');
            fish.htmlElement.classList.remove('fade-in');
            setTimeout(() => {
              if (fish.wishTimer <= 0 && fish.htmlElement) {
                fish.htmlElement.style.display = 'none';
              }
            }, 500);
          }
        }
      }

      // Hitung jarak ke target
      const distToTarget = fish.mesh.position.distanceTo(fish.target);
      if (distToTarget < 10 || fish.changeTargetTimer <= 0) {
        chooseNewTarget(fish);
      }

      // Hitung kemudi (steering) menuju target
      const desiredVelocity = new THREE.Vector3()
        .subVectors(fish.target, fish.mesh.position)
        .normalize()
        .multiplyScalar(fish.speed);

      // Interpolasi kecepatan halus (slerp/lerp kemudi)
      fish.velocity.lerp(desiredVelocity, 1.2 * dt);

      // Batasi kecepatan maksimum
      fish.velocity.clampLength(0.5, fish.speed);

      // Update posisi
      fish.mesh.position.addScaledVector(fish.velocity, dt);

      // Arahkan hadapan ikan ke kecepatan bergerak
      const targetLookAt = fish.mesh.position.clone().add(fish.velocity);

      const dummy = new THREE.Object3D();
      dummy.position.copy(fish.mesh.position);
      dummy.lookAt(targetLookAt);

      // Kepala ikan digambar menghadap KANAN (X+).
      // Kita putar dummy -90 derajat agar X+ lokal mengarah ke arah renang (Z-).
      dummy.rotateY(-Math.PI / 2);

      // Lerp rotasi (Slerp) agar ikan berbelok secara anggun
      fish.mesh.quaternion.slerp(dummy.quaternion, 2.5 * dt);
    });
  }

  // 5. ANIMASI UTAMA LOOP
  function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    uniformTime.value += dt;

    // Update GLTF school of fish animation mixer
    if (gltfMixer) {
      gltfMixer.update(dt);
    }

    // Gerakkan ikan & gelembung
    updateFishes(dt);
    updateBubbles(dt);

    // Proyeksikan balon doa 2D tepat di koordinat ikan
    updateHtmlBubblesProjection();

    // Animasi sinar cahaya yang bergoyang (caustics sway) & opacity pulsasi
    if (raysGroup) {
      raysGroup.children.forEach((ray, i) => {
        ray.rotation.z = -0.22 - Math.sin(uniformTime.value * 0.45 + i) * 0.05;
        ray.material.opacity = 0.22 + Math.sin(uniformTime.value * 0.75 + i) * 0.06;
      });
    }

    renderer.render(scene, camera);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ─── ZOOM: Mouse Scroll & Pinch Gesture ───
  let currentZoom = 1.0;
  const ZOOM_MIN = 0.6;
  const ZOOM_MAX = 2.5;
  const ZOOM_STEP = 0.04; // per scroll notch
  const zoomResetBtn = document.getElementById('btn-reset-zoom');

  function applyZoom(newZoom) {
    currentZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    camera.zoom = currentZoom;
    camera.updateProjectionMatrix();
    // Tampilkan/sembunyikan tombol reset
    if (zoomResetBtn) {
      zoomResetBtn.style.display = Math.abs(currentZoom - 1.0) > 0.01 ? 'flex' : 'none';
    }
  }

  // Reset zoom ke default
  function resetZoom() {
    applyZoom(1.0);
  }

  // Mouse / Trackpad Scroll
  window.addEventListener('wheel', (e) => {
    // Abaikan jika user scroll di dalam overlay drawing panel
    if (e.target.closest('#draw-panel-overlay')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    applyZoom(currentZoom + delta);
  }, { passive: false });

  // Tombol reset zoom
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', resetZoom);
  }

  // Keyboard shortcut R untuk reset zoom
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetZoom();
    }
  });

  // Pinch-to-Zoom (Touch)
  let pinchStartDist = 0;
  let pinchStartZoom = 1.0;

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoom = currentZoom;
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (pinchStartDist > 0) {
        const scale = dist / pinchStartDist;
        applyZoom(pinchStartZoom * scale);
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    pinchStartDist = 0;
  });

  // 6. REAL-TIME WEBSOCKET & LOAD DATA AWAL
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    let ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Terhubung ke WebSocket Server.");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'new_fish') {
          triggerNewFishAnnouncement(message.data);
        } else if (message.type === 'clear_all') {
          removeAllFishes();
        } else if (message.type === 'hide_all') {
          // Moderasi: admin menyembunyikan semua ikan sekaligus
          removeAllFishes();
        } else if (message.type === 'delete_fish') {
          removeFishById(message.id);
        } else if (message.type === 'toggle_hidden') {
          if (message.hidden) {
            removeFishById(message.id);
          } else {
            // Ikan di-unhide — ambil data lengkap dari API lalu tampilkan
            fetch(`/api/fishes`)
              .then(res => res.json())
              .then(data => {
                const fish = data.find(f => f.id === message.id);
                if (fish && !fish.hidden) {
                  createFishObject(fish);
                }
              })
              .catch(() => {});
          }
        } else if (message.type === 'settings_update') {
          applyDisplaySettings(message.settings);
        }
      } catch (e) {
        // Abaikan pesan pong
      }
    };

    ws.onclose = () => {
      console.log("WebSocket terputus. Mencoba menghubungkan kembali dalam 5 detik...");
      setTimeout(connectWebSocket, 5000);
    };
  }

  // Menampilkan Efek Pengumuman "Ikan Baru Masuk!" di Layar
  function triggerNewFishAnnouncement(fishData) {
    // Putar suara splash
    playSplashSound();

    // Isi data pengumuman
    announcementName.textContent = fishData.name;
    announcementWish.textContent = fishData.wish;
    announcementImg.src = fishData.image;

    // Aktifkan overlay kartu pop-up
    newFishOverlay.classList.add("active");

    // Masukkan ikan langsung ke dalam akuarium 3D di latar belakang
    createFishObject(fishData, true);

    // Hilangkan kartu setelah 5.5 detik
    setTimeout(() => {
      newFishOverlay.classList.remove("active");
    }, 5500);
  }

  // Muat semua ikan yang tersimpan di DB saat pertama kali dibuka
  function loadExistingFishes() {
    fetch("/api/fishes")
      .then(res => res.json())
      .then(data => {
        // Filter hanya ikan yang tidak di-hidden (moderasi konten)
        const visibleFish = data.filter(f => !f.hidden);
        console.log(`Memuat ${visibleFish.length} ikan dari database lokal (${data.length - visibleFish.length} disembunyikan).`);
        visibleFish.forEach(fish => {
          createFishObject(fish);
        });
      })
      .catch(err => {
        console.error("Gagal memuat data ikan awal:", err);
      });
  }

  // ─── POLLING SYNC: Hanya untuk menghapus ikan yang di-hidden (fallback jika WebSocket missed) ───
  // CATATAN: Sync tidak menambah ikan — WebSocket handle semua penambahan.
  //           Ini mencegah race condition dengan createFishObject yang async (load gambar).
  function syncWithServer() {
    fetch("/api/fishes")
      .then(res => res.json())
      .then(data => {
        // Kumpulkan ID ikan dari server
        const serverFishMap = new Map(data.map(f => [f.id, f]));

        // Hapus ikan lokal yang tidak ada di server ATAU di-hidden di server
        const toRemove = fishes.filter(f => {
          const serverFish = serverFishMap.get(f.id);
          return !serverFish || serverFish.hidden;
        });

        toRemove.forEach(f => {
          console.log(`Sync: menghapus ${f.id} (${f.name}) — sudah dihapus/hidden di server`);
          removeFishById(f.id);
        });

        if (toRemove.length > 0) {
          console.log(`Sync selesai: ${toRemove.length} ikan disembunyikan`);
        }
      })
      .catch(() => {}); // Silent fail — coba lagi nanti
  }

  // Jalankan sync setiap 8 detik
  setInterval(syncWithServer, 8000);

  // 7. RAYCASTER CLICK DETECTION (Klik ikan untuk memunculkan doa kembali)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('click', (e) => {
    // Abaikan klik jika mengklik elemen UI yang seharusnya tidak memicu raycaster
    if (
      e.target.closest('.ui-btn') || 
      e.target.closest('.prayer-bubble') || 
      e.target.closest('.reset-zoom-btn') || 
      e.target.closest('#draw-panel-overlay')
    ) return;

    // Konversi koordinat mouse klik
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Cari intersection dengan mesh ikan yang sedang aktif
    const activeMeshes = fishes.map(f => f.mesh).filter(Boolean);
    const intersects = raycaster.intersectObjects(activeMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const fish = fishes.find(f => f.mesh === clickedMesh);

      if (fish) {
        // Reset waktu tampil balon doa ke 15.0 detik
        fish.wishTimer = 15.0;
        if (fish.htmlElement) {
          fish.htmlElement.classList.remove('fade-out');
          fish.htmlElement.classList.add('fade-in');
          if (showAllBubbles) {
            fish.htmlElement.style.display = 'flex';
          }
        }
        playSplashSound(); // Mainkan efek suara gelembung
      }
    }
  });

  // 8. TETHER FLOATING BUTTON EVENT HANDLERS
  const btnToggleBubbles = document.getElementById("btn-toggle-bubbles");
  const btnFullscreen = document.getElementById("btn-fullscreen");

  if (btnToggleBubbles) {
    btnToggleBubbles.addEventListener("click", () => {
      showAllBubbles = !showAllBubbles;
      btnToggleBubbles.textContent = showAllBubbles ? "👁️ Sembunyikan Doa" : "👁️ Tampilkan Doa";

      fishes.forEach(fish => {
        if (fish.htmlElement) {
          if (!showAllBubbles) {
            fish.htmlElement.style.display = 'none';
          } else if (fish.wishTimer > 0) {
            fish.htmlElement.style.display = 'flex';
          }
        }
      });
    });
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
          btnFullscreen.textContent = "🖥️ Keluar Fullscreen";
        }).catch(err => {
          console.error("Gagal mengaktifkan Fullscreen:", err);
        });
      } else {
        document.exitFullscreen();
        btnFullscreen.textContent = "🖥️ Layar Penuh";
      }
    });

    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        btnFullscreen.textContent = "🖥️ Layar Penuh";
      }
    });
  }

  // 9. KEYBOARD SHORTCUT + TOMBOL: Sembunyikan/tampilkan toolbar
  const displayControls = document.querySelector('.display-controls');
  const btnToggleToolbar = document.getElementById('btn-toggle-toolbar');

  function toggleToolbar() {
    if (!displayControls) return;
    const isHidden = displayControls.style.display === 'none';
    displayControls.style.display = isHidden ? 'flex' : 'none';
  }

  if (btnToggleToolbar) {
    btnToggleToolbar.addEventListener('click', toggleToolbar);
  }

  window.addEventListener('keydown', (e) => {
    // Abaikan jika user sedang mengetik di input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      toggleToolbar();
    }
  });

  function applyDisplaySettings(settings) {
    const btnDraw = document.getElementById("btn-draw");
    const btnToggleBubbles = document.getElementById("btn-toggle-bubbles");
    const btnFullscreen = document.getElementById("btn-fullscreen");
    const btnToggleToolbar = document.getElementById("btn-toggle-toolbar");
    const displayControls = document.querySelector(".display-controls");

    if (btnDraw) btnDraw.style.display = settings.hideDrawBtn ? "none" : "";
    if (btnToggleBubbles) btnToggleBubbles.style.display = settings.hideToggleBubblesBtn ? "none" : "";
    if (btnFullscreen) btnFullscreen.style.display = settings.hideFullscreenBtn ? "none" : "";
    if (btnToggleToolbar) btnToggleToolbar.style.display = settings.hideToolbarToggleBtn ? "none" : "";

    // Jika semua tombol menu disembunyikan, sembunyikan container menunya juga
    if (displayControls) {
      const anyVisible = !settings.hideDrawBtn || !settings.hideToggleBubblesBtn || !settings.hideFullscreenBtn;
      displayControls.style.opacity = anyVisible ? "" : "0";
      displayControls.style.pointerEvents = anyVisible ? "" : "none";
    }
  }

  function loadDisplaySettings() {
    fetch("/api/settings")
      .then(res => res.json())
      .then(settings => {
        applyDisplaySettings(settings);
      })
      .catch(err => {
        console.error("Gagal memuat pengaturan display awal:", err);
      });
  }

  // Mulai Aplikasi
  loadDisplaySettings();
  initScene();
  loadExistingFishes();
  connectWebSocket();
  animate();
});
