"use client";
/**
 * Pintu masuk Portal Kapal.
 *
 * Dibuka di ponsel, di anjungan atau kamar mesin, sering dengan sinyal satu
 * batang. Karena itu halamannya semata satu kotak: tanpa gambar besar, tanpa
 * apa pun yang harus diunduh sebelum kotaknya bisa diisi.
 *
 * Nama akun dibentuk dari nama kapal — "mamingdeck", "mamingmesin" — supaya
 * yang lupa tidak perlu menelepon kantor untuk menanyakannya; yang perlu
 * ditanyakan hanya sandinya.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function KotakMasuk() {
  const router = useRouter();
  const sp = useSearchParams();
  const [nama, setNama] = useState("");
  const [sandi, setSandi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const masuk = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/portal/masuk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim().toLowerCase(), sandi }),
      });
      const d = await r.json();
      if (!d.ok) { setGalat(d.error || "Gagal masuk"); return; }
      router.push(sp.get("dari") || "/portal");
      router.refresh();
    } catch (e: any) {
      setGalat(e?.message || "Jaringan bermasalah. Coba lagi.");
    } finally { setSibuk(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <form onSubmit={masuk} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#16357f] text-xl text-white">⚓</span>
          <div>
            <h1 className="text-lg font-black leading-tight text-slate-900 dark:text-white">Portal Kapal</h1>
            <p className="text-[11.5px] text-slate-500">PT ASDP Indonesia Ferry — Cabang Ternate</p>
          </div>
        </div>

        <label className="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Nama akun</label>
        <input value={nama} onChange={(e) => setNama(e.target.value)} autoCapitalize="none" autoCorrect="off"
          placeholder="mis. mamingdeck"
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-800" />

        <label className="mt-3 block text-[12px] font-bold text-slate-600 dark:text-slate-300">Sandi</label>
        <input value={sandi} onChange={(e) => setSandi(e.target.value)} type="password"
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-[#16357f] dark:border-slate-600 dark:bg-slate-800" />

        {galat && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">
            {galat}
          </p>
        )}

        <button type="submit" disabled={sibuk || !nama || !sandi}
          className="mt-4 w-full rounded-xl bg-[#16357f] py-2.5 text-[14px] font-bold text-white transition hover:bg-[#12296a] disabled:opacity-50">
          {sibuk ? "Memeriksa…" : "Masuk"}
        </button>

        <p className="mt-4 text-[11.5px] leading-relaxed text-slate-500">
          Nama akun mengikuti nama kapal dan bagian: <b>mamingdeck</b>, <b>mamingmesin</b>, <b>tunadeck</b>, dan
          seterusnya. Sandi diberikan kantor; kalau lupa, mintalah diatur ulang — kantor pun tidak bisa membacanya lagi.
        </p>
      </form>
    </main>
  );
}

export default function MasukPortal() {
  return <Suspense><KotakMasuk /></Suspense>;
}
