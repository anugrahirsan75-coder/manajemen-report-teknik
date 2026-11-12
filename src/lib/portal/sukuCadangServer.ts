/**
 * Sisi server persediaan suku cadang: ambil-atau-buat lembar, dan pembersih isian.
 *
 * Satu baris Supabase per kapal PER BAGIAN — borang TF-101.00.11 memang dibuat
 * per departemen (Mesin, Deck), dan akun Deck tidak boleh menyentuh suku cadang
 * kamar mesin atau sebaliknya.
 */
import { dbServer } from "@/lib/dbServer";
import {
  KIND_SUKU_CADANG, PENANDA_TANGAN_AWAL,
  type ItemSC, type LembarSC, type PenandaTanganSC,
} from "./sukuCadang";

export async function lembarSC(kapal: string, bagian: "deck" | "mesin") {
  const c = dbServer();
  if (!c) return { c: null, id: "", lembar: null as LembarSC | null };
  const { data, error } = await c.from("projects")
    .select("id,payload")
    .filter("payload->>kind", "eq", KIND_SUKU_CADANG)
    .filter("payload->>kapal", "eq", kapal)
    .filter("payload->>bagian", "eq", bagian)
    .limit(1);
  if (error) throw new Error(error.message);
  const ada = (data || [])[0];
  if (ada) return { c, id: ada.id as string, lembar: rapikan(ada.payload, kapal, bagian) };

  const kosong = rapikan({}, kapal, bagian);
  const { data: baru, error: galat } = await c.from("projects")
    .insert({ nama_kapal: kapal, tahun: new Date().getFullYear(), payload: kosong })
    .select("id").single();
  if (galat) throw new Error(galat.message);
  return { c, id: (baru?.id as string) || "", lembar: kosong };
}

/** lembar dari basis data, dengan larik yang dijamin ada */
export function rapikan(p: any, kapal: string, bagian: "deck" | "mesin"): LembarSC {
  return {
    kind: KIND_SUKU_CADANG,
    kapal: p?.kapal || kapal,
    bagian: p?.bagian || bagian,
    item: Array.isArray(p?.item) ? p.item : [],
    mutasi: Array.isArray(p?.mutasi) ? p.mutasi : [],
    cekFisik: Array.isArray(p?.cekFisik) ? p.cekFisik : [],
    penandaTangan: { ...PENANDA_TANGAN_AWAL(bagian), ...(p?.penandaTangan || {}) },
    diperbaruiPada: p?.diperbaruiPada || "",
    olehAkun: p?.olehAkun || "",
    riwayat: Array.isArray(p?.riwayat) ? p.riwayat : [],
  };
}

export const teks = (v: unknown, panjang = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, panjang);

/** angka positif atau nol; pecahan diizinkan (liter, meter) */
export const angka = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN;
};

export const tanggalSah = (t: unknown) => {
  const s = String(t ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : s;
};

export const idBaru = (awalan: string) =>
  `${awalan}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function bersihkanItem(b: any, lama: ItemSC | undefined, kini: string): ItemSC {
  const minimum = angka(b?.minimum);
  return {
    id: lama?.id || idBaru("sc"),
    peralatan: teks(b?.peralatan ?? lama?.peralatan, 60) || "Lainnya",
    partNumber: teks(b?.partNumber ?? lama?.partNumber, 60).toUpperCase(),
    nama: teks(b?.nama ?? lama?.nama, 120),
    satuan: teks(b?.satuan ?? lama?.satuan, 20) || "Pcs",
    minimum: Number.isFinite(minimum) && minimum >= 0 ? minimum : lama?.minimum || 0,
    kondisi: (b?.kondisi ?? lama?.kondisi) === "bekas" ? "bekas" : "baru",
    lokasi: teks(b?.lokasi ?? lama?.lokasi, 80),
    catatan: teks(b?.catatan ?? lama?.catatan, 200),
    aktif: b?.aktif === undefined ? lama?.aktif ?? true : !!b.aktif,
    dibuatPada: lama?.dibuatPada || kini,
  };
}

export function bersihkanPenandaTangan(p: any, lama: PenandaTanganSC): PenandaTanganSC {
  return {
    penyusun: teks(p?.penyusun ?? lama.penyusun, 60).toUpperCase(),
    jabatanPenyusun: teks(p?.jabatanPenyusun ?? lama.jabatanPenyusun, 40),
    penyetuju: teks(p?.penyetuju ?? lama.penyetuju, 60).toUpperCase(),
    jabatanPenyetuju: teks(p?.jabatanPenyetuju ?? lama.jabatanPenyetuju, 40),
  };
}
