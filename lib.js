/* Fungsi murni & konstanta Photobooth — tanpa akses DOM global, jadi bisa diuji di Node (Vitest)
   sekaligus dimuat langsung di browser lewat <script type="module"> (tanpa bundler). */

// ---------- Konstanta layout strip (2x6 inci @ 300 dpi) ----------
export const STRIP_W = 600, STRIP_H = 1800;
export const PAD = 36, GAP = 16;
export const PHOTO_W = STRIP_W - PAD * 2;           // 528
export const PHOTO_H = Math.round(PHOTO_W * 2 / 3); // 352 (rasio 3:2)
export const SHOTS = 4;
export const FOOTER_TOP = PAD + SHOTS * PHOTO_H + (SHOTS - 1) * GAP; // 1492
export const RAW_W = PHOTO_W * 2, RAW_H = PHOTO_H * 2; // simpan resolusi 2x

// ---------- Filter (urutan sama dengan CSS filter) ----------
export const FILTERS = [
  { id: "normal", name: "Normal", p: {} },
  { id: "bw", name: "Hitam Putih", p: { grayscale: 1, contrast: 1.15 } },
  { id: "sepia", name: "Sepia", p: { sepia: 0.85, contrast: 1.05 } },
  { id: "vintage", name: "Vintage", p: { sepia: 0.4, saturate: 0.8, brightness: 1.08, contrast: 0.9 } },
  { id: "warm", name: "Hangat", p: { sepia: 0.2, saturate: 1.35, brightness: 1.05 } },
  { id: "pop", name: "Pop", p: { saturate: 1.8, contrast: 1.15 } },
  { id: "noir", name: "Noir", p: { grayscale: 1, contrast: 1.6, brightness: 0.9 } },
  { id: "fade", name: "Pudar", p: { saturate: 0.6, contrast: 0.8, brightness: 1.12 } },
];
export const ORDER = ["grayscale", "sepia", "saturate", "brightness", "contrast"];
export const toCss = (p) => ORDER.filter((k) => p[k] !== undefined).map((k) => `${k}(${p[k]})`).join(" ") || "none";

// ---------- Frame / border ----------
export const FRAMES = [
  { id: "classic", name: "Klasik Putih", bg: "#ffffff", ink: "#222222", sub: "#888888" },
  { id: "black", name: "Hitam Elegan", bg: "#111111", ink: "#ffffff", sub: "#bbbbbb" },
  { id: "pink", name: "Pink Pastel", bg: "#ffd1dc", ink: "#d6336c", sub: "#c2577a", pattern: "dots", dot: "#ffe6ec" },
  { id: "retro", name: "Krem Retro", bg: "#f3e5c8", ink: "#6b4226", sub: "#8c6a4f", pattern: "lines" },
  { id: "polka", name: "Polkadot", bg: "#2b2d6e", ink: "#ffd166", sub: "#c9cbf5", pattern: "dots", dot: "#ffd166" },
  { id: "film", name: "Film Strip", bg: "#141414", ink: "#ffffff", sub: "#aaaaaa", pattern: "film" },
  { id: "confetti", name: "Konfeti", bg: "#ffffff", ink: "#ff5d8f", sub: "#666666", pattern: "confetti" },
  { id: "mint", name: "Mint", bg: "#c8f2e0", ink: "#14715a", sub: "#3d8f78" },
];

// ---------- Font: selalu sertakan generic family sebagai fallback bila font web gagal dimuat ----------
export const FONT_FALLBACK = {
  "Pacifico": "cursive",
  "Poppins": "system-ui, sans-serif",
  "Courier Prime": "monospace",
};
export function fontStack(family) {
  return `"${family}", ${FONT_FALLBACK[family] || "sans-serif"}`;
}
export function fontSpec(weight, size, family) {
  return `${weight} ${size}px ${fontStack(family)}`.trim().replace(/\s+/g, " ");
}

/** Kecilkan font (langkah 2px, batas bawah 18px) hingga teks muat di maxW. `ctx` = CanvasRenderingContext2D.
 *  Mengatur ctx.font dan mengembalikan ukuran akhir. */
export function fitFont(ctx, text, family, startSize, maxW, weight = "") {
  let size = startSize;
  do {
    ctx.font = fontSpec(weight, size, family);
    size -= 2;
  } while (ctx.measureText(text).width > maxW && size > 18);
  return size + 2;
}

// ---------- Crop tengah rasio 3:2 ----------
export function cropRect(vw, vh) {
  let sw = vw, sh = vw * 2 / 3;
  if (sh > vh) { sh = vh; sw = vh * 3 / 2; }
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

// ---------- Fallback piksel (rumus matriks sesuai spesifikasi CSS Filter Effects) ----------
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function filterMatrices(p) {
  const mats = [];
  if (p.grayscale !== undefined) { const g = 1 - p.grayscale; mats.push([0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g, 0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g, 0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g]); }
  if (p.sepia !== undefined) { const s = 1 - p.sepia; mats.push([0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s, 0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s, 0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s]); }
  if (p.saturate !== undefined) { const s = p.saturate; mats.push([0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]); }
  return mats;
}

/** Terapkan filter p ke array RGBA (Uint8ClampedArray / Array) di tempat. */
export function applyFilterToData(d, p) {
  if (!Object.keys(p).length) return d;
  const mats = filterMatrices(p);
  const br = p.brightness ?? 1, ct = p.contrast ?? 1, off = 255 * (0.5 - 0.5 * ct);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    for (const m of mats) {
      const nr = clamp255(m[0] * r + m[1] * g + m[2] * b), ng = clamp255(m[3] * r + m[4] * g + m[5] * b), nb = clamp255(m[6] * r + m[7] * g + m[8] * b);
      r = nr; g = ng; b = nb;
    }
    r = clamp255(r * br); g = clamp255(g * br); b = clamp255(b * br);
    d[i] = clamp255(r * ct + off); d[i + 1] = clamp255(g * ct + off); d[i + 2] = clamp255(b * ct + off);
  }
  return d;
}

export function applyPixelFilter(ctx, w, h, p) {
  if (!Object.keys(p).length) return;
  const img = ctx.getImageData(0, 0, w, h);
  applyFilterToData(img.data, p);
  ctx.putImageData(img, 0, 0);
}

/** Uji dukungan ctx.filter dengan piksel nyata: gambar 1x1 merah, filter grayscale(1), lalu baca RGB.
 *  Safari bisa mengekspos properti `filter` berupa string tapi mengabaikannya saat drawImage.
 *  `makeCanvas(w, h)` mengembalikan canvas (agar bisa diinjeksi di tes). Aman terhadap exception. */
export function detectCtxFilter(makeCanvas) {
  try {
    const src = makeCanvas(1, 1), sx = src.getContext("2d");
    if (!sx || typeof sx.filter !== "string") return false;
    sx.fillStyle = "rgb(255,0,0)"; sx.fillRect(0, 0, 1, 1);
    const dst = makeCanvas(1, 1), dx = dst.getContext("2d");
    dx.filter = "grayscale(1)";
    dx.drawImage(src, 0, 0);
    const [r, g, b] = dx.getImageData(0, 0, 1, 1).data;
    // merah murni -> grayscale(1) ≈ (54,54,54). Tanpa filter tetap (255,0,0).
    return Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r > 20 && r < 120;
  } catch {
    return false;
  }
}

// ---------- PRNG deterministik (LCG Park–Miller) ----------
export function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

// ---------- Tanggal & nama file ----------
const pad2 = (n) => String(n).padStart(2, "0");
/** "DD . MM . YYYY" (zona waktu lokal) */
export function formatDate(d) {
  return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map(pad2).join(" . ");
}
/** "photobooth-YYYYMMDD-HHMMSS.png" (zona waktu lokal) */
export function fileName(d) {
  return `photobooth-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.png`;
}

// ---------- Pesan error kamera (Bahasa Indonesia) ----------
export function cameraErrorMessage(err, { secure = true } = {}) {
  const name = err?.name || "";
  if (!secure) return "Kamera hanya bisa dipakai lewat https:// atau http://localhost. Buka aplikasi lewat alamat yang aman.";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "Izin kamera ditolak. Klik ikon kamera/gembok di address bar, pilih Izinkan, lalu tekan Coba lagi.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Kamera tidak ditemukan. Pastikan webcam terpasang dan aktif, lalu tekan Coba lagi.";
    case "NotReadableError":
    case "TrackStartError":
      return "Kamera sedang dipakai aplikasi lain (mis. Zoom/Meet) atau tidak bisa dibuka. Tutup aplikasi itu, lalu tekan Coba lagi.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "Kamera yang dipilih tidak tersedia atau tidak mendukung pengaturan yang diminta. Pilih kamera lain atau tekan Coba lagi.";
    case "AbortError":
      return "Pengaktifan kamera dibatalkan oleh browser/perangkat. Tekan Coba lagi.";
    default:
      return `Kamera tidak bisa diakses${name ? ` (${name})` : ""}. Tekan Coba lagi atau muat ulang halaman.`;
  }
}

export const CAMERA_LOST_MESSAGE = "Kamera terputus (dicabut atau dihentikan). Sambungkan kembali kamera lalu tekan Sambung ulang.";
