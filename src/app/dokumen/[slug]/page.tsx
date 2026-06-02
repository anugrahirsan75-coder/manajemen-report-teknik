"use client";

import { notFound } from "next/navigation";
import SPKDoc from "@/components/docs/SPKDoc";
import BADoc from "@/components/docs/BADoc";
import PerhitunganDoc from "@/components/docs/PerhitunganDoc";
import LampiranDoc from "@/components/docs/LampiranDoc";
import NominatifDoc from "@/components/docs/NominatifDoc";
import SPKHDoc from "@/components/docs/SPKHDoc";
import DokumentasiDoc from "@/components/docs/DokumentasiDoc";

const MAP: Record<string, () => JSX.Element> = {
  spk: SPKDoc,
  ba: BADoc,
  perhitungan: PerhitunganDoc,
  lampiran: LampiranDoc,
  nominatif: NominatifDoc,
  spkh: SPKHDoc,
  dokumentasi: DokumentasiDoc,
};

export default function DokumenPage({ params }: { params: { slug: string } }) {
  const Comp = MAP[params.slug];
  if (!Comp) return notFound();
  return <Comp />;
}
