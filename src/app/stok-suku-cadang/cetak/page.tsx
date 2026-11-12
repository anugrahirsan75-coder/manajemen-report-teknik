"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HalamanCetak } from "@/components/sukuCadang/HalamanCetak";
import { bulanIni } from "@/lib/portal/sukuCadang";

function Isi() {
  const q = useSearchParams();
  const periode = /^\d{4}-\d{2}$/.test(q.get("periode") || "") ? q.get("periode")! : bulanIni();
  const sumber = `/api/suku-cadang?kapal=${encodeURIComponent(q.get("kapal") || "")}&bagian=${q.get("bagian") === "deck" ? "deck" : "mesin"}`;
  return <HalamanCetak sumber={sumber} periode={periode} />;
}

export default function CetakBorangKantor() {
  return <Suspense fallback={null}><Isi /></Suspense>;
}
