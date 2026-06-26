"use client";

/** Siluet ferry Ro-Ro (side view). Warna dari currentColor + aksen brand. */
export function Ferry({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 64" className={className} style={style} fill="none" aria-hidden="true">
      <path d="M6 40 H110 L100 54 H16 Z" fill="#16357f" />
      <rect x="20" y="24" width="72" height="16" rx="2" fill="#eaf2fb" />
      <rect x="68" y="15" width="20" height="10" rx="2" fill="#1ca3dd" />
      <rect x="40" y="13" width="8" height="12" rx="1" fill="#0e2456" />
      <rect x="40" y="16" width="8" height="3" fill="#7cc242" />
      <g fill="#1ca3dd"><rect x="25" y="29" width="6" height="6" rx="1" /><rect x="35" y="29" width="6" height="6" rx="1" /><rect x="45" y="29" width="6" height="6" rx="1" /><rect x="55" y="29" width="6" height="6" rx="1" /></g>
      <circle cx="96" cy="20" r="2.5" fill="#f5b301" />
    </svg>
  );
}

/** Lapisan ombak + ferry meluncur utk latar hero (absolute, tak ganggu klik). */
export function SailingWaves() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="mf-cross absolute" style={{ top: "26%", width: 46 }}><Ferry className="mf-bob w-full opacity-30" /></div>
      <svg className="absolute bottom-0 left-0 w-[200%] h-16 opacity-[0.10] mf-wave-slow" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0 30 Q150 0 300 30 T600 30 T900 30 T1200 30 V60 H0 Z" fill="#16357f" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-[200%] h-12 opacity-[0.14] mf-wave" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0 38 Q150 14 300 38 T600 38 T900 38 T1200 38 V60 H0 Z" fill="#1ca3dd" />
      </svg>
    </div>
  );
}

/** Loader bertema: ferry mengapung di atas ombak. */
export function ShipLoader({ label, sub }: { label?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="relative w-40 h-20 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16"><Ferry className="mf-bob w-full" /></div>
        <svg className="absolute bottom-0 left-0 w-[200%] h-8 opacity-50 mf-wave" viewBox="0 0 1200 60" preserveAspectRatio="none"><path d="M0 30 Q150 4 300 30 T600 30 T900 30 T1200 30 V60 H0 Z" fill="#1ca3dd" /></svg>
        <svg className="absolute bottom-0 left-0 w-[200%] h-6 opacity-70 mf-wave-slow" viewBox="0 0 1200 60" preserveAspectRatio="none"><path d="M0 36 Q150 16 300 36 T600 36 T900 36 T1200 36 V60 H0 Z" fill="#16357f" /></svg>
      </div>
      {label && <p className="text-sm font-semibold text-slate-700 mt-1">{label}</p>}
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Ilustrasi kosong: kapal bobbing + garis air. */
export function EmptyShip({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="relative w-44 h-24">
        <div className="absolute left-1/2 -translate-x-1/2 top-1 w-20"><Ferry className="mf-bob w-full" /></div>
        <svg className="absolute bottom-2 left-0 w-full h-10 opacity-30" viewBox="0 0 300 40" preserveAspectRatio="none"><path d="M0 18 Q40 6 80 18 T160 18 T240 18 T320 18" stroke="#16357f" strokeWidth="2.5" fill="none" /><path d="M0 28 Q40 16 80 28 T160 28 T240 28 T320 28" stroke="#1ca3dd" strokeWidth="2.5" fill="none" /></svg>
      </div>
      <p className="text-sm font-semibold text-slate-600 mt-2">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
