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
const KINDS = ["rr", "docking_jadwal", "kelas_bki", "servis", "kerusakan", "anggaran"];

const isoDari = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function usePengingat() {
  const ready = isSupabaseReady;
  const [list, setList] = useState<Pengingat[]>([]);
  const [loading, setLoading] = useState(false);
  const [waktu, setWaktu] = useState<string>("");

  useEffect(() => {
    try { const a = localStorage.getItem(LS); if (a) setList(JSON.parse(a)); } catch {}
  }, []);

  const muat = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("projects").select("id,payload")
        .or(KINDS.map((k) => `payload->>kind.eq.${k}`).join(","));
      const rows = (data || []).map((r: any) => r.payload).filter(Boolean);
      const hasil = susun(rows);
      setList(hasil);
      setWaktu(new Date().toLocaleTimeString("id-ID"));
      try { localStorage.setItem(LS, JSON.stringify(hasil)); } catch {}
    } catch {
      /* diam: lonceng tak boleh merusak halaman */
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  return { ready, loading, list, waktu, muatUlang: muat };
}

/** ubah baris payload menjadi daftar pengingat */
function susun(rows: any[]): Pengingat[] {
  const now = new Date();
  const hariIni = isoHariIni(now);
  const out: Pengingat[] = [];
  const tambah = (p: Omit<Pengingat, "tingkat"> & { tingkat?: Pengingat["tingkat"] }) =>
    out.push({ ...p, tingkat: p.tingkat ?? tingkatDariSisa(p.sisaHari) } as Pengingat);

  const rr = rows.filter((r) => r.kind === "rr").map((r) => r.doc).filter(Boolean);
  const dok = rows.filter((r) => r.kind === "docking_jadwal").map((r) => r.doc).filter(Boolean);
  const kelas = rows.filter((r) => r.kind === "kelas_bki").map((r) => r.doc).filter(Boolean);
  const servis = rows.filter((r) => r.kind === "servis");
  const rusak = rows.filter((r) => r.kind === "kerusakan").map((r) => r.doc).filter(Boolean);
  const anggaran = rows.find((r) => r.kind === "anggaran");

  // ---------- 1. Lampiran 3: rencana & realisasi ----------
  const per = periodeAktif(now);
  [per.mulai, per.akhir].forEach((bulan) => {
    const belum = KAPAL_ANGGARAN.filter((k) =>
      !rr.some((d: any) => d.tipe === "rencana" && d.bulan === bulan && d.status === "terkirim"));
    if (!belum.length) return;
    const sisa = selisihHari(hariIni, isoDari(tenggatRencana(bulan)));
    tambah({
      id: `rr-rencana-${bulan}`, modul: "Rencana & Realisasi", ikon: "📆",
      judul: `Rencana ${namaBulan(bulan)} — ${belum.length} kapal belum dikirim`,
      rincian: belum.slice(0, 6).map(ringkasKapal).join(", ") + (belum.length > 6 ? `, +${belum.length - 6}` : ""),
      tenggat: isoDari(tenggatRencana(bulan)), sisaHari: sisa, href: "/rencana",
    });
  });
  const bulanReal = bulanRealisasiAktif(now);
  const belumReal = KAPAL_ANGGARAN.filter((k) =>
    !rr.some((d: any) => d.tipe === "realisasi" && d.bulan === bulanReal && d.status === "terkirim"));
  if (belumReal.length) {
    const t = isoDari(tenggatRealisasi(bulanReal));
    tambah({
      id: `rr-realisasi-${bulanReal}`, modul: "Rencana & Realisasi", ikon: "✅",
      judul: `Realisasi ${namaBulan(bulanReal)} — ${belumReal.length} kapal belum dikirim`,
      rincian: belumReal.slice(0, 6).map(ringkasKapal).join(", ") + (belumReal.length > 6 ? `, +${belumReal.length - 6}` : ""),
      tenggat: t, sisaHari: selisihHari(hariIni, t), href: "/rencana",
    });
  }
  // dokumen realisasi yang isinya masih kosong padahal bulannya sudah lewat
  const kosong = rr.filter((d: any) => d.tipe === "realisasi" && d.bulan < bulanReal
    && d.status !== "terkirim" && totalDoc(d).total <= 0);
  if (kosong.length) {
    tambah({
      id: "rr-kosong", modul: "Rencana & Realisasi", ikon: "📭", tingkat: "info",
      judul: `${kosong.length} dokumen realisasi bulan lalu masih kosong`,
      rincian: kosong.slice(0, 5).map((d: any) => `${ringkasKapal(d.kapal)} ${namaBulan(d.bulan)}`).join(", "),
      href: "/rencana",
    });
  }

  // ---------- 2. Termin pembayaran docking ----------
  dok.forEach((d: any) => {
    ringkasTermin(d, now).forEach((t) => {
      if (t.status === "dibayar" || t.status === "belum_siap") return;
      const acuan = t.tanggalPemicu || t.perkiraan;
      const sisa = acuan ? selisihHari(hariIni, acuan) : null;
      tambah({
        id: `termin-${d.id}-${t.ke}`, modul: "Termin Docking", ikon: "💰",
        tingkat: t.status === "terlambat" ? "lewat" : t.status === "siap" ? "mendesak" : tingkatDariSisa(sisa),
        judul: `${t.label} ${ringkasKapal(d.kapal)} belum tercatat dibayar`,
        rincian: t.tanggalPemicu
          ? `${t.baLabel} terbit ${t.tanggalPemicu}`
          : `${t.baLabel} diperkirakan ${t.perkiraan || "-"}`,
        tenggat: acuan, sisaHari: sisa, href: "/docking",
      });
    });
  });

  // ---------- 3. Docking: lewat target & berkas BA belum lengkap ----------
  dok.forEach((d: any) => {
    const r = ringkasDocking(d, now);
    if (r.status === "berjalan" && r.target && (r.berjalan ?? 0) > r.target) {
      tambah({
        id: `dock-lewat-${d.id}`, modul: "Monitoring Docking", ikon: "⚓", tingkat: "lewat",
        judul: `${ringkasKapal(d.kapal)} masih docking, sudah lewat target`,
        rincian: `berjalan ${r.berjalan} hari dari target ${r.target} hari`,
        sisaHari: r.target - (r.berjalan ?? 0), href: "/docking",
      });
    }
    const kurang = JENIS_BA.filter((j) => j.key !== "lain" && j.tahap && (d as any)[j.tahap]
      && !(d.berkas || []).some((b: any) => b.jenis === j.key));
    if (kurang.length) {
      tambah({
        id: `dock-ba-${d.id}`, modul: "Monitoring Docking", ikon: "📄", tingkat: "info",
        judul: `${ringkasKapal(d.kapal)} — ${kurang.length} berkas BA belum diunggah`,
        rincian: kurang.map((j) => j.label.replace(/^BA /, "")).join(", "),
        href: "/docking",
      });
    }
  });

  // ---------- 4. Kelas BKI ----------
  kelas.forEach((k: any) => {
    if (k.status === "selesai") return;
    const acuan = k.dueDate || k.rentangSampai;
    if (!acuan) return;
    const sisa = selisihHari(hariIni, acuan);
    if (sisa != null && sisa > 60) return;      // masih jauh, jangan berisik
    tambah({
      id: `kelas-${k.id}`, modul: "Kelas BKI", ikon: "🏷️",
      judul: `${k.jenis} ${ringkasKapal(k.kapal)} belum selesai`,
      rincian: k.dueDate ? `jatuh tempo ${k.dueDate}` : `jendela survey berakhir ${k.rentangSampai}`,
      tenggat: acuan, sisaHari: sisa, href: "/docking",
    });
  });

  // ---------- 5. Servis bengkel ----------
  servis.forEach((s: any) => {
    if (!s.id || s.status === "kembali" || s.tanggalKembali) return;
    if (s.tanggalEstimasi) {
      const sisa = selisihHari(hariIni, s.tanggalEstimasi);
      if (sisa != null && sisa > 7) return;
      tambah({
        id: `servis-${s.id}`, modul: "Monitoring Servis", ikon: "🔧",
        judul: `${s.namaBarang} (${ringkasKapal(s.kapal || "")}) belum kembali dari bengkel`,
        rincian: `${s.bengkel || "bengkel"} · estimasi ${s.tanggalEstimasi}`,
        tenggat: s.tanggalEstimasi, sisaHari: sisa, href: "/servis",
      });
      return;
    }
    const lama = s.tanggalKirim ? selisihHari(s.tanggalKirim, hariIni) : null;
    if (lama != null && lama >= 30) {
      tambah({
        id: `servis-${s.id}`, modul: "Monitoring Servis", ikon: "🔧", tingkat: "lewat",
        judul: `${s.namaBarang} (${ringkasKapal(s.kapal || "")}) sudah ${lama} hari di bengkel`,
        rincian: `${s.bengkel || "bengkel"} · tanpa tanggal estimasi selesai`,
        sisaHari: -lama, href: "/servis",
      });
    }
  });

  // ---------- 6. Kerusakan kapal ----------
  const terbuka = rusak.filter((k: any) => k.status === "terbuka");
  if (terbuka.length) {
    tambah({
      id: "rusak-terbuka", modul: "Rekap Kerusakan", ikon: "🛠️", tingkat: "mendesak",
      judul: `${terbuka.length} kerusakan belum ditangani`,
      rincian: terbuka.slice(0, 4).map((k: any) => `${ringkasKapal(k.kapal)}: ${k.kejadian}`).join(" · "),
      href: "/kerusakan",
    });
  }
  const proses = rusak.filter((k: any) => k.status === "proses");
  if (proses.length) {
    tambah({
      id: "rusak-proses", modul: "Rekap Kerusakan", ikon: "🛠️", tingkat: "info",
      judul: `${proses.length} kerusakan sedang ditangani`,
      rincian: proses.slice(0, 4).map((k: any) => ringkasKapal(k.kapal)).join(", "),
      href: "/kerusakan",
    });
  }

  // ---------- 7. Pagu Rutin bulan berikutnya ----------
  if (anggaran) {
    const plafon: any[] = anggaran.plafon || [];
    const dep = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const bulanDepan = `${dep.getFullYear()}-${String(dep.getMonth() + 1).padStart(2, "0")}`;
    if (!plafon.some((p) => p.bulan === bulanDepan && (p.rows || []).length)) {
      const t = isoDari(new Date(now.getFullYear(), now.getMonth(), 25));
      tambah({
        id: `pagu-${bulanDepan}`, modul: "Anggaran Rutin", ikon: "🧭",
        judul: `Pagu Rutin ${namaBulan(bulanDepan)} belum diisi`,
        rincian: "isi pagunya supaya realisasi bulan depan punya pembanding",
        tenggat: t, sisaHari: selisihHari(hariIni, t), href: "/dashboard?v=rutin",
      });
    }
  }

  return out.sort(urutPengingat);
}
