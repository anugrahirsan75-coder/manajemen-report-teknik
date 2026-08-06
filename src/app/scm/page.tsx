"use client";
/**
 * Halaman kerja SCM.
 *
 * SPPBJ yang dikirim Teknik masuk sendiri ke antrean di sini — tidak ada yang
 * perlu diketik ulang. Tiap perpindahan tahap dicatat jamnya, sehingga
 * pertanyaan "kenapa lama" terjawab angka, bukan ingatan.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSppbj } from "@/lib/sppbj/store";
import { totalSppbj, adaHargaSpbj, totalSpbj } from "@/lib/sppbj/types";
import { rupiah, tanggalIndo } from "@/lib/format";
import { kapalDariItems } from "@/components/KapalCell";
import BilahScm from "@/components/scm/BilahScm";
import TabelNego, { BarisNego } from "@/components/scm/TabelNego";
import { nomorDokumen } from "@/lib/scm/nomor";
import { ISIAN_TAHAP, MedanTahap, kurangIsian, perluHargaNego } from "@/lib/scm/tahapIsian";
import {
  BarisScm, majuTahap, muatProses, muatVendor, prosesBaru, simpanProses,
} from "@/lib/scm/store";
import {
  ItemNego, LABEL_TAHAP, ProsesScm, TahapScm, TINDAKAN_TAHAP, URUT_TAHAP, Vendor, WARNA_TAHAP,
  lamaPerTahap, tahapBerikut, tertahan, totalHari, umurTahap,
} from "@/lib/scm/types";

export default function HalamanScm() {
  const { listRemote } = useSppbj();
  const [sppbj, setSppbj] = useState<any[]>([]);
  const [proses, setProses] = useState<BarisScm[]>([]);
  const [vendor, setVendor] = useState<Vendor[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [saring, setSaring] = useState<"aktif" | "tertahan" | "selesai" | "semua">("aktif");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<string | null>(null);   // sppbjId yang sedang dibuka

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const [a, b, v] = await Promise.all([listRemote(), muatProses(), muatVendor()]);
      setSppbj(a || []); setProses(b); setVendor(v.daftar);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, [listRemote]);

  useEffect(() => { void ambil(); }, [ambil]);

  const beritahu = (t: string) => { setPesan(t); window.setTimeout(() => setPesan(""), 4000); };

  /** SPPBJ yang sudah dikirim Teknik ke SCM + prosesnya (bila sudah ada) */
  const antrean = useMemo(() => {
    const petaProses = new Map(proses.map((p) => [p.proses.sppbjId, p]));
    return sppbj
      .filter((r) => r.payload?.keScm || petaProses.has(r.id))
      .map((r) => {
        const item = r.payload?.items || [];
        return {
          id: r.id, nama: r.nama_pengadaan || "(tanpa nama)",
          nomor: r.payload?.noSPPBJ || r.payload?.noKontrak || "-",
          tanggal: r.payload?.tanggal || "",
          kapal: kapalDariItems(item).join(", "),
          nilai: totalSppbj(item),
          nilaiFinal: adaHargaSpbj(item) ? totalSpbj(item) : 0,
          dikirim: r.payload?.keScm || "",
          baris: petaProses.get(r.id) || null,
          payload: r.payload,
        };
      })
      .sort((a, b) => (b.dikirim || b.tanggal).localeCompare(a.dikirim || a.tanggal));
  }, [sppbj, proses]);

  const tampil = antrean.filter((a) => {
    const p = a.baris?.proses;
    const cocokSaring =
      saring === "semua" ? true
        : saring === "selesai" ? p?.tahap === "selesai"
          : saring === "tertahan" ? !!p && tertahan(p)
            : p?.tahap !== "selesai";
    const q = cari.trim().toLowerCase();
    const cocokCari = !q || `${a.nama} ${a.nomor} ${a.kapal}`.toLowerCase().includes(q);
    return cocokSaring && cocokCari;
  });

  const jmlTertahan = antrean.filter((a) => a.baris && tertahan(a.baris.proses)).length;
  const jmlBaru = antrean.filter((a) => !a.baris).length;

  /** terima SPPBJ ke antrean kerja (membuat catatan prosesnya) */
  const terima = async (sppbjId: string) => {
    try {
      const p = prosesBaru(sppbjId, "SCM");
      const id = await simpanProses(null, p);
      setProses((l) => [{ id, proses: p }, ...l]);
      beritahu("Pengadaan diterima di SCM. Tahap: Masuk SCM.");
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  const naik = async (b: BarisScm, ke: TahapScm) => {
    try {
      const p = majuTahap(b.proses, ke, "SCM");
      await simpanProses(b.id, p);
      setProses((l) => l.map((x) => (x.id === b.id ? { ...x, proses: p } : x)));
      beritahu(`Tahap diperbarui: ${LABEL_TAHAP[ke]}.`);
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  const simpanIsian = async (b: BarisScm, patch: Partial<ProsesScm>) => {
    try {
      const p = { ...b.proses, ...patch };
      await simpanProses(b.id, p);
      setProses((l) => l.map((x) => (x.id === b.id ? { ...x, proses: p } : x)));
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <BilahScm aksi={
        <button onClick={ambil} disabled={muat}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 disabled:opacity-50">
          {muat ? "Memuat…" : "↻ Muat ulang"}
        </button>
      } />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-slate-500">SPPBJ dari Teknik masuk sendiri ke sini. Tiap tahap dicatat jamnya.</p>

      {pesan && <div className="anim-in mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">✓ {pesan}</div>}
      {galat && <div className="anim-in mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}

      {/* ── ringkasan cepat ─────────────────────────────────────────────── */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Angka label="Di antrean" nilai={antrean.filter((a) => a.baris?.proses.tahap !== "selesai").length} warna="text-slate-800" />
        <Angka label="Belum diterima" nilai={jmlBaru} warna="text-sky-700" sub="SPPBJ baru dari Teknik" />
        <Angka label="Tertahan" nilai={jmlTertahan} warna="text-rose-700" sub="melewati lama wajar tahapnya" />
        <Angka label="Selesai" nilai={antrean.filter((a) => a.baris?.proses.tahap === "selesai").length} warna="text-emerald-700" />
      </section>

      {/* ── saringan ────────────────────────────────────────────────────── */}
      <section className="mt-5 flex flex-wrap items-center gap-2">
        {([["aktif", "Sedang berjalan"], ["tertahan", `Tertahan (${jmlTertahan})`], ["selesai", "Selesai"], ["semua", "Semua"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSaring(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition ${
              saring === k ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>
            {l}
          </button>
        ))}
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari judul / nomor / kapal…"
          className="ml-auto w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-sky-400" />
      </section>

      {/* ── daftar ──────────────────────────────────────────────────────── */}
      <section className="mt-4 space-y-2.5">
        {muat && <p className="py-8 text-center text-sm text-slate-400">Memuat antrean…</p>}
        {!muat && !tampil.length && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
            Belum ada pengadaan pada saringan ini. SPPBJ akan muncul di sini begitu Teknik menekan “Kirim ke SCM”.
          </p>
        )}
        {tampil.map((a) => (
          <KartuPengadaan key={a.id} a={a} vendor={vendor} dibuka={buka === a.id}
            onBuka={() => setBuka(buka === a.id ? null : a.id)}
            onTerima={() => terima(a.id)}
            onNaik={(ke) => a.baris && naik(a.baris, ke)}
            onSimpan={(patch) => a.baris && simpanIsian(a.baris, patch)} />
        ))}
        </section>
      </main>
    </div>
  );
}

function Angka({ label, nilai, warna, sub }: { label: string; nilai: number; warna: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold ${warna}`}>{nilai}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

/** satu pengadaan: ringkas saat tertutup, penuh dengan isian saat dibuka */
function KartuPengadaan({ a, vendor, dibuka, onBuka, onTerima, onNaik, onSimpan }: {
  a: any; vendor: Vendor[]; dibuka: boolean;
  onBuka: () => void; onTerima: () => void;
  onNaik: (ke: TahapScm) => void; onSimpan: (patch: Partial<ProsesScm>) => void;
}) {
  const p: ProsesScm | undefined = a.baris?.proses;
  const macet = p ? tertahan(p) : false;
  const berikut = p ? tahapBerikut(p.tahap) : null;
  // tahap hanya boleh maju kalau isian tahap ini sudah lengkap — jam perpindahan
  // itulah bukti lama proses, jadi tak boleh dilompati saat datanya belum ada
  const adaNego = !!(p?.itemNego || []).length;
  const kurangTahap = p ? kurangIsian(p, p.tahap, adaNego) : [];
  const siapLanjut = kurangTahap.length === 0;

  return (
    <article className={`rounded-2xl bg-white shadow-sm ring-1 transition ${macet ? "ring-rose-300" : "ring-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={onBuka} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            {p ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${WARNA_TAHAP[p.tahap]}`}>
                {LABEL_TAHAP[p.tahap]}
              </span>
            ) : (
              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold text-white">BARU</span>
            )}
            {macet && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 ring-1 ring-rose-200">TERTAHAN {umurTahap(p!)} HARI</span>}
            <span className="text-[11px] tabular-nums text-slate-400">{a.nomor}</span>
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-800">{a.nama}</p>
          <p className="text-[11px] text-slate-500">
            {a.kapal || "—"} · SPPBJ {a.tanggal ? tanggalIndo(a.tanggal) : "—"} · {rupiah(a.nilai)}
            {p && <> · di SCM {totalHari(p)} hari</>}
          </p>
        </button>
        {!p ? (
          <button onClick={onTerima} className="btn btn-primary text-xs">✓ Terima</button>
        ) : berikut ? (
          <button onClick={() => (siapLanjut ? onNaik(berikut) : onBuka())}
            title={siapLanjut ? TINDAKAN_TAHAP[p.tahap] : `Lengkapi dulu: ${kurangTahap.join(", ")}`}
            className={`btn text-xs ${siapLanjut ? "btn-success" : "btn-ghost"}`}>
            {siapLanjut ? `Lanjut → ${LABEL_TAHAP[berikut]}` : `Isi dulu (${kurangTahap.length})`}
          </button>
        ) : null}
        <button onClick={onBuka} className="btn btn-ghost text-xs">{dibuka ? "Tutup" : "Rincian"}</button>
      </div>

      {dibuka && (
        <div className="border-t border-slate-100 px-4 py-4">
          {!p ? (
            <p className="text-sm text-slate-500">
              Pengadaan ini belum diterima. Tekan <b>Terima</b> supaya masuk hitungan lama proses SCM.
            </p>
          ) : (
            <RincianProses a={a} p={p} vendor={vendor} onNaik={onNaik} onSimpan={onSimpan} />
          )}
        </div>
      )}
    </article>
  );
}

function RincianProses({ a, p, vendor, onNaik, onSimpan }: {
  a: any; p: ProsesScm; vendor: Vendor[];
  onNaik: (ke: TahapScm) => void; onSimpan: (patch: Partial<ProsesScm>) => void;
}) {
  const [draf, setDraf] = useState<Partial<ProsesScm>>({});
  const [semuaIsian, setSemuaIsian] = useState(false);
  const [unduh, setUnduh] = useState(false);
  const [galat, setGalat] = useState("");
  const nilai = <K extends keyof ProsesScm>(k: K): any => (draf as any)[k] ?? (p as any)[k] ?? "";
  const ubah = (k: keyof ProsesScm, v: any) => setDraf((d) => ({ ...d, [k]: v }));
  const lama = lamaPerTahap(p);
  const v = vendor.find((x) => x.id === nilai("vendorId"));

  /**
   * Baris negosiasi dirakit dari item SPPBJ-nya sendiri, bukan disalin ke
   * catatan SCM. Yang disimpan hanya HARGA HASIL NEGO tiap baris — kalau
   * itemnya diperbaiki di sisi Teknik, yang terbaca di sini ikut benar.
   */
  const itemAsli: any[] = a.payload?.items || [];
  const negoTersimpan: Record<number, number> = {};
  ((nilai("itemNego") as ItemNego[]) || []).forEach((x) => {
    if (typeof x?.hargaNego === "number") negoTersimpan[x.idx] = x.hargaNego;
  });
  const adaHargaNego = Object.keys(negoTersimpan).length > 0;
  const potongan = Number(nilai("potonganPersen")) || 0;
  const barisNego: BarisNego[] = itemAsli.map((it, i) => ({
    idx: i,
    kapal: String(it.kapal || "").trim(),
    nama: String(it.nama || ""),
    spesifikasi: String(it.spesifikasi || ""),
    jumlah: Number(it.jumlah) || 0,
    satuan: String(it.satuan || ""),
    harga: Number(it.harga) || 0,
    hargaNego: negoTersimpan[i] ?? Math.round((Number(it.harga) || 0) * (1 - potongan / 100)),
  }));

  const setHarga = (idx: number, harga: number) => {
    const peta = { ...negoTersimpan, [idx]: harga };
    ubah("itemNego", Object.entries(peta).map(([k, val]) => ({ idx: Number(k), hargaNego: val })));
  };
  const potongRata = (persen: number) => {
    setDraf((d) => ({
      ...d,
      potonganPersen: persen,
      itemNego: itemAsli.map((it, i) => ({
        idx: i, hargaNego: Math.round((Number(it.harga) || 0) * (1 - persen / 100)),
      })),
    }));
  };

  const nomor = nomorDokumen(
    String(nilai("noInisiasi")), String(nilai("tglInisiasi")),
    String(nilai("tglNego")), String(nilai("tglBahp")), String(nilai("tglSpbj")));

  /** keadaan setelah draf digabung — dipakai memeriksa kelengkapan tahap ini */
  const gabung: ProsesScm = { ...p, ...draf };
  const kurang = kurangIsian(gabung, p.tahap, adaHargaNego);
  const berikut = tahapBerikut(p.tahap);
  const bolehLanjut = kurang.length === 0;

  const simpan = () => { onSimpan(draf); setDraf({}); };
  const simpanLalu = () => {
    if (Object.keys(draf).length) onSimpan(draf);
    setDraf({});
    if (berikut) window.setTimeout(() => onNaik(berikut), 60);
  };

  const unduhExcel = async () => {
    setGalat(""); setUnduh(true);
    try {
      const badan = {
        namaPengadaan: a.nama, noSppbj: a.nomor, tglSppbj: a.tanggal, user: "Divisi Teknik",
        items: itemAsli.map((it, i) => ({
          kapal: String(it.kapal || ""), keterangan: String(it.keterangan || ""),
          nama: String(it.nama || ""), spesifikasi: String(it.spesifikasi || ""),
          jumlah: Number(it.jumlah) || 0, satuan: String(it.satuan || ""),
          harga: Number(it.harga) || 0, hargaNego: barisNego[i]?.hargaNego,
        })),
        noInisiasi: String(nilai("noInisiasi")), tglInisiasi: String(nilai("tglInisiasi")),
        vendor: {
          nama: v?.nama || "", pimpinan: v?.pimpinan || "", jabatan: v?.jabatan || "Direktur",
          telepon: v?.telepon || "", fax: v?.fax || "", npwp: v?.npwp || "",
          alamat: v?.alamat || "", kota: v?.kota || "",
        },
        noPenawaran: String(nilai("noPenawaran")), tglPenawaran: String(nilai("tglPenawaran")),
        tglNego: String(nilai("tglNego")), jamNego: String(nilai("jamNego") || "14.00 WIT"),
        tglBahp: String(nilai("tglBahp") || nilai("tglNego")), jamBahp: String(nilai("jamBahp") || "15.00 WIT"),
        tglSpbj: String(nilai("tglSpbj")), hariPenyerahan: Number(nilai("hariPenyerahan")) || 7,
        lokasi: "Ternate",
      };
      const r = await fetch("/api/scm/excel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = String(a.nama).replace(/[\\/:*?"<>|]/g, "-").slice(0, 90) + ".xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setUnduh(false); }
  };

  const medanTahapIni = ISIAN_TAHAP[p.tahap];
  const medanLain = (Object.keys(ISIAN_TAHAP) as TahapScm[])
    .filter((t) => t !== p.tahap)
    .flatMap((t) => ISIAN_TAHAP[t].map((m) => ({ ...m, tahap: t })));

  return (
    <div className="space-y-5">
      {/* jejak waktu */}
      <div>
        <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Perjalanan dokumen</p>
        <div className="flex flex-wrap gap-1.5">
          {URUT_TAHAP.map((t) => {
            const lewat = URUT_TAHAP.indexOf(t) <= URUT_TAHAP.indexOf(p.tahap);
            const kini = t === p.tahap;
            const hari = lama.filter((x) => x.tahap === t).reduce((s, x) => s + x.hari, 0);
            return (
              <span key={t} className={`rounded-lg px-2 py-1 text-[10px] font-bold ring-1 ${
                kini ? "bg-slate-900 text-white ring-slate-900"
                  : lewat ? WARNA_TAHAP[t] : "bg-white text-slate-300 ring-slate-200"}`}>
                {LABEL_TAHAP[t]}{lewat && hari > 0 ? ` · ${hari}h` : ""}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── isian TAHAP INI saja ─────────────────────────────────────────── */}
      <section className="rounded-2xl bg-sky-50/60 p-4 ring-1 ring-sky-200">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
            LANGKAH {URUT_TAHAP.indexOf(p.tahap) + 1}/{URUT_TAHAP.length}
          </span>
          <b className="text-sm text-slate-800">{TINDAKAN_TAHAP[p.tahap]}</b>
        </div>

        {medanTahapIni.length === 0 && !perluHargaNego(p.tahap) ? (
          <p className="text-[13px] text-slate-600">
            {p.tahap === "selesai"
              ? "Pengadaan ini sudah tuntas — tidak ada isian lagi."
              : "Tidak ada isian pada langkah ini. Lanjutkan bila pekerjaannya sudah dilakukan."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {medanTahapIni.map((m) => (
              <MedanIsianScm key={String(m.id)} m={m} nilai={nilai(m.id)} vendor={vendor}
                onUbah={(val) => ubah(m.id, val)} />
            ))}
          </div>
        )}

        {v && p.tahap === "undangan" && (
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
            {v.pimpinan} ({v.jabatan}) · {v.kota} {v.npwp ? `· NPWP ${v.npwp}` : ""} {v.telepon ? `· ${v.telepon}` : ""}
          </p>
        )}

        {perluHargaNego(p.tahap) && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Harga setelah negosiasi ({itemAsli.length} item)
            </p>
            {itemAsli.length ? (
              <TabelNego baris={barisNego} onUbah={setHarga} onPotongRata={potongRata} />
            ) : (
              <p className="rounded-xl bg-white px-3 py-2 text-[11px] text-slate-500 ring-1 ring-slate-200">
                SPPBJ ini belum punya item.
              </p>
            )}
          </div>
        )}

        {kurang.length > 0 && (
          <p className="mt-3 text-[11px] font-semibold text-amber-700">
            Belum lengkap untuk lanjut: {kurang.join(", ")}.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={simpan} disabled={!Object.keys(draf).length}
            className="btn btn-ghost text-xs disabled:opacity-40">💾 Simpan</button>
          {berikut && (
            <button onClick={simpanLalu} disabled={!bolehLanjut}
              title={bolehLanjut ? "" : `Lengkapi dulu: ${kurang.join(", ")}`}
              className="btn btn-success text-xs disabled:opacity-40">
              Simpan &amp; lanjut → {LABEL_TAHAP[berikut]}
            </button>
          )}
        </div>
      </section>

      {/* nomor dokumen — muncul begitu nomor inisiasi terisi */}
      {nomor.undangan && (
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            Nomor dokumen (dari 4 angka pertama nomor inisiasi)
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <NomorSalin label="Undangan" nilai={nomor.undangan} />
            <NomorSalin label="Jadwal" nilai={nomor.jadwal} />
            <NomorSalin label="BA Negosiasi" nilai={nomor.baNego} />
            <NomorSalin label="BAHP" nilai={nomor.bahp} />
            <NomorSalin label="SPBJ" nilai={nomor.spbj} />
          </div>
        </div>
      )}

      {/* isian langkah lain — tertutup, dibuka hanya untuk memperbaiki */}
      <div>
        <button onClick={() => setSemuaIsian((x) => !x)}
          className="text-[11px] font-bold text-sky-700 hover:underline">
          {semuaIsian ? "▾ Sembunyikan isian langkah lain" : "▸ Buka isian langkah lain (untuk memperbaiki)"}
        </button>
        {semuaIsian && (
          <div className="mt-2 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-2">
            {medanLain.map((m) => (
              <MedanIsianScm key={String(m.id)} m={m} nilai={nilai(m.id)} vendor={vendor}
                jejak={LABEL_TAHAP[m.tahap]} onUbah={(val) => ubah(m.id, val)} />
            ))}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Catatan</label>
              <textarea value={nilai("catatan")} onChange={(e) => ubah("catatan", e.target.value)} rows={2}
                placeholder="mis. menunggu revisi spesifikasi dari Teknik"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-sky-400" />
            </div>
          </div>
        )}
      </div>

      {galat && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button onClick={unduhExcel} disabled={unduh || !itemAsli.length} className="btn btn-primary text-xs disabled:opacity-40"
          title="Berkas 12 sheet: DATA, DATA VENDOR, SPPBJ, DKP, JADWAL, UNDANGAN, LAMP UNDANGAN, BA NEGO, LAMPIRAN NEGO, SPBJ, BAHP, SPBJ BARU">
          {unduh ? "Menyusun…" : "⬇ Unduh berkas pengadaan (Excel)"}
        </button>
        <select value="" onChange={(e) => e.target.value && onNaik(e.target.value as TahapScm)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs" title="Pindah tahap tanpa urutan — untuk membetulkan pencatatan">
          <option value="">Pindahkan ke tahap…</option>
          {URUT_TAHAP.map((t) => <option key={t} value={t}>{LABEL_TAHAP[t]}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-slate-400">Total {totalHari(p)} hari sejak masuk SCM</span>
      </div>
      {Object.keys(draf).length > 0 && (
        <p className="text-[11px] font-semibold text-amber-700">
          Ada perubahan yang belum disimpan.
        </p>
      )}
    </div>
  );
}

/** satu isian, bentuknya mengikuti jenis medan pada tahap itu */
function MedanIsianScm({ m, nilai, vendor, jejak, onUbah }: {
  m: MedanTahap; nilai: any; vendor: Vendor[]; jejak?: string; onUbah: (v: any) => void;
}) {
  const kelas = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-sky-400";
  return (
    <div className={m.jenis === "vendor" ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-bold text-slate-600">
        {m.label}{m.wajib && <span className="text-rose-500"> *</span>}
        {jejak && <span className="ml-1 font-normal text-slate-400">· {jejak}</span>}
      </label>
      {m.jenis === "vendor" ? (
        <select value={nilai || ""} onChange={(e) => onUbah(e.target.value)} className={kelas}>
          <option value="">— pilih vendor —</option>
          {vendor.map((x) => <option key={x.id} value={x.id}>{x.nama}{x.kota ? ` — ${x.kota}` : ""}</option>)}
        </select>
      ) : m.jenis === "tanggal" ? (
        <input type="date" value={nilai || ""} onChange={(e) => onUbah(e.target.value)} className={kelas} />
      ) : m.jenis === "angka" ? (
        <input type="number" min={1} value={nilai || ""} onChange={(e) => onUbah(Number(e.target.value))} className={kelas} />
      ) : m.jenis === "textarea" ? (
        <textarea value={nilai || ""} rows={2} onChange={(e) => onUbah(e.target.value)} className={kelas} />
      ) : (
        <input value={nilai || ""} placeholder={m.contoh} onChange={(e) => onUbah(e.target.value)} className={kelas} />
      )}
      {m.petunjuk && <p className="mt-1 text-[10px] text-slate-400">{m.petunjuk}</p>}
    </div>
  );
}

/** satu nomor dokumen, sekali ketuk tersalin */
function NomorSalin({ label, nilai }: { label: string; nilai: string }) {
  const [ok, setOk] = useState(false);
  const salin = async () => {
    try { await navigator.clipboard.writeText(nilai); setOk(true); window.setTimeout(() => setOk(false), 1200); }
    catch { /* peramban menolak — teksnya masih bisa disorot sendiri */ }
  };
  return (
    <button onClick={salin} title="Ketuk untuk menyalin"
      className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-left ring-1 ring-slate-200 transition hover:bg-sky-50">
      <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-700">{nilai}</span>
      <span className={`text-[10px] ${ok ? "text-emerald-600" : "text-slate-300"}`}>{ok ? "tersalin" : "⧉"}</span>
    </button>
  );
}
