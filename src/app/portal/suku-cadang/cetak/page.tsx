"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HalamanCetak } from "@/components/sukuCadang/HalamanCetak";
import { bulanIni } from "@/lib/portal/sukuCadang";

function Isi() {
  const q = useSearchParams();
  const periode = /^\d{4}-\d{2}$/.test(q.get("periode") || "") ? q.get("periode")! : bulanIni();
  return <HalamanCetak sumber="/api/portal/suku-cadang" periode={periode} />;
}

export default function CetakBorangKapal() {
  return <Suspense fallback={null}><Isi /></Suspense>;
}
