"use client";
/**
 * LAYAR SERTIFIKAT — papan monitor untuk layar kantor.
 *
 * Bedanya dengan halaman /sertifikat: yang ini tidak untuk dikerjakan,
 * melainkan untuk DILIHAT. Tidak ada saringan, tidak ada tombol yang perlu
 * ditekan, dan tidak ada login — layar di ruang kantor menyala sendiri,
 * membuka satu tautan, lalu dibiarkan berhari-hari.
 *
 * Tiga keputusan yang menentukan bentuknya:
 *
 * 1. Yang ditampilkan hanya sertifikat BERTANGGAL. Dokumen permanen (Surat
 *    Laut, Grosse Akte, Surat Ukur) tidak pernah mati, jadi ia tak pernah
 *    menuntut tindakan — kehadirannya di daftar utama hanya memanjangkan
 *    layar. Jumlahnya tetap ditampilkan, di panel tersendiri.
 *
 * 2. Daftar berjalan sendiri. Yang jatuh tempo bisa ratusan baris sedangkan
 *    layar hanya memuat belasan; halaman berganti otomatis tiap 12 detik,
 *    diurut dari yang paling mendesak. Orang yang lewat dan berdiri sebentar
 *    tetap melihat bagian yang berbeda.
 *
 * 3. Gelap dan besar. Layar dinding dibaca dari tiga sampai lima meter, sering
 *    dengan lampu ruangan menyala; latar gelap dengan angka besar berwarna
 *    jauh lebih terbaca daripada tabel putih rapat.
 *
 * Datanya ditarik dari lembar MUSTER cabang lewat /api/publik/sertifikat tiap
 * menit, dan sisa hari dihitung ulang di layar terhadap jam saat itu — bukan
 * disalin dari kolom lembar yang ikut basi begitu lembarnya tidak dibuka.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Dokumen {
  kapal: string;
  kelompok: string;
  jenis: string;
  berlaku: string;
  terbit: string;
  permanen: boolean;
  sisaHari: number | null;
  status: string;
}

const SELANG_MUAT = 60 * 1000;        // tarik data tiap menit
const SELANG_HALAMAN = 10 * 1000;     // ganti halaman daftar tiap 10 detik
/*
 * Banyaknya baris per halaman DIUKUR, tidak ditetapkan. Layar kantor bisa
 * 1080p, bisa televisi lain, bisa juga jendela peramban di meja siapa pun yang
 * membuka tautannya — angka tetap berarti daftarnya terpotong di layar pendek
 * dan menyisakan ruang kosong di layar tinggi. Yang diukur tinggi wadahnya,
 * lalu dibagi tinggi satu baris.
 */
const TINGGI_BARIS_AWAL = 62;   // tebakan pertama, dikoreksi dari baris sungguhan
const TINGGI_KEPALA_TABEL = 34;

const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const tanggalPendek = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return BULAN[+m] ? `${+d} ${BULAN[+m]} ${y.slice(2)}` : iso;
};

/** sisa hari dihitung ulang di layar, bukan dipercaya dari lembar */
function sisaHariDari(berlaku: string): number | null {
  if (!berlaku) return null;
  const [y, m, d] = berlaku.split("-").map(Number);
  if (!y || !m || !d) return null;
  const habis = new Date(y, m - 1, d);
  const kini = new Date();
  const nol = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());
  return Math.round((habis.getTime() - nol.getTime()) / 86_400_000);
}

type Tingkat = "lewat" | "kritis" | "waspada" | "aman";

const tingkatDari = (sisa: number): Tingkat =>
  sisa < 0 ? "lewat" : sisa <= 30 ? "kritis" : sisa <= 90 ? "waspada" : "aman";

const NADA: Record<Tingkat, { pita: string; teks: string; latar: string; label: string }> = {
  lewat: { pita: "bg-rose-500", teks: "text-rose-300", latar: "bg-rose-500/15", label: "Kedaluwarsa" },
  kritis: { pita: "bg-orange-500", teks: "text-orange-300", latar: "bg-orange-500/15", label: "≤ 30 hari" },
  waspada: { pita: "bg-amber-400", teks: "text-amber-300", latar: "bg-amber-400/12", label: "≤ 90 hari" },
  aman: { pita: "bg-emerald-500", teks: "text-emerald-300", latar: "bg-emerald-500/10", label: "Aman" },
};

const teksSisa = (sisa: number) =>
  sisa < 0 ? `lewat ${Math.abs(sisa)} hari` : sisa === 0 ? "habis hari ini" : `${sisa} hari lagi`;

export default function LayarSertifikat() {
  const [dokumen, setDokumen] = useState<Dokumen[]>([]);
  const [kapalAda, setKapalAda] = useState<string[]>([]);
  const [galat, setGalat] = useState("");
  const [diperbarui, setDiperbarui] = useState<Date | null>(null);
  /*
   * Jam sengaja kosong pada render pertama. Halaman ini dibangun lebih dulu di
   * server, dan jam server tidak pernah sama persis dengan jam peramban —
   * mengisinya di awal membuat React menemukan dua hasil yang berbeda dan
   * membuang seluruh hasil server (galat hidrasi 418/423/425).
   */
  const [jam, setJam] = useState<Date | null>(null);
  const [halaman, setHalaman] = useState(0);
  const [muatBaris, setMuatBaris] = useState(10);
  const wadahDaftar = useRef<HTMLDivElement | null>(null);
  const badanTabel = useRef<HTMLTableSectionElement | null>(null);
  const tinggiBaris = useRef(TINGGI_BARIS_AWAL);

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/publik/sertifikat", { cache: "no-store" });
      const d = await r.json();
      if (!d?.ok) { setGalat(d?.error || "Data tidak terbaca"); return; }
      setDokumen(d.dokumen || []);
      setKapalAda(d.kapal || []);
      setDiperbarui(new Date());
      setGalat("");
    } catch (e: any) {
      setGalat(e?.message || "Sambungan terputus");
    }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);
  useEffect(() => {
    const t = setInterval(() => { void ambil(); }, SELANG_MUAT);
    return () => clearInterval(t);
  }, [ambil]);
  useEffect(() => {
    setJam(new Date());
    const t = setInterval(() => setJam(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /*
   * Hanya dokumen bertanggal yang masuk daftar utama. Yang permanen dipisah
   * sejak awal, bukan disaring belakangan, supaya seluruh angka di layar ini
   * berbicara tentang hal yang sama: apa yang akan mati.
   */
  const berjatuhTempo = useMemo(() => {
    return dokumen
      .filter((s) => !s.permanen && s.berlaku)
      .map((s) => ({ ...s, sisa: sisaHariDari(s.berlaku) }))
      .filter((s): s is Dokumen & { sisa: number } => s.sisa !== null)
      .sort((a, b) => a.sisa - b.sisa);
  }, [dokumen]);

  const permanen = useMemo(() => dokumen.filter((s) => s.permanen), [dokumen]);
  const tanpaTanggal = useMemo(
    () => dokumen.filter((s) => !s.permanen && (!s.berlaku || sisaHariDari(s.berlaku) === null)),
    [dokumen]);

  const hitung = useMemo(() => {
    const h = { lewat: 0, kritis: 0, waspada: 0, aman: 0 };
    berjatuhTempo.forEach((s) => { h[tingkatDari(s.sisa)]++; });
    return h;
  }, [berjatuhTempo]);

  const perluTindakan = hitung.lewat + hitung.kritis;
  const total = berjatuhTempo.length;
  const persenAman = total ? Math.round((hitung.aman / total) * 100) : 0;

  /** yang tampil di daftar berjalan: semua yang belum aman, paling mendesak dulu */
  const antre = useMemo(() => berjatuhTempo.filter((s) => s.sisa <= 90), [berjatuhTempo]);
  const jumlahHalaman = Math.max(1, Math.ceil(antre.length / muatBaris));

  /* daftar mengisi ruang yang tersisa, berapa pun tinggi layarnya */
  const ukur = useCallback(() => {
    const el = wadahDaftar.current;
    if (!el) return;
    setMuatBaris(Math.max(4, Math.floor((el.clientHeight - TINGGI_KEPALA_TABEL) / tinggiBaris.current)));
  }, []);

  useEffect(() => {
    const el = wadahDaftar.current;
    if (!el) return;
    ukur();
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [ukur]);

  /*
   * Tinggi satu baris tidak ditebak dua kali. Angka awal hanya dipakai untuk
   * render pertama; sesudah barisnya benar-benar ada di layar, tingginya dibaca
   * dari DOM — sehingga ukuran huruf peramban, penyekalaan televisi, atau nama
   * dokumen yang memakan dua baris tidak lagi membuat baris terakhir terpotong.
   */
  useEffect(() => {
    const baris = badanTabel.current?.rows?.[0];
    if (!baris) return;
    const tinggi = baris.getBoundingClientRect().height;
    if (tinggi > 20 && Math.abs(tinggi - tinggiBaris.current) > 2) {
      tinggiBaris.current = tinggi;
      ukur();
    }
  });

  useEffect(() => {
    if (jumlahHalaman <= 1) { setHalaman(0); return; }
    const t = setInterval(() => setHalaman((h) => (h + 1) % jumlahHalaman), SELANG_HALAMAN);
    return () => clearInterval(t);
  }, [jumlahHalaman]);

  /* jendela mengecil di tengah putaran bisa meninggalkan nomor halaman di luar jangkauan */
  useEffect(() => { if (halaman >= jumlahHalaman) setHalaman(0); }, [halaman, jumlahHalaman]);

  const tampil = antre.slice(halaman * muatBaris, halaman * muatBaris + muatBaris);

  /** ringkasan per kapal — kapal paling bermasalah di atas */
  const perKapal = useMemo(() => {
    const peta = new Map<string, { lewat: number; kritis: number; waspada: number; aman: number; dekat: number | null }>();
    (kapalAda.length ? kapalAda : Array.from(new Set(berjatuhTempo.map((s) => s.kapal)))).forEach((k) =>
      peta.set(k, { lewat: 0, kritis: 0, waspada: 0, aman: 0, dekat: null }));
    berjatuhTempo.forEach((s) => {
      const p = peta.get(s.kapal) || { lewat: 0, kritis: 0, waspada: 0, aman: 0, dekat: null };
      p[tingkatDari(s.sisa)]++;
      if (s.sisa >= 0 && (p.dekat === null || s.sisa < p.dekat)) p.dekat = s.sisa;
      peta.set(s.kapal, p);
    });
    return Array.from(peta.entries())
      .map(([kapal, p]) => ({ kapal, ...p, skor: p.lewat * 1000 + p.kritis * 10 + p.waspada }))
      .sort((a, b) => b.skor - a.skor || a.kapal.localeCompare(b.kapal, "id"));
  }, [berjatuhTempo, kapalAda]);

  const jamTeks = jam ? jam.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--.--.--";
  const tanggalTeks = jam ? jam.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="h-screen overflow-hidden bg-[#0a1020] text-white">
      <div className="mx-auto flex h-full max-w-[130rem] flex-col gap-4 p-5">
        {/* ── kepala ───────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3">
          <div className="min-w-[22rem] flex-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-sky-300/80">
              PT ASDP Indonesia Ferry (Persero) · Cabang Ternate
            </p>
            <h1 className="mt-1 text-4xl font-black leading-none tracking-tight">Monitor Sertifikat Armada</h1>
            <p className="mt-1.5 text-[15px] text-white/55">
              {kapalAda.length || 13} kapal · {total} dokumen bermasa berlaku · dihitung ulang terhadap hari ini
            </p>
          </div>

          <div className="text-right">
            <p className="text-4xl font-black tabular-nums tracking-tight">{jamTeks}</p>
            <p className="mt-1 text-[15px] capitalize text-white/55">{tanggalTeks}</p>
            <p className="mt-1 flex items-center justify-end gap-2 text-[13px] text-white/45">
              <span className={`h-2 w-2 rounded-full ${galat ? "bg-rose-500" : "animate-pulse bg-emerald-400"}`} />
              {galat
                ? `Gagal menyegarkan — ${galat}`
                : diperbarui
                  ? `Data lembar MUSTER, diperbarui ${diperbarui.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                  : "Menarik data…"}
            </p>
          </div>
        </header>

        {/* ── angka besar ──────────────────────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-5">
          {([
            ["lewat", hitung.lewat, "Kedaluwarsa", "harus segera diurus"],
            ["kritis", hitung.kritis, "Habis ≤ 30 hari", "siapkan perpanjangan"],
            ["waspada", hitung.waspada, "Habis ≤ 90 hari", "masuk antrean"],
            ["aman", hitung.aman, "Masih aman", "di atas 90 hari"],
          ] as [Tingkat, number, string, string][]).map(([t, n, judul, ket]) => (
            <div key={t} className={`relative overflow-hidden rounded-2xl border border-white/10 ${NADA[t].latar} px-6 py-4`}>
              <span className={`absolute inset-y-0 left-0 w-1.5 ${NADA[t].pita}`} />
              <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/55">{judul}</p>
              <p className={`mt-1 text-5xl font-black leading-none tabular-nums ${NADA[t].teks}`}>{n}</p>
              <p className="mt-1.5 text-[14px] text-white/45">{ket}</p>
            </div>
          ))}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4">
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/55">Kesehatan armada</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-black leading-none tabular-nums">{persenAman}</span>
              <span className="text-2xl font-bold text-white/50">%</span>
            </p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/10">
              {(["lewat", "kritis", "waspada", "aman"] as Tingkat[]).map((t) => (
                hitung[t] > 0 && (
                  <span key={t} className={NADA[t].pita} style={{ width: `${(hitung[t] / Math.max(1, total)) * 100}%` }} />
                )
              ))}
            </div>
            <p className="mt-2 text-[14px] text-white/45">
              {perluTindakan > 0
                ? <><b className="text-rose-300">{perluTindakan} dokumen</b> perlu tindakan sekarang</>
                : "Tidak ada yang mendesak"}
            </p>
          </div>
        </section>

        {/* ── daftar berjalan + ringkasan kapal ────────────────────────── */}
        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
          {/* daftar yang akan mati */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-6 py-3.5">
              <h2 className="flex-1 text-xl font-black tracking-tight">
                Sertifikat yang akan mati
                <span className="ml-3 text-[15px] font-semibold text-white/45">
                  {antre.length} dokumen habis dalam 90 hari ke depan atau sudah lewat
                </span>
              </h2>
              {jumlahHalaman > 1 && (
                <span className="flex items-center gap-2 text-[14px] font-bold tabular-nums text-white/50">
                  Halaman {halaman + 1}/{jumlahHalaman}
                  <span className="flex gap-1">
                    {Array.from({ length: jumlahHalaman }).map((_, i) => (
                      <span key={i} className={`h-1.5 w-4 rounded-full ${i === halaman ? "bg-sky-400" : "bg-white/20"}`} />
                    ))}
                  </span>
                </span>
              )}
            </div>

            <div ref={wadahDaftar} className="min-h-0 flex-1 overflow-hidden">
              {!tampil.length ? (
                <p className="px-6 py-20 text-center text-xl text-white/40">
                  {dokumen.length ? "Tidak ada sertifikat yang mendesak — seluruhnya di atas 90 hari." : "Menarik data dari lembar MUSTER…"}
                </p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">
                      <th className="w-52 px-6 py-2.5">Kapal</th>
                      <th className="px-3 py-2.5">Dokumen</th>
                      <th className="w-40 px-3 py-2.5">Berlaku s.d.</th>
                      <th className="w-52 px-3 py-2.5 text-right">Sisa waktu</th>
                    </tr>
                  </thead>
                  <tbody ref={badanTabel}>
                    {tampil.map((s, i) => {
                      const t = tingkatDari(s.sisa);
                      return (
                        <tr key={`${s.kapal}-${s.jenis}-${i}`} className="border-t border-white/[0.06]">
                          <td className="px-6 py-2">
                            <span className="flex items-center gap-3">
                              <span className={`h-7 w-1.5 rounded-full ${NADA[t].pita}`} />
                              <span className="whitespace-nowrap text-[19px] font-bold tracking-tight">{s.kapal.replace(/^KMP\.?\s*/i, "")}</span>
                            </span>
                          </td>
                          {/* kelompok aturan menyusul di baris yang sama — memberinya baris
                              sendiri memangkas jumlah dokumen yang muat di layar hampir separuh */}
                          <td className="px-3 py-2">
                            <span className="text-[18px] font-medium leading-tight">{s.jenis}</span>
                            <span className="ml-2 text-[12px] uppercase tracking-wide text-white/30">{s.kelompok}</span>
                          </td>
                          <td className="px-3 py-2 text-[18px] font-semibold tabular-nums text-white/70">
                            {tanggalPendek(s.berlaku)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`inline-block rounded-lg px-3 py-1 text-[18px] font-black tabular-nums ${NADA[t].latar} ${NADA[t].teks}`}>
                              {teksSisa(s.sisa)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ringkasan per kapal */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-3.5">
              <h2 className="text-xl font-black tracking-tight">Per kapal</h2>
              <p className="text-[13px] text-white/45">Diurut dari yang paling perlu perhatian</p>
            </div>
            {/* tiga belas kapal harus muat seluruhnya — barisnya membagi rata sisa ruang */}
            <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.06] overflow-hidden">
              {perKapal.map((k) => {
                const jumlah = k.lewat + k.kritis + k.waspada + k.aman;
                return (
                  <div key={k.kapal} className="flex min-h-0 flex-1 items-center gap-2.5 px-5">
                    <span className="flex-1 truncate text-[16px] font-bold tracking-tight">
                      {k.kapal.replace(/^KMP\.?\s*/i, "")}
                    </span>
                    <span className="flex w-[4.5rem] justify-end gap-1.5 text-[15px] font-black tabular-nums">
                      {k.lewat > 0 && <span className="text-rose-300">{k.lewat}</span>}
                      {k.kritis > 0 && <span className="text-orange-300">{k.kritis}</span>}
                      {k.waspada > 0 && <span className="text-amber-300">{k.waspada}</span>}
                      {!k.lewat && !k.kritis && !k.waspada && <span className="text-emerald-300">aman</span>}
                    </span>
                    <span className="flex h-2 w-20 overflow-hidden rounded-full bg-white/10">
                      {(["lewat", "kritis", "waspada", "aman"] as Tingkat[]).map((t) => (
                        k[t] > 0 && <span key={t} className={NADA[t].pita} style={{ width: `${(k[t] / Math.max(1, jumlah)) * 100}%` }} />
                      ))}
                    </span>
                    <span className="w-14 text-right text-[13px] tabular-nums text-white/40">
                      {k.dekat !== null ? `${k.dekat} hr` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── kaki: dokumen yang tidak pernah mati ─────────────────────── */}
        <footer className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5">
          <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/45">
            Di luar hitungan layar ini
          </span>
          <span className="text-[16px]">
            <b className="text-2xl font-black tabular-nums text-sky-300">{permanen.length}</b>
            <span className="ml-2 text-white/60">dokumen permanen — Surat Laut, Surat Ukur, Grosse Akte dan sejenisnya, tidak punya masa berlaku</span>
          </span>
          {tanpaTanggal.length > 0 && (
            <span className="text-[16px]">
              <b className="text-2xl font-black tabular-nums text-amber-300">{tanpaTanggal.length}</b>
              <span className="ml-2 text-white/60">dokumen belum bertanggal di lembar sumber — perlu dilengkapi</span>
            </span>
          )}
          <span className="ml-auto text-[13px] text-white/35">
            Layar menyegarkan sendiri tiap menit · daftar berganti halaman tiap 10 detik
          </span>
        </footer>
      </div>
    </div>
  );
}
