/* Photobooth — vanilla JS (ES module, tanpa bundler & tanpa backend).
   Semua foto diproses di browser (tidak diunggah ke mana pun). Fungsi murni ada di lib.js (diuji Vitest). */
import {
  STRIP_W, STRIP_H, PAD, GAP, PHOTO_W, PHOTO_H, SHOTS, FOOTER_TOP, RAW_W, RAW_H,
  FILTERS, FRAMES, toCss, fontSpec, fitFont, cropRect, applyPixelFilter, detectCtxFilter,
  seeded, formatDate, fileName, cameraErrorMessage, CAMERA_LOST_MESSAGE, needsRefilter, printLayout,
} from "./lib.js";

// ---------- State ----------
const state = {
  shots: new Array(SHOTS).fill(null),         // canvas mentah (belum difilter)
  filteredCache: new Array(SHOTS).fill(null), // { filterId, canvas, thumbUrl } per slot, terfilter 528x352
  filter: "normal",
  frame: "classic",
  busy: false,
  stream: null,
};
const stats = { filterRuns: 0 }; // hitung berapa kali foto benar-benar difilter (untuk verifikasi cache)
let session = null;              // AbortController sesi pemotretan aktif
let startToken = 0;              // mencegah balapan antar-startCamera
let badgeTimer = 0;

// ---------- Elemen ----------
const $ = (id) => document.getElementById(id);
const video = $("video"), cameraBox = $("cameraBox"), camMsg = $("camMsg"), camMsgText = $("camMsgText"), btnReconnect = $("btnReconnect");
const countdownEl = $("countdown"), flashEl = $("flash"), shotBadge = $("shotBadge");
const strip = $("strip"), sctx = strip.getContext("2d");
const btnStart = $("btnStart"), btnCancel = $("btnCancel"), btnPrint = $("btnPrint"), btnDownload = $("btnDownload"), btnReset = $("btnReset");
const timerSel = $("timer"), mirrorChk = $("mirror"), cameraSelect = $("cameraSelect");
const textPreset = $("textPreset"), textCustom = $("textCustom"), fontSelect = $("fontSelect"), showDate = $("showDate");
const printMode = $("printMode"), thumbsEl = $("thumbs");

// ---------- Kamera ----------
function showCamMessage(text, retryLabel) {
  camMsgText.textContent = text || "";
  btnReconnect.hidden = !retryLabel;
  if (retryLabel) btnReconnect.textContent = retryLabel;
  camMsg.hidden = !text;
}

function releaseStream() {
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
}

function onCameraLost(stream) {
  if (stream !== state.stream) return; // stream lama / sudah diganti
  if (session) session.abort();        // hentikan sesi pemotretan dengan bersih
  releaseStream();
  showCamMessage(CAMERA_LOST_MESSAGE, "Sambung ulang");
}

async function startCamera(deviceId) {
  const token = ++startToken;
  if (!navigator.mediaDevices?.getUserMedia) {
    showCamMessage(window.isSecureContext === false
      ? cameraErrorMessage(null, { secure: false })
      : "Browser tidak mendukung kamera. Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.");
    return;
  }
  releaseStream();
  showCamMessage("Mengaktifkan kamera…");
  try {
    const video_c = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    if (deviceId) video_c.deviceId = { exact: deviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ video: video_c, audio: false });
    if (token !== startToken) { stream.getTracks().forEach((t) => t.stop()); return; } // sudah ada permintaan lebih baru
    state.stream = stream;
    stream.getVideoTracks().forEach((t) => t.addEventListener("ended", () => onCameraLost(stream)));
    video.srcObject = stream;
    await video.play().catch(() => {});
    if (token !== startToken) return; // panggilan lebih baru sudah mengambil alih
    showCamMessage("");
    await listCameras().catch(() => {});
  } catch (err) {
    if (token !== startToken) return;
    showCamMessage(cameraErrorMessage(err, { secure: window.isSecureContext !== false }), "Coba lagi");
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

// Kamera dicabut/dipasang: cek track aktif, lalu segarkan daftar kamera.
async function onDeviceChange() {
  const track = state.stream?.getVideoTracks()[0];
  if (state.stream && (!track || track.readyState === "ended")) { onCameraLost(state.stream); return; }
  await listCameras().catch(() => {});
}

// ---------- Filter pada canvas ----------
// Uji piksel nyata (bukan sekadar typeof ctx.filter) — Safari bisa mengekspos properti tetapi mengabaikannya.
const filterSupport = { ctxFilter: detectCtxFilter((w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }) };

function filteredPhoto(raw, filterId) {
  const p = FILTERS.find((f) => f.id === filterId).p;
  const c = document.createElement("canvas");
  c.width = PHOTO_W; c.height = PHOTO_H;
  const x = c.getContext("2d");
  stats.filterRuns++;
  if (filterSupport.ctxFilter) { x.filter = toCss(p); x.drawImage(raw, 0, 0, PHOTO_W, PHOTO_H); }
  else { x.drawImage(raw, 0, 0, PHOTO_W, PHOTO_H); applyPixelFilter(x, PHOTO_W, PHOTO_H, p); }
  return c;
}

// Cache per slot: dihitung ulang hanya bila foto baru (entry di-null) atau filter berganti (filterId beda).
function getFiltered(i) {
  const raw = state.shots[i];
  if (!raw) return null;
  let e = state.filteredCache[i];
  if (needsRefilter(e, state.filter)) {
    e = { filterId: state.filter, canvas: filteredPhoto(raw, state.filter), thumbUrl: null };
    state.filteredCache[i] = e;
  }
  return e;
}

function setShot(i, canvas) {
  state.shots[i] = canvas;
  state.filteredCache[i] = null;
}

// ---------- Ambil foto ----------
function grabFrame() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const { sx, sy, sw, sh } = cropRect(vw, vh); // crop tengah ke rasio 3:2
  const c = document.createElement("canvas");
  c.width = RAW_W; c.height = RAW_H;
  const x = c.getContext("2d");
  if (mirrorChk.checked) { x.translate(RAW_W, 0); x.scale(-1, 1); }
  x.drawImage(video, sx, sy, sw, sh, 0, 0, RAW_W, RAW_H);
  return c;
}

const abortError = () => new DOMException("Sesi dibatalkan", "AbortError");
const isAbort = (e) => e?.name === "AbortError";

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const onAbort = () => { clearTimeout(t); reject(abortError()); };
    const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function countdown(sec, signal) {
  try {
    for (let n = sec; n > 0; n--) {
      countdownEl.textContent = n;
      countdownEl.classList.remove("pop"); void countdownEl.offsetWidth; countdownEl.classList.add("pop");
      await sleep(1000, signal);
    }
  } finally {
    countdownEl.textContent = "";
  }
}

async function takeShot(index, signal) {
  await countdown(parseInt(timerSel.value, 10), signal);
  if (signal.aborted) throw abortError();
  const shot = grabFrame();
  if (!shot) throw new Error("no-frame");
  flashEl.classList.remove("on"); void flashEl.offsetWidth; flashEl.classList.add("on");
  setShot(index, shot);
  renderThumbs(); renderStrip(); updateButtons();
}

async function runSession(indices) {
  if (state.busy) return;
  if (!state.stream || !video.videoWidth) { alert("Kamera belum aktif."); return; }
  const ctl = session = new AbortController();
  clearTimeout(badgeTimer);
  state.busy = true; setBusy(true);
  let note = "";
  try {
    for (let k = 0; k < indices.length; k++) {
      shotBadge.textContent = indices.length > 1 ? `Foto ${k + 1} / ${indices.length}` : `Foto ulang #${indices[k] + 1}`;
      await takeShot(indices[k], ctl.signal);
      if (k < indices.length - 1) await sleep(900, ctl.signal);
    }
  } catch (e) {
    if (isAbort(e)) note = state.stream ? "Sesi dibatalkan" : "";
    else { note = "Gagal mengambil foto"; console.error(e); }
  } finally {
    session = null;
    state.busy = false; setBusy(false);
    shotBadge.textContent = note;
    if (note) badgeTimer = setTimeout(() => { shotBadge.textContent = ""; }, 2500);
  }
}

function cancelSession() { if (session) session.abort(); }

// Kunci kontrol yang bisa mengganggu sesi; tombol Batal hanya tampil saat sesi berjalan.
// Fokus keyboard: sesi mulai -> pindah ke Batal; sesi selesai -> kembali ke Mulai bila fokus hilang (jatuh ke body / tombol Batal yang disembunyikan).
function setBusy(b) {
  const active = document.activeElement;
  const focusLost = !active || active === document.body || active === btnCancel;
  btnStart.disabled = b; btnReset.disabled = b;
  timerSel.disabled = b; mirrorChk.disabled = b; cameraSelect.disabled = b;
  btnCancel.hidden = !b;
  thumbsEl.querySelectorAll("button").forEach((t) => (t.disabled = b));
  updateButtons();
  if (b) btnCancel.focus();
  else if (focusLost) btnStart.focus();
}

// ---------- Gambar strip ----------
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

// Hanya menggambar strip dari cache; tidak memfilter ulang foto kecuali cache kosong/usang.
function renderStrip() {
  const fr = FRAMES.find((f) => f.id === state.frame);
  sctx.clearRect(0, 0, STRIP_W, STRIP_H);
  drawFrameBg(fr);

  for (let i = 0; i < SHOTS; i++) {
    const y = PAD + i * (PHOTO_H + GAP);
    const e = getFiltered(i);
    if (e) {
      sctx.drawImage(e.canvas, PAD, y);
    } else {
      sctx.fillStyle = "rgba(127,127,127,.25)";
      sctx.fillRect(PAD, y, PHOTO_W, PHOTO_H);
      sctx.fillStyle = "rgba(127,127,127,.8)";
      sctx.font = fontSpec("600", 72, "Poppins");
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
    fitFont(sctx, text, family, family === "Pacifico" ? 64 : 56, PHOTO_W - 20, family === "Poppins" ? "600" : "");
    sctx.fillText(text, STRIP_W / 2, textY);
  }
  if (hasDate) {
    sctx.fillStyle = fr.sub;
    sctx.font = fontSpec("400", 30, "Poppins");
    sctx.fillText(formatDate(new Date()), STRIP_W / 2, text ? textY + 82 : FOOTER_TOP + footerH * 0.5);
  }
}

// Thumbnail dipisah dari renderStrip: hanya dirender saat foto/filter/reset berubah, bukan saat mengetik teks.
function renderThumbs() {
  thumbsEl.innerHTML = "";
  state.shots.forEach((shot, i) => {
    const b = document.createElement("button");
    b.className = "thumb" + (shot ? " filled" : "");
    b.textContent = shot ? "↻ Ulang" : String(i + 1);
    const label = shot ? `Foto ulang #${i + 1}` : `Ambil foto #${i + 1}`;
    b.title = label; b.setAttribute("aria-label", label);
    b.disabled = state.busy;
    const e = getFiltered(i);
    if (e) {
      if (!e.thumbUrl) e.thumbUrl = e.canvas.toDataURL("image/jpeg", 0.7);
      b.style.backgroundImage = `url(${e.thumbUrl})`;
    }
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
      state.filter = f.id; // cache otomatis usang (filterId beda) -> dihitung ulang sekali
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
    const sw = document.createElement("span");
    sw.className = "swatch"; sw.style.background = f.bg; // tanpa innerHTML
    b.append(sw, document.createTextNode(f.name)); b.dataset.id = f.id;
    b.onclick = () => {
      state.frame = f.id;
      frc.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === f.id));
      renderStrip();
    };
    frc.appendChild(b);
  });
}

// ---------- Simpan & cetak ----------
function download() {
  strip.toBlob((blob) => {
    if (!blob) { alert("Gagal membuat file PNG. Silakan coba lagi."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName(new Date());
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}

// Bersihkan #printArea (data-URL strip ~ratusan KB per gambar) + aturan @page setelah dialog cetak ditutup.
function clearPrintArea() {
  const area = $("printArea");
  area.querySelectorAll("img").forEach((img) => { img.removeAttribute("src"); });
  area.replaceChildren();
  $("page-size").textContent = "";
}

async function print() {
  const url = strip.toDataURL("image/png");
  const layout = printLayout(printMode.value);
  $("page-size").textContent = layout.pageCss;
  const area = $("printArea");
  area.replaceChildren();
  const loads = [];
  for (let i = 0; i < layout.copies; i++) {
    const img = new Image(); img.alt = ""; img.src = url; area.appendChild(img);
    loads.push(img.decode().catch(() => {}));
  }
  if (layout.cutLine) { // garis bantu potong hanya di cetakan 4x6; tidak menyentuh canvas/PNG
    const cut = document.createElement("div"); cut.className = "cutline"; area.appendChild(cut);
  }
  await Promise.all(loads);
  window.print();
}

// ---------- Font ----------
// Bobot persis seperti yang dipakai renderStrip: Pacifico 400, Poppins 400 (tanggal) + 600 (teks Modern, nomor slot), Courier Prime 400 (Mesin ketik).
const FONT_LOADS = [["Pacifico", "400"], ["Poppins", "400"], ["Poppins", "600"], ["Courier Prime", "400"]];
function loadFonts(family) {
  return Promise.all(FONT_LOADS.filter(([f]) => !family || f === family)
    .map(([f, w]) => document.fonts.load(`${w} 64px "${f}"`).catch(() => {})));
}

// ---------- Event ----------
btnStart.onclick = () => runSession([...Array(SHOTS).keys()]);
btnCancel.onclick = cancelSession;
btnReset.onclick = () => {
  if (state.busy) return;
  if (confirm("Hapus semua foto?")) { state.shots.fill(null); state.filteredCache.fill(null); renderAll(); }
};
btnReconnect.onclick = () => startCamera();
btnDownload.onclick = download;
btnPrint.onclick = print;
mirrorChk.onchange = () => cameraBox.classList.toggle("mirror", mirrorChk.checked);
cameraSelect.onchange = () => startCamera(cameraSelect.value);
textPreset.onchange = () => { textCustom.hidden = textPreset.value !== "__custom"; if (!textCustom.hidden) textCustom.focus(); renderStrip(); };
textCustom.oninput = renderStrip;
showDate.onchange = renderStrip;
fontSelect.onchange = async () => { await loadFonts(fontSelect.value); renderStrip(); };
window.addEventListener("afterprint", clearPrintArea);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.busy) { e.preventDefault(); cancelSession(); return; }
  if (e.code === "Space" && !state.busy && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
    e.preventDefault(); btnStart.click();
  }
});
navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

// ---------- Init ----------
cameraBox.classList.toggle("mirror", mirrorChk.checked);
buildChips();
renderAll();
loadFonts().then(() => renderStrip());
startCamera();

window.__photobooth = { state, stats, filterSupport, renderAll, FILTERS, FRAMES }; // untuk debug/uji
