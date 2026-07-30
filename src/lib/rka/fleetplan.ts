"use client";
/**
 * Fleetplan cabang — rencana trip per KAPAL x LINTASAN x 12 bulan, plus jarak (Nm).
 *
 * Sumber: "RENCANA FLEETPLAN CABANG TERNATE TAHUN <tahun>.xlsx" (sheet yang
 * sudah terurai, satu baris = satu kapal-lintasan). Dipakai sebagai penunjang
 * penyusunan RKA: dari trip setahun + jarak + kecepatan kapal, jam kerja mesin
 * dan kebutuhan pelumas bisa dihitung tanpa menebak pola operasi.
 *
 * Disimpan sebagai SATU baris meta: kind="fleetplan" (payload.tahun + rute[]),
 * bukan satu baris per rute — datanya kecil dan selalu dibaca sekaligus.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";

export interface RuteFleet {
  kapal: string;
  jenis: string;            // KOMERSIAL / PERINTIS
  lintasan: string;
  jarakNm?: number;
  trip: number[];           // 12 bulan
  tripSetahun: number;
}

export interface Fleetplan {
  tahun: number;
  rute: RuteFleet[];
  diubahPada?: string;
}

const LS = "fleetplan";

export function useFleetplan() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<Fleetplan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { const a = localStorage.getItem(LS); if (a) setList(JSON.parse(a)); } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", "fleetplan");
      const rows: Fleetplan[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.tahun);
      rows.sort((a, b) => b.tahun - a.tahun);
      setList(rows);
      try { localStorage.setItem(LS, JSON.stringify(rows)); } catch {}
    } catch { /* diamkan */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const simpan = useCallback(async (f: Fleetplan) => {
    const doc: Fleetplan = { ...f, diubahPada: new Date().toISOString() };
    setList((p) => {
      const n = [doc, ...p.filter((x) => x.tahun !== doc.tahun)].sort((a, b) => b.tahun - a.tahun);
      try { localStorage.setItem(LS, JSON.stringify(n)); } catch {}
      return n;
    });
    if (!supabase) return;
    const { data: ex } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", "fleetplan").filter("payload->>tahunDoc", "eq", String(doc.tahun)).limit(1);
    const payload = { kind: "fleetplan", tahunDoc: String(doc.tahun), doc };
    const nama = `FLEETPLAN ${doc.tahun}`;
    if (ex && ex[0]) await supabase.from("projects").update({ payload }).eq("id", ex[0].id);
    else await supabase.from("projects").insert({ nama_kapal: nama, tahun: doc.tahun, payload });
    catatBackup("fleetplan", ex?.[0]?.id, payload, nama);
  }, []);

  return { ready, loading, list, reload: load, simpan };
}

/** rute milik satu kapal pada satu tahun fleetplan */
export const ruteKapal = (f: Fleetplan | undefined, kapal: string) =>
  (f?.rute || []).filter((r) => r.kapal === kapal);

export interface RingkasFleet {
  rute: RuteFleet[];
  tripSetahun: number;
  milSetahun: number;
  /** rata-rata jarak per trip (Nm) — dipakai menghitung jam per trip */
  jarakRataRata: number;
}

export function ringkasFleet(f: Fleetplan | undefined, kapal: string): RingkasFleet {
  const rute = ruteKapal(f, kapal);
  const tripSetahun = rute.reduce((s, r) => s + r.tripSetahun, 0);
  const milSetahun = rute.reduce((s, r) => s + r.tripSetahun * (r.jarakNm || 0), 0);
  return { rute, tripSetahun, milSetahun, jarakRataRata: tripSetahun ? milSetahun / tripSetahun : 0 };
}

/**
 * Ubah rute fleetplan menjadi pola operasi parameter RKA.
 * jam/trip = jarak (Nm) ÷ kecepatan (knot); trip/minggu = trip setahun ÷ 52.
 */
export function polaDariFleet(f: Fleetplan | undefined, kapal: string, kecepatanKnot: number) {
  const { rute, tripSetahun, jarakRataRata } = ringkasFleet(f, kapal);
  const v = kecepatanKnot > 0 ? kecepatanKnot : 0;
  return {
    lintasan: rute.map((r) => ({
      nama: r.lintasan,
      tripPerMinggu: +(r.tripSetahun / 52).toFixed(2),
      jamPerTrip: v && r.jarakNm ? +(r.jarakNm / v).toFixed(2) : 0,
    })),
    tripSetahun,
    jamPerTripUtama: v && jarakRataRata ? +(jarakRataRata / v).toFixed(2) : 0,
  };
}
