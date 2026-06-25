// Prompt + normalisasi bersama untuk engine AI (Gemini cloud / Ollama lokal).
export const SCAN_PROMPT = `Kamu mengekstrak tabel item pengadaan kapal (Bahasa Indonesia) dari sebuah gambar/screenshot Excel.
Kolom tabel biasanya: No | Jumlah (qty) | Satuan | Nama Barang | Spesifikasi | Harga Satuan | Jumlah (total).
Aturan:
- Baris nama kapal (mis. "KMP. GORANGO" / "KMP GORANGO") = field "kapal" untuk SEMUA item di bawahnya sampai ketemu kapal lain.
- Baris sub-judul tanpa nomor sebelum item (mis. "MERK : CUMMINS", "MODEL : 6 BT5.9-GM83", "POWER : 113 HP, 1500 RPM", "ME, Merk : ...") = "keterangan" (header di ATAS item) — gabung beberapa baris dengan newline, taruh di item PERTAMA grup itu.
- Baris bernomor = satu item: jumlah (angka), satuan, nama (Nama Barang), spesifikasi (kolom Spesifikasi, mis. part number), harga (Harga Satuan, angka polos tanpa titik).
- Baris tanpa nomor SETELAH sebuah item (rincian seperti "a.Pompa", "Merk : EBARA", "Type : ...") = masuk array "breakdown" item tsb.
- "harga" = integer rupiah TANPA pemisah ribuan (mis. 1110000). Jika ragu, hitung dari kolom total dibagi jumlah.
- Jangan mengarang. Kalau sel kosong, kosongkan ("").
Keluarkan HANYA JSON valid (tanpa teks lain) bentuk:
{"items":[{"kapal":"","keterangan":"","jumlah":1,"satuan":"","nama":"","spesifikasi":"","harga":0,"breakdown":[]}]}`;

export interface ScanRow {
  kapal: string; keterangan?: string; jumlah: number; satuan: string;
  nama: string; spesifikasi: string; harga: number; breakdown?: string[];
}

export function normalizeItems(arr: any): ScanRow[] {
  const list = Array.isArray(arr) ? arr : (arr?.items || []);
  return list.map((r: any) => ({
    kapal: String(r.kapal || "").trim(),
    keterangan: String(r.keterangan || "").trim() || undefined,
    jumlah: Number(r.jumlah) || 1,
    satuan: String(r.satuan || "unit").trim() || "unit",
    nama: String(r.nama || "").trim(),
    spesifikasi: String(r.spesifikasi || "").trim(),
    harga: Math.round(Number(String(r.harga ?? "").replace(/[^\d]/g, "")) || 0),
    breakdown: Array.isArray(r.breakdown) ? r.breakdown.map((b: any) => String(b).trim()).filter(Boolean) : undefined,
  })).filter((r: ScanRow) => r.nama || r.kapal);
}

// ambil JSON dari teks balasan model (buang fence ```json ... ```)
export function extractJson(text: string): any {
  const clean = (text || "").replace(/^```json\s*|\s*```$/g, "").trim();
  try { return JSON.parse(clean); } catch {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
