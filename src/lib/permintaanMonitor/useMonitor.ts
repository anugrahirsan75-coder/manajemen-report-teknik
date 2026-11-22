"use client";
/**
 * Data bersama halaman Monitoring Permintaan dan Dashboard Manajemen.
 *
 * Empat sumber dirangkai di peramban: kiriman ABK, hasil Juru Baca, penilaian
 * kantor, dan pengadaan (SPPBJ / Non PR PO / SCM). Harga taksiran dicocokkan
 * ke Database RAB lewat indeks lokal — tidak menyentuh Drive.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { muatBacaan } from "@/lib/lapor/simpananBacaan";
import type { BarisPermintaan } from "@/lib/lapor/skemaPermintaan";
import type { KirimanLapor } from "@/lib/lapor/types";
import { singkatJenis } from "@/lib/lapor/types";
import { Ringkasan, hargaLayak, nilaiBarang, ringkas, satuanEfektif, susunBaris } from "./logika";
import { ingatPenilai, jejakBaru, muatEval, muatPengadaan, namaPenilai, simpanEval } from "./store";
import {
  BarisMonitor, EvalPermintaan, KEPUTUSAN, KIND_EVAL, KLASIFIKASI, Klasifikasi, PRIORITAS, Pengadaan, TAHAP, Tahap,
} from "./types";

export const KIND_RINGKAS = "permintaan_ringkas";

type Patch = Partial<Pick<EvalPermintaan,
  "prioritas" | "klasifikasi" | "keputusan" | "catatan" | "pic" | "diterima" | "tautPengadaan">>;

const LABEL_UBAH: Record<keyof Patch, string> = {
  prioritas: "prioritas", klasifikasi: "klasifikasi", keputusan: "keputusan", catatan: "catatan",
  pic: "PIC", diterima: "diterima", tautPengadaan: "tautan pengadaan",
};

export function evalBaru(b: BarisMonitor, oleh: string): EvalPermintaan {
  const kini = new Date().toISOString();
  return {
    kind: KIND_EVAL, kunci: b.kunci, fileId: b.fileId, kirimanId: b.kirimanId, kapal: b.kapal, jenis: b.jenis,
    periode: b.periode, dikirimPada: b.dikirimPada, nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah,
    satuan: b.satuan, prioritas: "", klasifikasi: "", keputusan: "", catatan: "", pic: "", diterima: "",
    tautPengadaan: "", tahapTerakhir: "", oleh, dibuatPada: kini, diubahPada: kini, jejak: [],
  };
}

export function useMonitorPermintaan() {
  const [kiriman, setKiriman] = useState<KirimanLapor[]>([]);
  const [bacaan, setBacaan] = useState<Map<string, { baris: BarisPermintaan[]; status: string }>>(new Map());
  const [evals, setEvals] = useState<Map<string, EvalPermintaan>>(new Map());
  const idBaris = useRef<Map<string, string>>(new Map());
  const [pengadaan, setPengadaan] = useState<Pengadaan[]>([]);
  const [harga, setHarga] = useState<Record<string, number>>({});
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [penilai, setPenilai] = useState("");
  const [simpanan, setSimpanan] = useState(0);
  const jadwal = useRef<Map<string, number>>(new Map());

  useEffect(() => { setPenilai(namaPenilai()); }, []);
  const gantiPenilai = (n: string) => { setPenilai(n); ingatPenilai(n); };

  const ambil = useCallback(async () => {
    setGalat("");
    try {
      const [r, bc, ev, pg] = await Promise.all([
        fetch("/api/lapor/daftar", { cache: "no-store" }).then((x) => x.json()),
        muatBacaan(), muatEval(), muatPengadaan(),
      ]);
      if (!r.ok) throw new Error(r.error || "Gagal memuat kiriman kapal");
      setKiriman((r.baris as KirimanLapor[]).filter((k) => String(k.jenis).startsWith("permintaan")));
      const m = new Map<string, { baris: BarisPermintaan[]; status: string }>();
      bc.forEach((v, k) => m.set(k, { baris: v.bacaan.baris || [], status: v.bacaan.status }));
      setBacaan(m);
      setEvals(ev.evals); idBaris.current = ev.idBaris;
      setPengadaan(pg);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);
  useEffect(() => { void ambil(); }, [ambil]);

  const baris = useMemo(
    () => susunBaris({ kiriman, bacaan, evals, pengadaan, harga }),
    [kiriman, bacaan, evals, pengadaan, harga]);

  /*
   * Taksiran harga dari Database RAB — sekali per barang.
   *
   * Kunci yang sudah DIMINTA dicatat di ref, dan permintaan yang sedang jalan
   * tidak dibatalkan saat layar dirender ulang. Tiap harga yang masuk mengubah
   * daftar barang (nilainya ikut menentukan saran klasifikasi); kalau efek
   * membatalkan dirinya setiap kali itu terjadi, hanya potongan pertama yang
   * pernah sampai dan sisanya tak pernah terisi.
   */
  const dimintaHarga = useRef<Set<string>>(new Set());
  const hidup = useRef(true);
  useEffect(() => () => { hidup.current = false; }, []);
  useEffect(() => {
    const perlu = baris.filter((b) => !dimintaHarga.current.has(b.kunci))
      .map((b) => ({ id: b.kunci, teks: `${b.nama} ${b.spesifikasi}`.trim(), satuan: satuanEfektif(b) }));
    if (!perlu.length) return;
    perlu.forEach((x) => dimintaHarga.current.add(x.id));
    (async () => {
      for (let n = 0; n < perlu.length && hidup.current; n += 150) {
        const potong = perlu.slice(n, n + 150);
        try {
          const r = await fetch("/api/harga/cocok", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: potong.map(({ id, teks }) => ({ id, teks })) }),
          });
          const d = await r.json();
          if (!hidup.current || !d?.ok) { potong.forEach((x) => dimintaHarga.current.delete(x.id)); continue; }
          setHarga((lama) => {
            const baru = { ...lama };
            potong.forEach((x) => { baru[x.id] = hargaLayak(x.satuan, d.hasil?.[x.id]); });
            return baru;
          });
        } catch { potong.forEach((x) => dimintaHarga.current.delete(x.id)); }
      }
    })();
  }, [baris]);

  const ringkasan: Ringkasan = useMemo(() => ringkas(baris, harga), [baris, harga]);

  /* ── simpan ─────────────────────────────────────────────────────────────── */

  const tulis = useCallback((e: EvalPermintaan, segera = false) => {
    const lama = jadwal.current.get(e.kunci);
    if (lama) window.clearTimeout(lama);
    setSimpanan((n) => n + 1);
    jadwal.current.set(e.kunci, window.setTimeout(() => {
      jadwal.current.delete(e.kunci);
      void simpanEval(idBaris.current.get(e.kunci) || null, e)
        .then((id) => { idBaris.current.set(e.kunci, id); })
        .catch((x) => setGalat(x?.message || String(x)))
        .finally(() => setSimpanan((n) => Math.max(0, n - 1)));
    }, segera ? 50 : 900));
  }, []);

  /* penilaian terkini tanpa menunggu render — dipakai perubahan beruntun */
  const evalsRef = useRef(evals);
  useEffect(() => { evalsRef.current = evals; }, [evals]);

  const terapkan = useCallback((daftar: BarisMonitor[], patch: Patch) => {
    if (!daftar.length) return;
    const oleh = penilai || "Kantor";
    const n = new Map(evalsRef.current);
    const tertulis: EvalPermintaan[] = [];
    daftar.forEach((b) => {
      const dasar = n.get(b.kunci) || evalBaru(b, oleh);
      const ubah = (Object.keys(patch) as (keyof Patch)[])
        .filter((k) => (dasar as any)[k] !== patch[k])
        .map((k) => `${LABEL_UBAH[k]}: ${String(patch[k] ?? "") || "—"}`);
      if (!ubah.length) return;
      const e: EvalPermintaan = {
        ...dasar, ...patch, oleh, diubahPada: new Date().toISOString(),
        jejak: [...(dasar.jejak || []), jejakBaru(oleh, ubah.join("; "))].slice(-30),
      };
      n.set(b.kunci, e); tertulis.push(e);
    });
    if (!tertulis.length) return;
    evalsRef.current = n;
    setEvals(n);
    tertulis.forEach((e) => tulis(e, tertulis.length > 1));
  }, [penilai, tulis]);

  /** konfirmasi saran mesin apa adanya — untuk barang yang belum disentuh */
  const terimaSaran = useCallback((daftar: BarisMonitor[]) => {
    daftar.forEach((b) => {
      const p: Patch = {};
      if (!b.ev?.prioritas) p.prioritas = b.saranPrioritas;
      if (!b.ev?.klasifikasi) p.klasifikasi = b.saranKlasifikasi;
      if (Object.keys(p).length) terapkan([b], p);
    });
  }, [terapkan]);

  /*
   * Tahap terakhir yang dilihat layar dititipkan ke baris penilaian, dan
   * ringkasan armada ditulis ke satu baris "permintaan_ringkas". Lonceng
   * pengingat berjalan di server tanpa data SPPBJ; dari dua titipan inilah ia
   * tahu ada barang urgent yang menggantung.
   */
  const ringkasTerakhir = useRef("");
  useEffect(() => {
    if (muat || !baris.length) return;
    const t = window.setTimeout(() => {
      const geser = baris.filter((b) => b.ev && b.ev.tahapTerakhir !== b.tahap);
      if (geser.length) {
        const n = new Map(evalsRef.current);
        geser.forEach((b) => { const e = { ...b.ev!, tahapTerakhir: b.tahap }; n.set(b.kunci, e); tulis(e); });
        evalsRef.current = n; setEvals(n);
      }
      const isi = {
        kind: KIND_RINGKAS,
        menggantung: ringkasan.menggantung, belumDievaluasi: ringkasan.belumDievaluasi,
        urgentTerbuka: ringkasan.urgentTerbuka, disetujuiBelumSppbj: ringkasan.disetujuiBelumSppbj,
        contohMenggantung: baris.filter((b) => b.menggantung).sort((a, b) => b.umurHari - a.umurHari).slice(0, 4)
          .map((b) => `${b.kapal.replace(/^KMP\.?\s*/i, "")}: ${b.nama} (${b.umurHari} hr)`),
      };
      const sidik = JSON.stringify(isi);
      if (sidik === ringkasTerakhir.current || !supabase) return;
      ringkasTerakhir.current = sidik;
      void (async () => {
        const { data } = await supabase!.from("projects").select("id")
          .filter("payload->>kind", "eq", KIND_RINGKAS).limit(1);
        const payload = { ...isi, waktu: new Date().toISOString() };
        if (data && data[0]) await supabase!.from("projects").update({ payload }).eq("id", data[0].id);
        else await supabase!.from("projects").insert({ nama_kapal: "MONITORING PERMINTAAN", tahun: new Date().getFullYear(), payload });
      })().catch(() => { /* lonceng boleh tertinggal sesaat */ });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [muat, baris, ringkasan, tulis]);

  return {
    muat, galat, baris, ringkasan, harga, pengadaan, penilai, gantiPenilai, sibukSimpan: simpanan > 0,
    muatUlang: ambil, terapkan, terimaSaran,
  };
}

/* ── ekspor ke Excel ────────────────────────────────────────────────────── */

const label = <T extends { id: string; label: string }>(daftar: T[], id: string) => daftar.find((x) => x.id === id)?.label || "";

export function perKapal(baris: BarisMonitor[], harga: Record<string, number>) {
  const m = new Map<string, BarisMonitor[]>();
  baris.forEach((b) => m.set(b.kapal, [...(m.get(b.kapal) || []), b]));
  return Array.from(m.entries()).map(([kapal, d]) => {
    const r = ringkas(d, harga);
    return {
      kapal, total: r.total, terbuka: r.terbuka, belum: r.belumDievaluasi, urgent: r.urgentTerbuka,
      menggantung: r.menggantung, proses: r.prosesPengadaan, selesai: r.selesai,
      ...(Object.fromEntries(Object.entries(r.nilaiPerKlasifikasi).map(([k, v]) => [k, Math.round(v)])) as Record<Klasifikasi, number>),
    };
  }).sort((a, b) => b.menggantung - a.menggantung || b.urgent - a.urgent || a.kapal.localeCompare(b.kapal, "id"));
}

export async function unduhExcel(baris: BarisMonitor[], harga: Record<string, number>, judul: string) {
  const isi = baris.map((b) => ({
    kapal: b.kapal, jenis: singkatJenis(b.jenis),
    dikirim: b.dikirimPada ? new Date(b.dikirimPada).toLocaleDateString("id-ID") : "",
    umur: b.umurHari, nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah, satuan: b.satuan,
    nilai: Math.round(nilaiBarang(b, harga)),
    prioritas: label(PRIORITAS, b.prioritas) + (b.prioritasSaran ? " (saran)" : ""),
    klasifikasi: label(KLASIFIKASI, b.klasifikasi) + (b.klasifikasiSaran ? " (saran)" : ""),
    keputusan: label(KEPUTUSAN, b.ev?.keputusan || ""),
    status: TAHAP[b.tahap as Tahap].label,
    pengadaan: b.pengadaan ? `${b.pengadaan.asal === "nonpr" ? "Non PR PO" : "SPPBJ"} ${b.pengadaan.nomor || ""}`.trim() : "",
    catatan: b.ev?.catatan || "", pic: b.ev?.pic || "", dimintaUlang: b.dimintaUlang, lk: b.adaLk,
    menggantung: b.menggantung, berkasUrl: b.berkasUrl, urgent: b.prioritas === "urgent",
  }));
  const r = await fetch("/api/permintaan/rekap-excel", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baris: isi, kapal: perKapal(baris, harga), label: judul }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d?.error || "Gagal menyusun Excel");
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Monitoring Permintaan Kapal - ${judul}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"); a.click();
  URL.revokeObjectURL(url);
}
