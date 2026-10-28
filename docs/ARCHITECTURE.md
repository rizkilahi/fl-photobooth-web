# ARCHITECTURE — photobooth-web

## 1. Keputusan Stack
- **Runtime & UI:** Vanilla HTML5, CSS3, dan JavaScript (ES2020+) tanpa framework UI dan tanpa bundler pada waktu produksi.
  - *Alasan:* Kode prototipe sudah berfungsi lengkap hanya dalam 3 file (~500 baris total), sehingga mempertahankan vanilla JS menghindari kompleksitas build dan menghasilkan beban unduh hampir nol.
- **Pengolahan Gambar & Cetak:** Web API bawaan browser (`MediaDevices.getUserMedia`, `HTMLCanvasElement` 2D Context, `CSSFontLoading API`, dan CSS `@media print` / `@page`).
  - *Alasan:* Semua kebutuhan manipulasi filter, komposisi strip 300 DPI (`600×1800 px`), dan pencetakan ukuran khusus dapat ditangani langsung di sisi klien dengan privasi penuh (tanpa server).
- **Tooling Kualitas (Dev-Only):** Node.js + ESLint + Vitest (hanya pada `devDependencies` untuk pengujian lokal/CI, tidak mengubah sifat statis file produksi).
  - *Alasan:* Memungkinkan verifikasi otomatis untuk logika perhitungan rasio, matriks filter piksel, dan kualitas kode tanpa memaksa langkah *build* saat deploy.

## 2. Struktur File
```text
photobooth-web/
├── index.html          # Markup aplikasi utama, kontrol UI, kanvas strip, & #printArea
├── style.css           # Styling responsif, animasi hitung mundur/flash, & aturan @media print
├── app.js              # State aplikasi, kontrol kamera, filter kanvas, komposisi strip, & print/unduh
├── package.json        # (M1) Konfigurasi skrip lint & unit test (devDependencies saja)
├── tests/              # (M1) Unit test Vitest untuk fungsi logika murni
└── docs/
    ├── BRIEF.md        # Hasil intake & ruang lingkup awal
    ├── SPEC.md         # Spesifikasi fitur, user story, AC, milestone, & risiko
    ├── ARCHITECTURE.md # Dokumen arsitektur ini
    └── STATUS.md       # Log status & gate proyek
```

## 3. Model Data & State (In-Memory Client State)
Aplikasi tidak menggunakan database atau penyimpanan persisten. Seluruh state berada di memori (`state` di `app.js`):
- `shots`: `Array<HTMLCanvasElement | null>` (panjang 4) — menyimpan hasil tangkapan kamera mentah (*raw*) berukuran `1056 × 704 px` (2× ukuran slot cetak, rasio 3:2) yang sudah di-crop tengah dan di-mirror sesuai pengaturan saat jepret.
- `filteredCache` *(penambahan M1)*: `Array<HTMLCanvasElement | null>` (panjang 4) — menyimpan kanvas ukuran `528 × 352 px` yang sudah diberi filter aktif agar perubahan teks/frame tidak memfilter ulang foto mentah.
- `filter`: `string` — ID filter aktif (`normal`, `bw`, `sepia`, `vintage`, `warm`, `pop`, `noir`, `fade`).
- `frame`: `string` — ID desain border aktif (`classic`, `black`, `pink`, `retro`, `polka`, `film`, `confetti`, `mint`).
- `busy`: `boolean` — penanda sesi pemotretan sedang berlangsung (mengunci kontrol UI).
- `stream`: `MediaStream | null` — referensi aliran video kamera aktif.

## 4. Alur Data (`Kamera -> Raw Canvas -> Filter -> Strip -> Print / PNG`)
```text
[Webcam (MediaStream)]
   │  (live preview <video> diberi style.filter CSS)
   ▼
[1. Grab Frame (grabFrame)]
   │  Crop tengah ke rasio 3:2 + transformasi Mirror jika aktif
   ▼
[2. Raw Canvas per Slot (state.shots[0..3] @ 1056×704 px)]
   │  Disimpan tanpa filter agar user bebas ganti filter kapan saja
   ▼
[3. Filter Engine (filteredPhoto @ 528×352 px)]
   ├─ Jalur cepat: ctx.filter (jika lolos uji piksel nyata)
   └─ Jalur fallback: applyPixelFilter (matriks RGB ImageData untuk Safari/browser lama)
   │
   ├──► [Thumbnail Preview (#thumbs)]
   ▼
[4. Strip Compositor (renderStrip pada <canvas id="strip"> @ 600×1800 px / 300 DPI)]
   ├─ Latar & motif border (drawFrameBg: solid / dots / lines / film / confetti)
   ├─ 4 slot foto terfilter (y = 36, 404, 772, 1140; masing-masing 528×352 px)
   └─ Footer (y = 1492..1800): teks preset/custom (auto-fit font) + tanggal opsional
   │
   ├──────────────────────────┐
   ▼                          ▼
[5a. Cetak (print)]        [5b. Unduh (download)]
   ├─ Mode 2×6: 1 <img>       └─ strip.toBlob("image/png")
   │  @page { size: 2in 6in }    photobooth-YYYYMMDD-HHMMSS.png
   ├─ Mode 4×6: 2 <img> kembar
   │  @page { size: 4in 6in }
   └─ img.decode() -> window.print()
```

## 5. Daftar Halaman & Endpoint
- **Halaman Tunggal (`/index.html`):** Semua alur (pengaturan kamera, pengambilan 4 foto, pemilihan filter/frame/teks, pratinjau strip, dan aksi cetak/unduh) berada dalam satu halaman (*Single-Page Interface*) dua kolom (kolom kiri: kamera + filter + thumbnail; kolom kanan: pratinjau strip + frame + teks + cetak).
- **Endpoint Backend:** Tidak ada (0 endpoint server). Semua aset statis disajikan langsung oleh CDN/web server.

## 6. Opsi Hosting Statis (HTTPS Wajib)
Karena tidak ada backend maupun langkah build wajib, repositori dapat dideploy langsung ke salah satu layanan gratis berikut di Fase 5:
1. **GitHub Pages (Rekomendasi Utama):** Langsung aktif dari branch `main` di repo `rizkilahi/fl-photobooth-web` dengan HTTPS bawaan `*.github.io` tanpa akun tambahan.
2. **Cloudflare Pages:** CDN global sangat cepat, HTTPS otomatis, dan mendukung kustomisasi header keamanan (`_headers` untuk `Permissions-Policy: camera=(self)`).
3. **Vercel / Netlify:** Alternatif populer dengan preview URL otomatis per branch/PR.
