"use client";
import React from "react";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[10px] text-slate-400 mt-0.5 block">{hint}</span>}
    </label>
  );
}

const fieldCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition shadow-[0_1px_2px_rgba(15,23,42,0.04)] " +
  "hover:border-slate-400 focus:border-[#1ca3dd] focus:ring-4 focus:ring-[#1ca3dd]/15 outline-none placeholder:text-slate-400";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={fieldCls + " " + (props.className ?? "")} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={fieldCls + " bg-white " + (props.className ?? "")} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={fieldCls + " " + (props.className ?? "")} />;
}

export function Section({ title, icon, children, desc }: { title: string; icon?: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl elev-md ring-line border border-transparent p-5 mb-5 anim-in">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2.5">
          {icon && <span className="h-9 w-9 rounded-xl asdp-gradient text-white grid place-items-center text-base shadow-sm shrink-0">{icon}</span>}
          <span className="accent-bar">{title}</span>
        </h3>
        {desc && <p className="text-xs text-slate-400 mt-1.5 pl-[3.1rem]">{desc}</p>}
      </div>
      {children}
    </section>
  );
}
