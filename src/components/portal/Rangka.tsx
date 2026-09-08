"use client";
/**
 * Rangka Portal Kapal: kepala, menu, dan tombol keluar.
 *
 * Dipakai seluruh halaman portal supaya identitas kapal selalu terbaca di layar.
 * Itu bukan hiasan: satu ponsel di kapal kerap dipakai bergantian oleh dua orang
 * dari bagian berbeda, dan mengisi stok filter dengan akun Deck yang tertinggal
 * masuk adalah kekeliruan yang baru ketahuan berminggu-minggu kemudian.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface Aku {
  kapal: string;
  bagian: "deck" | "mesin";
  nama: string;
  ringkas: any;
}

export function useAku() {
  const [aku, setAku] = useState<Aku | null>(null);
  const [muat, setMuat] = useState(true);
  useEffect(() => {
    void fetch("/api/portal/aku", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setAku(d); })
      .catch(() => { /* dibiarkan; halaman menampilkan keadaan kosong */ })
      .finally(() => setMuat(false));
  }, []);
  return { aku, muat };
}

export function RangkaPortal({ aku, children }: { aku: Aku | null; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname() || "";
  const mesin = aku?.bagian === "mesin";

  const menu = [
    { href: "/portal", label: "Beranda", ikon: "🏠" },
    { href: "/portal/kirim", label: "Kirim berkas", ikon: "📤" },
    mesin
      ? { href: "/portal/stok", label: "Stok Filter", ikon: "⚙️" }
      : { href: "/portal/alkes", label: "Alat Kesehatan", ikon: "🩺" },
  ];

  const keluar = async () => {
    await fetch("/api/portal/masuk", { method: "DELETE" }).catch(() => {});
    router.push("/portal/masuk");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#16357f] text-white">⚓</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">
              {aku?.kapal || "Portal Kapal"}
            </p>
            <p className="text-[11px] text-slate-500">
              {aku ? <>Bagian <b className={mesin ? "text-orange-700" : "text-teal-700"}>{mesin ? "Mesin" : "Deck"}</b> · akun {aku.nama}</> : "Memuat…"}
            </p>
          </div>
          <button onClick={keluar}
            className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300">
            Keluar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      {/*
        Menu di BAWAH layar, bukan di atas: portal ini dipakai sambil berdiri,
        satu tangan memegang ponsel, dan ibu jari tidak sampai ke tepi atas.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/97 backdrop-blur dark:border-slate-800 dark:bg-slate-900/97">
        <div className="mx-auto flex max-w-3xl">
          {menu.map((m) => {
            const aktif = path === m.href;
            return (
              <Link key={m.href} href={m.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition ${
                  aktif ? "text-[#16357f] dark:text-sky-300" : "text-slate-500 hover:text-slate-700"}`}>
                <span className="text-[17px] leading-none">{m.ikon}</span>
                {m.label}
                <span className={`mt-0.5 h-0.5 w-8 rounded-full ${aktif ? "bg-[#16357f] dark:bg-sky-400" : "bg-transparent"}`} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
