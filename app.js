/* Photobooth — vanilla JS, tanpa backend. Semua foto diproses di browser (tidak diunggah ke mana pun). */
(() => {
  "use strict";

  // ---------- Konstanta layout strip (2x6 inci @ 300 dpi) ----------
  const STRIP_W = 600, STRIP_H = 1800;
  const PAD = 36, GAP = 16;
  const PHOTO_W = STRIP_W - PAD * 2;          // 528
  const PHOTO_H = Math.round(PHOTO_W * 2 / 3); // 352 (rasio 3:2)
  const SHOTS = 4;
  const FOOTER_TOP = PAD + SHOTS * PHOTO_H + (SHOTS - 1) * GAP; // 1492
  const RAW_W = PHOTO_W * 2, RAW_H = PHOTO_H * 2; // simpan resolusi 2x

  // ---------- Filter (urutan sama dengan CSS filter) ----------
  const FILTERS = [
    { id: "normal", name: "Normal", p: {} },
    { id: "bw", name: "Hitam Putih", p: { grayscale: 1, contrast: 1.15 } },
    { id: "sepia", name: "Sepia", p: { sepia: 0.85, contrast: 1.05 } },
    { id: "vintage", name: "Vintage", p: { sepia: 0.4, saturate: 0.8, brightness: 1.08, contrast: 0.9 } },
    { id: "warm", name: "Hangat", p: { sepia: 0.2, saturate: 1.35, brightness: 1.05 } },
    { id: "pop", name: "Pop", p: { saturate: 1.8, contrast: 1.15 } },
    { id: "noir", name: "Noir", p: { grayscale: 1, contrast: 1.6, brightness: 0.9 } },
    { id: "fade", name: "Pudar", p: { saturate: 0.6, contrast: 0.8, brightness: 1.12 } },
  ];
  const ORDER = ["grayscale", "sepia", "saturate", "brightness", "contrast"];
  const toCss = (p) => ORDER.filter((k) => p[k] !== undefined).map((k) => `${k}(${p[k]})`).join(" ") || "none";

  // ---------- Frame / border ----------
  const FRAMES = [
    { id: "classic", name: "Klasik Putih", bg: "#ffffff", ink: "#222222", sub: "#888888" },
    { id: "black", name: "Hitam Elegan", bg: "#111111", ink: "#ffffff", sub: "#bbbbbb" },
    { id: "pink", name: "Pink Pastel", bg: "#ffd1dc", ink: "#d6336c", sub: "#c2577a", pattern: "dots", dot: "#ffe6ec" },
    { id: "retro", name: "Krem Retro", bg: "#f3e5c8", ink: "#6b4226", sub: "#8c6a4f", pattern: "lines" },
    { id: "polka", name: "Polkadot", bg: "#2b2d6e", ink: "#ffd166", sub: "#c9cbf5", pattern: "dots", dot: "#ffd166" },
    { id: "film", name: "Film Strip", bg: "#141414", ink: "#ffffff", sub: "#aaaaaa", pattern: "film" },
    { id: "confetti", name: "Konfeti", bg: "#ffffff", ink: "#ff5d8f", sub: "#666666", pattern: "confetti" },
    { id: "mint", name: "Mint", bg: "#c8f2e0", ink: "#14715a", sub: "#3d8f78" },
  ];

  // ---------- State ----------
  const state = {
    shots: new Array(SHOTS).fill(null), // canvas mentah (belum difilter)
    filter: "normal",
    frame: "classic",
    busy: false,
    stream: null,
  };

  // ---------- Elemen ----------
  const $ = (id) => document.getElementById(id);
  const video = $("video"), cameraBox = $("cameraBox"), camMsg = $("camMsg");
  const countdownEl = $("countdown"), flashEl = $("flash"), shotBadge = $("shotBadge");
  const strip = $("strip"), sctx = strip.getContext("2d");
  const btnStart = $("btnStart"), btnPrint = $("btnPrint"), btnDownload = $("btnDownload"), btnReset = $("btnReset");
  const timerSel = $("timer"), mirrorChk = $("mirror"), cameraSelect = $("cameraSelect");
  const textPreset = $("textPreset"), textCustom = $("textCustom"), fontSelect = $("fontSelect"), showDate = $("showDate");
  const printMode = $("printMode"), thumbsEl = $("thumbs");

  // ---------- Kamera ----------
  async function startCamera(deviceId) {
    if (!navigator.mediaDevices?.getUserMedia) {
      camMsg.textContent = "Browser tidak mendukung kamera. Buka lewat https:// atau http://localhost di Chrome/Edge/Firefox.";
      return;
    }
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    try {
      const video_c = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      if (deviceId) video_c.deviceId = { exact: deviceId };
      state.stream = await navigator.mediaDevices.getUserMedia({ video: video_c, audio: false });
      video.srcObject = state.stream;
      await video.play().catch(() => {});
      camMsg.textContent = "";
      await listCameras();
    } catch (err) {
      camMsg.textContent = "Kamera tidak bisa diakses (" + (err.name || err) + "). Izinkan akses kamera lalu muat ulang halaman.";
    }
  }

  async function listCameras() {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const current = state.stream?.getVideoTracks()[0]?.getSettings().deviceId;
    cameraSelect.innerHTML = "";
    devices.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || `Kamera ${i + 1}`;
      if (d.deviceId === current) o.selected = true;
      cameraSelect.appendChild(o);
    });
    cameraSelect.hidden = devices.length < 2;
  }

  // ---------- Filter pada canvas ----------
  const supportsCtxFilter = (() => {
    const c = document.createElement("canvas").getContext("2d");
    return typeof c.filter === "string";
  })();

  // Fallback piksel (rumus matriks sesuai spesifikasi CSS Filter Effects) untuk browser tanpa ctx.filter
  function applyPixelFilter(ctx, w, h, p) {
    if (!Object.keys(p).length) return;
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const mats = [];
    if (p.grayscale !== undefined) { const g = 1 - p.grayscale; mats.push([0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g, 0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g, 0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g]); }
    if (p.sepia !== undefined) { const s = 1 - p.sepia; mats.push([0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s, 0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s, 0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s]); }
    if (p.saturate !== undefined) { const s = p.saturate; mats.push([0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]); }
    const br = p.brightness ?? 1, ct = p.contrast ?? 1, off = 255 * (0.5 - 0.5 * ct);
    const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      for (const m of mats) {
        const nr = cl(m[0] * r + m[1] * g + m[2] * b), ng = cl(m[3] * r + m[4] * g + m[5] * b), nb = cl(m[6] * r + m[7] * g + m[8] * b);
        r = nr; g = ng; b = nb;
      }
      r = cl(r * br); g = cl(g * br); b = cl(b * br);
      d[i] = cl(r * ct + off); d[i + 1] = cl(g * ct + off); d[i + 2] = cl(b * ct + off);
    }
    ctx.putImageData(img, 0, 0);
  }

  function filteredPhoto(raw) {
    const p = FILTERS.find((f) => f.id === state.filter).p;
    const c = document.createElement("canvas");
    c.width = PHOTO_W; c.height = PHOTO_H;
    const x = c.getContext("2d");
    if (supportsCtxFilter) { x.filter = toCss(p); x.drawImage(raw, 0, 0, PHOTO_W, PHOTO_H); }
    else { x.drawImage(raw, 0, 0, PHOTO_W, PHOTO_H); applyPixelFilter(x, PHOTO_W, PHOTO_H, p); }
    return c;
  }

  // ---------- Ambil foto ----------
  function grabFrame() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    // crop tengah ke rasio 3:2
    let sw = vw, sh = vw * 2 / 3;
    if (sh > vh) { sh = vh; sw = vh * 3 / 2; }
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const c = document.createElement("canvas");
    c.width = RAW_W; c.height = RAW_H;
    const x = c.getContext("2d");
    if (mirrorChk.checked) { x.translate(RAW_W, 0); x.scale(-1, 1); }
    x.drawImage(video, sx, sy, sw, sh, 0, 0, RAW_W, RAW_H);
    return c;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function countdown(sec) {
    for (let n = sec; n > 0; n--) {
      countdownEl.textContent = n;
      countdownEl.classList.remove("pop"); void countdownEl.offsetWidth; countdownEl.classList.add("pop");
      await sleep(1000);
    }
    countdownEl.textContent = "";
  }

  async function takeShot(index) {
    await countdown(parseInt(timerSel.value, 10));
    const shot = grabFrame();
    flashEl.classList.remove("on"); void flashEl.offsetWidth; flashEl.classList.add("on");
    if (shot) state.shots[index] = shot;
    renderAll();
  }

  async function runSession(indices) {
    if (state.busy) return;
    if (!video.videoWidth) { alert("Kamera belum aktif."); return; }
    state.busy = true; setBusy(true);
    try {
      for (let k = 0; k < indices.length; k++) {
        shotBadge.textContent = indices.length > 1 ? `Foto ${k + 1} / ${indices.length}` : `Foto ulang #${indices[k] + 1}`;
        await takeShot(indices[k]);
        if (k < indices.length - 1) await sleep(900);
      }
    } finally {
      shotBadge.textContent = "";
      state.busy = false; setBusy(false);
    }
  }

  function setBusy(b) {
    btnStart.disabled = b; btnReset.disabled = b;
    thumbsEl.querySelectorAll("button").forEach((t) => (t.disabled = b));
    updateButtons();
  }

  // ---------- Gambar strip ----------
  function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

  function drawFrameBg(fr) {
    sctx.fillStyle = fr.bg;
    sctx.fillRect(0, 0, STRIP_W, STRIP_H);
    if (fr.pattern === "dots") {
      sctx.fillStyle = fr.dot;
      for (let y = 10; y < STRIP_H; y += 28) for (let x = (y / 28) % 2 ? 24 : 10; x < STRIP_W; x += 28) {
        sctx.beginPath(); sctx.arc(x, y, 4, 0, Math.PI * 2); sctx.fill();
      }
    } else if (fr.pattern === "lines") {
      sctx.strokeStyle = fr.ink; sctx.lineWidth = 3;
      sctx.strokeRect(12, 12, STRIP_W - 24, STRIP_H - 24);
      sctx.lineWidth = 1; sctx.strokeRect(20, 20, STRIP_W - 40, STRIP_H - 40);
    } else if (fr.pattern === "film") {
      sctx.fillStyle = "#f5f5f5";
      for (let y = 14; y < STRIP_H - 20; y += 44) {
        roundRect(sctx, 9, y, 16, 24, 4); sctx.fill();
        roundRect(sctx, STRIP_W - 25, y, 16, 24, 4); sctx.fill();
      }
    } else if (fr.pattern === "confetti") {
      const rnd = seeded(42), colors = ["#ff5d8f", "#ffb703", "#06d6a0", "#118ab2", "#8338ec"];
      for (let i = 0; i < 260; i++) {
        sctx.save();
        sctx.translate(rnd() * STRIP_W, rnd() * STRIP_H); sctx.rotate(rnd() * Math.PI);
        sctx.fillStyle = colors[i % colors.length];
        sctx.fillRect(-6, -3, 12, 6);
        sctx.restore();
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function currentText() {
    if (textPreset.value === "__custom") return textCustom.value.trim();
    return textPreset.value;
  }

  function fitFont(text, family, startSize, maxW, weight = "") {
    let size = startSize;
    do { sctx.font = `${weight} ${size}px "${family}"`.trim(); size -= 2; } while (sctx.measureText(text).width > maxW && size > 18);
  }

  function renderStrip() {
    const fr = FRAMES.find((f) => f.id === state.frame);
    sctx.clearRect(0, 0, STRIP_W, STRIP_H);
    drawFrameBg(fr);

    for (let i = 0; i < SHOTS; i++) {
      const y = PAD + i * (PHOTO_H + GAP);
      if (state.shots[i]) {
        sctx.drawImage(filteredPhoto(state.shots[i]), PAD, y);
      } else {
        sctx.fillStyle = "rgba(127,127,127,.25)";
        sctx.fillRect(PAD, y, PHOTO_W, PHOTO_H);
        sctx.fillStyle = "rgba(127,127,127,.8)";
        sctx.font = '600 72px "Poppins", sans-serif';
        sctx.textAlign = "center"; sctx.textBaseline = "middle";
        sctx.fillText(String(i + 1), STRIP_W / 2, y + PHOTO_H / 2);
      }
    }

    // footer: teks + tanggal
    const text = currentText(), family = fontSelect.value;
    const footerH = STRIP_H - FOOTER_TOP;
    sctx.textAlign = "center"; sctx.textBaseline = "middle";
    const hasDate = showDate.checked;
    const textY = FOOTER_TOP + (hasDate ? footerH * 0.42 : footerH * 0.5);
    if (text) {
      sctx.fillStyle = fr.ink;
      fitFont(text, family, family === "Pacifico" ? 64 : 56, PHOTO_W - 20, family === "Poppins" ? "600" : "");
      sctx.fillText(text, STRIP_W / 2, textY);
    }
    if (hasDate) {
      const d = new Date();
      const s = [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((n) => String(n).padStart(2, "0")).join(" . ");
      sctx.fillStyle = fr.sub;
      sctx.font = '400 30px "Poppins", sans-serif';
      sctx.fillText(s, STRIP_W / 2, text ? textY + 82 : FOOTER_TOP + footerH * 0.5);
    }
  }

  function renderThumbs() {
    thumbsEl.innerHTML = "";
    state.shots.forEach((shot, i) => {
      const b = document.createElement("button");
      b.className = "thumb" + (shot ? " filled" : "");
      b.textContent = shot ? "↻ Ulang" : String(i + 1);
      b.title = shot ? `Foto ulang #${i + 1}` : `Ambil foto #${i + 1}`;
      b.disabled = state.busy;
      if (shot) b.style.backgroundImage = `url(${filteredPhoto(shot).toDataURL("image/jpeg", 0.7)})`;
      b.onclick = () => runSession([i]);
      thumbsEl.appendChild(b);
    });
  }

  function updateButtons() {
    const done = state.shots.every(Boolean);
    btnPrint.disabled = !done || state.busy;
    btnDownload.disabled = !done || state.busy;
    btnStart.textContent = state.shots.some(Boolean) ? "▶ Foto ulang semua (4)" : "▶ Mulai (4 foto)";
  }

  function renderAll() { renderStrip(); renderThumbs(); updateButtons(); }

  // ---------- Chips ----------
  function buildChips() {
    const fc = $("filterChips");
    FILTERS.forEach((f) => {
      const b = document.createElement("button");
      b.className = "chip" + (f.id === state.filter ? " active" : "");
      b.textContent = f.name; b.dataset.id = f.id;
      b.onclick = () => {
        state.filter = f.id;
        fc.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === f.id));
        video.style.filter = toCss(f.p);
        renderAll();
      };
      fc.appendChild(b);
    });
    const frc = $("frameChips");
    FRAMES.forEach((f) => {
      const b = document.createElement("button");
      b.className = "chip" + (f.id === state.frame ? " active" : "");
      b.innerHTML = `<span class="swatch" style="background:${f.bg}"></span>${f.name}`; b.dataset.id = f.id;
      b.onclick = () => {
        state.frame = f.id;
        frc.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === f.id));
        renderStrip();
      };
      frc.appendChild(b);
    });
  }

  // ---------- Simpan & cetak ----------
  function fileName() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `photobooth-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
  }

  function download() {
    strip.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  async function print() {
    const url = strip.toDataURL("image/png");
    const copies = printMode.value === "4x6" ? 2 : 1;
    $("page-size").textContent = `@page { size: ${copies * 2}in 6in; margin: 0; }`;
    const area = $("printArea");
    area.innerHTML = "";
    const loads = [];
    for (let i = 0; i < copies; i++) {
      const img = new Image(); img.src = url; area.appendChild(img);
      loads.push(img.decode().catch(() => {}));
    }
    await Promise.all(loads);
    window.print();
  }

  // ---------- Event ----------
  btnStart.onclick = () => runSession([...Array(SHOTS).keys()]);
  btnReset.onclick = () => { if (confirm("Hapus semua foto?")) { state.shots.fill(null); renderAll(); } };
  btnDownload.onclick = download;
  btnPrint.onclick = print;
  mirrorChk.onchange = () => cameraBox.classList.toggle("mirror", mirrorChk.checked);
  cameraSelect.onchange = () => startCamera(cameraSelect.value);
  textPreset.onchange = () => { textCustom.hidden = textPreset.value !== "__custom"; if (!textCustom.hidden) textCustom.focus(); renderStrip(); };
  textCustom.oninput = renderStrip;
  showDate.onchange = renderStrip;
  fontSelect.onchange = async () => { await document.fonts.load(`64px "${fontSelect.value}"`).catch(() => {}); renderStrip(); };
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !state.busy && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault(); btnStart.click();
    }
  });

  // ---------- Init ----------
  cameraBox.classList.toggle("mirror", mirrorChk.checked);
  buildChips();
  renderAll();
  Promise.all(["Pacifico", "Poppins", "Courier Prime"].map((f) => document.fonts.load(`64px "${f}"`).catch(() => {})))
    .then(() => renderStrip());
  startCamera();

  window.__photobooth = { state, renderAll, FILTERS, FRAMES }; // untuk debug
})();
