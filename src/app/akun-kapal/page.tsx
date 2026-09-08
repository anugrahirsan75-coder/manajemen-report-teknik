"use client";
/**
 * Akun Portal Kapal — dikelola kantor.
 *
 * Sandi awal hanya ditampilkan SEKALI, tepat sesudah dibuat atau diatur ulang.
 * Sesudah itu yang tersimpan cuma sidiknya; kantor pun tidak bisa membacanya
 * lagi. Itu memang tujuannya — sandi yang masih bisa dibaca kantor bukan lagi
 * milik kapal, dan setiap orang yang bisa membacanya menjadi orang yang bisa
 * mengaku sebagai kapal itu.
 *
 * Karena itu daftar sandi baru di layar ini diberi tombol salin: ia harus
 * dikirimkan ke kapal sekarang juga, bukan dicatat untuk nanti.
 */
import { useCallback, useEffect, useState } from "react";
import { Ikon } from "@/components/ikon";
import { konfirmasi } from "@/components/Konfirmasi";

interface Akun {
  id: string; kapal: string; bagian: "deck" | "mesin"; nama: string;
  aktif: boolean; dibuatPada: string; terakhirMasuk: string; sandiDiubahPada: string; catatan: string;
}

const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "belum pernah";

export default function AkunKapal() {
  const [akun, setAkun] = useState<Akun[]>([]);
  const [belum, setBelum] = useState<{ kapal: string; bagian: string; nama: string }[]>([]);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  /** sandi yang baru saja dibuat — hanya hidup di layar ini, tidak pernah disimpan */
  const [sandiBaru, setSandiBaru] = useState<{ nama: string; sandi: string; kapal?: string }[]>([]);

  const ambil = useCallback(async () => {
    setMuat(true); setGalat("");
    try {
      const r = await fetch("/api/akun-kapal", { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal memuat akun");
      setAkun(d.akun || []);
      setBelum(d.belum || []);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setMuat(false); }
  }, []);

  useEffect(() => { void ambil(); }, [ambil]);

  const buatSemua = async () => {
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "🔑", judul: `Buatkan ${belum.length} akun kapal?`,
      pesan: "Tiap kapal mendapat akun Deck dan akun Mesin.",
      rincian: [
        "Sandi awal ditampilkan SEKALI di layar ini — salin dan kirimkan ke kapal sekarang.",
        "Sesudah halaman ditutup, sandi tidak bisa dibaca lagi oleh siapa pun, termasuk kantor.",
        "Akun yang sudah ada tidak diubah.",
      ],
      tombolYa: "Buatkan akun",
    }))) return;

    setSibuk("buat"); setGalat("");
    try {
      const r = await fetch("/api/akun-kapal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "buat-semua" }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal membuat akun");
      setSandiBaru(d.dibuat || []);
      await ambil();
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(""); }
  };

  const reset = async (a: Akun) => {
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "🔑", judul: `Atur ulang sandi ${a.nama}?`,
      pesan: `${a.kapal} · bagian ${a.bagian}`,
      rincian: ["Sandi lama langsung tidak berlaku.", "Sandi baru ditampilkan sekali — kirimkan ke kapal segera."],
      tombolYa: "Atur ulang sandi",
    }))) return;

    setSibuk(a.id); setGalat("");
    try {
      const r = await fetch("/api/akun-kapal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "reset", id: a.id }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal mengatur ulang");
      setSandiBaru([{ nama: d.nama, sandi: d.sandi, kapal: a.kapal }]);
      await ambil();
    } catch (e: any) { setGalat(e?.message || String(e)); }
    finally { setSibuk(""); }
  };

  const alihAktif = async (a: Akun) => {
    setSibuk(a.id);
    try {
      await fetch("/api/akun-kapal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: a.aktif ? "nonaktif" : "aktif", id: a.id }),
      });
      await ambil();
    } finally { setSibuk(""); }
  };

  const salinSemua = () => {
    const teks = sandiBaru
      .map((s) => `${s.kapal ? `${s.kapal} — ` : ""}${s.nama} : ${s.sandi}`)
      .join("\n");
    void navigator.clipboard?.writeText(`AKUN PORTAL KAPAL\nAlamat: ${location.origin}/portal\n\n${teks}`);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#16357f] text-white">
            <Ikon nama="perisai" className="h-5 w-5" />
          </span>
          <div className="min-w-[16rem] flex-1">
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Akun Portal Kapal</h1>
            <p className="text-[11.5px] text-slate-500">
              Dua akun tiap kapal — Deck dan Mesin. Alamat portalnya:{" "}
              <b className="text-[#16357f] dark:text-sky-300">/portal</b>
            </p>
          </div>
          {!!belum.length && (
            <button onClick={buatSemua} disabled={!!sibuk}
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {sibuk === "buat" ? "Membuat…" : `Buatkan ${belum.length} akun yang belum ada`}
            </button>
          )}
          <button onClick={ambil} disabled={muat}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16357f] px-3 py-2 text-[11.5px] font-bold text-white disabled:opacity-50">
            <Ikon nama="segarkan" className={`h-3.5 w-3.5 ${muat ? "animate-spin" : ""}`} /> Muat ulang
          </button>
        </div>
      </header>

      {galat && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">{galat}</p>}

      {!!sandiBaru.length && (
        <section className="mb-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-[13px] font-black text-emerald-900 dark:text-emerald-200">
              {sandiBaru.length} sandi baru — hanya ditampilkan sekali
            </h2>
            <button onClick={salinSemua}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11.5px] font-bold text-white">Salin semua</button>
            <button onClick={() => setSandiBaru([])}
              className="rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-bold text-emerald-800 ring-1 ring-emerald-300">
              Saya sudah menyalinnya
            </button>
          </div>
          <p className="mb-2 text-[11.5px] text-emerald-900 dark:text-emerald-300">
            Kirimkan ke kapal sekarang. Begitu kotak ini ditutup, sandinya tidak bisa dibaca lagi oleh siapa pun —
            satu-satunya jalan bagi kapal yang lupa adalah minta diatur ulang.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {sandiBaru.map((s) => (
              <li key={s.nama} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold text-slate-800 dark:text-slate-100">{s.nama}</span>
                  {s.kapal && <span className="block text-[10.5px] text-slate-500">{s.kapal}</span>}
                </span>
                <code className="rounded bg-slate-100 px-2 py-1 text-[13px] font-bold tracking-wider text-slate-900 dark:bg-slate-800 dark:text-white">
                  {s.sandi}
                </code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-2">
        {akun.map((a) => (
          <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 dark:bg-slate-900 ${
            a.aktif ? "ring-slate-200 dark:ring-slate-800" : "ring-slate-300 opacity-60"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${
              a.bagian === "mesin" ? "bg-orange-500" : "bg-teal-600"}`}>
              {a.bagian === "mesin" ? "⚙" : "🧭"}
            </span>
            <span className="min-w-[12rem] flex-1">
              <span className="block text-[14px] font-black text-slate-900 dark:text-white">{a.nama}</span>
              <span className="block text-[11px] text-slate-500">{a.kapal} · bagian {a.bagian}</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Masuk terakhir<br /><b className="text-slate-700 dark:text-slate-200">{waktu(a.terakhirMasuk)}</b>
            </span>
            <span className="text-[11px] text-slate-500">
              Sandi diubah<br /><b className="text-slate-700 dark:text-slate-200">{waktu(a.sandiDiubahPada)}</b>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <button onClick={() => reset(a)} disabled={!!sibuk}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-[#16357f] ring-1 ring-slate-300 transition hover:bg-slate-100 disabled:opacity-50">
                {sibuk === a.id ? "…" : "Atur ulang sandi"}
              </button>
              <button onClick={() => alihAktif(a)} disabled={!!sibuk}
                className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:opacity-50 ${
                  a.aktif ? "bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50" : "bg-emerald-600 text-white"}`}>
                {a.aktif ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {!muat && !akun.length && (
        <div className="rounded-2xl bg-white px-4 py-12 text-center ring-1 ring-slate-200 dark:bg-slate-900">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Belum ada akun kapal.</p>
          <p className="mt-1 text-[11.5px] text-slate-500">Tekan tombol di atas untuk membuatkan 26 akun sekaligus.</p>
        </div>
      )}
    </main>
  );
}
