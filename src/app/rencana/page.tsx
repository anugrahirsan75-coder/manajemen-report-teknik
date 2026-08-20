"use client";
/**
 * Rencana & Realisasi Perawatan Bulanan (Lampiran 3).
 *
 * Prinsip rancangan:
 *  - TENGGAT DULU. Papan paling atas menjawab "apa yang harus saya isi hari ini,
 *    sampai kapan" — rencana periode 2-bulanan (batas tgl 22) & realisasi bulan
 *    berjalan (batas tgl 1 bulan depan).
 *  - SATU KAPAL SATU LAYAR. Isi per kapal, per kelompok Mata Anggaran; deretan
 *    kapal memakai penanda: kosong / draf / terkirim, jadi terlihat mana yang belum.
 *  - AMAN. Dokumen yang sudah "Terkirim" terkunci (tak bisa berubah tanpa sengaja);
 *    membuka kunci butuh konfirmasi dan dicatat waktunya.
 *  - AKUNTABEL. Total dihitung dari item (jumlah x harga satuan), bukan diketik.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { KAPAL_ANGGARAN, maKey, namaKapalPenuh } from "@/lib/anggaran/types";
import { useAnggaran, realisasiRutin, PengadaanRow } from "@/lib/anggaran/store";
import { pecahKapal, ringkasKapal } from "@/lib/kapal/nama";
import { useRR, idDoc } from "@/lib/rr/store";
import {
  KELOMPOK_RR, MA_RR, kunciKelompok, RrDoc, RrItem, TipeRR,
  bulanDari, bulanKe, namaBulan, periodeAktif, periodeDari, statusTenggat, tenggatDoc,
  totalDoc, totalKelompok, totalPerMA, nilaiItem, bulanRealisasiAktif,
} from "@/lib/rr/types";
import { rupiah } from "@/lib/format";
import { useKonfirmasi } from "@/components/Konfirmasi";
import { tentukanKelompok } from "@/lib/rr/penempatan";
import SusunRencana, { PilihanUsulan } from "@/components/rr/SusunRencana";
import {
  kandidatDariRiwayat, paguBulan, rencanaTersimpan, susunKendali,
} from "@/lib/rr/usulanRiwayat";
import { labelMA } from "@/lib/anggaran/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const barisKosong = (): RrItem => ({ id: uid(), deskripsi: "", spesifikasi: "", jumlah: 0, satuan: "", harga: 0 });

const docBaru = (tipe: TipeRR, bulan: string, kapal: string): RrDoc => ({
  id: idDoc(tipe, bulan, kapal), tipe, bulan, kapal,
  kelompok: KELOMPOK_RR.map((k) => ({ kunci: kunciKelompok(k), items: [] })),
  ppnPersen: 0, status: "draf", diubahPada: new Date().toISOString(),
});

const NADA = {
  rencana: { grad: "from-indigo-600 to-blue-600", ring: "ring-indigo-200", bg: "bg-indigo-50", teks: "text-indigo-800", tombol: "bg-indigo-600" },
  realisasi: { grad: "from-emerald-600 to-teal-600", ring: "ring-emerald-200", bg: "bg-emerald-50", teks: "text-emerald-800", tombol: "bg-emerald-600" },
} as const;

const WARNA_TENGGAT: Record<string, string> = {
  aman: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  dekat: "bg-amber-50 text-amber-800 ring-amber-200",
  mendesak: "bg-orange-50 text-orange-800 ring-orange-300",
  lewat: "bg-rose-50 text-rose-800 ring-rose-300",
};

export default function RencanaPage() {
  const { ready, loading, dok, simpan, hapus, reload, simpanErr } = useRR();
  const { pengadaan, plafon } = useAnggaran();   // pengadaan: tarikan realisasi & riwayat usulan; plafon: pagu RKA
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);   // hindari beda server/klien

  const periode = now ? periodeAktif(now) : null;
  const bulanReal = now ? bulanRealisasiAktif(now) : "";

  const [tipe, setTipe] = useState<TipeRR>("rencana");
  const [bulan, setBulan] = useState("");
  const [kapal, setKapal] = useState(KAPAL_ANGGARAN[0]);
  useEffect(() => {
    if (!now || bulan) return;
    setBulan(periodeAktif(now).mulai);
  }, [now, bulan]);

  // dokumen yang sedang dibuka (salinan kerja)
  const tersimpan = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === kapal);
  const [kerja, setKerja] = useState<RrDoc | null>(null);
  const kunciBuka = `${tipe}|${bulan}|${kapal}`;
  const kunciRef = useRef("");
  const [berubah, setBerubah] = useState(false);
  useEffect(() => {
    if (!bulan) return;
    const gantiDokumen = kunciRef.current !== kunciBuka || !kerja;
    // data Supabase sering tiba SETELAH layar terbuka — kalau belum ada suntingan lokal,
    // isinya harus ikut masuk; kalau tidak, dokumen yang sudah tersimpan terlihat kosong.
    const dataBaruTiba = !gantiDokumen && !berubah && tersimpan && tersimpan.diubahPada !== kerja?.diubahPada;
    if (!gantiDokumen && !dataBaruTiba) return;
    kunciRef.current = kunciBuka;
    setKerja(tersimpan ? JSON.parse(JSON.stringify(tersimpan)) : docBaru(tipe, bulan, kapal));
    setBerubah(false);
  }, [kunciBuka, tersimpan, bulan, tipe, kapal, kerja, berubah]);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const terkunci = kerja?.status === "terkirim";
  const { konfirmasi, dialogKonfirmasi } = useKonfirmasi();

  const ubah = (f: (d: RrDoc) => void) => {
    if (!kerja || terkunci) return;
    const salin: RrDoc = JSON.parse(JSON.stringify(kerja));
    f(salin);
    setKerja(salin);
    setBerubah(true);
  };

  const simpanDoc = async (d?: RrDoc) => {
    const isi = d || kerja;
    if (!isi) return;
    setSibuk(true); setPesan("");
    try {
      await simpan(isi);
      setKerja(JSON.parse(JSON.stringify(isi)));
      setBerubah(false);
      setPesan("Tersimpan.");
      setTimeout(() => setPesan(""), 2500);
    } catch (e: any) {
      setPesan(`Gagal simpan: ${e?.message || e}`);
    } finally { setSibuk(false); }
  };

  const tandaiTerkirim = async () => {
    if (!kerja) return;
    if (!(await konfirmasi({
      nada: "sukses", ikon: "🔒",
      judul: "Tandai sebagai TERKIRIM?",
      pesan: `${tipe === "rencana" ? "Rencana" : "Realisasi"} ${namaBulan(bulan)} — ${kapal}.`,
      rincian: [
        `${kerja.kelompok.reduce((n, g) => n + (g.items || []).length, 0)} item terisi`,
        `Nilai ${rupiah(t.total)}`,
      ],
      tegasan: "Isinya dikunci setelah ini — untuk mengubah lagi, kuncinya harus dibuka dulu.",
      tombolYa: "Ya, tandai terkirim",
    }))) return;
    await simpanDoc({ ...kerja, status: "terkirim", dikirimPada: new Date().toISOString() });
  };
  const hapusDoc = async () => {
    if (!kerja || !tersimpan) return;
    if (!(await konfirmasi({
      nada: "bahaya", ikon: "🗑️",
      judul: `Hapus ${tipe} ${namaBulan(bulan)}?`,
      pesan: `${kapal} — dokumen ini beserta seluruh isinya akan dibuang dari Supabase.`,
      rincian: [
        `${kerja.kelompok.reduce((n, g) => n + (g.items || []).length, 0)} item`,
        `Nilai ${rupiah(t.total)}`,
      ],
      tegasan: "Tidak bisa dikembalikan.",
      tombolYa: "Ya, hapus",
    }))) return;
    setSibuk(true);
    try {
      await hapus(kerja.id);
      setKerja(docBaru(tipe, bulan, kapal));
      setBerubah(false);
      setPesan("Dokumen dihapus.");
      setTimeout(() => setPesan(""), 2500);
    } finally { setSibuk(false); }
  };

  /* ---- pencocokan sebulan (dipakai tombol kirim massal & panel Rekap) ---- */
  const harapBulan = useMemo(() => hitungSeharusnya(pengadaan, bulan), [pengadaan, bulan]);
  const dashBulan = useMemo(() => (bulan ? realisasiRutin(pengadaan, bulan).total : 0), [pengadaan, bulan]);

  /** dokumen bulan ini per kapal — yang sedang dibuka diambil dari salinan kerja (termasuk suntingan belum disimpan) */
  const docBulan = useMemo(() => {
    const m = new Map<string, RrDoc>();
    dok.filter((x) => x.tipe === tipe && x.bulan === bulan).forEach((d) => m.set(d.kapal, d));
    if (kerja && kerja.tipe === tipe && kerja.bulan === bulan) m.set(kerja.kapal, kerja);
    return Array.from(m.values());
  }, [dok, kerja, tipe, bulan]);

  /** Tandai SELURUH kapal bulan ini sebagai terkirim — sekali klik. */
  const tandaiSemua = async () => {
    if (!bulan) return;
    const kandidat = docBulan.filter((d) => d.status !== "terkirim" && totalDoc(d).total > 0);
    const kosong = docBulan.filter((d) => totalDoc(d).total <= 0);
    const sudah = docBulan.filter((d) => d.status === "terkirim");
    const belumAda = KAPAL_ANGGARAN.filter((k) => !docBulan.some((d) => d.kapal === k));
    const nilai = kandidat.reduce((s, d) => s + totalDoc(d).total, 0);

    if (!kandidat.length) {
      setPesan(sudah.length
        ? `Semua ${sudah.length} dokumen ${tipe} ${namaBulan(bulan)} sudah ditandai terkirim.`
        : `Belum ada isi yang bisa dikirim untuk ${tipe} ${namaBulan(bulan)}.`);
      setTimeout(() => setPesan(""), 8000);
      return;
    }

    // untuk realisasi: peringatkan kalau totalnya belum sama dengan Dashboard Anggaran Rutin
    const dasarSemua = docBulan.reduce((s, d) => s + totalDoc(d).dasar, 0);
    const beda = Math.round(dasarSemua - harapBulan.bisa);
    const belumCocok = tipe === "realisasi" && Math.abs(beda) >= 1000;

    if (!(await konfirmasi({
      nada: belumCocok ? "perhatian" : "sukses", ikon: "🔒",
      judul: `Tandai SEMUA ${tipe} ${namaBulan(bulan)} terkirim?`,
      pesan: `${kandidat.length} kapal akan dikunci sekaligus. Setelah ini isinya tak bisa diubah tanpa membuka kunci lagi.`,
      rincian: [
        `${kandidat.length} kapal dikunci · total ${rupiah(nilai)}`,
        ...(sudah.length ? [`${sudah.length} kapal sudah terkirim (dilewati)`] : []),
        ...(kosong.length ? [`${kosong.length} kapal masih kosong (dilewati): ${kosong.map((d) => ringkasKapal(d.kapal)).join(", ")}`] : []),
        ...(belumAda.length ? [`${belumAda.length} kapal belum dibuat sama sekali: ${belumAda.map(ringkasKapal).join(", ")}`] : []),
        ...(belumCocok ? [`Total masih ${beda < 0 ? "KURANG" : "LEBIH"} ${rupiah(Math.abs(beda))} dibanding Dashboard Anggaran Rutin`] : []),
      ],
      tegasan: belumCocok
        ? "Angkanya belum cocok dengan Dashboard. Sebaiknya tarik dulu kapal yang kurang, baru dikirim."
        : undefined,
      tombolYa: `Kirim ${kandidat.length} kapal`,
    }))) return;

    setSibuk(true);
    const stempel = new Date().toISOString();
    try {
      let n = 0;
      for (const d of kandidat) {
        setPesan(`Menandai terkirim… ${++n}/${kandidat.length} (${ringkasKapal(d.kapal)})`);
        await simpan({ ...d, status: "terkirim", dikirimPada: stempel });
      }
      // dokumen yang sedang dibuka ikut berubah di layar
      if (kerja && kandidat.some((d) => d.id === kerja.id)) {
        setKerja({ ...kerja, status: "terkirim", dikirimPada: stempel });
        setBerubah(false);
      }
      setPesan(`✅ ${kandidat.length} kapal ditandai terkirim untuk ${tipe} ${namaBulan(bulan)}.`);
      setTimeout(() => setPesan(""), 8000);
    } catch (e: any) {
      setPesan(`Gagal menandai: ${e?.message || e}`);
    } finally { setSibuk(false); }
  };

  const bukaKunci = async () => {
    if (!kerja) return;
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "🔓",
      judul: "Buka kunci untuk revisi?",
      pesan: "Dokumen ini sudah ditandai terkirim ke pusat.",
      tegasan: "Perubahan setelah ini perlu dilaporkan ulang ke pusat.",
      tombolYa: "Buka kunci",
    }))) return;
    await simpanDoc({ ...kerja, status: "draf" });
  };

  /**
   * Tarik realisasi dari pengadaan yang SUDAH tercatat (SPPBJ + Non PR PO ber-jenis Rutin)
   * pada bulan & kapal ini. Item multi-kapal dibagi rata supaya totalnya tetap pas.
   * Penempatan sub-kelompok (cleaning / suku cadang / service / dst.) ditentukan
   * tentukanKelompok(): maksud NAMA PENGADAAN dulu, baru nama barangnya.
   * Selalu bisa dikoreksi lewat tombol ⇄ pada barisnya.
   */
  const hitungTarikan = useMemo(() => () => {
    const kumpul: Record<string, RrItem[]> = {};
    const sebaran: Record<string, number> = {};   // judul kelompok -> jumlah item
    let n = 0, diabaikan = 0;
    const lainKapal: string[] = [];   // pengadaan bulan ini yang tak menyebut kapal ini
    for (const p of pengadaan) {
      if (p.jenis !== "rutin") continue;
      if ((p.tanggal || "").slice(0, 7) !== bulan) continue;
      const arr: any[] = p.items || [];
      const kapalDok = Array.from(new Set(arr.flatMap((it) => pecahKapal(it.kapal || "").map(namaKapalPenuh))));
      if (kapalDok.length && !kapalDok.includes(kapal)) {
        lainKapal.push(`${p.nama} (${kapalDok.map((k) => ringkasKapal(k)).join(", ")})`);
        continue;
      }
      const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
      const maDefault = (p.mataAnggaran || [])[0] || "";
      for (const it of arr) {
        const kapals = pecahKapal(it.kapal || "").map(namaKapalPenuh);
        if (!kapals.includes(kapal)) continue;
        const bagi = kapals.length || 1;
        const harga = (adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) / bagi;
        if (!harga) continue;
        const kode = maKey((it.mataAnggaran || "").trim() || maDefault);
        const tempat = tentukanKelompok(kode, p.nama || "", it.nama || "", it.spesifikasi || "");
        const kunci = tempat.kunci;
        if (!kunci) { diabaikan++; continue; }
        sebaran[tempat.judul] = (sebaran[tempat.judul] || 0) + 1;
        (kumpul[kunci] ||= []).push({
          id: uid(), deskripsi: it.nama || "(tanpa nama)",
          // Spesifikasi harus sama persis dengan tabel SPPBJ/Non PR PO — kosong berarti kosong.
          // Jejak dokumen asalnya disimpan terpisah di 'asal' (tampil di layar, tak ikut ke Excel).
          spesifikasi: it.spesifikasi || "",
          asal: `${p.sumber} ${p.nama}`,
          jumlah: it.jumlah || 0, satuan: it.satuan || "", harga: Math.round(harga),
        });
        n++;
      }
    }
    return { kumpul, n, diabaikan, lainKapal, sebaran };
  }, [pengadaan, bulan, kapal]);

  /**
   * Sidik jari satu item, dipakai untuk mengenali item yang SAMA.
   * 'asal' ikut dihitung supaya dua SPPBJ berbeda yang kebetulan berisi barang
   * sama tetap dianggap dua item yang sah — bukan dobel.
   */
  const sidik = (i: RrItem) =>
    [i.asal || "(manual)", (i.deskripsi || "").trim().toLowerCase(), (i.spesifikasi || "").trim().toLowerCase(),
     i.jumlah || 0, (i.satuan || "").trim().toLowerCase(), i.harga || 0].join("|");

  /** berapa banyak tiap sidik jari sudah ada di SELURUH dokumen (item bisa dipindah antar kelompok) */
  const stokDoc = (d: RrDoc | null) => {
    const n: Record<string, number> = {};
    (d?.kelompok || []).forEach((g) => (g.items || []).forEach((i) => { const k = sidik(i); n[k] = (n[k] || 0) + 1; }));
    return n;
  };

  /**
   * Dobel yang SUDAH terlanjur masuk: baris hasil tarikan yang jumlahnya melebihi
   * yang ada di SPPBJ/Non PR PO. Hanya baris ber-'asal' yang dihitung — baris yang
   * diketik tangan tidak pernah diusik.
   */
  const dobel = useMemo(() => {
    if (!kerja) return { n: 0, nilai: 0, rincian: [] as { nama: string; lebih: number }[] };
    const { kumpul } = hitungTarikan();
    const sumber: Record<string, number> = {};
    Object.values(kumpul).forEach((arr) => arr.forEach((i) => { const k = sidik(i); sumber[k] = (sumber[k] || 0) + 1; }));
    const punya: Record<string, { n: number; contoh: RrItem }> = {};
    kerja.kelompok.forEach((g) => (g.items || []).forEach((i) => {
      if (!i.asal) return;                       // baris ketik tangan: bukan urusan tarikan
      const k = sidik(i);
      if (sumber[k] === undefined) return;       // tak dikenali di bulan ini: jangan ditebak
      (punya[k] ||= { n: 0, contoh: i }).n++;
    }));
    let n = 0, nilai = 0;
    const rincian: { nama: string; lebih: number }[] = [];
    Object.entries(punya).forEach(([k, v]) => {
      const lebih = v.n - (sumber[k] || 0);
      if (lebih <= 0) return;
      n += lebih; nilai += lebih * nilaiItem(v.contoh);
      rincian.push({ nama: v.contoh.deskripsi || "(tanpa nama)", lebih });
    });
    rincian.sort((a, b) => b.lebih - a.lebih);
    return { n, nilai, rincian };
  }, [kerja, hitungTarikan]);

  const tarikDariPengadaan = async () => {
    const { kumpul, n, diabaikan, lainKapal, sebaran } = hitungTarikan();
    if (!n) {
      // beri tahu SEBABNYA, bukan sekadar "tidak ada"
      const sebab = lainKapal.length
        ? `Ada ${lainKapal.length} pengadaan Rutin ${namaBulan(bulan)}, tetapi tak satu pun menyebut ${ringkasKapal(kapal)}: ${lainKapal.slice(0, 3).join("; ")}${lainKapal.length > 3 ? ` (dan ${lainKapal.length - 3} lagi)` : ""}.`
        : `Belum ada pengadaan Rutin ${namaBulan(bulan)} sama sekali.`;
      setPesan(sebab);
      setTimeout(() => setPesan(""), 12000);
      return;
    }

    // ANTI-DOBEL: item yang sudah ada di dokumen ini dilewati. Pencocokan pakai
    // JUMLAH, bukan sekadar "ada/tidak" — kalau SPPBJ memang memuat barang yang
    // sama dua baris, dua-duanya tetap masuk; menekan tombol ini dua kali tidak.
    const punya = stokDoc(kerja);
    const tambah: Record<string, RrItem[]> = {};
    let baru = 0, lewat = 0;
    for (const [kunci, items] of Object.entries(kumpul)) {
      for (const it of items) {
        const k = sidik(it);
        if ((punya[k] || 0) > 0) { punya[k]--; lewat++; continue; }
        (tambah[kunci] ||= []).push(it); baru++;
      }
    }

    if (!baru) {
      setPesan(`⚠ Tidak ada yang ditambahkan — ${lewat} item dari SPPBJ / Non PR PO ${namaBulan(bulan)} untuk ${ringkasKapal(kapal)} SUDAH ada di dokumen ini. Realisasi tidak jadi dobel.`);
      setTimeout(() => setPesan(""), 12000);
      return;
    }

    if (lewat && !(await konfirmasi({
      nada: "perhatian", ikon: "⚡",
      judul: "Sebagian item sudah pernah ditarik",
      pesan: `Supaya realisasi tidak dobel, yang sudah ada akan dilewati.`,
      rincian: [`${lewat} item DILEWATI (sudah ada di dokumen ini)`, `${baru} item baru akan ditambahkan`],
      tombolYa: `Tambahkan ${baru} item`,
    }))) return;

    ubah((d) => {
      for (const [kunci, items] of Object.entries(tambah)) {
        const g = d.kelompok.find((x) => x.kunci === kunci);
        if (g) g.items = [...g.items.filter((i) => i.deskripsi || i.harga), ...items];
        else d.kelompok.push({ kunci, items });
      }
    });
    // sebaran hanya untuk yang BENAR-BENAR masuk kali ini
    const sebaranBaru: Record<string, number> = {};
    Object.entries(tambah).forEach(([kunci, items]) => {
      const judul = kunci.split("|")[1] || kunci;
      sebaranBaru[judul] = (sebaranBaru[judul] || 0) + items.length;
    });
    const petaKelompok = Object.entries(sebaranBaru).sort((a, b) => b[1] - a[1])
      .map(([j, c]) => `${j} ${c}`).join(" · ");

    setPesan(
      `${baru} item ditarik dari SPPBJ / Non PR PO`
      + (lewat ? ` · ${lewat} dilewati karena sudah ada (anti-dobel)` : "")
      + (diabaikan ? ` · ${diabaikan} item Mata Anggarannya di luar daftar Lampiran 3` : "")
      + (lainKapal.length ? ` · ${lainKapal.length} pengadaan bulan ini tidak menyebut ${ringkasKapal(kapal)} (jadi tak ikut ditarik)` : "")
      + `.\nPenempatan: ${petaKelompok}. Geser dengan tombol ⇄ bila ada yang kurang pas, lalu simpan.`);
    setTimeout(() => setPesan(""), 14000);
  };

  /**
   * Item hasil tarikan yang menurut aturan penempatan seharusnya duduk di kelompok lain.
   * Muncul pada dokumen yang diisi SEBELUM aturan ini ada (semuanya menumpuk di Lain-Lain).
   * Hanya baris ber-'asal'; yang diketik tangan tidak pernah dipindah otomatis.
   */
  const namaDokAsal = (asal?: string) => (asal || "").replace(/^(SPPBJ|Non PR PO)\s+/i, "");
  const salahTempat = useMemo(() => {
    if (!kerja) return { n: 0, rincian: [] as { dari: string; ke: string; n: number }[] };
    const hit: Record<string, number> = {};
    kerja.kelompok.forEach((g) => {
      const kode = g.kunci.split("|")[0];
      const dari = g.kunci.split("|")[1] || g.kunci;
      (g.items || []).forEach((i) => {
        if (!i.asal) return;
        const h = tentukanKelompok(kode, namaDokAsal(i.asal), i.deskripsi || "", i.spesifikasi || "");
        if (!h.kunci || h.kunci === g.kunci) return;
        hit[`${dari}→${h.judul}`] = (hit[`${dari}→${h.judul}`] || 0) + 1;
      });
    });
    const rincian = Object.entries(hit).map(([k, n]) => {
      const [dari, ke] = k.split("→");
      return { dari, ke, n };
    }).sort((a, b) => b.n - a.n);
    return { n: rincian.reduce((s, r) => s + r.n, 0), rincian };
  }, [kerja]);

  /** pindahkan item tarikan ke kelompok yang tepat menurut aturan penempatan */
  const tataUlangKelompok = async () => {
    if (!kerja || !salahTempat.n) return;
    if (!(await konfirmasi({
      nada: "biasa", ikon: "⇄",
      judul: `Tata ulang ${salahTempat.n} item ke kelompok yang tepat?`,
      pesan: "Penempatan dibaca dari maksud nama pengadaannya, lalu nama barangnya. Nilai & Mata Anggaran tidak berubah — hanya judul kebutuhannya yang dirapikan.",
      rincian: salahTempat.rincian.slice(0, 8).map((r) => `${r.n} item: ${r.dari} → ${r.ke}`),
      tegasan: "Baris yang Anda ketik sendiri tidak dipindah.",
      tombolYa: "Tata ulang",
    }))) return;

    let pindah = 0;
    ubah((d) => {
      const masuk: Record<string, RrItem[]> = {};
      d.kelompok.forEach((g) => {
        const kode = g.kunci.split("|")[0];
        g.items = (g.items || []).filter((i) => {
          if (!i.asal) return true;
          const h = tentukanKelompok(kode, namaDokAsal(i.asal), i.deskripsi || "", i.spesifikasi || "");
          if (!h.kunci || h.kunci === g.kunci) return true;
          (masuk[h.kunci] ||= []).push(i); pindah++; return false;
        });
      });
      for (const [kunci, items] of Object.entries(masuk)) {
        const g = d.kelompok.find((x) => x.kunci === kunci);
        if (g) g.items = [...(g.items || []), ...items];
        else d.kelompok.push({ kunci, items });
      }
      // rapikan urutan tampilan: barang serupa berdekatan
      d.kelompok.forEach((g) => g.items.sort((a, b) => (a.deskripsi || "").localeCompare(b.deskripsi || "", "id")));
    });
    setPesan(`${pindah} item ditata ulang ke kelompok yang tepat. Periksa, lalu simpan.`);
    setTimeout(() => setPesan(""), 10000);
  };

  /** buang baris tarikan yang berlebih (sisa dobel lama), sisakan sebanyak yang ada di SPPBJ */
  const rapikanDobel = async () => {
    if (!kerja || !dobel.n) return;
    if (!(await konfirmasi({
      nada: "perhatian", ikon: "🧹",
      judul: `Buang ${dobel.n} baris dobel?`,
      pesan: `Senilai ${rupiah(Math.round(dobel.nilai))}. Yang disisakan sebanyak yang benar-benar ada di SPPBJ / Non PR PO.`,
      rincian: [
        ...dobel.rincian.slice(0, 6).map((r) => `${r.nama} — kelebihan ${r.lebih} baris`),
        ...(dobel.rincian.length > 6 ? [`…${dobel.rincian.length - 6} jenis lagi`] : []),
      ],
      tegasan: "Baris yang Anda ketik sendiri tidak diusik.",
      tombolYa: "Rapikan",
    }))) return;

    const { kumpul } = hitungTarikan();
    const sumber: Record<string, number> = {};
    Object.values(kumpul).forEach((arr) => arr.forEach((i) => { const k = sidik(i); sumber[k] = (sumber[k] || 0) + 1; }));
    const sisa = { ...sumber };
    let dibuang = 0;
    ubah((d) => {
      d.kelompok.forEach((g) => {
        g.items = (g.items || []).filter((i) => {
          if (!i.asal) return true;
          const k = sidik(i);
          if (sumber[k] === undefined) return true;
          if ((sisa[k] || 0) > 0) { sisa[k]--; return true; }
          dibuang++; return false;
        });
      });
    });
    setPesan(`${dibuang} baris dobel dibuang. Periksa lalu simpan.`);
    setTimeout(() => setPesan(""), 8000);
  };

  /** salin isi dari dokumen lain (bulan lalu / rencana bulan yang sama) */
  /* ── penyusun usulan dari riwayat + kendali RKA ────────────────────── */
  const [bukaSusun, setBukaSusun] = useState(false);

  /**
   * Barang yang biasa dibeli kapal ini pada bulan-bulan sebelumnya. Dihitung
   * hanya untuk RENCANA: pada realisasi yang berlaku adalah dokumen bulan itu
   * sendiri, bukan kebiasaan.
   */
  const kandidatRiwayat = useMemo(
    () => (tipe === "rencana" && bulan ? kandidatDariRiwayat(pengadaan, kapal, bulan, 12) : []),
    [tipe, bulan, kapal, pengadaan]);

  const paguRka = useMemo(() => paguBulan(plafon, bulan), [plafon, bulan]);
  const rencanaKapalLain = useMemo(
    () => rencanaTersimpan(dok, bulan, kapal), [dok, bulan, kapal]);
  const rencanaKapalIni = useMemo(
    () => (kerja && tipe === "rencana" ? totalPerMA(kerja) : {}), [kerja, tipe]);

  /** kapal yang usulannya belum terisi bulan ini — dasar pembagian jatah pagu */
  const kapalBelumSusun = useMemo(() => {
    if (tipe !== "rencana") return 1;
    const belum = KAPAL_ANGGARAN.filter((k) =>
      !dok.some((d) => d.tipe === "rencana" && d.bulan === bulan && d.kapal === k && totalDoc(d).total > 0));
    // kapal yang sedang disusun ikut dihitung walau dokumennya sudah ada isinya
    return Math.max(1, belum.includes(kapal) ? belum.length : belum.length + 1);
  }, [dok, bulan, kapal, tipe]);

  const kendaliRka = useMemo(
    () => susunKendali(paguRka, rencanaKapalLain, rencanaKapalIni, {}),
    [paguRka, rencanaKapalLain, rencanaKapalIni]);

  const totalKendali = useMemo(() => {
    const j = (f: (b: typeof kendaliRka[number]) => number) => kendaliRka.reduce((s, b) => s + f(b), 0);
    return { pagu: j((b) => b.pagu), lain: j((b) => b.kapalLain), ini: j((b) => b.kapalIni), sisa: j((b) => b.sisa) };
  }, [kendaliRka]);

  /**
   * Masukkan pilihan dari penyusun ke kelompok yang tepat.
   *
   * 'asal' sengaja TIDAK diisi: penanda itu dipakai pemeriksa dobel realisasi
   * untuk mengenali baris hasil tarikan, dan usulan bukan tarikan — kalau diisi,
   * seluruh baris usulan akan dilaporkan sebagai dobel yang harus dirapikan.
   */
  const tambahDariRiwayat = (pilihan: PilihanUsulan[]) => {
    ubah((d) => {
      pilihan.forEach((p) => {
        const g = d.kelompok.find((x) => x.kunci === p.kandidat.kunci)
          || d.kelompok[d.kelompok.length - 1];
        if (!g) return;
        (g.items ||= []).push({
          id: uid(),
          deskripsi: p.kandidat.deskripsi,
          spesifikasi: p.kandidat.spesifikasi,
          jumlah: p.jumlah, satuan: p.kandidat.satuan, harga: p.harga,
        });
      });
    });
    setBukaSusun(false);
    setPesan(`${pilihan.length} barang masuk ke usulan — periksa jumlah & harganya, lalu simpan.`);
    setTimeout(() => setPesan(""), 5000);
  };

  const salinDari = (sumber?: RrDoc) => {
    if (!sumber) { setPesan("Sumber salinan belum ada isinya."); setTimeout(() => setPesan(""), 3000); return; }
    ubah((d) => {
      d.kelompok = KELOMPOK_RR.map((k) => {
        const kunci = kunciKelompok(k);
        const asal = (sumber.kelompok || []).find((x) => x.kunci === kunci);
        return { kunci, items: (asal?.items || []).map((i) => ({ ...i, id: uid() })) };
      });
      d.ppnPersen = sumber.ppnPersen || 0;
    });
  };

  const t = kerja ? totalDoc(kerja) : { dasar: 0, ppn: 0, total: 0 };
  const nada = NADA[tipe];
  const tenggat = bulan && now ? statusTenggat(tenggatDoc(tipe, bulan), now) : null;

  // status pengisian tiap kapal (untuk deretan chip)
  const statusKapal = (k: string) => {
    const d = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === k);
    if (!d) return "kosong";
    if (d.status === "terkirim") return "terkirim";
    return totalDoc(d).total > 0 ? "draf" : "kosong";
  };
  const jumlahTerkirim = KAPAL_ANGGARAN.filter((k) => statusKapal(k) === "terkirim").length;
  const jumlahDraf = KAPAL_ANGGARAN.filter((k) => statusKapal(k) === "draf").length;

  const [xlsSibuk, setXlsSibuk] = useState(false);
  const unduhExcel = async () => {
    setXlsSibuk(true);
    try {
      const { exportRrExcel } = await import("@/lib/rr/export");
      // Berkas Lampiran 3 selalu sepasang: RENCANA satu bulan + REALISASI bulan sebelumnya.
      // Bulan yang sedang dibuka jadi acuan sesuai tabnya, supaya yang diekspor benar-benar
      // dokumen yang sedang dilihat (buka Realisasi Juli -> REAL Juli, bukan Juni).
      const bulanRencana = tipe === "realisasi" ? bulanKe(bulan, 1) : bulan;
      const bulanRealisasi = tipe === "realisasi" ? bulan : bulanKe(bulan, -1);
      await exportRrExcel({ bulanRencana, bulanRealisasi, dok });
    } catch (e: any) {
      setPesan(`Gagal export: ${e?.message || e}`);
    } finally { setXlsSibuk(false); }
  };

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      {/* ================= kepala ================= */}
      <div className="asdp-gradient rounded-3xl p-[1.5px] elev-lg anim-in">
        <div className="glass hero-glow rounded-3xl px-7 py-6 flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-2xl asdp-gradient grid place-items-center text-2xl text-white shadow-md shrink-0">📆</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold asdp-text-gradient tracking-tight">Rencana &amp; Realisasi Perawatan</h1>
            <p className="text-slate-500 text-sm">Lampiran 3 · usulan program perawatan bulanan per kapal &amp; realisasinya</p>
          </div>
          <button onClick={unduhExcel} disabled={xlsSibuk || !bulan} className="btn btn-success text-xs disabled:opacity-50"
            title="Unduh berkas Lampiran 3: rekap Budget Control Rutin + lembar USL & REAL tiap kapal">
            {xlsSibuk ? "menyiapkan…" : "📊 Export Excel (Lampiran 3)"}
          </button>
          <button onClick={reload} className="btn btn-ghost text-xs">↻ Muat ulang</button>
        </div>
      </div>

      {/* ================= papan tenggat ================= */}
      {now && periode && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PapanTenggat
            judul={`Rencana ${periode.label}`}
            sub="Budget rutin dirilis per 2 bulan · input rencana paling lambat tanggal 22 bulan sebelumnya"
            status={statusTenggat(periode.tenggat, now)}
            aktif={tipe === "rencana"}
            onKlik={() => { setTipe("rencana"); setBulan(periode.mulai); }}
          />
          <PapanTenggat
            judul={`Realisasi ${namaBulan(bulanReal)}`}
            sub="Realisasi satu bulan paling lambat diinput tanggal 1 bulan berikutnya"
            status={statusTenggat(tenggatDoc("realisasi", bulanReal), now)}
            aktif={tipe === "realisasi"}
            onKlik={() => { setTipe("realisasi"); setBulan(bulanReal); }}
          />
        </div>
      )}

      {!ready && (
        <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Butuh Supabase (env) supaya data tersimpan dan bisa dibuka dari perangkat lain.
        </p>
      )}

      {/* ================= pemilih ================= */}
      <div className={`mt-4 bg-white rounded-2xl elev-md ring-line p-4 anim-in`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
            {(["rencana", "realisasi"] as const).map((x) => (
              <button key={x} onClick={() => setTipe(x)}
                className={`text-xs px-4 py-1.5 font-semibold capitalize ${tipe === x ? `text-white bg-gradient-to-r ${NADA[x].grad}` : "bg-white text-slate-600"}`}>
                {x === "rencana" ? "📝 Rencana" : "✅ Realisasi"}
              </button>
            ))}
          </div>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 font-semibold" />
          {tipe === "rencana" && bulan && (
            <span className="text-[11px] text-slate-500">
              periode rilis <b className="text-slate-700">{periodeDari(bulan).label}</b>
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {jumlahTerkirim} terkirim · {jumlahDraf} draf · {KAPAL_ANGGARAN.length - jumlahTerkirim - jumlahDraf} belum diisi
          </span>
          {jumlahDraf > 0 && (
            <button onClick={tandaiSemua} disabled={sibuk}
              className="btn btn-success text-xs disabled:opacity-50"
              title={`Tandai ${jumlahDraf} kapal yang masih draf sebagai terkirim, sekali klik`}>
              🔒 Tandai semua terkirim ({jumlahDraf})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {KAPAL_ANGGARAN.map((k) => {
            const st = statusKapal(k);
            const aktif = k === kapal;
            return (
              <button key={k} onClick={() => setKapal(k)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 ${
                  aktif ? `text-white border-transparent bg-gradient-to-r ${nada.grad}`
                        : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                {k.replace("KMP. ", "")}
                <span className={aktif ? "opacity-90" : ""}>
                  {st === "terkirim" ? "🔒" : st === "draf" ? "•" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">🔒 = sudah ditandai terkirim (terkunci) · • = draf tersimpan</p>
      </div>

      {/* ================= kendali RKA (khusus rencana) ================= */}
      {tipe === "rencana" && bulan && (
        <div className="mt-4 rounded-2xl bg-white px-5 py-4 elev-sm ring-line dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[14rem]">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">🎯 Kendali RKA — {namaBulan(bulan)}</h3>
              <p className="text-[11px] text-slate-500">
                Total usulan seluruh kapal diukur terhadap pagu rutin bulan ini, bukan per kapal sendiri-sendiri.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span className="text-slate-500">Pagu <b className="tabular-nums text-slate-800 dark:text-slate-100">{rupiah(totalKendali.pagu)}</b></span>
              <span className="text-slate-500">Kapal lain <b className="tabular-nums">{rupiah(totalKendali.lain)}</b></span>
              <span className="text-slate-500">{ringkasKapal(kapal)} <b className="tabular-nums text-indigo-700">{rupiah(totalKendali.ini)}</b></span>
              <span className="text-slate-500">Sisa <b className={`tabular-nums ${totalKendali.sisa < 0 ? "text-rose-700" : "text-emerald-700"}`}>{rupiah(totalKendali.sisa)}</b></span>
            </div>
          </div>

          {totalKendali.pagu > 0 ? (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {kendaliRka.filter((b) => b.pagu > 0 || b.kapalIni > 0 || b.kapalLain > 0).map((b) => {
                const pakai = b.kapalLain + b.kapalIni;
                const persen = b.pagu > 0 ? Math.min(100, Math.round((pakai / b.pagu) * 100)) : 0;
                const lewat = b.pagu > 0 && pakai > b.pagu;
                return (
                  <div key={b.kode} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{labelMA(b.kode)}</span>
                      <span className={`shrink-0 text-[10px] font-extrabold tabular-nums ${lewat ? "text-rose-600" : "text-slate-400"}`}>{persen}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className={`h-full ${lewat ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${persen}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] tabular-nums text-slate-500">
                      sisa {rupiah(b.sisa)} <span className="text-slate-400">dari {rupiah(b.pagu)}</span>
                      {b.kapalIni > 0 && <span className="text-indigo-600"> · kapal ini {rupiah(b.kapalIni)}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
              Pagu {namaBulan(bulan)} belum ada di Dashboard Anggaran, jadi kendali RKA belum bisa dihitung.
              Isi dulu pagunya supaya total usulan seluruh kapal punya pembanding.
            </p>
          )}
        </div>
      )}

      {/* ================= editor ================= */}
      {kerja && bulan && (
        <div className={`mt-4 bg-white rounded-2xl elev-md ring-1 ${nada.ring} anim-in`}>
          <div className={`px-5 py-3 rounded-t-2xl ${nada.bg} flex flex-wrap items-center gap-3`}>
            <div>
              <h2 className={`font-extrabold ${nada.teks}`}>
                {tipe === "rencana" ? "Usulan Program Perawatan" : "Realisasi Perawatan"} — {kapal}
              </h2>
              <p className="text-[11px] text-slate-600">
                {namaBulan(bulan)}
                {tenggat && <> · <span className={tenggat.tingkat === "lewat" ? "text-rose-700 font-bold" : "text-slate-600"}>{tenggat.teks}</span></>}
                {kerja.dikirimPada && <> · dikirim {new Date(kerja.dikirimPada).toLocaleString("id-ID")}</>}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!terkunci ? (
                <>
                  <button onClick={() => salinDari(dok.find((x) => x.tipe === tipe && x.bulan === bulanKe(bulan, -1) && x.kapal === kapal))}
                    className="btn btn-ghost text-xs" title={`Salin isi ${tipe} ${namaBulan(bulanKe(bulan, -1))} kapal ini`}>
                    ⧉ Salin bulan lalu
                  </button>
                  {tipe === "rencana" && (
                    <button onClick={() => setBukaSusun(true)} className="btn btn-ghost text-xs"
                      title="Pilih barang dari riwayat SPPBJ kapal ini, dengan kendali pagu RKA bulan ini">
                      🧩 Susun dari riwayat
                    </button>
                  )}
                  {tipe === "realisasi" && (
                    <>
                      <button onClick={() => salinDari(dok.find((x) => x.tipe === "rencana" && x.bulan === bulan && x.kapal === kapal))}
                        className="btn btn-ghost text-xs" title="Salin dari rencana bulan ini, lalu sesuaikan yang benar-benar terpakai">
                        ⧉ Salin dari rencana
                      </button>
                      <button onClick={tarikDariPengadaan} className="btn btn-ghost text-xs"
                        title="Isi otomatis dari SPPBJ & Non PR PO Rutin bulan ini untuk kapal ini — angkanya dari dokumen yang benar-benar ada">
                        ⚡ Tarik dari SPPBJ / Non PR PO
                      </button>
                    </>
                  )}
                  <button onClick={() => simpanDoc()} disabled={sibuk || (!berubah && !!tersimpan)} className="btn btn-primary text-xs disabled:opacity-50">
                    {sibuk ? "…" : !tersimpan ? "💾 Simpan" : berubah ? "💾 Simpan perubahan" : "✓ Tersimpan"}
                  </button>
                  <button onClick={tandaiTerkirim} disabled={sibuk || t.total <= 0} className="btn btn-success text-xs disabled:opacity-40"
                    title={t.total <= 0 ? "Isi dulu itemnya" : "Kunci dokumen ini sebagai sudah dikirim ke pusat"}>
                    🔒 Tandai terkirim
                  </button>
                  {tersimpan && (
                    <button onClick={hapusDoc} disabled={sibuk} className="btn btn-danger-soft text-xs"
                      title="Hapus dokumen ini (salah bulan / salah kapal)">🗑️ Hapus</button>
                  )}
                </>
              ) : (
                <>
                  <span className="chip bg-emerald-100 text-emerald-800">TERKIRIM · terkunci</span>
                  <button onClick={bukaKunci} className="btn btn-ghost text-xs">🔓 Buka kunci (revisi)</button>
                </>
              )}
            </div>
          </div>

          {pesan && <p className="px-5 pt-3 text-xs font-semibold text-slate-600 whitespace-pre-line leading-relaxed">{pesan}</p>}
          {simpanErr && <p className="px-5 pt-3 text-xs font-semibold text-rose-700">Supabase: {simpanErr}</p>}
          {tenggat?.tingkat === "lewat" && !terkunci && (
            <p className="mx-5 mt-3 text-xs bg-rose-50 text-rose-800 ring-1 ring-rose-200 rounded-lg px-3 py-2">
              Sudah lewat tenggat ({tenggat.teks}). Isi tetap bisa disimpan, tapi laporkan keterlambatannya ke pusat.
            </p>
          )}
          {dobel.n > 0 && !terkunci && (
            <div className="mx-5 mt-3 text-xs bg-amber-50 text-amber-900 ring-1 ring-amber-300 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex-1 min-w-[16rem]">
                <b>⚠ Ada {dobel.n} baris dobel</b> senilai <b className="tabular-nums">{rupiah(Math.round(dobel.nilai))}</b> — jumlahnya melebihi yang benar-benar ada di SPPBJ / Non PR PO
                {dobel.rincian.length ? <> (mis. <i>{dobel.rincian[0].nama}</i> kelebihan {dobel.rincian[0].lebih} baris)</> : null}.
                Kalau dibiarkan, realisasi yang dilaporkan jadi lebih besar dari kenyataan.
              </span>
              <button onClick={rapikanDobel} className="btn btn-ghost text-xs shrink-0" title="Buang baris berlebih; sisakan sebanyak yang ada di SPPBJ. Baris ketik tangan tidak diusik.">
                🧹 Rapikan dobel
              </button>
            </div>
          )}
          {salahTempat.n > 0 && !terkunci && (
            <div className="mx-5 mt-3 text-xs bg-sky-50 text-slate-800 ring-1 ring-sky-200 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex-1 min-w-[16rem]">
                <b>⇄ {salahTempat.n} item bisa ditata ulang</b> ke judul kebutuhan yang lebih tepat
                {salahTempat.rincian.length ? <> (mis. {salahTempat.rincian[0].n} item <i>{salahTempat.rincian[0].dari}</i> → <i>{salahTempat.rincian[0].ke}</i>)</> : null}.
                Berkas realisasinya jadi terbaca per jenis kebutuhan, bukan menumpuk di Lain-Lain.
              </span>
              <button onClick={tataUlangKelompok} className="btn btn-ghost text-xs shrink-0"
                title="Pindahkan item hasil tarikan ke kelompok yang tepat. Nilai & Mata Anggaran tidak berubah.">
                ⇄ Tata ulang kelompok
              </button>
            </div>
          )}

          <div className="p-5 pt-4 space-y-3">
            {MA_RR.map((ma) => {
              const kelompokMA = KELOMPOK_RR.filter((k) => k.kode === ma.kode);
              const totalMA = kelompokMA.reduce((s, k) => {
                const g = kerja.kelompok.find((x) => x.kunci === kunciKelompok(k));
                return s + (g ? totalKelompok(g) : 0);
              }, 0);
              return (
                <div key={ma.kode} className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-slate-700">{ma.ma}</span>
                    <span className="ml-auto text-xs font-bold text-slate-800">{totalMA ? rupiah(totalMA) : "—"}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {kelompokMA.map((k) => (
                      <Kelompok key={kunciKelompok(k)} judul={k.judul} terkunci={terkunci}
                        items={kerja.kelompok.find((x) => x.kunci === kunciKelompok(k))?.items || []}
                        tetangga={kelompokMA.filter((x) => x.judul !== k.judul).map((x) => ({ kunci: kunciKelompok(x), judul: x.judul }))}
                        onPindah={(itemId, tujuan) => ubah((d) => {
                          const asal = d.kelompok.find((x) => x.kunci === kunciKelompok(k));
                          const it = asal?.items.find((i) => i.id === itemId);
                          if (!asal || !it) return;
                          asal.items = asal.items.filter((i) => i.id !== itemId);
                          const g = d.kelompok.find((x) => x.kunci === tujuan);
                          if (g) g.items.push(it);
                          else d.kelompok.push({ kunci: tujuan, items: [it] });
                        })}
                        onUbah={(items) => ubah((d) => {
                          const g = d.kelompok.find((x) => x.kunci === kunciKelompok(k));
                          if (g) g.items = items;
                          else d.kelompok.push({ kunci: kunciKelompok(k), items });
                        })} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
            <label className="text-[11px] text-slate-600 flex items-center gap-1.5">
              PPN
              <select value={kerja.ppnPersen} disabled={terkunci}
                onChange={(e) => ubah((d) => { d.ppnPersen = +e.target.value; })}
                className="text-xs border border-slate-300 rounded px-1.5 py-1">
                <option value={0}>0%</option>
                <option value={11}>11%</option>
                <option value={12}>12%</option>
              </select>
            </label>
            <input value={kerja.catatan || ""} disabled={terkunci} placeholder="Catatan (opsional)"
              onChange={(e) => ubah((d) => { d.catatan = e.target.value; })}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 flex-1 min-w-[200px]" />
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total {tipe}</p>
              <p className="text-xl font-extrabold text-slate-800 tabular-nums">{rupiah(t.total)}</p>
              {kerja.ppnPersen > 0 && <p className="text-[10px] text-slate-500">dasar {rupiah(t.dasar)} + PPN {rupiah(t.ppn)}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ================= rekap semua kapal ================= */}
      <Rekap dok={dok} bulan={bulan} tipe={tipe} harap={harapBulan} dash={dashBulan} />

      {loading && <p className="mt-4 text-xs text-slate-400">memuat…</p>}
      {dialogKonfirmasi}

      <SusunRencana
        buka={bukaSusun && tipe === "rencana" && !terkunci}
        tutup={() => setBukaSusun(false)}
        bulan={bulan}
        kapal={kapal}
        kandidat={kandidatRiwayat}
        pagu={paguRka}
        kapalLain={rencanaKapalLain}
        kapalIni={rencanaKapalIni}
        kapalBelum={kapalBelumSusun}
        tambah={tambahDariRiwayat}
      />
    </main>
  );
}

/* ---------------- papan tenggat ---------------- */
function PapanTenggat({ judul, sub, status, aktif, onKlik }: {
  judul: string; sub: string; status: ReturnType<typeof statusTenggat>; aktif: boolean; onKlik: () => void;
}) {
  return (
    <button onClick={onKlik}
      className={`text-left rounded-2xl px-4 py-3 ring-1 transition ${WARNA_TENGGAT[status.tingkat]} ${aktif ? "ring-2" : "hover:brightness-95"}`}>
      <div className="flex items-center gap-2">
        <p className="font-extrabold text-sm">{judul}</p>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70">
          {status.tingkat === "lewat" ? "LEWAT" : status.sisaHari <= 1 ? "HARI INI" : `H-${status.sisaHari}`}
        </span>
      </div>
      <p className="text-[11px] font-semibold mt-0.5">{status.teks}</p>
      <p className="text-[10px] opacity-70 mt-1 leading-snug">{sub}</p>
    </button>
  );
}

/* ---------------- satu kelompok kebutuhan ---------------- */
function Kelompok({ judul, items, terkunci, onUbah, tetangga = [], onPindah }: {
  judul: string; items: RrItem[]; terkunci: boolean; onUbah: (i: RrItem[]) => void;
  tetangga?: { kunci: string; judul: string }[];
  onPindah?: (itemId: string, tujuan: string) => void;
}) {
  // null = ikuti isinya (kelompok berisi otomatis terbuka, termasuk saat data baru tiba)
  const [bukaManual, setBukaManual] = useState<boolean | null>(null);
  const buka = bukaManual ?? items.length > 0;
  const setBuka = (v: boolean) => setBukaManual(v);
  const total = items.reduce((s, i) => s + nilaiItem(i), 0);

  const set = (id: string, f: (i: RrItem) => void) => {
    const next = items.map((i) => { if (i.id !== id) return i; const s = { ...i }; f(s); return s; });
    onUbah(next);
  };
  const tambah = () => { onUbah([...items, barisKosong()]); setBuka(true); };
  const buang = (id: string) => onUbah(items.filter((i) => i.id !== id));

  /** tempel dari Excel: Deskripsi | Spesifikasi | Jumlah | Satuan | Harga */
  const tempel = (teks: string) => {
    const baris = teks.split(/\r?\n/).map((b) => b.split("\t")).filter((k) => k.some((x) => x.trim()));
    if (!baris.length) return;
    const angka = (s: string) => Number((s || "").replace(/[^\d,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) || 0;
    const baru: RrItem[] = baris.map((k) => ({
      id: uid(), deskripsi: (k[0] || "").trim(), spesifikasi: (k[1] || "").trim(),
      jumlah: angka(k[2] || ""), satuan: (k[3] || "").trim(), harga: angka(k[4] || ""),
    }));
    onUbah([...items.filter((i) => i.deskripsi || i.harga), ...baru]);
    setBuka(true);
  };

  return (
    <div>
      <div className="px-3 py-1.5 flex items-center gap-2 bg-white">
        <button onClick={() => setBuka(!buka)} className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <span className="text-slate-400">{buka ? "▾" : "▸"}</span> {judul}
        </button>
        <span className="text-[10px] text-slate-400">{items.length ? `${items.length} item` : "kosong"}</span>
        <span className="ml-auto text-[11px] font-bold text-slate-700 tabular-nums">{total ? rupiah(total) : ""}</span>
        {!terkunci && <button onClick={tambah} className="text-[11px] font-bold text-blue-700 hover:underline">+ baris</button>}
      </div>

      {buka && (
        <div className="px-3 pb-3">
          {items.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-1">
              Belum ada item. <button onClick={tambah} className="text-blue-700 font-semibold hover:underline">Tambah baris</button>
              {!terkunci && <> atau tempel dari Excel di kotak bawah.</>}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">
                    <th className="text-left p-1 w-[30%]">Deskripsi</th>
                    <th className="text-left p-1 w-[26%]">Spesifikasi</th>
                    <th className="text-right p-1 w-14">Jml</th>
                    <th className="text-left p-1 w-16">Satuan</th>
                    <th className="text-right p-1 w-28">Harga Satuan</th>
                    <th className="text-right p-1 w-28">Total</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="p-1">
                        <input value={i.deskripsi} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.deskripsi = e.target.value; })}
                          className="w-full border border-slate-200 rounded px-1.5 py-1" placeholder="nama barang / jasa" />
                        {i.asal ? <span className="block text-[9px] text-slate-400 mt-0.5 truncate" title={i.asal}>dari {i.asal}</span> : null}
                      </td>
                      <td className="p-1">
                        <input value={i.spesifikasi} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.spesifikasi = e.target.value; })}
                          className="w-full border border-slate-200 rounded px-1.5 py-1" />
                      </td>
                      <td className="p-1">
                        <input type="number" value={i.jumlah || ""} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.jumlah = +e.target.value; })}
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1" />
                      </td>
                      <td className="p-1">
                        <input value={i.satuan} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.satuan = e.target.value; })}
                          className="w-full border border-slate-200 rounded px-1.5 py-1" placeholder="Pcs" />
                      </td>
                      <td className="p-1">
                        <input type="number" value={i.harga || ""} disabled={terkunci} onChange={(e) => set(i.id, (x) => { x.harga = +e.target.value; })}
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1" />
                      </td>
                      <td className="p-1 text-right font-bold text-slate-700 tabular-nums">{nilaiItem(i) ? rupiah(nilaiItem(i)) : "—"}</td>
                      <td className="p-1 text-center whitespace-nowrap">
                        {!terkunci && tetangga.length > 0 && onPindah && (
                          <select value="" onChange={(e) => { if (e.target.value) onPindah(i.id, e.target.value); }}
                            title="Pindahkan baris ini ke kelompok lain dalam Mata Anggaran yang sama"
                            className="text-[10px] border border-slate-200 rounded w-6 mr-0.5 text-slate-500">
                            <option value="">⇄</option>
                            {tetangga.map((t) => <option key={t.kunci} value={t.kunci}>{t.judul}</option>)}
                          </select>
                        )}
                        {!terkunci && <button onClick={() => buang(i.id)} className="text-rose-500 hover:text-rose-700" title="Hapus baris">✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!terkunci && (
            <textarea rows={1} placeholder="Tempel dari Excel: Deskripsi ⇥ Spesifikasi ⇥ Jumlah ⇥ Satuan ⇥ Harga Satuan"
              onPaste={(e) => { e.preventDefault(); tempel(e.clipboardData.getData("text")); }}
              onChange={() => {}}
              value=""
              className="mt-2 w-full text-[10px] border border-dashed border-slate-300 rounded px-2 py-1 text-slate-500" />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- rekap semua kapal (Budget Control Rutin) ---------------- */
/**
 * Berapa NILAI YANG SEHARUSNYA masuk Lampiran 3 pada satu bulan, dipecah per kapal —
 * dihitung langsung dari SPPBJ/Non PR PO Rutin, memakai rumus yang sama dengan
 * Dashboard Anggaran Rutin. Dipakai untuk mencocokkan; kalau tak sama, sebabnya
 * ikut dilaporkan (item tanpa nama kapal, Mata Anggaran di luar Lampiran 3, dst).
 */
function hitungSeharusnya(pengadaan: PengadaanRow[], bulan: string) {
  const kodeLampiran = new Set(KELOMPOK_RR.map((k) => k.kode));
  const perKapal: Record<string, number> = {};
  let bisa = 0, tanpaKapal = 0, kapalAsing = 0, maLuar = 0;
  const cTanpaKapal: { nama: string; dok: string; nilai: number }[] = [];
  const cKapalAsing: { nama: string; kapal: string; nilai: number }[] = [];
  const cMaLuar: { nama: string; ma: string; nilai: number }[] = [];

  for (const p of pengadaan) {
    if (p.jenis !== "rutin" || p.stok) continue;              // sama dengan realisasiRutin()
    if ((p.tanggal || "").slice(0, 7) !== bulan) continue;
    const arr: any[] = p.items || [];
    const adaFinal = arr.some((it) => (it.hargaSpbj || 0) > 0);
    const maDefault = (p.mataAnggaran || [])[0] || "";
    for (const it of arr) {
      const nilai = (adaFinal ? (it.hargaSpbj || it.harga || 0) : (it.harga || 0)) * (it.jumlah || 0);
      if (!nilai) continue;
      const kode = maKey((it.mataAnggaran || "").trim() || maDefault);
      if (!kodeLampiran.has(kode)) {
        maLuar += nilai; cMaLuar.push({ nama: it.nama || "(tanpa nama)", ma: kode, nilai });
        continue;
      }
      const semua = pecahKapal(it.kapal || "").map(namaKapalPenuh);
      const dikenal = semua.filter((k) => KAPAL_ANGGARAN.includes(k));
      if (!semua.length) {
        tanpaKapal += nilai; cTanpaKapal.push({ nama: it.nama || "(tanpa nama)", dok: p.nama, nilai });
        continue;
      }
      if (!dikenal.length) {
        kapalAsing += nilai; cKapalAsing.push({ nama: it.nama || "(tanpa nama)", kapal: semua.join(", "), nilai });
        continue;
      }
      // item multi-kapal dibagi rata — persis seperti saat ditarik
      const bagi = nilai / semua.length;
      semua.forEach((k) => {
        if (!KAPAL_ANGGARAN.includes(k)) { kapalAsing += bagi; return; }
        perKapal[k] = (perKapal[k] || 0) + bagi; bisa += bagi;
      });
    }
  }
  return {
    perKapal, bisa, tanpaKapal, kapalAsing, maLuar,
    contoh: { tanpaKapal: cTanpaKapal, kapalAsing: cKapalAsing, maLuar: cMaLuar },
  };
}

function Rekap({ dok, bulan, tipe, harap, dash }: {
  dok: RrDoc[]; bulan: string; tipe: TipeRR;
  harap: ReturnType<typeof hitungSeharusnya>; dash: number;
}) {
  const baris = useMemo(() => KAPAL_ANGGARAN.map((k) => {
    const d = dok.find((x) => x.tipe === tipe && x.bulan === bulan && x.kapal === k);
    const per = d ? totalPerMA(d) : {};
    const t = d ? totalDoc(d) : { dasar: 0, ppn: 0, total: 0 };
    return { kapal: k, per, total: t.total, dasar: t.dasar, status: d?.status, ada: !!d, harus: harap.perKapal[k] || 0 };
  }), [dok, bulan, tipe, harap]);

  const totalSemua = baris.reduce((s, b) => s + b.total, 0);
  const dasarSemua = baris.reduce((s, b) => s + b.dasar, 0);
  const ppnSemua = totalSemua - dasarSemua;
  const selisih = Math.round(dasarSemua - harap.bisa);
  const takTertarik = harap.tanpaKapal + harap.kapalAsing + harap.maLuar;
  const belumDiisi = baris.filter((b) => b.harus > 0 && b.dasar <= 0);
  const bedaKapal = baris.filter((b) => b.dasar > 0 && Math.abs(b.dasar - b.harus) >= 1000);
  const pas = Math.abs(selisih) < 1000;   // beda < Rp 1.000 = pembulatan harga satuan
  if (!bulan) return null;

  return (
    <div className="mt-4 bg-white rounded-2xl elev-md ring-line p-5 anim-in">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg asdp-gradient text-white grid place-items-center text-sm">📋</span>
        <span className="accent-bar">Rekap {tipe} {namaBulan(bulan)} — semua kapal</span>
      </h3>

      {/* ===== pencocokan dengan Dashboard Anggaran Rutin ===== */}
      {tipe === "realisasi" && (dash > 0 || dasarSemua > 0) && (
        <div className={`mb-4 rounded-xl ring-1 overflow-hidden ${pas ? "ring-emerald-300 bg-emerald-50" : "ring-amber-300 bg-amber-50"}`}>
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-black/5">
            <span className="text-sm font-extrabold text-slate-800">
              {pas ? "✅ Cocok dengan Dashboard Anggaran Rutin" : "⚠ Belum cocok dengan Dashboard Anggaran Rutin"}
            </span>
            <span className="text-[11px] text-slate-600">{namaBulan(bulan)} · realisasi Rutin seluruh kapal</span>
            <a href={`/dashboard?v=rutin`} className="ml-auto text-[11px] font-bold text-[#1ca3dd] hover:text-[#16357f]">buka Dashboard →</a>
          </div>

          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/5">
            <Angka label="Dashboard Rutin — terpakai" nilai={rupiah(Math.round(dash))} sub="dari SPPBJ + Non PR PO bulan ini" />
            <Angka label="Lampiran 3 — semua kapal" nilai={rupiah(Math.round(dasarSemua))}
              sub={ppnSemua ? `di luar PPN ${rupiah(Math.round(ppnSemua))}` : "sebelum PPN"} />
            <Angka label="Seharusnya bisa ditarik" nilai={rupiah(Math.round(harap.bisa))}
              sub={selisih === 0 ? "sudah masuk semua"
                : selisih < 0 ? `kurang ${rupiah(Math.abs(selisih))}` : `lebih ${rupiah(selisih)}`}
              tint={pas ? "text-emerald-800" : "text-amber-900"} />
          </div>

          <div className="px-4 py-2.5 text-[11px] text-slate-700 space-y-1 border-t border-black/5">
            {takTertarik > 0 && (
              <p>
                <b>{rupiah(Math.round(takTertarik))}</b> dari Dashboard memang <b>tidak bisa</b> masuk Lampiran 3:
                {harap.tanpaKapal > 0 && <> {harap.contoh.tanpaKapal.length} item tanpa nama kapal ({rupiah(Math.round(harap.tanpaKapal))}
                  {harap.contoh.tanpaKapal[0] ? <>, mis. <i>{harap.contoh.tanpaKapal[0].nama}</i></> : null})</>}
                {harap.kapalAsing > 0 && <> · {harap.contoh.kapalAsing.length} item kapalnya di luar daftar armada ({rupiah(Math.round(harap.kapalAsing))})</>}
                {harap.maLuar > 0 && <> · {harap.contoh.maLuar.length} item Mata Anggarannya di luar Lampiran 3 ({rupiah(Math.round(harap.maLuar))}
                  {harap.contoh.maLuar[0] ? <>, mis. MA {harap.contoh.maLuar[0].ma}</> : null})</>}
                . Perbaiki di SPPBJ-nya kalau memang salah isi.
              </p>
            )}
            {!pas && belumDiisi.length > 0 && (
              <p className="text-amber-900 font-semibold">
                <b>Belum ditarik sama sekali</b> ({belumDiisi.length} kapal, {rupiah(Math.round(belumDiisi.reduce((s, b) => s + b.harus, 0)))}):{" "}
                {belumDiisi.map((b) => `${ringkasKapal(b.kapal)} ${rupiah(Math.round(b.harus))}`).join(" · ")}
                {" "}— buka kapalnya lalu tekan ⚡ Tarik dari SPPBJ / Non PR PO.
              </p>
            )}
            {!pas && bedaKapal.length > 0 && (
              <p className="text-amber-900 font-semibold">
                <b>Angkanya berbeda</b> ({bedaKapal.length} kapal):{" "}
                {bedaKapal.map((b) => {
                  const d = Math.round(b.dasar - b.harus);
                  return `${ringkasKapal(b.kapal)} ${d > 0 ? "+" : ""}${rupiah(d)}`;
                }).join(" · ")}
                {" "}— tarik ulang (yang sudah ada otomatis dilewati), atau periksa baris yang diketik tangan.
              </p>
            )}
            {!pas && belumDiisi.length === 0 && bedaKapal.length === 0 && (
              <p className="text-amber-900 font-semibold">
                Selisih {rupiah(Math.abs(selisih))} — lihat kolom <b>Selisih</b> di tabel bawah.
              </p>
            )}
            {pas && (
              <p className="text-emerald-800">
                Total Lampiran 3 sudah sama dengan yang bisa ditarik dari SPPBJ / Non PR PO bulan ini
                {takTertarik > 0 ? " (di luar yang memang tak bisa masuk di atas)" : ""}. Aman dikirim ke pusat.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-slate-600 font-bold bg-slate-100">
            <tr>
              <th className="p-2 text-left">Kapal</th>
              {MA_RR.map((m) => <th key={m.kode} className="p-2 text-right whitespace-nowrap">{m.kode}</th>)}
              <th className="p-2 text-right">Total</th>
              {tipe === "realisasi" && <>
                <th className="p-2 text-right whitespace-nowrap" title="Nilai yang seharusnya masuk, dihitung dari SPPBJ / Non PR PO bulan ini">Seharusnya</th>
                <th className="p-2 text-right">Selisih</th>
              </>}
              <th className="p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.kapal} className="border-b border-slate-100 last:border-0">
                <td className="p-2 font-semibold text-slate-700 whitespace-nowrap">{b.kapal}</td>
                {MA_RR.map((m) => (
                  <td key={m.kode} className="p-2 text-right tabular-nums text-slate-600">
                    {b.per[m.kode] ? rupiah(b.per[m.kode]) : "–"}
                  </td>
                ))}
                <td className="p-2 text-right font-bold text-slate-800 tabular-nums">{b.total ? rupiah(b.total) : "–"}</td>
                {tipe === "realisasi" && (() => {
                  const bedaK = Math.round(b.dasar - b.harus);
                  const pasK = Math.abs(bedaK) < 1000;
                  return <>
                    <td className="p-2 text-right tabular-nums text-slate-500">{b.harus ? rupiah(Math.round(b.harus)) : "–"}</td>
                    <td className={`p-2 text-right tabular-nums font-bold ${!b.harus && !b.dasar ? "text-slate-300" : pasK ? "text-emerald-700" : "text-amber-700"}`}
                      title={pasK ? "sudah sama" : bedaK < 0 ? "masih kurang dari SPPBJ" : "lebih besar dari SPPBJ"}>
                      {!b.harus && !b.dasar ? "–" : pasK ? "✓" : (bedaK > 0 ? "+" : "") + rupiah(bedaK)}
                    </td>
                  </>;
                })()}
                <td className="p-2 text-center">
                  {b.status === "terkirim" ? <span className="chip bg-emerald-100 text-emerald-700">terkirim</span>
                    : b.ada ? <span className="chip bg-amber-100 text-amber-700">draf</span>
                    : <span className="chip bg-slate-100 text-slate-500">belum</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-extrabold">
              <td className="p-2 text-slate-800">TOTAL</td>
              {MA_RR.map((m) => (
                <td key={m.kode} className="p-2 text-right tabular-nums text-slate-800">
                  {rupiah(baris.reduce((s, b) => s + (b.per[m.kode] || 0), 0))}
                </td>
              ))}
              <td className="p-2 text-right text-slate-900 tabular-nums">{rupiah(totalSemua)}</td>
              {tipe === "realisasi" && <>
                <td className="p-2 text-right tabular-nums text-slate-600">{rupiah(Math.round(harap.bisa))}</td>
                <td className={`p-2 text-right tabular-nums ${pas ? "text-emerald-700" : "text-amber-700"}`}>
                  {pas ? "✓" : (selisih > 0 ? "+" : "") + rupiah(selisih)}
                </td>
              </>}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Angka({ label, nilai, sub, tint = "text-slate-900" }: { label: string; nilai: string; sub?: string; tint?: string }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</p>
      <p className={`text-base font-extrabold tabular-nums leading-tight ${tint}`}>{nilai}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}
