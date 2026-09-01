"use client";
/**
 * Sidebar aplikasi.
 *
 * Menunya disusun sebagai DATA, bukan sebagai deretan JSX. Waktu daftarnya
 * masih ditulis satu per satu, tiap menu baru ditempel di kelompok mana pun
 * yang kebetulan paling dekat — "Data Kapal" akhirnya memuat docking,
 * pengadaan, kiriman ABK, sertifikat, dan sensor sekaligus, dan tidak ada satu
 * pun tempat yang jelas untuk menu berikutnya.
 *
 * Kelompoknya sekarang mengikuti urutan kerja teknik cabang: uang dulu
 * (anggaran & rencana), lalu docking, lalu kapalnya, lalu apa yang dikirim
 * kapal, lalu pengadaannya, lalu alat bantu, terakhir pengaman data.
 */
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Ikon } from "./ikon";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-white/70 hover:bg-white/[0.07] hover:text-white transition">
      <Ikon nama={dark ? "matahari" : "bulan"} className="h-[18px] w-[18px]" />
      {dark ? "Mode Terang" : "Mode Gelap"}
    </button>
  );
}

interface Anak { href: string; label: string; icon: string; tepat?: boolean }
interface Menu {
  href: string;
  icon: string;
  label: string;
  desc: string;
  /** halaman anak; menu bersarang terbuka sendiri saat induknya aktif */
  sub?: Anak[];
  /** aktif hanya bila alamatnya persis (menu yang punya halaman anak sederajat) */
  tepat?: boolean;
  /** pengecualian: alamat lain yang TIDAK boleh menyalakan menu ini */
  bukan?: string[];
}
interface Kelompok { judul: string; menu: Menu[] }

const KELOMPOK: Kelompok[] = [
  {
    judul: "Anggaran & Rencana",
    menu: [
      { href: "/dashboard", icon: "grafik", label: "Dashboard Anggaran", desc: "Penyerapan & pagu" },
      { href: "/rencana", icon: "kalender", label: "Rencana & Realisasi", desc: "Lampiran 3 bulanan" },
      { href: "/rencana-belanja", icon: "nota", label: "Rencana Belanja", desc: "Pemakaian pagu rutin" },
      { href: "/rka", icon: "kalkulator", label: "Rencana RKA", desc: "Usulan tahun depan" },
    ],
  },
  {
    judul: "Docking",
    menu: [
      { href: "/docking/rencana", icon: "kalenderCentang", label: "Perencanaan Docking", desc: "Repair list & jadwal" },
      { href: "/docking", icon: "kunci", label: "Monitoring Docking", desc: "Lama docking & berita acara",
        bukan: ["/docking/rencana", "/docking/laporan"] },
      { href: "/docking/laporan", icon: "folder", label: "Laporan Docking", desc: "Berkas per kapal" },
    ],
  },
  {
    judul: "Kapal & Armada",
    menu: [
      { href: "/inspeksi", icon: "kaca", label: "Inspeksi Kapal", desc: "Temuan & penutupannya" },
      { href: "/kerusakan", icon: "peringatan", label: "Kerusakan Kapal", desc: "Report accident" },
      { href: "/sertifikat", icon: "sertifikat", label: "Sertifikat Kapal", desc: "Masa berlaku 13 kapal" },
      { href: "/armada", icon: "jangkar", label: "Profil Armada", desc: "Spesifikasi & inventaris" },
      { href: "/kapal", icon: "kapal", label: "Data Kapal", desc: "Isi & ubah data kapal" },
      { href: "/sensor", icon: "sinyal", label: "Monitoring Sensor", desc: "Sensor Regional 4" },
    ],
  },
  {
    judul: "Kiriman dari Kapal",
    menu: [
      {
        href: "/permintaan-laporan", icon: "kotakMasuk", label: "Permintaan & Laporan", desc: "Kiriman ABK deck & mesin",
        tepat: true,
        sub: [
          { href: "/permintaan-laporan", label: "Rekap kiriman", icon: "daftar", tepat: true },
          { href: "/permintaan-laporan/isi", label: "Isi permintaan (terbaca)", icon: "dokumen" },
        ],
      },
      { href: "/uji-permintaan", icon: "tabung", label: "Borang Permintaan", desc: "Uji coba — input digital" },
    ],
  },
  {
    judul: "Pengadaan",
    menu: [
      {
        href: "/sppbj", icon: "dokumen", label: "SPPBJ Pengadaan", desc: "Riwayat & pembuatan", tepat: true,
        sub: [
          { href: "/sppbj", label: "Riwayat pengadaan", icon: "rumah", tepat: true },
          { href: "/sppbj/isi", label: "Input / edit", icon: "pensil" },
        ],
      },
      {
        href: "/nonpr", icon: "dokumenTambah", label: "SPPBJ Non PR PO", desc: "Pengadaan tanpa PR", tepat: true,
        sub: [
          { href: "/nonpr", label: "Riwayat", icon: "rumah", tepat: true },
          { href: "/nonpr/isi", label: "Input / edit", icon: "pensil" },
        ],
      },
      {
        href: "/material", icon: "kotak", label: "Kode Material", desc: "Pengajuan & cek kode SAP", tepat: true,
        sub: [
          { href: "/material", label: "Dashboard", icon: "rumah", tepat: true },
          { href: "/material/cek", label: "Cek kode material", icon: "kaca" },
          { href: "/material/isi", label: "Input item", icon: "pensil" },
        ],
      },
      { href: "/database-rab", icon: "basisData", label: "Database RAB", desc: "Harga acuan 2024–2026" },
      { href: "/monitoring", icon: "dunia", label: "Monitoring Pengadaan", desc: "Halaman terbuka untuk umum" },
    ],
  },
  {
    judul: "Dokumen & Alat",
    menu: [
      { href: "/surat", icon: "amplop", label: "Surat E-Office", desc: "9 jenis surat siap tempel" },
      {
        href: "/", icon: "gerigi", label: "Generator Swakelola", desc: "Dokumen docking swakelola", tepat: true,
        sub: [
          { href: "/", label: "Dashboard", icon: "rumah", tepat: true },
          { href: "/isi-data", label: "Isi data", icon: "pensil" },
          { href: "/distribusi", label: "Perhitungan swakelola", icon: "penggaris" },
        ],
      },
      {
        href: "/servis", icon: "obeng", label: "Servis Bengkel", desc: "Monitoring barang servis", tepat: true,
        sub: [
          { href: "/servis", label: "Monitoring", icon: "rumah", tepat: true },
          { href: "/servis/isi", label: "Input barang", icon: "pensil" },
        ],
      },
    ],
  },
  {
    judul: "Pengaman Data",
    menu: [
      { href: "/admin", icon: "meter", label: "Panel Admin", desc: "Total data & kuota" },
      { href: "/backup", icon: "perisai", label: "Backup Data", desc: "Salinan ke laptop" },
    ],
  },
];

/** halaman anak Generator Swakelola yang alamatnya tidak berawalan "/" */
const ANAK_SWAKELOLA = ["/isi-data", "/dokumen", "/distribusi"];

function aktifkan(m: Menu, path: string): boolean {
  if (m.href === "/") return path === "/" || ANAK_SWAKELOLA.some((x) => path.startsWith(x));
  if (m.bukan?.some((x) => path.startsWith(x))) return false;
  if (m.tepat) return path === m.href || (m.sub || []).some((s) => path.startsWith(s.href) && s.href !== "/");
  return path.startsWith(m.href);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 font-bold px-2 mb-1.5 mt-5 first:mt-1">{children}</p>;
}

/**
 * Judul kelompok yang bisa dibuka-tutup.
 *
 * Tujuh kelompok yang semuanya terbuka berarti dua puluh lebih menu terpampang
 * sekaligus, dan yang sedang dikerjakan tenggelam di antaranya. Dilipat, yang
 * terlihat hanya kelompok yang sedang dipakai — sisanya menunggu dibuka.
 */
function JudulKelompok({ judul, jumlah, buka, onKlik }: {
  judul: string; jumlah: number; buka: boolean; onKlik: () => void;
}) {
  return (
    <button type="button" onClick={onKlik} aria-expanded={buka}
      className="group mt-5 mb-1 flex w-full items-center gap-2 px-1 py-1 text-left first:mt-0">
      <Ikon nama="chevron" className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
        buka ? "rotate-90 text-[#7cc242]" : "text-white/45 group-hover:text-white/80"}`} />
      <span className={`shrink-0 text-[11.5px] font-bold uppercase tracking-[0.13em] transition-colors ${
        buka ? "text-white" : "text-white/65 group-hover:text-white"}`}>{judul}</span>
      {/* garis rambut menutup sisa lebar: kelompok terbaca sebagai bab, bukan
          sebagai satu tombol lagi di antara tombol-tombol menu */}
      <span className={`h-px flex-1 transition-colors ${
        buka ? "bg-gradient-to-r from-[#7cc242]/70 to-transparent" : "bg-white/15 group-hover:bg-white/30"}`} />
      <span className={`shrink-0 text-[11px] font-bold tabular-nums transition-colors ${
        buka ? "text-white/45" : "text-white/60 group-hover:text-white"}`}>{jumlah}</span>
    </button>
  );
}

function Baris({ m, path, onNavigate }: { m: Menu; path: string; onNavigate?: () => void }) {
  const aktif = aktifkan(m, path);
  return (
    <div className={`rounded-lg transition ${aktif && m.sub ? "bg-white/[0.05]" : ""}`}>
      <Link href={m.href} onClick={onNavigate}
        className={`relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-2.5 transition-all duration-150 ${
          aktif
            ? "text-white bg-[linear-gradient(90deg,rgba(124,194,66,0.22),rgba(20,184,196,0.14)_45%,transparent)]"
            : "text-white/80 hover:bg-white/[0.07] hover:pl-3.5 hover:text-white"}`}>
        {/* rel kiri hanya pada menu aktif — satu tanda yang sama di seluruh
            aplikasi, memakai gradasi merek ASDP */}
        {aktif && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-[#7cc242] via-[#14b8c4] to-[#1ca3dd]" />}
        <Ikon nama={m.icon} className={`h-5 w-5 shrink-0 transition-colors ${
          aktif ? "text-[#9fe06a]" : "text-white/55"}`} />
        <span className="min-w-0 leading-tight">
          <span className={`block truncate text-[14px] ${aktif ? "font-bold" : "font-medium"}`}>{m.label}</span>
          <span className="block truncate text-[11px] text-white/45">{m.desc}</span>
        </span>
      </Link>

      {/* halaman anak hanya muncul saat menunya sedang dipakai — daftar yang
          selalu terbuka membuat sidebar sepanjang dua layar */}
      {aktif && m.sub && (
        <div className="pb-1.5 pl-6 pr-1.5 anim-in">
          {m.sub.map((s) => {
            const a = s.tepat ? path === s.href : path.startsWith(s.href);
            return (
              <Link key={s.href} href={s.href} onClick={onNavigate}
                className={`flex items-center gap-2 rounded-r-md border-l-2 py-1.5 pl-3 pr-3 text-[13px] transition ${
                  a ? "border-[#14b8c4] bg-white/[0.06] font-semibold text-white"
                    : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"}`}>
                <Ikon nama={s.icon} className="h-4 w-4 shrink-0 opacity-80" /> {s.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname() || "";
  const [cari, setCari] = useState("");

  /** kelompok mana yang memuat halaman yang sedang dibuka */
  const kelompokAktif = useMemo(
    () => KELOMPOK.find((k) => k.menu.some((m) => aktifkan(m, path)))?.judul || "",
    [path]);

  /*
   * Pilihan buka-tutup diingat peramban. Orang kantor bekerja berhari-hari di
   * kelompok yang sama; melipat ulang tiap kali halaman dimuat hanya membuat
   * pekerjaan yang sama diulang-ulang.
   */
  const [buka, setBuka] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let simpan: Record<string, boolean> = {};
    try { simpan = JSON.parse(localStorage.getItem("sidebar:kelompok") || "{}"); } catch { /* biarkan */ }
    setBuka({ ...simpan, ...(kelompokAktif ? { [kelompokAktif]: true } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // kelompok yang memuat halaman baru selalu ikut terbuka, walau tadinya dilipat
  useEffect(() => {
    if (!kelompokAktif) return;
    setBuka((l) => (l[kelompokAktif] ? l : { ...l, [kelompokAktif]: true }));
  }, [kelompokAktif]);

  const alih = (judul: string) => setBuka((l) => {
    const baru = { ...l, [judul]: !l[judul] };
    try { localStorage.setItem("sidebar:kelompok", JSON.stringify(baru)); } catch { /* mode penyamaran */ }
    return baru;
  });

  /**
   * Pencarian menu. Dengan dua puluh lebih halaman, mengingat menu itu ada di
   * kelompok mana lebih lambat daripada mengetik dua huruf namanya.
   */
  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return null;
    const cocok = (t: string) => t.toLowerCase().includes(q);
    return KELOMPOK.flatMap((k) => k.menu.filter((m) =>
      cocok(m.label) || cocok(m.desc) || cocok(k.judul) || (m.sub || []).some((s) => cocok(s.label))));
  }, [cari]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-lg bg-white p-1.5 shadow-lg shadow-black/30">
            <Image src="/logo-asdp.png" alt="ASDP" width={42} height={29} className="object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-[14px] font-extrabold tracking-tight text-white">Manajemen Report</p>
            <p className="text-[10.5px] uppercase tracking-[0.12em] text-white/45">Teknik · Ternate</p>
          </div>
        </div>
        {/* garis merek: tiga warna ASDP, memisah kepala dari daftar menu */}
        <div className="mt-4 h-px bg-gradient-to-r from-[#7cc242] via-[#14b8c4] to-transparent" />
      </div>

      <div className="px-3 pt-3">
        <label className="relative block">
          <Ikon nama="kaca" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari menu…"
            className="w-full rounded-lg bg-black/25 py-2.5 pl-9 pr-8 text-[13.5px] text-white placeholder:text-white/35 outline-none ring-1 ring-white/10 transition focus:bg-black/35 focus:ring-[#14b8c4]/60" />
          {cari && (
            <button onClick={() => setCari("")} aria-label="Bersihkan pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-white">
              <Ikon nama="silang" className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {hasil ? (
          <>
            <SectionLabel>{hasil.length ? `${hasil.length} menu cocok` : "Tidak ada menu yang cocok"}</SectionLabel>
            {hasil.map((m) => <Baris key={m.href} m={m} path={path} onNavigate={onNavigate} />)}
          </>
        ) : (
          KELOMPOK.map((k) => (
            <div key={k.judul}>
              <JudulKelompok judul={k.judul} jumlah={k.menu.length}
                buka={!!buka[k.judul]} onKlik={() => alih(k.judul)} />
              {buka[k.judul] && (
                /*
                 * Garis tegak tipis menyusuri menu satu kelompok. Tanpa itu,
                 * tujuh kelompok yang dibuka bersamaan kembali terbaca sebagai
                 * satu daftar panjang: batas antar kelompok cuma jarak kosong,
                 * dan jarak kosong hilang begitu daftarnya digulir.
                 */
                <div className="relative ml-[7px] space-y-0.5 border-l border-white/10 pl-1.5 anim-in">
                  {k.menu.map((m) => <Baris key={m.href} m={m} path={path} onNavigate={onNavigate} />)}
                </div>
              )}
            </div>
          ))
        )}
      </nav>

      <div className="space-y-0.5 border-t border-white/10 px-3 pt-2">
        <ThemeToggle />
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/70 transition hover:bg-red-500/15 hover:text-white">
          <Ikon nama="keluar" className="h-[18px] w-[18px]" /> Keluar
        </button>
      </div>
      <div className="px-4 py-3 text-[9.5px] leading-relaxed text-white/30">
        PT. ASDP Indonesia Ferry (Persero)
        <br />Dibuat oleh <span className="font-medium text-white/50">Irsan Anugrah</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path === "/login") return null; // halaman login tanpa sidebar

  return (
    <>
      {/* Topbar mobile */}
      <div className="no-print md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 asdp-gradient text-white shadow">
        <button onClick={() => setOpen(true)} aria-label="Menu"><Ikon nama="garisTiga" className="h-5 w-5" /></button>
        <span className="font-bold text-sm">Manajemen Report Teknik ASDP Ternate</span>
      </div>

      {/* Sidebar desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-r border-white/10 md:flex"
        style={{ background: "radial-gradient(120% 60% at 0% 0%, rgba(20,184,196,0.20), transparent 60%), linear-gradient(180deg,#16357f 0%,#102a63 45%,#0a1a40 100%)" }}>
        <NavContent />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="no-print md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[272px] flex-col shadow-2xl"
            style={{ background: "radial-gradient(120% 60% at 0% 0%, rgba(20,184,196,0.20), transparent 60%), linear-gradient(180deg,#16357f 0%,#102a63 45%,#0a1a40 100%)" }}>
            <NavContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
