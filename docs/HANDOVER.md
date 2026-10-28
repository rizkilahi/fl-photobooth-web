# HANDOVER — Photobooth Web

Dokumen serah terima operasional, arsitektur file, dan pengelolaan deploy untuk proyek **Photobooth Web**.

## 1. Informasi Proyek & URL
- **URL Live (Produksi):** https://rizkilahi.github.io/fl-photobooth-web/
- **Repositori GitHub:** https://github.com/rizkilahi/fl-photobooth-web
- **Branch Produksi:** `main`
- **Visibilitas Repositori:** `public` (diperlukan oleh GitHub Pages pada paket GitHub gratis)
- **Platform Hosting:** GitHub Pages (mode `workflow` via GitHub Actions, HTTPS aktif otomatis)

## 2. Daftar File Produksi vs Pengembangan (Dev)
Aplikasi menggunakan arsitektur **Vanilla HTML/CSS/JS (ES Modules, zero-build)**. Untuk menjaga kebersihan situs publik, hanya file aplikasi inti yang dikemas ke artefak `_site/` saat deploy.

### File Produksi (Disajikan di GitHub Pages)
| File | Peran |
|---|---|
| `index.html` | Struktur halaman utama, kontrol UI, kanvas pratinjau strip, area cetak (`#printArea`), favicon SVG inline, dan pemuatan Google Fonts (`Pacifico`, `Poppins`, `Courier Prime`). |
| `style.css` | Gaya tampilan responsif dan aturan cetak `@media print` untuk ukuran kertas `2×6 inci` (1 strip) serta `4×6 inci / 4R` (2 strip kembar dengan garis bantu potong `.cutline`). |
| `app.js` | Logika antarmuka & browser: akses webcam (`getUserMedia`), hitung mundur & pembatalan sesi (`AbortController`), cache kanvas filter per slot (`filteredCache`), render strip `600×1800 px`, unduh PNG, dan pemicu dialog cetak (`window.print()`). |
| `lib.js` | Modul fungsi murni tanpa ketergantungan DOM: daftar `FILTERS` & `FRAMES`, generator CSS filter (`toCss`), matriks piksel fallback (`applyPixelFilter`), deteksi dukungan `ctx.filter` berbasis piksel, perhitungan crop 3:2 (`crop3x2`), `fitFont`, PRNG deterministik (`seeded`), format tanggal/nama file, pemetaan pesan error kamera (`cameraErrorMessage`), logika cache (`needsRefilter`), dan konfigurasi cetak (`printLayout`). |

### File Pengembangan & Dokumentasi (Hanya di Repo, Tidak Ikut Di-deploy)
| File / Folder | Peran |
|---|---|
| `package.json`, `package-lock.json` | Konfigurasi `devDependencies` (ESLint & Vitest) serta skrip `npm run lint` dan `npm test`. |
| `eslint.config.js`, `vitest.config.js` | Konfigurasi linter ESLint (flat config) dan runner unit test Vitest. |
| `tests/lib.test.js` | 49 unit test otomatis untuk seluruh fungsi murni di `lib.js` (termasuk uji akurasi filter terhadap tabel `GOLDEN` Chromium). |
| `.github/workflows/deploy.yml` | Workflow CI/CD GitHub Actions untuk validasi kualitas kode dan deploy ke GitHub Pages. |
| `docs/` | Dokumentasi proyek (`BRIEF.md`, `SPEC.md`, `ARCHITECTURE.md`, `STATUS.md`, `QA.md`, `REVIEW.md`, `HANDOVER.md`) — mengembalikan HTTP 404 di URL GitHub Pages. |
| `README.md`, `.gitignore` | Panduan ringkas repositori dan aturan pengabaian file Git (termasuk `node_modules/` dan `_site`). |

## 3. Alur CI/CD Otomatis (GitHub Actions)
Setiap kali ada `git push` ke branch `main` (atau dijalankan manual lewat tombol **Run workflow** / `workflow_dispatch` di tab **Actions**):
1. Runner `ubuntu-latest` melakukan checkout kode dan menyiapkan Node.js 22.
2. Menjalankan `npm ci` untuk memasang `devDependencies` secara deterministik.
3. Menjalankan quality gate `npm run lint` (ESLint) dan `npm test` (Vitest). Bila salah satu gagal, proses berhenti dan situs live tidak tertimpa.
4. Membuat folder `_site/` dan menyalin **hanya** `index.html`, `style.css`, `app.js`, dan `lib.js`.
5. Mengonfigurasi Pages (`actions/configure-pages@v5`), mengunggah artefak `_site/` (`actions/upload-pages-artifact@v3`), dan men-deploy ke lingkungan `github-pages` (`actions/deploy-pages@v4`).

## 4. Cara Menjalankan Lokal & Pengujian
### Menjalankan Aplikasi di Komputer Lokal
Karena aplikasi menggunakan ES Module (`<script type="module" src="app.js">`) dan API kamera membutuhkan konteks aman (`https://` atau `localhost`/`127.0.0.1`), halaman harus disajikan lewat server HTTP (tidak bisa dibuka lewat `file://`):
```bash
python3 -m http.server 8000
```
Lalu buka `http://localhost:8000` atau `http://127.0.0.1:8000` di browser.

### Mode Debug (`window.__photobooth`)
Untuk keperluan inspeksi dan pengujian otomatis, objek `window.__photobooth` (`{ state, stats, filterSupport, renderAll, FILTERS, FRAMES }`) hanya diekspos apabila:
- Aplikasi dibuka di `localhost` atau `127.0.0.1`, atau
- URL memiliki parameter query `?debug` (mis. `https://rizkilahi.github.io/fl-photobooth-web/?debug`).

Pada akses normal di domain produksi tanpa `?debug`, `window.__photobooth` bernilai `undefined`.

### Menjalankan Linter & Unit Test
```bash
npm ci
npm run lint
npm test
```

## 5. Cara Mematikan Situs atau Mengubah Visibilitas Repo
### Mematikan Publikasi GitHub Pages (Unpublish)
- **Via GitHub CLI (`gh`):**
  ```bash
  ~/.local/bin/gh api -X DELETE repos/rizkilahi/fl-photobooth-web/pages
  ```
- **Via Web GitHub:** Buka **Settings → Pages**, lalu klik **Unpublish site** atau ubah bagian *Build and deployment → Source* menjadi **Deploy from a branch (None)**.Untuk mengaktifkan kembali via CLI:
  ```bash
  ~/.local/bin/gh api -X POST repos/rizkilahi/fl-photobooth-web/pages -f build_type=workflow
  ```

### Mengubah Visibilitas Repositori Kembali ke Private
- **Via GitHub CLI (`gh`):**
  ```bash
  ~/.local/bin/gh repo edit rizkilahi/fl-photobooth-web --visibility private --accept-visibility-change-consequences
  ```
- **Via Web GitHub:** Buka **Settings → General → Danger Zone → Change repository visibility → Change to private**.
- *Catatan:* Pada akun GitHub gratis, mengubah repositori menjadi `private` akan menonaktifkan penayangan situs GitHub Pages.

## 6. Catatan Batas Browser, Kamera, Printer & Privasi
- **Konteks Aman & Izin Kamera:** `navigator.mediaDevices.getUserMedia` hanya diizinkan browser pada `https://` atau `localhost`/`127.0.0.1`. Jika izin kamera ditolak (`NotAllowedError`), tidak ada perangkat kamera (`NotFoundError`), atau webcam sedang dikunci aplikasi lain (`NotReadableError`), aplikasi menampilkan instruksi pemulihan dalam Bahasa Indonesia serta tombol **Sambung ulang** bila kamera terputus di tengah jalan.
- **Kompatibilitas Filter Canvas:** Saat inisialisasi, aplikasi menguji apakah `ctx.filter` benar-benar mengubah nilai piksel (mengantisipasi quirk Safari/WebKit). Bila `ctx.filter` tidak berfungsi, aplikasi otomatis memakai pemrosesan piksel matriks (`applyPixelFilter`) dengan hasil warna yang setara.
- **Batas Driver Printer & Ukuran Kertas:**
  - Mode **Strip 2×6 inci (1 strip)** mengatur `@page { size: 2in 6in; margin: 0; }`, cocok untuk printer foto/dye-sub yang mendukung ukuran kertas 2×6 inci.
  - Mode **Kertas 4×6 inci / 4R (2 strip kembar)** mengatur `@page { size: 4in 6in; margin: 0; }` dan menyertakan garis bantu potong tipis putus-putus tepat di tengah (`left: 2in`). Mode ini paling direkomendasikan untuk printer rumahan umum.
  - Di dialog cetak browser, pastikan mengatur **Margins: None**, **Scale: 100%** (bukan *Fit to page*), dan mencentang **Background graphics** agar warna frame dan garis potong tercetak akurat.
- **Privasi Pengguna:** 100% pemrosesan foto dilakukan di memori browser pengguna dan tidak pernah dikirim ke server mana pun. Foto langsung terhapus dari memori saat tab ditutup atau tombol **Ulang semua** ditekan. Satu-satunya koneksi ke pihak ketiga adalah pemuatan font (`Pacifico`, `Poppins`, `Courier Prime`) dari Google Fonts (dengan fallback ke font sistem bila offline).
