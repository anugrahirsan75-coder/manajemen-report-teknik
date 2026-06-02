"use client";

import { useStore } from "@/lib/store";
import { formatNomorSpk } from "@/lib/types";
import { tanggalIndo, rentangTanggal, jangkaHari, rupiah, terbilang } from "@/lib/format";
import DocToolbar from "@/components/DocToolbar";

const goto = (m: "GO" | "TO") => (m === "GO" ? "General Overhoul" : "Top Overhoul");

export default function SPKDoc() {
  const { data: d } = useStore();
  const nomor = formatNomorSpk(d);
  const hari = jangkaHari(d.tanggalMulai, d.tanggalSelesai);

  return (
    <>
      <DocToolbar title="01. SPK Swakelola Docking" slug="spk" data={d} nativeKind="word" />
      <div className="print-page text-black">
        <div className="text-center font-bold leading-tight">
          <div className="text-[13pt]">PT. ASDP INDONESIA FERRY (PERSERO)</div>
          <div className="text-[12pt]">CABANG TERNATE</div>
        </div>
        <hr className="border-black border-t-2 my-2" />
        <div className="text-center font-bold mt-4">SURAT PERINTAH KERJA (SPK)</div>
        <div className="text-center mb-6">Nomor : {nomor}</div>

        <p className="mb-3">Pada hari ini, {tanggalIndo(d.tanggalMulai)}, yang bertanda tangan di bawah ini :</p>
        <p className="mb-1">1.&nbsp;&nbsp;<b>{d.generalManager}</b> — General Manager PT. ASDP Indonesia Ferry (Persero) Cabang Ternate, selanjutnya disebut <b>PIHAK PERTAMA</b>.</p>
        <p className="mb-4">2.&nbsp;&nbsp;<b>{d.nakhoda}</b> — Nakhoda {d.namaKapal}, selanjutnya disebut <b>PIHAK KEDUA</b>.</p>

        <p className="mb-4">PIHAK PERTAMA memberikan perintah kerja kepada PIHAK KEDUA untuk melaksanakan pekerjaan swakelola docking {d.namaKapal} dengan ketentuan sebagai berikut :</p>

        <p className="font-bold">PASAL 1 — LINGKUP PEKERJAAN</p>
        <p className="mb-1"><b>A. Pekerjaan Deck :</b> Melakukan ketok, sekrap sebagai persiapan pengecatan konstruksi kapal yang berada di atas garis air serta perawatan bagian deck sesuai daftar lampiran.</p>
        <p className="mb-1"><b>B. Pekerjaan Mesin :</b></p>
        <ul className="list-disc ml-8 mb-4">
          <li>{goto(d.mesinME)} Mesin Induk (M/E) {d.namaME}.</li>
          <li>{goto(d.mesinAE)} Mesin Bantu (A/E) {d.namaAE}.</li>
          <li>Pemeliharaan, pembersihan, perbaikan, penggantian suku cadang, dan persiapan pemeriksaan klas.</li>
        </ul>

        <p className="font-bold">PASAL 2 — BIAYA PEKERJAAN</p>
        <p className="mb-4">Biaya pelaksanaan pekerjaan ditetapkan sebesar <b>Rp {rupiah(d.biayaPekerjaan)}</b> ({terbilang(d.biayaPekerjaan)} rupiah).</p>

        <p className="font-bold">PASAL 3 — JANGKA WAKTU</p>
        <p className="mb-4">Pekerjaan dilaksanakan selama {hari} ({terbilang(hari)}) hari kalender, terhitung {rentangTanggal(d.tanggalMulai, d.tanggalSelesai)}.</p>

        <p className="font-bold">PASAL 4 — PEMBAYARAN</p>
        <p className="mb-4">Pembayaran dilakukan 100% setelah pekerjaan selesai dan diserahkan beserta dokumentasi/bukti foto pekerjaan.</p>

        <p className="font-bold">PASAL 5 — SANKSI</p>
        <p className="mb-8">Keterlambatan dikenakan denda 0,17% per hari dari nilai kontrak, maksimal 5% dari nilai kontrak.</p>

        <p className="text-right mb-10">Ternate, {tanggalIndo(d.tanggalMulai)}</p>
        <div className="flex justify-between">
          <div className="text-center">
            <p>PIHAK KEDUA</p>
            <p>Nakhoda {d.namaKapal}</p>
            <div className="h-20" />
            <p className="font-bold underline">{d.nakhoda}</p>
          </div>
          <div className="text-center">
            <p>PIHAK PERTAMA</p>
            <p>General Manager</p>
            <div className="h-20" />
            <p className="font-bold underline">{d.generalManager}</p>
          </div>
        </div>
      </div>
    </>
  );
}
