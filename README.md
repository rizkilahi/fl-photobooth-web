# Photobooth Web

Web photobooth statis (HTML/CSS/JS murni, tanpa backend). Foto diproses di browser, tidak diunggah ke server.

## Fitur
- Kamera + hitung mundur (3/5/10 dtk), 4 jepretan otomatis, efek flash; klik thumbnail untuk foto ulang satu per satu. Tombol Spasi = mulai.
- 8 filter (Normal, Hitam Putih, Sepia, Vintage, Hangat, Pop, Noir, Pudar) — bisa diganti setelah foto diambil.
- 8 border/frame (Klasik Putih, Hitam Elegan, Pink Pastel, Krem Retro, Polkadot, Film Strip, Konfeti, Mint).
- Teks bawah: preset atau tulis sendiri, 3 gaya huruf, tanggal opsional.
- Output strip 2×6 inci @300 dpi (600×1800 px): cetak 1 strip (kertas 2×6) atau 2 strip kembar di kertas 4×6/4R, download PNG.

## Jalankan lokal
```
python3 -m http.server 8000
```
Buka http://localhost:8000 (kamera hanya jalan di `localhost` atau `https://`).

## Deploy
Folder ini bisa langsung di-deploy sebagai situs statis (GitHub Pages / Netlify / Vercel / Cloudflare Pages). Wajib HTTPS agar kamera bisa diakses.

## Tips cetak
Di dialog print: ukuran kertas sesuai pilihan, Margins: None, Scale 100%, aktifkan Background graphics.
