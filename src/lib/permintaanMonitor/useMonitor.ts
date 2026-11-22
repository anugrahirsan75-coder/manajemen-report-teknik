"use client";
/**
 * Data bersama halaman Monitoring Permintaan dan Dashboard Manajemen.
 *
 * Lima sumber dirangkai di peramban: kiriman ABK, hasil Juru Baca, permintaan
 * yang diinput kantor, penilaian kantor, dan pengadaan (SPPBJ / Non PR PO / SCM).
 *
 * Layar tidak menampilkan rupiah. Taksiran harga hanya dicari saat barang
 * dikirim ke borang SPPBJ (taksirUntukSppbj), supaya borang tidak kosong.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { muatBacaan } from "@/lib/lapor/simpananBacaan";
import type { BarisPermintaan } from "@/lib/lapor/skemaPermintaan";
import type { BerkasLapor, KirimanLapor } from "@/lib/lapor/types";
import { singkatJenis } from "@/lib/lapor/types";
import { Ringkasan, hargaLayak, ringkas, satuanEfektif, susunBaris } from "./logika";
import {
  hapusManual, ingatPenilai, jejakBaru, muatEval, muatManual, muatPengadaan, namaPenilai, simpanEval, simpanManual,
} from "./store";
import {
  AWALAN_MANUAL, BarisMonitor, EvalPermintaan, KEPUTUSAN, KIND_EVAL, KIND_MANUAL, KLASIFIKASI, PRIORITAS, Pengadaan,
  PermintaanManual, TAHAP, Tahap,
} from "./types";

export const KIND_RINGKAS = "permintaan_ringkas";

export type Patch = Partial<Pick<EvalPermintaan,
  "prioritas" | "klasifikasi" | "keputusan" | "catatan" | "pic" | "diterima" | "tautPengadaan">>;

export type BarangInput = PermintaanManual["baris"][number];

const LABEL_UBAH: Record<keyof Patch, string> = {
  prioritas: "prioritas", klasifikasi: "klasifikasi", keputusan: "keputusan", catatan: "catatan",
  pic: "PIC", diterima: "diterima", tautPengadaan: "tautan pengadaan",
};

const TANPA_HARGA: Record<string, number> = {};

export function evalBaru(b: BarisMonitor, oleh: string): EvalPermintaan {
  const kini = new Date().toISOString();
  return {
    kind: KIND_EVAL, kunci: b.kunci, fileId: b.fileId, kirimanId: b.kirimanId, kapal: b.kapal, jenis: b.jenis,
    periode: b.periode, dikirimPada: b.dikirimPada, nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah,
    satuan: b.satuan, prioritas: "", klasifikasi: "", keputusan: "", catatan: "", pic: "", diterima: "",
    tautPengadaan: "", tahapTerakhir: "", oleh, dibuatPada: kini, diubahPada: kini, jejak: [],
  };
}

const idAcak = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** berkas semu untuk barang input kantor — diperlakukan seperti satu berkas hasil baca */
const berkasManual = (p: PermintaanManual): BerkasLapor => ({
  nama: p.untukKiriman ? "Tambahan dari kantor" : (p.nomor || "Input kantor"),
  mime: "", ukuran: 0, fileId: AWALAN_MANUAL + p.id, url: "", diunggahPada: p.dibuatPada,
});

export function useMonitorPermintaan() {
  const [kirimanAsli, setKirimanAsli] = useState<KirimanLapor[]>([]);
  const [bacaanAsli, setBacaanAsli] = useState<Map<string, { baris: BarisPermintaan[]; status: string }>>(new Map());
  const [manual, setManual] = useState<PermintaanManual[]>([]);
  const idManual = useRef<Map<string, string>>(new Map());
  const [evals, setEvals] = useState<Map<string, EvalPermintaan>>(new Map());
  const idBaris = useRef<Map<string, string>>(new Map());
  const [pengadaan, setPengadaan] = useState<Pengadaan[]>([]);
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
      const [r, bc, ev, pg, mn] = await Promise.all([
        fetch("/api/lapor/daftar", { cache: "no-store" }).then((x) => x.json()),
        muatBacaan(), muatEval(), muatPengadaan(), muatManual(),
      ]);
      if (!r.ok) throw new Error(r.error || "Gagal memuat kiriman kapal");
      setKirimanAsli((r.baris as KirimanLapor[]).filter((k) => String(k.jenis).startsWith("permintaan")));
      const m = new Map<string, { baris: BarisPermintaan[]; status: string }>();
      bc.forEach((v, k) => m.set(k, { baris: v.bacaan.baris || [], status: v.bacaan.status }));
      setBacaanAsli(m);
      setEvals(ev.evals); idBaris.current = ev.idBaris;
      setPengadaan(pg);
      setManual(mn.daftar); idManual.current = mn.idBaris;
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);
  useEffect(() => { void ambil(); }, [ambil]);

  /*
   * Input kantor dirangkai sebagai kiriman biasa. Tambahan untuk kiriman yang
   * sudah ada menempel ke kiriman itu sebagai "berkas" tambahan — hasil baca
   * Juru Baca tidak pernah disentuh, jadi tak ada yang bisa tertimpa.
   */
  const kiriman = useMemo(() => {
    const salin = kirimanAsli.map((k) => ({ ...k, berkas: [...(k.berkas || [])] }));
    const perId = new Map(salin.map((k) => [k.id, k]));
    const baru: KirimanLapor[] = [];
    manual.forEach((p) => {
      const induk = p.untukKiriman ? perId.get(p.untukKiriman) : undefined;
      if (induk) { induk.berkas.push(berkasManual(p)); return; }
      baru.push({
        id: `manual-${p.id}`, kapal: p.kapal, jenis: p.jenis, periode: p.tanggal.slice(0, 7),
        pengirim: `Input kantor${p.oleh ? ` (${p.oleh})` : ""}`, jabatan: "", kontak: "", catatan: p.catatan,
        berkas: [berkasManual(p)], dikirimPada: `${p.tanggal}T00:00:00`, status: "dibaca", tindakLanjut: "", galatUnggah: "",
      } as unknown as KirimanLapor);
    });
    return [...salin, ...baru];
  }, [kirimanAsli, manual]);

  const bacaan = useMemo(() => {
    const m = new Map(bacaanAsli);
    manual.forEach((p) => m.set(AWALAN_MANUAL + p.id, { baris: p.baris, status: "selesai" }));
    return m;
  }, [bacaanAsli, manual]);

  /** status baca tiap berkas — dipakai layar untuk memberi tahu yang belum terbaca */
  const statusBerkas = useMemo(() => {
    const m = new Map<string, string>();
    bacaan.forEach((v, k) => m.set(k, v.status));
    return m;
  }, [bacaan]);

  const baris = useMemo(
    () => susunBaris({ kiriman, bacaan, evals, pengadaan, harga: TANPA_HARGA }),
    [kiriman, bacaan, evals, pengadaan]);

  const ringkasan: Ringkasan = useMemo(() => ringkas(baris, TANPA_HARGA), [baris]);

  /* ── simpan penilaian ───────────────────────────────────────────────────── */

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

  /** patch boleh berupa fungsi — tiap barang mendapat isian sendiri (mis. sarannya masing-masing) */
  const terapkan = useCallback((daftar: BarisMonitor[], patchAtauFn: Patch | ((b: BarisMonitor) => Patch)) => {
    if (!daftar.length) return;
    const oleh = penilai || "Kantor";
    const n = new Map(evalsRef.current);
    const tertulis: EvalPermintaan[] = [];
    daftar.forEach((b) => {
      const patch = typeof patchAtauFn === "function" ? patchAtauFn(b) : patchAtauFn;
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

  /**
   * Satu klik keputusan. Prioritas & klasifikasi yang belum diisi orang ikut
   * dikunci dari saran mesin saat itu juga — tanpa ini, barang yang disetujui
   * tetap berlabel "saran" dan orang harus mengonfirmasinya satu per satu.
   */
  const putuskan = useCallback((daftar: BarisMonitor[], keputusan: EvalPermintaan["keputusan"]) => {
    terapkan(daftar, (b) => ({
      keputusan,
      prioritas: b.ev?.prioritas || b.saranPrioritas,
      klasifikasi: b.ev?.klasifikasi || b.saranKlasifikasi,
    }));
  }, [terapkan]);

  /* ── input kantor ───────────────────────────────────────────────────────── */

  const simpanP = useCallback(async (p: PermintaanManual) => {
    setSimpanan((n) => n + 1);
    try {
      const id = await simpanManual(idManual.current.get(p.id) || null, p);
      idManual.current.set(p.id, id);
      setManual((d) => [...d.filter((x) => x.id !== p.id), p]);
    } catch (e: any) { setGalat(e?.message || String(e)); throw e; }
    finally { setSimpanan((n) => Math.max(0, n - 1)); }
  }, []);

  /** permintaan baru yang tidak datang lewat aplikasi (WA, kertas, telepon) */
  const buatPermintaan = useCallback(async (isi: {
    kapal: string; jenis: PermintaanManual["jenis"]; tanggal: string; nomor: string; catatan: string; baris: BarangInput[];
  }) => {
    const kini = new Date().toISOString();
    await simpanP({ kind: KIND_MANUAL, id: idAcak(), ...isi, oleh: penilai || "Kantor", dibuatPada: kini, diubahPada: kini });
  }, [penilai, simpanP]);

  /**
   * Barang terlewat untuk kiriman yang sudah ada. Semua tambahan satu kiriman
   * dikumpulkan dalam SATU catatan input kantor, supaya tidak berserakan.
   */
  const tambahBarang = useCallback(async (k: KirimanLapor, barang: BarangInput[]) => {
    if (!barang.length) return;
    const kini = new Date().toISOString();
    const idManualKiriman = k.id.startsWith("manual-") ? k.id.slice(7) : "";
    const ada = idManualKiriman
      ? manual.find((p) => p.id === idManualKiriman)
      : manual.find((p) => p.untukKiriman === k.id);
    if (ada) { await simpanP({ ...ada, baris: [...ada.baris, ...barang], diubahPada: kini }); return; }
    await simpanP({
      kind: KIND_MANUAL, id: idAcak(), kapal: k.kapal,
      jenis: (k.jenis === "permintaan_deck" ? "permintaan_deck" : "permintaan_mesin"),
      tanggal: (k.dikirimPada || kini).slice(0, 10), nomor: "", catatan: "", untukKiriman: k.id,
      baris: barang, oleh: penilai || "Kantor", dibuatPada: kini, diubahPada: kini,
    });
  }, [manual, penilai, simpanP]);

  /** hapus satu barang input kantor (barang hasil baca dikoreksi di layar Isi Permintaan) */
  const hapusBarangManual = useCallback(async (fileId: string, indeks: number) => {
    const id = fileId.slice(AWALAN_MANUAL.length);
    const p = manual.find((x) => x.id === id);
    if (!p) return;
    const sisa = p.baris.filter((_, i) => i !== indeks);
    if (!sisa.length) {
      const rid = idManual.current.get(id);
      if (rid) await hapusManual(rid);
      idManual.current.delete(id);
      setManual((d) => d.filter((x) => x.id !== id));
      return;
    }
    await simpanP({ ...p, baris: sisa, diubahPada: new Date().toISOString() });
  }, [manual, simpanP]);

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
    muat, galat, baris, ringkasan, kiriman, statusBerkas, pengadaan, penilai, gantiPenilai, sibukSimpan: simpanan > 0,
    muatUlang: ambil, terapkan, putuskan, buatPermintaan, tambahBarang, hapusBarangManual,
  };
}

/* ── taksiran harga khusus borang SPPBJ (tidak ditampilkan di layar) ─────── */

export async function taksirUntukSppbj(daftar: BarisMonitor[]): Promise<Record<string, number>> {
  const keluar: Record<string, number> = {};
  for (let n = 0; n < daftar.length; n += 150) {
    const potong = daftar.slice(n, n + 150);
    try {
      const r = await fetch("/api/harga/cocok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: potong.map((b) => ({ id: b.kunci, teks: `${b.nama} ${b.spesifikasi}`.trim() })) }),
      });
      const d = await r.json();
      potong.forEach((b) => { keluar[b.kunci] = d?.ok ? hargaLayak(satuanEfektif(b), d.hasil?.[b.kunci]) : 0; });
    } catch { /* tanpa taksiran — harga diisi di borang */ }
  }
  return keluar;
}

/* ── ekspor ke Excel ────────────────────────────────────────────────────── */

const label = <T extends { id: string; label: string }>(daftar: T[], id: string) => daftar.find((x) => x.id === id)?.label || "";

export function perKapal(baris: BarisMonitor[]) {
  const m = new Map<string, BarisMonitor[]>();
  baris.forEach((b) => m.set(b.kapal, [...(m.get(b.kapal) || []), b]));
  return Array.from(m.entries()).map(([kapal, d]) => {
    const r = ringkas(d, TANPA_HARGA);
    return {
      kapal, total: r.total, terbuka: r.terbuka, belum: r.belumDievaluasi, urgent: r.urgentTerbuka,
      menggantung: r.menggantung, proses: r.prosesPengadaan, selesai: r.selesai,
      mesin: d.filter((b) => !b.jenis.endsWith("deck")).length, deck: d.filter((b) => b.jenis.endsWith("deck")).length,
    };
  }).sort((a, b) => b.menggantung - a.menggantung || b.urgent - a.urgent || a.kapal.localeCompare(b.kapal, "id"));
}

export async function unduhExcel(baris: BarisMonitor[], judul: string) {
  const isi = [...baris].sort((a, b) => (b.dikirimPada || "").localeCompare(a.dikirimPada || "") || a.kapal.localeCompare(b.kapal, "id"))
    .map((b) => ({
      kapal: b.kapal, jenis: singkatJenis(b.jenis),
      dikirim: b.dikirimPada ? new Date(b.dikirimPada).toLocaleDateString("id-ID") : "",
      umur: b.umurHari, nama: b.nama, spesifikasi: b.spesifikasi, jumlah: b.jumlah, satuan: b.satuan,
      prioritas: label(PRIORITAS, b.prioritas) + (b.prioritasSaran ? " (saran)" : ""),
      klasifikasi: label(KLASIFIKASI, b.klasifikasi) + (b.klasifikasiSaran ? " (saran)" : ""),
      keputusan: label(KEPUTUSAN, b.ev?.keputusan || ""),
      status: TAHAP[b.tahap as Tahap].label,
      pengadaan: b.pengadaan ? `${b.pengadaan.asal === "nonpr" ? "Non PR PO" : "SPPBJ"} ${b.pengadaan.nomor || ""}`.trim() : "",
      catatan: b.ev?.catatan || "", pic: b.ev?.pic || "", dimintaUlang: b.dimintaUlang, lk: b.adaLk,
      menggantung: b.menggantung, berkasUrl: b.berkasUrl, urgent: b.prioritas === "urgent",
      sumber: b.fileId.startsWith(AWALAN_MANUAL) ? "Input kantor" : "Kiriman kapal",
    }));
  const r = await fetch("/api/permintaan/rekap-excel", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baris: isi, kapal: perKapal(baris), label: judul }),
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
