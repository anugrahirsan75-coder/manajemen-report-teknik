"use client";

import Link from "next/link";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { formatNomorSpk } from "@/lib/types";
import { rupiahRp, tanggalIndo } from "@/lib/format";

const DOKUMEN = [
  { slug: "spk", no: "01", nama: "SPK Swakelola Docking", fmt: ["PDF", "Word"], icon: "📋", accent: "from-blue-500 to-indigo-600" },
  { slug: "ba", no: "02", nama: "Berita Acara Swakelola", fmt: ["PDF", "Excel"], icon: "✅", accent: "from-emerald-500 to-teal-600" },
  { slug: "perhitungan", no: "03", nama: "Daftar Perhitungan", fmt: ["PDF", "Excel", "OCR"], icon: "🧮", accent: "from-amber-500 to-orange-600" },
  { slug: "lampiran", no: "04", nama: "Lampiran SPK", fmt: ["PDF", "Excel"], icon: "📎", accent: "from-cyan-500 to-sky-600" },
  { slug: "nominatif", no: "05", nama: "Daftar Nominatif PPH 21", fmt: ["PDF", "Excel"], icon: "💰", accent: "from-violet-500 to-purple-600" },
  { slug: "spkh", no: "07", nama: "Surat Pernyataan Kebenaran Harga", fmt: ["PDF", "Excel"], icon: "✍️", accent: "from-rose-500 to-pink-600" },
  { slug: "dokumentasi", no: "08", nama: "Dokumentasi Docking", fmt: ["PDF", "Excel", "Foto"], icon: "📸", accent: "from-fuchsia-500 to-pink-600" },
];

const badgeColor: Record<string, string> = {
  PDF: "bg-rose-100 text-rose-700",
  Word: "bg-blue-100 text-blue-700",
  Excel: "bg-green-100 text-green-700",
  OCR: "bg-amber-100 text-amber-700",
  Foto: "bg-fuchsia-100 text-fuchsia-700",
};

export default function Home() {
  const { data, supabaseReady } = useStore();
  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      {/* Hero */}
      <div className="asdp-gradient rounded-3xl p-[1.5px] shadow-xl">
        <div className="glass rounded-3xl px-7 py-7">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-2xl p-2 shadow-md shrink-0" style={{ animation: "floaty 5s ease-in-out infinite" }}>
              <Image src="/logo-asdp.png" alt="ASDP" width={64} height={44} className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight asdp-text-gradient">Generator Swakelola Docking</h1>
              <p className="text-slate-500 text-sm">PT. ASDP Indonesia Ferry (Persero) — Cabang Ternate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Proyek aktif */}
      <section className="mt-5 grid sm:grid-cols-[1fr_auto] gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Kapal" value={data.namaKapal} />
          <Stat label="Tahun" value={String(data.tahun)} />
          <Stat label="Nomor SPK" value={formatNomorSpk(data)} mono />
          <Stat label="Nilai Swakelola" value={rupiahRp(data.biayaPekerjaan)} />
          <Stat label="Periode" value={`${tanggalIndo(data.tanggalMulai)} – ${tanggalIndo(data.tanggalSelesai)}`} />
        </div>
        <div className="flex sm:flex-col items-end justify-between gap-3">
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${supabaseReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${supabaseReady ? "bg-green-500" : "bg-amber-500"}`} />
            {supabaseReady ? "Supabase aktif" : "Mode lokal"}
          </span>
          <Link href="/isi-data" className="asdp-gradient text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:opacity-95 transition">
            ✏️ Isi / Ubah Data
          </Link>
        </div>
      </section>

      {/* Dokumen */}
      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="font-bold text-slate-700">Dokumen</h2>
        <span className="text-xs text-slate-400">{DOKUMEN.length} dokumen · PDF / Word / Excel</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {DOKUMEN.map((d) => (
          <Link key={d.slug} href={`/dokumen/${d.slug}`} className="card-hover bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4 group">
            <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${d.accent} grid place-items-center text-2xl text-white shadow-md shrink-0`}>
              {d.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">{d.no}</span>
                <p className="font-semibold text-slate-800 truncate group-hover:text-[#16357f]">{d.nama}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {d.fmt.map((f) => (
                  <span key={f} className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${badgeColor[f]}`}>{f}</span>
                ))}
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-[#16357f] group-hover:translate-x-0.5 transition text-xl">→</span>
          </Link>
        ))}
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Output mengikuti template asli · format & logo persis · PDF via MS Office
      </footer>
    </main>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`text-sm font-semibold text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
