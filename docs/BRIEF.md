# BRIEF — photobooth-web

Sumber: intake dengan The Uncle (Discord, 2026-10-28).

## Konteks
- Proyek **pribadi** (bukan klien). Akan **dideploy** supaya bisa dibagikan ke teman-teman (akses lewat link publik).
- Permintaan awal: "web ala-ala photobooth, bisa nambahin filter, border, terus bisa diprint out layoutnya ala-ala photobooth".

## Platform & Perangkat
- Web app, dipakai di **laptop/PC dengan webcam + printer**.
- HP/tablet: tidak diprioritaskan [ASUMSI: tampilan tetap layak/responsif, tapi tidak diuji mendalam].

## Fitur MVP
1. Ambil foto dari kamera + hitung mundur, beberapa jepretan (4 foto per sesi). [DIKONFIRMASI]
2. Filter foto (mis. hitam-putih, sepia, vintage). [DIKONFIRMASI — dari permintaan awal]
3. Border/frame strip. [DIKONFIRMASI — dari permintaan awal]
4. Layout cetak ala photobooth + tombol print. [DIKONFIRMASI — dari permintaan awal]
5. Teks/brand di border: **opsional, bebas diketik, ada pilihan preset**. [DIKONFIRMASI]

Catatan: di form intake user hanya mencentang fitur kamera, tetapi filter, border, dan cetak disebut eksplisit di permintaan awal sehingga tetap masuk scope.

## Layout Cetak
- Utama: **strip 2×6 inci, 4 foto vertikal** (klasik photobooth). [DIKONFIRMASI]
- [ASUMSI] Opsi tambahan 2 strip kembar di kertas 4×6/4R untuk printer rumahan yang tak mendukung kertas 2×6.

## Scope-out (tidak dipilih)
- Download PNG / unggah foto dari galeri — tidak dipilih di intake. [ASUMSI: download PNG boleh diusulkan PM sebagai nice-to-have karena murah; tunggu keputusan gate]
- Akun/login, galeri online, penyimpanan foto di server, berbagi ke media sosial.

## Kebutuhan Non-fungsional [ASUMSI]
- Privasi: foto diproses di browser, tidak diunggah ke server.
- Wajib HTTPS saat deploy (syarat akses kamera).
- Biaya hosting gratis (pribadi). Target deploy diputuskan di Fase 5 (kandidat: Netlify/Vercel/Cloudflare Pages/GitHub Pages).
- Browser target: Chrome/Edge terbaru di desktop; Firefox/Safari sebaik mungkin.

## Referensi
- Prototipe cepat (dibuat lead sebelum alur tim, vanilla HTML/JS): `~/work/freelance/_arsip/photobooth-web-prototipe/` — boleh dibaca sebagai referensi UX/layout (strip 600×1800 px @300dpi, 8 filter, 8 frame, mode cetak 2×6 & 4×6). **Bukan** basis kode; tim menentukan stack sendiri.
