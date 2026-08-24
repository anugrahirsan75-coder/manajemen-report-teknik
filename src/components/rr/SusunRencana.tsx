"use client";
/**
 * Susun usulan bulanan dari riwayat pengadaan kapal, dengan kendali RKA.
 *
 * Bentuk layarnya menuruti cara orang menyusunnya: pertama melihat SISA PAGU
 * (berapa yang boleh diusulkan), baru memilih barang. Karena itu papan pagu
 * berada di atas dan ikut bergerak tiap kali satu barang dicentang — bukan
 * angka yang baru muncul setelah semuanya terlanjur dipilih.
 *
 * Yang dipilih di sini BELUM masuk dokumen; penambahan terjadi sekali, saat
 * tombol di kaki ditekan.
 */
import { useEffect, useMemo, useState } from "react";
import { rupiah } from "@/lib/format";
import { labelMA } from "@/lib/anggaran/types";
import { KELOMPOK_RR, kunciKelompok, namaBulan } from "@/lib/rr/types";
import { tentukanKelompok } from "@/lib/rr/penempatan";
import {
  BarisKendali, Kandidat, isiOtomatis, nilaiKandidat, susunKendali,
} from "@/lib/rr/usulanRiwayat";

export interface PilihanUsulan {
  kandidat: Kandidat;
  jumlah: number;
  harga: number;
}

export default function SusunRencana({
  buka, tutup, bulan, kapal, kandidat, pagu, kapalLain, kapalIni, kapalBelum, dipakaiBulanLalu,
  kapalOpsi, gantiKapal, isiSemua, tambah,
}: {
  buka: boolean;
  tutup: () => void;
  bulan: string;
  kapal: string;
  kandidat: Kandidat[];
  pagu: Record<string, number>;
  kapalLain: Record<string, number>;
  kapalIni: Record<string, number>;
  /** kapal yang usulannya belum terisi bulan ini, termasuk kapal ini — dasar pembagian jatah */
  kapalBelum: number;
  /** nama barang yang dipakai rencana bulan lalu — diberi penalti supaya usulan tak jadi salinan */
  dipakaiBulanLalu?: Set<string>;
  /** seluruh kapal beserta keadaan usulannya bulan ini — untuk berpindah tanpa menutup layar */
  kapalOpsi?: { nama: string; status: "kosong" | "draf" | "terkirim"; nilai: number }[];
  gantiKapal?: (kapal: string) => void;
  /** isi seluruh kapal yang masih kosong sekali jalan — dikerjakan halaman induk */
  isiSemua?: (opsi: { armada: boolean; db: boolean }) => void;
  tambah: (pilihan: PilihanUsulan[], lanjut?: boolean) => void;
}) {
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [ubahan, setUbahan] = useState<Record<string, { jumlah?: number; harga?: number }>>({});
  const [cari, setCari] = useState("");
  /**
   * Pagu itu milik CABANG, bukan milik satu kapal. Tanpa pembagian, isi otomatis
   * satu kapal bisa menghabiskan pagu sebulan seluruh armada — dan kapal
   * berikutnya menemukan pagunya sudah habis padahal belum menyusun apa pun.
   */
  const [modeJatah, setModeJatah] = useState<"rata" | "penuh">("rata");
  /**
   * Variasi menyala secara bawaan. Usulan yang tiap bulan sama persis — barang
   * sama, jumlah sama, urutan sama — terbaca sebagai salinan bulan lalu, bukan
   * sebagai perencanaan. Benihnya disimpan supaya susunan yang sama bisa
   * ditampilkan ulang, dan tombol Acak ulang menggantinya.
   */
  const [variasi, setVariasi] = useState(true);
  const [benih, setBenih] = useState(1);
  const [maSaring, setMaSaring] = useState("");
  const [pesan, setPesan] = useState("");
  /** kapal tujuan yang menunggu keputusan, karena pilihan di layar belum ditambahkan */
  const [pindahKe, setPindahKe] = useState("");
  /**
   * Barang yang diketik sendiri. Riwayat tak pernah memuat kebutuhan baru —
   * mesin yang baru dipasang, temuan survei bulan ini — dan memaksa orang
   * menutup layar ini hanya untuk mengetik satu baris membuat seluruh
   * hitungan jatah di layar ini kehilangan gunanya.
   */
  const [manual, setManual] = useState<Kandidat[]>([]);
  /**
   * Dua sumber tambahan, keduanya bisa dimatikan.
   *
   * Riwayat SATU kapal cuma puluhan barang — setelah dipecah per Mata Anggaran
   * kerap tak cukup memenuhi jatah sebulan. Armada memakai barang yang sebagian
   * besar sama, dan database harga memuat 60 ribu barang dari berkas RAB
   * 2024-2026. Keduanya ditandai asalnya, jadi tetap kelihatan mana kebiasaan
   * kapal ini sendiri.
   */
  const [pakaiArmada, setPakaiArmada] = useState(true);
  const [pakaiDb, setPakaiDb] = useState(false);
  const [kandidatDb, setKandidatDb] = useState<Kandidat[]>([]);
  const [muatDb, setMuatDb] = useState(false);

  /** pencarian ke database harga (60 ribu item hasil pemindaian berkas RAB) */
  const [cariDb, setCariDb] = useState("");
  const [hasilDb, setHasilDb] = useState<any[]>([]);
  const [sibukDb, setSibukDb] = useState(false);
  const [bukaDb, setBukaDb] = useState(false);

  useEffect(() => {
    if (!buka) return;
    setPilih(new Set()); setUbahan({}); setCari(""); setMaSaring(""); setPesan(""); setModeJatah("rata");
    setVariasi(true); setPindahKe(""); setManual([]);
    setCariDb(""); setHasilDb([]); setBukaDb(false);
    setPakaiDb(false); setKandidatDb([]); setPakaiArmada(true);
    // benih diturunkan dari bulan & kapal: membuka layar yang sama dua kali
    // memberi susunan yang sama, tapi kapal lain tetap dapat susunan berbeda
    setBenih(Array.from(`${bulan}|${kapal}`).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7));
  }, [buka, bulan, kapal]);

  /**
   * Peta Mata Anggaran -> kategori database harga. Tanpa peta ini, seluruh
   * 60 ribu barang akan diusulkan untuk MA mana pun — pelumas masuk permesinan,
   * suku cadang masuk akomodasi, dan hasilnya tak bisa dipertanggungjawabkan.
   */
  const KATEGORI_MA: Record<string, string[]> = useMemo(() => ({
    "5010303001": ["Bahan Bakar & Pelumas"],
    "5010403009": ["Akomodasi & Interior Deck", "Bahan Kebersihan & Pantry", "Alat Keselamatan",
      "Alat Navigasi & Komunikasi", "Perlengkapan Kapal & Tali Temali", "Alat Kerja & Consumable",
      "Perawatan Rutin & Kebersihan Kapal (Jasa)"],
    "5010403100": ["Suku Cadang Mesin", "Permesinan & Kelistrikan", "Kelistrikan & Penerangan",
      "Perpipaan & Katup", "Alat Kerja & Consumable"],
    "5010403003": ["Konstruksi, Replating & Fabrikasi", "Cat, Thinner & Material Coating",
      "Zinc Anode & Proteksi Katodik", "Blasting & Persiapan Permukaan"],
  }), []);

  /**
   * Peta balik: kategori database -> Mata Anggaran. Tanpa ini, barang yang
   * dimasukkan lewat pencarian jatuh ke kelompok pertama (Pelumas) apa pun
   * isinya — kunci pas pun tercatat sebagai pelumas.
   */
  const maDariKategori = useMemo(() => {
    const peta: Record<string, string> = {};
    Object.entries(KATEGORI_MA).forEach(([kode, daftar]) =>
      daftar.forEach((kat) => { if (!peta[kat]) peta[kat] = kode; }));
    return peta;
  }, [KATEGORI_MA]);

  /**
   * Kelompok Lampiran 3 untuk satu baris database: Mata Anggarannya dari
   * kategori, JUDULNYA dari nama barangnya sendiri lewat aturan penempatan —
   * "Service Dinamo Starter" harus jatuh ke Service / Perbaikan, bukan ke
   * kelompok pertama Mata Anggaran itu.
   */
  const kelompokUntuk = (kategori: string | undefined, uraian: string, spek: string) => {
    const kode = (kategori && maDariKategori[kategori]) || maSaring || KELOMPOK_RR[0].kode;
    const tempat = tentukanKelompok(kode, "", uraian || "", spek || "");
    if (tempat.kunci) return { kunci: tempat.kunci, kode, judul: tempat.judul };
    const kel = KELOMPOK_RR.find((k) => k.kode === kode) || KELOMPOK_RR[0];
    return { kunci: kunciKelompok(kel), kode: kel.kode, judul: kel.judul };
  };

  /** ambil barang database harga untuk Mata Anggaran yang punya jatah */
  useEffect(() => {
    if (!buka || !pakaiDb) { if (!pakaiDb) setKandidatDb([]); return; }
    let batal = false;
    (async () => {
      setMuatDb(true);
      try {
        const kumpul: Kandidat[] = [];
        for (const b of kendali.filter((x) => x.pagu > 0)) {
          const kat = KATEGORI_MA[b.kode];
          if (!kat) continue;
          // barang yang harganya melebihi jatah tak mungkin terpakai — jangan ikut diambil
          const jatah = Math.max(0, (b.pagu - b.kapalLain - b.kapalIni) / pembagi);
          const r = await fetch(`/api/harga/daftar?kategori=${encodeURIComponent(kat.join("|"))}`
            + `&batas=200&hargaMaks=${Math.round(jatah || 0)}`, { cache: "no-store" });
          const d = await r.json();
          (d?.hasil || []).forEach((h: any) => {
            const harga = Math.round(h.h2026 || h.h2025 || h.median || 0);
            if (!harga) return;
            const tempat = tentukanKelompok(b.kode, "", h.uraian || "", h.spek || "");
            kumpul.push({
              id: `db-${h.kode}`,
              kunci: tempat.kunci || kunciKelompok(KELOMPOK_RR.find((k) => k.kode === b.kode) || KELOMPOK_RR[0]),
              kode: b.kode, judul: tempat.judul || "Lain - Lain",
              deskripsi: h.uraian || "", spesifikasi: h.spek || "", satuan: h.satuan || "pcs",
              jumlah: 1, harga, hargaRata: Math.round(h.median || harga),
              kali: 0, bulanTerakhir: "", bulanMuncul: [],
              contohDokumen: `Database RAB · ${h.n || 0} data`, asal: "db",
            });
          });
        }
        if (!batal) setKandidatDb(kumpul);
      } catch { if (!batal) setKandidatDb([]); }
      finally { if (!batal) setMuatDb(false); }
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, pakaiDb, kapal, bulan]);

  /**
   * Pencarian ditunda 300 ms setelah ketikan berhenti. Indeksnya 60 ribu baris
   * di sisi server; memanggilnya pada tiap huruf berarti belasan permintaan
   * untuk satu kata yang sama.
   */
  useEffect(() => {
    if (!bukaDb || cariDb.trim().length < 2) { setHasilDb([]); return; }
    const t = window.setTimeout(async () => {
      setSibukDb(true);
      try {
        const r = await fetch(`/api/harga/cari?q=${encodeURIComponent(cariDb)}&batas=25`, { cache: "no-store" });
        const d = await r.json();
        setHasilDb(d?.hasil || []);
      } catch { setHasilDb([]); }
      finally { setSibukDb(false); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [cariDb, bukaDb]);

  const pembagi = modeJatah === "rata" ? Math.max(1, kapalBelum) : 1;
  /** jatah satu Mata Anggaran untuk kapal ini = sisa pagunya dibagi kapal yang belum menyusun */
  const jatahMA = (b: BarisKendali) => Math.max(0, (b.pagu - b.kapalLain - b.kapalIni) / pembagi);

  /** kandidat setelah suntingan jumlah/harga di layar ini, barang ketikan sendiri di depan */
  const denganUbahan = useMemo(() => [
    ...manual,
    ...kandidat.filter((k) => pakaiArmada || k.asal !== "armada"),
    ...kandidatDb,
  ].map((k) => ({
    ...k,
    jumlah: ubahan[k.id]?.jumlah ?? k.jumlah,
    harga: ubahan[k.id]?.harga ?? k.harga,
  })), [manual, kandidat, kandidatDb, pakaiArmada, ubahan]);

  const dipilihPerMA = useMemo(() => {
    const out: Record<string, number> = {};
    denganUbahan.forEach((k) => {
      if (pilih.has(k.id)) out[k.kode] = (out[k.kode] || 0) + nilaiKandidat(k);
    });
    return out;
  }, [denganUbahan, pilih]);

  const kendali: BarisKendali[] = useMemo(
    () => susunKendali(pagu, kapalLain, kapalIni, dipilihPerMA),
    [pagu, kapalLain, kapalIni, dipilihPerMA]);

  const total = useMemo(() => {
    const j = (f: (b: BarisKendali) => number) => kendali.reduce((s, b) => s + f(b), 0);
    return {
      pagu: j((b) => b.pagu), kapalLain: j((b) => b.kapalLain),
      kapalIni: j((b) => b.kapalIni), dipilih: j((b) => b.dipilih), sisa: j((b) => b.sisa),
    };
  }, [kendali]);

  const buatanSendiri = (id: string) => id.startsWith("ketik-");

  const tampil = useMemo(() => denganUbahan.filter((k) => {
    // barang ketikan sendiri tak pernah disembunyikan saringan — namanya bahkan
    // masih kosong saat baru dibuat, jadi pasti tak lolos pencarian apa pun
    if (buatanSendiri(k.id)) return true;
    if (maSaring && k.kode !== maSaring) return false;
    if (!cari.trim()) return true;
    const t = `${k.deskripsi} ${k.spesifikasi} ${k.judul}`.toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((x) => t.includes(x));
  }), [denganUbahan, cari, maSaring]);

  const daftarMA = useMemo(
    () => Array.from(new Set(kandidat.map((k) => k.kode))).sort(), [kandidat]);

  if (!buka) return null;

  const tambahManual = () => {
    const kel = KELOMPOK_RR.find((k) => !maSaring || k.kode === maSaring) || KELOMPOK_RR[0];
    const id = `ketik-${manual.length}-${Math.random().toString(36).slice(2, 7)}`;
    setManual((m) => [{
      id, kunci: kunciKelompok(kel), kode: kel.kode, judul: kel.judul,
      deskripsi: "", spesifikasi: "", satuan: "pcs",
      jumlah: 1, harga: 0, hargaRata: 0,
      kali: 0, bulanTerakhir: "", bulanMuncul: [], contohDokumen: "(diketik sendiri)", asal: "db",
    }, ...m]);
    setPilih((s) => new Set([...Array.from(s), id]));
  };

  /** masukkan satu baris database harga sebagai barang usulan */
  const tambahDariDb = (h: any) => {
    const kel = kelompokUntuk(h.kategori, h.uraian, h.spek);
    const id = `ketik-db-${h.kode}-${Math.random().toString(36).slice(2, 6)}`;
    // harga tahun berjalan kalau ada; kalau tidak, median seluruh riwayatnya —
    // harga 2024 pada barang yang tak pernah dibeli lagi jelas sudah usang
    const harga = h.h2026 || h.h2025 || h.median || h.lo || 0;
    setManual((m) => [{
      id, kunci: kel.kunci, kode: kel.kode, judul: kel.judul,
      deskripsi: h.uraian || "", spesifikasi: h.spek || "", satuan: h.satuan || "pcs",
      jumlah: 1, harga: Math.round(harga), hargaRata: Math.round(h.median || harga),
      kali: 0, bulanTerakhir: "", bulanMuncul: [],
      contohDokumen: `Database RAB · ${h.n || 0} data`, asal: "db",
    }, ...m]);
    setPilih((s) => new Set([...Array.from(s), id]));
  };

  const ubahManual = (id: string, patch: Partial<Kandidat>) =>
    setManual((m) => m.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const hapusManual = (id: string) => {
    setManual((m) => m.filter((k) => k.id !== id));
    setPilih((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const alih = (id: string) =>
    setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const otomatis = () => {
    /** jatah kapal ini = (pagu − rencana kapal lain − isi dokumen ini) dibagi kapal yang belum menyusun */
    const sisa: Record<string, number> = {};
    kendali.forEach((b) => { sisa[b.kode] = Math.max(0, (b.pagu - b.kapalLain - b.kapalIni) / pembagi); });
    const h = isiOtomatis(denganUbahan, sisa, {
      sudahDipilih: pilih, acak: variasi, benih, variasiJumlah: variasi, hindari: dipakaiBulanLalu,
    });
    setPilih(h.pilih);
    // jumlah hasil variasi ikut dipasang, bukan cuma dipakai menghitung —
    // kalau tidak, nilai di layar akan beda dengan yang barusan dihitung
    if (Object.keys(h.jumlahSaran).length) {
      setUbahan((u) => {
        const n = { ...u };
        Object.entries(h.jumlahSaran).forEach(([id, jml]) => { n[id] = { ...n[id], jumlah: jml }; });
        return n;
      });
    }
    const jatahTotal = Object.values(sisa).reduce((s, v) => s + v, 0);
    const dipakai = Object.values(h.terpakai).reduce((s, v) => s + v, 0);
    const persen = jatahTotal ? Math.round((dipakai / jatahTotal) * 100) : 0;
    const kurang = h.kurang.filter((x) => x.sisa > 0);
    setPesan(
      `${h.pilih.size} barang terpilih senilai ${rupiah(dipakai)} — ${persen}% dari jatah ${rupiah(jatahTotal)}`
      + (modeJatah === "rata" ? ` (sisa pagu dibagi ${pembagi} kapal)` : "")
      + (variasi ? " · susunan divariasikan, tekan Acak ulang untuk kombinasi lain." : ".")
      + (kurang.length
        // riwayat Mata Anggaran ini terlalu sedikit/terlalu mahal untuk memenuhi jatahnya —
        // yang menyusun perlu tahu MA mana, bukan cuma melihat angka totalnya kurang
        ? ` Riwayat belum cukup untuk ${kurang.map((k) => `${labelMA(k.kode)} (${h.capai[k.kode] || 0}%)`).join(", ")} — sisanya diketik sendiri.`
        : ""));
  };

  const kirim = (lanjut = false) => {
    const isi = denganUbahan.filter((k) => pilih.has(k.id))
      .map((k) => ({ kandidat: k, jumlah: k.jumlah, harga: k.harga }));
    if (!isi.length) return;
    tambah(isi, lanjut);
  };

  /**
   * Pindah kapal tanpa menutup layar.
   *
   * Pilihan yang belum ditambahkan TIDAK dibuang diam-diam: berpindah kapal
   * mengganti seluruh daftar kandidat, dan pekerjaan memilih lima puluh barang
   * terlalu mahal untuk hilang karena satu klik yang salah sasaran.
   */
  const mintaPindah = (tujuan: string) => {
    if (tujuan === kapal) return;
    if (pilih.size > 0) { setPindahKe(tujuan); return; }
    gantiKapal?.(tujuan);
  };
  const lanjutkanPindah = (simpanDulu: boolean) => {
    const tujuan = pindahKe;
    setPindahKe("");
    if (!tujuan) return;
    if (simpanDulu) {
      const isi = denganUbahan.filter((k) => pilih.has(k.id))
        .map((k) => ({ kandidat: k, jumlah: k.jumlah, harga: k.harga }));
      if (isi.length) tambah(isi, true);
    }
    gantiKapal?.(tujuan);
  };

  const jumlahDipilih = pilih.size;
  const lewatPagu = kendali.filter((b) => b.pagu > 0 && b.sisa < 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-black/50 p-3" onMouseDown={tutup}>
      <div className="my-4 w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}>

        {/* ── kepala ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="min-w-[14rem] flex-1">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100">🧩 Susun usulan dari riwayat — {kapal}</h3>
            <p className="text-[11px] text-slate-500">
              {namaBulan(bulan)} · barang diambil dari SPPBJ kapal ini pada bulan-bulan sebelumnya, dikendalikan pagu RKA
            </p>
          </div>
          <button onClick={tutup} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {/* ── pindah kapal tanpa menutup layar ────────────────────────── */}
        {!!kapalOpsi?.length && (
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-white px-5 py-2 dark:border-slate-700 dark:bg-slate-900">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Kapal</span>
            {kapalOpsi.map((k) => {
              const aktif = k.nama === kapal;
              return (
                <button key={k.nama} onClick={() => mintaPindah(k.nama)} disabled={aktif}
                  title={k.status === "terkirim" ? "Sudah ditandai terkirim (terkunci)"
                    : k.nilai > 0 ? `Draf tersimpan · ${rupiah(k.nilai)}` : "Belum ada isinya"}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ring-1 transition ${
                    aktif ? "bg-indigo-600 text-white ring-indigo-600"
                      : k.status === "terkirim" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                        : k.status === "draf" ? "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-white"
                          : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"}`}>
                  {k.nama.replace(/^KMP\.\s*/, "").replace(/^BUS AIR KM\.\s*/, "")}
                  {k.status === "terkirim" ? " 🔒" : k.status === "draf" ? " •" : ""}
                </button>
              );
            })}
          </div>
        )}

        {/* pilihan belum ditambahkan — jangan hilang diam-diam saat pindah kapal */}
        {pindahKe && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-5 py-2.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="flex-1">
              <b>{pilih.size} barang</b> di layar ini belum ditambahkan ke usulan {kapal.replace("KMP. ", "")}.
              Pindah ke {pindahKe.replace("KMP. ", "")} sekarang?
            </span>
            <button onClick={() => lanjutkanPindah(true)}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 font-bold text-white hover:bg-indigo-700">
              Tambahkan dulu, lalu pindah
            </button>
            <button onClick={() => lanjutkanPindah(false)}
              className="rounded-lg bg-white px-2.5 py-1 font-bold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100">
              Buang pilihan, pindah
            </button>
            <button onClick={() => setPindahKe("")} className="px-2 py-1 font-bold text-slate-500 hover:underline">Batal</button>
          </div>
        )}

        {/* ── kendali pagu ───────────────────────────────────────────── */}
        <div className="border-b bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Kendali RKA {namaBulan(bulan)}</span>
            <span className="text-[11px] text-slate-500">
              Pagu <b className="tabular-nums text-slate-700 dark:text-slate-200">{rupiah(total.pagu)}</b>
              {" · "}kapal lain <b className="tabular-nums">{rupiah(total.kapalLain)}</b>
              {" · "}dokumen ini <b className="tabular-nums">{rupiah(total.kapalIni)}</b>
              {" · "}dipilih <b className="tabular-nums text-indigo-700">{rupiah(total.dipilih)}</b>
              {" · "}sisa <b className={`tabular-nums ${total.sisa < 0 ? "text-rose-700" : "text-emerald-700"}`}>{rupiah(total.sisa)}</b>
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
              Jatah kapal ini
              <select value={modeJatah} onChange={(e) => setModeJatah(e.target.value as "rata" | "penuh")}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                <option value="rata">bagi rata — {Math.max(1, kapalBelum)} kapal belum menyusun</option>
                <option value="penuh">seluruh sisa pagu</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
              title="Susunan & jumlah divariasikan, dan barang bulan lalu diberi penalti — supaya usulan tak tampak seperti salinan">
              <input type="checkbox" className="accent-indigo-600" checked={variasi}
                onChange={(e) => setVariasi(e.target.checked)} />
              Variasi
            </label>
            <button onClick={otomatis}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700">
              ⚡ Isi otomatis mendekati jatah
            </button>
            {isiSemua && (
              <button onClick={() => isiSemua({ armada: pakaiArmada, db: pakaiDb })}
                title="Isi usulan SEMUA kapal yang masih kosong bulan ini, lalu simpan — jatah tiap kapal dihitung berurutan dari sisa pagu"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">
                🚢 Isi semua kapal
              </button>
            )}
            {variasi && (
              <button onClick={() => { setBenih((b) => (b * 1664525 + 1013904223) >>> 0); setPilih(new Set()); setUbahan({}); setPesan("Benih diganti — tekan Isi otomatis untuk kombinasi baru."); }}
                title="Ganti kombinasi: barang dan jumlah yang terpilih akan berbeda"
                className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 dark:bg-slate-800 dark:ring-indigo-800">
                🎲 Acak ulang
              </button>
            )}
            {jumlahDipilih > 0 && (
              <button onClick={() => { setPilih(new Set()); setPesan(""); }}
                className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                Bersihkan pilihan
              </button>
            )}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {kendali.filter((b) => b.pagu > 0 || b.dipilih > 0 || b.kapalIni > 0).map((b) => {
              const dipakai = b.kapalLain + b.kapalIni + b.dipilih;
              const persen = b.pagu > 0 ? Math.min(100, Math.round((dipakai / b.pagu) * 100)) : 0;
              const lewat = b.pagu > 0 && dipakai > b.pagu;
              return (
                <button key={b.kode} onClick={() => setMaSaring(maSaring === b.kode ? "" : b.kode)}
                  className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
                    maSaring === b.kode ? "bg-indigo-50 ring-indigo-300 dark:bg-indigo-950/40" : "bg-slate-50 ring-slate-200 hover:bg-white dark:bg-slate-800 dark:ring-slate-700"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{labelMA(b.kode)}</span>
                    <span className={`shrink-0 text-[10px] font-extrabold tabular-nums ${lewat ? "text-rose-600" : "text-slate-400"}`}>{persen}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={`h-full ${lewat ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${persen}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] tabular-nums text-slate-500">
                    sisa {rupiah(b.sisa)} <span className="text-slate-400">dari {rupiah(b.pagu)}</span>
                    {pembagi > 1 && (
                      <span className="text-indigo-600"> · jatah {rupiah(jatahMA(b))}</span>
                    )}
                  </p>
                  {/*
                    Persen di pojok atas mengukur pemakaian terhadap pagu SELURUH armada,
                    jadi angkanya selalu kecil untuk satu kapal. Yang perlu dilihat saat
                    menyusun adalah seberapa penuh JATAH kapal ini — itu yang ditandai di sini.
                  */}
                  {jatahMA(b) > 0 && b.dipilih > 0 && (() => {
                    const capai = Math.round((b.dipilih / jatahMA(b)) * 100);
                    return (
                      <p className={`mt-0.5 text-[10px] font-bold tabular-nums ${
                        capai > 105 ? "text-rose-600" : capai >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                        terisi {capai}% dari jatah · {rupiah(b.dipilih)}
                      </p>
                    );
                  })()}
                </button>
              );
            })}
          </div>
          {!Object.keys(pagu).length && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
              Pagu {namaBulan(bulan)} belum ada di Dashboard Anggaran — kendali RKA tak bisa dihitung, tapi barangnya
              tetap bisa dipilih dari riwayat.
            </p>
          )}
        </div>

        {/* ── saringan ───────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-slate-50 px-5 py-2 dark:border-slate-700 dark:bg-slate-800">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang…"
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900" />
          <select value={maSaring} onChange={(e) => setMaSaring(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900">
            <option value="">Semua Mata Anggaran</option>
            {daftarMA.map((k) => <option key={k} value={k}>{labelMA(k)}</option>)}
          </select>
          <span className="text-[11px] text-slate-500">
            {tampil.length} barang{muatDb ? " · memuat database…" : ""}
          </span>
          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            title="Sertakan barang dari riwayat SPPBJ kapal lain — armada memakai barang yang sebagian besar sama">
            <input type="checkbox" className="accent-indigo-600" checked={pakaiArmada}
              onChange={(e) => setPakaiArmada(e.target.checked)} />
            Riwayat armada
          </label>
          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            title="Sertakan seluruh barang Database RAB yang cocok dengan Mata Anggaran ini dan masih muat di jatah">
            <input type="checkbox" className="accent-indigo-600" checked={pakaiDb}
              onChange={(e) => setPakaiDb(e.target.checked)} />
            Database RAB{kandidatDb.length ? ` (${kandidatDb.length})` : ""}
          </label>
          <button onClick={() => setBukaDb((v) => !v)}
            title="Cari barang di Database RAB — 60 ribu item hasil pemindaian berkas 2024–2026"
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold ring-1 transition ${
              bukaDb ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-indigo-700 ring-indigo-300 hover:bg-indigo-50 dark:bg-slate-900 dark:ring-indigo-800"}`}>
            🔎 Cari di Database RAB
          </button>
          <button onClick={tambahManual}
            title="Barang yang belum ada di riwayat maupun Database RAB — diketik sendiri"
            className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 dark:bg-slate-900 dark:ring-indigo-800">
            + Tambah barang
          </button>
          {pesan && <span className="text-[11px] font-semibold text-indigo-700">{pesan}</span>}
        </div>

        {/* ── pencarian database harga ───────────────────────────────── */}
        {bukaDb && (
          <div className="border-b bg-indigo-50/60 px-5 py-3 dark:border-slate-700 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-center gap-2">
              <input value={cariDb} onChange={(e) => setCariDb(e.target.value)} autoFocus
                placeholder="Cari di Database RAB — mis. filter oli, majun, lampu navigasi…"
                className="w-80 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-indigo-800 dark:bg-slate-900" />
              <span className="text-[11px] text-slate-500">
                {sibukDb ? "mencari…" : cariDb.trim().length < 2 ? "ketik minimal dua huruf — hasilnya masuk ke kelompok Lampiran 3 yang sesuai kategorinya"
                  : `${hasilDb.length} barang ditemukan · harga acuan dari berkas RAB 2024–2026`}
              </span>
            </div>
            {!!hasilDb.length && (
              <div className="mt-2 max-h-52 overflow-auto rounded-xl bg-white ring-1 ring-indigo-200 dark:bg-slate-900 dark:ring-indigo-900">
                {hasilDb.map((h: any) => (
                  <button key={h.kode} onClick={() => tambahDariDb(h)}
                    className="flex w-full flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left last:border-0 hover:bg-indigo-50 dark:border-slate-800 dark:hover:bg-indigo-950/40">
                    <span className="min-w-[16rem] flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {h.uraian}
                      {h.spek && <span className="ml-1 text-[10px] font-normal text-slate-400">{h.spek}</span>}
                    </span>
                    <span className="text-[10px] text-slate-400">{h.kategori}</span>
                    <span className="text-[10px] text-slate-500">{h.satuan || "-"} · {h.n || 0} data</span>
                    <span className="w-28 text-right text-xs font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                      {rupiah(h.h2026 || h.h2025 || h.median || h.lo || 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── daftar kandidat ────────────────────────────────────────── */}
        <div className="max-h-[42vh] overflow-auto">
          {!tampil.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-400">
              Belum ada riwayat pengadaan rutin untuk kapal ini pada 12 bulan terakhir.
            </p>
          ) : (
            <table className="w-full min-w-[54rem] text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900">
                <tr>
                  <th className="w-9 px-2 py-2" />
                  <th className="px-2 py-2 text-left font-extrabold">Barang</th>
                  <th className="w-44 px-2 py-2 text-left font-extrabold">Kelompok</th>
                  <th className="w-20 px-2 py-2 text-center font-extrabold">Riwayat</th>
                  <th className="w-16 px-2 py-2 text-center font-extrabold">Jml</th>
                  <th className="w-28 px-2 py-2 text-right font-extrabold">Harga</th>
                  <th className="w-28 px-2 py-2 text-right font-extrabold">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((k) => {
                  const dipilih = pilih.has(k.id);
                  return (
                    <tr key={k.id} className={`border-t border-slate-100 dark:border-slate-800 ${dipilih ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" className="accent-indigo-600" checked={dipilih} onChange={() => alih(k.id)} />
                      </td>
                      <td className="px-2 py-1.5">
                        {buatanSendiri(k.id) ? (
                          <input value={k.deskripsi} autoFocus placeholder="Nama barang…"
                            onChange={(e) => ubahManual(k.id, { deskripsi: e.target.value })}
                            className="w-full rounded border border-indigo-200 px-1.5 py-1 font-semibold outline-none focus:border-indigo-500 dark:border-indigo-800 dark:bg-slate-900" />
                        ) : (
                          <>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{k.deskripsi}</p>
                            {k.spesifikasi && <p className="text-[10px] text-slate-400">{k.spesifikasi}</p>}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-slate-500">
                        {buatanSendiri(k.id) ? (
                          <select value={k.kunci}
                            onChange={(e) => {
                              const kel = KELOMPOK_RR.find((x) => kunciKelompok(x) === e.target.value);
                              if (kel) ubahManual(k.id, { kunci: kunciKelompok(kel), kode: kel.kode, judul: kel.judul });
                            }}
                            className="w-full rounded border border-indigo-200 px-1 py-1 text-[10px] dark:border-indigo-800 dark:bg-slate-900">
                            {KELOMPOK_RR.map((kel) => (
                              <option key={kunciKelompok(kel)} value={kunciKelompok(kel)}>{kel.judul}</option>
                            ))}
                          </select>
                        ) : k.judul}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {buatanSendiri(k.id) ? (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            baru
                          </span>
                        ) : k.asal === "db" ? (
                          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                            title={k.contohDokumen}>
                            database
                          </span>
                        ) : k.asal === "armada" ? (
                          <>
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              title="Dari riwayat kapal lain, bukan kebiasaan kapal ini">
                              armada {k.kali}×
                            </span>
                            <p className="text-[9px] text-slate-400">akhir {namaBulan(k.bulanTerakhir).slice(0, 3)}</p>
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {k.kali}×
                            </span>
                            <p className="text-[9px] text-slate-400">akhir {namaBulan(k.bulanTerakhir).slice(0, 3)}</p>
                          </>
                        )}
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={k.jumlah} inputMode="numeric"
                          onChange={(e) => setUbahan((u) => ({ ...u, [k.id]: { ...u[k.id], jumlah: Number(e.target.value.replace(/\D/g, "")) || 0 } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-center tabular-nums dark:border-slate-700 dark:bg-slate-900" />
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={k.harga.toLocaleString("id-ID")} inputMode="numeric"
                          onChange={(e) => setUbahan((u) => ({ ...u, [k.id]: { ...u[k.id], harga: Number(e.target.value.replace(/\D/g, "")) || 0 } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-right tabular-nums dark:border-slate-700 dark:bg-slate-900" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                          {rupiah(nilaiKandidat(k))}
                          {buatanSendiri(k.id) && (
                            <button onClick={() => hapusManual(k.id)} title="Buang baris ini"
                              className="text-slate-300 hover:text-rose-600">✕</button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── kaki ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          {lewatPagu.length > 0 && (
            <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200">
              ⚠ Melewati pagu: {lewatPagu.map((b) => labelMA(b.kode)).join(", ")}
            </span>
          )}
          <button onClick={tutup} className="btn btn-ghost text-xs">Batal</button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              {jumlahDipilih} barang · <b className="tabular-nums text-slate-800 dark:text-slate-100">{rupiah(total.dipilih)}</b>
            </span>
            <button onClick={() => kirim(false)} disabled={!jumlahDipilih}
              className="btn btn-ghost text-xs disabled:opacity-40">
              ➜ Tambahkan &amp; tutup
            </button>
            <button onClick={() => kirim(true)} disabled={!jumlahDipilih}
              className="btn btn-primary text-xs disabled:opacity-40"
              title="Masukkan ke usulan kapal ini, simpan, lalu langsung lanjut ke kapal berikutnya yang belum menyusun">
              ➜ Tambahkan &amp; lanjut kapal berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
