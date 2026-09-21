"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useMaterial } from "@/lib/material/store";
import { itemKategori } from "@/lib/material/types";
import { bulanTahun } from "@/lib/format";
import { generateMaterial, generateMaterialAll, MATERIAL_DOCS } from "@/lib/material/generateClient";
import { formatDok } from "@/lib/material/formatDok";
import { beritahu, konfirmasi } from "@/components/Konfirmasi";

type PeranTtd = "deptHead" | "stafTeknik" | "stempel";
type AsalTtd = "env" | "berkas" | "brankas" | "tidak ada";

interface StatusTtdUI {
  deptHead: boolean; stafTeknik: boolean; stempel: boolean;
  asal: Record<PeranTtd, AsalTtd>;
  rusak: PeranTtd[];
  brankasSiap: boolean;
  folder: string;
  diAwan?: boolean;
}

const LABEL_TTD: Record<PeranTtd, string> = {
  deptHead: "Tanda tangan Dept. Head",
  stafTeknik: "Tanda tangan staf teknik",
  stempel: "Stempel cabang",
};

const ASAL_KATA: Record<AsalTtd, string> = {
  env: "dari Environment Variables",
  berkas: "dari berkas di laptop ini",
  brankas: "tersimpan tersandi di basis data",
  "tidak ada": "belum ada",
};

export default function MaterialDashboard() {
  const { req, update } = useMaterial();
  const [busy, setBusy] = useState<string | null>(null);
  const [ttd, setTtd] = useState<StatusTtdUI | null>(null);
  const [kelola, setKelola] = useState(false);
  const [unggah, setUnggah] = useState<PeranTtd | "">("");
  const [pesanTtd, setPesanTtd] = useState("");

  // gambar tanda tangan tidak pernah ikut kode — layar menanyakan keadaannya
  // supaya pilihan membubuhkan tak ditawarkan saat gambarnya belum ada
  const muatTtd = () =>
    fetch("/api/material/ttd").then((r) => (r.ok ? r.json() : null)).then(setTtd).catch(() => setTtd(null));
  useEffect(() => { void muatTtd(); }, []);
  const ttdSiap = !!ttd && ttd.deptHead && ttd.stafTeknik && ttd.stempel;

  const kirimGambar = async (peran: PeranTtd, berkas: File) => {
    setUnggah(peran); setPesanTtd("");
    try {
      const fd = new FormData();
      fd.append("peran", peran);
      fd.append("berkas", berkas);
      const r = await fetch("/api/material/ttd", { method: "POST", body: fd });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal mengunggah");
      setTtd(d);
      setPesanTtd(`${LABEL_TTD[peran]} tersimpan ✓`);
      setTimeout(() => setPesanTtd(""), 4000);
    } catch (e: any) { setPesanTtd(e?.message || String(e)); }
    finally { setUnggah(""); }
  };

  const buangGambar = async (peran: PeranTtd) => {
    setUnggah(peran); setPesanTtd("");
    try {
      const r = await fetch(`/api/material/ttd?peran=${peran}`, { method: "DELETE" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal menghapus");
      setTtd(d);
    } catch (e: any) { setPesanTtd(e?.message || String(e)); }
    finally { setUnggah(""); }
  };
  const totalSC = req.items.filter((i) => itemKategori(i) === "SC").length;
  const totalUmum = req.items.length - totalSC;

  const run = async (fn: () => Promise<void>, key: string) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { void beritahu("Gagal: " + (e?.message ?? e)); } finally { setBusy(null); }
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-md shrink-0"><Image src="/logo-asdp.png" alt="ASDP" width={56} height={38} className="object-contain" /></div>
          <div>
            <h1 className="text-2xl font-extrabold asdp-text-gradient">Pengajuan Kode Material</h1>
            <p className="text-slate-500 text-sm">Periode {bulanTahun(req.tanggal)} · {req.items.length} item ({totalSC} SC, {totalUmum} umum)</p>
          </div>
        </div>
      </div>

      <section className="mt-5 grid sm:grid-cols-3 gap-4">
        <Link href="/material/cek" className="card-hover bg-white rounded-2xl elev-sm ring-line border border-transparent p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 grid place-items-center text-2xl text-white shadow-md">🔎</div>
          <div><p className="font-semibold text-slate-800">Cek Kode Material</p><p className="text-xs text-slate-400">Cek item sudah punya kode (SAP) atau belum</p></div>
        </Link>
        <Link href="/material/isi" className="card-hover bg-white rounded-2xl elev-sm ring-line border border-transparent p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-2xl text-white shadow-md">✏️</div>
          <div><p className="font-semibold text-slate-800">Input Item</p><p className="text-xs text-slate-400">Tambah/ubah item, kode, harga, kapal</p></div>
        </Link>
        <button onClick={() => run(() => generateMaterialAll(req), "all")} disabled={!!busy}
          className="card-hover bg-white rounded-2xl elev-sm ring-line border border-transparent p-4 flex items-center gap-4 text-left disabled:opacity-60">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-2xl text-white shadow-md">🗂️</div>
          <div><p className="font-semibold text-slate-800">{busy === "all" ? "Menyiapkan ZIP…" : "Generate Semua"}</p><p className="text-xs text-slate-400">4 dokumen: template Excel, sisanya PDF (.zip)</p></div>
        </button>
      </section>

      {/* Pembubuhan tanda tangan. Hanya menyentuh Formulir Permintaan Master
          Data — dokumen itu yang memang bertanda tangan Dept. Head dan staf. */}
      <section className="mt-5 rounded-2xl bg-white ring-1 ring-slate-200 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={!!req.bubuhiTtd} disabled={!ttdSiap}
            onChange={(e) => update({ bubuhiTtd: e.target.checked })} />
          <span className="flex-1">
            <span className="font-semibold text-slate-800 text-sm">
              Bubuhkan tanda tangan &amp; stempel pada Formulir Permintaan Master Data
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Tanda tangan Dept. Head dan staf teknik, stempel cabang di sisi Dept. Head.
              {ttd && !ttdSiap && (
                <span className="text-amber-700">
                  {" "}Belum lengkap — {[
                    !ttd.deptHead ? "tanda tangan Dept. Head" : "",
                    !ttd.stafTeknik ? "tanda tangan staf teknik" : "",
                    !ttd.stempel ? "stempel" : "",
                  ].filter(Boolean).join(", ")} belum ada. Unggah gambarnya di bawah ini.
                </span>
              )}
              {ttdSiap && (
                <span className="text-slate-400"> Gambarnya tidak pernah ikut ke repositori.</span>
              )}
            </span>
          </span>
        </label>

        {/*
          Pengelolaan gambar dikerjakan DI SINI, bukan lewat dasbor Vercel.
          Selama satu-satunya jalan adalah menempelkan base64 ke Environment
          Variables, fiturnya mati sampai ada yang sempat membuka dasbor itu —
          dan tanda tangan yang berganti orang membuatnya mati lagi.
        */}
        {ttd && (
          <div className="mt-3 pt-3 border-t">
            <button onClick={() => setKelola(!kelola)} className="text-xs font-semibold text-[#16357f] hover:underline">
              {kelola ? "▾" : "▸"} Kelola gambar tanda tangan &amp; stempel
            </button>

            {ttd.rusak.length > 0 && (
              <p className="mt-2 text-xs bg-rose-50 ring-1 ring-rose-200 text-rose-800 rounded-xl px-3 py-2">
                {ttd.rusak.map((p) => LABEL_TTD[p]).join(", ")} tersimpan tapi tidak bisa dibuka — hampir selalu karena
                AUTH_TOKEN berganti sesudah gambarnya diunggah. Unggah ulang gambarnya.
              </p>
            )}

            {kelola && (
              <div className="mt-3 space-y-2">
                {(["deptHead", "stafTeknik", "stempel"] as PeranTtd[]).map((p) => {
                  const asal = ttd.asal[p];
                  const terkunci = asal === "env" || asal === "berkas";
                  return (
                    <div key={p} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${ttd[p] ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="text-xs font-semibold text-slate-700 w-48">{LABEL_TTD[p]}</span>
                      <span className="text-[11px] text-slate-500 flex-1 min-w-[10rem]">{ASAL_KATA[asal]}</span>
                      {terkunci ? (
                        <span className="text-[11px] text-slate-400">
                          {asal === "env" ? "disetel lewat Environment Variables" : "dibaca dari data/ttd"}
                        </span>
                      ) : (
                        <>
                          <label className="text-[11px] font-semibold text-[#16357f] cursor-pointer hover:underline">
                            {unggah === p ? "mengunggah…" : ttd[p] ? "Ganti gambar" : "Pilih gambar"}
                            <input type="file" accept="image/png,image/jpeg" className="hidden"
                              disabled={!!unggah || !ttd.brankasSiap}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) void kirimGambar(p, f);
                              }} />
                          </label>
                          {asal === "brankas" && (
                            <button disabled={!!unggah}
                              onClick={async () => {
                                if (!(await konfirmasi({
                                  nada: "bahaya", ikon: "🗑️", judul: "Hapus gambar ini?",
                                  pesan: LABEL_TTD[p],
                                  tegasan: "Dokumen berikutnya terbit dengan ruang tanda tangan kosong.",
                                  tombolYa: "Ya, hapus",
                                }))) return;
                                void buangGambar(p);
                              }}
                              className="text-[11px] text-slate-400 hover:text-red-600 disabled:opacity-50">hapus</button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {!ttd.brankasSiap && (
                  <p className="text-xs bg-amber-50 ring-1 ring-amber-200 text-amber-800 rounded-xl px-3 py-2">
                    Unggahan belum bisa dipakai: AUTH_TOKEN atau sambungan basis data belum siap di server ini.
                  </p>
                )}
                {pesanTtd && <p className="text-xs text-slate-600">{pesanTtd}</p>}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  PNG berlatar tembus pandang paling rapi hasilnya; JPEG juga diterima. Gambar yang diunggah
                  <b> disandikan</b> (AES-256-GCM, kunci diturunkan dari AUTH_TOKEN) sebelum disimpan, jadi isinya
                  tidak terbaca walau barisnya terambil orang lain — dan tidak pernah ikut ke repositori.
                  {ttd.diAwan ? "" : ` Berkas di ${ttd.folder} tetap menang bila ada.`}
                </p>
              </div>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer mt-3 pt-3 border-t">
          <input type="checkbox" className="mt-1" checked={!!req.tampakPindai}
            onChange={(e) => update({ tampakPindai: e.target.checked })} />
          <span className="flex-1">
            <span className="font-semibold text-slate-800 text-sm">PDF dibuat tampak seperti hasil pindaian</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Warna kertas, sedikit bintik, dan kemiringan halus seperti lembar yang dipindai.
              <span className="text-amber-700">
                {" "}Halaman berubah jadi gambar: teksnya tidak bisa dicari lagi dan berkasnya sekitar dua kali lebih besar.
              </span>
            </span>
          </span>
        </label>
      </section>

      {/* Sesudah berkasnya jadi, yang dikerjakan berikutnya selalu sama:
          menulis surat pengantarnya ke pusat. Tautannya ditaruh di sini supaya
          tidak perlu dicari lagi di daftar 20 jenis surat. */}
      <section className="mt-5 rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 grid place-items-center text-xl text-white shadow">📨</div>
        <div className="flex-1 min-w-[16rem]">
          <p className="font-semibold text-slate-800 text-sm">Surat pengantar ke divisi pusat</p>
          <p className="text-xs text-slate-500">
            “Terlampir permohonan kode material … bulan … tahun ….” — badan surat disusun di layar Surat E-Office,
            penandatanganan dan QR sahnya tetap di e-office.
          </p>
        </div>
        <Link href="/surat?t=pengantar-kode-material" className="btn btn-primary text-xs">✉️ Buat surat pengantar</Link>
      </section>

      <h2 className="font-bold text-slate-700 mt-8 mb-3">Dokumen ({MATERIAL_DOCS.length})</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {MATERIAL_DOCS.map((d) => (
          <div key={d.slug} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-xl text-white shadow">{d.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{d.nama}</p>
                <p className="text-xs text-slate-400">{d.ket}</p>
              </div>
            </div>
            {/* bentuk utama tiap dokumen berbeda — lihat lib/material/formatDok.ts.
                Bentuk satunya tetap disediakan sebagai tombol kecil, karena
                sesekali dibutuhkan (mis. menyunting angka di Excel dulu). */}
            <div className="flex items-center gap-2 mt-3">
              {formatDok(d.slug) === "xlsx" ? (
                <>
                  <button onClick={() => run(() => generateMaterial(d.slug, "native", req), d.slug + "x")} disabled={!!busy}
                    className="btn btn-success text-xs disabled:opacity-50">📊 Excel</button>
                  <button onClick={() => run(() => generateMaterial(d.slug, "pdf", req), d.slug + "p")} disabled={!!busy}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline disabled:opacity-50">PDF</button>
                </>
              ) : (
                <>
                  <button onClick={() => run(() => generateMaterial(d.slug, "pdf", req), d.slug + "p")} disabled={!!busy}
                    className="btn btn-rose text-xs disabled:opacity-50">📄 PDF</button>
                  <button onClick={() => run(() => generateMaterial(d.slug, "native", req), d.slug + "x")} disabled={!!busy}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline disabled:opacity-50">Excel</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <footer className="mt-10 text-center text-xs text-slate-400">Output mengikuti template asli · PDF via MS Office di laptop ini</footer>
    </main>
  );
}
