"use client";
/**
 * Pintu masuk halaman SCM.
 *
 * Berdiri sendiri, tanpa menu aplikasi: yang membukanya tim SCM, dan mereka
 * tak berkepentingan dengan alat kerja Teknik. Akun Teknik yang sudah masuk pun
 * tetap harus mengetik sandi SCM di sini.
 */
import { useState } from "react";

export default function MasukScm() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const masuk = async (e: React.FormEvent) => {
    e.preventDefault();
    setSibuk(true); setGalat("");
    try {
      const r = await fetch("/api/scm/masuk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Gagal masuk");
      const dari = new URLSearchParams(window.location.search).get("dari");
      window.location.href = dari && dari.startsWith("/scm") ? dari : "/scm";
    } catch (e: any) {
      setGalat(e?.message || String(e));
      setSibuk(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="asdp-gradient rounded-3xl p-[1.5px] shadow-xl">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white px-6 py-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl asdp-gradient text-2xl text-white shadow-md">📦</div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800">Pengadaan — SCM</h1>
                <p className="text-[11px] text-slate-500">PT ASDP Indonesia Ferry (Persero) — Cabang Ternate</p>
              </div>
            </div>

            <form onSubmit={masuk} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Akun SCM</label>
                <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus autoComplete="username"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Sandi</label>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400" />
              </div>
              {galat && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</p>}
              <button disabled={sibuk || !user || !pass}
                className="btn btn-primary w-full justify-center text-sm disabled:opacity-40">
                {sibuk ? "Memeriksa…" : "Masuk"}
              </button>
            </form>

            <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
              Halaman ini hanya memuat pekerjaan pengadaan. Sandinya terpisah dari aplikasi Teknik —
              minta ke pengelola aplikasi bila belum punya.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
