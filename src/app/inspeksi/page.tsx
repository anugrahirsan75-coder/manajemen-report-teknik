"use client";
/**
 * INSPEKSI KAPAL — rekap temuan Marine Superintendent sampai tertutup.
 *
 * Yang dipantau di sini bukan "berapa laporan masuk", melainkan berapa temuan
 * yang masih menganggur dan sudah berapa lama. Karena itu tiga angka yang
 * dipasang paling depan adalah temuan terbuka, temuan yang lewat tenggat, dan
 * umur temuan tertua — bukan jumlah inspeksi.
 *
 * Temuan hanya bisa ditutup dengan bukti perbaikan dan nama pemeriksa. Aturan
 * itu ditegakkan di server (api/inspeksi/daftar), bukan cuma di tombol layar
 * ini; rekap penutupan yang bisa diklik begitu saja tidak ada gunanya bagi
 * inspeksi berikutnya.
 */
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { konfirmasi } from "@/components/Konfirmasi";
import { ACCEPT_BERKAS } from "@/lib/lapor/berkasJenis";
import { ukuranSingkat, tautanWa } from "@/lib/lapor/types";
import { Kemajuan, pesanRamah, unggahSatuBerkas } from "@/lib/lapor/unggahBerkas";
import {
  BAGIAN_INSPEKSI, BagianInspeksi, STATUS_TEMUAN, TINGKAT_TEMUAN, Temuan, TingkatTemuan,
  bolehTutup, hariIni, kelasStatus, kelasTingkat, labelBagian, labelStatus, labelTingkat,
  lewatTarget, tambahHari, tebakBagian, tebakTingkat, umurHari,
} from "@/lib/inspeksi/types";

const waktuSingkat = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const tglSingkat = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

interface BarisImpor {
  kunci: string; pilih: boolean; kapal: string; tanggalInspeksi: string; inspektor: string;
  bagian: BagianInspeksi; komponen: string; uraian: string; tindakan: string;
  tingkat: TingkatTemuan; sumber: string;
}

let nomorKunci = 0;
const barisImporBaru = (isi: Partial<BarisImpor> = {}): BarisImpor => ({
  kunci: `b${++nomorKunci}`, pilih: true, kapal: "", tanggalInspeksi: hariIni(), inspektor: "",
  bagian: "lain", komponen: "", uraian: "", tindakan: "", tingkat: "minor", sumber: "", ...isi,
});

function IsiInspeksi() {
  const [baris, setBaris] = useState<Temuan[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState<{ teks: string; nada: "sukses" | "gagal" | "kerja" } | null>(null);
  const [sorot, setSorot] = useState("");
  const [simpanId, setSimpanId] = useState("");

  const [kapal, setKapal] = useState("");
  const [bagian, setBagian] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [status, setStatus] = useState("");
  const [cari, setCari] = useState("");
  const [hanyaTerlambat, setHanyaTerlambat] = useState(false);

  const [buka, setBuka] = useState<Temuan | null>(null);
  const [unggah, setUnggah] = useState("");
  const berkasRef = useRef<HTMLInputElement>(null);
  const jenisBukti = useRef<"sebelum" | "sesudah">("sesudah");

  const [imporBuka, setImporBuka] = useState(false);
  const [imporBaris, setImporBaris] = useState<BarisImpor[]>([]);
  const [imporSibuk, setImporSibuk] = useState("");
  const [tempel, setTempel] = useState("");
  const docxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!kabar || kabar.nada === "kerja") return;
    const j = window.setTimeout(() => setKabar(null), 4500);
    return () => window.clearTimeout(j);
  }, [kabar]);
  useEffect(() => {
    if (!sorot) return;
    const j = window.setTimeout(() => setSorot(""), 2600);
    return () => window.clearTimeout(j);
  }, [sorot]);

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/inspeksi/daftar", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) setGalat(d.error || "Gagal memuat"); else setBaris(d.baris);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);
  useEffect(() => { void ambil(); }, [ambil]);

  // ── angka pantau ─────────────────────────────────────────────────────────
  const ringkas = useMemo(() => {
    const terbuka = baris.filter((t) => t.status !== "selesai");
    const bulanIni = hariIni().slice(0, 7);
    const tertua = terbuka.reduce((m, t) => Math.max(m, umurHari(t)), 0);
    return {
      total: baris.length,
      terbuka: terbuka.length,
      terlambat: baris.filter(lewatTarget).length,
      kritis: terbuka.filter((t) => t.tingkat === "kritis").length,
      selesaiBulanIni: baris.filter((t) => t.status === "selesai" && (t.diverifikasiPada || "").slice(0, 7) === bulanIni).length,
      persen: baris.length ? Math.round((baris.filter((t) => t.status === "selesai").length / baris.length) * 100) : 0,
      tertua,
    };
  }, [baris]);

  /** umur temuan yang belum tertutup — yang menganggur lama harus kelihatan */
  const umur = useMemo(() => {
    const t = baris.filter((x) => x.status !== "selesai");
    return {
      baru: t.filter((x) => umurHari(x) <= 14).length,
      sedang: t.filter((x) => umurHari(x) > 14 && umurHari(x) <= 30).length,
      lama: t.filter((x) => umurHari(x) > 30).length,
    };
  }, [baris]);

  const matriks = useMemo(() => {
    const peta = new Map<string, { terbuka: number; total: number; kritis: number }>();
    baris.forEach((t) => {
      const k = `${t.kapal}|${t.bagian}`;
      const s = peta.get(k) || { terbuka: 0, total: 0, kritis: 0 };
      s.total++;
      if (t.status !== "selesai") { s.terbuka++; if (t.tingkat === "kritis") s.kritis++; }
      peta.set(k, s);
    });
    return peta;
  }, [baris]);

  const tampil = useMemo(() => baris.filter((t) => {
    if (kapal && t.kapal !== kapal) return false;
    if (bagian && t.bagian !== bagian) return false;
    if (tingkat && t.tingkat !== tingkat) return false;
    if (status && t.status !== status) return false;
    if (hanyaTerlambat && !lewatTarget(t)) return false;
    if (!cari) return true;
    const teks = [t.kapal, t.komponen, t.uraian, t.tindakan, t.inspektor, labelBagian(t.bagian)].join(" ").toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => teks.includes(k));
  }), [baris, kapal, bagian, tingkat, status, cari, hanyaTerlambat]);

  // ── ubah satu temuan ─────────────────────────────────────────────────────
  const ubah = async (id: string, isi: Record<string, unknown>, opsi: { diam?: boolean } = {}) => {
    const sebelum = baris.find((x) => x.id === id);
    setSimpanId(id);
    if (isi.status) setKabar({ teks: `Menyimpan status ${labelStatus(String(isi.status))}…`, nada: "kerja" });
    let d: any;
    try {
      const r = await fetch("/api/inspeksi/daftar", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ubah: isi }),
      });
      d = await r.json();
    } catch (e: any) {
      setSimpanId(""); setGalat(e?.message || "Perubahan gagal disimpan.");
      setKabar({ teks: "Perubahan TIDAK tersimpan — koneksi terputus.", nada: "gagal" });
      return false;
    }
    setSimpanId("");
    if (!d.ok) {
      // penolakan server (mis. menutup tanpa bukti) memang harus terbaca jelas
      setKabar({ teks: d.error || "Perubahan ditolak.", nada: "gagal" });
      return false;
    }
    setBaris((l) => l.map((x) => (x.id === id ? d.baris : x)));
    setBuka((x) => (x && x.id === id ? d.baris : x));
    if (!opsi.diam) {
      setSorot(id);
      setKabar({
        teks: isi.status
          ? `${d.baris.kapal} · ${d.baris.komponen || "temuan"} → ${labelStatus(d.baris.status).toUpperCase()} ✓`
          : "Perubahan tersimpan ✓",
        nada: "sukses",
      });
    }
    if (sebelum && isi.status === "selesai") setSorot(id);
    return true;
  };

  const hapus = async (t: Temuan) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗑️", judul: "Hapus temuan ini?",
      pesan: `${t.kapal} · ${t.komponen}`,
      rincian: ["Riwayat penanganannya ikut hilang.", "Bukti di Google Drive tidak ikut terhapus."],
      tombolYa: "Hapus temuan",
    }))) return;
    const r = await fetch(`/api/inspeksi/daftar?id=${t.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!d.ok) { setKabar({ teks: d.error || "Gagal menghapus", nada: "gagal" }); return; }
    setBaris((l) => l.filter((x) => x.id !== t.id));
    setBuka(null);
    setKabar({ teks: "Temuan dihapus", nada: "sukses" });
  };

  // ── unggah bukti ─────────────────────────────────────────────────────────
  const pilihBukti = (jenis: "sebelum" | "sesudah") => {
    jenisBukti.current = jenis;
    berkasRef.current?.click();
  };

  const kirimBukti = async (daftar: FileList | null) => {
    if (!daftar || !buka) return;
    const berkas = Array.from(daftar);
    if (berkasRef.current) berkasRef.current.value = "";
    if (!buka.token) { setKabar({ teks: "Temuan ini belum punya kunci unggah. Muat ulang halaman.", nada: "gagal" }); return; }

    const kiriman = { id: buka.id, token: buka.token };
    const jenis = jenisBukti.current;
    let masuk = 0;
    for (let i = 0; i < berkas.length; i++) {
      try {
        await unggahSatuBerkas(kiriman, berkas[i], i + 1, berkas.length,
          (k: Kemajuan) => setUnggah(`Mengunggah ${k.berkas} (${k.potongan}/${k.total})…`), { jenis });
        masuk++;
      } catch (e) {
        setKabar({ teks: pesanRamah(e), nada: "gagal" });
      }
    }
    setUnggah("");
    if (masuk) {
      setKabar({ teks: `${masuk} bukti ${jenis} tersimpan ✓`, nada: "sukses" });
      await ambil();
      // panel yang terbuka ikut diperbarui supaya tombol tutup langsung hidup
      const r = await fetch("/api/inspeksi/daftar", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      const segar = r?.baris?.find((x: Temuan) => x.id === buka.id);
      if (segar) setBuka(segar);
    }
  };

  // ── impor laporan ────────────────────────────────────────────────────────
  const bacaDocx = async (berkas: File | undefined) => {
    if (!berkas) return;
    setImporSibuk("Membaca laporan…");
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1] || "");
        fr.onerror = () => rej(new Error("Berkas tidak terbaca"));
        fr.readAsDataURL(berkas);
      });
      const r = await fetch("/api/inspeksi/baca", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: berkas.name, dataBase64: b64 }),
      });
      const d = await r.json();
      if (!d.ok) { setKabar({ teks: d.error || "Gagal membaca", nada: "gagal" }); return; }
      if (!d.temuan?.length) {
        setKabar({ teks: "Tidak ada tabel temuan yang terbaca. Coba tempel tabelnya.", nada: "gagal" });
        return;
      }
      setImporBaris(d.temuan.map((t: any) => barisImporBaru({
        kapal: t.kapal || "", tanggalInspeksi: t.tanggalInspeksi || hariIni(), inspektor: t.inspektor || "",
        bagian: t.bagian, komponen: t.komponen, uraian: t.uraian, tindakan: t.tindakan,
        tingkat: t.tingkat, sumber: t.sumber,
      })));
      setKabar({ teks: `${d.temuan.length} calon temuan terbaca — periksa dulu sebelum disimpan`, nada: "sukses" });
    } catch (e: any) {
      setKabar({ teks: e?.message || "Gagal membaca berkas", nada: "gagal" });
    } finally {
      setImporSibuk("");
      if (docxRef.current) docxRef.current.value = "";
    }
  };

  /**
   * Tempelan dari Word/Excel. Kolom dipisah tab (Excel) atau dua spasi/|
   * (salinan tabel Word). Urutan yang diharapkan: komponen, uraian, tindakan —
   * sisanya ditebak dari isinya.
   */
  const bacaTempel = () => {
    const rows = tempel.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const hasil: BarisImpor[] = [];
    for (const r of rows) {
      const kol = r.split(/\t|\s*\|\s*|\s{3,}/).map((x) => x.trim()).filter(Boolean);
      if (!kol.length) continue;
      if (/^no\b/i.test(kol[0]) && kol.length > 1) continue;          // baris judul
      const angkaDepan = /^\d+[.)]?$/.test(kol[0]);
      const isi = angkaDepan ? kol.slice(1) : kol;
      if (!isi.length) continue;
      const komponen = isi[0] || "";
      const uraian = isi[1] || isi[0] || "";
      const tindakan = isi[2] || "";
      hasil.push(barisImporBaru({
        komponen, uraian, tindakan,
        bagian: tebakBagian(`${komponen} ${uraian}`),
        tingkat: tebakTingkat(`${komponen} ${uraian}`),
        sumber: "tempel",
      }));
    }
    if (!hasil.length) { setKabar({ teks: "Tidak ada baris yang terbaca dari tempelan", nada: "gagal" }); return; }
    setImporBaris((l) => [...l, ...hasil]);
    setTempel("");
    setKabar({ teks: `${hasil.length} baris ditambahkan — periksa dulu`, nada: "sukses" });
  };

  const simpanImpor = async () => {
    const dipilih = imporBaris.filter((b) => b.pilih && b.kapal && (b.komponen || b.uraian));
    if (!dipilih.length) { setKabar({ teks: "Belum ada baris siap simpan (kapal wajib diisi)", nada: "gagal" }); return; }
    setImporSibuk("Menyimpan…");
    try {
      const r = await fetch("/api/inspeksi/daftar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temuan: dipilih.map(({ kunci, pilih, ...t }) => t) }),
      });
      const d = await r.json();
      if (!d.ok) { setKabar({ teks: d.error || "Gagal menyimpan", nada: "gagal" }); return; }
      setKabar({ teks: `${d.jumlah} temuan tersimpan ✓`, nada: "sukses" });
      setImporBaris([]); setImporBuka(false);
      await ambil();
    } catch (e: any) {
      setKabar({ teks: e?.message || "Gagal menyimpan", nada: "gagal" });
    } finally { setImporSibuk(""); }
  };

  const ubahImpor = (kunci: string, isi: Partial<BarisImpor>) =>
    setImporBaris((l) => l.map((b) => (b.kunci === kunci ? { ...b, ...isi } : b)));

  /** samakan kapal/tanggal/inspektor untuk seluruh baris sekaligus */
  const samakan = (isi: Partial<BarisImpor>) => setImporBaris((l) => l.map((b) => ({ ...b, ...isi })));

  const ringkasWa = () => {
    const perKapal = new Map<string, Temuan[]>();
    baris.filter((t) => t.status !== "selesai").forEach((t) =>
      perKapal.set(t.kapal, [...(perKapal.get(t.kapal) || []), t]));
    const baris2 = Array.from(perKapal.entries()).sort((a, b) => b[1].length - a[1].length)
      .map(([k, isi]) => `• ${k}: ${isi.length} terbuka${isi.filter(lewatTarget).length ? `, ${isi.filter(lewatTarget).length} lewat tenggat` : ""}`);
    return `*Rekap Temuan Inspeksi Kapal*\n${tglSingkat(hariIni())}\n\n`
      + `Total terbuka: ${ringkas.terbuka} dari ${ringkas.total} temuan\n`
      + `Lewat tenggat: ${ringkas.terlambat}\nKritis belum tertutup: ${ringkas.kritis}\n\n`
      + baris2.join("\n");
  };

  const tautanPermintaan = (t: Temuan) => {
    const p = new URLSearchParams({
      kapal: t.kapal,
      bagian: t.bagian === "mesin" ? "mesin" : "deck",
      uraian: t.komponen || t.uraian,
      spesifikasi: t.uraian.slice(0, 120),
      dasar: `Tindak lanjut temuan inspeksi ${tglSingkat(t.tanggalInspeksi)}`,
    });
    return `/uji-permintaan?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 text-2xl text-white shadow-lg">🔍</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-amber-800 ring-1 ring-amber-200">Marine Superintendent</span>
              {ringkas.terlambat > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 ring-1 ring-rose-200">● {ringkas.terlambat} LEWAT TENGGAT</span>
              )}
            </div>
            <h1 className="asdp-text-gradient text-2xl font-extrabold leading-tight">Inspeksi Kapal &amp; Tindak Lanjut</h1>
            <p className="mt-0.5 text-sm text-slate-500">Temuan dipantau sampai tertutup — dengan bukti perbaikan, bukan sekadar dicentang.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setImporBuka(true)} className="btn btn-primary text-xs">＋ Laporan / Temuan</button>
            <a href="/api/inspeksi/ekspor" className="btn btn-ghost text-xs">⬇ Excel</a>
            <a href={tautanWa(ringkasWa())} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">💬 Ringkasan WA</a>
            <button onClick={ambil} disabled={muat} className="btn btn-ghost text-xs disabled:opacity-50">{muat ? "Memuat…" : "⟳ Muat ulang"}</button>
          </div>
        </div>
      </header>

      {galat && <div className="anim-in mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}

      {/* ── angka pantau ─────────────────────────────────────────────────── */}
      <section className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Kpi ikon="📌" label="Temuan Terbuka" nilai={String(ringkas.terbuka)} ket={`dari ${ringkas.total} temuan`} warna="sky" />
        <Kpi ikon="⏰" label="Lewat Tenggat" nilai={String(ringkas.terlambat)} ket="harus ditagih" warna="rose" />
        <Kpi ikon="🚨" label="Kritis Terbuka" nilai={String(ringkas.kritis)} ket="menyangkut keselamatan" warna="amber" />
        <Kpi ikon="✅" label="Selesai Bulan Ini" nilai={String(ringkas.selesaiBulanIni)} ket={`${ringkas.persen}% penutupan`} warna="emerald" />
        <Kpi ikon="📅" label="Temuan Tertua" nilai={`${ringkas.tertua} hr`} ket="sejak diinspeksi" warna="indigo" />
      </section>

      {/* ── umur temuan ──────────────────────────────────────────────────── */}
      <section className="mb-5 rounded-2xl bg-white p-4 elev-sm ring-line dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">Umur temuan yang belum tertutup</h2>
          <span className="text-[10px] text-slate-400">dihitung sejak tanggal inspeksi</span>
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-lg ring-1 ring-slate-200">
          {[
            { n: umur.baru, w: "bg-emerald-500", l: "0–14 hari" },
            { n: umur.sedang, w: "bg-amber-500", l: "15–30 hari" },
            { n: umur.lama, w: "bg-rose-600", l: "lebih dari 30 hari" },
          ].map((x) => {
            const total = umur.baru + umur.sedang + umur.lama || 1;
            return (
              <div key={x.l} title={`${x.l}: ${x.n} temuan`}
                className={`${x.w} grid place-items-center text-[10px] font-bold text-white transition-all`}
                style={{ width: `${(x.n / total) * 100}%` }}>
                {x.n > 0 ? x.n : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span><b className="text-emerald-700">{umur.baru}</b> baru (0–14 hari)</span>
          <span><b className="text-amber-700">{umur.sedang}</b> tertahan (15–30 hari)</span>
          <span><b className="text-rose-700">{umur.lama}</b> menganggur (&gt;30 hari)</span>
        </div>
      </section>

      {/* ── matriks kapal × bagian ───────────────────────────────────────── */}
      <section className="mb-5 overflow-hidden rounded-3xl bg-white elev-md ring-line dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-amber-50/60 px-4 py-3 dark:border-slate-700">
          <h2 className="font-extrabold text-slate-900">Temuan Terbuka per Kapal</h2>
          <p className="text-[11px] text-slate-500">Angka merah berarti ada temuan kritis yang belum tertutup. Klik untuk menyaring.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/90 text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="sticky left-0 z-10 min-w-[11rem] border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-left dark:bg-slate-800">Kapal</th>
                {BAGIAN_INSPEKSI.map((b) => (
                  <th key={b.id} className="border-b border-slate-200 px-2 py-2.5 text-center">{b.ikon} {b.label}</th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2.5 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {KAPAL_ANGGARAN.map((k, i) => {
                const total = BAGIAN_INSPEKSI.reduce((s, b) => s + (matriks.get(`${k}|${b.id}`)?.terbuka || 0), 0);
                return (
                  <tr key={k} className="group hover:bg-amber-50/50">
                    <td className={`sticky left-0 z-[5] border-b border-slate-100 px-4 py-2 font-bold text-slate-800 group-hover:bg-amber-50 dark:border-slate-800 dark:text-slate-100 ${i % 2 ? "bg-slate-50/95 dark:bg-slate-900" : "bg-white dark:bg-slate-900"}`}>
                      <span className="mr-2 text-[10px] font-medium tabular-nums text-slate-400">{String(i + 1).padStart(2, "0")}</span>{k}
                    </td>
                    {BAGIAN_INSPEKSI.map((b) => {
                      const s = matriks.get(`${k}|${b.id}`);
                      return (
                        <td key={b.id} className="border-b border-slate-100 px-2 py-2 text-center dark:border-slate-800">
                          {s?.terbuka ? (
                            <button onClick={() => { setKapal(k); setBagian(b.id); setStatus(""); document.getElementById("daftar-temuan")?.scrollIntoView({ behavior: "smooth" }); }}
                              className={`inline-grid h-7 min-w-[1.75rem] place-items-center rounded-lg px-1.5 text-xs font-extrabold ring-1 transition hover:-translate-y-0.5 ${
                                s.kritis ? "bg-rose-100 text-rose-700 ring-rose-300" : "bg-amber-50 text-amber-800 ring-amber-200"}`}
                              title={`${s.terbuka} terbuka dari ${s.total} temuan`}>
                              {s.terbuka}
                            </button>
                          ) : s?.total ? (
                            <span className="text-[11px] font-bold text-emerald-600" title={`${s.total} temuan, semua tertutup`}>✓</span>
                          ) : <span className="text-slate-300">·</span>}
                        </td>
                      );
                    })}
                    <td className="border-b border-slate-100 px-3 py-2 text-center text-xs font-extrabold tabular-nums dark:border-slate-800">
                      {total || <span className="text-slate-300">0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── saringan ─────────────────────────────────────────────────────── */}
      <section id="daftar-temuan" className="mb-4 scroll-mt-4 rounded-2xl bg-white p-3 elev-sm ring-line dark:bg-slate-900">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-extrabold text-slate-800">Daftar Temuan</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">{tampil.length} dari {baris.length}</span>
            {(kapal || bagian || tingkat || status || cari || hanyaTerlambat) && (
              <button onClick={() => { setKapal(""); setBagian(""); setTingkat(""); setStatus(""); setCari(""); setHanyaTerlambat(false); }}
                className="text-[10px] font-bold text-slate-500 hover:text-rose-600">✕ Reset</button>
            )}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari komponen, uraian, inspektor…"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm lg:col-span-4 dark:border-slate-700" />
          <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua kapal</option>
            {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={bagian} onChange={(e) => setBagian(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua bagian</option>
            {BAGIAN_INSPEKSI.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <select value={tingkat} onChange={(e) => setTingkat(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua klasifikasi</option>
            {TINGKAT_TEMUAN.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua status</option>
            {STATUS_TEMUAN.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 lg:col-span-3">
            <input type="checkbox" checked={hanyaTerlambat} onChange={(e) => setHanyaTerlambat(e.target.checked)} className="accent-rose-600" />
            Hanya yang lewat tenggat
          </label>
        </div>
      </section>

      {/* ── daftar ───────────────────────────────────────────────────────── */}
      {muat ? (
        <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/75 ring-1 ring-slate-200" />)}</div>
      ) : !tampil.length ? (
        <div className="rounded-3xl bg-white p-10 text-center elev-sm ring-line dark:bg-slate-900">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-xl">🔍</div>
          <p className="mt-3 font-bold text-slate-700">{baris.length ? "Tidak ada temuan yang cocok" : "Belum ada temuan tercatat"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {baris.length ? "Ubah atau reset saringan." : "Tekan “＋ Laporan / Temuan” untuk mengunggah laporan inspeksi atau menempel tabelnya."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {tampil.map((t) => {
            const telat = lewatTarget(t);
            return (
              <article key={t.id} className={`group relative overflow-hidden rounded-2xl bg-white p-4 elev-sm ring-line transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 ${sorot === t.id ? "ring-2 ring-emerald-400" : ""}`}>
                <span className={`absolute inset-y-0 left-0 w-1 ${
                  t.status === "selesai" ? "bg-emerald-500" : telat ? "bg-rose-600" : t.status === "proses" ? "bg-sky-500" : t.status === "tunggu" ? "bg-amber-500" : "bg-slate-300"}`} />
                <div className="flex flex-wrap items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg ring-1 ring-slate-200 dark:bg-slate-800">
                    {BAGIAN_INSPEKSI.find((b) => b.id === t.bagian)?.ikon || "📌"}
                  </div>
                  <div className="min-w-[240px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-900">{t.komponen || "(tanpa nama komponen)"}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${kelasTingkat(t.tingkat)}`}>{labelTingkat(t.tingkat)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${kelasStatus(t.status)}`}>{labelStatus(t.status)}</span>
                      {telat && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white">LEWAT {Math.max(0, Math.floor((Date.now() - new Date(`${t.targetSelesai}T00:00:00`).getTime()) / 86400000))} HARI</span>}
                      {simpanId === t.id && <span className="text-[10px] font-bold text-sky-600">menyimpan…</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{t.uraian}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">🚢 {t.kapal}</span>
                      <span>{BAGIAN_INSPEKSI.find((b) => b.id === t.bagian)?.ikon} {labelBagian(t.bagian)}</span>
                      <span>📅 {tglSingkat(t.tanggalInspeksi)} · {umurHari(t)} hari</span>
                      <span>🎯 target {tglSingkat(t.targetSelesai)}</span>
                      {t.bukti.length > 0 && <span>📎 {t.bukti.length} bukti</span>}
                      {t.inspektor && <span>👤 {t.inspektor}</span>}
                    </div>
                  </div>
                  <button onClick={() => setBuka(t)} className="btn btn-primary shrink-0 text-xs">Buka →</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── panel detail ─────────────────────────────────────────────────── */}
      {buka && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={() => setBuka(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{buka.komponen || "Temuan"}</h3>
                <p className="text-sm text-slate-600">{buka.kapal} · {labelBagian(buka.bagian)} · inspeksi {tglSingkat(buka.tanggalInspeksi)}</p>
              </div>
              <button onClick={() => setBuka(null)} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-4 p-5">
              {/* status */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Status penanganan</span>
                  <span className="text-[11px] text-slate-400">
                    {simpanId === buka.id ? "menyimpan…"
                      : buka.riwayat.length ? `terakhir diubah ${waktuSingkat(buka.riwayat[buka.riwayat.length - 1].pada)}` : "belum pernah diubah"}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {STATUS_TEMUAN.map((s) => {
                    const aktif = buka.status === s.id;
                    return (
                      <button key={s.id} type="button" disabled={simpanId === buka.id}
                        onClick={() => !aktif && ubah(buka.id, { status: s.id })}
                        className={`rounded-xl px-2 py-2 text-xs font-extrabold ring-1 transition disabled:opacity-60 ${
                          aktif ? "text-white shadow" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}
                        style={aktif ? { backgroundColor: s.warna, borderColor: s.warna } : undefined}>
                        {aktif && <span className="mr-1">✓</span>}{s.label}
                      </button>
                    );
                  })}
                </div>
                {buka.status !== "selesai" && !!bolehTutup(buka).length && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 ring-1 ring-amber-200">
                    Belum bisa ditutup: {bolehTutup(buka).join(" · ")}.
                  </p>
                )}
                {!!buka.riwayat.length && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Jejak: {buka.riwayat.slice(-4).map((j) => `${labelStatus(j.status)} (${waktuSingkat(j.pada)})`).join(" → ")}
                  </p>
                )}
              </div>

              {/* isi temuan */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Isian label="Uraian temuan" nilai={buka.uraian} baris={3} simpan={(v) => ubah(buka.id, { uraian: v }, { diam: true })} />
                <Isian label="Tindakan / rekomendasi" nilai={buka.tindakan} baris={3} simpan={(v) => ubah(buka.id, { tindakan: v }, { diam: true })} />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Klasifikasi</span>
                  <select value={buka.tingkat} onChange={(e) => ubah(buka.id, { tingkat: e.target.value })}
                    className="w-full rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-300">
                    {TINGKAT_TEMUAN.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.ket}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Target selesai</span>
                  <input type="date" value={buka.targetSelesai} onChange={(e) => ubah(buka.id, { targetSelesai: e.target.value })}
                    className="w-full rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-300" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Penanggung jawab</span>
                  <select value={buka.penanggungJawab} onChange={(e) => ubah(buka.id, { penanggungJawab: e.target.value })}
                    className="w-full rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-300">
                    <option value="kapal">Kapal (ABK)</option>
                    <option value="darat">Darat (Teknik cabang)</option>
                    <option value="galangan">Galangan / pihak ketiga</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Diverifikasi oleh</span>
                  <input defaultValue={buka.diverifikasiOleh} placeholder="nama pemeriksa"
                    onBlur={(e) => e.target.value !== buka.diverifikasiOleh && ubah(buka.id, { diverifikasiOleh: e.target.value }, { diam: true })}
                    className="w-full rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-300" />
                </label>
              </div>

              {/* bukti */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Bukti (Google Drive)</span>
                  <div className="flex gap-2">
                    <button onClick={() => pilihBukti("sebelum")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">📷 Kondisi awal</button>
                    <button onClick={() => pilihBukti("sesudah")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">📷 Bukti perbaikan</button>
                  </div>
                </div>
                <input ref={berkasRef} type="file" multiple accept={ACCEPT_BERKAS} className="hidden" onChange={(e) => kirimBukti(e.target.files)} />
                {unggah && <p className="mb-2 text-xs text-sky-700">{unggah}</p>}
                {!buka.bukti.length ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
                    Belum ada bukti. Temuan tidak bisa ditutup sebelum ada bukti perbaikan.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {buka.bukti.map((b) => (
                      <li key={b.fileId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          b.jenis === "sesudah" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {b.jenis === "sesudah" ? "perbaikan" : "awal"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{b.nama}</span>
                        <span className="shrink-0 text-xs text-slate-500">{ukuranSingkat(b.ukuran || 0)}</span>
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700">Buka</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Isian label="Catatan penutupan" nilai={buka.catatanTutup} baris={2}
                simpan={(v) => ubah(buka.id, { catatanTutup: v }, { diam: true })} />

              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={tautanPermintaan(buka)} target="_blank"
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                  🧾 Buat permintaan barang
                </Link>
                <button onClick={() => hapus(buka)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50">
                  Hapus temuan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── impor ────────────────────────────────────────────────────────── */}
      {imporBuka && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={() => setImporBuka(false)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-5xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Tambah temuan inspeksi</h3>
                <p className="text-sm text-slate-600">Unggah laporan .docx, tempel tabelnya, atau ketik sendiri. Semua ditinjau dulu sebelum disimpan.</p>
              </div>
              <button onClick={() => setImporBuka(false)} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">1. Dari laporan Word</div>
                  <input ref={docxRef} type="file" accept=".docx" onChange={(e) => bacaDocx(e.target.files?.[0])}
                    className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:font-semibold file:text-white" />
                  <p className="mt-1 text-[11px] text-slate-500">Tabel resume ketidaksesuaian dibaca otomatis. Berkas .doc lama: simpan dulu sebagai .docx.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">2. Tempel tabel</div>
                  <textarea value={tempel} onChange={(e) => setTempel(e.target.value)} rows={3}
                    placeholder="Salin baris tabel dari Word/Excel lalu tempel di sini"
                    className="mt-2 w-full rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-300" />
                  <button onClick={bacaTempel} disabled={!tempel.trim()} className="mt-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:bg-slate-300">Baca tempelan</button>
                </div>
              </div>

              {!!imporBaris.length && (
                <>
                  <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
                    <span className="text-xs font-bold text-amber-900">Samakan untuk semua baris:</span>
                    <select onChange={(e) => samakan({ kapal: e.target.value })} defaultValue=""
                      className="rounded-lg px-2 py-1.5 text-sm ring-1 ring-amber-300">
                      <option value="">— pilih kapal —</option>
                      {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input type="date" onChange={(e) => samakan({ tanggalInspeksi: e.target.value })}
                      className="rounded-lg px-2 py-1.5 text-sm ring-1 ring-amber-300" />
                    <input placeholder="nama superintendent" onBlur={(e) => e.target.value && samakan({ inspektor: e.target.value })}
                      className="rounded-lg px-2 py-1.5 text-sm ring-1 ring-amber-300" />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[60rem] text-sm">
                      <thead className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-8 px-1 py-2"><input type="checkbox" checked={imporBaris.every((b) => b.pilih)}
                            onChange={(e) => setImporBaris((l) => l.map((b) => ({ ...b, pilih: e.target.checked })))} /></th>
                          <th className="px-1 py-2 text-left">Kapal</th>
                          <th className="px-1 py-2 text-left">Komponen</th>
                          <th className="px-1 py-2 text-left">Uraian temuan</th>
                          <th className="px-1 py-2 text-left">Tindakan</th>
                          <th className="px-1 py-2 text-left">Bagian</th>
                          <th className="px-1 py-2 text-left">Klasifikasi</th>
                          <th className="w-10 px-1 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {imporBaris.map((b) => (
                          <tr key={b.kunci} className="border-t border-slate-100 align-top">
                            <td className="px-1 py-1.5"><input type="checkbox" checked={b.pilih} onChange={(e) => ubahImpor(b.kunci, { pilih: e.target.checked })} /></td>
                            <td className="px-1 py-1.5">
                              <select value={b.kapal} onChange={(e) => ubahImpor(b.kunci, { kapal: e.target.value })}
                                className={`w-36 rounded-lg px-2 py-1.5 text-xs ring-1 ${b.kapal ? "ring-slate-300" : "ring-rose-300 bg-rose-50"}`}>
                                <option value="">— kapal —</option>
                                {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-1.5"><input value={b.komponen} onChange={(e) => ubahImpor(b.kunci, { komponen: e.target.value })} className="w-44 rounded-lg px-2 py-1.5 text-xs ring-1 ring-slate-300" /></td>
                            <td className="px-1 py-1.5"><textarea value={b.uraian} rows={2} onChange={(e) => ubahImpor(b.kunci, { uraian: e.target.value })} className="w-72 rounded-lg px-2 py-1.5 text-xs ring-1 ring-slate-300" /></td>
                            <td className="px-1 py-1.5"><textarea value={b.tindakan} rows={2} onChange={(e) => ubahImpor(b.kunci, { tindakan: e.target.value })} className="w-52 rounded-lg px-2 py-1.5 text-xs ring-1 ring-slate-300" /></td>
                            <td className="px-1 py-1.5">
                              <select value={b.bagian} onChange={(e) => ubahImpor(b.kunci, { bagian: e.target.value as BagianInspeksi })} className="rounded-lg px-2 py-1.5 text-xs ring-1 ring-slate-300">
                                {BAGIAN_INSPEKSI.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-1.5">
                              <select value={b.tingkat} onChange={(e) => ubahImpor(b.kunci, { tingkat: e.target.value as TingkatTemuan })} className="rounded-lg px-2 py-1.5 text-xs ring-1 ring-slate-300">
                                {TINGKAT_TEMUAN.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-1.5 text-right">
                              <button onClick={() => setImporBaris((l) => l.filter((x) => x.kunci !== b.kunci))} className="text-xs font-bold text-rose-600 hover:text-rose-800">hapus</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setImporBaris((l) => [...l, barisImporBaru({ kapal: imporBaris[0]?.kapal || "", tanggalInspeksi: imporBaris[0]?.tanggalInspeksi || hariIni(), inspektor: imporBaris[0]?.inspektor || "" })])}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">＋ Baris kosong</button>
                <button onClick={simpanImpor} disabled={!imporBaris.length || !!imporSibuk}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300">
                  {imporSibuk || `Simpan ${imporBaris.filter((b) => b.pilih && b.kapal).length} temuan`}
                </button>
                {imporBaris.some((b) => b.pilih && !b.kapal) && (
                  <span className="text-xs text-rose-700">Ada baris yang kapalnya belum dipilih — baris itu tidak akan tersimpan.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {kabar && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
          <div className={`anim-in flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-2xl ring-1 ${
            kabar.nada === "sukses" ? "bg-emerald-600 text-white ring-emerald-700"
              : kabar.nada === "gagal" ? "bg-rose-600 text-white ring-rose-700"
                : "bg-slate-900 text-white ring-slate-800"}`}>
            <span className="text-base">{kabar.nada === "sukses" ? "✓" : kabar.nada === "gagal" ? "⚠" : "⏳"}</span>
            <span>{kabar.teks}</span>
            <button onClick={() => setKabar(null)} aria-label="Tutup" className="text-white/70 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </main>
  );
}

/** isian teks yang menyimpan saat ditinggalkan — dipakai di panel detail */
function Isian({ label, nilai, baris, simpan }: {
  label: string; nilai: string; baris: number; simpan: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea defaultValue={nilai} rows={baris}
        onBlur={(e) => e.target.value !== nilai && simpan(e.target.value)}
        className="w-full rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-300" />
    </label>
  );
}

function Kpi({ ikon, label, nilai, ket, warna }: {
  ikon: string; label: string; nilai: string; ket: string;
  warna: "sky" | "rose" | "amber" | "emerald" | "indigo";
}) {
  const tema = {
    sky: "bg-sky-100 text-sky-700", rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
  }[warna];
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${tema}`}>{ikon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.11em] text-slate-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <strong className="text-xl font-extrabold leading-none tabular-nums text-slate-900">{nilai}</strong>
          <span className="truncate text-[9px] text-slate-400">{ket}</span>
        </div>
      </div>
    </div>
  );
}

export default function InspeksiKapal() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-10 text-slate-500">Memuat…</main>}>
      <IsiInspeksi />
    </Suspense>
  );
}
