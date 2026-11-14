"use client";
/**
 * Monitor Pekerjaan — daftar kerja pribadi supaya tidak ada yang terlupa.
 *
 * Satu halaman: ringkasan, saringan, daftar, dan borangnya. Daftar diurut menurut
 * tenggat, bukan menurut urutan masuk, karena yang ingin dijawab tiap pagi
 * adalah "apa yang harus kukejar hari ini". Pekerjaan yang lewat tenggat diberi
 * warna merah pada seluruh barisnya dan yang tinggal ≤3 hari berwarna kuning —
 * mata menelusuri baris, bukan kolom.
 *
 * Di layar lebar daftarnya berupa tabel; di HP dan tablet berubah menjadi
 * kartu, karena tabel delapan kolom tak terbaca di layar 375 piksel dan masih
 * harus digeser ke samping di laptop 1024 piksel yang separuhnya dipakai sidebar.
 */
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { MonitorPekerjaanProvider, useMonitorPekerjaan, useNamaSaya } from "@/lib/monitorPekerjaan/store";
import {
  BOBOT_PRIORITAS, KATEGORI, KATEGORI_WARNA, PRIORITAS, PRIORITAS_WARNA, Pekerjaan,
  STATUS_BAR, STATUS_LABEL, STATUS_WARNA, StatusPekerjaan, URUTAN_STATUS,
  adalahTautan, masihAktif, pekerjaanKosong, sisaHari, sisaKeMinggu, tandaTenggat,
} from "@/lib/monitorPekerjaan/types";
import { KAPAL_ANGGARAN } from "@/lib/anggaran/types";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

export default function HalamanMonitorPekerjaan() {
  return (
    <MonitorPekerjaanProvider>
      <Isi />
    </MonitorPekerjaanProvider>
  );
}

/* ── bantu tampilan ──────────────────────────────────────────────────────── */

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** "2026-11-14" → "14 Nov 2026" */
function tglPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  return `${Number(m[3])} ${BLN[Number(m[2]) - 1]} ${m[1]}`;
}

const kapalPendek = (k: string) => k.replace(/^KMP\.?\s*/i, "");

const samaNama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** saringan status: nilai khusus selain nama status */
type SaringStatus = "" | "aktif" | "telat" | "pekan" | StatusPekerjaan;
type Urut = "tenggat" | "prioritas" | "baru";

function masukPekan(p: Pekerjaan): boolean {
  if (!masihAktif(p.status)) return false;
  const s = sisaHari(p.tenggat);
  return s !== null && s >= 0 && s <= sisaKeMinggu();
}

function telat(p: Pekerjaan): boolean {
  return tandaTenggat(p) === "telat";
}

/* ── halaman ─────────────────────────────────────────────────────────────── */

function Isi() {
  const { items, loading, galat, refresh, simpan, hapus, supabaseReady } = useMonitorPekerjaan();
  const [namaSaya, setNamaSaya] = useNamaSaya();
  const [q, setQ] = useState("");
  const [fPemilik, setFPemilik] = useState("");
  const [fStatus, setFStatus] = useState<SaringStatus>("aktif");
  const [fKategori, setFKategori] = useState("");
  const [fKapal, setFKapal] = useState("");
  const [urut, setUrut] = useState<Urut>("tenggat");
  const [sunting, setSunting] = useState<Pekerjaan | null>(null);
  const [gantiNama, setGantiNama] = useState(false);

  const hitung = useMemo(() => {
    const n: Record<StatusPekerjaan, number> & { telat: number; pekan: number; aktif: number } =
      { belum: 0, jalan: 0, menunggu: 0, selesai: 0, batal: 0, telat: 0, pekan: 0, aktif: 0 };
    items.forEach((p) => {
      n[p.status] += 1;
      if (masihAktif(p.status)) n.aktif += 1;
      if (telat(p)) n.telat += 1;
      if (masukPekan(p)) n.pekan += 1;
    });
    return n;
  }, [items]);

  /** rekap per pemilik — siapa memegang berapa, dan berapa yang telat */
  const perPemilik = useMemo(() => {
    const peta = new Map<string, { nama: string; aktif: number; telat: number }>();
    items.forEach((p) => {
      (p.pemilik.length ? p.pemilik : ["(tanpa pemilik)"]).forEach((nama) => {
        const kunci = nama.trim().toLowerCase();
        const d = peta.get(kunci) || { nama, aktif: 0, telat: 0 };
        if (masihAktif(p.status)) d.aktif += 1;
        if (telat(p)) d.telat += 1;
        peta.set(kunci, d);
      });
    });
    return Array.from(peta.values()).sort((a, b) => b.telat - a.telat || b.aktif - a.aktif || a.nama.localeCompare(b.nama));
  }, [items]);

  const namaDikenal = useMemo(() => {
    const s = new Map<string, string>();
    [namaSaya, ...items.flatMap((p) => p.pemilik)].forEach((n) => {
      if (n.trim()) s.set(n.trim().toLowerCase(), s.get(n.trim().toLowerCase()) || n.trim());
    });
    return Array.from(s.values()).sort((a, b) => a.localeCompare(b));
  }, [items, namaSaya]);

  const kapalAda = useMemo(
    () => KAPAL_ANGGARAN.filter((k) => items.some((p) => p.kapal.includes(k))), [items]);

  const tersaring = useMemo(() => {
    const kata = q.trim().toLowerCase();
    const hasil = items.filter((p) => {
      if (fPemilik === "__tanpa") { if (p.pemilik.length) return false; }
      else if (fPemilik && !p.pemilik.some((n) => samaNama(n, fPemilik))) return false;
      if (fStatus === "aktif" && !masihAktif(p.status)) return false;
      if (fStatus === "telat" && !telat(p)) return false;
      if (fStatus === "pekan" && !masukPekan(p)) return false;
      if (URUTAN_STATUS.includes(fStatus as StatusPekerjaan) && p.status !== fStatus) return false;
      if (fKategori && p.kategori !== fKategori) return false;
      if (fKapal === "__tanpa") { if (p.kapal.length) return false; }
      else if (fKapal && !p.kapal.includes(fKapal)) return false;
      if (kata) {
        const gabung = [p.judul, p.langkahBerikut, p.menungguSiapa, p.dokumen, p.catatan,
          p.pemilik.join(" "), p.kapal.join(" "), p.kategori].join(" ").toLowerCase();
        if (!gabung.includes(kata)) return false;
      }
      return true;
    });

    const aktifDulu = (a: Pekerjaan, b: Pekerjaan) =>
      (masihAktif(a.status) ? 0 : 1) - (masihAktif(b.status) ? 0 : 1);
    const tenggatNaik = (a: Pekerjaan, b: Pekerjaan) => {
      // tanpa tenggat jatuh paling bawah, bukan hilang
      const ta = a.tenggat || "9999-12-31";
      const tb = b.tenggat || "9999-12-31";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    };
    const prioritasNaik = (a: Pekerjaan, b: Pekerjaan) =>
      (BOBOT_PRIORITAS[a.prioritas] ?? 9) - (BOBOT_PRIORITAS[b.prioritas] ?? 9);
    const baruDulu = (a: Pekerjaan, b: Pekerjaan) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "");

    return hasil.sort((a, b) => {
      const d = aktifDulu(a, b);
      if (d) return d;
      // yang sudah lepas dari tangan: yang paling baru selesai di atas
      if (!masihAktif(a.status)) return (b.tglSelesai || "").localeCompare(a.tglSelesai || "") || baruDulu(a, b);
      if (urut === "prioritas") return prioritasNaik(a, b) || tenggatNaik(a, b);
      if (urut === "baru") return baruDulu(a, b);
      return tenggatNaik(a, b) || prioritasNaik(a, b);
    });
  }, [items, q, fPemilik, fStatus, fKategori, fKapal, urut]);

  const adaSaringan = !!(q || fPemilik || fStatus !== "aktif" || fKategori || fKapal);
  const bersihkan = () => { setQ(""); setFPemilik(""); setFStatus("aktif"); setFKategori(""); setFKapal(""); };

  const hapusPekerjaan = async (p: Pekerjaan) => {
    const ya = await konfirmasi({
      judul: "Hapus pekerjaan ini?",
      pesan: p.judul || "(tanpa judul)",
      tegasan: "Catatan yang dihapus tidak bisa dikembalikan.",
      tombolYa: "Hapus", tombolTidak: "Batal", nada: "bahaya",
    });
    if (ya) await hapus(p.id);
  };

  const gantiStatus = async (p: Pekerjaan, status: StatusPekerjaan) => {
    if (status === p.status) return;
    if (status === "menunggu" && !p.menungguSiapa.trim()) {
      // menunggu tanpa tahu menunggu siapa tidak membantu apa-apa — buka borangnya
      setSunting({ ...p, status });
      return;
    }
    await simpan({ ...p, status });
  };

  const pilihKartu = (s: SaringStatus) => setFStatus(fStatus === s ? "aktif" : s);

  return (
    <main className="mx-auto max-w-[105rem] px-3 py-4 sm:px-4 sm:py-6">
      <header className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass flex flex-wrap items-center gap-3 rounded-[calc(1.5rem-1.5px)] px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
          <div className="hidden shrink-0 rounded-2xl bg-white p-2.5 ring-1 ring-black/5 elev-md sm:block">
            <Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" />
          </div>
          <div className="min-w-0 flex-1 basis-[14rem]">
            <h1 className="asdp-text-gradient text-xl font-extrabold leading-tight sm:text-2xl">Monitor Pekerjaan</h1>
            <p className="mt-0.5 text-[13px] text-slate-500 sm:text-sm">
              Catat setiap pekerjaan yang sedang dipegang — tenggat, langkah berikutnya, dan sedang menunggu siapa.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {gantiNama ? (
              <FormNama awal={namaSaya} onSimpan={(n) => { setNamaSaya(n); setGantiNama(false); }}
                onBatal={() => setGantiNama(false)} />
            ) : (
              <button onClick={() => setGantiNama(true)} className="btn btn-ghost px-3 py-2 text-xs"
                title="Nama ini dipakai sebagai pemilik bawaan pekerjaan baru di peramban ini">
                👤 {namaSaya} <span className="text-slate-400">· ganti</span>
              </button>
            )}
            <button onClick={() => setSunting(pekerjaanKosong(namaSaya))}
              className="btn btn-primary flex-1 px-5 py-2.5 text-sm sm:flex-none">
              ＋ Tambah Pekerjaan
            </button>
          </div>
        </div>
      </header>

      {!supabaseReady && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Supabase belum tersambung — daftar pekerjaan tersimpan di peramban ini saja.
        </p>
      )}
      {galat && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200">{galat}</p>
      )}

      {/* ── ringkasan ─────────────────────────────────────────────────────── */}
      <section className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-7">
        <Angka label="Terlambat" nilai={hitung.telat} bar="bg-red-600" nada={hitung.telat ? "merah" : undefined}
          sub={hitung.telat ? "lewat tenggat" : "tidak ada"}
          aktif={fStatus === "telat"} onKlik={() => pilihKartu("telat")} />
        <Angka label="Jatuh tempo minggu ini" nilai={hitung.pekan} bar="bg-amber-500"
          nada={hitung.pekan ? "kuning" : undefined}
          sub={`s.d. Minggu ${tglPendek(tambahHari(sisaKeMinggu())).replace(/ \d{4}$/, "")}`}
          aktif={fStatus === "pekan"} onKlik={() => pilihKartu("pekan")} />
        {/* di HP lima status menjadi satu jalur geser — tujuh kartu bertumpuk
            mendorong daftar pekerjaannya sampai ke layar ketiga */}
        <div className="col-span-2 -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:col-span-5">
          {URUTAN_STATUS.map((s) => (
            <Angka key={s} label={STATUS_LABEL[s]} nilai={hitung[s]} bar={STATUS_BAR[s]} ringkas
              aktif={fStatus === s} onKlik={() => pilihKartu(s)} />
          ))}
        </div>
      </section>

      {perPemilik.length > 1 && (
        <section className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {perPemilik.map((d) => {
            const nilai = d.nama === "(tanpa pemilik)" ? "__tanpa" : d.nama;
            const dipilih = fPemilik === nilai || (nilai !== "__tanpa" && !!fPemilik && samaNama(fPemilik, nilai));
            return (
              <button key={d.nama} onClick={() => setFPemilik(dipilih ? "" : nilai)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] ring-1 transition ${
                  dipilih ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"}`}>
                <b>{d.nama}</b>
                <span className="ml-1.5 tabular-nums opacity-80">{d.aktif} aktif</span>
                {d.telat > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    dipilih ? "bg-white/20" : "bg-red-100 text-red-700"}`}>{d.telat} telat</span>
                )}
              </button>
            );
          })}
        </section>
      )}

      {/* ── saringan ──────────────────────────────────────────────────────── */}
      <section className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 cari pekerjaan…"
          className="inp col-span-2 sm:min-w-[14rem] sm:flex-1" />
        <select value={fPemilik} onChange={(e) => setFPemilik(e.target.value)} className="inp sm:w-auto"
          aria-label="Saring pemilik">
          <option value="">Semua pemilik</option>
          {namaDikenal.map((n) => <option key={n} value={n}>{samaNama(n, namaSaya) ? `${n} (saya)` : n}</option>)}
          <option value="__tanpa">(tanpa pemilik)</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as SaringStatus)} className="inp sm:w-auto"
          aria-label="Saring status">
          <option value="aktif">Masih berjalan ({hitung.aktif})</option>
          <option value="">Semua status ({items.length})</option>
          <option value="telat">Terlambat ({hitung.telat})</option>
          <option value="pekan">Jatuh tempo minggu ini ({hitung.pekan})</option>
          {URUTAN_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]} ({hitung[s]})</option>)}
        </select>
        <select value={fKategori} onChange={(e) => setFKategori(e.target.value)} className="inp sm:w-auto"
          aria-label="Saring kategori">
          <option value="">Semua kategori</option>
          {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={fKapal} onChange={(e) => setFKapal(e.target.value)} className="inp sm:w-auto"
          aria-label="Saring kapal">
          <option value="">Semua kapal</option>
          {(kapalAda.length ? kapalAda : KAPAL_ANGGARAN).map((k) => <option key={k} value={k}>{k}</option>)}
          <option value="__tanpa">(tanpa kapal)</option>
        </select>
        <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)} className="inp sm:w-auto"
          aria-label="Urutkan">
          <option value="tenggat">Urut: tenggat</option>
          <option value="prioritas">Urut: prioritas</option>
          <option value="baru">Urut: baru diubah</option>
        </select>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          {adaSaringan && (
            <button onClick={bersihkan} className="btn btn-ghost flex-1 text-xs sm:flex-none">✕ Bersihkan</button>
          )}
          <button onClick={refresh} className="btn btn-ghost flex-1 text-xs sm:flex-none">↻ Muat ulang</button>
        </div>
      </section>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span>{tersaring.length} dari {items.length} pekerjaan</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> lewat tenggat</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> tenggat ≤ 3 hari</span>
      </p>

      {loading && !items.length && <p className="mt-4 text-sm text-slate-500">memuat…</p>}

      {!loading && !tersaring.length && (
        <div className="mt-3 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-line elev-sm">
          {items.length ? (
            <>Tidak ada pekerjaan yang cocok dengan saringan.{" "}
              <button onClick={bersihkan} className="font-semibold text-sky-700 hover:underline">Tampilkan semua</button></>
          ) : (
            <>Belum ada pekerjaan tercatat. Tekan <b>＋ Tambah Pekerjaan</b> untuk mencatat yang pertama.</>
          )}
        </div>
      )}

      {!!tersaring.length && (
        <>
          {/* HP & tablet: kartu */}
          <ul className="mt-2 grid gap-2.5 md:grid-cols-2 xl:hidden">
            {tersaring.map((p) => (
              <Kartu key={p.id} p={p} namaSaya={namaSaya}
                onSunting={() => setSunting(p)} onHapus={() => hapusPekerjaan(p)}
                onStatus={(s) => gantiStatus(p, s)} />
            ))}
          </ul>

          {/* layar lebar (≥1280 px, sudah dikurangi sidebar): tabel */}
          <div className="mt-2 hidden overflow-x-auto rounded-2xl bg-white ring-line elev-md xl:block">
            <table className="w-full min-w-[60rem] text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <tr className="border-b-2 border-slate-200">
                  <th className="w-9 p-2 text-center">#</th>
                  <th className="p-2 text-left">Pekerjaan</th>
                  <th className="w-28 p-2 text-left">Pemilik</th>
                  <th className="w-40 p-2 text-left">Status</th>
                  <th className="w-24 p-2 text-left">Progres</th>
                  <th className="w-28 p-2 text-center">Tenggat</th>
                  <th className="w-[22%] p-2 text-left">Langkah berikutnya</th>
                  <th className="w-24 p-2"></th>
                </tr>
              </thead>
              <tbody>
                {tersaring.map((p, i) => (
                  <Baris key={p.id} p={p} n={i + 1} namaSaya={namaSaya}
                    onSunting={() => setSunting(p)} onHapus={() => hapusPekerjaan(p)}
                    onStatus={(s) => gantiStatus(p, s)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sunting && (
        <Borang
          awal={sunting}
          baru={!items.some((x) => x.id === sunting.id)}
          namaDikenal={namaDikenal}
          onTutup={() => setSunting(null)}
          onSimpan={async (p) => { if (await simpan(p)) setSunting(null); }}
        />
      )}
    </main>
  );
}

function tambahHari(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── komponen kecil ──────────────────────────────────────────────────────── */

function FormNama({ awal, onSimpan, onBatal }: { awal: string; onSimpan: (n: string) => void; onBatal: () => void }) {
  const [n, setN] = useState(awal);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSimpan(n); }} className="flex flex-1 items-center gap-1.5 sm:flex-none">
      <input autoFocus value={n} onChange={(e) => setN(e.target.value)} className="inp min-w-0 flex-1 py-1.5 sm:w-36"
        placeholder="Nama saya" aria-label="Nama saya" />
      <button type="submit" className="btn btn-success px-3 py-1.5 text-xs">OK</button>
      <button type="button" onClick={onBatal} className="btn btn-ghost px-2.5 py-1.5 text-xs">Batal</button>
    </form>
  );
}

function Angka({ label, nilai, bar, sub, nada, aktif, onKlik, ringkas }: {
  label: string; nilai: number; bar: string; sub?: string;
  nada?: "merah" | "kuning"; aktif?: boolean; onKlik?: () => void;
  /** kartu kecil berlebar tetap untuk jalur geser di HP */
  ringkas?: boolean;
}) {
  // warna tipis DILAPIS di atas putih, bukan latar tembus pandang: di atas
  // gradasi halaman, merah 7% terbaca abu-abu
  const latar = nada === "merah" ? "bg-white bg-[linear-gradient(rgba(239,68,68,0.09),rgba(239,68,68,0.09))]"
    : nada === "kuning" ? "bg-white bg-[linear-gradient(rgba(251,191,36,0.14),rgba(251,191,36,0.14))]" : "bg-white";
  return (
    <button type="button" onClick={onKlik} aria-pressed={aktif}
      className={`relative overflow-hidden rounded-2xl pl-4 pr-3 text-left ring-1 elev-sm transition ${latar} ${
        ringkas ? "w-[8.5rem] shrink-0 py-2 sm:w-auto sm:py-2.5" : "py-2.5"} ${
        aktif ? "ring-2 ring-sky-500" : "ring-slate-200 hover:ring-slate-400"}`}>
      <span className={`absolute bottom-0 left-0 top-0 w-1.5 ${bar}`} />
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`${ringkas ? "text-xl sm:text-2xl" : "text-2xl"} font-extrabold leading-tight tabular-nums ${
        nada === "merah" ? "text-red-700" : nada === "kuning" ? "text-amber-700" : "text-slate-900"}`}>{nilai}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</p>}
    </button>
  );
}

function SisaHari({ p }: { p: Pekerjaan }) {
  if (!masihAktif(p.status)) {
    return p.status === "selesai" && p.tglSelesai
      ? <span className="text-[10px] text-emerald-700">selesai {tglPendek(p.tglSelesai)}</span>
      : null;
  }
  const s = sisaHari(p.tenggat);
  if (s === null) return <span className="text-[10px] text-slate-400">tanpa tenggat</span>;
  const kelas = s < 0 ? "bg-red-600 text-white" : s <= 3 ? "bg-amber-400 text-amber-950" : "bg-slate-100 text-slate-600";
  const teks = s < 0 ? `telat ${-s} hari` : s === 0 ? "hari ini" : s === 1 ? "besok" : `${s} hari lagi`;
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${kelas}`}>{teks}</span>;
}

function Progres({ p }: { p: Pekerjaan }) {
  const nilai = Math.max(0, Math.min(100, p.progres || 0));
  const warna = p.status === "selesai" ? "bg-emerald-500" : p.status === "batal" ? "bg-zinc-400"
    : tandaTenggat(p) === "telat" ? "bg-red-500" : "bg-sky-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${warna}`} style={{ width: `${nilai}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] font-bold tabular-nums text-slate-600">{nilai}%</span>
    </div>
  );
}

function PilihStatus({ p, onStatus }: { p: Pekerjaan; onStatus: (s: StatusPekerjaan) => void }) {
  return (
    <span className="relative block">
      <select value={p.status} onChange={(e) => onStatus(e.target.value as StatusPekerjaan)}
        aria-label="Ubah status" title="Ubah status langsung dari daftar"
        className={`w-full cursor-pointer appearance-none rounded-full py-1 pl-2.5 pr-6 text-[11px] font-bold ring-1 outline-none ${STATUS_WARNA[p.status]}`}>
        {URUTAN_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▾</span>
    </span>
  );
}

function Dokumen({ teks }: { teks: string }) {
  if (!teks.trim()) return null;
  const bagian = teks.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
  return (
    <span className="flex flex-wrap gap-1">
      {bagian.map((b, i) => adalahTautan(b) ? (
        <a key={i} href={b} target="_blank" rel="noreferrer"
          className="max-w-[16rem] truncate rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200 hover:underline">
          🔗 {b.replace(/^https?:\/\/(www\.)?/i, "")}
        </a>
      ) : (
        <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">📄 {b}</span>
      ))}
    </span>
  );
}

function Lencana({ p }: { p: Pekerjaan }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${KATEGORI_WARNA[p.kategori] || KATEGORI_WARNA.Lainnya}`}>
        {p.kategori}
      </span>
      <span className={`text-[10px] font-bold ${PRIORITAS_WARNA[p.prioritas] || "text-slate-500"}`}>
        {p.prioritas === "Tinggi" ? "▲ " : p.prioritas === "Rendah" ? "▽ " : "◆ "}{p.prioritas}
      </span>
      {p.kapal.map((k) => (
        <span key={k} className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
          🚢 {kapalPendek(k)}
        </span>
      ))}
    </span>
  );
}

/** warna baris/kartu menurut tenggat */
function warnaTanda(p: Pekerjaan): { latar: string; garis: string } {
  const t = tandaTenggat(p);
  if (t === "telat") return { latar: "bg-red-500/[0.08] hover:bg-red-500/[0.12]", garis: "border-l-red-500" };
  if (t === "dekat") return { latar: "bg-amber-400/[0.14] hover:bg-amber-400/[0.2]", garis: "border-l-amber-400" };
  if (!masihAktif(p.status)) return { latar: "opacity-70 hover:opacity-100", garis: "border-l-transparent" };
  return { latar: "hover:bg-slate-50", garis: "border-l-transparent" };
}

function Pemilik({ p, namaSaya }: { p: Pekerjaan; namaSaya: string }) {
  if (!p.pemilik.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {p.pemilik.map((n) => (
        <span key={n} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          samaNama(n, namaSaya) ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>{n}</span>
      ))}
    </span>
  );
}

function Baris({ p, n, namaSaya, onSunting, onHapus, onStatus }: {
  p: Pekerjaan; n: number; namaSaya: string;
  onSunting: () => void; onHapus: () => void; onStatus: (s: StatusPekerjaan) => void;
}) {
  const w = warnaTanda(p);
  return (
    <tr className={`border-b border-slate-100 align-top transition ${w.latar}`}>
      <td className={`border-l-4 p-2 text-center tabular-nums text-slate-400 ${w.garis}`}>{n}</td>
      <td className="p-2">
        <button onClick={onSunting} className="text-left font-semibold leading-snug text-slate-800 hover:text-sky-700 hover:underline">
          {p.judul || "(tanpa judul)"}
        </button>
        <div className="mt-1"><Lencana p={p} /></div>
        {p.dokumen && <div className="mt-1"><Dokumen teks={p.dokumen} /></div>}
      </td>
      <td className="p-2"><Pemilik p={p} namaSaya={namaSaya} /></td>
      <td className="p-2">
        <PilihStatus p={p} onStatus={onStatus} />
        {p.status === "menunggu" && p.menungguSiapa && (
          <p className="mt-1 text-[10px] font-semibold text-violet-700">⏳ {p.menungguSiapa}</p>
        )}
      </td>
      <td className="p-2 pt-3"><Progres p={p} /></td>
      <td className="p-2 text-center">
        <p className={`tabular-nums ${tandaTenggat(p) === "telat" ? "font-bold text-red-700" : "text-slate-700"}`}>
          {p.tenggat ? tglPendek(p.tenggat) : "—"}
        </p>
        <div className="mt-0.5"><SisaHari p={p} /></div>
      </td>
      <td className="p-2">
        {p.langkahBerikut
          ? <p className="leading-snug text-slate-700">➜ {p.langkahBerikut}</p>
          : masihAktif(p.status) ? <p className="italic text-slate-400">belum ditentukan</p> : null}
        {p.status !== "menunggu" && p.menungguSiapa && masihAktif(p.status) && (
          <p className="mt-0.5 text-[10px] text-violet-700">⏳ {p.menungguSiapa}</p>
        )}
        {p.catatan && <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">📝 {p.catatan}</p>}
      </td>
      <td className="whitespace-nowrap p-2 text-right">
        <button onClick={onSunting} className="btn btn-primary mr-1 px-2 py-0.5 text-[10px]">Ubah</button>
        <button onClick={onHapus} className="btn btn-danger-soft px-2 py-0.5 text-[10px]">Hapus</button>
      </td>
    </tr>
  );
}

function Kartu({ p, namaSaya, onSunting, onHapus, onStatus }: {
  p: Pekerjaan; namaSaya: string;
  onSunting: () => void; onHapus: () => void; onStatus: (s: StatusPekerjaan) => void;
}) {
  const w = warnaTanda(p);
  return (
    <li className={`rounded-2xl border-l-4 bg-white ring-1 ring-slate-200 elev-sm ${w.garis}`}>
      <div className={`rounded-r-2xl px-3 py-3 ${w.latar}`}>
        <div className="flex items-start gap-2">
          <button onClick={onSunting} className="min-w-0 flex-1 text-left text-[14px] font-bold leading-snug text-slate-800">
            {p.judul || "(tanpa judul)"}
          </button>
          <div className="shrink-0 text-right">
            <p className={`text-[11px] tabular-nums ${tandaTenggat(p) === "telat" ? "font-bold text-red-700" : "text-slate-600"}`}>
              {p.tenggat ? tglPendek(p.tenggat) : ""}
            </p>
            <SisaHari p={p} />
          </div>
        </div>
        <div className="mt-1.5"><Lencana p={p} /></div>

        {(p.langkahBerikut || p.menungguSiapa) && masihAktif(p.status) && (
          <div className="mt-2 space-y-0.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[12px]">
            {p.langkahBerikut && <p className="leading-snug text-slate-700">➜ {p.langkahBerikut}</p>}
            {p.menungguSiapa && <p className="text-[11px] font-semibold text-violet-700">⏳ menunggu {p.menungguSiapa}</p>}
          </div>
        )}
        {p.dokumen && <div className="mt-1.5"><Dokumen teks={p.dokumen} /></div>}

        <div className="mt-2"><Progres p={p} /></div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1"><Pemilik p={p} namaSaya={namaSaya} /></div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1"><PilihStatus p={p} onStatus={onStatus} /></div>
          <button onClick={onSunting} className="btn btn-primary px-3 py-1.5 text-[11px]">Ubah</button>
          <button onClick={onHapus} className="btn btn-danger-soft px-3 py-1.5 text-[11px]">Hapus</button>
        </div>
      </div>
    </li>
  );
}

/* ── borang ──────────────────────────────────────────────────────────────── */

function Borang({ awal, baru, namaDikenal, onTutup, onSimpan }: {
  awal: Pekerjaan; baru: boolean; namaDikenal: string[];
  onTutup: () => void; onSimpan: (p: Pekerjaan) => Promise<void>;
}) {
  const [p, setP] = useState<Pekerjaan>(awal);
  const [pemilikTeks, setPemilikTeks] = useState(awal.pemilik.join(", "));
  const [sibuk, setSibuk] = useState(false);

  const ubah = <K extends keyof Pekerjaan>(k: K, v: Pekerjaan[K]) => setP((x) => ({ ...x, [k]: v }));

  // Esc menutup borang; layar di belakangnya tidak ikut tergulir
  useEffect(() => {
    const tombol = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || sibuk) return;
      // dialog peringatan di atas borang ditutup lebih dulu — isian borang jangan ikut hilang
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      onTutup();
    };
    document.addEventListener("keydown", tombol);
    const semula = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tombol); document.body.style.overflow = semula; };
  }, [onTutup, sibuk]);

  const daftarPemilik = pemilikTeks.split(",").map((s) => s.trim()).filter(Boolean);
  const tambahPemilik = (n: string) => {
    if (daftarPemilik.some((x) => samaNama(x, n))) return;
    setPemilikTeks([...daftarPemilik, n].join(", "));
  };

  const alihKapal = (k: string) =>
    setP((x) => ({ ...x, kapal: x.kapal.includes(k) ? x.kapal.filter((y) => y !== k) : [...x.kapal, k] }));

  const pilihStatus = (s: StatusPekerjaan) => setP((x) => ({
    ...x, status: s,
    progres: s === "selesai" ? 100 : x.progres,
    tglSelesai: s === "selesai" || s === "batal" ? (x.tglSelesai || hariIni()) : "",
  }));

  const simpanBorang = async () => {
    const isi: Pekerjaan = { ...p, pemilik: daftarPemilik };
    if (!isi.judul.trim()) { await beritahu("Judul pekerjaan belum diisi."); return; }
    if (!isi.pemilik.length) { await beritahu("Pemilik / PIC belum diisi — minimal satu nama."); return; }
    if (isi.status === "menunggu" && !isi.menungguSiapa.trim()) {
      await beritahu("Status \"Menunggu pihak lain\" — isi juga sedang menunggu siapa.");
      return;
    }
    if (isi.tglMulai && isi.tenggat && isi.tenggat < isi.tglMulai) {
      await beritahu("Tenggat tidak bisa lebih awal dari tanggal mulai.");
      return;
    }
    setSibuk(true);
    try { await onSimpan(isi); } finally { setSibuk(false); }
  };

  const saran = namaDikenal.filter((n) => !daftarPemilik.some((x) => samaNama(x, n)));
  const lepas = p.status === "selesai" || p.status === "batal";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-slate-900/50 sm:items-start sm:p-4"
      role="dialog" aria-modal="true" aria-label={baru ? "Pekerjaan baru" : "Ubah pekerjaan"}>
      {/* isian 16 px di HP: Safari iPhone memperbesar layar bila huruf isian lebih kecil */}
      <div className="flex min-h-full w-full max-w-3xl flex-col bg-white elev-lg sm:min-h-0 sm:rounded-2xl [&_.inp]:text-base sm:[&_.inp]:text-[0.8125rem]">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:rounded-t-2xl sm:px-5">
          <h2 className="font-bold text-slate-800">{baru ? "Pekerjaan Baru" : "Ubah Pekerjaan"}</h2>
          <button onClick={onTutup} className="btn btn-ghost ml-auto text-xs">Tutup</button>
        </div>

        <div className="grid flex-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div className="sm:col-span-2">
            <Medan label="Judul pekerjaan" wajib>
              <input value={p.judul} onChange={(e) => ubah("judul", e.target.value)} className="inp" autoFocus={baru}
                placeholder="mis. Susun repair list docking KMP. Tuna" />
            </Medan>
          </div>

          <div className="sm:col-span-2">
            <Medan label="Pemilik / PIC" wajib petunjuk="Pisahkan dengan koma bila lebih dari satu orang.">
              <input value={pemilikTeks} onChange={(e) => setPemilikTeks(e.target.value)} className="inp"
                placeholder="mis. Irsan, Budi" />
            </Medan>
            {saran.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {saran.slice(0, 12).map((n) => (
                  <button key={n} type="button" onClick={() => tambahPemilik(n)}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-sky-100 hover:text-sky-800">
                    ＋ {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Medan label="Kategori">
            <select value={p.kategori} onChange={(e) => ubah("kategori", e.target.value)} className="inp">
              {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Medan>
          <Medan label="Prioritas">
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORITAS.map((pr) => (
                <button key={pr} type="button" onClick={() => ubah("prioritas", pr)}
                  className={`rounded-lg py-2 text-xs font-bold ring-1 transition ${
                    p.prioritas === pr
                      ? pr === "Tinggi" ? "bg-red-600 text-white ring-red-600"
                        : pr === "Sedang" ? "bg-amber-500 text-white ring-amber-500" : "bg-slate-600 text-white ring-slate-600"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-400"}`}>
                  {pr}
                </button>
              ))}
            </div>
          </Medan>

          <div className="sm:col-span-2">
            <Medan label="Kapal terkait" petunjuk="Boleh lebih dari satu; kosongkan bila tidak menyangkut kapal tertentu.">
              <div className="flex flex-wrap gap-1.5">
                {KAPAL_ANGGARAN.map((k) => {
                  const on = p.kapal.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => alihKapal(k)} aria-pressed={on}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${
                        on ? "bg-[#16357f] text-white ring-[#16357f]" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-400"}`}>
                      {kapalPendek(k)}
                    </button>
                  );
                })}
              </div>
            </Medan>
          </div>

          <Medan label="Status">
            <select value={p.status} onChange={(e) => pilihStatus(e.target.value as StatusPekerjaan)} className="inp">
              {URUTAN_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Medan>
          <Medan label={`Progres — ${p.progres}%`}>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} step={5} value={p.progres}
                onChange={(e) => ubah("progres", Number(e.target.value))}
                disabled={p.status === "selesai"} className="h-9 flex-1 accent-sky-600" aria-label="Progres" />
              <input type="number" min={0} max={100} value={p.progres}
                onChange={(e) => ubah("progres", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                disabled={p.status === "selesai"} className="inp w-20 text-right" aria-label="Progres persen" />
            </div>
          </Medan>

          <Medan label="Tanggal mulai">
            <input type="date" value={p.tglMulai} onChange={(e) => ubah("tglMulai", e.target.value)} className="inp" />
          </Medan>
          <Medan label="Tenggat">
            <input type="date" value={p.tenggat} onChange={(e) => ubah("tenggat", e.target.value)} className="inp" />
          </Medan>

          <div className="sm:col-span-2">
            <Medan label="Langkah berikutnya" petunjuk="Satu tindakan nyata yang harus dikerjakan sesudah ini.">
              <textarea value={p.langkahBerikut} onChange={(e) => ubah("langkahBerikut", e.target.value)}
                rows={2} className="inp" placeholder="mis. Minta penawaran harga ke 3 vendor" />
            </Medan>
          </div>

          <Medan label="Menunggu siapa" wajib={p.status === "menunggu"}>
            <input value={p.menungguSiapa} onChange={(e) => ubah("menungguSiapa", e.target.value)} className="inp"
              placeholder="mis. SCM, Nakhoda KMP. Tuna, Kantor Pusat" />
          </Medan>
          <Medan label="Dokumen terkait" petunjuk="No. PR / SPPBJ / PO atau tautan; pisahkan dengan titik koma.">
            <input value={p.dokumen} onChange={(e) => ubah("dokumen", e.target.value)} className="inp"
              placeholder="mis. PR 1000123456; PO 4500012345" />
          </Medan>

          <div className="sm:col-span-2">
            <Medan label="Catatan">
              <textarea value={p.catatan} onChange={(e) => ubah("catatan", e.target.value)} rows={3} className="inp" />
            </Medan>
          </div>

          {lepas && (
            <Medan label={p.status === "batal" ? "Tanggal dibatalkan" : "Tanggal selesai"}>
              <input type="date" value={p.tglSelesai} onChange={(e) => ubah("tglSelesai", e.target.value)} className="inp" />
            </Medan>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:rounded-b-2xl sm:px-5">
          <p className="hidden text-[11px] text-slate-500 sm:block">Tersimpan ke basis data cabang.</p>
          <button onClick={onTutup} disabled={sibuk} className="btn btn-ghost ml-auto text-xs">Batal</button>
          <button onClick={simpanBorang} disabled={sibuk} className="btn btn-success px-5 text-xs">
            {sibuk ? "menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function hariIni(): string { return tambahHari(0); }

function Medan({ label, children, wajib, petunjuk }:
  { label: string; children: React.ReactNode; wajib?: boolean; petunjuk?: string }) {
  return (
    <div className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
        {label}{wajib && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {petunjuk && <span className="mt-1 block text-[10px] text-slate-500">{petunjuk}</span>}
    </div>
  );
}
