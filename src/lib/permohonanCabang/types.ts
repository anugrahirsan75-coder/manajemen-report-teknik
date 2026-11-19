/**
 * Monitoring Permohonan Cabang — daftar surat permohonan Cabang Ternate ke
 * Kantor Pusat (docking, addendum, investasi, release budget, dan seterusnya)
 * beserta status persetujuannya.
 *
 * Kolomnya sengaja mengikuti spreadsheet "Kontrol Permohonan Ternate 2026"
 * yang sudah dipakai tim, karena setiap simpanan di aplikasi ikut ditulis ke
 * sana lewat webhook Apps Script REKAP: No, Jenis Survey / Pekerjaan, Total
 * Biaya, Status Persetujuan Pusat, Lampiran Dokumen, Tanggal Pengajuan,
 * Tanggal Selesai, Jenis Usulan, Keterangan, dan KETERANGAN (catatan terbitnya
 * persetujuan). Baris spreadsheet dikenali lewat kolom tersembunyi ID APLIKASI.
 *
 * Datanya menumpang tabel `projects` dengan payload.kind = "permohonan_cabang".
 */

export const KIND_PERMOHONAN = "permohonan_cabang";

export type StatusPermohonan = "Proses" | "Disetujui" | "Ditolak";
export const STATUS: StatusPermohonan[] = ["Proses", "Disetujui", "Ditolak"];
export const STATUS_WARNA: Record<StatusPermohonan, string> = {
  Proses: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  Disetujui: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Ditolak: "bg-red-100 text-red-700 ring-red-200",
};

export type JenisUsulan = "Investasi dan Biaya" | "Investasi" | "Biaya";
export const JENIS: JenisUsulan[] = ["Investasi dan Biaya", "Investasi", "Biaya"];
export const JENIS_WARNA: Record<JenisUsulan, string> = {
  "Investasi dan Biaya": "bg-emerald-50 text-emerald-800 ring-emerald-300",
  Investasi: "bg-cyan-50 text-cyan-800 ring-cyan-300",
  Biaya: "bg-yellow-50 text-yellow-800 ring-yellow-300",
};

/** keadaan penulisan terakhir ke spreadsheet */
export interface Sinkron {
  ok: boolean;
  pesan: string;
  /** nomor baris di spreadsheet */
  baris?: number;
  waktu: string;
}

export interface Permohonan {
  id: string;
  judul: string;
  nomorSurat: string;
  kapal: string[];
  totalBiaya: number;
  status: StatusPermohonan;
  lampiranNama: string;
  lampiranUrl: string;
  /** YYYY-MM-DD */
  tglPengajuan: string;
  /** YYYY-MM-DD — tanggal persetujuan terbit / permohonan selesai */
  tglSelesai: string;
  jenisUsulan: JenisUsulan;
  keterangan: string;
  /** kolom J spreadsheet, mis. "sudah terbit persetujuan" + nomor surat persetujuan */
  ketPersetujuan: string;
  sinkron?: Sinkron;
  createdAt?: string;
  updatedAt?: string;
}

export function idBaru(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "pc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function hariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function permohonanKosong(): Permohonan {
  return {
    id: idBaru(), judul: "", nomorSurat: "", kapal: [], totalBiaya: 0, status: "Proses",
    lampiranNama: "", lampiranUrl: "", tglPengajuan: hariIni(), tglSelesai: "",
    jenisUsulan: "Investasi dan Biaya", keterangan: "", ketPersetujuan: "",
  };
}

const teks = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const tgl = (v: unknown) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(teks(v)); return m ? m[1] : ""; };

export function dariPayload(id: string, p: any): Permohonan {
  const status = STATUS.includes(p?.status) ? p.status : "Proses";
  const jenis = JENIS.includes(p?.jenisUsulan) ? p.jenisUsulan : "Investasi dan Biaya";
  return {
    id,
    judul: teks(p?.judul),
    nomorSurat: teks(p?.nomorSurat),
    kapal: Array.isArray(p?.kapal) ? p.kapal.map(teks).filter(Boolean) : [],
    totalBiaya: Number(p?.totalBiaya) || 0,
    status,
    lampiranNama: teks(p?.lampiranNama),
    lampiranUrl: teks(p?.lampiranUrl),
    tglPengajuan: tgl(p?.tglPengajuan),
    tglSelesai: tgl(p?.tglSelesai),
    jenisUsulan: jenis,
    keterangan: teks(p?.keterangan),
    ketPersetujuan: teks(p?.ketPersetujuan),
    sinkron: p?.sinkron && typeof p.sinkron === "object"
      ? { ok: !!p.sinkron.ok, pesan: teks(p.sinkron.pesan), baris: Number(p.sinkron.baris) || undefined, waktu: teks(p.sinkron.waktu) }
      : undefined,
    createdAt: teks(p?.createdAt) || undefined,
    updatedAt: teks(p?.updatedAt) || undefined,
  };
}

/** rapikan isian borang sebelum disimpan */
export function rapikan(p: Permohonan): Permohonan {
  return {
    ...p,
    judul: p.judul.trim(),
    nomorSurat: p.nomorSurat.trim(),
    lampiranNama: p.lampiranNama.trim(),
    lampiranUrl: p.lampiranUrl.trim(),
    keterangan: p.keterangan.trim(),
    ketPersetujuan: p.ketPersetujuan.trim(),
    totalBiaya: Math.max(0, Math.round(Number(p.totalBiaya) || 0)),
  };
}

/** baris yang dikirim ke Apps Script (tanpa data internal aplikasi) */
export interface BarisSheet {
  id: string; judul: string; totalBiaya: number; status: string; lampiranNama: string; lampiranUrl: string;
  tglPengajuan: string; tglSelesai: string; jenisUsulan: string; keterangan: string; ketPersetujuan: string;
}
export function keBarisSheet(p: Permohonan): BarisSheet {
  // nomor surat & kapal belum punya kolom di spreadsheet — nomor surat ditumpangkan di Keterangan
  const ket = [p.keterangan, p.nomorSurat ? `Surat: ${p.nomorSurat}` : ""].filter(Boolean).join(" · ");
  return {
    id: p.id, judul: p.judul, totalBiaya: p.totalBiaya, status: p.status, lampiranNama: p.lampiranNama,
    lampiranUrl: p.lampiranUrl, tglPengajuan: p.tglPengajuan, tglSelesai: p.tglSelesai, jenisUsulan: p.jenisUsulan,
    keterangan: ket, ketPersetujuan: p.ketPersetujuan,
  };
}

/** baris hasil tarik dari spreadsheet → permohonan (id spreadsheet dipakai bila sudah ada) */
export function dariBarisSheet(b: any, idLama?: string): Permohonan {
  const ket = teks(b?.keterangan);
  const m = /(?:^|\s·\s)Surat:\s*(.+)$/.exec(ket);
  return rapikan({
    ...permohonanKosong(),
    id: idLama || teks(b?.id) || idBaru(),
    judul: teks(b?.judul),
    nomorSurat: m ? m[1].trim() : "",
    totalBiaya: Number(b?.totalBiaya) || 0,
    status: STATUS.includes(b?.status) ? b.status : "Proses",
    lampiranNama: teks(b?.lampiranNama),
    lampiranUrl: teks(b?.lampiranUrl),
    tglPengajuan: tgl(b?.tglPengajuan),
    tglSelesai: tgl(b?.tglSelesai),
    jenisUsulan: JENIS.includes(b?.jenisUsulan) ? b.jenisUsulan : "Investasi dan Biaya",
    keterangan: m ? ket.slice(0, m.index).trim() : ket,
    ketPersetujuan: teks(b?.ketPersetujuan),
  });
}

/** kunci pencocokan judul: huruf kecil, spasi tunggal, tanpa tanda baca */
export const kunciJudul = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const rupiah = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
