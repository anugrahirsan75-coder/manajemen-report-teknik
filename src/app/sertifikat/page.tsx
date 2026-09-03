"use client";
/**
 * Monitor Sertifikat Kapal.
 *
 * Dipakai untuk memantau, bukan untuk membaca tabel. Maka susunannya:
 *   1. angka besar — berapa yang lewat & mendesak hari ini
 *   2. jadwal 6 bulan ke depan — kapan gelombang perpanjangan datang
 *   3. papan 13 kapal — mana yang paling bermasalah, sekali lihat
 *   4. daftar rinci — baru dibuka kalau memang mau menindaklanjuti
 *
 * Data diambil ulang sendiri tiap 10 menit supaya layar yang dibiarkan
 * terbuka di meja tidak menampilkan angka basi.
 *
 * Sumbernya lembar Google cabang; layar ini membacanya, tidak mengubahnya.
 *
 * Tampilannya sengaja tenang: permukaan putih pekat (bukan kaca tembus pandang
 * di atas foto pelabuhan), garis rambut satu piksel sebagai pemisah, angka
 * tabular, dan warna hanya dipakai untuk status. Layar ini dibaca sambil
 * menelepon galangan dan ikut dicetak untuk rapat — hiasan yang menempel di
 * belakang angka justru membuat angkanya susah dipercaya.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Ikon } from "@/components/ikon";
import { BORANG, kunciNomor } from "@/lib/sertifikat/fleetBorang";
import {
  STATUS_SERT, Sertifikat, StatusSertifikat, URL_LEMBAR,
  bobotStatus, statusSert, tanggalSert, teksSisa,
} from "@/lib/sertifikat/types";

const SELANG_MUAT = 10 * 60 * 1000;
const BULAN_PENDEK = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Nilai = { s: Sertifikat; st: StatusSertifikat };

/**
 * Sisa masa berlaku dalam bentuk sesingkat mungkin.
 *
 * Sel matriks selebar ±6rem harus memuat tiga belas kolom di satu layar; teks
 * "Lewat 128 hari" memaksa sel melebar sampai papannya tidak lagi terbaca
 * sekaligus — padahal terbaca sekaligus itulah gunanya papan ini.
 */
const sisaRingkas = (s: Sertifikat) => {
  if (s.permanen) return "PERM";
  if (s.sisaHari === null) return "—";
  if (s.sisaHari < 0) return `${s.sisaHari}h`;
  if (s.sisaHari > 999) return `${Math.round(s.sisaHari / 365)}th`;
  return `${s.sisaHari}h`;
};

/** tanggal ringkas untuk sel: 15 Sep 26 */
const tanggalRingkas = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return BULAN_PENDEK[+m] ? `${+d} ${BULAN_PENDEK[+m]} ${y.slice(2)}` : iso;
};

const kunciBulan = (iso: string) => (iso || "").slice(0, 7);
const namaBulan = (kunci: string) => {
  const [y, m] = kunci.split("-");
  return `${BULAN_PENDEK[+m]} ${y?.slice(2)}`;
};

export default function MonitorSertifikat() {
  const [baris, setBaris] = useState<Sertifikat[]>([]);
  const [kapalAda, setKapalAda] = useState<string[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [diambil, setDiambil] = useState<Date | null>(null);

  const [kapal, setKapal] = useState("");
  const [status, setStatus] = useState("");
  const [bulan, setBulan] = useState("");
  const [cari, setCari] = useState("");
  const [semua, setSemua] = useState(false);
  const [detail, setDetail] = useState("");        // kapal yang dibuka rinciannya
  const [sel, setSel] = useState<Nilai | null>(null);  // satu sel matriks yang dibuka
  const [matriksPadat, setMatriksPadat] = useState(true);   // sembunyikan baris yang semua kapalnya aman
  const [ikutPermanen, setIkutPermanen] = useState(false);  // dokumen tanpa masa berlaku
  const [salin, setSalin] = useState("");
  /** nomor sertifikat yang sudah diketik kantor: kapal -> kunci dokumen -> nomor */
  const [nomorSert, setNomorSert] = useState<Record<string, Record<string, string>>>({});
  const [nomorSimpan, setNomorSimpan] = useState("");

  const ambil = useCallback(async (segar = false) => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch(`/api/sertifikat${segar ? "?segar=1" : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || "Gagal memuat"); return; }
      setBaris(d.baris); setKapalAda(d.kapal); setDiambil(new Date(d.diambilPada));
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { ambil(); }, [ambil]);

  // Nomor sertifikat disimpan terpisah dari lembar MUSTER: lembar itu tidak
  // punya kolomnya, dan yang mengetik nomornya adalah kantor sendiri.
  useEffect(() => {
    fetch("/api/sertifikat/nomor", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setNomorSert(d.nomor || {}); })
      .catch(() => { /* borang tetap bisa terbit dengan kolom nomor kosong */ });
  }, []);

  /**
   * Kode borang Direksi yang memakai satu baris MUSTER.
   *
   * Sebagian baris dipakai dua kode sekaligus — polis asuransi mengisi Wreck
   * Removal dan Blue Card, izin stasiun radio mengisi SIKR dan MMSI — jadi
   * kotak isiannya pun dua, bukan satu.
   */
  const kodeBorang = (jenis: string) => BORANG.filter((b) => b.padanan === jenis);

  const simpanNomor = async (kapal: string, kode: string, jenis: string, nilai: string) => {
    const kunci = kunciNomor(kode, jenis);
    setNomorSert((l) => ({ ...l, [kapal]: { ...(l[kapal] || {}), [kunci]: nilai } }));
    setNomorSimpan(kunci);
    try {
      const r = await fetch("/api/sertifikat/nomor", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kapal, kunci, nomor: nilai }),
      });
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error || "Gagal menyimpan");
      setSalin("Nomor sertifikat tersimpan — ikut tercetak di borang Direksi");
      setTimeout(() => setSalin(""), 3500);
    } catch (e: any) {
      setGalat(e?.message || "Nomor gagal disimpan");
    } finally {
      setNomorSimpan("");
    }
  };
  // layar pantau sering dibiarkan terbuka — segarkan sendiri secara berkala
  useEffect(() => {
    const t = setInterval(() => ambil(true), SELANG_MUAT);
    return () => clearInterval(t);
  }, [ambil]);

  const berstatus: Nilai[] = useMemo(
    () => baris.map((s) => ({ s, st: statusSert(s) })), [baris]);

  const hitung = useMemo(() => {
    const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0, permanen: 0, kosong: 0 };
    berstatus.forEach(({ st }) => h[st]++);
    return h;
  }, [berstatus]);

  const perluTindakan = hitung.lewat + hitung.kritis;
  const totalBerwaktu = hitung.lewat + hitung.kritis + hitung.waspada + hitung.aman;
  const persenAman = totalBerwaktu ? Math.round((hitung.aman / totalBerwaktu) * 100) : 0;

  // ── jadwal 6 bulan ke depan ──────────────────────────────────────────────
  const jadwal = useMemo(() => {
    const kini = new Date();
    const daftar: { kunci: string; jumlah: number; kritis: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(kini.getFullYear(), kini.getMonth() + i, 1);
      const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const isi = berstatus.filter(({ s }) => !s.permanen && kunciBulan(s.berlaku) === kunci);
      daftar.push({ kunci, jumlah: isi.length, kritis: isi.filter((x) => x.st !== "aman").length });
    }
    return daftar;
  }, [berstatus]);
  const puncakJadwal = Math.max(1, ...jadwal.map((j) => j.jumlah));

  // ── papan per kapal ──────────────────────────────────────────────────────
  const papan = useMemo(() => {
    const peta = new Map<string, Nilai[]>();
    berstatus.forEach((n) => peta.set(n.s.kapal, [...(peta.get(n.s.kapal) || []), n]));
    return (kapalAda.length ? kapalAda : Array.from(peta.keys())).map((k) => {
      const isi = peta.get(k) || [];
      const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0 };
      isi.forEach(({ st }) => { if (st in h) (h as any)[st]++; });
      const berwaktu = h.lewat + h.kritis + h.waspada + h.aman;
      // Dua hal berbeda, jangan dicampur: yang JATUH TEMPO BERIKUTNYA (masih
      // bisa dijadwalkan) dan yang TERTUNGGAK PALING LAMA (sudah telat). Kalau
      // digabung jadi satu "terdekat", kapal dengan tunggakan lama tidak pernah
      // menampilkan tenggat berikutnya yang justru perlu disiapkan.
      const berwaktuAda = isi.filter(({ s }) => !s.permanen && s.sisaHari !== null);
      const berikutnya = berwaktuAda
        .filter(({ s }) => s.sisaHari! >= 0)
        .sort((a, b) => a.s.sisaHari! - b.s.sisaHari!)[0];
      const tertunggak = berwaktuAda
        .filter(({ s }) => s.sisaHari! < 0)
        .sort((a, b) => a.s.sisaHari! - b.s.sisaHari!)[0];
      return {
        kapal: k, ...h, total: isi.length, berwaktu, berikutnya, tertunggak,
        skor: h.lewat * 1000 + h.kritis * 10 + h.waspada,
        persenAman: berwaktu ? Math.round((h.aman / berwaktu) * 100) : 0,
      };
    }).sort((a, b) => b.skor - a.skor || a.kapal.localeCompare(b.kapal, "id"));
  }, [berstatus, kapalAda]);

  /**
   * Papan matriks: satu baris per JENIS dokumen, satu kolom per kapal.
   *
   * Papan armada di atas menjawab "kapal mana yang bermasalah". Yang tidak bisa
   * dijawabnya: "dokumen mana yang jatuh tempo serentak di banyak kapal" —
   * padahal justru itu yang menentukan antrean kerja. SKKP dan SNPP satu
   * angkatan biasanya habis di bulan yang sama, dan itu baru kelihatan kalau
   * seluruh armada dibaca dalam satu bidang, seperti lembar MUSTER aslinya.
   *
   * Urutan barisnya mengikuti urutan lembar sumber (SOLAS, MARPOL, Biro
   * Klasifikasi, …), bukan diurut ulang menurut kegentingan: petugas yang
   * terbiasa dengan lembarnya harus tetap menemukan barisnya di tempat yang
   * sama.
   */
  const matriks = useMemo(() => {
    const urut: { kelompok: string; jenis: string; no: string }[] = [];
    const sudah = new Set<string>();
    baris.forEach((s) => {
      const k = `${s.kelompok}|${s.jenis}`;
      if (sudah.has(k)) return;
      sudah.add(k);
      urut.push({ kelompok: s.kelompok, jenis: s.jenis, no: s.no });
    });

    const petaSel = new Map<string, Nilai>();
    berstatus.forEach((n) => petaSel.set(`${n.s.kapal}|${n.s.kelompok}|${n.s.jenis}`, n));

    const kapalKolom = kapalAda.length ? kapalAda : Array.from(new Set(baris.map((s) => s.kapal)));

    const barisMatriks = urut.map((u) => {
      const isi = kapalKolom.map((k) => petaSel.get(`${k}|${u.kelompok}|${u.jenis}`) || null);
      const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0, permanen: 0, kosong: 0 };
      isi.forEach((n) => { if (n) h[n.st]++; });
      // baris permanen: seluruh isinya dokumen tanpa masa berlaku
      const semuaPermanen = h.permanen > 0 && h.lewat + h.kritis + h.waspada + h.aman === 0;
      return { ...u, isi, h, semuaPermanen, perlu: h.lewat + h.kritis + h.waspada };
    });

    return { kapalKolom, barisMatriks };
  }, [baris, berstatus, kapalAda]);

  /** baris yang benar-benar digambar, setelah dua saklar di kepala papan */
  const barisMatriksTampil = useMemo(() => matriks.barisMatriks.filter((b) => {
    if (!ikutPermanen && b.semuaPermanen) return false;
    if (matriksPadat && b.perlu === 0) return false;
    return true;
  }), [matriks, ikutPermanen, matriksPadat]);

  /** jumlah masalah per kapal — dipakai di kepala kolom */
  const masalahKapal = useMemo(() => {
    const peta = new Map<string, number>();
    berstatus.forEach(({ s, st }) => {
      if (st === "lewat" || st === "kritis") peta.set(s.kapal, (peta.get(s.kapal) || 0) + 1);
    });
    return peta;
  }, [berstatus]);

  // ── daftar rinci ─────────────────────────────────────────────────────────
  const saringanAktif = !!(kapal || status || bulan || cari);
  const tampil = useMemo(() => {
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    return berstatus
      .filter(({ s, st }) => {
        if (kapal && s.kapal !== kapal) return false;
        if (status && st !== status) return false;
        if (bulan && kunciBulan(s.berlaku) !== bulan) return false;
        if (kata.length) {
          const t = `${s.kapal} ${s.jenis} ${s.kelompok} ${s.berkasNama}`.toLowerCase();
          if (!kata.every((k) => t.includes(k))) return false;
        }
        if (!saringanAktif && !semua) return st === "lewat" || st === "kritis" || st === "waspada";
        return true;
      })
      .sort((a, b) =>
        bobotStatus[a.st] - bobotStatus[b.st]
        || (a.s.sisaHari ?? 99999) - (b.s.sisaHari ?? 99999)
        || a.s.kapal.localeCompare(b.s.kapal, "id"));
  }, [berstatus, kapal, status, bulan, cari, semua, saringanAktif]);

  const bersihkan = () => { setKapal(""); setStatus(""); setBulan(""); setCari(""); setSemua(false); };

  const isiDetail = useMemo(() => {
    if (!detail) return [];
    return berstatus
      .filter(({ s }) => s.kapal === detail)
      .sort((a, b) =>
        bobotStatus[a.st] - bobotStatus[b.st]
        || (a.s.sisaHari ?? 99999) - (b.s.sisaHari ?? 99999));
  }, [berstatus, detail]);

  /** salin ringkasan mendesak — biar bisa langsung ditempel ke WhatsApp grup */
  const salinMendesak = async (daftar: Nilai[], judul: string) => {
    const isi = daftar
      .filter(({ st }) => st === "lewat" || st === "kritis")
      .slice(0, 40)
      .map(({ s }) => `• ${s.kapal} — ${s.jenis} (${s.permanen ? "permanen" : tanggalSert(s.berlaku)}, ${teksSisa(s)})`)
      .join("\n");
    const teks = `${judul}\nPer ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}\n\n${isi || "Tidak ada yang mendesak."}`;
    try { await navigator.clipboard.writeText(teks); setSalin("Ringkasan disalin — tinggal tempel di WhatsApp"); }
    catch { setSalin("Peramban menolak menyalin. Buka daftarnya lalu salin manual."); }
    setTimeout(() => setSalin(""), 4000);
  };

  /** warna angka besar KPI — angka nol yang merah tetap terbaca sebagai kabar baik */
  const warnaAngka: Record<string, string> = {
    lewat: "text-rose-600 dark:text-rose-400",
    kritis: "text-orange-600 dark:text-orange-400",
    waspada: "text-amber-600 dark:text-amber-400",
    aman: "text-emerald-600 dark:text-emerald-400",
  };

  const kartuAngka: { st: StatusSertifikat; nilai: number; judul: string; ket: string }[] = [
    { st: "lewat", nilai: hitung.lewat, judul: "Kedaluwarsa", ket: "harus segera diurus" },
    { st: "kritis", nilai: hitung.kritis, judul: "Habis ≤ 30 hari", ket: "siapkan perpanjangan" },
    { st: "waspada", nilai: hitung.waspada, judul: "Habis ≤ 90 hari", ket: "masuk antrean" },
    { st: "aman", nilai: hitung.aman, judul: "Masih aman", ket: "di atas 90 hari" },
  ];

  /**
   * Warna sel papan.
   *
   * Lembar MUSTER memakai blok warna penuh: merah untuk yang lewat, kuning
   * untuk yang mepet, hijau untuk yang aman. Versi pastel memang lebih adem,
   * tetapi papan ini dibaca dari jarak satu meter di ruang rapat — yang lewat
   * harus menonjok mata sebelum angkanya sempat dibaca. Jadi warnanya dibuat
   * sepekat lembar aslinya, sementara bagian layar selain sel tetap netral
   * supaya yang berwarna hanya statusnya.
   */
  const nadaSel: Record<StatusSertifikat, string> = {
    lewat: "border-rose-700 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-700",
    kritis: "border-amber-500 bg-amber-300 text-amber-950 dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950",
    waspada: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100",
    aman: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    permanen: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
    kosong: "border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500",
  };

  const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <section className={`mb-4 overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      {children}
    </section>
  );

  const KepalaPanel = ({ judul, ket, kanan }: { judul: string; ket?: string; kanan?: React.ReactNode }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-500">{judul}</h2>
        {ket && <p className="mt-0.5 text-[11px] text-slate-600">{ket}</p>}
      </div>
      {kanan}
    </div>
  );

  const TombolSaklar = ({ hidup, onClick, children }: { hidup: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
        hidup
          ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
      {children}
    </button>
  );

  return (
    /*
     * Latar diserahkan ke <body> (gradasi merek yang sangat tipis). Yang
     * penting bagi layar ini bukan warnanya, melainkan bahwa panel-panelnya
     * PEKAT: angka tenggat tidak boleh dibaca lewat lapisan tembus pandang.
     */
    <div className="min-h-screen">
      <main className="mx-auto max-w-[92rem] px-4 py-5">
      {/* ── kepala ──────────────────────────────────────────────────────── */}
      <header className="mb-4 rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-4 px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#16357f] text-white">
            <Ikon nama="sertifikat" className="h-5 w-5" />
          </div>
          <div className="min-w-[18rem] flex-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Monitor Sertifikat Kapal</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Masa berlaku dokumen {kapalAda.length || 13} kapal, dihitung ulang hari ini dari lembar MUSTER cabang.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {perluTindakan > 0 && (
              <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {perluTindakan} perlu tindakan
              </span>
            )}
            <button onClick={() => salinMendesak(berstatus, "SERTIFIKAT PERLU PERPANJANGAN — ARMADA TERNATE")}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              <Ikon nama="salin" className="h-3.5 w-3.5" /> Salin daftar mendesak
            </button>
            <a href="/api/sertifikat/fleet-ekspor"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              <Ikon nama="lembar" className="h-3.5 w-3.5" /> Borang Direksi (.xlsx)
            </a>
            {/* tautan yang ditempel di layar ruang kantor — terbuka, tanpa login */}
            <a href="/layar-sertifikat" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              <Ikon nama="keluarTaut" className="h-3.5 w-3.5" /> Layar kantor
            </a>
            <a href={URL_LEMBAR} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              <Ikon nama="lembar" className="h-3.5 w-3.5" /> Lembar sumber
            </a>
            <button onClick={() => ambil(true)} disabled={muat}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#16357f] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#12296a] disabled:opacity-50">
              <Ikon nama="segarkan" className={`h-3.5 w-3.5 ${muat ? "animate-spin" : ""}`} /> {muat ? "Memuat" : "Muat ulang"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/50">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${muat ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
            {muat ? "Menyegarkan…" : diambil ? `Terbarui ${diambil.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Menunggu data"}
          </span>
          <span>{totalBerwaktu} dokumen bermasa berlaku · {hitung.permanen} permanen</span>
          <span className="text-slate-500">Layar ini hanya membaca; perubahan dilakukan di lembar sumber.</span>
        </div>
      </header>

      {salin && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Ikon nama="centang" className="h-4 w-4" /> {salin}
        </div>
      )}
      {galat && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <Ikon nama="peringatan" className="h-4 w-4" /> {galat}
        </div>
      )}

      {/* ── angka hari ini ──────────────────────────────────────────────── */}
      <Panel>
        <div className="grid divide-y divide-slate-200 dark:divide-slate-700 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-5 xl:divide-x">
          {kartuAngka.map(({ st, nilai, judul, ket }) => {
            const aktif = status === st;
            return (
              <button key={st} onClick={() => { setStatus(aktif ? "" : st); setSemua(false); }}
                className={`group px-4 py-3.5 text-left transition sm:border-r sm:border-slate-200 dark:sm:border-slate-700 ${
                  aktif ? "bg-slate-50 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                <span className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_SERT[st].titik}`} />
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">{judul}</span>
                </span>
                <span className={`mt-1.5 block text-[30px] font-extrabold leading-none tabular-nums ${warnaAngka[st] || "text-slate-900 dark:text-white"}`}>{nilai}</span>
                <span className={`mt-1 block text-[11px] ${aktif ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
                  {aktif ? "sedang disaring — klik lagi untuk lepas" : ket}
                </span>
              </button>
            );
          })}
          <div className="px-4 py-3.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Kesehatan armada</span>
            <span className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[28px] font-bold leading-none tabular-nums text-slate-900 dark:text-white">{persenAman}</span>
              <span className="text-sm font-semibold text-slate-500">%</span>
            </span>
            <span className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              {([["lewat", hitung.lewat], ["kritis", hitung.kritis], ["waspada", hitung.waspada], ["aman", hitung.aman]] as [StatusSertifikat, number][])
                .map(([st, n]) => n > 0 && (
                  <span key={st} className={STATUS_SERT[st].titik} style={{ width: `${(n / Math.max(1, totalBerwaktu)) * 100}%` }} />
                ))}
            </span>
            <span className="mt-1.5 block text-[11px] text-slate-600">dokumen di atas 90 hari</span>
          </div>
        </div>
      </Panel>

      {/* ── jatuh tempo 6 bulan ─────────────────────────────────────────── */}
      <Panel>
        <KepalaPanel judul="Jatuh tempo 6 bulan ke depan"
          ket="Kapan gelombang perpanjangan datang. Klik bulan untuk menyaring daftar."
          kanan={bulan ? (
            <button onClick={() => setBulan("")} className="text-[11px] font-semibold text-slate-600 underline-offset-2 hover:underline">
              Lepas saringan {namaBulan(bulan)}
            </button>
          ) : undefined} />
        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700 sm:grid-cols-6">
          {jadwal.map((j) => {
            const aktif = bulan === j.kunci;
            return (
              <button key={j.kunci} onClick={() => { setBulan(aktif ? "" : j.kunci); setStatus(""); }}
                className={`px-3 py-3 text-left transition ${aktif ? "bg-slate-50 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{namaBulan(j.kunci)}</span>
                <span className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{j.jumlah}</span>
                  {j.kritis > 0 && (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      {j.kritis === j.jumlah ? "semua mendesak" : `${j.kritis} mendesak`}
                    </span>
                  )}
                </span>
                {/* satu batang, dua bagian: seluruh jatuh tempo bulan itu dan
                    bagian yang sudah masuk kategori mendesak */}
                <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <span className="flex" style={{ width: `${(j.jumlah / puncakJadwal) * 100}%` }}>
                    <span className="bg-amber-500" style={{ width: `${j.jumlah ? (j.kritis / j.jumlah) * 100 : 0}%` }} />
                    <span className="flex-1 bg-slate-800 dark:bg-slate-300" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ── papan dokumen armada ────────────────────────────────────────── */}
      <Panel>
        <KepalaPanel judul="Papan dokumen armada"
          ket="Seluruh kapal dan seluruh jenis dokumen dalam satu bidang. Klik sel untuk rincian dan berkasnya."
          kanan={
            <div className="flex flex-wrap items-center gap-1.5">
              <TombolSaklar hidup={matriksPadat} onClick={() => setMatriksPadat(!matriksPadat)}>
                {matriksPadat ? "Baris bermasalah" : "Semua baris"}
              </TombolSaklar>
              <TombolSaklar hidup={ikutPermanen} onClick={() => setIkutPermanen(!ikutPermanen)}>
                {ikutPermanen ? "Permanen tampil" : "Permanen disembunyikan"}
              </TombolSaklar>
              <span className="text-[11px] tabular-nums text-slate-500">
                {barisMatriksTampil.length}/{matriks.barisMatriks.length} baris
              </span>
            </div>
          } />

        {!barisMatriksTampil.length ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              {baris.length ? "Tidak ada baris bermasalah" : "Data belum terbaca"}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              {baris.length ? "Tekan “Semua baris” untuk melihat dokumen yang aman juga." : "Tekan Muat ulang untuk mencoba lagi."}
            </p>
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "36rem" }}>
            <table className="border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {/* pojok kiri-atas membeku dua arah: tanpa itu nama dokumen
                      hilang begitu papan digulir ke kanan */}
                  <th className="sticky left-0 top-0 z-30 min-w-[17rem] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                    Jenis dokumen
                  </th>
                  {matriks.kapalKolom.map((k) => {
                    const n = masalahKapal.get(k) || 0;
                    return (
                      <th key={k} className="sticky top-0 z-20 min-w-[6.25rem] border-b border-r border-slate-200 bg-slate-50 p-0 dark:border-slate-700 dark:bg-slate-800">
                        <button onClick={() => setDetail(k)} className="w-full px-2 py-2 text-center transition hover:bg-slate-100 dark:hover:bg-slate-700">
                          <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                            {k.replace(/^KMP\.?\s*/i, "")}
                          </span>
                          <span className={`mt-0.5 inline-block rounded px-1 text-[10px] font-bold tabular-nums ${
                            n ? "bg-rose-600 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"}`}>
                            {n ? `${n} perlu` : "aman"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {barisMatriksTampil.map((b, i) => {
                  const kelompokBaru = i === 0 || barisMatriksTampil[i - 1].kelompok !== b.kelompok;
                  return (
                    <Fragment key={`${b.kelompok}|${b.jenis}`}>
                      {kelompokBaru && (
                        <tr>
                          <td colSpan={matriks.kapalKolom.length + 1}
                            className="sticky left-0 border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                            {b.kelompok || "Lainnya"}
                          </td>
                        </tr>
                      )}
                      <tr className="group">
                        <th scope="row"
                          className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-0 text-left align-middle group-hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:group-hover:bg-slate-800/60">
                          <button onClick={() => { setCari(b.jenis); setStatus(""); setBulan(""); }} className="flex w-full items-start gap-2 px-3 py-2 text-left">
                            <span className="mt-px w-4 shrink-0 text-[11px] font-semibold tabular-nums text-slate-300">{b.no}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100" title={b.jenis}>{b.jenis}</span>
                              <span className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-semibold">
                                {b.h.lewat > 0 && <span className="text-rose-600 dark:text-rose-400">{b.h.lewat} lewat</span>}
                                {b.h.kritis > 0 && <span className="text-orange-600 dark:text-orange-400">{b.h.kritis} ≤30h</span>}
                                {b.h.waspada > 0 && <span className="text-amber-600 dark:text-amber-400">{b.h.waspada} ≤90h</span>}
                                {b.h.kosong > 0 && <span className="text-slate-500">{b.h.kosong} kosong</span>}
                                {b.perlu === 0 && b.h.kosong === 0 && <span className="text-slate-500">semua aman</span>}
                              </span>
                            </span>
                          </button>
                        </th>
                        {b.isi.map((n, j) => (
                          <td key={j} className="border-b border-r border-slate-200 p-0 align-middle dark:border-slate-700">
                            {n ? (
                              <button onClick={() => setSel(n)}
                                title={`${n.s.kapal} · ${n.s.jenis}\n${n.s.permanen ? "Permanen" : `berlaku s.d. ${tanggalSert(n.s.berlaku)}`} · ${teksSisa(n.s)}`}
                                className={`flex h-full w-full flex-col items-center justify-center px-1.5 py-2 transition hover:brightness-95 ${nadaSel[n.st]}`}>
                                <span className="block text-[14px] font-extrabold leading-none tabular-nums">{sisaRingkas(n.s)}</span>
                                <span className="mt-1 flex items-center gap-1 text-[10px] font-medium leading-none opacity-85">
                                  {n.s.permanen ? "tanpa tempo" : tanggalRingkas(n.s.berlaku) || "tanpa tanggal"}
                                  {n.s.berkasUrl && <Ikon nama="klip" className="h-2.5 w-2.5" />}
                                </span>
                              </button>
                            ) : (
                              <span className="block px-1.5 py-3 text-center text-[11px] text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[10.5px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
          {(["lewat", "kritis", "waspada", "aman", "permanen", "kosong"] as StatusSertifikat[]).map((st) => (
            <span key={st} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_SERT[st].titik}`} />{STATUS_SERT[st].label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-slate-500">
            <Ikon nama="klip" className="h-3 w-3" /> berkas tersimpan · klik nama kapal untuk rincian kapal · klik nama dokumen untuk menyaring daftar
          </span>
        </div>
      </Panel>

      {/* ── papan armada ────────────────────────────────────────────────── */}
      <Panel>
        <KepalaPanel judul="Ringkasan per kapal" ket="Diurut dari yang paling perlu perhatian." />
        <div className="grid divide-y divide-slate-200 dark:divide-slate-700 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
          {papan.map((k) => {
            const gawat = k.lewat > 0;
            const dekat = !gawat && k.kritis > 0;
            return (
              <button key={k.kapal} onClick={() => setDetail(k.kapal)}
                className="border-b border-r border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${gawat ? "bg-rose-500" : dekat ? "bg-orange-500" : "bg-emerald-500"}`} />
                    <span className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{k.kapal}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{k.total} dok</span>
                </span>

                <span className="mt-2 flex h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  {([["lewat", k.lewat], ["kritis", k.kritis], ["waspada", k.waspada], ["aman", k.aman]] as [StatusSertifikat, number][])
                    .map(([st, n]) => n > 0 && (
                      <span key={st} className={STATUS_SERT[st].titik} style={{ width: `${(n / Math.max(1, k.berwaktu)) * 100}%` }} />
                    ))}
                </span>

                <span className="mt-2 flex flex-wrap gap-x-3 text-[10.5px] font-semibold">
                  {k.lewat > 0 && <span className="text-rose-600 dark:text-rose-400">{k.lewat} lewat</span>}
                  {k.kritis > 0 && <span className="text-orange-600 dark:text-orange-400">{k.kritis} ≤30h</span>}
                  {k.waspada > 0 && <span className="text-amber-600 dark:text-amber-400">{k.waspada} ≤90h</span>}
                  {!k.lewat && !k.kritis && !k.waspada && <span className="text-emerald-600 dark:text-emerald-400">semua aman</span>}
                </span>

                <span className="mt-1.5 block space-y-0.5 text-[11px] text-slate-600">
                  {k.tertunggak && (
                    <span className="block truncate"><span className="font-semibold text-rose-600 dark:text-rose-400">Tertunggak</span> {k.tertunggak.s.jenis} · {teksSisa(k.tertunggak.s)}</span>
                  )}
                  {k.berikutnya && (
                    <span className="block truncate"><span className="font-semibold text-slate-600 dark:text-slate-300">Berikutnya</span> {k.berikutnya.s.jenis} · {teksSisa(k.berikutnya.s)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ── daftar rinci ────────────────────────────────────────────────── */}
      <Panel className="mb-0">
        <KepalaPanel
          judul={saringanAktif ? "Hasil saringan" : semua ? "Semua sertifikat" : "Perlu tindakan"}
          ket={`${tampil.length} baris${bulan ? ` · jatuh tempo ${namaBulan(bulan)}` : ""}${kapal ? ` · ${kapal}` : ""}${!saringanAktif && !semua ? " · sudah lewat atau habis dalam 90 hari" : ""}`}
          kanan={
            <div className="flex gap-3">
              {saringanAktif && <button onClick={bersihkan} className="text-[11px] font-semibold text-slate-600 underline-offset-2 hover:underline">Bersihkan saringan</button>}
              {!saringanAktif && (
                <button onClick={() => setSemua(!semua)} className="text-[11px] font-semibold text-slate-600 underline-offset-2 hover:underline">
                  {semua ? "Yang mendesak saja" : "Tampilkan semua"}
                </button>
              )}
            </div>
          } />

        <div className="grid gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Ikon nama="kaca" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari sertifikat, kapal, berkas…"
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-7 text-[12.5px] outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900" />
            {cari && <button onClick={() => setCari("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><Ikon nama="silang" className="h-3.5 w-3.5" /></button>}
          </div>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12.5px] dark:border-slate-600 dark:bg-slate-900">
            <option value="">Semua kapal</option>
            {kapalAda.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12.5px] dark:border-slate-600 dark:bg-slate-900">
            <option value="">Semua status</option>
            {(["lewat", "kritis", "waspada", "aman", "permanen", "kosong"] as StatusSertifikat[]).map((s) =>
              <option key={s} value={s}>{STATUS_SERT[s].label}</option>)}
          </select>
        </div>

        {muat && !baris.length ? (
          <div className="space-y-1.5 p-4">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />)}
          </div>
        ) : !tampil.length ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              {baris.length ? "Tidak ada yang cocok" : "Belum ada data terbaca"}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              {baris.length ? "Tidak ada sertifikat yang mendesak pada saringan ini." : "Tekan Muat ulang untuk mencoba lagi."}
            </p>
          </div>
        ) : (
          <>
            {/* layar lebar */}
            <div className="hidden md:block">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                    <th className="px-4 py-2 font-bold">Kapal</th>
                    <th className="px-3 py-2 font-bold">Sertifikat</th>
                    <th className="px-3 py-2 font-bold">Berlaku sampai</th>
                    <th className="px-3 py-2 font-bold">Sisa</th>
                    <th className="px-4 py-2 text-right font-bold">Berkas</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map(({ s, st }, i) => (
                    <tr key={`${s.kapal}-${s.jenis}-${i}`}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_SERT[st].titik}`} />
                          <button onClick={() => setDetail(s.kapal)} className="font-semibold text-slate-800 underline-offset-2 hover:underline dark:text-slate-100">
                            {s.kapal}
                          </button>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-slate-800 dark:text-slate-100">{s.jenis}</p>
                        {s.kelompok && <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.kelompok}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                        {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${nadaSel[st]}`}>
                          {teksSisa(s)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {s.berkasUrl
                          ? <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16357f] underline-offset-2 hover:underline dark:text-sky-400">
                              Buka <Ikon nama="keluarTaut" className="h-3 w-3" />
                            </a>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ponsel */}
            <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {tampil.map(({ s, st }, i) => (
                <div key={`${s.kapal}-${s.jenis}-${i}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{s.kapal}</p>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${nadaSel[st]}`}>{teksSisa(s)}</span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-slate-700 dark:text-slate-200">{s.jenis}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {s.kelompok} · {s.permanen ? "Permanen" : tanggalSert(s.berlaku)}
                  </p>
                  {s.berkasUrl && (
                    <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#16357f] dark:text-sky-400">
                      Buka berkas <Ikon nama="keluarTaut" className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* ── rincian satu sel papan ──────────────────────────────────────── */}
      {sel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => setSel(null)}>
          <div className="w-full rounded-t-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-md sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{sel.s.kelompok || "Dokumen"}</p>
                <h3 className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{sel.s.jenis}</h3>
                <p className="text-[12px] text-slate-500">{sel.s.kapal}</p>
              </div>
              <button onClick={() => setSel(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <Ikon nama="silang" className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className={`rounded-md border px-3 py-2.5 text-center ${nadaSel[sel.st]}`}>
                <p className="text-lg font-bold leading-none tabular-nums">{teksSisa(sel.s)}</p>
                <p className="mt-1 text-[11px] opacity-75">{STATUS_SERT[sel.st].label}</p>
              </div>

              {/*
                Nomor sertifikat diketik di sini, bukan di Excel: yang diketik di
                Excel hilang tiap kali borang dibuat ulang, sedangkan yang diketik
                di sini tersimpan dan ikut tercetak selamanya.
              */}
              {kodeBorang(sel.s.jenis).map((b) => {
                const kunci = kunciNomor(b.kode, sel.s.jenis);
                const nilai = nomorSert[sel.s.kapal]?.[kunci] || "";
                return (
                  <label key={b.kode} className="mt-3 block">
                    <span className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Nomor sertifikat · {b.kode}</span>
                      {nomorSimpan === kunci && <span className="text-[#16357f] dark:text-sky-400">menyimpan…</span>}
                    </span>
                    <input
                      defaultValue={nilai}
                      placeholder="ketik nomor yang tertera di berkas"
                      onBlur={(e) => {
                        const baru = e.target.value.trim();
                        if (baru !== nilai) simpanNomor(sel.s.kapal, b.kode, sel.s.jenis, baru);
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                );
              })}

              <dl className="mt-3 divide-y divide-slate-100 text-[12.5px] dark:divide-slate-800">
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="text-slate-500">Terbit</dt>
                  <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{tanggalSert(sel.s.terbit)}</dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="text-slate-500">Berlaku sampai</dt>
                  <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{sel.s.permanen ? "Permanen" : tanggalSert(sel.s.berlaku)}</dd>
                </div>
                {sel.s.berkasNama && (
                  <div className="flex justify-between gap-3 py-1.5">
                    <dt className="shrink-0 text-slate-500">Berkas</dt>
                    <dd className="truncate text-right text-[11.5px] text-slate-600 dark:text-slate-300" title={sel.s.berkasNama}>{sel.s.berkasNama}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                {sel.s.berkasUrl
                  ? <a href={sel.s.berkasUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#16357f] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#12296a]">
                      <Ikon nama="dokumen" className="h-3.5 w-3.5" /> Buka berkas
                    </a>
                  : <span className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-center text-[11px] text-slate-400 dark:border-slate-700">Berkas belum ditautkan di lembar sumber</span>}
                <button onClick={() => { setDetail(sel.s.kapal); setSel(null); }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-200">
                  Semua dokumen kapal ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── rincian satu kapal ──────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={() => setDetail("")}>
          <div className="flex max-h-[92vh] w-full flex-col rounded-t-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-3xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{detail}</h3>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-slate-500">
                  <span>{isiDetail.length} dokumen</span>
                  <span className="text-rose-600 dark:text-rose-400">{isiDetail.filter((x) => x.st === "lewat").length} lewat</span>
                  <span className="text-orange-600 dark:text-orange-400">{isiDetail.filter((x) => x.st === "kritis").length} habis ≤ 30 hari</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => salinMendesak(isiDetail, `SERTIFIKAT PERLU PERPANJANGAN — ${detail}`)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-200">
                  <Ikon nama="salin" className="h-3.5 w-3.5" /> Salin
                </button>
                <button onClick={() => setDetail("")} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <Ikon nama="silang" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto">
              {Array.from(new Set(isiDetail.map(({ s }) => s.kelompok))).map((kel) => (
                <div key={kel}>
                  <p className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                    {kel || "Lainnya"}
                  </p>
                  {isiDetail.filter(({ s }) => s.kelompok === kel).map(({ s, st }, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_SERT[st].titik}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{s.jenis}</p>
                        <p className="text-[11px] tabular-nums text-slate-500">
                          {s.permanen ? "Permanen" : <>berlaku s.d. {tanggalSert(s.berlaku)}</>}
                          {s.terbit && <> · terbit {tanggalSert(s.terbit)}</>}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${nadaSel[st]}`}>{teksSisa(s)}</span>
                      {s.berkasUrl && (
                        <a href={s.berkasUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#16357f] underline-offset-2 hover:underline dark:text-sky-400">
                          Buka <Ikon nama="keluarTaut" className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
