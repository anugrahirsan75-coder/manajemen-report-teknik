"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Ferry } from "@/components/MaritimeFx";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from") || "/";
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pass }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal masuk");
      window.location.href = from.startsWith("/login") ? "/" : from;
    } catch (e: any) { setErr(e?.message ?? String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5 relative overflow-hidden">
      {/* scene kapal berlayar */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="mf-cloud absolute top-[10%] h-7 w-28 rounded-full bg-white/35 blur-md" />
        <div className="mf-cloud-2 absolute top-[20%] h-6 w-20 rounded-full bg-white/25 blur-md" />
        <div className="mf-sail absolute top-[60%] w-32 drop-shadow-lg"><Ferry className="mf-bob w-full" /></div>
        <svg className="absolute bottom-0 left-0 w-[200%] h-32 opacity-25 mf-wave-slow" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 Q150 20 300 60 T600 60 T900 60 T1200 60 V120 H0 Z" fill="#16357f" /></svg>
        <svg className="absolute bottom-0 left-0 w-[200%] h-24 opacity-30 mf-wave" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 70 Q150 36 300 70 T600 70 T900 70 T1200 70 V120 H0 Z" fill="#1ca3dd" /></svg>
      </div>
      <div className="w-full max-w-sm anim-in relative z-10">
        <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg">
          <div className="glass hero-glow rounded-3xl p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-white rounded-2xl p-2 elev-md ring-1 ring-black/5"><Image src="/logo-asdp.png" alt="ASDP" width={48} height={33} className="object-contain" /></div>
              <div>
                <h1 className="text-lg font-extrabold asdp-text-gradient leading-tight">Manajemen Report Teknik</h1>
                <p className="text-xs text-slate-500">ASDP Ternate · masuk untuk lanjut</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Pengguna</label>
                <input autoFocus value={user} onChange={(e) => setUser(e.target.value)} placeholder="username"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#1ca3dd] focus:ring-4 focus:ring-[#1ca3dd]/15 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Password</label>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#1ca3dd] focus:ring-4 focus:ring-[#1ca3dd]/15 outline-none" />
              </div>
              {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full py-2.5">{busy ? "Memeriksa…" : "Masuk"}</button>
            </form>
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-4">PT. ASDP Indonesia Ferry (Persero) · Cabang Ternate</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
