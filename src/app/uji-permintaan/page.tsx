"use client";
/**
 * BORANG PERMINTAAN KAPAL — halaman UJI COBA, terpisah dari /lapor.
 *
 * Selama ini ABK mengetik borang HP-103.00.01 di Word, mencetak, menandatangani,
 * memindai, lalu mengirim hasil pindaiannya. Yang diketik ulang itu justru
 * bagian yang paling sering salah: nama barang dan satuannya berbeda-beda tiap
 * kapal, sehingga kantor harus menebak-nebak barang mana yang dimaksud sebelum
 * bisa menyusun pengadaan.
 *
 * Di sini barangnya DIPILIH dari Database RAB yang sama dengan yang dipakai
 * kantor — nama, spesifikasi, dan satuannya langsung seragam. Cetakannya tetap
 * borang yang sama persis, karena yang bertanda tangan tetap Nakhoda dan KKM di
 * atas kertas, dan berkas pindaiannya tetap WAJIB diunggah: tanpa itu tombol
 * kirim tidak bisa ditekan. Yang berubah cuma cara mengetiknya, bukan aturannya.
 *
 * Halaman ini sengaja berdiri sendiri di /uji-permintaan supaya percobaan tidak
 * mengganggu jalur /lapor yang sedang dipakai armada. Kirimannya pun tersimpan
 * dengan kind "permintaan_uji" dan berkasnya masuk folder Drive tersendiri.
 */
import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { ACCEPT_BERKAS, kenaliBerkas } from "@/lib/lapor/berkasJenis";
import { tautanWa, ukuranSingkat, WA_KONFIRMASI } from "@/lib/lapor/types";
import {
  BAGIAN, BagianKapal, BarisPermintaan, DASAR_UMUM, FormulirPermintaan,
  KATEGORI_BAGIAN, SATUAN_UMUM, bagianDari, periksaFormulir,
} from "@/lib/lapor/formulir";
import LembarPermintaan from "@/components/lapor/LembarPermintaan";
import { Kemajuan, jumlahTercatat, pesanRamah, unggahSatuBerkas } from "@/lib/lapor/unggahBerkas";

const KUNCI_DRAF = "uji-permintaan:draf";
const MAKS_BERKAS = 8;
const BATAS_MB = 35;

interface HasilCari {
  uraian: string; spek: string; satuan: string; kategori: string; kode: string; n: number;
}

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const barisBaru = (): BarisPermintaan => ({
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  jumlah: "1", satuan: "Pcs", merk: "", uraian: "", spesifikasi: "",
});

const kosong = (): FormulirPermintaan => ({
  kapal: "", bagian: "deck", noSurat: "", tanggal: hariIni(), dasar: "",
  tanggalDibutuhkan: "Segera", peminta: "", jabatanPeminta: "", nakhoda: "",
  masinis: "", kontak: "", catatan: "", baris: [],
});

function IsiBorangPermintaan() {
  const [f, setF] = useState<FormulirPermintaan>(kosong);
  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState("");
  const [hasil, setHasil] = useState<HasilCari[]>([]);
  const [sibukCari, setSibukCari] = useState(false);
  const [berkas, setBerkas] = useState<File[]>([]);
  const [galat, setGalat] = useState("");
  const [kirim, setKirim] = useState(false);
  const [maju, setMaju] = useState("");
  const [selesai, setSelesai] = useState<{ masuk: number; gagal: string[]; tercatat: number | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const kotakCari = useRef<HTMLInputElement>(null);

  const ubah = useCallback((tambal: Partial<FormulirPermintaan>) => setF((l) => ({ ...l, ...tambal })), []);
  const sp = useSearchParams();


  // ── draf disimpan di peramban ────────────────────────────────────────────
  // Borang ini bisa berisi tiga puluh barang. Kehilangan semuanya karena tab
  // tertutup atau HP mati akan membuat orang kembali mengetik di Word.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(KUNCI_DRAF) || "null");
      if (d?.kapal !== undefined) setF({ ...kosong(), ...d });
    } catch { /* draf rusak, abaikan */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KUNCI_DRAF, JSON.stringify(f)); } catch { /* mode penyamaran */ }
  }, [f]);

  /*
   * Borang bisa dibuka dari temuan inspeksi ("buat permintaan barang"), dengan
   * kapal, bagian, dan barangnya sudah terbawa di alamat. Tanpa ini, orang yang
   * menindaklanjuti temuan harus mengetik ulang nama barang yang baru saja
   * dibacanya di layar sebelah — dan di situlah namanya mulai berbeda-beda.
   */
  useEffect(() => {
    const uraian = sp.get("uraian");
    if (!uraian) return;
    setF((l) => {
      if (l.baris.some((b) => b.uraian === uraian)) return l;      // jangan menumpuk saat halaman dirender ulang
      return {
        ...l,
        kapal: sp.get("kapal") || l.kapal,
        bagian: sp.get("bagian") === "mesin" ? "mesin" : l.bagian,
        dasar: sp.get("dasar") || l.dasar,
        baris: [...l.baris, {
          ...barisBaru(), uraian,
          spesifikasi: sp.get("spesifikasi") || "",
        }],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // ── pencarian Database RAB ───────────────────────────────────────────────
  useEffect(() => {
    if (cari.trim().length < 2) { setHasil([]); return; }
    const t = window.setTimeout(async () => {
      setSibukCari(true);
      try {
        const r = await fetch(`/api/uji-permintaan/cari?q=${encodeURIComponent(cari)}`
          + `&bagian=${f.bagian}&kategori=${encodeURIComponent(kategori)}`, { cache: "no-store" });
        const d = await r.json();
        setHasil(d?.ok ? d.hasil : []);
      } catch { setHasil([]); }
      finally { setSibukCari(false); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [cari, f.bagian, kategori]);

  const tambahDariDb = (h: HasilCari) => {
    setF((l) => ({
      ...l,
      baris: [...l.baris, {
        ...barisBaru(), uraian: h.uraian, spesifikasi: h.spek,
        satuan: h.satuan || "Pcs", kode: h.kode,
      }],
    }));
    setCari(""); setHasil([]);
    kotakCari.current?.focus();
  };

  const ubahBaris = (id: string, tambal: Partial<BarisPermintaan>) =>
    setF((l) => ({ ...l, baris: l.baris.map((b) => (b.id === id ? { ...b, ...tambal } : b)) }));
  const hapusBaris = (id: string) => setF((l) => ({ ...l, baris: l.baris.filter((b) => b.id !== id) }));
  const geser = (i: number, arah: -1 | 1) => setF((l) => {
    const b = [...l.baris];
    const j = i + arah;
    if (j < 0 || j >= b.length) return l;
    [b[i], b[j]] = [b[j], b[i]];
    return { ...l, baris: b };
  });

  const tambahBerkas = (daftar: FileList | null) => {
    if (!daftar) return;
    const terima: File[] = [];
    const tolak: string[] = [];
    for (const x of Array.from(daftar)) {
      if (x.size > BATAS_MB * 1024 * 1024) { tolak.push(`${x.name} lebih dari ${BATAS_MB} MB`); continue; }
      if (!kenaliBerkas(x.name, x.type)) { tolak.push(`${x.name} jenisnya belum didukung`); continue; }
      if (berkas.length + terima.length >= MAKS_BERKAS) { tolak.push(`${x.name} tidak muat (maksimal ${MAKS_BERKAS})`); continue; }
      terima.push(x);
    }
    if (terima.length) setBerkas((l) => [...l, ...terima]);
    setGalat(tolak.length ? `Dilewati: ${tolak.join(", ")}.` : "");
    if (inputRef.current) inputRef.current.value = "";
  };

  const kurang = useMemo(() => periksaFormulir(f), [f]);
  const siapKirim = kurang.length === 0 && berkas.length > 0 && !kirim;

  const cetak = () => window.print();

  const kirimSemua = async () => {
    setGalat(""); setKirim(true); setMaju("Membuka kiriman…");
    try {
      const r = await fetch("/api/uji-permintaan/kirim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formulir: { ...f, baris: f.baris.filter((b) => b.uraian.trim()) } }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Kiriman gagal dibuka");
      const kiriman = { id: d.id as string, token: d.token as string };

      const lapor = (k: Kemajuan) => setMaju(k.percobaan > 1
        ? `Sinyal terputus — mencoba lagi (${k.percobaan}/5)…`
        : `Mengunggah berkas ${k.urut} dari ${k.dari}${k.total > 1 ? ` — bagian ${k.potongan}/${k.total}` : ""}…`);

      let masuk = 0;
      const gagal: string[] = [];
      for (let i = 0; i < berkas.length; i++) {
        try { await unggahSatuBerkas(kiriman, berkas[i], i + 1, berkas.length, lapor); masuk++; }
        catch (e) { gagal.push(`${berkas[i].name}: ${pesanRamah(e)}`); }
      }
      setMaju("Memastikan berkas tercatat di kantor…");
      const tercatat = await jumlahTercatat(kiriman);
      setSelesai({ masuk, gagal, tercatat });
      if (!gagal.length) { try { localStorage.removeItem(KUNCI_DRAF); } catch { /* biarkan */ } }
    } catch (e) {
      setGalat(pesanRamah(e));
    } finally { setKirim(false); setMaju(""); }
  };

  // ── layar hasil ──────────────────────────────────────────────────────────
  if (selesai) {
    const pesanWa = `Halo, saya ${f.peminta} dari ${f.kapal}. Sudah mengirim Permintaan `
      + `${f.bagian === "mesin" ? "Mesin" : "Deck"} No. ${f.noSurat} lewat borang digital `
      + `(${selesai.masuk} berkas). Mohon dicek. Terima kasih.`;
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 text-5xl">{selesai.gagal.length ? "⏳" : "✅"}</div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {selesai.gagal.length ? "Sebagian berkas belum masuk" : "Permintaan terkirim"}
          </h1>
          <p className="mt-2 text-slate-600">
            {f.kapal} · Permintaan {f.bagian === "mesin" ? "Mesin" : "Deck"} · No. {f.noSurat} ·{" "}
            <b>{f.baris.filter((b) => b.uraian.trim()).length} barang</b>
          </p>
          {typeof selesai.tercatat === "number" && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ring-1 ${
              selesai.tercatat > 0 ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
              {selesai.tercatat > 0
                ? <><b>{selesai.tercatat} berkas pindaian tercatat di kantor.</b></>
                : <><b>Belum ada berkas yang tercatat di kantor.</b> Coba kirim ulang.</>}
            </div>
          )}
          {!!selesai.gagal.length && (
            <ul className="mt-4 space-y-1 text-left text-xs text-amber-900">
              {selesai.gagal.map((g, i) => <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">{g}</li>)}
            </ul>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a href={tautanWa(pesanWa)} target="_blank" rel="noopener noreferrer"
               className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">💬 Konfirmasi lewat WhatsApp</a>
            <button onClick={() => { setSelesai(null); setBerkas([]); }}
              className="rounded-xl bg-white px-5 py-3 font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
              Kembali ke borang
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isiBaris = f.baris.filter((b) => b.uraian.trim());

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 print:p-0">
      <header className="mb-4 flex items-center gap-3 print:hidden">
        <div className="shrink-0 rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
          <Image src="/logo-asdp.png" alt="ASDP" width={44} height={30} className="object-contain" />
        </div>
        <div className="leading-tight">
          <h1 className="asdp-text-gradient text-2xl font-extrabold">Borang Permintaan Kapal</h1>
          <p className="text-sm text-slate-500">HP-103.00.01 Rev.06 · Teknik ASDP Ternate</p>
        </div>
      </header>

      <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
        <b>Halaman uji coba.</b> Kiriman dari sini masuk ke folder percobaan, terpisah dari
        jalur Lapor Kapal yang sedang dipakai. Silakan dicoba sepuasnya — tidak mengganggu
        laporan yang berjalan.
      </div>

      {/* ── 1. identitas ─────────────────────────────────────────────────── */}
      <section className="mb-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm print:hidden">
        <h2 className="mb-3 font-extrabold text-slate-800">1. Identitas permintaan</h2>

        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-bold text-slate-700">Bagian</span>
          <div className="grid grid-cols-2 gap-2">
            {BAGIAN.map((b) => (
              <button key={b.id} type="button"
                onClick={() => ubah({ bagian: b.id as BagianKapal, dasar: f.dasar || DASAR_UMUM[b.id][0] })}
                className={`rounded-xl px-3 py-3 text-left ring-1 transition ${
                  f.bagian === b.id ? "bg-blue-600 text-white ring-blue-600" : "bg-slate-50 ring-slate-200 hover:bg-slate-100"}`}>
                <div className="text-lg leading-none">{b.ikon}</div>
                <div className="mt-1 text-sm font-bold">Permintaan {b.label}</div>
                <div className={`text-xs ${f.bagian === b.id ? "text-blue-100" : "text-slate-500"}`}>
                  Ditandatangani {b.atasan}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Deck dan Mesin dipisah — daftar barang yang bisa dicari ikut menyesuaikan.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Kapal</span>
            <select value={f.kapal} onChange={(e) => ubah({ kapal: e.target.value })}
              className="w-full rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-300">
              <option value="">— pilih kapal —</option>
              {KAPAL_ANGGARAN.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">No. SPPB/J</span>
            <input value={f.noSurat} onChange={(e) => ubah({ noSurat: e.target.value })}
              placeholder="10/D/NGF/V/ASDP-2026"
              className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Tanggal</span>
            <input type="date" value={f.tanggal} onChange={(e) => ubah({ tanggal: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Tanggal dibutuhkan</span>
            <input value={f.tanggalDibutuhkan} onChange={(e) => ubah({ tanggalDibutuhkan: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-slate-700">Dasar permintaan</span>
            <input value={f.dasar} onChange={(e) => ubah({ dasar: e.target.value })} list="daftar-dasar"
              placeholder="Kebutuhan Operasional Kapal"
              className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
            <datalist id="daftar-dasar">
              {DASAR_UMUM[f.bagian].map((d) => <option key={d} value={d} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Nama peminta</span>
            <input value={f.peminta} onChange={(e) => ubah({ peminta: e.target.value })} placeholder="Nama lengkap"
              className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Jabatan peminta</span>
            <input value={f.jabatanPeminta} onChange={(e) => ubah({ jabatanPeminta: e.target.value })}
              placeholder="Masinis II / Mualim II" className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Nakhoda</span>
            <input value={f.nakhoda} onChange={(e) => ubah({ nakhoda: e.target.value })}
              placeholder="Nama Nakhoda" className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              {f.bagian === "mesin" ? "Masinis I / KKM" : "Mualim I"}
            </span>
            <input value={f.masinis} onChange={(e) => ubah({ masinis: e.target.value })}
              placeholder="Nama" className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Nomor WhatsApp <span className="font-normal text-slate-400">(dianjurkan)</span>
            </span>
            <input value={f.kontak} onChange={(e) => ubah({ kontak: e.target.value })} inputMode="tel"
              placeholder="08xx…" className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Catatan peminta <span className="font-normal text-slate-400">(boleh kosong)</span>
            </span>
            <textarea value={f.catatan} onChange={(e) => ubah({ catatan: e.target.value })} rows={2}
              className="w-full rounded-xl px-3 py-2.5 ring-1 ring-slate-300" />
          </label>
        </div>
      </section>

      {/* ── 2. barang ────────────────────────────────────────────────────── */}
      <section className="mb-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold text-slate-800">2. Barang yang diminta</h2>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
            {isiBaris.length} barang
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input ref={kotakCari} value={cari} onChange={(e) => setCari(e.target.value)}
              placeholder={`Cari barang ${f.bagian === "mesin" ? "mesin" : "deck"} — mis. selang hose, kabel NYY, filter oli`}
              className="w-full rounded-xl py-2.5 pl-9 pr-3 ring-1 ring-slate-300" />
          </div>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)}
            className="rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300">
            <option value="">Semua kategori</option>
            {KATEGORI_BAGIAN[f.bagian].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Diambil dari Database RAB kantor — nama, spesifikasi, dan satuannya jadi seragam.
          Barang yang belum ada di database bisa ditambah sendiri di bawah.
        </p>

        {cari.trim().length >= 2 && (
          <div className="mt-2 max-h-72 overflow-auto rounded-2xl ring-1 ring-slate-200">
            {sibukCari && <div className="px-3 py-2 text-sm text-slate-500">mencari…</div>}
            {!sibukCari && !hasil.length && (
              <div className="px-3 py-3 text-sm text-slate-500">
                Tidak ada yang cocok. Tekan <b>+ Tambah barang sendiri</b> lalu ketik namanya.
              </div>
            )}
            {hasil.map((h) => (
              <button key={h.kode} type="button" onClick={() => tambahDariDb(h)}
                className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-sky-50">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{h.uraian}</span>
                  {h.spek && <span className="block text-xs text-slate-500">{h.spek}</span>}
                  <span className="block text-[10px] text-slate-400">{h.kategori} · {h.n}× dipakai</span>
                </span>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {h.satuan || "Pcs"}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-1 py-2 text-left">No</th>
                <th className="w-20 px-1 py-2 text-left">Jumlah</th>
                <th className="w-24 px-1 py-2 text-left">Satuan</th>
                <th className="w-36 px-1 py-2 text-left">Merk/Katalog</th>
                <th className="px-1 py-2 text-left">Uraian barang</th>
                <th className="px-1 py-2 text-left">Spesifikasi</th>
                <th className="w-16 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {!f.baris.length && (
                <tr><td colSpan={7} className="px-2 py-6 text-center text-sm text-slate-400">
                  Belum ada barang. Cari di atas, atau tambah sendiri.
                </td></tr>
              )}
              {f.baris.map((b, i) => (
                <tr key={b.id} className="border-t border-slate-100 align-top">
                  <td className="px-1 py-1.5 text-slate-400">{i + 1}</td>
                  <td className="px-1 py-1.5">
                    <input value={b.jumlah} onChange={(e) => ubahBaris(b.id, { jumlah: e.target.value })}
                      inputMode="numeric" className="w-full rounded-lg px-2 py-1.5 ring-1 ring-slate-300" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={b.satuan} onChange={(e) => ubahBaris(b.id, { satuan: e.target.value })}
                      list="daftar-satuan" className="w-full rounded-lg px-2 py-1.5 ring-1 ring-slate-300" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={b.merk} onChange={(e) => ubahBaris(b.id, { merk: e.target.value })}
                      placeholder="mis. Exp 12-2026" className="w-full rounded-lg px-2 py-1.5 ring-1 ring-slate-300" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={b.uraian} onChange={(e) => ubahBaris(b.id, { uraian: e.target.value })}
                      className="w-full rounded-lg px-2 py-1.5 font-semibold ring-1 ring-slate-300" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={b.spesifikasi} onChange={(e) => ubahBaris(b.id, { spesifikasi: e.target.value })}
                      placeholder='mis. 2"' className="w-full rounded-lg px-2 py-1.5 ring-1 ring-slate-300" />
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5 text-right">
                    <button type="button" onClick={() => geser(i, -1)} disabled={i === 0}
                      className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="naikkan">↑</button>
                    <button type="button" onClick={() => geser(i, 1)} disabled={i === f.baris.length - 1}
                      className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="turunkan">↓</button>
                    <button type="button" onClick={() => hapusBaris(b.id)}
                      className="px-1 text-xs font-bold text-rose-600 hover:text-rose-800">hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="daftar-satuan">{SATUAN_UMUM.map((s) => <option key={s} value={s} />)}</datalist>
        </div>

        <button type="button" onClick={() => setF((l) => ({ ...l, baris: [...l.baris, barisBaru()] }))}
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          + Tambah barang sendiri
        </button>
      </section>

      {/* ── 3. pratinjau ─────────────────────────────────────────────────── */}
      <section className="mb-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm print:border-0 print:p-0 print:shadow-none print:ring-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div>
            <h2 className="font-extrabold text-slate-800">3. Pratinjau &amp; cetak</h2>
            <p className="text-xs text-slate-500">
              Bentuknya sama persis dengan borang HP-103.00.01 yang biasa dipakai.
            </p>
          </div>
          <button type="button" onClick={cetak}
            className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700">
            🖨️ Cetak borang
          </button>
        </div>
        {!!kurang.length && (
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 print:hidden">
            Masih kurang: {kurang.join(", ")}.
          </div>
        )}
        <div className="overflow-x-auto rounded-xl bg-slate-100 p-3 print:overflow-visible print:bg-white print:p-0">
          <div className="mx-auto w-fit shadow-lg print:shadow-none">
            <LembarPermintaan f={f} />
          </div>
        </div>
      </section>

      {/* ── 4. unggah pindaian & kirim ───────────────────────────────────── */}
      <section className="mb-10 rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm print:hidden">
        <h2 className="mb-1 font-extrabold text-slate-800">4. Unggah borang yang sudah ditandatangani</h2>
        <p className="mb-3 text-xs text-slate-500">
          Cetak borang di atas, minta tanda tangan Nakhoda dan {f.bagian === "mesin" ? "KKM" : "Mualim I"},
          lalu pindai atau foto dan unggah di sini. <b>Tanpa berkas pindaian, permintaan tidak bisa dikirim</b> —
          yang berlaku sebagai dokumen resmi tetap lembar bertanda tangan.
        </p>

        <input ref={inputRef} type="file" multiple accept={ACCEPT_BERKAS} disabled={kirim}
          onChange={(e) => tambahBerkas(e.target.files)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white" />

        {!!berkas.length && (
          <ul className="mt-3 space-y-1.5">
            {berkas.map((x, i) => (
              <li key={`${x.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                <span className="flex-1 truncate">{x.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{ukuranSingkat(x.size)}</span>
                <button type="button" onClick={() => setBerkas((l) => l.filter((_, k) => k !== i))} disabled={kirim}
                  className="shrink-0 text-xs font-bold text-rose-600 hover:text-rose-800 disabled:text-slate-300">hapus</button>
              </li>
            ))}
          </ul>
        )}

        {galat && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{galat}</div>}
        {kirim && <p className="mt-3 text-xs text-slate-600">{maju}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={kirimSemua} disabled={!siapKirim}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300">
            {kirim ? "Mengirim…" : "Kirim ke kantor"}
          </button>
          {!berkas.length && !kurang.length && (
            <span className="text-xs text-amber-700">Unggah dulu hasil pindaian borang yang sudah ditandatangani.</span>
          )}
          {!!kurang.length && <span className="text-xs text-slate-500">Lengkapi dulu: {kurang.join(", ")}.</span>}
        </div>
      </section>

      <p className="mb-8 text-center text-xs text-slate-400 print:hidden">
        Halaman uji coba · pertanyaan lewat WhatsApp kantor +{WA_KONFIRMASI}
      </p>
    </main>
  );
}

/**
 * useSearchParams menuntut batas Suspense saat halaman dirender di server.
 */
export default function BorangPermintaanUji() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Memuat…</main>}>
      <IsiBorangPermintaan />
    </Suspense>
  );
}
