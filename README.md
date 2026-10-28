# Photobooth Web

Web photobooth statis (HTML/CSS/JS murni, tanpa backend). Foto diproses di browser, tidak diunggah ke server.

## Fitur
- Kamera + hitung mundur (3/5/10 dtk), 4 jepretan otomatis, efek flash; klik thumbnail untuk foto ulang satu per satu.
- 8 filter (Normal, Hitam Putih, Sepia, Vintage, Hangat, Pop, Noir, Pudar) — bisa diganti setelah foto diambil.
- 8 border/frame (Klasik Putih, Hitam Elegan, Pink Pastel, Krem Retro, Polkadot, Film Strip, Konfeti, Mint).
- Teks bawah: preset atau tulis sendiri (maks 28 karakter), 3 gaya huruf, tanggal opsional.
- Output strip 2×6 inci @300 dpi (600×1800 px): cetak 1 strip (kertas 2×6) atau 2 strip kembar di kertas 4×6/4R (dengan garis bantu potong), download PNG.

## Cara pakai
1. Buka aplikasi, izinkan akses kamera. Bila ada lebih dari satu kamera, pilih dari dropdown.
2. Pilih filter, hitung mundur, dan Mirror bila perlu.
3. Tekan **Mulai (4 foto)** atau tombol **Spasi** → 4 jepretan otomatis. **Batal** atau tombol **Esc** menghentikan sesi (foto yang sudah jadi tetap tersimpan).
4. Tidak puas dengan satu foto? Klik thumbnail-nya untuk foto ulang slot itu saja.
5. Pilih frame, teks, gaya huruf, dan tanggal. Strip langsung diperbarui.
6. **Cetak** atau **Download PNG** (aktif setelah keempat foto terisi). **Ulang semua** mengosongkan semua foto.

## Cara cetak
Pilih ukuran di "Simpan / Cetak", tekan **Cetak**, lalu di dialog cetak browser atur:

| Pengaturan | Nilai |
|---|---|
| Ukuran kertas | sama dengan pilihan (2×6 inci, atau 4×6 inci / 4R) |
| Margins | **None** |
| Scale | **100%** (jangan "Fit to page") |
| Background graphics | **aktif** (agar warna frame ikut tercetak) |

- **Strip 2×6 inci** — untuk printer yang mendukung kertas 2×6 (mis. printer photobooth/dye-sub).
- **Kertas 4×6 inci / 4R (2 strip kembar)** — untuk **printer rumahan**: cetak di kertas foto 4×6, hasilnya dua strip berdampingan; gunting mengikuti garis putus-putus abu-abu tipis di tengah. Garis ini hanya ada di cetakan 4×6 (tidak ada di mode 2×6 maupun di file PNG).
- Bila printer memaksa margin minimal, strip bisa sedikit mengecil/terpotong: gunakan mode 4×6, atau cetak PNG hasil unduhan lewat aplikasi lain dengan ukuran 2×6 inci pada 300 dpi.

## Privasi
Semua pemrosesan (kamera, filter, strip, cetak) terjadi di browser kamu. Foto **tidak diunggah ke server mana pun**, tidak disimpan, dan hilang saat tab ditutup atau tombol "Ulang semua" ditekan. Satu-satunya permintaan ke pihak luar adalah memuat font (Pacifico, Poppins, Courier Prime) dari Google Fonts, yang membuat Google menerima IP pengunjung.

## Jalankan lokal
```
python3 -m http.server 8000
```
Buka http://localhost:8000 (kamera hanya jalan di `localhost` atau `https://`). Aplikasi memakai ES module (`<script type="module">`), jadi harus dibuka lewat server HTTP — membuka `index.html` langsung via `file://` tidak jalan.

## Pengembangan (opsional, hanya dev)
```
npm install      # ESLint + Vitest (devDependencies saja; aplikasi tetap zero-build)
npm run lint
npm test
```
Fungsi murni (filter, crop, tanggal, font, pesan error, keputusan cache, layout cetak) ada di `lib.js` dan diuji di `tests/`.

### Reprodusibilitas angka `GOLDEN` filter (`tests/lib.test.js`)
Tabel `GOLDEN` pada `tests/lib.test.js` berisi nilai RGB literal dari `ctx.filter` Chromium nyata (bukan hasil rumus `lib.js`), untuk memverifikasi bahwa fallback piksel `applyFilterToData` setara dengan `ctx.filter` dalam toleransi `±2` per kanal. Untuk mengambil/memverifikasi ulang angka tersebut di Chrome/Chromium, jalankan server lokal (`python3 -m http.server 8000`), buka `http://localhost:8000`, lalu jalankan skrip berikut di DevTools Console:
```js
import("./lib.js").then(({ FILTERS, toCss }) => {
  const inputs = [[120, 80, 200], [200, 150, 100], [30, 200, 60], [240, 240, 240]];
  const src = document.createElement("canvas"), dst = document.createElement("canvas");
  src.width = src.height = dst.width = dst.height = 1;
  const sx = src.getContext("2d"), dx = dst.getContext("2d");
  const out = {};
  for (const { id, p } of FILTERS.filter((f) => f.id !== "normal")) {
    const css = toCss(p);
    out[id] = { css, rows: inputs.map(([r, g, b]) => {
      sx.fillStyle = `rgb(${r},${g},${b})`; sx.fillRect(0, 0, 1, 1);
      dx.clearRect(0, 0, 1, 1); dx.filter = css; dx.drawImage(src, 0, 0);
      return [[r, g, b], Array.from(dx.getImageData(0, 0, 1, 1).data.slice(0, 3))];
    }) };
  }
  console.log(JSON.stringify(out));
});
```

## Deploy
Folder ini bisa langsung di-deploy sebagai situs statis (GitHub Pages / Netlify / Vercel / Cloudflare Pages). Wajib HTTPS agar kamera bisa diakses.
