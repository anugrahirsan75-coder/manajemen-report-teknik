"use client";
/**
 * Penyimpanan PMS: satu baris Supabase per KAPAL (kind="pms").
 *
 * Satu baris per kapal, bukan per peralatan. Layar selalu membaca dan menyimpan
 * satu kapal sebagai kesatuan — daftar peralatan beserta rencananya — dan
 * memecahnya per butir akan mengubah satu kali simpan menjadi puluhan tulis
 * yang bisa selesai setengah jalan.
 *
 * Jam jalan mesin TIDAK disimpan di sini. Angkanya milik kapal, dikirim ABK
 * lewat Portal Kapal, dan dibaca apa adanya dari sana. Menyalinnya ke PMS
 * berarti dua angka jam yang sama-sama mengaku benar.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { catatBackup } from "@/lib/backup/local";
import { PmsKapal } from "./types";
import {
  BATAS_RIWAYAT, KIND_KERJA, Pengerjaan, PmsKerjaKapal,
  kembalikan, terapkan, urutRiwayat,
} from "./kerja";

const LS = "pms_kapal";
const LS_KERJA = "pms_kerja";
const KIND = "pms";

/**
 * Ubah apa pun yang dilempar Supabase menjadi satu kalimat yang bisa dibaca.
 *
 * PostgrestError bukan Error: ia objek biasa, jadi `String(e)` menghasilkan
 * "[object Object]" — pesan yang tidak menolong siapa pun yang sedang
 * kehilangan data.
 */
function bacaGalat(e: any): string {
  if (!e) return "Penyebabnya tidak terbaca.";
  if (typeof e === "string") return e;
  // e.error: bentuk yang dipakai gerbang /api/db ("Sesi habis…")
  const bagian = [e.message, typeof e.error === "string" ? e.error : null, e.details, e.hint].filter(Boolean);
  if (bagian.length) return bagian.join(" — ") + (e.code ? ` (kode ${e.code})` : "");
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** jam jalan per kapal → { nama mesin: jam } */
export type PetaJam = Record<string, Record<string, number>>;

export function usePms() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<PmsKapal[]>([]);
  const [kerja, setKerja] = useState<PmsKerjaKapal[]>([]);
  const [jam, setJam] = useState<PetaJam>({});
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    try {
      const a = localStorage.getItem(LS);
      if (a) setList(JSON.parse(a));
      const b = localStorage.getItem(LS_KERJA);
      if (b) setKerja(JSON.parse(b));
    } catch { /* simpanan lokal rusak — mulai kosong */ }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", KIND);
      if (error) { setGalat(bacaGalat(error)); return; }
      const { data: dk, error: ek } = await supabase.from("projects").select("id,payload")
        .filter("payload->>kind", "eq", KIND_KERJA);
      if (ek) { setGalat(bacaGalat(ek)); return; }
      setGalat("");
      const rows: PmsKapal[] = (data || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.kapal);
      const rk: PmsKerjaKapal[] = (dk || []).map((r: any) => r.payload?.doc).filter((x: any) => x?.kapal);
      setList(rows);
      setKerja(rk);
      try {
        localStorage.setItem(LS, JSON.stringify(rows));
        localStorage.setItem(LS_KERJA, JSON.stringify(rk));
      } catch { /* kuota penuh */ }
    } finally { setLoading(false); }
  }, []);

  /** jam jalan diambil dari data yang dikirim kapal lewat Portal */
  const muatJam = useCallback(async () => {
    try {
      const r = await fetch("/api/armada-data");
      if (!r.ok) return;
      const j = await r.json();
      const peta: PetaJam = {};
      for (const a of j.armada || []) {
        const per: Record<string, number> = {};
        for (const m of a?.stok?.mesin || []) {
          const nama = String(m.mesin || "").trim();
          if (nama) per[nama] = Number(m.jam) || 0;
        }
        peta[a.kapal] = per;
      }
      setJam(peta);
    } catch { /* jam jalan opsional — rencana kalender tetap jalan */ }
  }, []);

  useEffect(() => { if (ready) { load(); muatJam(); } }, [ready, load, muatJam]);

  /**
   * Tulis satu baris kapal, apa pun jenisnya.
   *
   * Dipakai dua kali (peralatan+rencana, dan riwayat pengerjaan) — dan dua
   * penulis yang ditulis terpisah cepat atau lambat berbeda dalam hal yang
   * justru paling penting, yaitu penanganan galatnya.
   */
  const tulisBaris = useCallback(async (kind: string, kapal: string, doc: unknown, nama: string) => {
    if (!supabase) return;
    // Kalau pencarian baris lama gagal, JANGAN teruskan: ex yang kosong akan
    // dibaca sebagai "belum ada", lalu kapal yang sama ditulis dua kali.
    const { data: ex, error: eCari } = await supabase.from("projects").select("id")
      .filter("payload->>kind", "eq", kind).filter("payload->>docId", "eq", kapal).limit(1);
    if (eCari) throw eCari;
    const payload = { kind, docId: kapal, kapal, doc };
    // Kegagalan tulis WAJIB diteriakkan. Catatan perawatan yang diam-diam
    // hanya mendarat di localStorage akan tampak tersimpan di satu komputer
    // dan hilang di komputer lain — dan orang baru menyadarinya ketika
    // riwayat pekerjaan diperlukan.
    const res = ex && ex[0]
      ? await supabase.from("projects").update({ payload }).eq("id", ex[0].id)
      : await supabase.from("projects").insert({ nama_kapal: nama, tahun: new Date().getFullYear(), payload });
    if (res.error) throw res.error;
    catatBackup(kind, ex?.[0]?.id, payload, nama);
  }, []);

  const simpan = useCallback(async (doc: PmsKapal) => {
    setGalat("");
    const isi: PmsKapal = { ...doc, diubahPada: new Date().toISOString() };
    setList((prev) => {
      const next = prev.some((x) => x.kapal === isi.kapal)
        ? prev.map((x) => (x.kapal === isi.kapal ? isi : x))
        : [...prev, isi];
      try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* kuota penuh */ }
      return next;
    });
    try {
      await tulisBaris(KIND, isi.kapal, isi, `PMS ${isi.kapal}`);
    } catch (e: any) {
      const pesan = bacaGalat(e);
      setGalat(pesan);
      throw new Error(pesan);   // pemanggil menampilkan pesannya apa adanya
    }
  }, [tulisBaris]);

  const simpanKerja = useCallback(async (kapal: string, riwayat: Pengerjaan[]) => {
    const isi: PmsKerjaKapal = {
      kapal,
      // yang tertua dibuang, bukan yang terbaru: riwayat dibaca dari ujung baru
      riwayat: [...riwayat].sort(urutRiwayat).slice(0, BATAS_RIWAYAT),
      diubahPada: new Date().toISOString(),
    };
    setKerja((prev) => {
      const next = prev.some((x) => x.kapal === kapal)
        ? prev.map((x) => (x.kapal === kapal ? isi : x))
        : [...prev, isi];
      try { localStorage.setItem(LS_KERJA, JSON.stringify(next)); } catch { /* kuota penuh */ }
      return next;
    });
    await tulisBaris(KIND_KERJA, kapal, isi, `PMS Riwayat ${kapal}`);
  }, [tulisBaris]);

  /**
   * Catat satu pekerjaan selesai.
   *
   * Dua baris ditulis: riwayatnya, dan capaian rencananya. Riwayat ditulis
   * LEBIH DULU — kalau yang kedua gagal, yang tersimpan adalah catatan
   * pengerjaan tanpa pergeseran jam (jatuh temponya masih tampak tertunggak,
   * dan itu keliru ke arah yang aman), bukan jam yang bergeser tanpa catatan
   * yang menerangkan kenapa.
   */
  const catat = useCallback(async (kapal: string, k: Pengerjaan) => {
    setGalat("");
    try {
      const lama = kerja.find((x) => x.kapal === kapal)?.riwayat || [];
      await simpanKerja(kapal, [k, ...lama.filter((x) => x.id !== k.id)]);

      const doc = list.find((x) => x.kapal === kapal);
      if (doc) {
        const rencana = doc.rencana.map((r) => (r.id === k.rencanaId ? terapkan(r, k) : r));
        await simpan({ ...doc, rencana });
      }
    } catch (e: any) {
      const pesan = bacaGalat(e);
      setGalat(pesan);
      throw new Error(pesan);
    }
  }, [kerja, list, simpanKerja, simpan]);

  /** kantor menyetujui laporan kapal — capaiannya sudah terpasang sejak dicatat */
  const sahkan = useCallback(async (kapal: string, id: string, oleh: string) => {
    setGalat("");
    const lama = kerja.find((x) => x.kapal === kapal)?.riwayat || [];
    try {
      await simpanKerja(kapal, lama.map((x) => x.id === id
        ? { ...x, status: "disahkan" as const, disahkanOleh: oleh, disahkanPada: new Date().toISOString(), alasanTolak: undefined }
        : x));
    } catch (e: any) {
      const pesan = bacaGalat(e); setGalat(pesan); throw new Error(pesan);
    }
  }, [kerja, simpanKerja]);

  /** kantor menolak — capaian rencananya dikembalikan ke angka sebelum laporan itu */
  const tolak = useCallback(async (kapal: string, id: string, oleh: string, alasan: string) => {
    setGalat("");
    const lama = kerja.find((x) => x.kapal === kapal)?.riwayat || [];
    const k = lama.find((x) => x.id === id);
    try {
      await simpanKerja(kapal, lama.map((x) => x.id === id
        ? { ...x, status: "ditolak" as const, disahkanOleh: oleh, disahkanPada: new Date().toISOString(), alasanTolak: alasan }
        : x));
      const doc = list.find((x) => x.kapal === kapal);
      if (doc && k) {
        const rencana = doc.rencana.map((r) => (r.id === k.rencanaId ? kembalikan(r, k) : r));
        await simpan({ ...doc, rencana });
      }
    } catch (e: any) {
      const pesan = bacaGalat(e); setGalat(pesan); throw new Error(pesan);
    }
  }, [kerja, list, simpanKerja, simpan]);

  return { ready, list, kerja, jam, loading, galat, reload: load, simpan, catat, sahkan, tolak };
}
