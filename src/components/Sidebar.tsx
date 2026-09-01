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
    <button onClick={toggle} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10 transition">
      <span className="text-base">{dark ? "☀️" : "🌙"}</span>
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
      { href: "/dashboard", icon: "📊", label: "Dashboard Anggaran", desc: "Penyerapan & pagu" },
      { href: "/rencana", icon: "📆", label: "Rencana & Realisasi", desc: "Lampiran 3 bulanan" },
      { href: "/rencana-belanja", icon: "🧾", label: "Rencana Belanja", desc: "Pemakaian pagu rutin" },
      { href: "/rka", icon: "🧮", label: "Rencana RKA", desc: "Usulan tahun depan" },
    ],
  },
  {
    judul: "Docking",
    menu: [
      { href: "/docking/rencana", icon: "🗓️", label: "Perencanaan Docking", desc: "Repair list & jadwal" },
      { href: "/docking", icon: "🛠️", label: "Monitoring Docking", desc: "Lama docking & berita acara",
        bukan: ["/docking/rencana", "/docking/laporan"] },
      { href: "/docking/laporan", icon: "📂", label: "Laporan Docking", desc: "Berkas per kapal" },
    ],
  },
  {
    judul: "Kapal & Armada",
    menu: [
      { href: "/inspeksi", icon: "🔍", label: "Inspeksi Kapal", desc: "Temuan & penutupannya" },
      { href: "/kerusakan", icon: "⚠️", label: "Kerusakan Kapal", desc: "Report accident" },
      { href: "/sertifikat", icon: "📜", label: "Sertifikat Kapal", desc: "Masa berlaku 13 kapal" },
      { href: "/armada", icon: "⚓", label: "Profil Armada", desc: "Spesifikasi & inventaris" },
      { href: "/kapal", icon: "🚢", label: "Data Kapal", desc: "Isi & ubah data kapal" },
      { href: "/sensor", icon: "📡", label: "Monitoring Sensor", desc: "Sensor Regional 4" },
    ],
  },
  {
    judul: "Kiriman dari Kapal",
    menu: [
      {
        href: "/permintaan-laporan", icon: "📨", label: "Permintaan & Laporan", desc: "Kiriman ABK deck & mesin",
        tepat: true,
        sub: [
          { href: "/permintaan-laporan", label: "Rekap kiriman", icon: "📋", tepat: true },
          { href: "/permintaan-laporan/isi", label: "Isi permintaan (terbaca)", icon: "🧾" },
        ],
      },
      { href: "/uji-permintaan", icon: "🧪", label: "Borang Permintaan", desc: "Uji coba — input digital" },
    ],
  },
  {
    judul: "Pengadaan",
    menu: [
      {
        href: "/sppbj", icon: "📑", label: "SPPBJ Pengadaan", desc: "Riwayat & pembuatan", tepat: true,
        sub: [
          { href: "/sppbj", label: "Riwayat pengadaan", icon: "🏠", tepat: true },
          { href: "/sppbj/isi", label: "Input / edit", icon: "✏️" },
        ],
      },
      {
        href: "/nonpr", icon: "🧾", label: "SPPBJ Non PR PO", desc: "Pengadaan tanpa PR", tepat: true,
        sub: [
          { href: "/nonpr", label: "Riwayat", icon: "🏠", tepat: true },
          { href: "/nonpr/isi", label: "Input / edit", icon: "✏️" },
        ],
      },
      {
        href: "/material", icon: "📦", label: "Kode Material", desc: "Pengajuan & cek kode SAP", tepat: true,
        sub: [
          { href: "/material", label: "Dashboard", icon: "🏠", tepat: true },
          { href: "/material/cek", label: "Cek kode material", icon: "🔎" },
          { href: "/material/isi", label: "Input item", icon: "✏️" },
        ],
      },
      { href: "/database-rab", icon: "🗃️", label: "Database RAB", desc: "Harga acuan 2024–2026" },
      { href: "/monitoring", icon: "🌐", label: "Monitoring Pengadaan", desc: "Halaman terbuka untuk umum" },
    ],
  },
  {
    judul: "Dokumen & Alat",
    menu: [
      { href: "/surat", icon: "✉️", label: "Surat E-Office", desc: "9 jenis surat siap tempel" },
      {
        href: "/", icon: "⚙️", label: "Generator Swakelola", desc: "Dokumen docking swakelola", tepat: true,
        sub: [
          { href: "/", label: "Dashboard", icon: "🏠", tepat: true },
          { href: "/isi-data", label: "Isi data", icon: "✏️" },
          { href: "/distribusi", label: "Perhitungan swakelola", icon: "📐" },
        ],
      },
      {
        href: "/servis", icon: "🔧", label: "Servis Bengkel", desc: "Monitoring barang servis", tepat: true,
        sub: [
          { href: "/servis", label: "Monitoring", icon: "🏠", tepat: true },
          { href: "/servis/isi", label: "Input barang", icon: "✏️" },
        ],
      },
    ],
  },
  {
    judul: "Pengaman Data",
    menu: [
      { href: "/admin", icon: "🧮", label: "Panel Admin", desc: "Total data & kuota" },
      { href: "/backup", icon: "🛡️", label: "Backup Data", desc: "Salinan ke laptop" },
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
      className="mt-5 mb-1.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition first:mt-1 hover:bg-white/5">
      <span className={`text-[10px] text-white/40 transition-transform ${buka ? "rotate-90" : ""}`}>▶</span>
      <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{judul}</span>
      {!buka && <span className="rounded-full bg-white/10 px-1.5 text-[9px] font-bold text-white/45">{jumlah}</span>}
    </button>
  );
}

function Baris({ m, path, onNavigate }: { m: Menu; path: string; onNavigate?: () => void }) {
  const aktif = aktifkan(m, path);
  return (
    <div className={`rounded-xl transition ${aktif && m.sub ? "bg-white/[0.07] ring-1 ring-white/10" : ""}`}>
      <Link href={m.href} onClick={onNavigate}
        className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition ${
          aktif ? "text-white bg-white/[0.07] ring-1 ring-white/10" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
        {aktif && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-[#7cc242] via-[#14b8c4] to-[#1ca3dd]" />}
        <span className={`grid place-items-center h-8 w-8 rounded-lg text-base shrink-0 ${aktif ? "bg-white/15 shadow-inner" : "bg-white/5"}`}>{m.icon}</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold truncate">{m.label}</span>
          <span className="block text-[10px] text-white/45 truncate">{m.desc}</span>
        </span>
      </Link>

      {/* halaman anak hanya muncul saat menunya sedang dipakai — daftar yang
          selalu terbuka membuat sidebar sepanjang dua layar */}
      {aktif && m.sub && (
        <div className="pb-2 pl-3.5 pr-1.5 anim-in">
          {m.sub.map((s) => {
            const a = s.tepat ? path === s.href : path.startsWith(s.href);
            return (
              <Link key={s.href} href={s.href} onClick={onNavigate}
                className={`flex items-center gap-2 pl-3.5 pr-3 py-1.5 rounded-lg text-[13px] transition border-l-2 ${
                  a ? "text-white border-[#14b8c4] bg-white/5 font-medium" : "text-white/55 border-white/10 hover:text-white hover:border-white/30"}`}>
                <span className="text-xs opacity-90">{s.icon}</span> {s.label}
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
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1.5 shadow-lg shrink-0 ring-1 ring-white/20">
            <Image src="/logo-asdp.png" alt="ASDP" width={40} height={28} className="object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-extrabold text-sm tracking-tight">Manajemen Report</p>
            <p className="text-white/60 text-xs">Teknik ASDP · Ternate</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <label className="relative block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">⌕</span>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari menu…"
            className="w-full rounded-xl bg-white/10 py-2 pl-8 pr-7 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-white/30" />
          {cari && (
            <button onClick={() => setCari("")} aria-label="Bersihkan pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">✕</button>
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
                <div className="space-y-0.5 anim-in">
                  {k.menu.map((m) => <Baris key={m.href} m={m} path={path} onNavigate={onNavigate} />)}
                </div>
              )}
            </div>
          ))
        )}
      </nav>

      <div className="px-3 pt-2 border-t border-white/10 space-y-1">
        <ThemeToggle />
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10 transition">
          <span className="text-base">🚪</span> Keluar
        </button>
      </div>
      <div className="px-4 py-3 text-[10px] text-white/40 leading-relaxed">
        PT. ASDP Indonesia Ferry (Persero)
        <br />Dibuat oleh <span className="text-white/70 font-medium">Irsan Anugrah</span>
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
        <button onClick={() => setOpen(true)} aria-label="Menu" className="text-xl">☰</button>
        <span className="font-bold text-sm">Manajemen Report Teknik ASDP Ternate</span>
      </div>

      {/* Sidebar desktop */}
      <aside className="no-print hidden md:flex w-64 shrink-0 sticky top-0 h-screen flex-col" style={{ background: "linear-gradient(180deg,#16357f,#0e2456)" }}>
        <NavContent />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="no-print md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col shadow-xl" style={{ background: "linear-gradient(180deg,#16357f,#0e2456)" }}>
            <NavContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
