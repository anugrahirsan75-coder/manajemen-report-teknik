# Konsep: Kendali Anggaran Rutin Bulanan (anti-overbudget + efisiensi)

Status: **KONSEP — belum diimplementasi.** Masalah pemilik: tiap bulan ada "Persetujuan Rutin
Kapal" (pagu perawatan rutin, dipecah per Mata Anggaran). SPPBJ rutin sepanjang bulan memakai
pagu itu. Mau: (1) tak overbudget, (2) lihat efisiensi/serapan.

## Inti masalah
- Ada PAGU (plafon) rutin per BULAN, dipecah per MATA ANGGARAN (dari dokumen Persetujuan Rutin).
  Contoh Juli: Akomodasi 102.066.000, Fumigasi 3.500.000, Kapal Ro-Ro ..., Pelumas ...,
  Pengangkutan Pelumas ..., Permesinan & Kelistrikan 156.379.140, Sertifikasi Docking ...
  (EVALUASI PROGRAM PERAWATAN BULAN INI = 118.715.000).
- REALISASI = SPPBJ kategori RUTIN yang terjadi bulan itu, per Mata Anggaran.
- Butuh: sisa pagu real-time + peringatan sebelum overbudget + rapor serapan/efisiensi.

## Data model (baru)
```ts
interface PlafonRutin {
  bulan: string;                 // "YYYY-MM"
  nilai: Record<string, number>; // kodeMA -> pagu rutin bulan itu
  catatan?: string;
}
```
Simpan bareng RKA/RR di Supabase `projects.payload.kind='anggaran'` (tambah field `plafon: PlafonRutin[]`).

REALISASI dihitung on-the-fly dari `pengadaan` (SPPBJ) yang:
- `kategoriRekap` mengandung "RUTIN", DAN
- bulan(tanggal) === bulan plafon, DAN dikelompokkan per kodeMA (dari mataAnggaran pengadaan).
Nilai = final SPBJ (Σ hargaSpbj×qty) bila ada, else estimasi (Σ harga×qty).

## Tampilan Dashboard — tab/section "Anggaran Rutin"
Pilih bulan → tabel per Mata Anggaran:
| Mata Anggaran | Pagu | Terpakai | Sisa | % Serap | Status |
- Status: 🟢 aman (<80%) · 🟡 waspada (80–100%) · 🔴 OVERBUDGET (>100%, sisa merah).
- Baris TOTAL: total pagu vs terpakai vs sisa + % serap keseluruhan.
- KPI cards: Total Pagu · Terpakai · Sisa · % Serapan.
- Bar per MA (pagu vs terpakai) — langsung kelihatan mana mepet/lewat.
- Daftar pengadaan RUTIN bulan itu (yang mengkonsumsi) per MA — bisa telusur.

## Guardrail anti-overbudget (di form SPPBJ)
Saat isi SPPBJ kategori RUTIN + pilih Mata Anggaran + tanggal:
- Tampil indikator LIVE: "Sisa pagu RUTIN {MA} {bulan} = Rp X".
- Saat Simpan/Kirim: bila (nilai pengadaan) > sisa pagu → PERINGATAN:
  "Pengadaan Rp A, sisa pagu Rp B → overbudget Rp C. Lanjut?" (soft, bisa lanjut — fleksibilitas approval).

## Metrik efisiensi
- **% Serapan** = terpakai / pagu (target tinggi tanpa lewat).
- **Sisa** (bisa dialihkan / hemat).
- **Tren antar bulan**: mini-chart % serapan tiap bulan → pola boros/hemat.
- **MA boros vs hemat**: sorting % serapan.
- **Proyeksi** (bila tengah bulan): laju pemakaian × sisa hari → prediksi akhir bulan vs pagu.

## Input pagu
- Manual: pilih bulan → isi pagu per MA (dari dokumen Persetujuan). Salin dari bulan lalu 1-klik.
- (Opsional) SCAN dokumen Persetujuan (reuse engine OCR/AI) → auto-isi pagu per MA.

## Catatan MA
Persetujuan Rutin punya MA di luar 9 master (Pelumas, Pengangkutan Pelumas). Opsi:
- Perluas master MATA_ANGGARAN (tambah Pelumas dll), ATAU
- Pagu bebas per label MA (baris dinamis) — realisasi dicocokkan by kodeMA.

## Pertanyaan
1. Pagu diisi manual per MA, atau mau sekalian SCAN dokumen Persetujuan (OCR/AI)?
2. Realisasi rutin dihitung dari nilai FINAL (SPBJ) bila ada, else estimasi — setuju?
3. Guardrail: peringatan saja (boleh lanjut) atau blokir keras bila overbudget?
4. MA rutin di luar 9 master (Pelumas dll): perluas master, atau baris pagu bebas?
5. "EVALUASI PROGRAM PERAWATAN BULAN INI" (118.715.000) itu = total pagu rutin bulan, atau angka lain?
