# REVIEW — M1 (branch m1-tooling-ketahanan)

Reviewer: profile reviewer · Tanggal: 2026-10-28
Cakupan: `git diff main...m1-tooling-ketahanan` (commit 5d7c23a, 49a92e7, 34e53f2) — app.js, lib.js,
tests/lib.test.js, index.html, style.css, README.md, package.json, package-lock.json, eslint.config.js,
vitest.config.js, docs/STATUS.md. Konteks: docs/SPEC.md (M1, AC, Keputusan Gate 1), docs/STATUS.md (Gate M1).
Tidak pindah branch, tidak build, tidak menjalankan server.

## Keputusan: APPROVE WITH CHANGES

Tidak ada temuan critical/high. Boleh merge ke main setelah gate. 2 temuan medium dan beberapa low
dijadwalkan di M2 / Fase 5 (lihat bagian Penjadwalan). Keputusan user di Gate M1 (ES module wajib via
server/https; Batal menyimpan foto yang sudah jadi; kamera putus → Sambung ulang ke kamera default;
Courier Prime 400 diperbaiki di M2; checkJs tidak perlu) dicatat sebagai info, bukan temuan.

## Bukti pemeriksaan
- `npx eslint .` → bersih (tanpa output).
- `npx vitest run` → 1 file, 35 tes lulus.
- `npm audit --audit-level=high` → found 0 vulnerabilities. Semua `resolved` di package-lock.json dari
  registry.npmjs.org (138 entri). Hanya devDependencies (eslint, @eslint/js, globals, vitest).
- Pemindaian secret pada baris tambah diff (api_key/secret/password/token/private key): tidak ada temuan
  (hanya variabel `startToken` dan string uji "secret internal path").
- Persiapan repo PUBLIC: `git log --all -p` dipindai untuk email/no. HP/token GitHub/kunci Google → bersih;
  satu-satunya identitas commit `rizkilahi <…@users.noreply.github.com>`. `git ls-files` tidak memuat
  node_modules/.env. docs/ tidak memuat path server, data BSI Maslahat, atau data pribadi.
- XSS: semua teks dinamis (teks kustom, label kamera, pesan error, badge) memakai `textContent` atau
  `fillText` di canvas. Satu-satunya `innerHTML` berisi konten hanya memakai konstanta FRAMES (lihat L5).

## Kecocokan dengan deliverable M1 / AC
- D1 tooling + lib.js murni, app.js tetap zero-build (ES module): TERPENUHI.
- D2 unit test crop 3:2, toCss, matriks piksel, seeded, tanggal/nama file: TERPENUHI (catatan kualitas M1).
- D3 cache filter per slot (`filteredCache`, app.js:117-132): TERPENUHI. Cache usang bila `filterId` beda
  atau slot di-null (`setShot`, reset). Ketik teks/frame/tanggal hanya memanggil `renderStrip` yang membaca
  cache (AC-05.2). Thumbnail dipisah dan data-URL thumbnail ikut di-cache. Raw canvas tidak diubah (AC-03.2).
- D4 deteksi ctx.filter via piksel (lib.js:108-122) + generic font fallback (lib.js:40-50): TERPENUHI.
  Ambang 20<r<120 cocok untuk merah → grayscale ≈54; gagal deteksi aman jatuh ke fallback piksel.
- D5 kunci kontrol saat busy, tombol Batal, track `ended`/`devicechange`: TERPENUHI. Alur dicek:
  - Batal saat countdown/jeda 900 ms → `sleep` reject AbortError → `finally` membuka kunci; foto yang
    sudah jadi tetap (sesuai keputusan Gate M1). Listener abort dilepas saat resolve, `once` saat abort → tanpa bocor.
  - Kamera putus saat sesi → `onCameraLost` abort sesi lalu `releaseStream` sinkron, jadi catch melihat
    `state.stream === null` dan tidak menulis "Sesi dibatalkan" (benar). Cek identitas stream mencegah
    stream lama memicu pesan. `track.stop()` sendiri tidak memicu `ended` → tidak ada loop.
  - Balapan `startCamera` ditangani token; stream yang kalah balapan di-stop (tidak bocor). Lihat L1 untuk sisa kecil.
  - Thumbnail yang dibuat ulang di tengah sesi tetap `disabled = state.busy`.
- Kebocoran sumber daya: object URL download di-revoke (2 dtk); MediaStream di-stop di setiap jalur;
  canvas lama dilepas ke GC lewat cache yang di-null. `#printArea` belum dibersihkan (deliverable M2, info).

## Temuan

M1 · medium · tests/lib.test.js:97-109 (juga pola yang sama untuk nilai parsial)
  Tes "vintage" menyalin ulang rumus matriks sepia/saturate dari lib.js:76-77 secara verbatim, jadi bila
  koefisien di lib salah, tes ikut salah dan tetap hijau (tautologis). Nilai parsial (sepia 0.4, saturate 0.8,
  grayscale <1) hanya diuji lewat salinan ini; tes independen yang ada cuma untuk nilai ujung (grayscale 1,
  sepia 1, saturate 0/1).
  Saran: ganti expected dengan golden value yang diambil dari ctx.filter browser nyata (mis. Chrome,
  `filter = "sepia(0.4) saturate(0.8) brightness(1.08) contrast(0.9)"` pada 3-5 piksel uji) dengan toleransi
  ±2, atau hitung dari spesifikasi Filter Effects dengan nilai literal. Ini sekaligus jadi bukti AC-03.3
  ("hasil visual setara").

M2 · medium · app.js:186, 198-199, 208-214 (aksesibilitas keyboard)
  Saat sesi mulai, btnStart (yang sedang fokus) di-disable dan btnCancel muncul, tapi fokus tidak dipindah;
  saat selesai, btnCancel di-hidden ketika mungkin sedang fokus. Pengguna keyboard/pembaca layar kehilangan
  fokus (jatuh ke body) dan tidak bisa langsung menekan Batal.
  Saran: di `setBusy(true)` panggil `btnCancel.focus()`; di `setBusy(false)` kembalikan fokus ke btnStart bila
  `document.activeElement` adalah btnCancel/body. Opsional: Esc = Batal di handler keydown (app.js:395).

L1 · low · app.js:72-74 (race kecil startCamera)
  Token tidak dicek ulang setelah `await video.play()`. Bila panggilan baru masuk saat itu, panggilan lama
  tetap memanggil `showCamMessage("")` (menyembunyikan "Mengaktifkan kamera…" milik panggilan baru) dan
  `listCameras()`. Hanya kosmetik; stream tidak bocor.
  Saran: `if (token !== startToken) return;` setelah `await video.play()`.

L2 · low · lib.js:54-61, tests/lib.test.js:212-218
  `fitFont` tidak pernah memakai 18px: dengan ukuran awal genap, ukuran terakhir yang dicoba 20px
  (perilaku warisan prototipe). AC-05.3 menyebut batas bawah 18px. Tes menerima 18-20 sehingga tidak
  menangkapnya. Dampak praktis nol (28 karakter muat jauh di atas 20px).
  Saran: ubah kondisi jadi `size >= 18` (atau set floor eksplisit) dan tes `toBe(18)`; atau sesuaikan AC ke 20px.

L3 · low · app.js:410
  `window.__photobooth` mengekspos state (termasuk canvas foto) secara global di build produksi. Tidak ada
  secret, dan tidak ada skrip pihak ketiga yang memuat JS, jadi risikonya rendah; tetap tidak perlu di produksi.
  Saran: pasang hanya bila `location.hostname === "localhost"` atau ada `?debug`, sebelum deploy publik (Fase 5).

L4 · low · app.js:356-361
  `strip.toBlob` bisa mengembalikan `null` (gagal encode/memori). `URL.createObjectURL(null)` akan melempar
  error tanpa pesan ke pengguna.
  Saran: `if (!blob) { alert("Gagal membuat PNG, coba lagi."); return; }`.

L5 · low · app.js:344 (warisan prototipe)
  `innerHTML` dengan interpolasi `f.bg`/`f.name`. Aman saat ini karena sumbernya konstanta FRAMES, tapi
  rawan bila kelak frame bisa dikustom.
  Saran: buat `span.swatch` lewat `createElement` + `style.background`, nama lewat `append(text)`.

L6 · low · app.js:298-314, index.html:42, index.html:79 (a11y, warisan sebagian)
  Tombol thumbnail berlabel "↻ Ulang" (4 tombol identik bagi pembaca layar; `title` tidak selalu dibacakan);
  `#cameraSelect` dan `#textCustom` tidak punya label yang terasosiasi (hanya title/placeholder).
  Badge sesi dan countdown belum `aria-live` (memang deliverable M2).
  Saran: `aria-label` per thumbnail (`Foto ulang #n` / `Ambil foto #n`), `aria-label` pada select kamera dan
  input teks, sekaligus kerjakan aria-live di M2.

L7 · low · style.css:40
  `flex-direction: column` tidak berefek karena `.cam-msg` memakai `display: grid` (kode mati). Tata letak
  sudah benar lewat grid + gap.
  Saran: hapus properti itu.

L8 · low · app.js:106-132, 181-214 (cakupan tes)
  Logika cache dan state sesi (busy/Batal/kamera putus) belum punya tes otomatis; hanya diverifikasi manual
  dengan kamera tiruan.
  Saran: pastikan QA memverifikasi `__photobooth.stats.filterRuns` (tetap saat mengetik, +4 saat ganti
  filter, +1 saat retake) dan skenario Batal/cabut kamera. Opsional: pindahkan keputusan cache
  (`needsRefilter(entry, filterId)`) ke lib.js agar bisa diuji.

L9 · low/info · deploy (Fase 5)
  GitHub Pages dari root repo akan ikut menyajikan docs/, tests/, package*.json secara publik. Tidak ada data
  sensitif saat ini (sudah dicek), tapi semua yang di-commit ke depan harus dianggap publik.
  Saran: di Fase 5 pertimbangkan deploy via GitHub Actions dengan artefak hanya index.html, app.js, lib.js,
  style.css (+ aset), atau terima apa adanya secara sadar.

Info (bukan temuan): Courier Prime 400 tidak dimuat (hanya 700) → disetujui diperbaiki di M2. Google Fonts
mengirim IP pengguna ke Google, sudah tercatat di SPEC risiko 6.

## Penjadwalan
- Sebelum merge: tidak ada yang wajib. Opsional cepat (<10 menit): L1, L4, L7.
- M2: M1 (golden value filter, bisa sekalian uji visual AC-03.3), M2 (fokus Batal/Esc), L2, L5, L6
  (bersama deliverable aria-live/aria-label), L8 (skenario QA).
- Fase 5 (sebelum repo public & deploy): L3, L9.
