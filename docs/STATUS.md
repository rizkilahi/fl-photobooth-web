# STATUS — photobooth-web

Fase saat ini: 3 Build M2 (menunggu mulai)

## Log Gate
- 2026-10-28 Fase 0 Intake selesai, proyek dibuat.
- 2026-10-28 [pm] Fase 1 Spesifikasi & Arsitektur selesai: docs/SPEC.md dan docs/ARCHITECTURE.md ditulis berdasarkan brief & basis kode prototipe.

- 2026-10-28 Gate 1 disetujui user: Download PNG dipertahankan, garis potong 4×6 (M2), deploy GitHub Pages (repo jadi public di Fase 5). Dev mulai M1.
- 2026-10-28 [dev] M1 selesai di branch m1-tooling-ketahanan (lint + 35 test hijau; uji browser dengan kamera tiruan). Belum merge ke main, menunggu gate M1.
- 2026-10-28 Gate M1 (user): keputusan dev (ES module wajib via server/https; Batal simpan foto yang sudah jadi; kamera putus → Sambung ulang kamera default) DISETUJUI. Courier Prime 400 diperbaiki di M2. checkJs tidak perlu. Lead verifikasi: lint bersih, 35 tes lulus, audit 0. Lanjut QA + Review M1 sebelum merge.
- 2026-10-28 QA M1: 31 cek LULUS, 0 bug (kamera tiruan; lead cek 30 tool call di sesi QA). Review M1: APPROVE WITH CHANGES (0 C/H, 2 M, 9 L). Keputusan user: L1/L4/L7 diperbaiki SEBELUM merge; M1/M2/L2/L5/L6/L8 + Courier Prime 400 ke milestone M2; L3 + L9 (deploy via GitHub Actions, artefak hanya file aplikasi) di Fase 5.
- 2026-10-28 [dev] Perbaikan review M1: L1, L4, L7 selesai di branch m1-tooling-ketahanan (lint bersih, 35 tes hijau). Belum merge ke main.
- 2026-10-28 L1/L4/L7 diperbaiki (ac86edb), lead verifikasi lint+35 tes; M1 di-merge ke main. Berikutnya: M2.
- 2026-10-28 [dev] M2 selesai di branch m2-cetak-polish (lint bersih, 49 test hijau; uji browser kamera tiruan + emulasi print 2×6/4×6 + printToPDF 1 halaman). Belum merge ke main, menunggu gate M2.
