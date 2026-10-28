# SPEC — photobooth-web

## Ringkasan
- **Klien:** The Uncle (`rizkilahi`) — Proyek Pribadi (dibagikan ke teman-teman lewat link publik)
- **Tujuan:** Aplikasi web photobooth berbasis browser untuk mengambil 4 foto beruntun dengan hitung mundur, menerapkan filter dan border/frame ala photobooth klasik, menambahkan teks/tanggal di footer strip, serta mencetak langsung dalam ukuran strip 2×6 inci atau kertas 4×6 inci (4R kembar).
- **Platform:** Web App Statis (prioritas Desktop/Laptop dengan webcam & printer; tampilan tetap responsif untuk layar kecil).
- **Basis Kode:** Menggunakan dan menyempurnakan kode prototipe Vanilla HTML/CSS/JS yang sudah ada di root repositori (`index.html`, `style.css`, `app.js`).
- **Deadline:** Fleksibel (target selesai dalam 2 milestone singkat, total ~7 jam kerja).
- **Budget:** Rp0 / Gratis (hosting statis gratis dengan HTTPS).

## Persona
1. **Tuan Rumah Acara / The Uncle (Pengguna Utama di Laptop/PC):**
   - Membuka aplikasi di laptop yang terhubung ke webcam (internal/eksternal) dan printer foto rumahan saat kumpul bersama teman.
   - Butuh alur yang instan tanpa login, mudah dioperasikan satu tombol (`Mulai` / tombol `Space`), bisa mengulang slot foto yang kurang pas, dan langsung mencetak hasilnya.
2. **Teman / Tamu (Pengguna Kasual via Link Publik):**
   - Mengakses link publik dari laptop masing-masing untuk seru-seruan mencoba filter/frame, lalu mencetak atau menyimpan strip foto secara lokal tanpa khawatir foto diunggah ke server.

## User Story & Status Terhadap Kode Prototipe

| ID | Fitur | Status di Kode Sekarang | Catatan Gap |
|---|---|---|---|
| US-01 | Akses kamera, pilih perangkat, mirror, & timer | **Sebagian** | Fungsi utama sudah ada (`startCamera`, `listCameras`, mirror, timer 3/5/10 dtk). Perlu penguncian kontrol saat sesi berjalan (`busy`) dan penanganan kamera dicabut/stream putus. |
| US-02 | Sesi 4 jepretan beruntun, hitung mundur, & foto ulang per slot | **Sebagian** | Alur 4 jepretan, animasi countdown/flash, retake per slot, & reset sudah ada. Perlu tombol batal sesi (Cancel) saat hitung mundur dan optimasi cache canvas. |
| US-03 | Filter foto (live preview & hasil strip) | **Sudah ada** | 8 filter (`ctx.filter` + fallback piksel `applyPixelFilter`) sudah jalan. Perlu uji kapabilitas `ctx.filter` berbasis piksel nyata untuk Safari dan cache hasil filter per slot. |
| US-04 | Pilihan border / frame strip | **Sudah ada** | 8 tema border/frame (warna solid & pola `dots`, `lines`, `film`, `confetti` deterministik) sudah lengkap dan berfungsi. |
| US-05 | Teks/brand (preset & kustom), pilihan font, & tanggal | **Sebagian** | 5 preset, input kustom (maks 28 karakter), opsi tanpa teks, 3 font, auto-fit, & tanggal sudah ada. Perlu generic font family fallback di canvas dan pencegahan filter ulang saat mengetik. |
| US-06 | Layout cetak strip 2×6 & 4×6 (4R) + tombol print (& unduh PNG) | **Sebagian** | Mode cetak 2×6 dan 4×6 (2 strip) serta unduh PNG sudah ada. Perlu garis bantu potong (cut line) pada mode 4×6 dan pembersihan DOM `#printArea` setelah print (`afterprint`). |

### Detail User Story & Acceptance Criteria (AC)

- **US-01: Sebagai pengguna, saya ingin mengaktifkan webcam, memilih perangkat kamera, mengatur efek cermin (mirror), dan memilih durasi hitung mundur sebelum memotret, agar posisi dan persiapan gaya sesuai keinginan.**
  - **AC-01.1:** Saat halaman dibuka melalui konteks aman (`https://` atau `http://localhost`), aplikasi meminta izin kamera resolusi ideal 1920×1080 dan menampilkan live preview dengan crop rasio 3:2.
  - **AC-01.2:** Jika izin kamera ditolak, tidak ada kamera, atau dibuka di non-HTTPS, area kamera menampilkan pesan instruksi yang jelas dalam Bahasa Indonesia (tidak blank/crash).
  - **AC-01.3:** Jika terdeteksi >= 2 kamera (`videoinput`), dropdown pemilih kamera muncul dan pengguna dapat berpindah kamera secara langsung.
  - **AC-01.4:** Checkbox `Mirror` membalik pratinjau video secara horizontal dan hasil tangkapan kanvas (`grabFrame`) tersimpan sesuai orientasi mirror yang dipilih.
  - **AC-01.5:** Dropdown hitung mundur menyediakan pilihan `3 detik` (default), `5 detik`, dan `10 detik`.

- **US-02: Sebagai pengguna, saya ingin mengambil 4 foto beruntun secara otomatis dengan hitung mundur visual dan bisa memotret ulang slot tertentu, agar seluruh 4 pose di strip tampak bagus tanpa harus mengulang dari awal.**
  - **AC-02.1:** Menekan tombol `Mulai (4 foto)` atau tombol `Space` (saat fokus tidak di input/select/button) menjalankan sesi 4 jepretan berurutan dengan jeda antar-jepretan ~900 ms.
  - **AC-02.2:** Selama sesi aktif (`state.busy === true`), indikator badge menampilkan progres (`Foto k / 4` atau `Foto ulang #k`), angka hitung mundur tampil di tengah kamera, dan efek kilat (`flash`) muncul saat frame diambil.
  - **AC-02.3:** Selama sesi aktif, kontrol yang dapat mengganggu sesi (tombol Mulai, Reset, slot thumbnail, pemilih kamera, mirror, timer) dinonaktifkan sementara, atau tersedia opsi membatalkan sesi berjalan.
  - **AC-02.4:** Setelah sesi selesai, keempat thumbnail menampilkan pratinjau masing-masing slot; mengeklik salah satu thumbnail hanya memotret ulang slot tersebut (`1..4`) tanpa menghapus 3 slot lainnya.
  - **AC-02.5:** Tombol `Ulang semua` meminta konfirmasi dan mengosongkan keempat slot kembali ke kondisi awal.

- **US-03: Sebagai pengguna, saya ingin memilih dan mengganti filter warna kapan saja (sebelum maupun sesudah foto diambil), agar suasana foto sesuai selera tanpa memotret ulang.**
  - **AC-03.1:** Tersedia 8 pilihan filter: `Normal`, `Hitam Putih`, `Sepia`, `Vintage`, `Hangat`, `Pop`, `Noir`, dan `Pudar`.
  - **AC-03.2:** Mengganti filter langsung memperbarui tampilan live video, keempat thumbnail yang sudah terisi, dan kanvas strip utama tanpa mengubah foto mentah (`raw canvas`) yang tersimpan.
  - **AC-03.3:** Pada browser yang tidak mendukung `CanvasRenderingContext2D.filter` secara fungsional, aplikasi otomatis menggunakan pengolahan piksel matriks (`applyPixelFilter`) dengan hasil visual yang setara.

- **US-04: Sebagai pengguna, saya ingin memilih desain border/frame strip photobooth, agar tampilan cetakan memiliki tema warna atau motif yang menarik.**
  - **AC-04.1:** Tersedia 8 pilihan frame: `Klasik Putih`, `Hitam Elegan`, `Pink Pastel` (polkadot), `Krem Retro` (garis tepi ganda), `Polkadot` (biru tua-kuning), `Film Strip` (lubang klise), `Konfeti` (taburan warna deterministik), dan `Mint`.
  - **AC-04.2:** Mengganti frame langsung merender ulang latar strip beserta warna teks footer (`ink` dan `sub`) yang kontras terhadap warna frame.

- **US-05: Sebagai pengguna, saya ingin mengatur teks/brand pada bagian bawah (footer) strip menggunakan preset atau ketikan sendiri, memilih gaya huruf, dan menampilkan/menyembunyikan tanggal, agar cetakan memiliki identitas acara.**
  - **AC-05.1:** Dropdown teks menyediakan 5 preset (`Photobooth`, `Best Friends Forever`, `Kenangan Kita`, `Happy Birthday!`, `Say Cheese!`), opsi `Tulis sendiri…`, dan opsi `(tanpa teks)`.
  - **AC-05.2:** Saat `Tulis sendiri…` dipilih, input teks kustom muncul (maksimal 28 karakter) dan setiap perubahan teks langsung tercermin di footer strip tanpa lag (tanpa memfilter ulang piksel foto).
  - **AC-05.3:** Jika teks panjang melebihi lebar area foto (`PHOTO_W - 20`), ukuran font otomatis mengecil secara proporsional (`fitFont`, batas bawah 18px) agar tidak terpotong.
  - **AC-05.4:** Tersedia 3 pilihan gaya font (`Pacifico` / Script, `Poppins` / Modern, `Courier Prime` / Mesin ketik) dengan fallback font sistem (`cursive`, `sans-serif`, `monospace`) jika font eksternal gagal dimuat.
  - **AC-05.5:** Checkbox `Tanggal` menampilkan/menyembunyikan tanggal hari ini dengan format `DD . MM . YYYY` di bawah teks utama (atau di tengah footer bila tanpa teks).

- **US-06: Sebagai pengguna, saya ingin mencetak strip foto dalam ukuran standar photobooth 2×6 inci atau kertas foto 4×6 inci (4R kembar), agar langsung bisa dicetak di printer foto maupun printer rumahan.**
  - **AC-06.1:** Kanvas strip dirender pada resolusi cetak tajam `600 × 1800 px` (setara `2 × 6 inci @ 300 DPI`) dengan 4 foto berukuran `528 × 352 px` (rasio 3:2).
  - **AC-06.2:** Tombol `Cetak` hanya aktif setelah keempat slot foto terisi penuh dan sesi pemotretan tidak sedang berjalan.
  - **AC-06.3:** Mode `Strip 2×6 inci (1 strip)` mengatur `@page { size: 2in 6in; margin: 0; }` dan menyiapkan 1 gambar strip di `#printArea` sebelum memanggil dialog `window.print()`.
  - **AC-06.4:** Mode `Kertas 4×6 inci / 4R (2 strip kembar)` mengatur `@page { size: 4in 6in; margin: 0; }` dan menyiapkan 2 gambar strip berdampingan di `#printArea` (dilengkapi penanda/garis bantu potong tipis) sebelum memanggil `window.print()`.
  - **AC-06.5:** **[USULAN DIPERTAHANKAN]** Tombol `Download PNG` mengunduh hasil strip (`600 × 1800 px`) dengan nama file berformat `photobooth-YYYYMMDD-HHMMSS.png`.

## Scope

### In-Scope (Termasuk dalam Proyek)
- Pemeliharaan dan penyempurnaan basis kode prototipe Vanilla HTML/CSS/JS (`index.html`, `style.css`, `app.js`).
- Pemotretan 4 pose beruntun dari webcam + hitung mundur (3/5/10 dtk) + mirror + pilih kamera + foto ulang per slot.
- 8 filter warna (live video + canvas strip dengan fallback piksel).
- 8 variasi border/frame strip.
- Kustomisasi footer strip: preset teks, teks bebas (maks 28 karakter), tanpa teks, 3 pilihan font, dan toggle tanggal.
- Mode cetak `2×6 inci` (1 strip) dan `4×6 inci / 4R` (2 strip kembar) via dialog cetak browser + instruksi pengaturan margin/skala.
- **[USULAN]** Mempertahankan tombol `Download PNG` yang sudah ada di prototipe.
- Tooling kualitas ringan (ESLint + Vitest untuk fungsi logika murni) tanpa mengubah sifat zero-build aplikasi saat dideploy.
- Konfigurasi kesiapan deploy statis HTTPS.

### Out-of-Scope (Di Luar Lingkup Proyek)
- Unggah foto dari galeri/file lokal.
- Akun pengguna, login, database, atau penyimpanan foto di server/cloud.
- Galeri online publik atau fitur berbagi langsung ke media sosial / QR code generator berbasis server.
- Stiker drag-and-drop bebas, kuas gambar (doodle), atau pembuatan animasi GIF/video Boomerang.
- Integrasi hardware printer kasir/kiosk otomatis tanpa dialog browser (silent printing via native bridge).

## Milestone

- **M1 — Tooling Kualitas, Optimasi Render & Perbaikan Ketahanan Kamera/Filter (Estimasi: 4 jam)**
  - **Deliverable:**
    1. Setup `package.json` (hanya `devDependencies`: ESLint & Vitest) + pemisahan/ekspor fungsi murni yang dapat diuji tanpa merusak jalannya `app.js` langsung di browser tanpa bundler.
    2. Unit test untuk logika perhitungan rasio crop 3:2, generator CSS filter (`toCss`), matriks filter piksel (`applyPixelFilter`), PRNG deterministik (`seeded`), dan format tanggal/nama file.
    3. Caching kanvas hasil filter per slot foto (`filteredCache`) agar perubahan teks/frame/tanggal merender strip secara instan tanpa memproses ulang piksel 4 foto di setiap ketukan huruf.
    4. Deteksi dukungan `ctx.filter` berbasis uji piksel nyata (mengatasi quirk Safari) serta penambahan generic font family fallback pada canvas (`cursive`, `sans-serif`, `monospace`).
    5. Penguncian seluruh kontrol kamera/timer/mirror selama sesi pemotretan berjalan (`state.busy`), tombol batal sesi (Cancel), dan penanganan event kamera dicabut (`devicechange` / track `ended`).
  - **Target Demo:** `npm run lint` dan `npm test` hijau; sesi foto, retake, pembatalan, fallback filter, dan pengetikan teks kustom berjalan mulus.

- **M2 — Penyempurnaan Layout Cetak (2×6 & 4×6), UI/UX Polish & Kesiapan Deploy Statis HTTPS (Estimasi: 3 jam)**
  - **Deliverable:**
    1. Penyempurnaan mode cetak `4×6 (2 strip kembar)` dengan opsi/garis bantu potong tipis di tengah, aturan CSS `@media print` yang lebih tangguh, dan pembersihan memori `#printArea` pada event `afterprint`.
    2. Perbaikan detail UI/aksesibilitas (kontras swatch frame putih pada tombol chip, atribut `aria-label`/`aria-live` pada hitung mundur, favicon SVG, meta deskripsi).
    3. Konfigurasi siap deploy statis HTTPS (header `Permissions-Policy: camera=(self)` / konfigurasi host statis) dan dokumentasi cara pakai/cetak di `README.md`.
  - **Target Demo:** Verifikasi visual UI dan emulasi cetak (`@media print`) untuk ukuran 2×6 dan 4×6 lolos uji QA (dogfood) dan code review, siap dideploy ke host HTTPS pilihan.

## Asumsi & Risiko Teknis Spesifik

### Asumsi
1. **[ASUMSI]** Pengguna mengakses aplikasi melalui browser modern (Chrome, Edge, Firefox, atau Safari versi terkini) di laptop/PC yang memiliki webcam dan terhubung ke printer.
2. **[ASUMSI]** Aplikasi dideploy pada layanan hosting statis yang menyediakan sertifikat SSL/HTTPS otomatis (wajib untuk API `navigator.mediaDevices.getUserMedia`).
3. **[ASUMSI]** Untuk printer rumahan yang tidak mendukung ukuran kertas khusus `2×6 inci`, pengguna akan memakai kertas foto `4×6 inci (4R)` dengan mode `2 strip kembar` lalu mengguntingnya menjadi dua.
4. **[ASUMSI]** Fitur `Download PNG` yang sudah ada di prototipe tetap dipertahankan sebagai fitur pelengkap tanpa biaya tambahan.

### Risiko Teknis & Mitigasi
1. **Izin Kamera & Keharusan HTTPS (`getUserMedia`):**
   - *Risiko:* Browser memblokir akses `navigator.mediaDevices.getUserMedia` jika halaman dibuka lewat `http://` (selain `localhost`) atau jika pengguna menolak prompt izin kamera.
   - *Mitigasi:* Wajib deploy di host ber-HTTPS; tampilkan pesan panduan pemulihan izin kamera yang jelas di `#camMsg` ketika terjadi `NotAllowedError`, `NotFoundError`, atau `NotReadableError` (mis. kamera sedang dipakai aplikasi Zoom/Meet).
2. **Kompatibilitas `ctx.filter` di Safari / WebKit:**
   - *Risiko:* Safari versi tertentu mengekspos properti `ctx.filter` sebagai string namun mengabaikannya saat `drawImage`, atau tidak mendukungnya sama sekali sehingga foto di strip tidak terfilter meski preview video terfilter.
   - *Mitigasi:* Jangan hanya mengandalkan `typeof ctx.filter === "string"`; lakukan uji gambar piksel 1×1 pada saat inisialisasi untuk memverifikasi apakah `ctx.filter = "grayscale(1)"` benar-benar mengubah nilai RGB. Jika gagal, otomatis gunakan `applyPixelFilter()` berbasis `ImageData`.
3. **Akurasi Ukuran Cetak 2×6 Inci & Perilaku Driver Printer:**
   - *Risiko:* Aturan CSS `@page { size: 2in 6in; margin: 0; }` tidak selalu dipatuhi oleh semua driver printer (banyak printer inkjet rumahan memaksa margin minimum ~3–5 mm atau hanya mengenali kertas 4R/A4), sehingga strip bisa terpotong atau mengecil (*fit to page*).
   - *Mitigasi:* Sediakan mode `4×6 inci / 4R (2 strip kembar)` sebagai solusi paling kompatibel untuk printer foto rumahan; kunci dimensi `#printArea img` dalam satuan fisik (`2in × 6in`) dengan `print-color-adjust: exact`; tampilkan panduan singkat di UI untuk menyetel *Margins: None* dan *Scale: 100%* pada dialog print.
4. **Ketersediaan Font Google Saat Cetak atau Koneksi Lambat/Offline:**
   - *Risiko:* Font `Pacifico`, `Poppins`, dan `Courier Prime` dimuat dari Google Fonts. Jika internet lambat/terputus saat halaman dibuka, kanvas (`sctx.font`) bisa merender teks menggunakan font default sistem dengan ukuran yang meleset.
   - *Mitigasi:* Gunakan `document.fonts.load(...)` dengan timeout/catch yang aman sebelum merender ulang strip, dan selalu sertakan generic font family fallback pada string font kanvas (`"Pacifico", cursive`, `"Poppins", system-ui, sans-serif`, `"Courier Prime", monospace`).
5. **Konsumsi Memori & CPU Kanvas pada Perangkat Spesifikasi Rendah:**
   - *Risiko:* Menyimpan 4 kanvas mentah (`1056 × 704 px`) dan membuat ulang 8 kanvas sementara + `toDataURL` setiap kali `renderStrip()` dipanggil (termasuk saat mengetik huruf demi huruf di kolom teks kustom) dapat memicu lonjakan CPU dan *garbage collection* (terutama bila jalur `applyPixelFilter` aktif).
   - *Mitigasi:* Pisahkan `renderStrip()` dari `renderThumbs()`; simpan cache kanvas yang sudah difilter (`528 × 352 px`) per slot dan hanya hitung ulang ketika foto baru diambil atau filter diganti; bersihkan elemen `<img>` data-URL di `#printArea` setelah dialog cetak ditutup (`afterprint`).
6. **Privasi Pengguna:**
   - *Risiko:* Kekhawatiran pengguna/teman bahwa foto wajah mereka tersimpan di server publik saat mengakses link bersama.
   - *Mitigasi:* Seluruh pemrosesan dilakukan 100% di memori browser sisi klien (tanpa pemanggilan API eksternal selain pemuatan file statis dan Google Fonts); foto langsung hilang saat tab ditutup atau di-reset; tambahkan keterangan privasi singkat di footer/UI.

## Pertanyaan untuk Klien (The Uncle)

1. **Mempertahankan Tombol `Download PNG`:**
   - Di form intake awal fitur unduh tidak dipilih, tetapi di kode prototipe tombol `Download PNG` sudah berfungsi penuh. Apakah tombol ini tetap dipertahankan di samping tombol `Cetak`?
   - *Saran jawaban:* **Ya, pertahankan**, karena sangat membantu bila teman membuka link dari perangkat yang sedang tidak terhubung ke printer atau ingin menyimpan salinan digitalnya.
2. **Garis Bantu Potong pada Mode Kertas 4×6 (4R Kembar):**
   - Pada mode cetak 4×6 inci (2 strip berdampingan), apakah ingin ditambahkan garis bantu potong tipis (putus-putus abu-abu muda) di bagian tengah antara kedua strip agar mudah digunting lurus?
   - *Saran jawaban:* **Ya, tambahkan garis bantu potong tipis** khusus di mode cetak 4×6.
3. **Pilihan Platform Deploy Statis Gratis (Fase 5):**
   - Untuk deploy publik nanti, apakah lebih memilih **GitHub Pages** (langsung dari repo `rizkilahi/fl-photobooth-web`), **Cloudflare Pages**, atau **Vercel/Netlify**?
   - *Saran jawaban:* **GitHub Pages** atau **Cloudflare Pages** (keduanya gratis, mendukung HTTPS otomatis, dan sangat cepat untuk situs statis murni tanpa backend).
