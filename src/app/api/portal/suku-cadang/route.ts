/**
 * Persediaan suku cadang — diisi akun kapal (Deck dan Mesin, masing-masing lembarnya sendiri).
 *
 * Yang dikirim kapal hanya kejadian: barang baru didaftarkan, barang diterima,
 * barang dipakai, hasil cek fisik. Setiap kejadian disimpan satu per satu begitu
 * tombolnya ditekan — bukan dikumpulkan lalu disimpan sekali — karena satu
 * penerimaan adalah satu fakta utuh: kalau sinyal putus, yang hilang paling
 * banyak satu kejadian, dan layar memberi tahu kejadian yang mana.
 *
 * Server menolak kejadian yang membuat stok minus pada tanggal mana pun. Stok
 * minus di borang berarti ada penerimaan yang belum dicatat; lebih murah
 * menanyakannya sekarang daripada menebaknya di kantor tiga bulan kemudian.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbSiap } from "@/lib/dbServer";
import { sambungJejak, sesiKapal } from "@/lib/portal/server";
import {
  LABEL_MUTASI, cekMinus, hariIni, petaStok, tglPanjang,
  type ItemSC, type LembarSC, type MutasiSC,
} from "@/lib/portal/sukuCadang";
import {
  angka, bersihkanItem, bersihkanPenandaTangan, idBaru, lembarSC, tanggalSah, teks,
} from "@/lib/portal/sukuCadangServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAKS_BARANG = 600;
const MAKS_IMPOR = 300;

const salah = (pesan: string, status = 400) => NextResponse.json({ ok: false, error: pesan }, { status });

export async function GET() {
  const s = await sesiKapal();
  if (!s) return salah("Belum masuk", 401);
  if (!dbSiap()) return salah("Sumber data belum siap", 503);
  try {
    const { lembar } = await lembarSC(s.kapal, s.bagian);
    return NextResponse.json({ ok: true, ...lembar, riwayat: undefined });
  } catch (e: any) {
    console.error("portal/suku-cadang baca:", e?.message);
    return salah("Persediaan gagal dimuat. Coba lagi.", 500);
  }
}

/** tanggal kejadian: wajib sah, tidak di masa depan, tidak lebih dari setahun ke belakang */
function periksaTanggal(t: unknown): { tanggal?: string; galat?: string } {
  const tanggal = tanggalSah(t);
  if (!tanggal) return { galat: "Tanggal tidak terbaca" };
  if (tanggal > hariIni()) return { galat: "Tanggal tidak boleh melewati hari ini" };
  const batas = new Date();
  batas.setFullYear(batas.getFullYear() - 1);
  if (new Date(`${tanggal}T00:00:00`) < batas) return { galat: "Tanggal lebih dari setahun yang lalu — hubungi kantor" };
  return { tanggal };
}

export async function POST(req: NextRequest) {
  const s = await sesiKapal();
  if (!s) return salah("Belum masuk", 401);
  if (!dbSiap()) return salah("Sumber data belum siap", 503);

  const isi = (await req.json().catch(() => ({}))) as any;
  const kini = new Date().toISOString();

  let c: any, id: string, lembar: LembarSC | null;
  try {
    ({ c, id, lembar } = await lembarSC(s.kapal, s.bagian));
  } catch (e: any) {
    console.error("portal/suku-cadang siapkan:", e?.message);
    return salah("Lembar persediaan gagal disiapkan", 500);
  }
  if (!c || !id || !lembar) return salah("Lembar persediaan gagal disiapkan", 500);

  const item = [...lembar.item];
  const mutasi = [...lembar.mutasi];
  let cekFisik = [...lembar.cekFisik];
  let penandaTangan = lembar.penandaTangan;
  let rincian = "";
  let kabar = "";
  const namaBarang = (i?: ItemSC) => (i ? `${i.nama}${i.partNumber ? ` (${i.partNumber})` : ""}` : "barang");

  switch (isi.aksi) {
    /* ── terima / pakai ─────────────────────────────────────────────── */
    case "mutasi": {
      const jenis = isi.jenis === "pakai" ? "pakai" : isi.jenis === "terima" ? "terima" : "";
      if (!jenis) return salah("Jenis kejadian harus Terima atau Pakai");
      const barang = item.find((i) => i.id === isi.itemId);
      if (!barang) return salah("Barang tidak ditemukan — muat ulang halaman");
      if (!barang.aktif) return salah("Barang ini sudah dinonaktifkan");
      const jumlah = angka(isi.jumlah);
      if (!Number.isFinite(jumlah) || jumlah <= 0) return salah("Jumlah harus lebih dari 0");
      const { tanggal, galat } = periksaTanggal(isi.tanggal);
      if (!tanggal) return salah(galat!);
      const m: MutasiSC = {
        id: idBaru("mt"), itemId: barang.id, jenis, jumlah, tanggal,
        keterangan: teks(isi.keterangan, 160), oleh: s.nama, dicatatPada: kini,
      };
      mutasi.push(m);
      const minus = cekMinus(mutasi, barang.id);
      if (minus) {
        return salah(`Stok ${namaBarang(barang)} akan menjadi ${minus.stok} ${barang.satuan} pada ${tglPanjang(minus.tanggal)}. `
          + "Kemungkinan ada penerimaan yang belum dicatat — catat penerimaannya dulu, atau periksa jumlah dan tanggalnya.");
      }
      rincian = `${LABEL_MUTASI[jenis]} ${jumlah} ${barang.satuan} ${namaBarang(barang)} (${tanggal})`;
      kabar = `${LABEL_MUTASI[jenis]} ${jumlah} ${barang.satuan} tercatat. Stok sekarang ${petaStok(mutasi).get(barang.id) || 0} ${barang.satuan}.`;
      break;
    }

    /* ── batalkan kejadian yang keliru ─────────────────────────────── */
    case "batal": {
      const i = mutasi.findIndex((m) => m.id === isi.mutasiId);
      if (i < 0) return salah("Catatan tidak ditemukan — muat ulang halaman");
      if (mutasi[i].dibatalkan) return salah("Catatan ini sudah dibatalkan");
      const alasan = teks(isi.alasan, 120);
      if (!alasan) return salah("Tulis alasan pembatalan");
      mutasi[i] = { ...mutasi[i], dibatalkan: { pada: kini, oleh: s.nama, alasan } };
      const barang = item.find((x) => x.id === mutasi[i].itemId);
      const minus = cekMinus(mutasi, mutasi[i].itemId);
      if (minus) {
        return salah(`Pembatalan ini membuat stok ${namaBarang(barang)} minus pada ${tglPanjang(minus.tanggal)}. `
          + "Batalkan dulu pemakaian sesudahnya yang bergantung pada penerimaan ini.");
      }
      rincian = `Batal: ${LABEL_MUTASI[mutasi[i].jenis]} ${mutasi[i].jumlah} ${namaBarang(barang)} — ${alasan}`;
      kabar = "Catatan dibatalkan.";
      break;
    }

    /* ── daftarkan atau ubah satu barang ───────────────────────────── */
    case "barang": {
      const lama = isi.item?.id ? item.find((i) => i.id === isi.item.id) : undefined;
      if (isi.item?.id && !lama) return salah("Barang tidak ditemukan — muat ulang halaman");
      const b = bersihkanItem(isi.item, lama, kini);
      if (!b.nama) return salah("Nama barang wajib diisi");
      if (!lama) {
        if (item.filter((i) => i.aktif).length >= MAKS_BARANG) return salah(`Daftar sudah ${MAKS_BARANG} barang`);
        const kembar = item.find((i) => i.aktif && b.partNumber && i.partNumber === b.partNumber && i.peralatan === b.peralatan);
        if (kembar) return salah(`Part number ${b.partNumber} sudah terdaftar untuk ${b.peralatan} (${kembar.nama}). Catat penerimaannya di barang itu.`);
        item.push(b);
        const awal = angka(isi.stokAwal);
        if (Number.isFinite(awal) && awal > 0) {
          const { tanggal, galat } = periksaTanggal(isi.tanggalAwal || hariIni());
          if (!tanggal) return salah(galat!);
          mutasi.push({
            id: idBaru("mt"), itemId: b.id, jenis: "awal", jumlah: awal, tanggal,
            keterangan: "Stok saat didaftarkan", oleh: s.nama, dicatatPada: kini,
          });
        }
        rincian = `+ ${namaBarang(b)} stok awal ${Number.isFinite(awal) ? awal : 0} ${b.satuan}`;
        kabar = `${b.nama} ditambahkan.`;
      } else {
        item[item.indexOf(lama)] = b;
        rincian = lama.aktif && !b.aktif ? `Nonaktif: ${namaBarang(b)}` : `Ubah data: ${namaBarang(b)}`;
        kabar = lama.aktif && !b.aktif ? `${b.nama} dinonaktifkan.` : "Data barang diperbarui.";
      }
      break;
    }

    /* ── tempel banyak barang sekaligus (stok awal) ─────────────────── */
    case "impor": {
      const baris = (Array.isArray(isi.baris) ? isi.baris : []).slice(0, MAKS_IMPOR);
      const { tanggal, galat } = periksaTanggal(isi.tanggal || hariIni());
      if (!tanggal) return salah(galat!);
      let masuk = 0;
      const dilewati: string[] = [];
      for (const r of baris) {
        const b = bersihkanItem(r, undefined, kini);
        const jumlah = angka(r?.jumlah);
        if (!b.nama || !Number.isFinite(jumlah) || jumlah < 0) { dilewati.push(b.nama || "(tanpa nama)"); continue; }
        const kembar = item.find((i) => i.aktif && i.peralatan === b.peralatan
          && (b.partNumber ? i.partNumber === b.partNumber : i.nama.toLowerCase() === b.nama.toLowerCase()));
        if (kembar) { dilewati.push(`${b.nama} (sudah ada)`); continue; }
        if (item.filter((i) => i.aktif).length >= MAKS_BARANG) { dilewati.push(`${b.nama} (daftar penuh)`); continue; }
        item.push(b);
        if (jumlah > 0) {
          mutasi.push({
            id: idBaru("mt"), itemId: b.id, jenis: "awal", jumlah, tanggal,
            keterangan: "Stok awal (tempel dari daftar)", oleh: s.nama, dicatatPada: kini,
          });
        }
        masuk++;
      }
      if (!masuk) return salah(dilewati.length ? `Tidak ada baris baru. Dilewati: ${dilewati.slice(0, 6).join(", ")}` : "Tidak ada baris yang bisa dibaca");
      rincian = `Tempel ${masuk} barang${dilewati.length ? `, ${dilewati.length} dilewati` : ""}`;
      kabar = `${masuk} barang ditambahkan${dilewati.length ? `; ${dilewati.length} dilewati (${dilewati.slice(0, 4).join(", ")}${dilewati.length > 4 ? ", …" : ""})` : ""}.`;
      break;
    }

    /* ── cek fisik: hitungan nyata menggantikan angka catatan ─────────── */
    case "cek-fisik": {
      const { tanggal, galat } = periksaTanggal(isi.tanggal || hariIni());
      if (!tanggal) return salah(galat!);
      const hitung = Array.isArray(isi.hitung) ? isi.hitung : [];
      const stok = petaStok(mutasi);
      let diperiksa = 0, berselisih = 0;
      const catatan: string[] = [];
      for (const h of hitung) {
        const barang = item.find((i) => i.id === h?.itemId && i.aktif);
        const fisik = angka(h?.fisik);
        if (!barang || !Number.isFinite(fisik) || fisik < 0) continue;
        diperiksa++;
        const selisih = Math.round((fisik - (stok.get(barang.id) || 0)) * 1000) / 1000;
        if (selisih === 0) continue;
        /* mutasi sesudah tanggal cek fisik membuat selisihnya bermakna lain */
        const sesudah = mutasi.some((m) => m.itemId === barang.id && !m.dibatalkan && m.tanggal > tanggal);
        if (sesudah) return salah(`${namaBarang(barang)} punya catatan sesudah ${tglPanjang(tanggal)}. Pakai tanggal cek fisik hari ini.`);
        berselisih++;
        mutasi.push({
          id: idBaru("mt"), itemId: barang.id, jenis: "koreksi", jumlah: selisih, tanggal,
          keterangan: teks(h?.alasan, 120) || "Selisih cek fisik", oleh: s.nama, dicatatPada: kini,
        });
        catatan.push(`${barang.nama} ${selisih > 0 ? "+" : ""}${selisih}`);
      }
      if (!diperiksa) return salah("Belum ada jumlah fisik yang diisi");
      cekFisik = [...cekFisik, { tanggal, oleh: s.nama, diperiksa, berselisih }].slice(-36);
      rincian = `Cek fisik ${tanggal}: ${diperiksa} diperiksa, ${berselisih} berselisih${catatan.length ? ` (${catatan.slice(0, 8).join(", ")})` : ""}`;
      kabar = berselisih
        ? `Cek fisik tersimpan. ${berselisih} barang berselisih dan sudah dikoreksi.`
        : `Cek fisik tersimpan. Semua ${diperiksa} barang cocok dengan catatan.`;
      break;
    }

    /* ── nama penanda tangan borang ─────────────────────────────────── */
    case "penanda-tangan": {
      penandaTangan = bersihkanPenandaTangan(isi.penandaTangan, lembar.penandaTangan);
      rincian = "Ubah penanda tangan borang";
      kabar = "Nama penanda tangan tersimpan.";
      break;
    }

    default:
      return salah("Aksi tidak dikenal");
  }

  const { error } = await c.from("projects").update({
    payload: {
      ...lembar, item, mutasi, cekFisik, penandaTangan, diperbaruiPada: kini, olehAkun: s.nama,
      riwayat: sambungJejak(lembar.riwayat, { pada: kini, oleh: s.nama, aksi: isi.aksi, rincian }),
    },
  }).eq("id", id);
  if (error) {
    console.error("portal/suku-cadang simpan:", error.message);
    return salah("Gagal menyimpan. Periksa sinyal lalu coba lagi.", 500);
  }
  return NextResponse.json({ ok: true, kabar, item, mutasi, cekFisik, penandaTangan, diperbaruiPada: kini, olehAkun: s.nama });
}
