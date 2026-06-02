"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectData } from "@/lib/types";
import { generateDoc } from "@/lib/generateClient";

interface Props {
  title: string;
  slug: string;
  data: ProjectData;
  nativeKind: "word" | "excel";
  extra?: React.ReactNode;
}

export default function DocToolbar({ title, slug, data, nativeKind, extra }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: "native" | "pdf") => {
    setBusy(key);
    try {
      await generateDoc(slug, key, data);
    } catch (e: any) {
      alert("Gagal generate: " + (e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const Spin = () => <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />;
  const pdfEnabled = process.env.NEXT_PUBLIC_ENABLE_PDF !== "false"; // online (Vercel) set false

  return (
    <div className="no-print sticky top-0 z-20 glass border-b border-slate-200/70 shadow-sm">
      <div className="max-w-[230mm] mx-auto px-4 py-3 flex flex-wrap items-center gap-2.5">
        <Link href="/" className="text-sm text-slate-500 hover:text-[#16357f] inline-flex items-center gap-1">
          <span className="text-lg leading-none">‹</span> Dashboard
        </Link>
        <span className="h-5 w-px bg-slate-200 mx-1" />
        <h1 className="font-bold text-slate-800 mr-auto">{title}</h1>
        {extra}
        {pdfEnabled && (
          <button onClick={() => run("pdf")} disabled={!!busy}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-rose-500 to-red-600 text-white text-sm px-4 py-2 rounded-xl font-semibold shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-50 transition">
            {busy === "pdf" ? <><Spin /> Konversi…</> : <>📄 PDF</>}
          </button>
        )}
        <button onClick={() => run("native")} disabled={!!busy}
          className={`inline-flex items-center gap-2 text-white text-sm px-4 py-2 rounded-xl font-semibold shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-50 transition bg-gradient-to-br ${nativeKind === "word" ? "from-blue-600 to-indigo-700" : "from-emerald-600 to-green-700"}`}>
          {busy === "native" ? <><Spin /> …</> : nativeKind === "word" ? <>📝 Word</> : <>📊 Excel</>}
        </button>
      </div>
      <p className="max-w-[230mm] mx-auto px-4 pb-2 text-[11px] text-slate-400">
        Hasil mengikuti <b>template asli</b> (format + logo persis) · PDF dikonversi via MS Office · preview di bawah hanya gambaran.
      </p>
    </div>
  );
}
