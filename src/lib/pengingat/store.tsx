"use client";
/**
 * Mengumpulkan pengingat dari seluruh modul dengan SATU permintaan ke Supabase.
 *
 * Sengaja tidak memanggil hook tiap modul (useRR, useDocking, useServis, …):
 * lonceng ini hidup di sidebar yang selalu terpasang, jadi enam hook berarti
 * enam kueri di setiap halaman. Di sini cukup satu kueri yang menyaring kind
 * yang memang dipakai, dan payload berat (SPPBJ / Non PR PO) tidak diambil.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { ringkasKapal } from "@/lib/kapal/nama";
import {
  periodeAktif, bulanRealisasiAktif, tenggatRencana, tenggatRealisasi, namaBulan, totalDoc,
} from "@/lib/rr/types";
import { ringkasDocking, ringkasTermin, JENIS_BA } from "@/lib/docking/types";
import {
  Pengingat, isoHariIni, selisihHari, tingkatDariSisa, urutPengingat,
} from "./kumpul";

const LS = "pengingat_cache";


export function usePengingat() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<Pengingat[]>([]);
  const [loading, setLoading] = useState(false);
  const [waktu, setWaktu] = useState<string>("");

  useEffect(() => {
    try { const a = localStorage.getItem(LS); if (a) setList(JSON.parse(a)); } catch {}
  }, []);

  /*
   * Penyusunannya sekarang di server (/api/pengingat), bukan di sini.
   *
   * Dulu peramban menarik sendiri payload utuh tujuh kind — 1 MB sekali tarik,
   * tiap menit, di setiap halaman, untuk setiap pemakai — lalu menyusunnya
   * jadi belasan baris pengingat. Yang menyeberang sekarang tinggal hasilnya.
   */
  const muat = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const r = await fetch("/api/pengingat");
      if (!r.ok) return;
      const d = await r.json();
      if (!d?.ok) return;
      const hasil: Pengingat[] = d.list || [];
      setList(hasil);
      setWaktu(new Date().toLocaleTimeString("id-ID"));
      try { localStorage.setItem(LS, JSON.stringify(hasil)); } catch {}
    } catch {
      /* diam: lonceng tak boleh merusak halaman */
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    muat();
    /*
     * Tab yang tersembunyi tidak ditarik ulang. Komputer kantor biasa
     * meninggalkan aplikasi ini terbuka di satu tab seharian sambil bekerja di
     * tab lain; tanpa penjagaan ini ia tetap menarik tiap menit sepanjang hari
     * untuk lonceng yang tidak sedang dilihat siapa pun. Begitu tabnya
     * ditengok lagi, pendengar visibilitychange di bawah menariknya segar.
     */
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") muat();
    }, 60_000);
    const saatAktif = () => { if (document.visibilityState === "visible") muat(); };
    const dimintaUlang = () => muat();
    document.addEventListener("visibilitychange", saatAktif);
    window.addEventListener("pengingat:muat-ulang", dimintaUlang);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", saatAktif);
      window.removeEventListener("pengingat:muat-ulang", dimintaUlang);
    };
  }, [muat]);

  return { ready, loading, list, waktu, muatUlang: muat };
}

/** ubah baris payload menjadi daftar pengingat */
