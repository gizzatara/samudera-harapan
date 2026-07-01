// Samuidera Harapan Drawing Script
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("draw-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const btnSubmit = document.getElementById("btn-submit");
  const btnClear = document.getElementById("btn-clear");
  const inputName = document.getElementById("input-name");
  const inputWish = document.getElementById("input-wish");
  
  const toolBrush = document.getElementById("tool-brush");
  const toolBucket = document.getElementById("tool-bucket");
  const toolEraser = document.getElementById("tool-eraser");
  const brushSizeInput = document.getElementById("brush-size");
  const brushSizeSection = document.getElementById("brush-size-section");
  const swatches = document.querySelectorAll(".color-swatch");
  const colorPickerInput = document.getElementById("color-picker-input");
  
  const confirmModal = document.getElementById("confirm-modal");
  const modalBtnFix = document.getElementById("modal-btn-fix");
  const modalBtnSend = document.getElementById("modal-btn-send");
  const toast = document.getElementById("toast");

  // Konfigurasi Kanvas
  canvas.width = 640;
  canvas.height = 480;
  
  let isDrawing = false;
  let currentTool = 'brush'; // 'brush', 'bucket', 'eraser'
  let currentColor = '#050505';
  let currentSize = 12;
  let isCanvasDirty = false;

  function updateCanvasDirtyState() {
    isCanvasDirty = hasDrawing();
  }

  // Inisialisasi kanvas kosong transparan
  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isCanvasDirty = false;
    validateForm();
  }
  clearCanvas();

  // === PANDUAN ARAH RENANG IKAN (canvas overlay terpisah, tidak ikut terkirim) ===
  function createSwimGuideOverlay() {
    const wrapper = document.getElementById("canvas-container");

    // Buat canvas overlay di atas draw-canvas
    const guideCanvas = document.createElement("canvas");
    guideCanvas.id = "guide-canvas";
    guideCanvas.width = canvas.width;
    guideCanvas.height = canvas.height;
    guideCanvas.style.cssText = [
      "position:absolute",
      "top:50%",
      "left:50%",
      "transform:translate(-50%,-50%)",
      "pointer-events:none",  // Klik tembus langsung ke canvas gambar di bawah
      "z-index:5"
    ].join(";");
    wrapper.style.position = "relative";
    wrapper.appendChild(guideCanvas);

    const gc = guideCanvas.getContext("2d");
    const cx = guideCanvas.width / 2;
    const cy = guideCanvas.height / 2;

    // Bayangan siluet ikan panduan
    gc.save();
    gc.globalAlpha = 0.10;
    gc.fillStyle = '#06b6d4';
    // Tubuh elips
    gc.beginPath();
    gc.ellipse(cx + 20, cy, 120, 60, 0, 0, Math.PI * 2);
    gc.fill();
    // Ekor segitiga
    gc.beginPath();
    gc.moveTo(cx - 100, cy);
    gc.lineTo(cx - 160, cy - 48);
    gc.lineTo(cx - 160, cy + 48);
    gc.closePath();
    gc.fill();
    gc.restore();

    // Teks & panah (lebih jelas)
    gc.save();
    gc.globalAlpha = 0.45;
    gc.fillStyle = '#0e7490';
    gc.strokeStyle = '#0e7490';
    gc.textAlign = 'center';

    // Label atas: arah hidung
    gc.font = 'bold 17px sans-serif';
    gc.fillText('⬅ EKOR', cx - 130, cy - 75);
    gc.fillText('KEPALA / HIDUNG ➡', cx + 100, cy - 75);

    // Garis panah tengah (kiri ke kanan)
    gc.lineWidth = 2.5;
    gc.setLineDash([8, 5]);
    gc.beginPath();
    gc.moveTo(70, cy);
    gc.lineTo(guideCanvas.width - 70, cy);
    gc.stroke();

    // Kepala panah kanan
    gc.setLineDash([]);
    gc.beginPath();
    gc.moveTo(guideCanvas.width - 70, cy);
    gc.lineTo(guideCanvas.width - 90, cy - 12);
    gc.moveTo(guideCanvas.width - 70, cy);
    gc.lineTo(guideCanvas.width - 90, cy + 12);
    gc.stroke();

    // Teks bawah
    gc.font = '14px sans-serif';
    gc.globalAlpha = 0.35;
    gc.fillText('Gambar ikanmu di atas panduan ini', cx, cy + 90);

    gc.restore();

    // Sesuaikan ukuran guide canvas mengikuti ukuran tampilan draw-canvas
    function syncGuideSize() {
      guideCanvas.style.width = canvas.style.width;
      guideCanvas.style.height = canvas.style.height;
    }
    syncGuideSize();
    window.addEventListener('resize', syncGuideSize);
    setTimeout(syncGuideSize, 150);
  }
  createSwimGuideOverlay();

  // Resize canvas display sesuai kontainer CSS
  function resizeCanvasDisplay() {
    const wrapper = document.getElementById("canvas-container");
    const aspect = canvas.width / canvas.height;
    let w = wrapper.clientWidth - 20;
    let h = wrapper.clientHeight - 20;
    
    if (w / h > aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }
    
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }
  
  window.addEventListener("resize", resizeCanvasDisplay);
  setTimeout(resizeCanvasDisplay, 100);

  // ─── ZOOM KANVAS: Mouse Scroll & Pinch Gesture ───
  const wrapper = document.getElementById("canvas-container");
  let canvasZoom = 1.0;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3.0;
  const ZOOM_STEP = 0.04;
  const zoomResetBtn = document.getElementById('btn-canvas-reset-zoom');

  function applyCanvasZoom(newZoom) {
    canvasZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    canvas.style.transform = `scale(${canvasZoom})`;
    canvas.style.transformOrigin = 'center center';

    // Sync ukuran guide canvas dengan draw canvas
    const guideCanvas = document.getElementById("guide-canvas");
    if (guideCanvas) {
      guideCanvas.style.transform = `translate(-50%,-50%) scale(${canvasZoom})`;
      guideCanvas.style.transformOrigin = 'center center';
    }

    // Tampilkan/sembunyikan tombol reset
    if (zoomResetBtn) {
      zoomResetBtn.style.display = Math.abs(canvasZoom - 1.0) > 0.01 ? 'inline-flex' : 'none';
    }
  }

  // Reset zoom ke default
  function resetCanvasZoom() {
    applyCanvasZoom(1.0);
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', resetCanvasZoom);
  }

  // Mouse Scroll Zoom
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    applyCanvasZoom(canvasZoom + delta);
  }, { passive: false });

  // Pinch-to-Zoom (Touch)
  let pinchDistStart = 0;
  let pinchZoomStart = 1.0;
  let isPinching = false;

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // Batalkan drawing yang sedang berlangsung
      isDrawing = false;
      isPinching = true;
      canvas.style.touchAction = 'none'; // Cegah scroll saat pinch
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistStart = Math.sqrt(dx * dx + dy * dy);
      pinchZoomStart = canvasZoom;
    }
  }, { passive: false });

  wrapper.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (pinchDistStart > 0) {
        const scale = dist / pinchDistStart;
        applyCanvasZoom(pinchZoomStart * scale);
      }
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', () => {
    if (isPinching) {
      isPinching = false;
      canvas.style.touchAction = ''; // Kembalikan scroll
    }
    pinchDistStart = 0;
  });

  // Keyboard shortcut R untuk reset zoom kanvas
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetCanvasZoom();
    }
  });

  // LOGIKA MENGGAMBAR (MOUSE & TOUCH)
  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Konversi koordinat layar ke koordinat resolusi asli kanvas (640x480)
    const x = Math.round(((clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((clientY - rect.top) / rect.height) * canvas.height);
    return { x, y };
  }

  let lastX = 0;
  let lastY = 0;

  function startDrawing(e) {
    // Jangan mulai drawing jika pinch (2 jari)
    if (e.touches && e.touches.length > 1) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    
    if (currentTool === 'bucket') {
      floodFill(x, y, currentColor);
      updateCanvasDirtyState();
      validateForm();
      return;
    }
    
    isDrawing = true;
    lastX = x;
    lastY = y;
    
    // Menggambar titik pertama saat klik/tap
    draw(e);
  }

  function draw(e) {
    if (!isDrawing) return;
    // Jangan draw jika pinch (2 jari)
    if (e.touches && e.touches.length > 1) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = currentSize * 2.0; // Penghapus sedikit lebih tebal
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }
    
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    if (isDrawing) {
      isDrawing = false;
      ctx.globalCompositeOperation = "source-over"; // Reset composite operation
      updateCanvasDirtyState();
      validateForm();
    }
  }

  // Event Listeners untuk Menggambar
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", stopDrawing);

  canvas.addEventListener("touchstart", startDrawing, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  window.addEventListener("touchend", stopDrawing);

  // PALET WARNA & PENGATURAN ALAT
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      swatches.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      currentColor = swatch.dataset.color;
      
      // Sync ke color picker
      if (colorPickerInput) colorPickerInput.value = currentColor;
      
      // Jika saat ini sedang memakai penghapus, kembalikan ke kuas
      if (currentTool === 'eraser') {
        setTool('brush');
      }
    });
  });

  // Color Picker untuk warna kustom
  if (colorPickerInput) {
    colorPickerInput.addEventListener("input", () => {
      currentColor = colorPickerInput.value;
      // Hapus semua seleksi swatch preset
      swatches.forEach(s => s.classList.remove("active"));
      // Jika sedang memakai penghapus, kembalikan ke kuas
      if (currentTool === 'eraser') {
        setTool('brush');
      }
    });
  }

  function setTool(toolName) {
    currentTool = toolName;
    
    toolBrush.classList.toggle("active", toolName === 'brush');
    toolBucket.classList.toggle("active", toolName === 'bucket');
    toolEraser.classList.toggle("active", toolName === 'eraser');
    
    // Sembunyikan slider ukuran jika ember cat aktif
    if (toolName === 'bucket') {
      brushSizeSection.style.opacity = '0.3';
      brushSizeInput.disabled = true;
    } else {
      brushSizeSection.style.opacity = '1';
      brushSizeInput.disabled = false;
    }
  }

  toolBrush.addEventListener("click", () => setTool('brush'));
  toolBucket.addEventListener("click", () => setTool('bucket'));
  toolEraser.addEventListener("click", () => setTool('eraser'));
  
  brushSizeInput.addEventListener("input", (e) => {
    currentSize = parseInt(e.target.value);
  });

  btnClear.addEventListener("click", () => {
    if (confirm("Bersihkan seluruh kanvas lukisan?")) {
      clearCanvas();
    }
  });

  // ALGORITMA FLOOD FILL (EMBER CAT) - STACK DFS DENGAN DETEKSI KEBOCORAN LATAR BELAKANG
  function floodFill(startX, startY, fillColor) {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Parsing Warna Hex ke RGB
    const fillR = parseInt(fillColor.slice(1, 3), 16);
    const fillG = parseInt(fillColor.slice(3, 5), 16);
    const fillB = parseInt(fillColor.slice(5, 7), 16);
    const fillA = 255;

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    // Jika warna target sudah sama dengan warna pengisi, abaikan
    if (
      Math.abs(targetR - fillR) < 5 &&
      Math.abs(targetG - fillG) < 5 &&
      Math.abs(targetB - fillB) < 5 &&
      Math.abs(targetA - fillA) < 5
    ) {
      return;
    }

    const colorMatch = (idx) => {
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const a = data[idx+3];
      // Toleransi warna sedikit tinggi agar mengisi sekitar coretan kuas dengan mulus
      return Math.abs(r - targetR) < 60 &&
             Math.abs(g - targetG) < 60 &&
             Math.abs(b - targetB) < 60 &&
             Math.abs(a - targetA) < 60;
    };

    const stack = [[startX, startY]];
    
    // Array visited untuk optimasi agar tidak memeriksa piksel yang sama berulang kali
    const visited = new Uint8Array(width * height);
    visited[startY * width + startX] = 1;

    let touchedBorder = false;

    while (stack.length > 0) {
      const [x, y] = stack.pop();

      // Jika menyentuh batas tepi kanvas, artinya mewarnai latar belakang (bocor keluar)
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        touchedBorder = true;
        break;
      }

      const idx = (y * width + x) * 4;
      
      data[idx] = fillR;
      data[idx+1] = fillG;
      data[idx+2] = fillB;
      data[idx+3] = fillA;

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const vIdx = ny * width + nx;
          if (!visited[vIdx]) {
            const nIdx = vIdx * 4;
            if (colorMatch(nIdx)) {
              visited[vIdx] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      }
    }

    if (touchedBorder) {
      // Batalkan aksi: kanvas tidak diubah karena putImageData belum dipanggil.
      // History tetap utuh (tidak perlu di-pop).
      alert("Cat tumpah keluar! Pastikan garis gambar ikan Anda tertutup rapat (tidak ada lubang bocor) dan jangan mewarnai bagian luar/latar belakang.");
      return;
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // VALIDASI INPUT & KANVAS
  function hasDrawing() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    // Periksa apakah ada piksel yang tidak transparan
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) {
        return true;
      }
    }
    return false;
  }

  function validateForm() {
    const nameVal = inputName.value.trim();
    const wishVal = inputWish.value.trim();
    
    btnSubmit.disabled = !(nameVal && wishVal && isCanvasDirty);
  }

  inputName.addEventListener("input", validateForm);
  inputWish.addEventListener("input", validateForm);

  // ANALISIS KEPADATAN PIKSEL (DETEKSI GARIS TIPIS)
  function analyzeDrawingDensity() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let coloredPixelsCount = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        if (alpha > 15) {
          coloredPixelsCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    if (coloredPixelsCount === 0) return { isThin: true, isEmpty: true };
    
    const boundingBoxWidth = (maxX - minX + 1);
    const boundingBoxHeight = (maxY - minY + 1);
    const boundingBoxArea = boundingBoxWidth * boundingBoxHeight;
    
    // Density ratio = colored pixels / area bounding box
    const densityRatio = coloredPixelsCount / boundingBoxArea;
    
    // Jika density ratio < 8.5% dan bounding box lumayan besar,
    // asumsikan hanya berupa garis tipis tanpa diwarnai bagian dalamnya
    const isThin = densityRatio < 0.085 && boundingBoxWidth > 80 && boundingBoxHeight > 80;
    
    return { isThin, isEmpty: false, ratio: densityRatio };
  }

  // SUBMIT HANDLER
  btnSubmit.addEventListener("click", () => {
    const analysis = analyzeDrawingDensity();
    
    if (analysis.isThin) {
      // Tampilkan modal peringatan
      confirmModal.classList.add("active");
    } else {
      sendFishToServer();
    }
  });

  // Tombol Modal: Perbaiki
  modalBtnFix.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    setTool("bucket"); // Aktifkan langsung ember cat untuk memudahkan mewarnai
  });

  // Tombol Modal: Tetap Kirim
  modalBtnSend.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    sendFishToServer();
  });

  function sendFishToServer() {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Mengirim...";
    
    // Buat canvas sementara untuk memotong gambar hanya di area ikan saja
    const trimmedDataUrl = getTrimmedCanvasDataUrl();
    
    const payload = {
      name: inputName.value.trim(),
      wish: inputWish.value.trim(),
      image: trimmedDataUrl
    };

    fetch("/api/fish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) throw new Error("Gagal mengirim data");
      return res.json();
    })
    .then(data => {
      showToast();
      clearForm();
    })
    .catch(err => {
      console.error(err);
      alert("Koneksi terganggu. Gagal melepas ikan.");
    })
    .finally(() => {
      btnSubmit.textContent = "🐠 Lepaskan Ikanmu!";
      validateForm();
    });
  }

  // Fungsi untuk memotong canvas agar base64 gambar berukuran pas dengan ikan (tidak menyertakan sisa kanvas transparan lebar)
  function getTrimmedCanvasDataUrl() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let found = false;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    if (!found) return canvas.toDataURL("image/png");
    
    // Tambah margin sedikit agar tidak terpotong pas garis
    const margin = 10;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);
    
    const trimW = maxX - minX + 1;
    const trimH = maxY - minY + 1;
    
    const trimCanvas = document.createElement("canvas");
    trimCanvas.width = trimW;
    trimCanvas.height = trimH;
    const trimCtx = trimCanvas.getContext("2d");
    
    trimCtx.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
    return trimCanvas.toDataURL("image/png");
  }

  function showToast() {
    toast.classList.add("active");
    setTimeout(() => {
      toast.classList.remove("active");
    }, 4000);
  }

  function clearForm() {
    inputName.value = "";
    inputWish.value = "";
    clearCanvas();
  }
});
