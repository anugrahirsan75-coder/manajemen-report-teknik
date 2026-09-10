"use client";

/**
 * Rekap resmi BKI satu kapal, dibaca saja.
 *
 * Sengaja tidak bisa disunting. Angkanya adalah salinan berkas klasifikasi; kalau
 * orang kantor boleh mengetik ulang di sini, aplikasi akan menampilkan jatuh
 * tempo survei yang tidak pernah dikatakan BKI — dan itu jenis kekeliruan yang
 * baru ketahuan saat kapal ditahan.
 *
 * Dipakai dua tempat: modal Ship Database dan halaman Profil Armada.
 */
import { DataBKI, BKI_SUMBER, nadaTempo, tglIndo } from "@/lib/kapal/bki";

const NADA: Record<string, string> = {
  lewat: "bg-rose-100 text-rose-800 ring-rose-300",
  dekat: "bg-amber-100 text-amber-800 ring-amber-300",
  aman: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  kosong: "bg-slate-100 text-slate-400 ring-slate-200",
};

/** Tanggal jatuh tempo dengan warna kemendesakan. */
function Tempo({ iso }: { iso: string }) {
  const n = nadaTempo(iso);
  if (n === "kosong") return <span className="text-slate-300">—</span>;
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ring-1 ${NADA[n]}`}>
      {tglIndo(iso)}
    </span>
  );
}

const Sel = ({ label, value, unit }: { label: string; value?: string; unit?: string }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="truncate text-[13px] font-semibold text-slate-800" title={value || ""}>
      {value ? `${value}${unit ? " " + unit : ""}` : <span className="font-normal text-slate-300">—</span>}
    </p>
  </div>
);

function Blok({ judul, ikon, children, kolom = "sm:grid-cols-3" }: {
  judul: string; ikon: string; children: React.ReactNode; kolom?: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
      <h4 className="mb-3 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16357f]">
        <span>{ikon}</span>{judul}
      </h4>
      <div className={`grid grid-cols-2 gap-x-5 gap-y-3 ${kolom}`}>{children}</div>
    </section>
  );
}

/** Tabel yang boleh menggulir sendiri — layar kantor sempit, tabelnya lebar. */
const Tabel = ({ kepala, children }: { kepala: string[]; children: React.ReactNode }) => (
  <div className="-mx-1 overflow-x-auto px-1">
    <table className="w-full min-w-[540px] border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-slate-200 text-left">
          {kepala.map((h) => (
            <th key={h} className="whitespace-nowrap px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export default function PanelBKI({ b }: { b: DataBKI }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#16357f] px-4 py-2.5 text-white">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Rekap BKI</span>
        <span className="text-[12px] font-semibold">{b.namaBKI} · Reg. {b.register || "—"}</span>
        {b.status && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-bold text-emerald-200 ring-1 ring-emerald-300/40">{b.status}</span>}
        <span className="ml-auto text-[10.5px] text-white/50">{BKI_SUMBER}</span>
      </div>

      <Blok judul="Identitas" ikon="🪪">
        <Sel label="No. Register" value={b.register} />
        <Sel label="No. IMO" value={b.imo} />
        <Sel label="Tanda Pengenal" value={b.callSign} />
        <Sel label="Jenis Kapal" value={b.jenisKapal} />
        <Sel label="Material" value={b.material} />
        <Sel label="Tanda Kelas Lambung" value={b.tandaKelasLambung} />
        <Sel label="Ship Category" value={b.kategori} />
        <Sel label="Bangunan" value={b.bangunan} />
        <Sel label="Nama Sebelumnya" value={b.namaSebelumnya} />
        <Sel label="Dual Kelas" value={b.dualKelas} />
        <Sel label="Instalasi Pendingin" value={b.instalasiPendingin} />
        <Sel label="CMS / CHS" value={b.cms} />
        <Sel label="Pelabuhan Pendaftaran" value={b.pelabuhan} />
        <Sel label="Bendera" value={b.bendera} />
        <Sel label="Status Pending" value={b.statusPending} />
      </Blok>

      <Blok judul="Pembangunan & Lambung" ikon="🏗️">
        <Sel label="Galangan" value={b.galangan} />
        <Sel label="Lokasi Bangun" value={b.lokasiBangun} />
        <Sel label="Tahun Bangun" value={b.tahun} />
        <Sel label="Tgl. Peluncuran" value={tglIndo(b.tglPeluncuran)} />
        <Sel label="GT" value={b.gt} unit="ton" />
        <Sel label="NT" value={b.nt} unit="ton" />
        <Sel label="DWT" value={b.dwt} unit="ton" />
        <Sel label="LOA" value={b.loa} unit="m" />
        <Sel label="LBP" value={b.lbp} unit="m" />
        <Sel label="B (moulded)" value={b.bmld} unit="m" />
        <Sel label="H (moulded)" value={b.hmld} unit="m" />
        <Sel label="Sarat (T)" value={b.t} unit="m" />
        <Sel label="Lambung Timbul" value={b.lt} unit="mm" />
        <Sel label="Jml. Geladak" value={b.geladak} />
        <Sel label="Ruang/Tangki Muat" value={b.ruangMuat} />
        <Sel label="Sekat Melintang" value={b.sekatMelintang} />
        <Sel label="Sekat Memanjang" value={b.sekatMemanjang} />
        <Sel label="Forecastle/Poop/Bridge" value={b.forecastle} />
      </Blok>

      <Blok judul="Jangkar & Rantai" ikon="⚓">
        <Sel label="Bower: Jml/Berat" value={b.bower.jumlahBerat} unit="kg" />
        <Sel label="Bower: Panj. Rantai" value={b.bower.panjangRantai} unit="m" />
        <Sel label="Bower: Dia. Rantai" value={b.bower.diaRantai} unit="mm" />
        <Sel label="Bower: Tipe" value={b.bower.tipe} />
        <Sel label="Bower: Tipe Rantai" value={b.bower.tipeRantai} />
        <Sel label="Bower: Kualitas" value={b.bower.kualitasRantai} />
        <Sel label="Stream: Jml/Berat" value={b.stream.jumlahBerat} unit="kg" />
        <Sel label="Stream: Panj. Rantai" value={b.stream.panjangRantai} unit="m" />
        <Sel label="Stream: Dia. Rantai" value={b.stream.diaRantai} unit="mm" />
      </Blok>

      <Blok judul="Permesinan" ikon="🔧">
        <Sel label="Sistem Start" value={b.sistemStart} />
        <Sel label="Jenis Mesin" value={b.jenisMesin} />
        <Sel label="Cara Kerja" value={b.caraKerja} />
        <Sel label="Jml. Mesin Induk" value={b.jmlMesinInduk} />
        <Sel label="Jml. Mesin Bantu" value={b.jmlMesinBantu} />
        <Sel label="Gigi Reduksi" value={b.gigiReduksi} />
        <Sel label="Dia. × Langkah" value={b.diaLangkah} unit="mm" />
        <Sel label="Jml. Baling-Baling" value={b.jmlBalingBaling} />
        <Sel label="Type Baling-Baling" value={b.tipeBalingBaling} />
        <Sel label="Voltase" value={b.voltase} unit="V" />
        <Sel label="Arus" value={b.arus} />
        <Sel label="Daya Listrik" value={b.dayaListrik} unit="kVA" />
        <Sel label="Kecepatan Dinas" value={b.kecepatanDinas} unit="knot" />
        <Sel label="Kecepatan Coba" value={b.kecepatanCoba} unit="knot" />
      </Blok>

      {!!b.mesinInduk.length && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
          <h4 className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16357f]">⚙️ Mesin Induk</h4>
          <Tabel kepala={["Posisi", "Merk", "Model & Seri", "Cyl", "Tenaga", "RPM", "Tahun", "Pabrik"]}>
            {b.mesinInduk.map((m, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                    {/^S/i.test(m.posisi) ? "KANAN" : "KIRI"} · {m.posisi}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-bold text-slate-800">{m.merk}</td>
                <td className="px-2 py-1.5 font-mono text-slate-700">{m.model || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{m.silinder || "—"}</td>
                <td className="px-2 py-1.5 font-semibold text-slate-800">{m.tenaga ? m.tenaga + " HP" : "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{m.rpm || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{m.tahun || "—"}</td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-500">{m.pabrik || "—"}</td>
              </tr>
            ))}
          </Tabel>
        </section>
      )}

      {!!b.mesinBantu.length && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
          <h4 className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16357f]">🔌 Mesin Bantu</h4>
          <Tabel kepala={["Item", "Merk", "Model", "BHP", "Tahun", "Pabrik", "Negara"]}>
            {b.mesinBantu.map((m, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5 font-bold text-slate-700">{m.item}</td>
                <td className="px-2 py-1.5 font-bold text-slate-800">{m.merk}</td>
                <td className="px-2 py-1.5 font-mono text-slate-700">{m.model || "—"}</td>
                <td className="px-2 py-1.5 font-semibold text-slate-800">{m.bhp || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{m.tahun || "—"}</td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-500">{m.pabrik || "—"}</td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-500">{m.lokasi || "—"}</td>
              </tr>
            ))}
          </Tabel>
        </section>
      )}

      {!!b.surveiKlas.length && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
          <h4 className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16357f]">
            🗓️ Survei Klasifikasi
            <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-slate-400">merah = lewat · kuning = ≤ 60 hari</span>
          </h4>
          <Tabel kepala={["Jenis Survei", "Jatuh Tempo", "Rentang", "Ditunda", "Terakhir"]}>
            {b.surveiKlas.map((s, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5 font-semibold text-slate-800">{s.jenis}</td>
                <td className="px-2 py-1.5"><Tempo iso={s.jatuhTempo} /></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-[11.5px] text-slate-600">
                  {s.rentangDari ? `${tglIndo(s.rentangDari)} – ${tglIndo(s.rentangSampai)}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-600">{tglIndo(s.ditunda) || "—"}</td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-500">{tglIndo(s.terakhir) || "—"}</td>
              </tr>
            ))}
          </Tabel>
        </section>
      )}

      {!!b.surveiStatutori.length && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
          <h4 className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16357f]">📜 Survei Statutori</h4>
          <Tabel kepala={["Jenis", "Terakhir", "Berikutnya", "Berikutnya 2", "Ditunda"]}>
            {b.surveiStatutori.map((s, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5 font-semibold text-slate-800">{s.jenis}</td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-500">{tglIndo(s.terakhir) || "—"}</td>
                <td className="px-2 py-1.5"><Tempo iso={s.berikut1} /></td>
                <td className="px-2 py-1.5"><Tempo iso={s.berikut2} /></td>
                <td className="px-2 py-1.5 text-[11.5px] text-slate-600">{tglIndo(s.ditunda) || "—"}</td>
              </tr>
            ))}
          </Tabel>
        </section>
      )}

      {(b.rekomendasi || b.memoranda) && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
          <h4 className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16357f]">📌 Rekomendasi &amp; Memoranda</h4>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Rekomendasi</span>
              <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${/^NIL$/i.test(b.rekomendasi) ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-1 ring-amber-300"}`}>
                {b.rekomendasi || "—"}
              </span>
              {b.rekomendasiJatuhTempo && <Tempo iso={b.rekomendasiJatuhTempo} />}
            </div>
            {b.memoranda && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Memoranda</p>
                {/* teks BKI apa adanya, termasuk pergantian barisnya */}
                <p className="max-h-56 overflow-auto whitespace-pre-line rounded-xl bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
                  {b.memoranda}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[11px] text-slate-500">
        <span>ℹ️</span>
        <span>Bagian ini salinan rekap BKI dan tidak bisa disunting di aplikasi. Kalau ada yang keliru, perbaikannya lewat BKI lalu rekap barunya dimasukkan ulang ke aplikasi.</span>
      </div>
    </div>
  );
}
