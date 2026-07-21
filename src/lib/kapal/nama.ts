// Normalisasi nama kapal dari isian bebas di tabel item (dipakai daftar pengadaan & dashboard).
// Tahan data rusak hasil salah ketik/tempel, mis. "KKMP. MAMINGMP. TUNA" -> [KMP. MAMING, KMP. TUNA].
import { namaKapalPenuh, KAPAL_ANGGARAN } from "@/lib/anggaran/types";

// nama inti tiap kapal ("KMP. PULAU SAGORI" -> "PULAU SAGORI") utk pencocokan di teks acak
const INTI = KAPAL_ANGGARAN.map((k) => ({ penuh: k, inti: k.replace(/^KMP\.?\s*/i, "").toUpperCase() }));

/** Cari nama kapal armada yang DIKENAL di dalam teks, urut posisi kemunculan. */
export function cocokKapalDikenal(t: string): string[] {
  const up = t.toUpperCase();
  const hit: { i: number; penuh: string }[] = [];
  for (const { penuh, inti } of INTI) {
    let from = 0, i = up.indexOf(inti, from);
    while (i !== -1) { hit.push({ i, penuh }); from = i + inti.length; i = up.indexOf(inti, from); }
  }
  hit.sort((a, b) => a.i - b.i);
  const out: string[] = [];
  for (const h of hit) if (!out.includes(h.penuh)) out.push(h.penuh);
  return out;
}

/**
 * Pecah 1 sel kapal jadi beberapa nama kapal.
 * 1) utamakan nama armada yang dikenal; 2) selain itu pisah manual (koma/newline/slash/"KMP" nempel).
 */
export function pecahKapal(raw: string): string[] {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const dikenal = cocokKapalDikenal(t);
  if (dikenal.length) return dikenal;
  return t
    .split(/\s*[\n,;/|]+\s*/)
    .flatMap((s) => s.split(/(?=KMP)/i))
    .map((s) => {
      let v = s.replace(/^[.\s]+|[.,;\s]+$/g, "").trim();
      if (/^KMP/i.test(v)) v = v.replace(/^KMP\.?\s*/i, "KMP. ").trim(); // "KMP.TUNA" -> "KMP. TUNA"
      return namaKapalPenuh(v);
    })
    .filter((s) => s && s.toUpperCase() !== "KMP" && s.toUpperCase() !== "KMP.");
}

/** "KMP. ARIWANGAN" -> "ARIWANGAN" (utk chip sempit) */
export const ringkasKapal = (k: string) => k.replace(/^KMP\.?\s*/i, "");
