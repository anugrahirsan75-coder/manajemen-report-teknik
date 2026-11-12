"use client";
/**
 * Persediaan Suku Cadang — diisi kapal, dibaca kantor.
 *
 * Empat layar, mengikuti urutan pekerjaan di kapal:
 *   Stok      — lihat ada berapa; ketuk barang untuk mencatat TERIMA atau PAKAI
 *   Tambah    — daftarkan barang baru, atau tempel banyak sekaligus dari Excel
 *   Cek Fisik — hitung isi gudang, aplikasi mencatat selisihnya
 *   Borang    — TF-101.00.11 bulanan, terhitung otomatis, siap cetak
 *
 * Kapal tidak pernah menulis "stok akhir". Angka itu selalu hasil hitungan,
 * karena di borang kertas justru angka itulah yang paling sering keliru.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { RangkaPortal, useAku } from "@/components/portal/Rangka";
import { BorangBulanan } from "@/components/sukuCadang/BorangBulanan";
import {
  LABEL_MUTASI, NADA_SC, PENANDA_TANGAN_AWAL, PERALATAN_UMUM, bacaTempelan, bulanIni, hariIni,
  namaBulan, petaStok, ringkasSC, tglPanjang, tingkatStok,
  type CekFisikSC, type ItemSC, type MutasiSC, type PenandaTanganSC,
} from "@/lib/portal/sukuCadang";

type Layar = "stok" | "tambah" | "cek" | "borang";
const SATUAN = ["Pcs", "Set", "Unit", "Buah", "Ltr", "Mtr", "Roll", "Kg", "Btl", "Klg"];

const kelasInput = "mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] dark:border-slate-600 dark:bg-slate-900";
const kelasLabel = "block text-[10.5px] font-bold uppercase text-slate-500";

export default function SukuCadangPortal() {
  const { aku } = useAku();
  const bagian = aku?.bagian || "mesin";
  const [layar, setLayar] = useState<Layar>("stok");
  const [item, setItem] = useState<ItemSC[]>([]);
  const [mutasi, setMutasi] = useState<MutasiSC[]>([]);
  const [cekFisik, setCekFisik] = useState<CekFisikSC[]>([]);
  const [ttd, setTtd] = useState<PenandaTanganSC>(PENANDA_TANGAN_AWAL("mesin"));
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");

  const terima = (d: any) => {
    if (d.item) setItem(d.item);
    if (d.mutasi) setMutasi(d.mutasi);
    if (d.cekFisik) setCekFisik(d.cekFisik);
    if (d.penandaTangan) setTtd(d.penandaTangan);
  };

  const ambil = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/suku-cadang", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat");
      terima(d);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);
  useEffect(() => { void ambil(); }, [ambil]);

  /** kirim satu aksi; true bila tersimpan */
  const kirim = async (body: Record<string, unknown>): Promise<boolean> => {
    setSibuk(true); setGalat(""); setKabar("");
    try {
      const r = await fetch("/api/portal/suku-cadang", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal menyimpan");
      terima(d);
      setKabar(d.kabar || "Tersimpan ✓");
      setTimeout(() => setKabar(""), 5000);
      return true;
    } catch (e: any) {
      setGalat(e?.message || String(e));
      return false;
    } finally { setSibuk(false); }
  };

  const stok = useMemo(() => petaStok(mutasi), [mutasi]);
  const ringkas = useMemo(() => ringkasSC({ item, mutasi, cekFisik }), [item, mutasi, cekFisik]);

  return (
    <RangkaPortal aku={aku}>
      <h1 className="text-[17px] font-black text-slate-900 dark:text-white">Persediaan Suku Cadang</h1>
      <p className="mb-3 text-[11.5px] text-slate-500">
        Borang TF-101.00.11 · Departemen {bagian === "mesin" ? "Mesin" : "Deck"}. Catat tiap barang diterima atau dipakai —
        stok akhir dan borang bulanan dihitung otomatis.
      </p>

      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
        {[
          { l: "Barang", v: ringkas.barang, k: "text-slate-800 dark:text-slate-100" },
          { l: "Habis", v: ringkas.habis, k: ringkas.habis ? "text-rose-700" : "text-slate-400" },
          { l: "Menipis", v: ringkas.menipis, k: ringkas.menipis ? "text-amber-700" : "text-slate-400" },
          { l: "Catatan bln ini", v: ringkas.mutasiBulanIni, k: "text-[#16357f] dark:text-sky-300" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-white px-1 py-2 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <p className={`text-[19px] font-black tabular-nums ${x.k}`}>{x.v}</p>
            <p className="text-[10px] font-bold uppercase text-slate-500">{x.l}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
        {([["stok", "Stok"], ["tambah", "Tambah"], ["cek", "Cek Fisik"], ["borang", "Borang"]] as [Layar, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setLayar(k); setGalat(""); }}
            className={`rounded-lg py-2 text-[12px] font-bold transition ${layar === k
              ? "bg-white text-[#16357f] shadow dark:bg-slate-900 dark:text-sky-300" : "text-slate-600 dark:text-slate-300"}`}>
            {l}
          </button>
        ))}
      </div>

      {kabar && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200">{kabar}</p>}
      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}
      {muat && <p className="py-8 text-center text-[12.5px] text-slate-500">Memuat…</p>}

      {!muat && layar === "stok" && (
        <LayarStok item={item} mutasi={mutasi} stok={stok} sibuk={sibuk} kirim={kirim} bagian={bagian}
          keTambah={() => setLayar("tambah")} />
      )}
      {!muat && layar === "tambah" && <LayarTambah sibuk={sibuk} kirim={kirim} bagian={bagian} keStok={() => setLayar("stok")} />}
      {!muat && layar === "cek" && <LayarCek item={item} stok={stok} sibuk={sibuk} kirim={kirim} cekFisik={cekFisik} />}
      {!muat && layar === "borang" && (
        <LayarBorang item={item} mutasi={mutasi} ttd={ttd} setTtd={setTtd} sibuk={sibuk} kirim={kirim}
          kapal={aku?.kapal || ""} bagian={bagian} />
      )}
    </RangkaPortal>
  );
}

type Kirim = (body: Record<string, unknown>) => Promise<boolean>;

/* ════════════════════════════ STOK ════════════════════════════ */
function LayarStok({ item, mutasi, stok, sibuk, kirim, bagian, keTambah }: {
  item: ItemSC[]; mutasi: MutasiSC[]; stok: Map<string, number>; sibuk: boolean; kirim: Kirim;
  bagian: "deck" | "mesin"; keTambah: () => void;
}) {
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<"semua" | "habis" | "menipis">("semua");
  const [buka, setBuka] = useState("");

  const aktif = item.filter((i) => i.aktif);
  const q = cari.trim().toLowerCase();
  const tampil = aktif.filter((i) => {
    const t = tingkatStok(stok.get(i.id) || 0, i.minimum);
    if (saring === "habis" && t !== "habis") return false;
    if (saring === "menipis" && t !== "menipis") return false;
    return !q || `${i.nama} ${i.partNumber} ${i.peralatan} ${i.lokasi}`.toLowerCase().includes(q);
  });
  const grup: string[] = [];
  tampil.forEach((i) => { if (!grup.includes(i.peralatan)) grup.push(i.peralatan); });

  if (!aktif.length) {
    return (
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-[14px] font-black text-slate-800 dark:text-slate-100">Daftar suku cadang masih kosong</p>
        <p className="mt-1 text-[12px] text-slate-500">
          Mulai dari daftar di borang bulan lalu: salin tabelnya dari Excel lalu tempel, atau tambahkan satu per satu.
        </p>
        <button onClick={keTambah} className="mt-3 rounded-xl bg-[#16357f] px-4 py-2.5 text-[13px] font-bold text-white">Isi daftar barang</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / part number…"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] dark:border-slate-600 dark:bg-slate-900" />
        <select value={saring} onChange={(e) => setSaring(e.target.value as any)}
          className="rounded-xl border border-slate-300 bg-white px-2 text-[12.5px] dark:border-slate-600 dark:bg-slate-900">
          <option value="semua">Semua</option>
          <option value="habis">Habis</option>
          <option value="menipis">Menipis</option>
        </select>
      </div>

      {!tampil.length && <p className="py-6 text-center text-[12.5px] text-slate-500">Tidak ada barang yang cocok.</p>}

      {grup.map((g) => (
        <section key={g} className="mb-3">
          <h2 className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-wide text-slate-500">{g}</h2>
          <ul className="space-y-2">
            {tampil.filter((i) => i.peralatan === g).map((i) => (
              <KartuBarang key={i.id} i={i} jumlah={stok.get(i.id) || 0} terbuka={buka === i.id}
                setBuka={(v) => setBuka(v ? i.id : "")} mutasi={mutasi.filter((m) => m.itemId === i.id)}
                sibuk={sibuk} kirim={kirim} bagian={bagian} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function KartuBarang({ i, jumlah, terbuka, setBuka, mutasi, sibuk, kirim, bagian }: {
  i: ItemSC; jumlah: number; terbuka: boolean; setBuka: (v: boolean) => void; mutasi: MutasiSC[];
  sibuk: boolean; kirim: Kirim; bagian: "deck" | "mesin";
}) {
  const t = tingkatStok(jumlah, i.minimum);
  const [jenis, setJenis] = useState<"terima" | "pakai">("pakai");
  const [qty, setQty] = useState("");
  const [tgl, setTgl] = useState(hariIni());
  const [ket, setKet] = useState("");
  const [ubah, setUbah] = useState(false);

  const catat = async () => {
    if (await kirim({ aksi: "mutasi", itemId: i.id, jenis, jumlah: qty, tanggal: tgl, keterangan: ket })) {
      setQty(""); setKet("");
    }
  };
  const batal = async (m: MutasiSC) => {
    const alasan = window.prompt(`Batalkan "${LABEL_MUTASI[m.jenis]} ${m.jumlah} ${i.satuan}" tanggal ${tglPanjang(m.tanggal)}?\nTulis alasannya:`);
    if (alasan && alasan.trim()) await kirim({ aksi: "batal", mutasiId: m.id, alasan });
  };
  const terakhir = [...mutasi].sort((a, b) => (b.tanggal + b.dicatatPada).localeCompare(a.tanggal + a.dicatatPada)).slice(0, 6);

  return (
    <li className={`rounded-xl ring-1 ${t === "habis" ? "bg-rose-50 ring-rose-200 dark:bg-rose-950/30"
      : t === "menipis" ? "bg-amber-50 ring-amber-300 dark:bg-amber-950/30" : "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>
      <button onClick={() => setBuka(!terbuka)} className="flex w-full items-center gap-3 p-2.5 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-slate-900 dark:text-slate-100">{i.nama}</p>
          <p className="text-[11px] text-slate-500">
            {i.partNumber || "tanpa part number"}{i.lokasi ? ` · ${i.lokasi}` : ""}{i.minimum ? ` · min ${i.minimum}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[19px] font-black tabular-nums leading-none text-slate-900 dark:text-white">
            {jumlah.toLocaleString("id-ID")} <span className="text-[11px] font-bold text-slate-500">{i.satuan}</span>
          </p>
          {(t === "habis" || t === "menipis") && (
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-black ring-1 ${NADA_SC[t].kelas}`}>{NADA_SC[t].label}</span>
          )}
        </div>
      </button>

      {terbuka && (
        <div className="border-t border-slate-200 p-2.5 dark:border-slate-700">
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(["terima", "pakai"] as const).map((j) => (
              <button key={j} onClick={() => setJenis(j)}
                className={`rounded-md py-1.5 text-[12.5px] font-black ${jenis === j
                  ? j === "terima" ? "bg-emerald-600 text-white" : "bg-orange-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
                {j === "terima" ? "+ Terima" : "− Pakai"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className={kelasLabel}>Jumlah ({i.satuan})</span>
              <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={`${kelasInput} text-[15px] font-bold`} />
            </label>
            <label><span className={kelasLabel}>Tanggal</span>
              <input type="date" value={tgl} max={hariIni()} onChange={(e) => setTgl(e.target.value)} className={kelasInput} />
            </label>
            <label className="col-span-2"><span className={kelasLabel}>Keterangan</span>
              <input value={ket} onChange={(e) => setKet(e.target.value)} className={kelasInput}
                placeholder={jenis === "terima" ? "mis. SPBJ 254/… atau pindahan dari KMP. …" : bagian === "mesin" ? "mis. ganti di ME kiri silinder 3" : "mis. perbaikan ramp door haluan"} />
            </label>
          </div>
          <button onClick={catat} disabled={sibuk || !qty}
            className={`mt-2 w-full rounded-xl py-2.5 text-[13px] font-bold text-white disabled:opacity-50 ${jenis === "terima" ? "bg-emerald-600" : "bg-orange-600"}`}>
            {sibuk ? "Menyimpan…" : jenis === "terima" ? "Catat penerimaan" : "Catat pemakaian"}
          </button>

          {!!terakhir.length && (
            <div className="mt-3">
              <p className={kelasLabel}>Catatan terakhir</p>
              <ul className="mt-1 divide-y divide-slate-200 text-[11.5px] dark:divide-slate-700">
                {terakhir.map((m) => (
                  <li key={m.id} className={`flex items-center gap-2 py-1 ${m.dibatalkan ? "text-slate-400 line-through" : ""}`}>
                    <span className="w-20 shrink-0 tabular-nums">{tglPanjang(m.tanggal).replace(/ \d{4}$/, "")}</span>
                    <span className={`w-16 shrink-0 font-bold ${m.jenis === "pakai" ? "text-orange-700" : m.jenis === "koreksi" ? "text-violet-700" : "text-emerald-700"}`}>
                      {m.jenis === "pakai" ? "−" : m.jumlah < 0 ? "" : "+"}{m.jumlah}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{LABEL_MUTASI[m.jenis]}{m.keterangan ? ` · ${m.keterangan}` : ""}</span>
                    {!m.dibatalkan && (
                      <button onClick={() => batal(m)} className="shrink-0 text-[11px] font-bold text-rose-600 hover:underline">Batalkan</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={() => setUbah(!ubah)} className="mt-3 text-[11.5px] font-bold text-[#16357f] hover:underline dark:text-sky-300">
            {ubah ? "Tutup ubah data" : "Ubah data barang"}
          </button>
          {ubah && <FormBarang awal={i} sibuk={sibuk} kirim={kirim} bagian={bagian} selesai={() => setUbah(false)} />}
        </div>
      )}
    </li>
  );
}

/* ═══════════════════ FORM BARANG (baru / ubah) ═══════════════════ */
function FormBarang({ awal, sibuk, kirim, bagian, selesai }: {
  awal?: ItemSC; sibuk: boolean; kirim: Kirim; bagian: "deck" | "mesin"; selesai?: () => void;
}) {
  const [f, setF] = useState({
    peralatan: awal?.peralatan || PERALATAN_UMUM[bagian][0], partNumber: awal?.partNumber || "", nama: awal?.nama || "",
    satuan: awal?.satuan || "Pcs", minimum: String(awal?.minimum ?? ""), kondisi: awal?.kondisi || "baru",
    lokasi: awal?.lokasi || "", catatan: awal?.catatan || "", stokAwal: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const simpan = async () => {
    const ok = await kirim({
      aksi: "barang", item: { ...f, id: awal?.id, minimum: f.minimum || 0 },
      ...(awal ? {} : { stokAwal: f.stokAwal || 0, tanggalAwal: hariIni() }),
    });
    if (ok) {
      if (!awal) setF((x) => ({ ...x, partNumber: "", nama: "", stokAwal: "", minimum: "", lokasi: "", catatan: "" }));
      selesai?.();
    }
  };
  const nonaktif = async () => {
    if (awal && window.confirm(`Nonaktifkan ${awal.nama}? Barang tidak tampil lagi di daftar, riwayatnya tetap tersimpan.`)) {
      if (await kirim({ aksi: "barang", item: { id: awal.id, aktif: false } })) selesai?.();
    }
  };

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="col-span-2"><span className={kelasLabel}>Peralatan / mesin</span>
        <input list={`peralatan-${bagian}`} value={f.peralatan} onChange={(e) => set("peralatan", e.target.value)} className={kelasInput} />
        <datalist id={`peralatan-${bagian}`}>{PERALATAN_UMUM[bagian].map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      <label><span className={kelasLabel}>Part number</span>
        <input value={f.partNumber} onChange={(e) => set("partNumber", e.target.value)} className={`${kelasInput} uppercase`} placeholder="mis. 37561-17500" />
      </label>
      <label><span className={kelasLabel}>Satuan</span>
        <input list="satuan-sc" value={f.satuan} onChange={(e) => set("satuan", e.target.value)} className={kelasInput} />
        <datalist id="satuan-sc">{SATUAN.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <label className="col-span-2"><span className={kelasLabel}>Nama barang</span>
        <input value={f.nama} onChange={(e) => set("nama", e.target.value)} className={kelasInput} placeholder="mis. NOZZLE ASSY (INJECTOR)" />
      </label>
      {!awal && (
        <label><span className={kelasLabel}>Stok sekarang</span>
          <input value={f.stokAwal} onChange={(e) => set("stokAwal", e.target.value)} inputMode="decimal" className={`${kelasInput} font-bold`} />
        </label>
      )}
      <label><span className={kelasLabel}>Batas minimum</span>
        <input value={f.minimum} onChange={(e) => set("minimum", e.target.value)} inputMode="decimal" className={kelasInput} placeholder="0 = tidak dipantau" />
      </label>
      <label><span className={kelasLabel}>Status</span>
        <select value={f.kondisi} onChange={(e) => set("kondisi", e.target.value)} className={kelasInput}>
          <option value="baru">Baru</option>
          <option value="bekas">Bekas (Rekondisi)</option>
        </select>
      </label>
      <label className={awal ? "" : "col-span-1"}><span className={kelasLabel}>Lokasi simpan</span>
        <input value={f.lokasi} onChange={(e) => set("lokasi", e.target.value)} className={kelasInput} placeholder="mis. lemari KM rak 2" />
      </label>
      <div className="col-span-2 flex gap-2">
        <button onClick={simpan} disabled={sibuk || !f.nama.trim()}
          className="flex-1 rounded-xl bg-[#16357f] py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
          {sibuk ? "Menyimpan…" : awal ? "Simpan perubahan" : "Tambah barang"}
        </button>
        {awal && (
          <button onClick={nonaktif} disabled={sibuk} className="rounded-xl border border-rose-300 px-3 text-[12px] font-bold text-rose-700">Nonaktifkan</button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════ TAMBAH ════════════════════════════ */
function LayarTambah({ sibuk, kirim, bagian, keStok }: { sibuk: boolean; kirim: Kirim; bagian: "deck" | "mesin"; keStok: () => void }) {
  const [teks, setTeks] = useState("");
  const [tgl, setTgl] = useState(hariIni());
  const baris = useMemo(() => bacaTempelan(teks, PERALATAN_UMUM[bagian][0]), [teks, bagian]);
  const sah = baris.filter((b) => !b.masalah);

  const simpanTempel = async () => {
    if (await kirim({ aksi: "impor", tanggal: tgl, baris: sah })) { setTeks(""); keStok(); }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 className="px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Tambah satu barang</h2>
        <FormBarang sibuk={sibuk} kirim={kirim} bagian={bagian} />
      </section>

      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 className="px-1 text-[13px] font-black text-slate-800 dark:text-slate-100">Tempel banyak barang dari Excel</h2>
        <p className="mt-1 px-1 text-[11.5px] leading-relaxed text-slate-500">
          Susun kolom di Excel dengan urutan <b>Peralatan · Part Number · Nama Barang · Jumlah · Satuan · Minimum</b>,
          blok barisnya, salin, lalu tempel di sini. Jumlah boleh ditulis &quot;7 Pcs&quot;. Peralatan yang kosong mengikuti baris di atasnya.
        </p>
        <textarea value={teks} onChange={(e) => setTeks(e.target.value)} rows={6}
          placeholder={"Motor Induk\t42790-58513\tBAR ZINK\t6\tPcs\t4\n\t37561-17500\tNOZZLE\t6 Pcs\t\t2"}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2 font-mono text-[12px] dark:border-slate-600 dark:bg-slate-900" />
        {!!baris.length && (
          <>
            <div className="mt-2 max-h-72 overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-100 text-left dark:bg-slate-800">
                  <tr><th className="px-1.5 py-1">Peralatan</th><th className="px-1.5">Part No.</th><th className="px-1.5">Nama</th><th className="px-1.5 text-right">Jml</th><th className="px-1.5">Min</th></tr>
                </thead>
                <tbody>
                  {baris.slice(0, 120).map((b, k) => (
                    <tr key={k} className={b.masalah ? "bg-rose-50 text-rose-800 dark:bg-rose-950/40" : "border-t border-slate-100 dark:border-slate-800"}>
                      <td className="px-1.5 py-0.5">{b.peralatan}</td>
                      <td className="px-1.5">{b.partNumber}</td>
                      <td className="px-1.5">{b.masalah ? `${b.nama} — ${b.masalah}` : b.nama}</td>
                      <td className="px-1.5 text-right tabular-nums">{b.jumlah} {b.satuan}</td>
                      <td className="px-1.5 tabular-nums">{b.minimum || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <label className="flex-1"><span className={kelasLabel}>Tanggal stok ini dihitung</span>
                <input type="date" value={tgl} max={hariIni()} onChange={(e) => setTgl(e.target.value)} className={kelasInput} />
              </label>
              <button onClick={simpanTempel} disabled={sibuk || !sah.length}
                className="rounded-xl bg-[#16357f] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                {sibuk ? "Menyimpan…" : `Simpan ${sah.length} barang`}
              </button>
            </div>
            {baris.length > sah.length && (
              <p className="mt-1 text-[11px] font-semibold text-rose-700">{baris.length - sah.length} baris merah tidak ikut disimpan.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ════════════════════════════ CEK FISIK ════════════════════════════ */
function LayarCek({ item, stok, sibuk, kirim, cekFisik }: {
  item: ItemSC[]; stok: Map<string, number>; sibuk: boolean; kirim: Kirim; cekFisik: CekFisikSC[];
}) {
  const aktif = item.filter((i) => i.aktif);
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const terisi = Object.entries(fisik).filter(([, v]) => v.trim() !== "");
  const selisih = terisi.filter(([id, v]) => Number(v.replace(",", ".")) !== (stok.get(id) || 0));
  const terakhir = cekFisik.slice(-1)[0];

  const simpan = async () => {
    const hitung = terisi.map(([itemId, v]) => ({ itemId, fisik: v }));
    if (await kirim({ aksi: "cek-fisik", tanggal: hariIni(), hitung })) setFisik({});
  };
  const grup: string[] = [];
  aktif.forEach((i) => { if (!grup.includes(i.peralatan)) grup.push(i.peralatan); });

  return (
    <div>
      <p className="mb-2 rounded-xl bg-sky-50 px-3 py-2 text-[11.5px] leading-relaxed text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200">
        Hitung isi gudang lalu tulis jumlah nyatanya. Barang yang tidak diisi dianggap belum diperiksa.
        Bila hitungan berbeda dari catatan, aplikasi mencatat <b>koreksi</b> dengan tanggal hari ini.
        {terakhir ? <> Cek fisik terakhir {tglPanjang(terakhir.tanggal)} oleh {terakhir.oleh} ({terakhir.diperiksa} barang, {terakhir.berselisih} berselisih).</> : " Belum pernah ada cek fisik."}
      </p>
      <button onClick={() => setFisik(Object.fromEntries(aktif.map((i) => [i.id, String(stok.get(i.id) || 0)])))}
        className="mb-2 text-[11.5px] font-bold text-[#16357f] hover:underline dark:text-sky-300">
        Isi semua sama dengan catatan (lalu ubah yang berbeda saja)
      </button>
      {grup.map((g) => (
        <section key={g} className="mb-3">
          <h2 className="mb-1 px-1 text-[11px] font-black uppercase tracking-wide text-slate-500">{g}</h2>
          <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200 dark:divide-slate-700 dark:bg-slate-900 dark:ring-slate-700">
            {aktif.filter((i) => i.peralatan === g).map((i) => {
              const v = fisik[i.id] ?? "";
              const beda = v.trim() !== "" && Number(v.replace(",", ".")) !== (stok.get(i.id) || 0);
              return (
                <li key={i.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${beda ? "bg-violet-50 dark:bg-violet-950/30" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-slate-800 dark:text-slate-100">{i.nama}</p>
                    <p className="text-[10.5px] text-slate-500">{i.partNumber || "—"} · catatan {stok.get(i.id) || 0} {i.satuan}</p>
                  </div>
                  <input value={v} onChange={(e) => setFisik((x) => ({ ...x, [i.id]: e.target.value }))} inputMode="decimal"
                    placeholder={String(stok.get(i.id) || 0)}
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-[14px] font-bold tabular-nums dark:border-slate-600 dark:bg-slate-900" />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="sticky bottom-[4.2rem] mt-2">
        <button onClick={simpan} disabled={sibuk || !terisi.length}
          className="w-full rounded-xl bg-violet-700 py-3 text-[13.5px] font-bold text-white shadow-lg disabled:opacity-50">
          {sibuk ? "Menyimpan…" : `Simpan cek fisik · ${terisi.length} diperiksa, ${selisih.length} berselisih`}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════ BORANG ════════════════════════════ */
function LayarBorang({ item, mutasi, ttd, setTtd, sibuk, kirim, kapal, bagian }: {
  item: ItemSC[]; mutasi: MutasiSC[]; ttd: PenandaTanganSC; setTtd: (t: PenandaTanganSC) => void;
  sibuk: boolean; kirim: Kirim; kapal: string; bagian: "deck" | "mesin";
}) {
  const [periode, setPeriode] = useState(bulanIni());
  const pilihan = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let k = 0; k < 12; k++) {
      const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
      out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);
  const diBulan = mutasi.filter((m) => m.tanggal.startsWith(periode) && m.jenis !== "awal")
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const nama = new Map(item.map((i) => [i.id, i]));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <label className="flex-1"><span className={kelasLabel}>Bulan</span>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} className={kelasInput}>
            {pilihan.map((p) => <option key={p} value={p}>{namaBulan(p)}</option>)}
          </select>
        </label>
        <button onClick={async () => {
          /* tab dibuka lebih dulu (masih di dalam ketukan) supaya tidak diblok
             peramban; alamatnya diisi sesudah nama penanda tangan tersimpan */
          const w = window.open("", "_blank");
          const ok = await kirim({ aksi: "penanda-tangan", penandaTangan: ttd });
          const url = `/portal/suku-cadang/cetak?periode=${periode}`;
          if (!ok) { w?.close(); return; }
          if (w) w.location.href = url; else window.location.href = url;
        }} disabled={sibuk} className="rounded-xl bg-[#16357f] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
          Cetak / Simpan PDF
        </button>
      </div>

      <details className="mb-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <summary className="cursor-pointer text-[12px] font-bold text-slate-700 dark:text-slate-200">Nama penanda tangan borang</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label><span className={kelasLabel}>Disusun oleh</span>
            <input value={ttd.penyusun} onChange={(e) => setTtd({ ...ttd, penyusun: e.target.value })} className={`${kelasInput} uppercase`} /></label>
          <label><span className={kelasLabel}>Jabatan</span>
            <input value={ttd.jabatanPenyusun} onChange={(e) => setTtd({ ...ttd, jabatanPenyusun: e.target.value })} className={kelasInput} /></label>
          <label><span className={kelasLabel}>Disetujui oleh</span>
            <input value={ttd.penyetuju} onChange={(e) => setTtd({ ...ttd, penyetuju: e.target.value })} className={`${kelasInput} uppercase`} /></label>
          <label><span className={kelasLabel}>Jabatan</span>
            <input value={ttd.jabatanPenyetuju} onChange={(e) => setTtd({ ...ttd, jabatanPenyetuju: e.target.value })} className={kelasInput} /></label>
        </div>
        <button onClick={() => kirim({ aksi: "penanda-tangan", penandaTangan: ttd })} disabled={sibuk}
          className="mt-2 rounded-lg bg-slate-700 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Simpan nama</button>
      </details>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-300">
        <div className="min-w-[900px]">
          <BorangBulanan lembar={{ kapal, bagian, item, mutasi }} periode={periode} penandaTangan={ttd} />
        </div>
      </div>

      <section className="mt-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <h2 className="text-[12px] font-black text-slate-700 dark:text-slate-200">Catatan {namaBulan(periode)} ({diBulan.length})</h2>
        <ul className="mt-1 divide-y divide-slate-100 text-[11.5px] dark:divide-slate-800">
          {diBulan.map((m) => (
            <li key={m.id} className={`flex gap-2 py-1 ${m.dibatalkan ? "text-slate-400 line-through" : ""}`}>
              <span className="w-20 shrink-0">{tglPanjang(m.tanggal).replace(/ \d{4}$/, "")}</span>
              <span className="min-w-0 flex-1">
                <b>{LABEL_MUTASI[m.jenis]} {m.jumlah}</b> {nama.get(m.itemId)?.nama || "?"}{m.keterangan ? ` — ${m.keterangan}` : ""}
                {m.dibatalkan ? ` (dibatalkan: ${m.dibatalkan.alasan})` : ""}
              </span>
            </li>
          ))}
          {!diBulan.length && <li className="py-2 text-slate-500">Belum ada penerimaan atau pemakaian bulan ini.</li>}
        </ul>
      </section>
    </div>
  );
}
