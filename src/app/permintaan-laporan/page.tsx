"use client";
/**
 * Permintaan & Laporan Kapal — sisi kantor.
 *
 * Menampilkan kiriman ABK dari halaman terbuka /lapor: siapa mengirim apa,
 * kapal mana, periode berapa, dan berkasnya (tersimpan di Google Drive, dibuka
 * lewat tautan). Ada matriks kelengkapan per kapal supaya kelihatan kapal mana
 * yang belum menyetor laporan bulan berjalan — itu yang dipakai untuk menimbang
 * kebutuhan kapal.
 */
import Link from "next/link";
import BacaPermintaan from "@/components/lapor/BacaPermintaan";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Ikon } from "@/components/ikon";
import { PratinjauBerkas } from "@/components/PratinjauBerkas";
import { PengingatGrup } from "@/components/lapor/PengingatGrup";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import {
  BerkasLapor, JENIS_LAPOR, KirimanLapor, STATUS_LAPOR, bulanIndo, labelJenis, singkatJenis,
  tautanWa, ukuranSingkat,
} from "@/lib/lapor/types";
import { konfirmasi } from "@/components/Konfirmasi";

const kelasStatus = (s: string) => STATUS_LAPOR.find((x) => x.id === s)?.kelas || "bg-slate-100 text-slate-700 ring-slate-200";
const labelStatus = (s: string) => STATUS_LAPOR.find((x) => x.id === s)?.label || s;
/**
 * Tanggal berapa sebuah kiriman mulai dicurigai milik bulan berikutnya.
 *
 * Laporan dan permintaan bulanan lazimnya naik sesudah bulannya lewat. Yang
 * masuk pada hari-hari terakhir bulan biasanya justru kebutuhan bulan DEPAN
 * yang dikirim lebih awal — permintaan barang untuk September disetor 27
 * Agustus supaya sempat diproses. Kalau periodenya dibiarkan ikut bulan kirim,
 * rekap Agustus tampak lengkap sementara September lahir kosong.
 *
 * Ambangnya tanggal 25: cukup dekat ke tutup bulan untuk jadi pola, cukup jauh
 * dari tengah bulan supaya kiriman biasa tidak ikut tertandai.
 */
const TANGGAL_UJUNG_BULAN = 25;

/**
 * Pecah nama berkas menjadi awalan yang berulang dan judul yang membedakan.
 *
 * Apps Script menamai tiap berkas "2026-08 - Laporan Mesin - KMP. PORTLINK VIII
 * - Catatan penggantian filter.jpg". Tiga bagian pertama sama persis untuk
 * seluruh berkas dalam satu kiriman — dan justru bagian itulah yang memenuhi
 * baris sampai judulnya, satu-satunya yang perlu dibaca, terpotong di ujung.
 *
 * Yang ditebalkan judulnya; awalannya tetap ditampilkan kecil dan pudar, sebab
 * ia dipakai mencocokkan berkas dengan isi folder Drive ketika ada yang hilang.
 */
function pecahNamaBerkas(nama: string): { awalan: string; judul: string } {
  const tanpaExt = nama.replace(/\.[a-z0-9]+$/i, "");
  // pemisahnya bisa "-" biasa atau "–" panjang, tergantung versi skripnya
  const bagian = tanpaExt.split(/\s+[-–]\s+/);
  if (bagian.length < 2) return { awalan: "", judul: tanpaExt };
  return { awalan: bagian.slice(0, -1).join(" – "), judul: bagian[bagian.length - 1] };
}

/**
 * Pasangan sebaris tiap golongan: Laporan Mesin ⇄ Permintaan Mesin.
 *
 * Bagiannya (Deck/Mesin) tidak pernah ikut berpindah — yang tertukar di layar
 * telepon ABK adalah baris atas dan baris bawah pada kotak unggah, bukan kolom
 * kiri dan kanannya.
 */
const pasanganJenis = (j: string) =>
  j.startsWith("laporan") ? j.replace("laporan", "permintaan") : j.replace("permintaan", "laporan");

const tanggalKirim = (b: KirimanLapor) => Number((b.dikirimPada || "").slice(8, 10)) || 0;

/**
 * Kiriman yang naik di ujung bulan DAN periodenya masih bulan itu juga.
 *
 * Yang periodenya sudah ditulis bulan berikutnya tidak ditandai: ABK-nya sudah
 * memilih dengan benar, dan peringatan yang muncul pada hal yang sudah beres
 * cepat diabaikan.
 */
/** batas hari "masih wajar" untuk laporan bulan lalu yang naik bulan ini */
const HARI_SUSULAN_WAJAR = 10;

/** jarak bulan antara dua "YYYY-MM"; positif berarti periode lebih tua */
const jarakBulan = (periode: string, bulanKirim: string) => {
  if (!/^\d{4}-\d{2}$/.test(periode) || !/^\d{4}-\d{2}$/.test(bulanKirim)) return 0;
  const [ya, ma] = periode.split("-").map(Number);
  const [yb, mb] = bulanKirim.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

/**
 * Bulan kirim berbeda dari periode yang diisi ABK.
 *
 * Periodenya tidak pernah diubah sendiri oleh aplikasi — hanya ABK yang tahu
 * bulan mana yang ia laporkan, dan menebak-nebak untuknya berarti rekap kantor
 * berdiri di atas karangan. Yang dilakukan di sini cuma menandai, dan menandai
 * dengan dua tingkat: selisih yang lazim tidak boleh tampil sama mendesaknya
 * dengan selisih yang mencurigakan, kalau tidak penandanya akan diabaikan
 * seluruhnya dalam sebulan.
 */
type RupaBeda = { tingkat: "wajar" | "periksa"; selisih: number; bulanKirim: string };

const bedaBulan = (b: KirimanLapor): RupaBeda | null => {
  const bulanKirim = (b.dikirimPada || "").slice(0, 7);
  if (!b.periode || !bulanKirim || bulanKirim === b.periode) return null;
  const selisih = jarakBulan(b.periode, bulanKirim);
  // laporan bulan lalu yang naik di awal bulan ini = alur normal
  const wajar = selisih === 1 && tanggalKirim(b) <= HARI_SUSULAN_WAJAR;
  return { tingkat: wajar ? "wajar" : "periksa", selisih, bulanKirim };
};

const kirimUjungBulan = (b: KirimanLapor) =>
  tanggalKirim(b) >= TANGGAL_UJUNG_BULAN && (b.dikirimPada || "").slice(0, 7) === b.periode;

/** geser satu periode YYYY-MM sebanyak n bulan */
const bulanKe = (periode: string, n: number) => {
  const [y, m] = (periode || "").split("-").map(Number);
  if (!y || !m) return "";
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const waktuSingkat = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function IsiPermintaanLaporanKapal() {
  const [baris, setBaris] = useState<KirimanLapor[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kapal, setKapal] = useState("");
  const [jenis, setJenis] = useState("");
  const [status, setStatus] = useState("");
  const [periode, setPeriode] = useState("");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<KirimanLapor | null>(null);
  /**
   * Slot matriks yang isinya lebih dari satu kiriman.
   *
   * Lencana "3 kiriman" dulu hanya membuka SATU — yang paling baru — dan dua
   * sisanya tak bisa dicapai dari situ sama sekali. Angkanya benar, tapi
   * kliknya berbohong. Sekarang slot berisi banyak kiriman membuka daftarnya.
   */
  const [slotPilih, setSlotPilih] = useState<{ kapal: string; jenis: string; isi: KirimanLapor[] } | null>(null);
  /**
   * Slot asal kiriman yang sedang dibuka.
   *
   * Satu slot kerap memuat beberapa kiriman — kapal mengirim ulang, atau
   * melengkapi berkas menyusul. Tanpa ingatan ini, memeriksa kiriman kedua
   * berarti menutup panel, mencari kembali kotaknya di matriks, dan membuka
   * daftarnya lagi dari nol: tiga langkah untuk berpindah satu baris.
   */
  const [asalSlot, setAsalSlot] = useState<{ kapal: string; jenis: string; isi: KirimanLapor[] } | null>(null);

  /** kiriman yang sedang dibaca isinya (foto/PDF borang -> daftar barang) */
  const [bacaKiriman, setBacaKiriman] = useState<any | null>(null);
  const [hapusBerkasId, setHapusBerkasId] = useState("");
  const [salin, setSalin] = useState("");
  /**
   * Kabar melayang untuk perubahan yang MEMANG terjadi.
   *
   * Dulu mengubah status ke "Selesai" tidak menghasilkan tanda apa pun: kotak
   * pilihan berganti tulisan, lalu senyap. Tidak ada yang menyatakan bahwa
   * perubahan itu sudah sampai ke basis data, dan bila gagal pun tampilannya
   * tetap memperlihatkan status baru — kantor merasa sudah menutup pekerjaan
   * yang sebenarnya masih terbuka.
   */
  const [kabar, setKabar] = useState<{ teks: string; nada: "sukses" | "gagal" | "kerja"; urung?: () => void } | null>(null);
  /** id kiriman yang statusnya sedang disimpan — mengunci tombol & menyalakan putaran */
  const [simpanId, setSimpanId] = useState("");
  /** id kiriman yang baru berubah — barisnya disorot sebentar supaya mata menemukannya */
  const [sorot, setSorot] = useState("");
  const [cariDrive, setCariDrive] = useState<{ sibuk: boolean; kandidat: any[]; pesan: string } | null>(null);
  /** pemulihan seluruh kiriman kosong satu periode sekaligus */
  const [pulih, setPulih] = useState<{ sibuk: boolean; hasil: any[] | null; pesan: string }>({ sibuk: false, hasil: null, pesan: "" });
  /** berkas Drive yang dicentang untuk ditautkan — bawaannya semua kandidat */
  const [pilihDrive, setPilihDrive] = useState<Set<string>>(new Set());
  const sp = useSearchParams();

  useEffect(() => {
    if (!kabar || kabar.nada === "kerja") return;
    const j = window.setTimeout(() => setKabar(null), kabar.urung ? 9000 : 4500);
    return () => window.clearTimeout(j);
  }, [kabar]);

  useEffect(() => {
    if (!sorot) return;
    const j = window.setTimeout(() => setSorot(""), 2600);
    return () => window.clearTimeout(j);
  }, [sorot]);

  const ambil = async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/lapor/daftar", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) setGalat(d.error || "Gagal memuat"); else setBaris(d.baris);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  };
  useEffect(() => { ambil(); }, []);

  const periodeAda = useMemo(
    () => Array.from(new Set(baris.map((b) => b.periode).filter(Boolean))).sort().reverse(),
    [baris]);

  /** saringan daftar: hanya kiriman yang naik di ujung bulan */
  const [hanyaUjung, setHanyaUjung] = useState(false);
  /** hanya kiriman yang bulan kirimnya berbeda dari periode borangnya */
  const [hanyaBeda, setHanyaBeda] = useState(false);
  /** fileId yang sedang digeser ke golongan lain — mengunci tombolnya */
  const [geserBerkasId, setGeserBerkasId] = useState("");
  /** berkas yang sedang dibuka di jendela pratinjau */
  /** penyusun pesan tagihan untuk grup WhatsApp kapal */
  const [pengingat, setPengingat] = useState(false);
  const [lihatBerkas, setLihatBerkas] = useState<{ fileId: string; nama: string; url: string; kapal: string } | null>(null);

  const tampil = useMemo(() => baris.filter((b) => {
    if (hanyaUjung && !kirimUjungBulan(b)) return false;
    if (hanyaBeda && !bedaBulan(b)) return false;
    if (kapal && b.kapal !== kapal) return false;
    if (jenis && b.jenis !== jenis) return false;
    if (status && b.status !== status) return false;
    if (periode && b.periode !== periode) return false;
    if (!cari) return true;
    const t = [b.kapal, b.pengirim, b.jabatan, b.catatan, labelJenis(b.jenis), ...b.berkas.map((x) => x.nama)].join(" ").toLowerCase();
    return cari.toLowerCase().split(/\s+/).filter(Boolean).every((k) => t.includes(k));
  }), [baris, hanyaBeda, hanyaUjung, kapal, jenis, status, periode, cari]);

  /**
   * Periode rekap punya state sendiri dan bawaannya BULAN BERJALAN. Sebelumnya
   * ia mengekor periode terbaru di data, sehingga satu ABK yang salah memilih
   * bulan membuat seluruh armada tampak belum menyetor.
   */
  const [periodeRekap, setPeriodeRekap] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const periodeMatriks = periodeRekap;

  /**
   * Rekap disusun menurut apa: PERIODE laporan atau BULAN KIRIM?
   *
   * Keduanya sah dan sering berbeda — laporan Agustus lazim naik pada hari
   * pertama September. Yang menagih kelengkapan bulanan memakai periode; yang
   * memantau kesibukan penerimaan memakai bulan kirim. Sebelumnya rekap hanya
   * mengenal periode, sehingga Agustus tampak lengkap walau berkasnya baru
   * masuk bulan berikutnya.
   */
  const [dasarRekap, setDasarRekap] = useState<"periode" | "kirim">("periode");
  const bulanKirim = (b: KirimanLapor) => (b.dikirimPada || "").slice(0, 7);
  const cocokBulan = useCallback(
    (b: KirimanLapor) => (dasarRekap === "kirim" ? bulanKirim(b) : b.periode) === periodeMatriks,
    [dasarRekap, periodeMatriks]);

  // Kelengkapan diukur dari BERKAS yang sampai, bukan dari adanya catatan
  // kiriman. Kiriman yang berkasnya gagal naik tidak boleh tampil hijau —
  // itu justru membuat kantor mengira dokumen sudah ada padahal Drive kosong.
  const matriks = useMemo(() => {
    const peta = new Map<string, KirimanLapor[]>();
    baris.filter((b) => cocokBulan(b) && b.berkas.length > 0).forEach((b) => {
      const k = `${b.kapal}|${b.jenis}`;
      peta.set(k, [...(peta.get(k) || []), b]);
    });
    return peta;
  }, [baris, cocokBulan]);

  /**
   * Kiriman yang catatannya ada tapi berkasnya tidak pernah sampai.
   *
   * Percobaan yang sudah DIGANTIKAN kiriman berikutnya tidak ikut dihitung:
   * satu laporan yang dicoba lima kali bukan lima laporan gagal, dan angka yang
   * dilebih-lebihkan membuat peringatan ini cepat diabaikan.
   */
  const gagalKirim = useMemo(
    () => baris.filter((b) => cocokBulan(b) && b.berkas.length === 0 && !b.digantikan),
    [baris, cocokBulan]);

  /**
   * Kiriman ujung bulan pada periode yang sedang direkap.
   *
   * Bukan kesalahan — kantor sendiri yang memutuskan ini punya bulan mana.
   * Yang dilakukan di sini cuma menaruhnya di depan mata, lengkap dengan jalan
   * memindahkannya, supaya keputusan itu diambil sadar dan bukan karena rekap
   * bulan depan mendadak kosong.
   */
  /**
   * Kiriman pada periode ini yang bulan kirimnya lain.
   *
   * Dihitung dari periode yang sedang direkap, bukan dari seluruh basis data:
   * yang ditanyakan kantor selalu "bulan ini ada yang perlu dicek tidak",
   * bukan berapa banyak yang pernah berbeda sepanjang tahun.
   */
  const bedaPeriode = useMemo(
    () => baris.filter((b) => cocokBulan(b) && !b.digantikan && bedaBulan(b)),
    [baris, cocokBulan]);
  const bedaPerluCek = bedaPeriode.filter((b) => bedaBulan(b)?.tingkat === "periksa");

  /**
   * Kiriman yang periodenya JAUH dari bulan kirimnya — "terparkir".
   *
   * Sengaja TIDAK memakai cocokBulan: justru inilah kiriman yang tidak berada
   * di bulan mana pun yang biasa dibuka kantor, jadi menyaringnya dengan bulan
   * yang sedang dilihat sama dengan tidak pernah memberitahu siapa pun.
   *
   * Ambangnya dua bulan. Selisih satu bulan adalah alur normal (laporan Agustus
   * naik awal September, permintaan September disetor akhir Agustus) dan sudah
   * ditangani penanda beda-bulan; yang dicari di sini kesalahan putar roda bulan
   * di layar ponsel — atau dokumen yang memang milik bulan jauh, seperti rencana
   * docking, yang tetap perlu diketahui kantor supaya tidak dikira hilang.
   */
  const terparkir = useMemo(() => baris.filter((b) => {
    if (b.digantikan || !b.berkas.length) return false;
    const bulanKirim = (b.dikirimPada || "").slice(0, 7);
    if (!b.periode || !bulanKirim) return false;
    const selisih = jarakBulan(b.periode, bulanKirim);
    return selisih <= -2 || selisih >= 3;
  }), [baris]);

  const ujungBulan = useMemo(
    () => baris.filter((b) => cocokBulan(b) && kirimUjungBulan(b) && !b.digantikan),
    [baris, cocokBulan]);

  /**
   * Simpan perubahan, lalu KATAKAN apa yang terjadi.
   *
   * Tampilan diubah lebih dulu supaya terasa seketika, tetapi bila server
   * menolak, keadaan lama dikembalikan dan kabarnya merah — status palsu yang
   * bertahan di layar jauh lebih berbahaya daripada jeda sesaat.
   */
  const ubah = async (id: string, patch: Partial<KirimanLapor>, opsi: { diam?: boolean; otomatis?: boolean } = {}) => {
    const sebelum = baris.find((x) => x.id === id);
    const gantiStatus = typeof patch.status === "string" && patch.status !== sebelum?.status;

    // perubahan tampil dulu (tanpa menunggu jaringan kapal-lambat)
    if (sebelum) {
      const ramalan = { ...sebelum, ...patch, statusPada: gantiStatus ? new Date().toISOString() : sebelum.statusPada };
      setBaris((l) => l.map((x) => (x.id === id ? ramalan : x)));
      setBuka((x) => (x && x.id === id ? ramalan : x));
    }
    if (gantiStatus) {
      setSimpanId(id);
      setKabar({ teks: `Menyimpan status ${labelStatus(patch.status as string)}…`, nada: "kerja" });
    }

    let d: any;
    try {
      const r = await fetch("/api/lapor/daftar", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      d = await r.json();
    } catch (e: any) {
      // Tanpa ini, catatan tindak lanjut hilang diam-diam saat jaringan putus.
      if (sebelum) {
        setBaris((l) => l.map((x) => (x.id === id ? sebelum : x)));
        setBuka((x) => (x && x.id === id ? sebelum : x));
      }
      setSimpanId("");
      setGalat(e?.message || "Perubahan gagal disimpan. Periksa koneksi lalu ulangi.");
      setKabar({ teks: "Perubahan TIDAK tersimpan — koneksi terputus.", nada: "gagal" });
      return;
    }
    setSimpanId("");
    if (!d.ok) {
      if (sebelum) {
        setBaris((l) => l.map((x) => (x.id === id ? sebelum : x)));
        setBuka((x) => (x && x.id === id ? sebelum : x));
      }
      setGalat(d.error || "Gagal menyimpan");
      setKabar({ teks: d.error || "Perubahan TIDAK tersimpan.", nada: "gagal" });
      return;
    }
    setBaris((l) => l.map((x) => (x.id === id ? d.baris : x)));
    setBuka((x) => (x && x.id === id ? d.baris : x));
    window.dispatchEvent(new Event("pengingat:muat-ulang"));

    if (!opsi.diam) {
      setSorot(id);
      const nama = `${d.baris.kapal} · ${singkatJenis(d.baris.jenis)}`;
      setKabar(gantiStatus
        ? {
          teks: opsi.otomatis
            // penandaan yang dilakukan aplikasi sendiri: cukup diberitahukan,
            // tak perlu ditawari pembatalan seperti keputusan yang diambil orang
            ? `${nama} otomatis ditandai DIBACA`
            : `${nama} ditandai ${labelStatus(d.baris.status).toUpperCase()} ✓`,
          nada: "sukses",
          // Salah pencet pada daftar sepanjang ini wajar; membatalkannya harus
          // semudah membuatnya, dan tanpa mencari-cari kirimannya lagi.
          urung: !opsi.otomatis && sebelum && sebelum.status !== d.baris.status
            ? () => { void ubah(id, { status: sebelum.status }, { diam: true }); setKabar({ teks: `Dikembalikan ke ${labelStatus(sebelum.status)}`, nada: "sukses" }); }
            : undefined,
        }
        : { teks: `Tindak lanjut ${nama} tersimpan ✓`, nada: "sukses" });
    }
  };

  const bukaKiriman = (b: KirimanLapor, dariSlot = false) => {
    setBuka(b);
    // dibuka dari matriks atau daftar biasa → tidak ada slot untuk kembali
    if (!dariSlot) setAsalSlot(null);
    setCariDrive(null);          // hasil pencarian kiriman sebelumnya tak boleh ikut terbawa
    // Membuka kiriman menandainya "dibaca" — perubahan yang terjadi tanpa
    // diminta pun harus terlihat, kalau tidak angka "kiriman baru" berkurang
    // sendiri dan tampak seperti kekeliruan aplikasi.
    if (b.status === "baru") void ubah(b.id, { status: "dibaca" }, { otomatis: true });
  };

  // Klik notifikasi lonceng membawa pengguna langsung ke kiriman yang tepat.
  // Alamatnya dibaca lewat useSearchParams supaya tetap bekerja ketika petugas
  // SUDAH berada di halaman ini — window.location tidak memicu efek apa pun
  // saat Next hanya mengganti query tanpa memuat ulang halaman.
  useEffect(() => {
    const id = sp.get("buka");
    if (!id) return;
    const ditemukan = baris.find((b) => b.id === id);
    if (!ditemukan) return;
    window.history.replaceState({}, "", window.location.pathname);
    bukaKiriman(ditemukan);
    // URL dibersihkan sebelum status diperbarui, sehingga efek tidak berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baris, sp]);

  /**
   * Pindahkan kiriman ke periode lain.
   *
   * Yang dipindahkan hanya PENEMPATANNYA di rekap; berkas di Google Drive
   * tidak ikut berganti nama, dan tanggal kirimnya tidak pernah diubah — itu
   * jejak yang tidak boleh dikarang ulang. Perpindahannya sendiri dicatat,
   * karena rekap bulanan inilah yang dipakai menagih kapal.
   */
  const pindahPeriode = async (b: KirimanLapor, ke: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ke) || ke === b.periode) return;
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "📅", judul: "Pindahkan kiriman ke periode lain?",
      pesan: `${singkatJenis(b.jenis)} · ${b.kapal}`,
      rincian: [
        `Dari ${bulanIndo(b.periode)} menjadi ${bulanIndo(ke)}.`,
        "Rekap kelengkapan kedua bulan itu ikut berubah.",
        "Berkas di Google Drive tetap dengan namanya yang lama.",
      ],
      tombolYa: `Pindahkan ke ${bulanIndo(ke)}`,
    }))) return;
    await ubah(b.id, { periode: ke } as Partial<KirimanLapor>);
  };

  /**
   * Pindahkan kiriman ke golongan borang lain.
   *
   * Empat kotak unggah di halaman ABK berjajar mirip di layar telepon, dan
   * permintaan barang paling sering tersangkut di slot Laporan Deck atau
   * Laporan Mesin. Selama tidak ada jalan memindahkannya, kantor cuma punya dua
   * pilihan yang sama-sama buruk: menagih ulang kapal untuk berkas yang
   * sebenarnya sudah ada, atau membiarkan rekap kelengkapan salah di dua kotak
   * sekaligus — satu tampak kosong, satu tampak terisi oleh dokumen yang keliru.
   *
   * Berkasnya sendiri tetap di folder Drive semula; yang berpindah hanya
   * penggolongannya di rekap kantor.
   */
  const pindahJenis = async (b: KirimanLapor, ke: string) => {
    if (ke === b.jenis || !JENIS_LAPOR.some((j) => j.id === ke)) return;
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "🔀", judul: "Pindahkan ke golongan borang lain?",
      pesan: `${b.kapal} · ${bulanIndo(b.periode)}`,
      rincian: [
        `Dari ${singkatJenis(b.jenis)} menjadi ${singkatJenis(ke)}.`,
        "Rekap kelengkapan kedua kotak itu ikut berubah.",
        "Berkas di Google Drive tetap di folder lamanya.",
      ],
      tombolYa: `Pindahkan ke ${singkatJenis(ke)}`,
    }))) return;
    await ubah(b.id, { jenis: ke } as Partial<KirimanLapor>);
  };

  const hapus = async (b: KirimanLapor) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗂️", judul: "Hapus catatan kiriman?",
      pesan: `${singkatJenis(b.jenis)} · ${b.kapal} · ${bulanIndo(b.periode)}`,
      rincian: ["Catatan kiriman akan dihapus dari rekap kantor.", "Berkas di Google Drive tidak ikut terhapus."],
      tombolYa: "Hapus catatan",
    }))) return;
    let d: any;
    try {
      const r = await fetch(`/api/lapor/daftar?id=${b.id}`, { method: "DELETE" });
      d = await r.json();
    } catch (e: any) {
      setGalat(e?.message || "Kiriman gagal dihapus. Periksa koneksi lalu ulangi.");
      return;
    }
    if (!d.ok) { setGalat(d.error || "Gagal menghapus"); return; }
    setBaris((l) => l.filter((x) => x.id !== b.id));
    setBuka(null);
  };

  /**
   * Cari berkas kiriman ini di Google Drive.
   *
   * Unggahan yang jawabannya hilang di jalan meninggalkan berkas UTUH di Drive
   * tanpa catatan pada kirimannya — kantor membaca "tidak membawa berkas" dan
   * menyuruh kapal mengirim ulang sesuatu yang sudah ada. Tombol ini membuka
   * folder kapal/jenis yang bersangkutan dan menawarkan berkas sekitar waktu
   * kiriman itu untuk ditautkan.
   */
  const cariDiDrive = async (b: KirimanLapor) => {
    setCariDrive({ sibuk: true, kandidat: [], pesan: "" });
    try {
      const r = await fetch("/api/lapor/daftar/cocok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id }),
      });
      const d = await r.json();
      if (!d.ok) { setCariDrive({ sibuk: false, kandidat: [], pesan: d.error || "Gagal membaca Drive" }); return; }
      setCariDrive({
        sibuk: false, kandidat: d.kandidat || [],
        pesan: (d.kandidat || []).length ? "" : "Tidak ada berkas yang cocok di folder Drive kapal ini.",
      });
      // dicentang semua lebih dulu: yang lazim memang semuanya milik kiriman ini
      setPilihDrive(new Set((d.kandidat || []).map((f: any) => f.id)));
    } catch (e: any) {
      setCariDrive({ sibuk: false, kandidat: [], pesan: e?.message || "Gagal membaca Drive" });
    }
  };

  /**
   * Pulihkan SEMUA kiriman kosong periode ini dari Google Drive.
   *
   * Kiriman kosong datang berombongan: satu kapal yang jaringannya putus
   * mencoba lima kali, dan kelimanya menunjuk berkas yang sudah utuh di Drive.
   * Merapikannya satu per satu berarti dua puluh klik untuk pekerjaan yang
   * isinya sama — dan yang paling sering terjadi bukan salah tautan, melainkan
   * tidak dikerjakan sama sekali, lalu kapal ditagih ulang untuk berkas yang
   * sebenarnya sudah ada.
   *
   * Dua langkah, tidak langsung menulis: intip dulu apa yang ketemu, baru
   * ditautkan setelah kantor melihat daftarnya. Menautkan berkas ke kiriman
   * yang salah menciptakan kelengkapan palsu — kesalahan yang jauh lebih sulit
   * ditemukan daripada kiriman kosong yang jujur.
   */
  const pulihkanSemua = async (tautkan: boolean) => {
    setPulih({ sibuk: true, hasil: tautkan ? pulih.hasil : null, pesan: "" });
    try {
      const r = await fetch("/api/lapor/daftar/cocok/massal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode: periodeMatriks, ...(tautkan ? { aksi: "tautkan" } : {}) }),
      });
      const d = await r.json();
      if (!d.ok) { setPulih({ sibuk: false, hasil: null, pesan: d.error || "Gagal membaca Drive" }); return; }
      if (tautkan) {
        await ambil();
        setPulih({
          sibuk: false, hasil: d.hasil || null,
          pesan: d.ditautkan
            ? `${d.ditautkan} berkas ditautkan ke ${(d.hasil || []).filter((h: any) => h.ketemu).length} kiriman ✓`
            : "Tidak ada berkas yang bisa ditautkan.",
        });
        if (d.ditautkan) setKabar({ teks: `${d.ditautkan} berkas dipulihkan dari Drive ✓`, nada: "sukses" });
      } else {
        const ketemu = (d.hasil || []).filter((h: any) => h.ketemu).length;
        setPulih({
          sibuk: false, hasil: d.hasil || [],
          pesan: ketemu
            ? `${ketemu} dari ${d.diperiksa} kiriman kosong ternyata berkasnya ada di Drive.`
            : `Tidak ada berkas yang cocok di Drive untuk ${d.diperiksa} kiriman kosong ini — unggahannya memang tak pernah sampai.`,
        });
      }
    } catch (e: any) {
      setPulih({ sibuk: false, hasil: null, pesan: e?.message || "Gagal menghubungi Drive" });
    }
  };

  const tautkanDrive = async (b: KirimanLapor, fileIds: string[]) => {
    setCariDrive((s) => (s ? { ...s, sibuk: true } : s));
    try {
      const r = await fetch("/api/lapor/daftar/cocok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, aksi: "tautkan", fileIds }),
      });
      const d = await r.json();
      if (!d.ok) { setCariDrive({ sibuk: false, kandidat: [], pesan: d.error || "Gagal menautkan" }); return; }
      setBaris((l) => l.map((x) => (x.id === b.id ? { ...x, berkas: d.berkas } : x)));
      setBuka((x) => (x?.id === b.id ? { ...x, berkas: d.berkas } : x));
      setCariDrive(null);
      setPilihDrive(new Set());
      setSorot(b.id);
      setKabar({ teks: `${d.ditautkan} berkas dari Drive ditautkan ke kiriman ini ✓`, nada: "sukses" });
    } catch (e: any) {
      setCariDrive({ sibuk: false, kandidat: [], pesan: e?.message || "Gagal menautkan" });
    }
  };

  /**
   * Geser SATU berkas ke golongan borang lain.
   *
   * Satu kiriman Laporan Mesin biasanya memuat lima lembar, dan yang salah
   * kotak cuma satu di antaranya. Memindahkan seluruh kirimannya menukar satu
   * kesalahan dengan empat: lembar laporan yang benar ikut hilang dari kotaknya.
   *
   * Berkas Drive tidak ikut berpindah folder. Yang berpindah catatannya, ke
   * kiriman bergolongan tujuan pada kapal dan periode yang sama — dibuatkan
   * bila belum ada, disatukan bila sudah.
   */
  const geserBerkas = async (b: KirimanLapor, f: BerkasLapor, ke: string) => {
    if (!JENIS_LAPOR.some((j) => j.id === ke) || ke === b.jenis) return;
    const sendirian = b.berkas.length === 1;
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "🔀", judul: `Geser berkas ini ke ${singkatJenis(ke)}?`,
      pesan: f.nama,
      rincian: [
        `${b.kapal} · ${bulanIndo(b.periode)} · dari ${singkatJenis(b.jenis)}.`,
        "Berkas di Google Drive tetap di folder lamanya; yang berpindah catatannya.",
        sendirian
          ? "Ini satu-satunya berkas di kiriman itu, jadi catatan kirimannya ikut dirapikan."
          : `${b.berkas.length - 1} berkas lain tetap di ${singkatJenis(b.jenis)}.`,
      ],
      tombolYa: `Geser ke ${singkatJenis(ke)}`,
    }))) return;

    setGeserBerkasId(f.fileId);
    setGalat("");
    try {
      const r = await fetch("/api/lapor/daftar/berkas/pindah", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, fileId: f.fileId, keJenis: ke }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Berkas gagal dipindahkan");
      // rekap kedua kotak berubah sekaligus — dimuat ulang, bukan ditebak
      await ambil();
      setBuka(null);
      setKabar({ teks: `${f.nama} dipindahkan ke ${singkatJenis(ke)} ✓`, nada: "sukses" });
    } catch (e: any) {
      setGalat(e?.message || "Berkas gagal dipindahkan. Periksa koneksi lalu ulangi.");
    } finally { setGeserBerkasId(""); }
  };

  const hapusDokumen = async (b: KirimanLapor, f: BerkasLapor) => {
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗑️", judul: "Hapus dokumen dari Google Drive?",
      pesan: f.nama,
      rincian: [
        `${singkatJenis(b.jenis)} · ${b.kapal} · ${bulanIndo(b.periode)}`,
        `Ukuran dokumen ${ukuranSingkat(f.ukuran)}.`,
      ],
      tegasan: "Dokumen akan dipindahkan ke Sampah Google Drive dan dihapus dari rekap ini.",
      tombolYa: "Hapus dokumen",
    }))) return;

    setHapusBerkasId(f.fileId);
    setGalat("");
    try {
      const r = await fetch("/api/lapor/daftar/berkas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, fileId: f.fileId }),
      });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || "Gagal menghapus dokumen"); return; }
      setBaris((l) => l.map((x) => (x.id === b.id ? { ...x, berkas: d.berkas } : x)));
      setBuka((x) => (x?.id === b.id ? { ...x, berkas: d.berkas } : x));
    } catch (e: any) {
      setGalat(e?.message || "Gagal menghapus dokumen");
    } finally {
      setHapusBerkasId("");
    }
  };

  const tautanLapor = typeof window !== "undefined" ? `${window.location.origin}/lapor` : "/lapor";
  const salinTautan = async () => {
    try { await navigator.clipboard.writeText(tautanLapor); setSalin("Tautan disalin"); }
    catch { setSalin(tautanLapor); }
    setTimeout(() => setSalin(""), 4000);
  };

  const ringkas = useMemo(() => {
    // percobaan ulang yang kosong bukan kiriman tersendiri — lihat gagalKirim
    const kiriman = baris.filter((b) => cocokBulan(b) && !b.digantikan);
    let kapalMengirim = 0;
    let kapalLengkap = 0;
    let slotTerisi = 0;
    for (const k of KAPAL_ANGGARAN) {
      const isi = JENIS_LAPOR.filter((j) => matriks.get(`${k}|${j.id}`)?.length).length;
      if (isi > 0) kapalMengirim++;
      if (isi === JENIS_LAPOR.length) kapalLengkap++;
      slotTerisi += isi;
    }
    const totalSlot = KAPAL_ANGGARAN.length * JENIS_LAPOR.length;
    return {
      kiriman: kiriman.length,
      kapalMengirim,
      kapalLengkap,
      slotTerisi,
      totalSlot,
      persen: totalSlot ? Math.round((slotTerisi / totalSlot) * 100) : 0,
      berkas: kiriman.reduce((s, b) => s + b.berkas.length, 0),
    };
  }, [baris, matriks, cocokBulan]);
  /*
   * Kelengkapan tiap kapal dalam bentuk nama dokumen, bukan angka.
   *
   * Matriks di layar cukup memakai jumlah karena kolomnya sudah kelihatan.
   * Pesan ke grup tidak punya kolom: "2/4" tidak memberi tahu ABK dokumen mana
   * yang harus mereka kirim, jadi yang dibawa ke sana nama dokumennya.
   */
  const kelengkapanKapal = useMemo(() => KAPAL_ANGGARAN.map((k) => {
    const ada: string[] = [];
    const kurang: string[] = [];
    JENIS_LAPOR.forEach((j) => {
      (matriks.get(`${k}|${j.id}`)?.length ? ada : kurang).push(j.singkat);
    });
    return { kapal: k, ada, kurang };
  }), [matriks]);

  const jumlahBaru = baris.filter((b) => b.status === "baru").length;

  const saringanAktif = !!(cari || kapal || jenis || status || periode || hanyaUjung || hanyaBeda);
  const bersihkanSaringan = () => { setCari(""); setKapal(""); setJenis(""); setStatus(""); setPeriode(""); setHanyaUjung(false); setHanyaBeda(false); };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="asdp-gradient mb-5 rounded-[1.75rem] p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow flex flex-wrap items-center gap-4 rounded-[calc(1.75rem-1.5px)] px-5 py-5 sm:px-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-800 text-2xl text-white shadow-lg shadow-sky-900/20">📨</div>
          <div className="min-w-[16rem] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-sky-800 ring-1 ring-sky-200">Pusat Laporan Armada</span>
              <span className="text-[10px] font-medium text-slate-400">Google Drive tersinkron</span>
              {jumlahBaru > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 ring-1 ring-rose-200">● {jumlahBaru} KIRIMAN BARU</span>}
            </div>
            <h1 className="text-2xl font-extrabold asdp-text-gradient leading-tight">Permintaan &amp; Laporan Kapal</h1>
            <p className="mt-0.5 text-sm text-slate-500">Pantau kelengkapan kiriman ABK, tindak lanjut, dan berkas kapal dalam satu rekap.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={salinTautan} className="btn bg-slate-900 text-xs text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
              🔗 Salin tautan ABK
            </button>
            <Link href="/permintaan-laporan/isi" className="btn btn-ghost text-xs">🧾 Isi permintaan (terbaca)</Link>
            <Link href="/lapor" target="_blank" className="btn btn-ghost text-xs">👁 Halaman kirim</Link>
            {/* borang permintaan digital yang masih diuji — sengaja lewat tautan
                sendiri, tidak menggantikan halaman kirim yang dipakai armada */}
            <Link href="/uji-permintaan" target="_blank" className="btn btn-ghost text-xs">🧪 Borang permintaan (uji)</Link>
            <button onClick={ambil} disabled={muat} className="btn btn-primary text-xs disabled:opacity-50">
              {muat ? "Memuat…" : "⟳ Muat ulang"}
            </button>
          </div>
        </div>
      </header>
      {salin && <div className="anim-in mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {salin}</div>}
      {galat && <div className="anim-in mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}
      {jumlahBaru > 0 && (
        <button onClick={() => { setStatus("baru"); window.setTimeout(() => document.getElementById("daftar-kiriman")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} className="anim-in mb-4 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-950/35">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-lg text-white shadow-sm">
            📨<span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-extrabold text-white ring-2 ring-emerald-50">{jumlahBaru}</span>
          </span>
          <span className="flex-1">
            <span className="block text-xs font-extrabold text-emerald-900 dark:text-emerald-200">Ada {jumlahBaru} kiriman kapal baru</span>
            <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">Buka kiriman untuk menandainya sudah dibaca dan menindaklanjuti berkas.</span>
          </span>
          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">LIHAT SEKARANG →</span>
        </button>
      )}

      {/* ── matriks kelengkapan ───────────────────────────────────────────── */}
      <section className="mb-5 overflow-hidden rounded-3xl bg-white elev-md ring-line anim-in dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50/70 px-4 py-4 sm:px-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#16357f] text-sm text-white shadow-sm">✓</span>
                <div>
                  <h2 className="font-extrabold text-slate-900">Rekap Kelengkapan Armada</h2>
                  <p className="text-[11px] text-slate-500">Empat dokumen wajib untuk setiap kapal dan periode laporan.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/*
                Dua bulan yang sering berbeda: laporan Agustus biasanya naik
                pada awal September. Yang menagih kelengkapan memakai periode
                laporan; yang memantau kesibukan penerimaan memakai bulan kirim.
              */}
              <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-200 shadow-sm dark:ring-slate-700">
                {([["periode", "Periode laporan"], ["kirim", "Bulan kirim"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setDasarRekap(id)}
                    title={id === "periode"
                      ? "Kiriman dihitung pada bulan yang DILAPORKAN, apa pun tanggal kirimnya"
                      : "Kiriman dihitung pada bulan berkasnya MASUK, apa pun periodenya"}
                    className={`px-3 py-2 text-[11px] font-bold transition ${
                      dasarRekap === id ? "bg-[#16357f] text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/*
                Menagih laporan ke grup kapal adalah pekerjaan yang berangkat
                dari layar ini juga — tombolnya ditaruh di sebelah rekapnya,
                bukan di halaman lain, supaya yang dibaca dan yang dikirim
                berasal dari angka yang sama.
              */}
              <button type="button" onClick={() => setPengingat(true)}
                title="Susun pesan tagihan untuk grup WhatsApp kapal, dari rekap periode ini"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700">
                <Ikon nama="kotakMasuk" className="h-3.5 w-3.5" /> Pengingat grup
              </button>

            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-700">
              <span className="text-slate-400">Periode</span>
              <select value={periodeMatriks} onChange={(e) => setPeriodeRekap(e.target.value)} className="bg-transparent font-bold text-[#16357f] outline-none dark:text-sky-300">
                {(periodeAda.includes(periodeMatriks) ? periodeAda : [periodeMatriks, ...periodeAda])
                  .map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
              </select>
            </label>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {dasarRekap === "periode"
              ? "Dihitung menurut bulan yang dilaporkan ABK. Laporan Agustus yang baru naik 1 September tetap masuk Agustus."
              : "Dihitung menurut bulan berkasnya masuk. Laporan Agustus yang naik 1 September dihitung di September."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiRekap ikon="🚢" label="Kapal Mengirim" nilai={`${ringkas.kapalMengirim}/${KAPAL_ANGGARAN.length}`} ket={`${ringkas.kapalLengkap} kapal lengkap`} warna="sky" />
            <KpiRekap ikon="✓" label="Dokumen Diterima" nilai={`${ringkas.slotTerisi}/${ringkas.totalSlot}`} ket={`${ringkas.persen}% kelengkapan`} warna="emerald" />
            <KpiRekap ikon="📨" label="Kiriman Masuk" nilai={String(ringkas.kiriman)} ket={bulanIndo(periodeMatriks)} warna="indigo" />
            <KpiRekap ikon="📎" label="Berkas Drive" nilai={String(ringkas.berkas)} ket="lampiran tersimpan" warna="amber" />
          </div>

          {gagalKirim.length > 0 && (
        <div className="anim-in mb-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-lg text-white">⚠</span>
            <span className="min-w-[16rem] flex-1">
              <span className="block text-xs font-extrabold text-amber-900 dark:text-amber-200">
                {gagalKirim.length} kiriman {bulanIndo(periodeMatriks)} tidak membawa berkas
              </span>
              <span className="block text-[10px] text-amber-800 dark:text-amber-300">
                Unggahan ABK putus di tengah jalan. Kiriman ini TIDAK dihitung sebagai dokumen diterima.
                Berkas yang terlanjur naik sering masih utuh di Drive walau catatannya tak pernah sampai —
                tekan tombol di samping untuk memeriksa seluruhnya sekaligus.
                {gagalKirim[0]?.galatUnggah ? ` Sebab terakhir: ${gagalKirim[0].galatUnggah}` : ""}
              </span>
            </span>
            {/*
              Memeriksa dulu, bukan langsung menautkan. Berkas yang menempel ke
              kiriman yang salah menciptakan kelengkapan palsu — kekeliruan yang
              jauh lebih sulit ditemukan daripada kiriman kosong yang jujur.
            */}
            <button type="button" onClick={() => void pulihkanSemua(false)} disabled={pulih.sibuk}
              className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
              {pulih.sibuk ? "Memeriksa Drive…" : "🔎 Periksa semua di Drive"}
            </button>
            <button type="button"
              onClick={() => { setStatus(""); setPeriode(periodeMatriks); setCari(""); setKapal(""); setJenis(""); window.setTimeout(() => document.getElementById("daftar-kiriman")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}
              className="shrink-0 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300 transition hover:bg-amber-100">
              Lihat daftarnya →
            </button>
          </div>

          {(pulih.pesan || pulih.hasil) && (
            <div className="mt-3 rounded-xl bg-white/80 p-3 ring-1 ring-amber-200 dark:bg-slate-900/60">
              {pulih.pesan && <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">{pulih.pesan}</p>}
              {!!pulih.hasil?.length && (
                <ul className="mt-2 space-y-1">
                  {pulih.hasil.map((h: any) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{h.kapal}</span>
                      <span className="text-slate-500">{singkatJenis(h.jenis)}</span>
                      {h.galat ? (
                        <span className="font-semibold text-rose-700">gagal: {h.galat}</span>
                      ) : h.ketemu ? (
                        <span className="font-semibold text-emerald-700">
                          {h.ketemu} berkas ketemu{(h.berkas || []).length ? ` — ${h.berkas.map((f: any) => f.nama).join(", ")}` : ""}
                          {h.kembar ? <span className="ml-1 font-normal text-slate-500">({h.kembar} salinan kembar diabaikan)</span> : null}
                        </span>
                      ) : (
                        <span className="text-slate-500">tidak ada di Drive — perlu ditagih ulang</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!!pulih.hasil?.some((h: any) => h.ketemu) && (
                <button type="button" onClick={() => void pulihkanSemua(true)} disabled={pulih.sibuk}
                  className="mt-2 rounded-xl bg-[#16357f] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#12296a] disabled:opacity-50">
                  {pulih.sibuk ? "Menautkan…" : `Tautkan ${pulih.hasil.reduce((s: number, h: any) => s + (h.ketemu || 0), 0)} berkas ke kirimannya`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/*
        Kiriman ujung bulan diberi spanduknya sendiri, terpisah dari spanduk
        berkas gagal: yang satu kerusakan, yang ini keputusan. Menggabungkan
        keduanya membuat kantor memperlakukan keduanya sebagai masalah.
      */}
      {!!ujungBulan.length && (
        <button
          onClick={() => { setHanyaUjung(true); window.setTimeout(() => document.getElementById("daftar-kiriman")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}
          className="anim-in mb-4 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/95 px-4 py-3 text-left shadow-sm transition hover:border-violet-300 dark:border-violet-900 dark:bg-violet-950/30">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500 text-lg text-white">🕘</span>
          <span className="flex-1">
            <span className="block text-xs font-extrabold text-violet-900 dark:text-violet-200">
              {ujungBulan.length} kiriman naik setelah tanggal {TANGGAL_UJUNG_BULAN} {bulanIndo(periodeMatriks)}
            </span>
            <span className="block text-[10px] text-violet-800 dark:text-violet-300">
              Kiriman ujung bulan biasanya kebutuhan {bulanIndo(bulanKe(periodeMatriks, 1))} yang disetor lebih awal,
              tetapi periodenya masih tertulis {bulanIndo(periodeMatriks)}. Periksa isinya — bila memang untuk bulan
              depan, buka kirimannya dan pindahkan periodenya; bila memang untuk bulan ini, biarkan.
            </span>
          </span>
          <span className="text-[10px] font-extrabold text-violet-800 dark:text-violet-300">PERIKSA →</span>
        </button>
      )}

      {/*
        Spanduk ini berdiri di luar periode yang sedang direkap — satu-satunya
        di halaman ini yang begitu. Kiriman terparkir memang tidak berada di
        bulan mana pun yang biasa dibuka, jadi kalau ia ikut disaring bulan, ia
        tidak akan pernah diumumkan di layar mana pun.
      */}
      {!!terparkir.length && (
        <div className="anim-in mb-4 rounded-2xl border border-sky-300 bg-sky-50/95 px-4 py-3 shadow-sm dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-600 text-lg text-white">🗓</span>
            <span className="min-w-[16rem] flex-1">
              <span className="block text-xs font-extrabold text-sky-900 dark:text-sky-200">
                {terparkir.length} kiriman terparkir di periode yang jauh — tidak tampil di rekap bulan mana pun
              </span>
              <span className="block text-[10px] text-sky-800 dark:text-sky-300">
                Berkasnya sampai dengan selamat, tetapi periodenya diisi dua bulan atau lebih dari bulan kirimnya,
                jadi kotaknya hanya muncul kalau pemilih periode diputar ke sana. Bisa disengaja (rencana docking,
                misalnya) — bisa juga salah putar roda bulan di ponsel. Periksa, lalu biarkan atau pindahkan periodenya.
              </span>
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {terparkir.slice(0, 6).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] dark:bg-slate-900/60">
                <span className="font-bold text-slate-800 dark:text-slate-100">{b.kapal}</span>
                <span className="text-slate-500">{singkatJenis(b.jenis)}</span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                  periode {bulanIndo(b.periode)}
                </span>
                <span className="text-slate-500">dikirim {bulanIndo((b.dikirimPada || "").slice(0, 7))}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => setPeriodeRekap(b.periode)}
                    className="rounded-lg bg-white px-2 py-1 text-[10.5px] font-bold text-sky-800 ring-1 ring-sky-300 transition hover:bg-sky-100">
                    Buka {bulanIndo(b.periode)}
                  </button>
                  <button type="button" onClick={() => bukaKiriman(b)}
                    className="rounded-lg bg-[#16357f] px-2 py-1 text-[10.5px] font-bold text-white transition hover:bg-[#12296a]">
                    Periksa
                  </button>
                </span>
              </li>
            ))}
            {terparkir.length > 6 && (
              <li className="px-2.5 text-[10.5px] text-sky-800">…dan {terparkir.length - 6} lagi.</li>
            )}
          </ul>
        </div>
      )}

      {/*
        Spanduk terpisah dari "ujung bulan": yang itu soal kiriman yang MUNGKIN
        untuk bulan depan, yang ini soal borang yang bulannya mungkin salah
        pilih. Dua pertanyaan berbeda, dan menggabungkannya membuat keduanya
        tidak terjawab.
      */}
      {!!bedaPeriode.length && (
        <button
          onClick={() => { setHanyaBeda(true); window.setTimeout(() => document.getElementById("daftar-kiriman")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}
          className={`anim-in mb-4 flex w-full flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
            bedaPerluCek.length
              ? "border-amber-300 bg-amber-50/95 hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/30"
              : "border-indigo-200 bg-indigo-50/95 hover:border-indigo-300 dark:border-indigo-900 dark:bg-indigo-950/30"}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg text-white ${
            bedaPerluCek.length ? "bg-amber-500" : "bg-indigo-500"}`}>📅</span>
          <span className="flex-1">
            <span className={`block text-xs font-extrabold ${bedaPerluCek.length ? "text-amber-900 dark:text-amber-200" : "text-indigo-900 dark:text-indigo-200"}`}>
              {bedaPeriode.length} kiriman {bulanIndo(periodeMatriks)} yang bulan kirimnya berbeda
              {bedaPerluCek.length > 0 && ` — ${bedaPerluCek.length} perlu dicek`}
            </span>
            <span className={`block text-[10px] ${bedaPerluCek.length ? "text-amber-800 dark:text-amber-300" : "text-indigo-800 dark:text-indigo-300"}`}>
              Borangnya diisi {bulanIndo(periodeMatriks)}, tetapi berkasnya naik di bulan lain. Periodenya tetap
              dipakai apa adanya — hanya ABK yang tahu bulan mana yang dilaporkan. Yang ditandai kuning selisihnya
              di luar kebiasaan: periksa isinya, bila bulannya memang salah pilih, pindahkan periodenya dari dalam
              kirimannya.
            </span>
          </span>
          <span className={`text-[10px] font-extrabold ${bedaPerluCek.length ? "text-amber-800 dark:text-amber-300" : "text-indigo-800 dark:text-indigo-300"}`}>PERIKSA →</span>
        </button>
      )}

      <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300/60 dark:bg-slate-700 dark:ring-slate-600">
              <div className="h-full rounded-full bg-gradient-to-r from-[#14b8c4] via-[#1ca3dd] to-[#16357f] transition-all duration-500" style={{ width: `${ringkas.persen}%` }} />
            </div>
            <span className="min-w-[5.5rem] text-right text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{ringkas.slotTerisi} dari {ringkas.totalSlot} slot</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/90 text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="sticky left-0 z-10 min-w-[12rem] border-b border-slate-200 bg-slate-100 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800">Kapal</th>
                <th className="w-28 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-700">Progres</th>
                {JENIS_LAPOR.map((j) => <th key={j.id} className="min-w-[11rem] border-b border-slate-200 px-3 py-3 text-center dark:border-slate-700"><span className="mr-1">{j.ikon}</span>{j.singkat}</th>)}
              </tr>
            </thead>
            <tbody>
              {KAPAL_ANGGARAN.map((k, index) => {
                // kiriman kapal ini yang terparkir di periode lain — supaya tidak
                // perlu curiga lebih dulu untuk menemukannya
                const parkirKapal = terparkir.filter((b) => b.kapal === k);
                const jumlahIsi = JENIS_LAPOR.filter((j) => matriks.get(`${k}|${j.id}`)?.length).length;
                const lengkap = jumlahIsi === JENIS_LAPOR.length;
                return (
                  <tr key={k} className="group hover:bg-sky-50/60 dark:hover:bg-sky-950/25">
                    <td className={`sticky left-0 z-[5] border-b border-slate-100 px-4 py-2.5 font-bold text-slate-800 group-hover:bg-sky-50 dark:border-slate-800 dark:text-slate-100 dark:group-hover:bg-sky-950 ${index % 2 ? "bg-slate-50/95 dark:bg-slate-900" : "bg-white dark:bg-slate-900"}`}>
                      <span className="mr-2 text-[10px] font-medium tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>{k}
                      {/* kiriman kapal ini yang duduk di bulan lain — tanpa penanda ini,
                          kotak yang kosong di layar tampak seperti kapal yang belum kirim */}
                      {parkirKapal.length > 0 && (
                        <button type="button" onClick={() => setPeriodeRekap(parkirKapal[0].periode)}
                          title={parkirKapal.map((b) => `${singkatJenis(b.jenis)} · periode ${bulanIndo(b.periode)}`).join(" · ")}
                          className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 transition hover:bg-sky-200 dark:bg-sky-900/60 dark:text-sky-200">
                          +{parkirKapal.length} di {bulanIndo(parkirKapal[0].periode).split(" ")[0]}
                        </button>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className={`h-full rounded-full ${lengkap ? "bg-emerald-500" : jumlahIsi ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`} style={{ width: `${(jumlahIsi / JENIS_LAPOR.length) * 100}%` }} />
                        </div>
                        <span className={`w-7 text-right text-[10px] font-extrabold tabular-nums ${lengkap ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500"}`}>{jumlahIsi}/4</span>
                      </div>
                    </td>
                    {JENIS_LAPOR.map((j) => {
                      const isi = matriks.get(`${k}|${j.id}`) || [];
                      const adaBaru = isi.some((x) => x.status === "baru");
                      // slot yang isinya naik di ujung bulan diberi jam kecil:
                      // rekap dibaca per kolom, dan kantor harus tahu slot mana
                      // yang hijaunya masih perlu ditimbang
                      const adaUjung = isi.some(kirimUjungBulan);
                      // borang yang bulannya mungkin salah pilih: kuning bila
                      // selisihnya di luar kebiasaan, biru bila masih lazim
                      const beda = isi.map(bedaBulan).filter(Boolean) as ReturnType<typeof bedaBulan>[];
                      const bedaCek = beda.some((x) => x?.tingkat === "periksa");
                      const utama = isi.find((x) => x.status === "baru") || isi[0];
                      return (
                        <td key={j.id} className="border-b border-slate-100 px-3 py-2 text-center dark:border-slate-800">
                          {isi.length ? (
                          <span className="relative inline-flex items-center gap-1">
                            <button onClick={() => (isi.length > 1
                              ? setSlotPilih({ kapal: k, jenis: j.singkat, isi })
                              : bukaKiriman(utama))}
                              className={`relative inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold ring-1 transition hover:-translate-y-0.5 hover:shadow-sm ${adaBaru ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-800" : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800"}`}>
                              <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] text-white ${adaBaru ? "bg-rose-500" : "bg-emerald-500"}`}>{adaBaru ? "!" : "✓"}</span>
                              {adaBaru ? "Baru" : isi.length > 1 ? `${isi.length} kiriman` : "Diterima"}
                              {adaBaru && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />}
                              {beda.length > 0 && (
                                <span title={beda.map((x) => `Periode ${bulanIndo(periodeMatriks)}, berkas naik ${bulanIndo(x!.bulanKirim)}`).join(" · ")
                                  + (bedaCek ? " — selisihnya di luar kebiasaan, periksa bulannya" : "")}
                                  className={`absolute -right-1.5 -bottom-1.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900 ${
                                    bedaCek ? "bg-amber-500" : "bg-indigo-500"}`}>
                                  ≠
                                </span>
                              )}
                              {adaUjung && (
                                <span title={`Naik setelah tanggal ${TANGGAL_UJUNG_BULAN} — periksa apakah ini untuk ${bulanIndo(bulanKe(periodeMatriks, 1))}`}
                                  className="absolute -left-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-violet-500 text-[8px] text-white ring-2 ring-white dark:ring-slate-900">
                                  🕘
                                </span>
                              )}
                            </button>
                            {/*
                              Pindah cepat, langsung dari kotaknya.
                              Permintaan barang yang tertempel di slot Laporan
                              adalah kekeliruan yang paling sering terjadi, dan
                              membetulkannya lewat panel rincian menuntut tiga
                              klik untuk satu perubahan yang sudah pasti.
                              Kotak berisi lebih dari satu kiriman tidak diberi
                              tombol ini: yang mana yang dimaksud harus dilihat
                              dulu, bukan ditebak.
                            */}
                            {j.id.startsWith("laporan") && isi.length === 1 && (
                              <button type="button"
                                onClick={(ev) => { ev.stopPropagation(); void pindahJenis(utama, j.id.replace("laporan", "permintaan")); }}
                                title={`Sebenarnya permintaan barang? Pindahkan ke ${singkatJenis(j.id.replace("laporan", "permintaan"))}`}
                                className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold text-slate-400 ring-1 ring-slate-200 transition hover:bg-[#16357f] hover:text-white hover:ring-[#16357f] dark:ring-slate-700">
                                ⇄
                              </button>
                            )}
                          </span>
                          ) : (
                            <span className="inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" /> Belum
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 px-4 py-3 text-[10px] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <span>
            <b className="text-slate-700 dark:text-slate-200">Diterima</b> dapat diklik untuk membuka kirimannya; slot berisi lebih dari satu kiriman menampilkan daftarnya dulu.
            Tombol <b className="text-slate-700 dark:text-slate-200">⇄</b> pada kotak Laporan memindahkannya ke golongan Permintaan — untuk berkas permintaan barang yang tertempel di slot laporan.
          </span>
          <span className={`rounded-full px-2 py-0.5 font-bold ring-1 ${ringkas.kapalLengkap === KAPAL_ANGGARAN.length ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
            {KAPAL_ANGGARAN.length - ringkas.kapalLengkap} kapal belum lengkap
          </span>
        </div>
      </section>

      {/* ── saringan ──────────────────────────────────────────────────────── */}
      <section id="daftar-kiriman" className="mb-4 scroll-mt-4 rounded-2xl bg-white p-3 elev-sm ring-line dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Daftar Kiriman</h2>
            <p className="text-[10px] text-slate-500">Telusuri kiriman, berkas, status, dan tindak lanjut ABK.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-800">{tampil.length} dari {baris.length} kiriman</span>
            {hanyaBeda && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800">
                📅 hanya beda bulan kirim
              </span>
            )}
            {hanyaUjung && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800">
                🕘 hanya kiriman ujung bulan
              </span>
            )}
            {saringanAktif && <button onClick={bersihkanSaringan} className="text-[10px] font-bold text-slate-500 hover:text-rose-600">✕ Reset filter</button>}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
          <label className="relative lg:col-span-4">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">⌕</span>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, catatan, atau berkas…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700" />
          </label>
          <select value={kapal} onChange={(e) => setKapal(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua kapal</option>
            {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua jenis</option>
            {JENIS_LAPOR.map((j) => <option key={j.id} value={j.id}>{j.singkat}</option>)}
          </select>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua bulan</option>
            {periodeAda.map((p) => <option key={p} value={p}>{bulanIndo(p)}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm lg:col-span-2 dark:border-slate-700">
            <option value="">Semua status</option>
            {STATUS_LAPOR.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </section>

      {/* ── daftar kiriman ────────────────────────────────────────────────── */}
      {muat ? (
        <div className="grid gap-2" aria-label="Memuat daftar kiriman">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/75 ring-1 ring-slate-200 dark:bg-slate-900/75 dark:ring-slate-800" />)}
        </div>
      ) : !tampil.length ? (
        <div className="rounded-3xl bg-white p-10 text-center elev-sm ring-line dark:bg-slate-900">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-xl dark:bg-slate-800">📭</div>
          <p className="mt-3 font-bold text-slate-700">Belum ada kiriman{baris.length ? " yang cocok" : ""}</p>
          <p className="mt-1 text-xs text-slate-500">
            {baris.length ? "Ubah atau reset filter untuk melihat data lainnya." : "Bagikan tautan pengiriman kepada ABK kapal untuk mulai menerima laporan."}
          </p>
          {saringanAktif && <button onClick={bersihkanSaringan} className="btn btn-ghost mt-3 text-xs">Reset filter</button>}
        </div>
      ) : (
        <div className="grid gap-2.5 stagger">
          {tampil.map((b) => {
            const metaJenis = JENIS_LAPOR.find((j) => j.id === b.jenis);
            return (
              <article key={b.id} className={`group relative overflow-hidden rounded-2xl bg-white p-4 elev-sm ring-line transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 ${
                sorot === b.id ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/10" : ""}`}>
                <span className={`absolute inset-y-0 left-0 w-1 ${b.status === "selesai" ? "bg-emerald-500" : b.status === "baru" ? "bg-rose-500" : b.status === "ditindaklanjuti" ? "bg-amber-500" : "bg-slate-300"}`} />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">{metaJenis?.ikon || "📄"}</div>
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-900">{b.kapal}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">{singkatJenis(b.jenis)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${kelasStatus(b.status)}`}>{labelStatus(b.status)}</span>
                      {/* kapan status itu diputuskan — tanpa ini perubahan tak meninggalkan bekas apa pun */}
                      {b.statusPada && <span className="text-[10px] text-slate-400">diubah {waktuSingkat(b.statusPada)}</span>}
                      {simpanId === b.id && <span className="text-[10px] font-bold text-sky-600">menyimpan…</span>}
                      {b.digantikan && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">percobaan lama</span>}
                      {/* bulan kirim di luar periodenya — lazim, tapi harus terbaca supaya
                          rekap bulanan tidak dikira salah hitung */}
                      {bedaBulan(b) && (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${
                          bedaBulan(b)!.tingkat === "periksa"
                            ? "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"
                            : "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800"}`}
                          title={`Borang diisi periode ${bulanIndo(b.periode)}, berkasnya naik ${bulanIndo(bedaBulan(b)!.bulanKirim)}`
                            + (bedaBulan(b)!.tingkat === "periksa" ? " — selisihnya di luar kebiasaan, periksa bulannya" : " — laporan bulan lalu yang naik di awal bulan, lazim")}>
                          {bedaBulan(b)!.tingkat === "periksa" ? "⚠ periksa bulan" : "dikirim"} {bulanIndo(bedaBulan(b)!.bulanKirim)}
                        </span>
                      )}
                      {/* ujung bulan: lencananya menyebut bulan yang mungkin
                          dimaksud, karena itulah pertanyaan yang harus dijawab */}
                      {kirimUjungBulan(b) && (
                        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800"
                          title={`Naik tanggal ${tanggalKirim(b)} ${bulanIndo(b.periode)} — kiriman ujung bulan lazimnya untuk bulan berikutnya`}>
                          🕘 ujung bulan · mungkin {bulanIndo(bulanKe(b.periode, 1))}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">📅 {bulanIndo(b.periode)}</span>
                      <span>👤 {b.pengirim}{b.jabatan ? ` · ${b.jabatan}` : ""}</span>
                      <span>🕘 {waktuSingkat(b.dikirimPada)}</span>
                    </div>
                    {b.catatan && <p className="mt-1.5 line-clamp-1 text-xs text-slate-500">{b.catatan}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1 ${
                      b.berkas.length
                        ? "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                        : "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"}`}>
                      {b.berkas.length ? `📎 ${b.berkas.length} berkas` : "⚠ belum ada berkas"}
                    </span>
                    <button onClick={() => bukaKiriman(b)} className="btn btn-primary text-xs">Buka detail →</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── panel detail ──────────────────────────────────────────────────── */}
      {buka && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setBuka(null)}>
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 p-5">
              {/*
                Jalan kembali. Kiriman yang dibuka dari satu slot berisi banyak
                kiriman selalu punya saudara yang juga perlu diperiksa; tanpa
                tombol ini, berpindah satu baris berarti menutup panel, mencari
                kotaknya lagi di matriks, lalu membuka daftarnya dari nol.
              */}
              {asalSlot && asalSlot.isi.length > 1 && (() => {
                const urut = [...asalSlot.isi].sort((a, b) => (b.dikirimPada || "").localeCompare(a.dikirimPada || ""));
                const ke = urut.findIndex((x) => x.id === buka.id);
                const lompat = (arah: number) => {
                  const n = urut[(ke + arah + urut.length) % urut.length];
                  if (n) bukaKiriman(n, true);
                };
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button type="button"
                      onClick={() => { const s = asalSlot; setBuka(null); setAsalSlot(null); setSlotPilih(s); }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                      ← Kembali ke {asalSlot.isi.length} kiriman slot ini
                    </button>
                    <span className="ml-auto flex items-center gap-1.5">
                      <button type="button" onClick={() => lompat(-1)} title="Kiriman sebelumnya di slot ini"
                        className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-bold text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100">‹</button>
                      <span className="text-[11px] font-bold tabular-nums text-slate-500">
                        {ke >= 0 ? ke + 1 : "–"}/{urut.length}
                      </span>
                      <button type="button" onClick={() => lompat(1)} title="Kiriman berikutnya di slot ini"
                        className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-bold text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100">›</button>
                    </span>
                  </div>
                );
              })()}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{labelJenis(buka.jenis)}</h3>
                  <p className="text-sm text-slate-600">{buka.kapal} · {bulanIndo(buka.periode)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* jalan keluar yang tidak menutup layar begitu saja: kembali ke
                      daftar kiriman di halaman, tempat berkas kapal lain berjajar */}
                  <button type="button"
                    onClick={() => { setBuka(null); setAsalSlot(null); window.setTimeout(() => document.getElementById("daftar-kiriman")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}
                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                    ← Daftar kiriman
                  </button>
                  <button onClick={() => { setBuka(null); setAsalSlot(null); }} title="Tutup"
                    className="text-xl leading-none text-slate-400 transition hover:text-slate-700">✕</button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Pengirim</span><div className="font-semibold">{buka.pengirim || "—"}{buka.jabatan ? ` · ${buka.jabatan}` : ""}</div></div>
                <div>
                  <span className="text-slate-500">Dikirim</span>
                  <div className="font-semibold">{waktuSingkat(buka.dikirimPada)}</div>
                  {bedaBulan(buka) && (
                    <div className={`mt-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ring-1 ${
                      bedaBulan(buka)!.tingkat === "periksa"
                        ? "bg-amber-50 text-amber-900 ring-amber-300"
                        : "bg-indigo-50 text-indigo-800 ring-indigo-200"}`}>
                      Borang diisi periode <b>{bulanIndo(buka.periode)}</b>, berkasnya naik{" "}
                      <b>{bulanIndo(bedaBulan(buka)!.bulanKirim)}</b>
                      {bedaBulan(buka)!.tingkat === "periksa"
                        ? " — selisihnya di luar kebiasaan. Periksa isinya; bila bulannya salah pilih, pindahkan periodenya di bawah."
                        : " — laporan bulan lalu yang naik di awal bulan, lazim."}
                    </div>
                  )}
                </div>
                {/*
                  Periode boleh digeser kantor. Kekeliruan bulan paling sering
                  terjadi pada hari-hari pertama bulan baru, dan tanpa kotak ini
                  satu-satunya jalan membetulkannya adalah menyuruh kapal
                  mengirim ulang seluruh berkasnya.
                */}
                <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500">Periode laporan</span>
                    <span className="text-[11px] text-slate-400">
                      dikirim {bulanIndo((buka.dikirimPada || "").slice(0, 7))}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input type="month" value={buka.periode}
                      onChange={(e) => pindahPeriode(buka, e.target.value)}
                      className="rounded-lg bg-white px-2 py-1.5 text-sm ring-1 ring-slate-300" />
                    {Array.from(new Set([
                      bulanKe(buka.periode, -1),
                      (buka.dikirimPada || "").slice(0, 7),
                      bulanKe(buka.periode, 1),
                    ])).filter((x) => /^\d{4}-\d{2}$/.test(x) && x !== buka.periode).map((x) => (
                      <button key={x} type="button" onClick={() => pindahPeriode(buka, x)}
                        className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100">
                        → {bulanIndo(x)}
                      </button>
                    ))}
                  </div>
                  {kirimUjungBulan(buka) && (
                    <p className="mt-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[11px] leading-relaxed text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800">
                      Naik tanggal {tanggalKirim(buka)} — kiriman ujung bulan lazimnya kebutuhan{" "}
                      <b>{bulanIndo(bulanKe(buka.periode, 1))}</b> yang disetor lebih awal. Periksa isinya lebih dulu;
                      bila benar untuk bulan depan, tekan tombol <b>→ {bulanIndo(bulanKe(buka.periode, 1))}</b> di atas.
                    </p>
                  )}
                  {!!buka.riwayatPeriode?.length && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Dipindahkan: {buka.riwayatPeriode.slice(-3).map((j) =>
                        `${bulanIndo(j.dari)} → ${bulanIndo(j.ke)} (${waktuSingkat(j.pada)})`).join(" · ")}
                    </p>
                  )}
                </div>
                {/*
                  Golongan borang boleh dibetulkan kantor. Yang paling sering
                  terjadi: permintaan barang ditempel di slot Laporan.
                */}
                <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500">Golongan borang</span>
                    <span className="text-[11px] font-bold text-slate-600">{singkatJenis(buka.jenis)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {JENIS_LAPOR.filter((j) => j.id !== buka.jenis).map((j) => {
                      // pasangan sebaris (Laporan Deck → Permintaan Deck) ditonjolkan:
                      // itulah perpindahan yang sembilan dari sepuluh kali dimaksud
                      const sebaris = j.bagian === (JENIS_LAPOR.find((x) => x.id === buka.jenis)?.bagian)
                        && j.id.split("_")[0] !== buka.jenis.split("_")[0];
                      return (
                        <button key={j.id} type="button" onClick={() => pindahJenis(buka, j.id)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                            sebaris
                              ? "bg-[#16357f] text-white hover:bg-[#12296a]"
                              : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"}`}>
                          → {j.singkat}
                        </button>
                      );
                    })}
                  </div>
                  {buka.jenis.startsWith("laporan") && (
                    <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] leading-relaxed text-sky-800 ring-1 ring-sky-200">
                      Kalau isi berkas ini sebenarnya <b>permintaan barang</b>, pindahkan ke{" "}
                      <b>{singkatJenis(buka.jenis.replace("laporan", "permintaan"))}</b> — sesudah dipindahkan
                      ia ikut terbaca di halaman Isi Permintaan dan bisa diberangkatkan ke SPPBJ.
                    </p>
                  )}
                  {!!buka.riwayatJenis?.length && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Dipindahkan: {buka.riwayatJenis.slice(-3).map((j) =>
                        `${singkatJenis(j.dari)} → ${singkatJenis(j.ke)} (${waktuSingkat(j.pada)})`).join(" · ")}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-slate-500">Kontak</span>
                  <div className="font-semibold">
                    {buka.kontak ? (
                      <a className="text-green-700 hover:underline" target="_blank" rel="noopener noreferrer"
                         href={`https://wa.me/${buka.kontak.replace(/\D/g, "").replace(/^0/, "62")}`}>{buka.kontak} 💬</a>
                    ) : "—"}
                  </div>
                </div>
                {/*
                  Status dipilih dengan tombol, bukan kotak pilihan.
                  Kotak pilihan menyembunyikan pilihan yang sedang berlaku di
                  balik satu baris teks kecil dan tidak menyisakan tanda apa pun
                  setelah ditekan; di sini pilihan yang berlaku menyala penuh
                  warna, dan yang sedang disimpan berputar di tempatnya.
                */}
                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500">Status kiriman</span>
                    <span className="text-[11px] text-slate-400">
                      {simpanId === buka.id ? "menyimpan…"
                        : buka.statusPada ? `terakhir diubah ${waktuSingkat(buka.statusPada)}` : "belum pernah diubah"}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {STATUS_LAPOR.map((s) => {
                      const aktif = buka.status === s.id;
                      return (
                        <button key={s.id} type="button"
                          disabled={simpanId === buka.id}
                          onClick={() => !aktif && ubah(buka.id, { status: s.id })}
                          className={`rounded-xl px-2 py-2 text-xs font-extrabold ring-1 transition disabled:opacity-60 ${
                            aktif
                              ? s.id === "selesai" ? "bg-emerald-600 text-white ring-emerald-700 shadow"
                                : s.id === "ditindaklanjuti" ? "bg-amber-500 text-white ring-amber-600 shadow"
                                  : s.id === "baru" ? "bg-rose-600 text-white ring-rose-700 shadow"
                                    : "bg-slate-700 text-white ring-slate-800 shadow"
                              : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}>
                          {aktif && <span className="mr-1">✓</span>}{s.label}
                        </button>
                      );
                    })}
                  </div>
                  {!!buka.riwayatStatus?.length && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Jejak: {buka.riwayatStatus.slice(-4).map((j) => `${labelStatus(j.status)} (${waktuSingkat(j.pada)})`).join(" → ")}
                    </p>
                  )}
                </div>
              </div>

              {buka.catatan && (
                <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Catatan pengirim</div>
                  <p className="whitespace-pre-wrap">{buka.catatan}</p>
                </div>
              )}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Berkas di Google Drive</div>
                  {buka.berkas.length > 0 && (
                    <button type="button" onClick={() => setBacaKiriman(buka)}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700">
                      🔍 Baca isi permintaan
                    </button>
                  )}
                </div>
                {!buka.berkas.length ? (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900">
                    <b>Belum ada berkas yang sampai.</b> Unggahan ABK terputus sebelum selesai.
                    {buka.galatUnggah && <span className="mt-1 block text-xs">Sebab terakhir: {buka.galatUnggah}</span>}
                    <span className="mt-1 block text-xs">
                      Berkasnya bisa saja sudah ada di Drive tanpa sempat tercatat. Periksa dulu sebelum
                      meminta kapal mengirim ulang.
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => cariDiDrive(buka)} disabled={cariDrive?.sibuk}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60">
                        {cariDrive?.sibuk ? "Mencari di Drive…" : "🔎 Cari berkasnya di Drive"}
                      </button>
                      {buka.kontak && (
                        <a target="_blank" rel="noopener noreferrer"
                           href={`https://wa.me/${buka.kontak.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(`Halo ${buka.pengirim}, ${labelJenis(buka.jenis)} ${buka.kapal} periode ${bulanIndo(buka.periode)} belum membawa berkas. Mohon dikirim ulang lewat tautan Lapor Kapal.`)}`}
                           className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">
                          💬 Tagih ke pengirim
                        </a>
                      )}
                    </div>
                    {cariDrive && !cariDrive.sibuk && (
                      <div className="mt-2 rounded-lg bg-white/80 p-2 ring-1 ring-amber-200">
                        {cariDrive.pesan && <p className="text-xs text-amber-800">{cariDrive.pesan}</p>}
                        {!!cariDrive.kandidat.length && (
                          <>
                            <p className="text-xs font-bold text-slate-700">
                              {cariDrive.kandidat.length} berkas di folder kapal ini sekitar waktu kiriman:
                            </p>
                            <ul className="mt-1 space-y-1">
                              {cariDrive.kandidat.map((f: any) => (
                                <li key={f.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs ring-1 ring-slate-200">
                                  {/* tiap berkas dicentang sendiri: folder kapal bisa memuat berkas
                                      milik kiriman lain pada bulan yang sama */}
                                  <input type="checkbox" checked={pilihDrive.has(f.id)}
                                    onChange={(e) => setPilihDrive((s) => {
                                      const b2 = new Set(s);
                                      if (e.target.checked) b2.add(f.id); else b2.delete(f.id);
                                      return b2;
                                    })}
                                    className="h-3.5 w-3.5 shrink-0 accent-emerald-600" />
                                  <span className="min-w-0 flex-1 truncate">{f.nama}</span>
                                  <span className="shrink-0 text-slate-400">{ukuranSingkat(f.ukuran || 0)}</span>
                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-sky-700 hover:underline">lihat</a>
                                </li>
                              ))}
                            </ul>
                            <button type="button" disabled={!pilihDrive.size}
                              onClick={() => tautkanDrive(buka, cariDrive.kandidat.map((f: any) => f.id).filter((x: string) => pilihDrive.has(x)))}
                              className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300">
                              ➜ Tautkan {pilihDrive.size} berkas ke kiriman ini
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {buka.berkas.map((f) => (
                      <li key={f.fileId} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                        {/*
                          Nama berkas ditampilkan UTUH, dipatah ke baris
                          berikutnya bila panjang. Sebelumnya ia dipotong di
                          tengah, dan yang hilang justru ekornya — satu-satunya
                          bagian yang membedakan satu lembar dari lembar lain,
                          karena awalannya sama untuk seluruh berkas kiriman.
                        */}
                        <span className="min-w-[14rem] flex-1 leading-snug" title={f.nama}>
                          <span className="block break-words text-[14.5px] font-extrabold text-slate-900 dark:text-white">{pecahNamaBerkas(f.nama).judul}</span>
                          {pecahNamaBerkas(f.nama).awalan && (
                            <span className="block break-words text-[11.5px] font-medium text-slate-500">{pecahNamaBerkas(f.nama).awalan}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-600">{ukuranSingkat(f.ukuran)}</span>
                        {/* dibuka di dalam aplikasi; "Buka" tetap ada untuk yang ingin berkas aslinya di Drive */}
                        <button type="button"
                          onClick={() => setLihatBerkas({ fileId: f.fileId, nama: f.nama, url: f.url, kapal: buka.kapal })}
                          className="shrink-0 rounded-lg bg-[#16357f] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#12296a]">
                          Lihat
                        </button>
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                           className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50">Buka</a>
                        {/*
                          Satu kiriman kerap memuat lembar yang salah kotak —
                          paling sering permintaan barang yang ikut terunggah di
                          slot laporan. Yang digeser lembarnya sendiri, bukan
                          seluruh kirimannya, supaya lembar lain yang sudah benar
                          tidak ikut hilang dari kotaknya.
                        */}
                        <button type="button"
                          onClick={() => geserBerkas(buka, f, pasanganJenis(buka.jenis))}
                          disabled={Boolean(geserBerkasId)}
                          title={`Berkas ini sebenarnya ${singkatJenis(pasanganJenis(buka.jenis))}? Geser ke sana`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-[#16357f] ring-1 ring-[#16357f]/30 transition hover:bg-[#16357f] hover:text-white disabled:cursor-wait disabled:opacity-50">
                          {geserBerkasId === f.fileId ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-[#16357f]" aria-hidden="true" />
                          ) : "⇄"}
                          {geserBerkasId === f.fileId ? "Memindahkan…" : `Ke ${singkatJenis(pasanganJenis(buka.jenis)).split(" ")[0]}`}
                        </button>
                        <button type="button" onClick={() => hapusDokumen(buka, f)}
                          disabled={Boolean(hapusBerkasId)}
                          aria-label={`Hapus dokumen ${f.nama}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 hover:ring-rose-300 disabled:cursor-wait disabled:opacity-50">
                          {hapusBerkasId === f.fileId ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" aria-hidden="true" />
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {hapusBerkasId === f.fileId ? "Menghapus…" : "Hapus"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tindak lanjut (internal)</label>
                <textarea defaultValue={buka.tindakLanjut} rows={3}
                  onBlur={(e) => e.target.value !== buka.tindakLanjut && ubah(buka.id, { tindakLanjut: e.target.value })}
                  placeholder="Mis. sudah dibuatkan SPPBJ / menunggu anggaran / ditolak karena …"
                  className="mt-1 w-full rounded-xl ring-1 ring-slate-300 px-3 py-2 text-sm" />
                <p className="text-xs text-slate-400 mt-1">Tersimpan otomatis saat kotak ini ditinggalkan.</p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* tautanWa() menuju nomor KANTOR — untuk membalas pengirim, yang
                    dipakai harus nomornya sendiri. Kalau tidak ada, tombolnya
                    tidak ditampilkan daripada menelepon diri sendiri. */}
                {buka.kontak && (
                  <a href={`https://wa.me/${buka.kontak.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(`Halo ${buka.pengirim}, ${labelJenis(buka.jenis)} ${buka.kapal} periode ${bulanIndo(buka.periode)} sudah kami terima.`)}`}
                     target="_blank" rel="noopener noreferrer"
                     className="rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2.5">💬 Balas ke pengirim</a>
                )}
                <button onClick={() => hapus(buka)}
                  className="rounded-xl bg-white ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50 text-sm font-bold px-4 py-2.5">
                  Hapus catatan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {slotPilih && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSlotPilih(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-3 dark:border-slate-700">
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-white">{slotPilih.isi.length} kiriman pada slot ini</h3>
                <p className="text-[11px] text-slate-500">{slotPilih.kapal} · {slotPilih.jenis} · periode {periodeMatriks}</p>
              </div>
              <button onClick={() => setSlotPilih(null)} className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
              {[...slotPilih.isi].sort((a, b) => (b.dikirimPada || "").localeCompare(a.dikirimPada || "")).map((x) => (
                <li key={x.id}>
                  <button onClick={() => { const s = slotPilih; setSlotPilih(null); setAsalSlot(s); bukaKiriman(x, true); }}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-sky-50 dark:hover:bg-sky-950/30">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${x.status === "baru" ? "bg-rose-500" : "bg-emerald-500"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {x.pengirim || "(tanpa nama pengirim)"}{x.jabatan ? ` · ${x.jabatan}` : ""}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {x.dikirimPada ? new Date(x.dikirimPada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        {" · "}{x.berkas.length} berkas
                        {x.catatan ? ` · ${x.catatan.slice(0, 40)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-bold uppercase text-slate-400">{x.status}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t bg-slate-50 px-5 py-2.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
              Beberapa kiriman pada satu slot biasanya berarti kapal mengirim ulang atau melengkapi berkas menyusul.
            </p>
          </div>
        </div>
      )}
      {/* kabar melayang — bukti bahwa perubahan benar-benar tersimpan */}
      {kabar && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
          <div className={`anim-in flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-2xl ring-1 ${
            kabar.nada === "sukses" ? "bg-emerald-600 text-white ring-emerald-700"
              : kabar.nada === "gagal" ? "bg-rose-600 text-white ring-rose-700"
                : "bg-slate-900 text-white ring-slate-800"}`}>
            <span className="text-base">{kabar.nada === "sukses" ? "✓" : kabar.nada === "gagal" ? "⚠" : "⏳"}</span>
            <span>{kabar.teks}</span>
            {kabar.urung && (
              <button onClick={() => kabar.urung?.()}
                className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide hover:bg-white/25">
                Urungkan
              </button>
            )}
            <button onClick={() => setKabar(null)} aria-label="Tutup kabar" className="text-white/70 hover:text-white">✕</button>
          </div>
        </div>
      )}
      {bacaKiriman && (
        <BacaPermintaan
          buka={!!bacaKiriman}
          tutup={() => setBacaKiriman(null)}
          kapal={bacaKiriman.kapal}
          jenis={labelJenis(bacaKiriman.jenis)}
          berkas={(bacaKiriman.berkas || []).map((f: any) => ({ fileId: f.fileId, nama: f.nama }))}
          kiriman={{ id: bacaKiriman.id, kapal: bacaKiriman.kapal, jenis: bacaKiriman.jenis, periode: bacaKiriman.periode }}
        />
      )}
      {pengingat && (
        <PengingatGrup
          periodeLabel={bulanIndo(periodeMatriks)}
          daftar={kelengkapanKapal}
          kolom={JENIS_LAPOR.map((j) => j.singkat)}
          totalDokumen={ringkas.totalSlot}
          tautanLapor={tautanLapor}
          catatanDasar={dasarRekap === "periode"
            ? "Dihitung menurut bulan yang dilaporkan ABK."
            : "Dihitung menurut bulan berkasnya masuk."}
          tutup={() => setPengingat(false)}
        />
      )}

      {lihatBerkas && (
        <PratinjauBerkas
          fileId={lihatBerkas.fileId}
          nama={lihatBerkas.nama}
          keterangan={lihatBerkas.kapal}
          tautanAsli={lihatBerkas.url}
          tutup={() => setLihatBerkas(null)}
        />
      )}
    </main>
  );
}

function KpiRekap({ ikon, label, nilai, ket, warna }: {
  ikon: string; label: string; nilai: string; ket: string; warna: "sky" | "emerald" | "indigo" | "amber";
}) {
  const tema = {
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  }[warna];
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/85 px-3 py-2.5 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800/80 dark:ring-slate-700">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${tema}`}>{ikon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.11em] text-slate-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <strong className="text-lg font-extrabold leading-none tabular-nums text-slate-900">{nilai}</strong>
          <span className="truncate text-[9px] text-slate-400">{ket}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * useSearchParams menuntut batas Suspense saat halaman dirender di server.
 */
export default function PermintaanLaporanKapal() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-10 text-slate-500">Memuat…</main>}>
      <IsiPermintaanLaporanKapal />
    </Suspense>
  );
}
