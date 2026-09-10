"use client";

/**
 * Survei terdekat satu kapal, kalau memang mendesak.
 *
 * Sengaja diam saat tempo masih jauh: lencana yang selalu muncul berhenti
 * dibaca, dan dari layar daftar yang perlu terlihat hanya kapal yang harus
 * diurus sekarang.
 */
import { Ship } from "@/lib/kapal/types";
import { nadaTempo, tempoTerdekat, tglIndo } from "@/lib/kapal/bki";

export default function TempoLencana({ ship }: { ship: Ship }) {
  const t = ship.bki ? tempoTerdekat(ship.bki) : null;
  const n = t ? nadaTempo(t.tanggal) : "kosong";
  if (!t || n === "aman" || n === "kosong") return null;
  return (
    <p className={`mt-2 rounded-lg px-2 py-1 text-[11px] font-bold ${n === "lewat" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
      {n === "lewat" ? "⚠️ Lewat tempo" : "⏳ Jatuh tempo"} · {t.jenis} · {tglIndo(t.tanggal)}
    </p>
  );
}
