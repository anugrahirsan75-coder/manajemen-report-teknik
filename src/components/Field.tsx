"use client";
import React from "react";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={"w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/30 outline-none " + (props.className ?? "")}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={"w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-[#1ca3dd] focus:ring-2 focus:ring-[#1ca3dd]/30 outline-none bg-white " + (props.className ?? "")}
    />
  );
}

export function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        {icon && <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm shadow-sm">{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}
