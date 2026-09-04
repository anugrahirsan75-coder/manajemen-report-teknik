"use client";
/**
 * Penyusun pesan pengingat untuk grup WhatsApp kapal.
 *
 * Menagih laporan selama ini dikerjakan dengan mata: buka rekap, lihat kotak
 * mana yang masih abu-abu, ketik ulang nama kapalnya satu per satu ke grup.
 * Pekerjaan itu memakan sepuluh menit, dilakukan berkali-kali tiap bulan, dan
 * hampir selalu ada yang terlewat — kapal yang sudah kirim ikut ditagih (dan
 * jengkel), kapal yang belum justru lolos.
 *
 * Data untuk menyusunnya sudah ada seluruhnya di layar rekap. Yang kurang cuma
 * satu langkah: mengubahnya menjadi kalimat yang bisa ditempel ke grup.
 *
 * Tiga bentuk disediakan karena penagihan tidak selalu sama nadanya:
 *  · RINCI  — tiap kapal disebut apa yang kurang. Untuk tagihan awal bulan.
 *  · RINGKAS— hanya nama kapal per golongan. Untuk pengingat harian.
 *  · DESAK  — hanya yang belum kirim sama sekali. Untuk menjelang tenggat.
 *
 * Naskahnya bisa disunting sebelum dikirim: kalimat yang disusun mesin tidak
 * selalu cocok dengan keadaan hari itu, dan mengunci teksnya hanya akan membuat
 * orang menyalin lalu memperbaikinya di tempat lain.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Ikon } from "@/components/ikon";

export interface BarisKapalPengingat {
  kapal: string;
  /** nama dokumen yang SUDAH diterima */
  ada: string[];
  /** nama dokumen yang belum */
  kurang: string[];
}

type Gaya = "rinci" | "ringkas" | "desak";

const GAYA: { id: Gaya; label: string; ket: string }[] = [
  { id: "rinci", label: "Rinci", ket: "Sebut dokumen yang kurang tiap kapal — untuk tagihan awal bulan" },
  { id: "ringkas", label: "Ringkas", ket: "Hanya nama kapal per golongan — untuk pengingat harian" },
  { id: "desak", label: "Mendesak", ket: "Hanya kapal yang belum kirim sama sekali — menjelang tenggat" },
];

const tanggalPanjang = (d: Date) =>
  d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const jamPendek = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** nama kapal tanpa "KMP." — di grup kapal semua orang sudah tahu itu kapal */
const namaPendek = (k: string) => k.replace(/^KMP\.?\s*/i, "").trim();

export function PengingatGrup({ periodeLabel, daftar, totalDokumen, tautanLapor, tutup }: {
  periodeLabel: string;
  daftar: BarisKapalPengingat[];
  totalDokumen: number;
  tautanLapor: string;
  tutup: () => void;
}) {
  const [gaya, setGaya] = useState<Gaya>("rinci");
  const [pakaiTautan, setPakaiTautan] = useState(true);
  const [pakaiPujian, setPakaiPujian] = useState(true);
  const [tenggat, setTenggat] = useState("");
  const [naskah, setNaskah] = useState("");
  const [disunting, setDisunting] = useState(false);
  const [kabar, setKabar] = useState("");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const golongan = useMemo(() => {
    const lengkap = daftar.filter((d) => d.kurang.length === 0);
    const sebagian = daftar.filter((d) => d.ada.length > 0 && d.kurang.length > 0);
    const kosong = daftar.filter((d) => d.ada.length === 0);
    return { lengkap, sebagian, kosong };
  }, [daftar]);

  /*
   * Naskah disusun ulang tiap pilihan berubah, KECUALI kalau sudah disunting
   * tangan. Menimpa perubahan orang karena ia menekan satu tombol lain adalah
   * cara tercepat membuat fitur ini ditinggalkan.
   */
  const susun = useMemo(() => {
    const kini = new Date();
    const b: string[] = [];
    const total = daftar.length;
    const terisi = daftar.reduce((s, d) => s + d.ada.length, 0);
    const persen = totalDokumen ? Math.round((terisi / totalDokumen) * 100) : 0;

    b.push(`*PENGINGAT LAPORAN & PERMINTAAN KAPAL*`);
    b.push(`*Periode ${periodeLabel.toUpperCase()}*`);
    b.push(`PT ASDP Indonesia Ferry (Persero) — Cabang Ternate`);
    b.push("");
    b.push(`Rekap per ${tanggalPanjang(kini)} pukul ${jamPendek(kini)} WIT`);
    b.push(`Kelengkapan armada: ${terisi}/${totalDokumen} dokumen (${persen}%)`);
    b.push(`Kapal lengkap: ${golongan.lengkap.length} dari ${total}`);
    b.push("");

    if (gaya === "desak") {
      if (golongan.kosong.length) {
        b.push(`🔴 *BELUM MENGIRIM SAMA SEKALI (${golongan.kosong.length} kapal)*`);
        golongan.kosong.forEach((d) => b.push(`• ${namaPendek(d.kapal)}`));
      } else {
        b.push(`✅ Seluruh kapal sudah mengirim setidaknya satu dokumen.`);
      }
      if (golongan.sebagian.length) {
        b.push("");
        b.push(`🟡 *MASIH KURANG (${golongan.sebagian.length} kapal)*`);
        b.push(golongan.sebagian.map((d) => namaPendek(d.kapal)).join(", "));
      }
    } else {
      if (pakaiPujian && golongan.lengkap.length) {
        b.push(`✅ *SUDAH LENGKAP (${golongan.lengkap.length} kapal)*`);
        b.push(golongan.lengkap.map((d) => namaPendek(d.kapal)).join(", "));
        b.push("");
      }

      if (golongan.sebagian.length) {
        b.push(`🟡 *BARU SEBAGIAN (${golongan.sebagian.length} kapal)*`);
        golongan.sebagian.forEach((d) => {
          b.push(gaya === "rinci"
            ? `• ${namaPendek(d.kapal)} (${d.ada.length}/${d.ada.length + d.kurang.length}) — kurang: ${d.kurang.join(", ")}`
            : `• ${namaPendek(d.kapal)} (${d.ada.length}/${d.ada.length + d.kurang.length})`);
        });
        b.push("");
      }

      if (golongan.kosong.length) {
        b.push(`🔴 *BELUM KIRIM SAMA SEKALI (${golongan.kosong.length} kapal)*`);
        golongan.kosong.forEach((d) => b.push(`• ${namaPendek(d.kapal)}`));
        b.push("");
      }

      if (!golongan.sebagian.length && !golongan.kosong.length) {
        b.push(`🎉 Seluruh kapal sudah lengkap. Terima kasih atas kerja samanya.`);
        b.push("");
      }
    }

    if (tenggat) {
      const [y, m, d] = tenggat.split("-").map(Number);
      b.push("");
      b.push(`⏰ *Batas pengiriman: ${tanggalPanjang(new Date(y, m - 1, d))}*`);
    }

    if (pakaiTautan) {
      b.push("");
      b.push(`Kirim lewat tautan ini (tidak perlu akun):`);
      b.push(tautanLapor);
    }

    b.push("");
    b.push(`Mohon yang belum segera melengkapi. Terima kasih 🙏`);

    // baris kosong berturut-turut dirapikan supaya pesannya tidak renggang
    return b.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }, [daftar, gaya, golongan, pakaiPujian, pakaiTautan, periodeLabel, tautanLapor, tenggat, totalDokumen]);

  useEffect(() => { if (!disunting) setNaskah(susun); }, [susun, disunting]);

  useEffect(() => {
    const tekan = (ev: KeyboardEvent) => { if (ev.key === "Escape") tutup(); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [tutup]);

  const beritahu = (t: string) => { setKabar(t); setTimeout(() => setKabar(""), 2500); };

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(naskah);
      beritahu("Pesan disalin — tinggal tempel di grup");
    } catch {
      // peramban lama menolak papan klip; pilih seluruh teks supaya bisa Ctrl+C
      areaRef.current?.select();
      beritahu("Tekan Ctrl+C untuk menyalin");
    }
  };

  const keWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(naskah)}`, "_blank", "noopener,noreferrer");
  };

  const unduh = () => {
    const berkas = new Blob([naskah], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(berkas);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pengingat Laporan Kapal - ${periodeLabel}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={(ev) => { if (ev.target === ev.currentTarget) tutup(); }}>
      <div className="my-6 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start gap-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-white px-5 py-4 dark:border-slate-700 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <Ikon nama="kotakMasuk" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-slate-900 dark:text-white">Pengingat untuk Grup Kapal</h2>
            <p className="text-[11px] text-slate-500">
              Disusun dari rekap {periodeLabel} — {golongan.lengkap.length} lengkap · {golongan.sebagian.length} sebagian · {golongan.kosong.length} belum kirim
            </p>
          </div>
          <button onClick={tutup} title="Tutup (Esc)"
            className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            Tutup
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {GAYA.map((g) => (
              <button key={g.id} type="button" title={g.ket}
                onClick={() => { setGaya(g.id); setDisunting(false); }}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                  gaya === g.id
                    ? "bg-[#16357f] text-white ring-[#16357f]"
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"}`}>
                {g.label}
              </button>
            ))}
            <span className="ml-auto flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={pakaiPujian} disabled={gaya === "desak"}
                  onChange={(e) => { setPakaiPujian(e.target.checked); setDisunting(false); }} />
                Sebut yang sudah lengkap
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={pakaiTautan}
                  onChange={(e) => { setPakaiTautan(e.target.checked); setDisunting(false); }} />
                Sertakan tautan kirim
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Batas
                <input type="date" value={tenggat}
                  onChange={(e) => { setTenggat(e.target.value); setDisunting(false); }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800" />
              </label>
            </span>
          </div>

          {/*
            Naskahnya sengaja berupa kotak sunting, bukan pratinjau mati. Nada
            pesan ke grup sering perlu disesuaikan keadaan hari itu — ada kapal
            yang sedang docking, ada yang sudah dihubungi lewat telepon.
          */}
          <textarea ref={areaRef} value={naskah}
            onChange={(e) => { setNaskah(e.target.value); setDisunting(true); }}
            rows={16}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-800 outline-none transition focus:border-[#16357f] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={salin}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16357f] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#12296a]">
              <Ikon nama="salin" className="h-3.5 w-3.5" /> Salin pesan
            </button>
            <button onClick={keWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">
              <Ikon nama="keluarTaut" className="h-3.5 w-3.5" /> Kirim lewat WhatsApp
            </button>
            <button onClick={unduh}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              <Ikon nama="lembar" className="h-3.5 w-3.5" /> Unduh .txt
            </button>
            {disunting && (
              <button onClick={() => { setDisunting(false); setNaskah(susun); }}
                className="rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-500 underline-offset-2 hover:underline">
                Kembalikan naskah asli
              </button>
            )}
            {kabar && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{kabar}</span>}
          </div>

          <p className="text-[10.5px] leading-relaxed text-slate-500">
            Tombol WhatsApp membuka jendela pilih grup — pesannya sudah terisi, tinggal pilih grup lalu kirim.
            Di komputer, jendela itu memakai WhatsApp Web, jadi pastikan sudah masuk lebih dulu.
            Tanda <b>*bintang*</b> pada teks akan tampil tebal begitu terkirim.
          </p>
        </div>
      </div>
    </div>
  );
}
