# STATUS — photobooth-web

Fase saat ini: 3 Build M1

## Log Gate
- 2026-10-28 Fase 0 Intake selesai, proyek dibuat.
- 2026-10-28 [pm] Fase 1 Spesifikasi & Arsitektur selesai: docs/SPEC.md dan docs/ARCHITECTURE.md ditulis berdasarkan brief & basis kode prototipe.

- 2026-10-28 Gate 1 disetujui user: Download PNG dipertahankan, garis potong 4×6 (M2), deploy GitHub Pages (repo jadi public di Fase 5). Dev mulai M1.
- 2026-10-28 [dev] M1 selesai di branch m1-tooling-ketahanan (lint + 35 test hijau; uji browser dengan kamera tiruan). Belum merge ke main, menunggu gate M1.
- 2026-10-28 Gate M1 (user): keputusan dev (ES module wajib via server/https; Batal simpan foto yang sudah jadi; kamera putus → Sambung ulang kamera default) DISETUJUI. Courier Prime 400 diperbaiki di M2. checkJs tidak perlu. Lead verifikasi: lint bersih, 35 tes lulus, audit 0. Lanjut QA + Review M1 sebelum merge.
