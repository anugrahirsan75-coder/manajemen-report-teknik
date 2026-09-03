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
 * Sesudah halaman digeser dengan tangan, putaran otomatis berhenti dulu. Kalau
 * ia lanjut jalan, halaman yang sedang dibaca orang akan berganti sendiri di
 * tengah bacaan. Dua menit cukup untuk memeriksa satu halaman, dan sesudahnya
 * layar kembali berjalan sendiri tanpa perlu ada yang menekan apa pun.
 */
const JEDA_MANUAL = 2 * 60 * 1000;
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
  lewat: { pita: "bg-rose-500", teks: "text-rose-200", latar: "bg-rose-500/25", label: "Kedaluwarsa" },
  kritis: { pita: "bg-orange-500", teks: "text-orange-200", latar: "bg-orange-500/25", label: "≤ 30 hari" },
  waspada: { pita: "bg-amber-400", teks: "text-amber-200", latar: "bg-amber-400/20", label: "≤ 90 hari" },
  aman: { pita: "bg-emerald-500", teks: "text-emerald-200", latar: "bg-emerald-500/18", label: "Aman" },
};

const teksSisa = (sisa: number) =>
  sisa < 0 ? `lewat ${Math.abs(sisa)} hari` : sisa === 0 ? "habis hari ini" : `${sisa} hari lagi`;

/** tombol geser halaman — dibuat besar supaya bisa ditekan dari depan layar */
function BtnGeser({ onClick, judul, children }: { onClick: () => void; judul: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={judul}
      className="grid h-9 w-9 place-items-center rounded-lg border border-white/25 bg-white/10 text-[20px] font-black leading-none text-white transition hover:bg-white/25 active:scale-95">
      {children}
    </button>
  );
}

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
  /** putaran otomatis; mati sementara begitu halaman digeser dengan tangan */
  const [otomatis, setOtomatis] = useState(true);
  /**
   * Layar pendek (laptop 768, jendela yang tidak penuh) memakai tata letak
   * rapat. Ukuran huruf papan dinding dibuat untuk dibaca dari lima meter; di
   * layar 768 piksel ukuran itu menyisakan dua baris daftar dan memotong
   * panel kapal — papan yang benar untuk televisi menjadi papan yang rusak di
   * meja. Angkanya tinggi jendela, bukan lebarnya, karena yang habis memang
   * ruang tegak.
   */
  const [rapat, setRapat] = useState(false);
  const wadahDaftar = useRef<HTMLDivElement | null>(null);
  const badanTabel = useRef<HTMLTableSectionElement | null>(null);
  /** langit-langit jumlah baris yang sudah terbukti kebanyakan */
  const batasBaris = useRef(Infinity);

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
    const cekTinggi = () => setRapat(window.innerHeight < 900);
    cekTinggi();
    window.addEventListener("resize", cekTinggi);
    return () => window.removeEventListener("resize", cekTinggi);
  }, []);

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

  /** urutan kapal di layar: yang paling bermasalah lebih dulu */
  const urutanKapal = useMemo(() => perKapal.map((k) => k.kapal), [perKapal]);

  /** yang tampil di daftar berjalan: semua yang belum aman, paling mendesak dulu */
  const antre = useMemo(() => berjatuhTempo.filter((s) => s.sisa <= 90), [berjatuhTempo]);
  /*
   * Halaman disusun PER KAPAL, bukan satu antrean panjang lintas armada.
   *
   * Urutan "paling mendesak dulu" tanpa pengelompokan memang benar secara
   * angka, tetapi di layar ia terbaca acak: satu baris Tuna, satu Baronang,
   * satu Ngafi, lalu Tuna lagi. Orang yang membaca papan ini selalu berpikir
   * per kapal — "yang mana lagi punya Tuna" — dan menyusun ulang potongan itu
   * di kepala setiap sepuluh detik adalah pekerjaan yang tidak perlu ada.
   *
   * Jadi satu halaman = satu kapal (kapal dengan dokumen lebih banyak daripada
   * satu layar memakai halaman lanjutan), kapal paling bermasalah lebih dulu,
   * dan di dalamnya tetap diurut dari yang paling cepat mati.
   */
  const halamanKapal = useMemo(() => {
    const hal: { kapal: string; baris: typeof antre; ke: number; dari: number }[] = [];
    urutanKapal.forEach((k) => {
      const punya = antre.filter((s) => s.kapal === k);
      if (!punya.length) return;
      const potong = Math.max(1, Math.ceil(punya.length / muatBaris));
      for (let i = 0; i < potong; i++) {
        hal.push({ kapal: k, baris: punya.slice(i * muatBaris, (i + 1) * muatBaris), ke: i + 1, dari: potong });
      }
    });
    return hal;
  }, [antre, muatBaris, urutanKapal]);

  const jumlahHalaman = Math.max(1, halamanKapal.length);

  /*
   * Berapa baris yang muat DIPUTUSKAN DARI HASIL, bukan dari hitungan.
   *
   * Menghitungnya dari tinggi baris selalu meleset: nama dokumen panjang patah
   * dua baris di layar yang tidak selebar televisi, tinggi baris berbeda tiap
   * halaman, dan tebakan yang meleset satu baris membuat baris terakhir
   * terpotong separuh — persis cacat yang paling kelihatan di papan dinding.
   *
   * Jadi layar ini melihat sendiri: kalau isinya melimpah keluar wadah, satu
   * baris dikurangi; kalau masih tersisa ruang selebar satu baris penuh, satu
   * baris ditambah. Batas atas diingat supaya ia tidak menambah lalu mengurangi
   * baris yang sama terus-menerus, dan dilupakan begitu ukuran jendela berubah.
   */
  const ukur = useCallback(() => {
    const el = wadahDaftar.current;
    if (!el) return;
    batasBaris.current = Infinity;
    setMuatBaris(Math.max(3, Math.floor((el.clientHeight - TINGGI_KEPALA_TABEL) / TINGGI_BARIS_AWAL)));
  }, []);

  useEffect(() => {
    const el = wadahDaftar.current;
    if (!el) return;
    ukur();
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [ukur]);

  useEffect(() => {
    const el = wadahDaftar.current;
    const rows = badanTabel.current?.rows;
    if (!el || !rows?.length) return;

    let tertinggi = 0;
    for (let i = 0; i < rows.length; i++) {
      tertinggi = Math.max(tertinggi, rows[i].getBoundingClientRect().height);
    }

    if (el.scrollHeight > el.clientHeight + 2) {
      setMuatBaris((n) => {
        batasBaris.current = Math.max(3, n - 1);
        return batasBaris.current;
      });
      return;
    }
    if (muatBaris < batasBaris.current && el.clientHeight - el.scrollHeight > tertinggi + 4) {
      setMuatBaris((n) => n + 1);
    }
  });

  useEffect(() => {
    if (jumlahHalaman <= 1) { setHalaman(0); return; }
    if (!otomatis) return;
    const t = setInterval(() => setHalaman((h) => (h + 1) % jumlahHalaman), SELANG_HALAMAN);
    return () => clearInterval(t);
  }, [jumlahHalaman, otomatis]);

  const keHalaman = useCallback((n: number) => {
    setOtomatis(false);
    setHalaman(((n % jumlahHalaman) + jumlahHalaman) % jumlahHalaman);
  }, [jumlahHalaman]);

  /* jeda tangan berakhir sendiri — tiap geseran baru menghitung ulang dari nol */
  useEffect(() => {
    if (otomatis) return;
    const t = setTimeout(() => setOtomatis(true), JEDA_MANUAL);
    return () => clearTimeout(t);
  }, [otomatis, halaman]);

  /* panah kiri/kanan pada papan tik atau penunjuk nirkabel presentasi */
  useEffect(() => {
    const tekan = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") keHalaman(halaman - 1);
      else if (ev.key === "ArrowRight") keHalaman(halaman + 1);
      else if (ev.key === " ") { ev.preventDefault(); setOtomatis((o) => !o); }
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [halaman, keHalaman]);

  /* jendela mengecil di tengah putaran bisa meninggalkan nomor halaman di luar jangkauan */
  useEffect(() => { if (halaman >= jumlahHalaman) setHalaman(0); }, [halaman, jumlahHalaman]);

  const halamanIni = halamanKapal[halaman];
  const tampil = halamanIni?.baris || [];


  const jamTeks = jam ? jam.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--.--.--";
  const tanggalTeks = jam ? jam.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-[#0a1020] text-white xl:h-screen xl:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-[130rem] flex-col gap-4 p-5 xl:h-full xl:min-h-0">
        {/* ── kepala ───────────────────────────────────────────────────── */}
        <header className={`flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.04] px-6 ${rapat ? "py-2" : "py-3"}`}>
          <div className="min-w-[22rem] flex-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-sky-200">
              PT ASDP Indonesia Ferry (Persero) · Cabang Ternate
            </p>
            <h1 className={`mt-1 font-black leading-none tracking-tight ${rapat ? "text-2xl" : "text-4xl"}`}>Monitor Sertifikat Armada</h1>
            {!rapat && (
              <p className="mt-1.5 text-[15px] text-white/85">
                {kapalAda.length || 13} kapal · {total} dokumen bermasa berlaku · dihitung ulang terhadap hari ini
              </p>
            )}
          </div>

          <div className="text-right">
            <p className={`font-black tabular-nums tracking-tight ${rapat ? "text-2xl" : "text-4xl"}`}>{jamTeks}</p>
            <p className={`mt-1 capitalize text-white/85 ${rapat ? "text-[13px]" : "text-[15px]"}`}>{tanggalTeks}</p>
            <p className="mt-1 flex items-center justify-end gap-2 text-[13px] text-white/75">
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
            <div key={t} className={`relative overflow-hidden rounded-2xl border border-white/10 ${NADA[t].latar} px-6 ${rapat ? "py-2" : "py-4"}`}>
              <span className={`absolute inset-y-0 left-0 w-1.5 ${NADA[t].pita}`} />
              <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/85">{judul}</p>
              <p className={`mt-1 font-black leading-none tabular-nums ${rapat ? "text-3xl" : "text-5xl"} ${NADA[t].teks}`}>{n}</p>
              {!rapat && <p className="mt-1.5 text-[14px] text-white/75">{ket}</p>}
            </div>
          ))}

          <div className={`rounded-2xl border border-white/10 bg-white/[0.04] px-6 ${rapat ? "py-2" : "py-4"}`}>
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/85">Kesehatan armada</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className={`font-black leading-none tabular-nums ${rapat ? "text-3xl" : "text-5xl"}`}>{persenAman}</span>
              <span className="text-2xl font-bold text-white/80">%</span>
            </p>
            <div className={`flex h-2.5 overflow-hidden rounded-full bg-white/10 ${rapat ? "mt-1.5" : "mt-3"}`}>
              {(["lewat", "kritis", "waspada", "aman"] as Tingkat[]).map((t) => (
                hitung[t] > 0 && (
                  <span key={t} className={NADA[t].pita} style={{ width: `${(hitung[t] / Math.max(1, total)) * 100}%` }} />
                )
              ))}
            </div>
            <p className={`mt-2 text-white/75 ${rapat ? "text-[12px]" : "text-[14px]"}`}>
              {perluTindakan > 0
                ? <><b className="text-rose-200">{perluTindakan} dokumen</b> perlu tindakan sekarang</>
                : "Tidak ada yang mendesak"}
            </p>
          </div>
        </section>

        {/* ── daftar berjalan + ringkasan kapal ────────────────────────── */}
        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
          {/* daftar yang akan mati */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className={`flex flex-wrap items-center gap-3 border-b border-white/10 px-6 ${rapat ? "py-2" : "py-3.5"}`}>
              <h2 className="flex-1">
                <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-sky-200">
                  Sertifikat yang akan mati · {antre.length} dokumen ≤ 90 hari atau sudah lewat
                </span>
                <span className={`mt-0.5 block font-black leading-none tracking-tight ${rapat ? "text-lg" : "text-2xl"}`}>
                  {halamanIni ? halamanIni.kapal : "—"}
                  {halamanIni && halamanIni.dari > 1 && (
                    <span className="ml-2 text-[15px] font-bold text-white/75">
                      bagian {halamanIni.ke} dari {halamanIni.dari}
                    </span>
                  )}
                  {halamanIni && (
                    <span className="ml-3 text-[15px] font-semibold text-white/75">
                      {antre.filter((s) => s.kapal === halamanIni.kapal).length} dokumen jatuh tempo
                    </span>
                  )}
                </span>
              </h2>
              {jumlahHalaman > 1 && (
                /*
                 * Layar ini berjalan sendiri, tetapi orang yang berdiri di
                 * depannya sering ingin mundur satu halaman untuk membaca ulang
                 * yang barusan lewat. Tanpa tombol, satu-satunya cara adalah
                 * menunggu seluruh putaran kembali — beberapa menit.
                 */
                <span className="flex items-center gap-2">
                  <BtnGeser judul="Halaman sebelumnya (←)" onClick={() => keHalaman(halaman - 1)}>‹</BtnGeser>
                  <span className="w-[6.5rem] text-center text-[15px] font-bold tabular-nums text-white/90">
                    Hal. {halaman + 1}/{jumlahHalaman}
                  </span>
                  <BtnGeser judul="Halaman berikutnya (→)" onClick={() => keHalaman(halaman + 1)}>›</BtnGeser>
                  <button type="button" onClick={() => setOtomatis((o) => !o)}
                    title={otomatis ? "Hentikan putaran otomatis (spasi)" : "Jalankan lagi putaran otomatis (spasi)"}
                    className={`ml-1 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition ${
                      otomatis
                        ? "border-white/25 bg-white/10 text-white/90 hover:bg-white/20"
                        : "border-amber-400/60 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30"}`}>
                    {otomatis ? "❙❙ Jeda" : "▶ Lanjut"}
                  </button>
                </span>
              )}
            </div>

            {jumlahHalaman > 1 && (
              <span className="flex flex-wrap gap-1 border-b border-white/10 px-6 py-2">
                {halamanKapal.map((h, i) => (
                  <button key={`${h.kapal}-${h.ke}`} type="button" onClick={() => keHalaman(i)}
                    title={`${h.kapal}${h.dari > 1 ? ` — bagian ${h.ke}` : ""}`}
                    className={`h-2 w-6 rounded-full transition ${i === halaman ? "bg-sky-400" : "bg-white/25 hover:bg-white/50"}`} />
                ))}
              </span>
            )}

            <div ref={wadahDaftar} className="min-h-0 flex-1 overflow-hidden">
              {!tampil.length ? (
                <p className="px-6 py-20 text-center text-xl text-white/70">
                  {dokumen.length ? "Tidak ada sertifikat yang mendesak — seluruhnya di atas 90 hari." : "Menarik data dari lembar MUSTER…"}
                </p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className={`font-bold uppercase tracking-[0.14em] text-white/70 ${rapat ? "text-[11px]" : "text-[12px]"}`}>
                      <th className={`w-44 px-6 ${rapat ? "py-1.5" : "py-2.5"}`}>Keadaan</th>
                      <th className={`px-3 ${rapat ? "py-1.5" : "py-2.5"}`}>Dokumen</th>
                      <th className={`w-40 px-3 ${rapat ? "py-1.5" : "py-2.5"}`}>Berlaku s.d.</th>
                      <th className={`w-52 px-3 text-right ${rapat ? "py-1.5" : "py-2.5"}`}>Sisa waktu</th>
                    </tr>
                  </thead>
                  <tbody ref={badanTabel}>
                    {tampil.map((s, i) => {
                      const t = tingkatDari(s.sisa);
                      return (
                        <tr key={`${s.kapal}-${s.jenis}-${i}`} className="border-t border-white/[0.10]">
                          {/* nama kapal sudah menjadi judul halaman — kolom ini dipakai
                              menyebut tingkat keadaannya, yang dulu hanya berupa warna */}
                          <td className={`px-6 ${rapat ? "py-1" : "py-2"}`}>
                            <span className="flex items-center gap-3">
                              <span className={`w-1.5 rounded-full ${rapat ? "h-5" : "h-7"} ${NADA[t].pita}`} />
                              <span className={`whitespace-nowrap font-bold tracking-tight ${rapat ? "text-[13px]" : "text-[16px]"} ${NADA[t].teks}`}>
                                {NADA[t].label}
                              </span>
                            </span>
                          </td>
                          {/* kelompok aturan menyusul di baris yang sama — memberinya baris
                              sendiri memangkas jumlah dokumen yang muat di layar hampir separuh */}
                          <td className={`px-3 ${rapat ? "py-1" : "py-2"}`}>
                            <span className={`font-medium leading-tight ${rapat ? "text-[15px]" : "text-[18px]"}`}>{s.jenis}</span>
                            <span className={`ml-2 uppercase tracking-wide text-white/60 ${rapat ? "text-[11px]" : "text-[12px]"}`}>{s.kelompok}</span>
                          </td>
                          <td className={`px-3 font-semibold tabular-nums text-white/95 ${rapat ? "py-1 text-[15px]" : "py-2 text-[18px]"}`}>
                            {tanggalPendek(s.berlaku)}
                          </td>
                          <td className={`px-3 text-right ${rapat ? "py-1" : "py-2"}`}>
                            <span className={`inline-block rounded-lg px-3 py-1 font-black tabular-nums ${rapat ? "text-[15px]" : "text-[18px]"} ${NADA[t].latar} ${NADA[t].teks}`}>
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
            <div className={`border-b border-white/10 px-5 ${rapat ? "py-2" : "py-3.5"}`}>
              <h2 className="text-xl font-black tracking-tight">Per kapal</h2>
              {!rapat && <p className="text-[13px] text-white/75">Diurut dari yang paling perlu perhatian</p>}
            </div>
            {/* tiga belas kapal harus muat seluruhnya — barisnya membagi rata sisa ruang */}
            <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.10] overflow-y-auto">
              {perKapal.map((k) => {
                const jumlah = k.lewat + k.kritis + k.waspada + k.aman;
                return (
                  <div key={k.kapal}
                    className={`flex flex-1 items-center gap-2.5 overflow-hidden px-5 transition ${rapat ? "min-h-[1.4rem]" : "min-h-[1.75rem]"} ${
                      halamanIni?.kapal === k.kapal ? "bg-sky-400/15" : ""}`}>
                    <span className={`flex-1 truncate font-bold tracking-tight ${rapat ? "text-[13px]" : "text-[16px]"}`}>
                      {k.kapal.replace(/^KMP\.?\s*/i, "")}
                    </span>
                    <span className="flex w-[4.5rem] justify-end gap-1.5 text-[15px] font-black tabular-nums">
                      {k.lewat > 0 && <span className="text-rose-200">{k.lewat}</span>}
                      {k.kritis > 0 && <span className="text-orange-200">{k.kritis}</span>}
                      {k.waspada > 0 && <span className="text-amber-200">{k.waspada}</span>}
                      {!k.lewat && !k.kritis && !k.waspada && <span className="text-emerald-200">aman</span>}
                    </span>
                    <span className="flex h-2 w-20 overflow-hidden rounded-full bg-white/10">
                      {(["lewat", "kritis", "waspada", "aman"] as Tingkat[]).map((t) => (
                        k[t] > 0 && <span key={t} className={NADA[t].pita} style={{ width: `${(k[t] / Math.max(1, jumlah)) * 100}%` }} />
                      ))}
                    </span>
                    <span className="w-14 text-right text-[13px] tabular-nums text-white/70">
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
          <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/75">
            Di luar hitungan layar ini
          </span>
          <span className="text-[16px]">
            <b className="text-2xl font-black tabular-nums text-sky-200">{permanen.length}</b>
            <span className="ml-2 text-white/85">dokumen permanen — Surat Laut, Surat Ukur, Grosse Akte dan sejenisnya, tidak punya masa berlaku</span>
          </span>
          {tanpaTanggal.length > 0 && (
            <span className="text-[16px]">
              <b className="text-2xl font-black tabular-nums text-amber-200">{tanpaTanggal.length}</b>
              <span className="ml-2 text-white/85">dokumen belum bertanggal di lembar sumber — perlu dilengkapi</span>
            </span>
          )}
          <span className="ml-auto text-[13px] text-white/65">
            Layar menyegarkan sendiri tiap menit · daftar berganti tiap 10 detik · tombol ‹ › atau panah papan tik untuk memeriksa manual
          </span>
        </footer>
      </div>
    </div>
  );
}
