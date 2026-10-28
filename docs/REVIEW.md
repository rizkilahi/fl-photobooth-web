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

---

# REVIEW — M2 (branch m2-cetak-polish)

Reviewer: profile reviewer · Tanggal: 2026-10-28
Cakupan: `git diff main...m2-cetak-polish` (a4fde75, e1f43c5, b04578c) — app.js, lib.js, index.html, style.css,
tests/lib.test.js, README.md, docs/STATUS.md. Konteks: SPEC (M2, Keputusan Gate 1), REVIEW M1, STATUS (Gate M2 =
info). Tidak pindah branch, tidak build, tidak menjalankan server/browser.

## Keputusan: APPROVE WITH CHANGES

Tidak ada temuan critical/high. 1 medium (M2-M1, regresi potensial shortcut Spasi di Firefox akibat pemindahan
fokus) sebaiknya diperbaiki/diverifikasi sebelum merge; sisanya low. Keputusan Gate M2 (garis potong di batas
strip, favicon inline, font hanya weight terpakai, catatan privasi Google Fonts) dicatat sebagai info.

## Bukti pemeriksaan
- `npx eslint .` → bersih. `npx vitest run` → 49 tes lulus. `npm audit --audit-level=high` → 0 vulnerabilities.
- Pemindaian baris tambah diff (api key/secret/password/token/path /home/email/private key): tidak ada temuan.
  `git ls-files` hanya file aplikasi, docs, tests, config (tanpa .env/node_modules). Siap dianggap publik.
- Independensi golden test: skrip uji terpisah menjalankan `applyFilterToData` lib.js terhadap tabel GOLDEN
  (7 filter × 4 piksel = 84 kanal): 37 kanal sama, 44 beda 1, 3 beda 2, semua lib ≥ golden (bias +1 konsisten
  dengan pembulatan per tahap di Chrome). Angka yang tidak identik dengan output lib = bukti kuat nilainya TIDAK
  diturunkan dari rumus lib.js. `toCss(p)` juga dipaku ke string yang sama → tes menghubungkan string app dan golden.
- XSS: `innerHTML` berisi konten sudah hilang; sisa `innerHTML = ""` (app.js:85, 305) hanya pengosongan.
  `sw.style.background = f.bg` dari konstanta FRAMES. `@page` dibangun dari `printLayout` dengan lookup
  `PRINT_MODES[mode]` + fallback (nilai select tak dikenal/`__proto__` → 2×6), tidak ada interpolasi input pengguna.
- Privasi: footer index.html:112 dan README akurat terhadap kode (satu-satunya request pihak luar = Google Fonts).

## Status tindak lanjut temuan M1
- M1 (golden filter) — BERES. tests/lib.test.js:98-122: nilai literal Chrome, toleransi ±2, 7 filter non-identitas,
  termasuk piksel jenuh & near-white (clamp). Lihat M2-L3 untuk catatan reprodusibilitas.
- M2 (fokus Batal/Esc) — BERES secara fungsi (app.js:210-220, 426), tapi memunculkan risiko baru M2-M1.
- L1, L4, L7 — sudah beres di M1 (ac86edb).
- L2 (fitFont 18px) — BERES. lib.js:52-63 floor eksplisit; tes `toBe(18)`, ganjil, <18, batas tepat 18/20.
- L3 (`window.__photobooth`, kini app.js:440) — TERBUKA, dijadwalkan Fase 5 (bukan blocker).
- L5 (innerHTML chip) — BERES. app.js:351-353 createElement + textNode.
- L6 (a11y label) — BERES. aria-label thumbnail (app.js:310-311), cameraSelect, textCustom, + textPreset,
  fontSelect, printMode; countdown `aria-live=assertive`, badge `role=status` (index.html:28, 31).
- L8 (cakupan tes cache/sesi) — SEBAGIAN, diterima. `needsRefilter` pindah ke lib.js:68 dan diuji. Tes
  "simulasi" (tests/lib.test.js:270-281) memakai harness tiruan getFiltered, jadi wiring app.js (setShot/reset
  meng-null cache) tetap diverifikasi QA via `stats.filterRuns`; state sesi tetap uji manual.
- L9 (artefak deploy) — TERBUKA, Fase 5.
- Info M1 Courier Prime 400 — BERES (index.html:12, FONT_LOADS app.js:402).

## Kecocokan deliverable M2
- D1 cetak: `@page` dinamis benar (2in×6in / 4in×6in, margin 0, diuji printLayout). Garis potong hanya dibuat
  bila `layout.cutLine` (4×6) dan `.cutline` default `display:none` di luar print; canvas/PNG tidak tersentuh.
  Posisi `left: 2in` tepat di batas strip (keputusan Gate M2). `afterprint` mengosongkan img + `@page`.
  CSS print: semua anak body selain #printArea disembunyikan, img dikunci 2in×6in, color-adjust exact.
- D2 UI/a11y: swatch border #767676 (≥3:1 WCAG 1.4.11), aria-live, favicon SVG inline, meta description. OK.
- D3 deploy/README: cara pakai/cetak/privasi lengkap. `Permissions-Policy` tidak bisa diset di GitHub Pages
  (Keputusan Gate 1) → tidak ada tindakan; benar tidak memakai `_headers`.

## Temuan baru

M2-M1 · medium · app.js:218 + app.js:427-429 (fokus vs shortcut Spasi, Firefox)
  Spasi memulai sesi di `keydown`; `setBusy(true)` langsung memindah fokus ke btnCancel. Firefox punya perilaku
  lama "keyup Spasi mengklik tombol yang sedang fokus walau keydown terjadi di elemen lain" (Bugzilla 384601,
  1595746). Akibatnya di Firefox, menekan Spasi bisa memulai sesi lalu langsung membatalkannya (AC-02.1 gagal).
  Belum bisa diverifikasi di sini (tanpa browser); uji dev di Chrome tidak akan menangkapnya.
  Saran: jalankan shortcut di `keyup` (di `keydown` cukup `preventDefault()` agar halaman tidak scroll), atau
  tunda `btnCancel.focus()` sampai keyup Spasi. Minta QA cek di Firefox: Spasi dari body → sesi berjalan penuh.

M2-L1 · low · app.js:382-398 (print ganda)
  `print()` async tanpa penjaga. Klik Cetak dua kali cepat: panggilan pertama membuka dialog dengan gambar
  panggilan kedua, `afterprint` mengosongkan area, lalu panggilan kedua memanggil `window.print()` lagi → dialog
  kedua berisi halaman kosong.
  Saran: flag `printing` (return bila true; reset di afterprint/finally) atau disable btnPrint selama print().

M2-L2 · low · style.css:103, app.js:424 (Ctrl+P / menu Print browser)
  Cetak lewat Ctrl+P/menu tanpa tombol Cetak: semua elemen disembunyikan dan #printArea kosong → halaman kosong.
  Sebelumnya juga kosong (`.app` disembunyikan), jadi bukan regresi.
  Saran: sembunyikan app hanya bila ada isi, mis. `body:has(#printArea:not(:empty)) > *:not(#printArea)`,
  atau handler `beforeprint` yang menampilkan pesan "Gunakan tombol Cetak".

M2-L3 · low · tests/lib.test.js:98-104 (reprodusibilitas golden)
  Nilai golden independen (terbukti di atas), tapi cara pengambilannya hanya ada di komentar; toleransi ±2
  sama dengan selisih maksimum yang teramati (3 kanal = 2), jadi margin nol bila Chrome berubah pembulatan.
  Saran: commit skrip/halaman pengambil (mis. tests/golden/capture.html) agar bisa diulang, atau catat langkah
  persisnya di README bagian pengembangan. Toleransi biarkan ±2 (lebih longgar melemahkan deteksi koefisien salah).

M2-L4 · low · app.js:47-52, 219 (fokus pasca sesi tidak kontekstual)
  Setelah sesi selesai fokus selalu ke btnStart. Saat kamera putus, tindakan yang relevan adalah "Sambung ulang"
  (btnStart hanya memunculkan alert "Kamera belum aktif"). Saat retake via thumbnail, pengguna keyboard harus
  Tab kembali ke grid thumbnail.
  Saran: bila `!state.stream` fokus ke btnReconnect; untuk retake tunggal fokus ke thumbnail slot yang sama
  (setelah renderThumbs).

M2-L5 · low · app.js:375-380, 424 (waktu afterprint lintas browser — item QA)
  Di Chrome/Edge `window.print()` memblokir sehingga `afterprint` aman. Di Safari/Firefox (pratinjau cetak
  asinkron) belum diverifikasi bahwa pengosongan #printArea tidak mendahului snapshot cetak.
  Saran: QA cek pratinjau cetak 2×6 dan 4×6 di Firefox (dan Safari bila ada) tidak kosong. Bila bermasalah,
  kosongkan area di awal print berikutnya saja atau tunda pembersihan (`setTimeout` ~1 dtk).

Info (bukan temuan): countdown `aria-live=assertive` membacakan tiap detik (10 kali untuk timer 10 dtk) — sesuai
tujuan, cukup. Bias +1 fallback piksel vs Chrome tidak terlihat secara visual (AC-03.3 terpenuhi).

## Penjadwalan
- Sebelum merge: M2-M1 (ubah shortcut Spasi ke keyup, ~5 menit) atau minimal QA membuktikan tidak terjadi di
  Firefox. Opsional cepat: M2-L1.
- QA M2: skenario M2-M1 (Firefox), M2-L5 (pratinjau cetak Firefox/Safari), filterRuns (L8).
- Fase 5 / opsional: M2-L2, M2-L3, M2-L4, plus L3 dan L9 dari M1.
