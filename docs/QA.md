# QA Report — photobooth-web (Milestone M1)

- **Tanggal Pengujian:** 2026-10-28
- **Tester / Peran:** QA (Gemini 3.8 Flash)
- **Branch:** `m1-tooling-ketahanan`
- **Lingkungan Uji:** Chromium headless via CDP (Browser Use CLI), demo statis di `http://127.0.0.1:8765/`
- **Viewport:** Desktop (1280×800 px) & Mobile (390×844 px)
- **Catatan Kamera:** Pengujian menggunakan kamera tiruan (*mock webcam* via CDP `Page.addScriptToEvaluateOnNewDocument` dengan stream `canvas.captureStream(30)` dan mock `navigator.mediaDevices.enumerateDevices`) karena server VM tidak memiliki webcam fisik.

---

## 1. Hasil Pengujian Otomatis (Lint & Unit Test)

| Perintah | Hasil | Keterangan |
|---|---|---|
| `npm run lint` | **LULUS** | 0 error, 0 warning (ESLint lolos bersih) |
| `npm test` | **LULUS** | 1 test file (`tests/lib.test.js`), 35 passed, 0 failed |

---

## 2. Tabel Acceptance Criteria (Milestone M1)

| ID AC | Deskripsi Kriteria | Status | Bukti / Nilai yang Diamati |
|---|---|---|---|
| **AC-01.1** | Akses kamera resolusi ideal 1920×1080 & live preview rasio 3:2 | **LULUS** | `video.playing: true`, `videoWidth: 1280`, `videoHeight: 720`, crop rasio 3:2 via `cropRect()` |
| **AC-01.2** | Penanganan pesan error kamera Bahasa Indonesia | **LULUS** | `NotAllowedError`: *"Izin kamera ditolak. Klik ikon kamera/gembok di address bar, pilih Izinkan, lalu tekan Coba lagi."*<br>`NotFoundError`: *"Kamera tidak ditemukan. Pastikan webcam terpasang dan aktif, lalu tekan Coba lagi."*<br>`NotReadableError`: *"Kamera sedang dipakai aplikasi lain (mis. Zoom/Meet) atau tidak bisa dibuka. Tutup aplikasi itu, lalu tekan Coba lagi."* |
| **AC-01.3** | Deteksi >= 2 kamera (`videoinput`) & dropdown pemilih | **LULUS** | Terdeteksi 2 mock camera (`mock-cam-1`, `mock-cam-2`). `#cameraSelect` otomatis tidak tersembunyi (`hidden: false`), opsi muncul lengkap |
| **AC-01.4** | Checkbox Mirror membalik pratinjau & hasil capture | **LULUS** | Checkbox dicentang -> `#cameraBox` memiliki class `.mirror`. Uncheck -> class `.mirror` terlepas. `grabFrame` menerapkan `translate(RAW_W, 0); scale(-1, 1)` |
| **AC-01.5** | Pilihan hitung mundur 3 dtk (default), 5 dtk, 10 dtk | **LULUS** | Dropdown `#timer` memiliki opsi 3 (default `selected: true`), 5, dan 10 detik |
| **AC-02.1** | Tombol Mulai (4 foto) & shortcut Spacebar (jeda ~900ms) | **LULUS** | Klik tombol Mulai menjalankan 4 jepretan berurutan. Menekan `Space` saat fokus di body memicu sesi pemotretan |
| **AC-02.2** | Indikator progres sesi (busy), countdown tengah, & flash | **LULUS** | Selama sesi, `#shotBadge` menampilkan `Foto 1 / 4` s.d. `Foto 4 / 4`, `#countdown` menampilkan angka countdown, `#flash` mendapat class `.on` |
| **AC-02.3** | Kontrol terkunci saat sesi aktif & tombol Batal | **LULUS** | Selama busy: `btnStart`, `btnReset`, `timer`, `mirror`, `cameraSelect`, dan tombol `thumb` berstatus `disabled: true`. Tombol `btnCancel` muncul (`hidden: false`). Saat tombol Batal ditekan, sesi berhenti bersih (`state.busy: false`), badge menampilkan *"Sesi dibatalkan"*, dan foto yang **sudah diambil tetap tersimpan** (terverifikasi: foto ke-1 tetap ada saat dibatalkan di foto ke-2) |
| **AC-02.4** | Pratinjau 4 thumbnail & foto ulang per slot (retake) | **LULUS** | Setelah 4 foto selesai, 4 thumbnail terisi. Menekan tombol retake slot #2 hanya memperbarui slot 2 (`slot1_changed: true`), sementara slot 1, 3, 4 tetap sama (`slot0_same: true`, `slot2_same: true`, `slot3_same: true`) |
| **AC-02.5** | Tombol Ulang semua (reset) | **LULUS** | Menampilkan dialog konfirmasi (`confirm`), mengosongkan keempat slot (`shots: [false, false, false, false]`), tombol Cetak & Download kembali `disabled: true`, tombol Mulai kembali ke *"▶ Mulai (4 foto)"* |
| **AC-03.1** | 8 pilihan filter warna | **LULUS** | Tersedia 8 filter lengkap: `Normal`, `Hitam Putih`, `Sepia`, `Vintage`, `Hangat`, `Pop`, `Noir`, `Pudar` |
| **AC-03.2** | Pergantian filter live & non-destruktif | **LULUS** | Mengganti filter langsung mengupdate `video.style.filter` (mis. `grayscale(1) contrast(1.15)`), thumbnail, dan strip tanpa merusak `raw canvas` |
| **AC-03.3** | Fallback filter piksel (`applyPixelFilter`) | **LULUS** | Saat `filterSupport.ctxFilter` dipaksa `false`, sistem otomatis memproses via `applyPixelFilter` berbasis ImageData. Cache tetap valid (`cacheValid: true`, `cachedFilterId: "sepia"`) |
| **AC-04.1** | 8 pilihan tema border / frame | **LULUS** | Tersedia 8 frame: `Klasik Putih`, `Hitam Elegan`, `Pink Pastel`, `Krem Retro`, `Polkadot`, `Film Strip`, `Konfeti`, `Mint` |
| **AC-04.2** | Render ulang frame & kontras teks footer | **LULUS** | Mengganti frame merender ulang kanvas strip dengan warna latar dan warna teks footer (`ink` dan `sub`) yang sesuai |
| **AC-05.1** | Preset teks strip | **LULUS** | Tersedia 5 preset (`Photobooth`, `Best Friends Forever`, `Kenangan Kita`, `Happy Birthday!`, `Say Cheese!`), opsi `Tulis sendiri…`, dan `(tanpa teks)` |
| **AC-05.2** | Teks kustom (maks 28 karakter) & pencegahan filter ulang | **LULUS** | Input `#textCustom` memiliki `maxLength: 28`. Mengetik teks kustom memicu pembaruan footer strip **tanpa memfilter ulang foto** (`filter_runs_diff: 0`, nilai `filterRuns` tetap 14 sebelum dan sesudah mengetik) |
| **AC-05.3** | Auto-fit font (`fitFont`) teks panjang | **LULUS** | Teks sepanjang 28 karakter otomatis mengecilkan ukuran font dari 64px menjadi 34px (`34px Pacifico, cursive`) agar tidak terpotong |
| **AC-05.4** | 3 gaya font & fallback generik | **LULUS** | Tersedia `Pacifico` (script/cursive), `Poppins` (modern/sans-serif), dan `Courier Prime` (mesin ketik/monospace) |
| **AC-05.5** | Toggle tanggal strip (`formatDate`) | **LULUS** | Checkbox `#showDate` aktif menampilkan format `DD . MM . YYYY`, saat dinonaktifkan tanggal hilang dari footer |
| **AC-06.1** | Resolusi cetak kanvas strip 600×1800 px & foto 528×352 px | **LULUS** | Kanvas `#strip` berukuran `width: 600`, `height: 1800` |
| **AC-06.2** | Tombol Cetak & Download aktif saat 4 foto terisi | **LULUS** | Saat slot belum penuh: `disabled: true`. Setelah 4 foto terisi: `disabled: false` |
| **AC-06.3** | Mode cetak Strip 2×6 inci (1 strip) | **LULUS** | Mengatur `#page-size` menjadi `@page { size: 2in 6in; margin: 0; }` dan merender 1 elemen `<img>` di `#printArea` |
| **AC-06.4** | Mode cetak Kertas 4×6 inci / 4R (2 strip kembar) | **LULUS (M1)** | Mengatur `#page-size` menjadi `@page { size: 4in 6in; margin: 0; }` dan merender 2 elemen `<img>` di `#printArea`. *(Catatan: garis bantu potong dijadwalkan di M2 sesuai Gate 1)* |
| **AC-06.5** | Penamaan unduhan file PNG | **LULUS** | Format nama file terverifikasi: `photobooth-YYYYMMDD-HHMMSS.png` |
| **Ketahanan Kamera** | Kamera terputus (track ended / stop) | **LULUS** | Saat video track dihentikan, aplikasi memunculkan pesan *"Kamera terputus (dicabut atau dihentikan). Sambungkan kembali kamera lalu tekan Sambung ulang."* beserta tombol *"Sambung ulang"*. Menekan tombol berhasil menyambungkan kamera kembali |
| **Responsif Mobile** | Layout mobile viewport 390×844 px | **LULUS** | `scrollWidth: 390`, `clientWidth: 390`, tidak ada overflow horizontal (`overflowX: false`). Seluruh kontrol, kamera, dan strip muat secara vertikal |
| **Console Error** | Pemeriksaan log console browser | **LULUS** | Tidak ada uncaught error atau console error fatal selama seluruh sesi pengujian |

---

## 3. Ringkasan Temuan & Bug

| ID Temuan | Komponen / User Story | Langkah Reproduksi | Hasil vs Harapan | Tingkat Keparahan | Catatan |
|---|---|---|---|---|---|
| - | - | - | Tidak ditemukan bug pemblokir / fungsional pada Milestone M1. | **None** | Seluruh kriteria M1 terpenuhi dengan baik. |

### Catatan Observasi untuk Milestone M2 (Sesuai SPEC & Gate 1):
1. **Garis Bantu Potong 4×6:** Garis bantu potong tipis di tengah antara 2 strip kembar mode 4×6 inci dijadwalkan untuk diimplementasikan pada M2 (AC-06.4).
2. **Pembersihan DOM Print Area:** Pembersihan elemen gambar di `#printArea` pada event `afterprint` dijadwalkan pada M2.
3. **Aksesibilitas & Polish UI:** Atribut `aria-label`/`aria-live`, favicon SVG, dan penyesuaian font weight Courier Prime 400 dijadwalkan untuk M2.

---

## 4. Kesimpulan
- **Milestone M1 Berstatus:** **LULUS (PASS)**
- Semua pengujian unit test (35/35), linting (0 error), ketahanan kamera, caching filter per slot, tombol Batal sesi, dan fallback filter piksel telah diverifikasi dan berjalan sesuai spesifikasi docs/SPEC.md.

---

## M2 — Cetak & Polish (branch m2-cetak-polish)

- **Tanggal Pengujian:** 2026-10-28
- **Tester / Peran:** QA (Gemini 3.8 Flash)
- **Branch:** `m2-cetak-polish`
- **Lingkungan Pengujian:** Headless Chromium via CDP / Browser Use di Linux VM (1280×800 Desktop & 390×844 Mobile)
- **Catatan Kamera & Perangkat:** Kamera diuji menggunakan kamera tiruan (*mock webcam*) via CDP `Page.addScriptToEvaluateOnNewDocument` (`canvas.captureStream` & `enumerateDevices`). Pengujian cetak fisik printer hardware serta browser Safari dan Firefox **tidak diuji** (keterbatasan lingkungan server/headless VM).

### 1. Hasil Pengujian Fungsional & Kriteria Penerimaan (AC)

| No | Item Pengujian / Acceptance Criteria | Status | Bukti Nilai / Observasi |
|---|---|---|---|
| 1 | **Regresi M1: Alur Sesi 4 Foto & Slot** | **LULUS** | 4 foto tertangkap berurutan, thumbnail 1–4 terisi (`filled`), tombol Cetak & Unduh aktif setelah selesai. |
| 2 | **Regresi M1: Tombol Batal & Tombol Esc** | **LULUS** | Saat sesi dimulai, tombol Batal tampil dan menerima fokus keyboard (`document.activeElement.id === 'btnCancel'`). Penekanan tombol `Escape` membatalkan sesi seketika, badge kembali ke `Siap`, dan fokus kembali ke tombol Mulai (`btnStart`). |
| 3 | **Regresi M1: Kamera Putus -> Sambung Ulang** | **LULUS** | Saat video track dihentikan/ended, pesan `Koneksi kamera terputus` muncul bersama tombol `Sambung ulang kamera`. Klik sambung ulang berhasil mendapatkan stream baru dan video kembali aktif. |
| 4 | **Regresi M1: Efisiensi Filter (Debounce/Cache)** | **LULUS** | Mengetik teks kustom tidak memicu filter ulang foto (`filterRunsDiff: 0`), rendering strip hanya memperbarui canvas komposit. |
| 5 | **M2 Cetak Mode 2×6 Inci (AC-06.1, AC-06.2)** | **LULUS** | `#page-size` menyetel `@page { size: 2in 6in; margin: 0; }`. `#printArea` memuat tepat 1 elemen `<img>` strip. `Page.printToPDF` menghasilkan PDF 1 halaman dengan mediabox `[0, 0, 144, 432]` pt (tepat 2×6 inci). |
| 6 | **M2 Cetak Mode 4×6 Inci & Garis Potong (AC-06.3, AC-06.4)** | **LULUS** | `#page-size` menyetel `@page { size: 4in 6in; margin: 0; }`. `#printArea` memuat 2 strip kembar berdampingan dan 1 elemen `div.cutline`. Di media print terkonfirmasi `border-left: 1px dashed rgb(181, 181, 181)` di posisi `left: 192px` (tengah 2 in / 4 in). `Page.printToPDF` menghasilkan 1 halaman mediabox `[0, 0, 288, 432]` pt (tepat 4×6 inci). |
| 7 | **M2 Pembersihan Print Area Setelah Cetak** | **LULUS** | Setelah event `afterprint` terpanggil, semua elemen di `#printArea` dibersihkan (`children.length === 0`) dan teks style `#page-size` dikosongkan. |
| 8 | **M2 Unduh PNG Bebas Garis Potong** | **LULUS** | Unduhan PNG berasal langsung dari canvas `#strip` (dimensi 600×1800 px) tanpa elemen garis potong. |
| 9 | **M2 Aksesibilitas (A11y)** | **LULUS** | Countdown memiliki `aria-live="polite"` & `aria-atomic="true"`. Shot badge memiliki `role="status"` & `aria-live="polite"`. Seluruh kontrol (`cameraSelect`, `textPreset`, `textCustom`, `fontSelect`, `printMode`, dan thumbnail 1–4) memiliki atribut `aria-label` yang deskriptif. `#printArea` memiliki `aria-hidden="true"`. |
| 10 | **M2 Swatch Frame Putih Terlihat** | **LULUS** | Chip frame Classic/Putih memiliki swatch berlatar `#ffffff` dengan border penegas `1px solid rgb(240, 217, 207)`, terlihat jelas di atas background form. |
| 11 | **M2 Favicon & Meta Description** | **LULUS** | Tag `<meta name="description">` hadir dengan deskripsi photobooth privasi. Tag `<link rel="icon">` memuat SVG data URI kuda poni photobooth (`data:image/svg+xml,...`). |
| 12 | **M2 Web Font Courier Prime 400** | **LULUS** | `document.fonts.check('400 16px "Courier Prime"')` bernilai `true`. Google Fonts mengunduh varian regular 400. |
| 13 | **M2 Catatan Privasi Footer** | **LULUS** | Teks `Foto diproses lokal di browsermu — tidak ada yang diunggah ke server mana pun.` tampil jelas di bagian footer. |
| 14 | **M2 Auto-shrink Teks Kustom (fitFont)** | **LULUS** | Teks kustom 28 karakter mengecil otomatis ke ukuran font 15px monospace dengan lebar teks 252px (muat dalam batas aman strip 508px, tidak terpotong). |
| 15 | **M2 Tampilan Responsif Mobile & Desktop** | **LULUS** | Diuji pada viewport 1280×800 (Desktop) dan 390×844 (Mobile). Tidak ada horizontal overflow/scrolling (`scrollWidth === clientWidth === 390px`). Layout bertumpuk rapi pada layar sempit. |
| 16 | **Konsol Browser & Status Kode** | **LULUS** | 0 pesan error konsol browser selama seluruh alur pengujian. Halaman dikembalikan ke state awal bersih. |

### 2. Pengujian Kode Otomatis
- **Unit Test (Vitest):** `npm test` -> 39 passed (termasuk 4 pengujian baru untuk helper printLayout M2).
- **Linting (ESLint):** `npm run lint` -> 0 errors / 0 warnings.

### 3. Daftar Temuan / Bug M2
| ID Temuan | Komponen / User Story | Langkah Reproduksi | Hasil vs Harapan | Tingkat Keparahan | Catatan |
|---|---|---|---|---|---|
| - | - | - | Tidak ditemukan bug fungsional, regresi, atau cacat tampilan pada Milestone M2. | **None** | Seluruh kriteria penerimaan M2 dan perbaikan dari review M1 terpenuhi dengan sempurna. |

### 4. Kesimpulan Milestone M2
- **Status Milestone M2:** **LULUS (PASS)**
- Seluruh perbaikan dari review M1 (L2, L5, L6, L8), fitur baru cetak 2×6 dan 4×6, garis potong, pembersihan DOM print, a11y, dan visual polish telah terverifikasi dan memenuhi standar penerimaan.
