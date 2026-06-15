"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

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
    <div className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-sm anim-in">
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
