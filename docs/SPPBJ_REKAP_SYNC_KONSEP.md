# Konsep: Sync SPPBJ Pengadaan → Spreadsheet "REKAP PJK KAPAL PERBULAN"

Status: **KONSEP — belum diimplementasi.** Tujuan: tiap pengadaan SPPBJ dari app otomatis
terisi ke Google Sheet rekap, ke tab BULAN sesuai tanggal (format `07. JUL 26`), sesuai kolom yg ada.

## Fakta kunci
- Sheet PRIVAT (gviz baca anon -> 404). Nulis butuh akses level PEMILIK. Tak bisa pakai anon/gviz.
- Spreadsheet id: `1H7gBe_G77e-CcoAWOJ20XrfOYt0lhHRN2b9Z5Q9Pzi8`.
- Tab bulanan: format `NN. MMM YY` (mis. `07. JUL 26`). Penamaan lama tak konsisten
  (`01 JAN`, `06. JUN 25`) -> pencocokan harus fuzzy (bulan+tahun, abaikan titik/spasi).
- Header (baris 2), data mulai baris 4. Kolom A..K:
  A NO · B NOMOR SPPBJ (1) · C NAMA PEKERJAAN (7) · D FILE EXCEL · E KET. (dropdown) ·
  F NOMOR PR (SAP) (2) · G TANGGAL SPPBJ/PR (3) · H NILAI SPPBJ/PR BLM PPN (4) ·
  I NILAI SPBJ/PO BLM PPN (5) · J NOMOR PO (12) · K NOMOR GR/SES (13)
- KET. dropdown: DOCKING(BIAYA) · DOCKING (INVESTASI) · RUTIN · INVESTASI DILUAR DOCKING.

## Arsitektur (rekomendasi): Apps Script Web App (webhook)
Alasan: sheet privat + butuh buat/format tab + dropdown -> paling bersih dijalankan sebagai
PEMILIK sheet. Tak perlu share ke service account, tak perlu OAuth, jalan dari Vercel.
- User deploy Google Apps Script (kode disediakan) terikat ke spreadsheet -> "Deploy as Web App"
  (Execute as: Me, Access: Anyone with link). Dapat URL + kita pakai SECRET token.
- App: route `POST /api/sppbj/rekap-sync` -> fetch URL Apps Script kirim JSON {secret, rows}.
- Apps Script: per row -> tentukan tab bulan (fuzzy match / buat baru dari template) ->
  cari baris by NOMOR SPPBJ (UPSERT: update bila ada, append bila belum) -> tulis A..K +
  set dropdown KET + format angka.
- Env app: `REKAP_GAS_URL`, `REKAP_GAS_SECRET`.

Alternatif: Service Account + Sheets API (share sheet ke email SA sbg Editor, simpan JSON key di
env). Lebih ribet setup & kelola kredensial; logika tab/format ditulis di app. Tak direkomendasikan.

## Pemetaan kolom (usulan — perlu konfirmasi)
| Kolom sheet | Sumber app |
|---|---|
| NO | urut otomatis di sheet |
| NOMOR SPPBJ (1) | `noSPPBJ` (atau nomor PR SAP — KONFIRM) |
| NAMA PEKERJAAN | `namaPengadaan` |
| FILE EXCEL | (kosong dulu; nanti bisa link file generate) |
| KET. | Kategori Rekap (field baru dropdown 4 nilai) |
| NOMOR PR (SAP) | `noDRP` (nomor 2000xxxxxx) — KONFIRM |
| TANGGAL SPPBJ/PR | `tanggal` -> "7 Juli 2026" |
| NILAI SPPBJ/PR BLM PPN | total estimasi (Σ harga×jumlah) |
| NILAI SPBJ/PO BLM PPN | total final (Σ hargaSpbj×jumlah) |
| NOMOR PO | No Kontrak / `noSpbjNum` |
| NOMOR GR/SES | (kosong) |

## Yang perlu ditambah di app
- Field **"Kategori Rekap"** (dropdown) di form SPPBJ: DOCKING(BIAYA) / DOCKING (INVESTASI) /
  RUTIN / INVESTASI DILUAR DOCKING -> isi kolom KET. akurat (app tak bisa tebak docking/rutin sendiri).
- Tombol **"Kirim ke Rekap"** di detail pengadaan + **"Sync bulan ini"** (bulk) di /sppbj.
- Upsert by NOMOR SPPBJ -> re-sync menimpa (idempoten, tak dobel).

## Alur
1. User isi/simpan pengadaan (+ pilih Kategori Rekap).
2. Klik "Kirim ke Rekap" -> app POST ke route -> route POST ke Apps Script.
3. Apps Script tulis ke tab bulan sesuai `tanggal`. Selesai -> app tampil status sukses + link tab.

## Pertanyaan terbuka
1. Metode: Apps Script webhook (rekomendasi) vs Service Account?
2. KET.: field dropdown baru di app (akurat) vs coba tebak otomatis dari mata anggaran+nama?
3. NOMOR SPPBJ (B) & NOMOR PR SAP (F): di screenshot sama (2000070520). Dua-duanya dari `noDRP`?
   atau B=`noSPPBJ`, F=`noDRP`?
4. Trigger: tombol manual per pengadaan + bulk, atau otomatis saat simpan?
5. Tab belum ada di bulan itu: auto-buat dari template (copy header+format+dropdown) — tab template
   mana yg jadi acuan format?
