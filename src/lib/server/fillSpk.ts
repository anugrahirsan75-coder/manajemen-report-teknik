import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { ProjectData, formatNomorSpk } from "@/lib/types";
import { tanggalIndo, terbilang } from "@/lib/format";

function tplPath(name: string) {
  return path.join(process.cwd(), "templates", name);
}

// rupiah gaya dokumen: 17,537,500 (koma ribuan)
function rupiahKoma(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n || 0));
}

// nilai seed asli di template 01_spk.docx -> diganti nilai data
function buildReplacements(d: ProjectData): [string | RegExp, string][] {
  const spkBaru = formatNomorSpk(d);
  const terbil = terbilang(d.biayaPekerjaan);
  const terbilCap = terbil.charAt(0).toUpperCase() + terbil.slice(1) + " Rupiah";
  return [
    // komposit ber-tahun dulu (biar 2025 tak ketukar duluan)
    ["SPK.465/TN.101/ASDP-TTE/SWK/2025", spkBaru],
    ["04 Februari 2025", tanggalIndo(d.tanggalSelesai)],
    ["16 Januari 2025", tanggalIndo(d.tanggalMulai)],
    [/TAHUN 2025/g, `TAHUN ${d.tahun}`],
    [/Tahun 2025/g, `Tahun ${d.tahun}`],
    [/tahun 2025/g, `tahun ${d.tahun}`],
    // biaya + terbilang
    ["17,537,500", rupiahKoma(d.biayaPekerjaan)],
    ["Tujuh Belas Juta Lima Ratus Tiga Puluh Tujuh Ribu Lima Ratus Rupiah", terbilCap],
    // rapikan: padding spasi berlebih sebelum titik dua (Jabatan & Alamat PIHAK KEDUA) -> 1 spasi, sejajar
    [/ {6,}: /g, " : "],
    // nama
    [/HANDOYO PRIYANTO/g, d.generalManager],
    [/BUDI PRIYANTO/g, d.nakhoda],
    // kapal (paling akhir)
    [/KMP\. LEMA/g, d.namaKapal],
  ];
}

export function fillSpkDocx(d: ProjectData): Buffer {
  const buf = fs.readFileSync(tplPath("01_spk.docx"));
  const zip = new PizZip(buf);
  let xml = zip.file("word/document.xml")!.asText();
  for (const [from, to] of buildReplacements(d)) {
    xml = typeof from === "string" ? xml.split(from).join(escapeXml(to)) : xml.replace(from, escapeXml(to));
  }
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
