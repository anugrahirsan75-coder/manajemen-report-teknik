import { ProjectData, PekerjaanItem } from "../types";

export const modeFull = (m: "GO" | "TO") => (m === "GO" ? "General Overhoul" : "Top Overhoul");

// pekerjaan mesin dinamis sesuai pilihan GO/TO + nama ME/AE
export function pekerjaanMesinDinamis(d: ProjectData): PekerjaanItem[] {
  return [
    { no: "1", uraian: `${modeFull(d.mesinME)} Mesin Induk Kiri/Kanan M/E ${d.namaME}`, qty: 2, satuan: "Unit", hasil: "100%", ket: "Selesai" },
    { no: "2", uraian: `${modeFull(d.mesinAE)} Mesin Bantu Kiri/Kanan AE I dan II : ${d.namaAE}`, qty: 2, satuan: "Unit", hasil: "100%", ket: "Selesai" },
    { no: "3", uraian: "Pengecetan seluruh area kamar mesin", qty: 1, satuan: "Ls", hasil: "100%", ket: "Selesai" },
  ];
}
