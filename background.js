// Standalone Reactive 3D Ocean Background Script with MediaPipe Pose Sensor
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("canvas-container");
  const btnToggleCamera = document.getElementById("btn-toggle-camera");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const statusPill = document.getElementById("sensor-status");
  const statusText = document.getElementById("status-text");
  const videoElement = document.getElementById("webcam-video");

  let scene, camera, renderer;
  let bubbleParticles;
  let raysGroup;
  let penyoMesh = null;
  let videoMesh = null;
  let reactiveVideo = document.getElementById("reactive-video");
  let isPlayingVideo = false;

  const uniformTime = { value: 0 };
  const clock = new THREE.Clock();

  // MediaPipe & Reactive Variables
  let cameraHelper = null;
  let pose = null;
  let isCameraActive = true;
  let isPersonDetected = false;
  let wristHistory = [];
  let lastWaveTime = 0;

  // Smoothing (Lerp) variables for reactive interaction
  let targetProximity = 0.0;   // 0.0 (jauh/kosong) -> 1.0 (sangat dekat)
  let currentProximity = 0.0;
  let targetPersonX = 0.0;     // Posisi X di dunia 3D Three.js
  let targetPersonY = 0.0;     // Posisi Y di dunia 3D Three.js
  let currentPersonX = 0.0;
  let currentPersonY = 0.0;

  // Batas ruang 3D (XYZ)
  const BOUNDS = {
    xMin: -60, xMax: 60,
    yMin: -35, yMax: 35,
    zMin: -50, zMax: 10
  };

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

  // 1. SCENE SETUP THREE.JS
  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a2d4a);
    scene.fog = new THREE.FogExp2(0x092b47, 0.012);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 75);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Latar Belakang Gradien Kedalaman Laut
    const gradCanvas = document.createElement("canvas");
    gradCanvas.width = 256;
    gradCanvas.height = 256;
    const gradCtx = gradCanvas.getContext("2d");
    const grad = gradCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5ce1e6');
    grad.addColorStop(0.3, '#00a2e8');
    grad.addColorStop(1, '#0c4978');
    gradCtx.fillStyle = grad;
    gradCtx.fillRect(0, 0, 256, 256);

    const bgTexture = new THREE.CanvasTexture(gradCanvas);
    const bgGeometry = new THREE.PlaneGeometry(1000, 600);
    const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false });
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.set(0, 0, -52);
    scene.add(bgMesh);

    // Pencahayaan Utama
    const ambientLight = new THREE.AmbientLight(0x0e507d, 2.5);
    ambientLight.name = "ambientLight";
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xccf8ff, 0x0c4978, 2.5);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.6);
    dirLight.position.set(15, 60, 20);
    dirLight.name = "dirLight";
    scene.add(dirLight);

    // Efek Sinar Cahaya Menembus Air
    createLightRays();

    // Partikel Gelembung Laut
    createBubbles();

    // Asset Penyu Reaktif & Dekorasi Laut
    loadUnderwaterAssets();

    window.addEventListener("resize", onWindowResize);
  }

  // Efek Sinar Cahaya Menembus Air
  function createLightRays() {
    const rayCanvas = document.createElement("canvas");
    rayCanvas.width = 128;
    rayCanvas.height = 256;
    const rCtx = rayCanvas.getContext("2d");

    const rGrad = rCtx.createLinearGradient(0, 0, 0, 256);
    rGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    rGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.7)');
    rGrad.addColorStop(0.3, 'rgba(180, 245, 255, 0.45)');
    rGrad.addColorStop(0.7, 'rgba(120, 230, 255, 0.15)');
    rGrad.addColorStop(1, 'rgba(120, 230, 255, 0.0)');

    rCtx.fillStyle = rGrad;
    rCtx.beginPath();
    rCtx.moveTo(64 - 12, 0);
    rCtx.lineTo(64 + 12, 0);
    rCtx.lineTo(128, 256);
    rCtx.lineTo(0, 256);
    rCtx.closePath();
    rCtx.fill();

    try { rCtx.filter = 'blur(6px)'; } catch (e) {}

    const rayTexture = new THREE.CanvasTexture(rayCanvas);
    rayTexture.minFilter = THREE.LinearFilter;

    const rayGeometry = new THREE.PlaneGeometry(35, 180);
    const rayMaterial = new THREE.MeshBasicMaterial({
      map: rayTexture,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    raysGroup = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const ray = new THREE.Mesh(rayGeometry, rayMaterial.clone());
      ray.position.set(-150 + i * 28 + Math.random() * 8, 30, -35 + Math.random() * 20);
      ray.rotation.z = -0.22 - Math.random() * 0.12;
      ray.scale.x = 0.8 + Math.random() * 1.5;
      ray.userData = { initialX: ray.position.x, speed: 0.5 + Math.random() * 0.5 };
      raysGroup.add(ray);
    }
    scene.add(raysGroup);
  }

  // Partikel Gelembung Air
  function createBubbles() {
    const count = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const initialPos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 300 - 150;
      const y = Math.random() * (BOUNDS.yMax - BOUNDS.yMin) + BOUNDS.yMin;
      const z = Math.random() * 100 - 80;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      initialPos[i * 3] = x;
      initialPos[i * 3 + 1] = y;
      initialPos[i * 3 + 2] = z;

      speeds[i] = 0.05 + Math.random() * 0.08;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00f2fe,
      size: 0.7,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    bubbleParticles = new THREE.Points(geometry, material);
    bubbleParticles.userData = { speeds, initialPos };
    scene.add(bubbleParticles);
  }

  // Memuat Asset Gambar Penyu (Penyo.png) dan Hiasan Karang Laut
  function loadUnderwaterAssets() {
    const loader = new THREE.TextureLoader();

    // Load Penyo.png (Penyu Laut Reaktif 3D)
    loader.load('Penyo.png', (texture) => {
      texture.minFilter = THREE.LinearFilter;
      const aspect = texture.image.width / texture.image.height;
      const height = 18;
      const width = height * aspect;

      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      penyoMesh = new THREE.Mesh(geometry, material);
      penyoMesh.position.set(0, -10, -10);
      scene.add(penyoMesh);
      console.log("Penyo.png berhasil dimuat sebagai elemen reaktif laut!");
    });

    // Memuat Video Reaktif 0729.mov dengan Shader Transparansi Background Hitam
    loadReactiveVideo();
  }

  function loadReactiveVideo() {
    if (!reactiveVideo) {
      reactiveVideo = document.createElement("video");
      reactiveVideo.id = "reactive-video";
      reactiveVideo.src = "video/0729.mov";
      reactiveVideo.playsInline = true;
      reactiveVideo.loop = false;
      document.body.appendChild(reactiveVideo);
    }

    reactiveVideo.muted = false;
    reactiveVideo.volume = 1.0;

    // Helper pembuka audio terhalang kebijakan browser
    const unlockVideoAudio = () => {
      if (reactiveVideo) reactiveVideo.muted = false;
    };
    window.addEventListener('click', unlockVideoAudio);
    window.addEventListener('touchstart', unlockVideoAudio);

    const videoTexture = new THREE.VideoTexture(reactiveVideo);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    // Custom Shader Material untuk Menghapus Background Hitam pada Video (Chroma Key Luminance)
    const blackKeyShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: videoTexture },
        threshold: { value: 0.12 },
        smoothness: { value: 0.08 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float threshold;
        uniform float smoothness;
        varying vec2 vUv;

        void main() {
          vec4 texColor = texture2D(map, vUv);
          float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
          float alpha = smoothstep(threshold, threshold + smoothness, luma);
          gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Ukuran Video Dibuat Sangat Besar Memenuhi Layar (Lebar 95 unit)
    const geometry = new THREE.PlaneGeometry(95, 95 * (9 / 16));
    videoMesh = new THREE.Mesh(geometry, blackKeyShaderMaterial);
    videoMesh.position.set(0, 0, -5);
    videoMesh.visible = false;
    scene.add(videoMesh);

    reactiveVideo.onended = () => {
      onVideoEnded();
    };

    reactiveVideo.onerror = (err) => {
      console.warn("Gagal memutar video 0729.mov:", err);
      onVideoEnded();
    };
  }

  function triggerVideoOnWave() {
    if (isPlayingVideo) return;
    isPlayingVideo = true;

    console.log("👋 Lambaian tangan terdeteksi! Memutar video 0729.mov...");
    statusText.textContent = "👋 Lambaian Tangan Terdeteksi! Memutar Video...";
    statusPill.className = "status-pill reactive";

    // Sembunyikan Penyo
    if (penyoMesh) {
      penyoMesh.visible = false;
    }

    // Posisikan video di koordinat X, Y pengunjung (besar & dekat kamera)
    if (videoMesh) {
      videoMesh.position.x = currentPersonX * 0.4;
      videoMesh.position.y = currentPersonY * 0.4;
      videoMesh.position.z = -5;
      videoMesh.visible = true;
    }

    reactiveVideo.currentTime = 0;
    reactiveVideo.play().catch(err => {
      console.warn("Autoplay video error:", err);
      onVideoEnded();
    });
  }

  function onVideoEnded() {
    isPlayingVideo = false;
    if (videoMesh) {
      videoMesh.visible = false;
    }
    // Kembali ke Penyo.png!
    if (penyoMesh) {
      penyoMesh.visible = true;
    }
    statusText.textContent = "✨ Pengunjung Terdeteksi! Penyo Kembali";
  }

  // Update Gelembung & Reaktivitas
  function updateBubbles(dt) {
    if (!bubbleParticles) return;
    const positions = bubbleParticles.geometry.attributes.position.array;
    const speeds = bubbleParticles.userData.speeds;
    const count = positions.length / 3;

    // Kecepatan gelembung meningkat jika ada pengunjung mendekat
    const speedMultiplier = 1.0 + currentProximity * 2.5;

    for (let i = 0; i < count; i++) {
      // Pergerakan vertikal naik
      positions[i * 3 + 1] += speeds[i] * speedMultiplier;
      positions[i * 3] += Math.sin(uniformTime.value + i) * 0.02;

      // Efek Atraksi Magnetik: Gelembung membelok lembut ke posisi X,Y pengunjung jika mendekat
      if (currentProximity > 0.15) {
        const dx = currentPersonX - positions[i * 3];
        const dy = currentPersonY - positions[i * 3 + 1];
        const dist = Math.hypot(dx, dy);

        if (dist < 45 && dist > 1) {
          const pullForce = (1 - dist / 45) * 0.12 * currentProximity;
          positions[i * 3] += (dx / dist) * pullForce;
          positions[i * 3 + 1] += (dy / dist) * pullForce * 0.5;
        }
      }

      // Reset saat melampaui atas layar
      if (positions[i * 3 + 1] > BOUNDS.yMax + 15) {
        positions[i * 3 + 1] = BOUNDS.yMin - 10;
        positions[i * 3] = Math.random() * 300 - 150;
      }
    }
    bubbleParticles.geometry.attributes.position.needsUpdate = true;
  }

  // 2. INTEGRASI MEDIAPIPE POSE & WEBCAM
  function initMediaPipe() {
    if (typeof Pose === 'undefined') {
      console.warn("MediaPipe Pose CDN library tidak termuat.");
      statusText.textContent = "Sensor MediaPipe Tidak Dimuat (Mode Standby)";
      statusPill.className = "status-pill disabled";
      return;
    }

    pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 0, // 0 = Paling cepat untuk real-time di semua perangkat
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);

    if (typeof Camera !== 'undefined') {
      cameraHelper = new Camera(videoElement, {
        onFrame: async () => {
          if (isCameraActive && videoElement.readyState >= 2) {
            try {
              await pose.send({ image: videoElement });
            } catch (e) {
              // Ignore frame errors
            }
          }
        },
        width: 640,
        height: 480
      });

      cameraHelper.start()
        .then(() => {
          statusText.textContent = "📷 Sensor Aktif · Menunggu Pengunjung...";
          statusPill.className = "status-pill active";
        })
        .catch(err => {
          console.warn("Akses kamera tidak diizinkan atau tidak tersedia:", err);
          statusText.textContent = "📷 Sensor Kamera Off (Klik untuk Izinkan)";
          statusPill.className = "status-pill disabled";
          if (btnToggleCamera) {
            btnToggleCamera.classList.remove("active-btn");
            btnToggleCamera.textContent = "📷 Sensor: Off";
          }
        });
    }

    // Toggle Camera Button
    if (btnToggleCamera) {
      btnToggleCamera.addEventListener("click", () => {
        isCameraActive = !isCameraActive;
        if (isCameraActive) {
          btnToggleCamera.classList.add("active-btn");
          btnToggleCamera.textContent = "📷 Sensor: On";
          statusText.textContent = "📷 Sensor Aktif · Menunggu Pengunjung...";
          statusPill.className = "status-pill active";
          if (cameraHelper) cameraHelper.start().catch(() => {});
        } else {
          btnToggleCamera.classList.remove("active-btn");
          btnToggleCamera.textContent = "📷 Sensor: Off";
          statusText.textContent = "📷 Sensor Ditinggalkan (Mode Standby)";
          statusPill.className = "status-pill disabled";
          targetProximity = 0;
          isPersonDetected = false;
        }
      });
    }
  }

  function detectHandWave(landmarks) {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    let raisedWrist = null;

    if (leftWrist && leftShoulder && leftWrist.y < leftShoulder.y - 0.04) {
      raisedWrist = leftWrist;
    } else if (rightWrist && rightShoulder && rightWrist.y < rightShoulder.y - 0.04) {
      raisedWrist = rightWrist;
    }

    if (!raisedWrist) {
      wristHistory = [];
      return false;
    }

    const now = Date.now();
    wristHistory.push({ x: raisedWrist.x, time: now });
    wristHistory = wristHistory.filter(item => now - item.time < 1000);

    if (wristHistory.length < 5) return false;

    let directionChanges = 0;
    let prevDir = 0;
    let totalDeltaX = 0;

    for (let i = 1; i < wristHistory.length; i++) {
      const deltaX = wristHistory[i].x - wristHistory[i - 1].x;
      totalDeltaX += Math.abs(deltaX);
      const dir = deltaX > 0.008 ? 1 : (deltaX < -0.008 ? -1 : 0);
      if (dir !== 0 && prevDir !== 0 && dir !== prevDir) {
        directionChanges++;
      }
      if (dir !== 0) prevDir = dir;
    }

    if (directionChanges >= 2 && totalDeltaX > 0.06 && (now - lastWaveTime > 4000)) {
      lastWaveTime = now;
      return true;
    }

    return false;
  }

  // Hasil Deteksi MediaPipe Pose
  function onPoseResults(results) {
    if (!isCameraActive || !results || !results.poseLandmarks) {
      targetProximity = 0.0;
      isPersonDetected = false;
      return;
    }

    const landmarks = results.poseLandmarks;
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    if (nose && leftShoulder && rightShoulder) {
      isPersonDetected = true;

      // Hitung jarak antarbahu (Shoulder Distance) untuk mengukur seberapa dekat pengunjung dengan kamera
      const shoulderDist = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

      // Normalisasi Proximity: Jarak bahu ~0.15 (jauh) -> ~0.55+ (sangat dekat)
      const minDist = 0.12;
      const maxDist = 0.50;
      const normProximity = Math.min(1.0, Math.max(0.0, (shoulderDist - minDist) / (maxDist - minDist)));
      
      targetProximity = normProximity;

      // Konversi koordinat hidung/kepala ke posisi dunia 3D Three.js
      targetPersonX = (0.5 - nose.x) * 130;  // X range: -65 ke +65
      targetPersonY = (0.5 - nose.y) * 60;   // Y range: -30 ke +30

      // Deteksi gestur lambaian tangan untuk memicu video 0729.mov!
      if (detectHandWave(landmarks)) {
        triggerVideoOnWave();
      }
    } else {
      targetProximity = 0.0;
      isPersonDetected = false;
    }
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // 3. LOOP ANIMASI & KONTROL REAKTIF
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    uniformTime.value += dt;

    // Smooth Interpolation (Lerp) agar transisi visual terasa sangat halus dan organis
    currentProximity += (targetProximity - currentProximity) * 0.06;
    currentPersonX += (targetPersonX - currentPersonX) * 0.06;
    currentPersonY += (targetPersonY - currentPersonY) * 0.06;

    // Update Status Badge UI
    if (currentProximity > 0.18) {
      statusText.textContent = `✨ Pengunjung Mendekat! (Reaktivitas: ${Math.round(currentProximity * 100)}%)`;
      statusPill.className = "status-pill reactive";
    } else if (isCameraActive) {
      statusText.textContent = "📷 Sensor Aktif · Menunggu Pengunjung...";
      statusPill.className = "status-pill active";
    }

    // A. REAKTIVITAS SINAR CAHAYA (Sunbeams Shift & Glow)
    if (raysGroup) {
      raysGroup.children.forEach((ray, i) => {
        // Sinar bergeser mengikuti pergerakan X pengunjung
        const rayTargetX = ray.userData.initialX + (currentPersonX * 0.35);
        ray.position.x += (rayTargetX - ray.position.x) * 0.04;

        // Kecerahan & transparansi sinar bertambah terang saat pengunjung mendekat
        const baseOpacity = 0.22 + Math.sin(uniformTime.value * 0.8 + i) * 0.08;
        const reactiveOpacity = baseOpacity + (currentProximity * 0.55);
        ray.material.opacity = Math.min(0.85, reactiveOpacity);
      });
    }

    // B. REAKTIVITAS LIGHTING AKUARIUM
    const ambLight = scene.getObjectByName("ambientLight");
    const dirLight = scene.getObjectByName("dirLight");
    if (ambLight) {
      ambLight.intensity = 2.5 + (currentProximity * 1.5);
    }
    if (dirLight) {
      dirLight.intensity = 2.6 + (currentProximity * 1.8);
    }

    // C. REAKTIVITAS PENYU LAUT (Penyo.png Swimming Motion)
    if (penyoMesh) {
      // Penyu berenang mendekati koordinat (X, Y) pengunjung secara alami
      const targetX = currentPersonX;
      const targetY = currentPersonY + Math.sin(uniformTime.value * 2.2) * 1.5;

      penyoMesh.position.x += (targetX - penyoMesh.position.x) * 0.07;
      penyoMesh.position.y += (targetY - penyoMesh.position.y) * 0.07;
      
      // Penyu berenang mendekat ke arah layar/kamera saat pengunjung mendekati sensor
      penyoMesh.position.z = -22 + (currentProximity * 24);

      // Kemiringan renang alami (tilt) saat berbelok
      const deltaX = targetX - penyoMesh.position.x;
      penyoMesh.rotation.z = Math.max(-0.25, Math.min(0.25, -deltaX * 0.025)) + Math.sin(uniformTime.value * 1.8) * 0.04;

      // Skala penyu membesar lembut saat pengunjung mendekati kamera
      const scale = 0.85 + (currentProximity * 0.75) + Math.sin(uniformTime.value * 2.0) * 0.03;
      penyoMesh.scale.set(scale, scale, scale);

      // Transparansi memudar masuk ketika ada pengunjung terdeteksi
      const targetOpacity = (isPersonDetected && !isPlayingVideo) ? Math.min(1.0, 0.25 + currentProximity * 1.1) : 0.0;
      penyoMesh.material.opacity += (targetOpacity - penyoMesh.material.opacity) * 0.08;
    }

    // Update Posisi Video 0729.mov jika Sedang Diputar
    if (isPlayingVideo && videoMesh) {
      videoMesh.position.x = currentPersonX * 0.4;
      videoMesh.position.y = currentPersonY * 0.4;
    }


    // D. KONTROL GERAKAN KAMERA (Parallax Depth Effect)
    camera.position.x = currentPersonX * 0.12;
    camera.position.y = currentPersonY * 0.08;
    camera.lookAt(0, 0, 0);

    // Update Gelembung & Render Three.js
    updateBubbles(dt);
    renderer.render(scene, camera);
  }

  // Inisialisasi Aplikasi Standalone
  initScene();
  initMediaPipe();
  animate();
});
