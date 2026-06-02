// ============================================================
// Data model Generator Swakelola Docking — satu input, 8 dokumen
// ============================================================

export type MesinMode = "GO" | "TO"; // General Overhoul | Top Overhoul

export interface CrewMember {
  no: number;
  nama: string;
  jabatan: string;
  nik: string; // Nomor Induk Karyawan
  npwp: string; // NPWP / NIK
  nilaiBruto: number; // file 3 — diisi manual / OCR
  pph21: number; // file 3 — diisi manual / OCR (PPH PSL 21 5%)
  // penerimaanBersih dihitung = nilaiBruto - pph21
}

export interface PekerjaanItem {
  no: string;
  uraian: string;
  qty: number;
  satuan: string;
  hasil?: string; // mis. "100%"
  ket?: string; // mis. "Selesai"
}

export interface DokFoto {
  id: string;
  kategori: "DECK" | "MESIN";
  caption: string;
  dataUrl: string; // base64 image
}

export interface ProjectData {
  id?: string;
  // --- identitas umum ---
  tahun: number;
  nomorSpk: string; // hanya angka, mis. "465"
  // kapal
  namaKapal: string; // mis. "KMP. LEMA"
  npwpKapal: string;
  costCenter: string;
  // tanggal — HANYA dua tanggal dipakai seluruh dokumen
  tanggalMulai: string; // ISO yyyy-mm-dd (file 1)
  tanggalSelesai: string; // ISO yyyy-mm-dd (file 2,4,6 + tgl dokumen)
  // biaya
  biayaPekerjaan: number; // nilai swakelola total
  // pejabat
  generalManager: string;
  deptHeadOpsTeknik: string; // dulu "Manager Teknik" -> Dept. Head Operasional dan Teknik
  stafTeknik: string;
  nikDeptHead: string;
  // perwira kapal
  nakhoda: string; // kapten
  kkm: string; // Masinis I / KKM
  ownerSurveyor: string; // OS
  muallimI: string; // Mualim I
  // mesin
  mesinME: MesinMode; // Mesin Induk
  mesinAE: MesinMode; // Mesin Bantu / Aux
  namaME: string; // tipe Mesin Induk, mis. "YANMAR 6 EY 17"
  namaAE: string; // tipe Mesin Bantu, mis. "PERKINS 6TG2AM"
  // SPM (file 5)
  tanggalSpm: string; // ISO
  nomorSpm: string;
  noDafnom: string; // No. Daftar Nominatif
  // crew
  crew: CrewMember[];
  // pekerjaan (deck + mesin) — default dari template, bisa diedit
  pekerjaanDeck: PekerjaanItem[];
  pekerjaanMesin: PekerjaanItem[];
  // dokumentasi foto (file 7)
  fotoDok: DokFoto[];
}

// Nomor SPK lengkap terformat
export function formatNomorSpk(d: Pick<ProjectData, "nomorSpk" | "tahun">): string {
  return `SPK.${d.nomorSpk}/TN.101/ASDP-TTE/SWK/${d.tahun}`;
}

export function penerimaanBersih(c: CrewMember): number {
  return c.nilaiBruto - c.pph21;
}
