/**
 * Gambar rekap kelengkapan armada — untuk dikirim ke grup kapal.
 *
 * Pesan teks menagih dengan kalimat; gambar menagih dengan sekali lihat. Di
 * grup WhatsApp yang ramai, daftar nama kapal sepanjang lima belas baris akan
 * tergulung ke atas dalam dua menit, sedangkan satu gambar tetap bisa dibuka
 * ulang, di-zoom, dan diteruskan ke grup lain tanpa berubah bentuk.
 *
 * Digambar langsung ke <canvas>, bukan lewat pustaka penyalin HTML. Halaman
 * rekap dibuat untuk layar lebar dan penuh warna latar; hasil salinannya akan
 * berupa tabel kecil yang tidak terbaca di layar telepon. Yang dibutuhkan grup
 * bukan potret layar kantor, melainkan satu papan berisi tiga belas kapal
 * dengan empat kotak yang jelas terisi atau tidak.
 *
 * Ukurannya 1080x… — lebar potret yang tidak dipotong WhatsApp, dan tingginya
 * mengikuti jumlah kapal supaya tidak ada ruang kosong di bawah.
 */

export interface BarisKartu {
  kapal: string;
  /** true = dokumen sudah diterima, urut sesuai JENIS_LAPOR */
  isi: boolean[];
}

export interface DataKartu {
  periodeLabel: string;
  kolom: string[];
  baris: BarisKartu[];
  tautan: string;
  /** dasar hitungan yang dipakai rekap, ditulis kecil di kaki gambar */
  catatan: string;
}

const LEBAR = 1080;
const TEPI = 44;
const TINGGI_BARIS = 62;

const BIRU = "#16357f";
const BIRU_TUA = "#0f2456";
const HIJAU = "#16a34a";
const KUNING = "#f59e0b";
const MERAH = "#e11d48";
const ABU = "#cbd5e1";
const TEKS = "#0f172a";
const TEKS_REDUP = "#64748b";

const namaPendek = (k: string) => k.replace(/^KMP\.?\s*/i, "").trim();

/**
 * Kepala kolom ditulis UTUH, dipatah dua baris.
 *
 * Singkatan "PD / PM / LD / LM" memang muat di kolom sempit, tetapi gambar ini
 * dibaca ABK di grup, bukan oleh yang menyusunnya — dan singkatan menuntut
 * pembacanya menoleh ke keterangan di kaki gambar dulu. Nama penuh menghapus
 * langkah itu sepenuhnya: "Permintaan / Deck" tidak perlu diterjemahkan.
 */
const patahDua = (s: string): string[] => {
  const kata = s.split(/\s+/);
  if (kata.length < 2) return [s];
  return [kata.slice(0, -1).join(" "), kata[kata.length - 1]];
};

function kotakBulat(c: CanvasRenderingContext2D, x: number, y: number, l: number, t: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + l, y, x + l, y + t, r);
  c.arcTo(x + l, y + t, x, y + t, r);
  c.arcTo(x, y + t, x, y, r);
  c.arcTo(x, y, x + l, y, r);
  c.closePath();
}

/** tinggi gambar dihitung dulu supaya kanvas dibuat pas, tanpa sisa kosong */
export const tinggiKartu = (jumlahKapal: number) => 350 + jumlahKapal * TINGGI_BARIS + 180;

export function gambarKartuRekap(kanvas: HTMLCanvasElement, d: DataKartu) {
  const tinggi = tinggiKartu(d.baris.length);
  /*
   * Digambar dua kali lipat lalu dikecilkan lewat CSS. Layar telepon zaman ini
   * berkerapatan ganda; gambar seukuran aslinya akan tampak berbulu begitu
   * diperbesar di grup.
   */
  const skala = 2;
  kanvas.width = LEBAR * skala;
  kanvas.height = tinggi * skala;
  const c = kanvas.getContext("2d");
  if (!c) return;
  c.scale(skala, skala);
  c.textBaseline = "middle";

  // ── latar ──────────────────────────────────────────────────────────────
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, LEBAR, tinggi);

  // ── kepala ─────────────────────────────────────────────────────────────
  const gradasi = c.createLinearGradient(0, 0, LEBAR, 250);
  gradasi.addColorStop(0, BIRU_TUA);
  gradasi.addColorStop(1, BIRU);
  c.fillStyle = gradasi;
  c.fillRect(0, 0, LEBAR, 250);

  c.fillStyle = "rgba(255,255,255,0.72)";
  c.font = "bold 22px system-ui, sans-serif";
  c.fillText("PT ASDP INDONESIA FERRY (PERSERO) · CABANG TERNATE", TEPI, 52);

  c.fillStyle = "#ffffff";
  c.font = "bold 52px system-ui, sans-serif";
  c.fillText("Rekap Laporan & Permintaan Kapal", TEPI, 104);

  c.fillStyle = "rgba(255,255,255,0.85)";
  c.font = "bold 30px system-ui, sans-serif";
  c.fillText(`Periode ${d.periodeLabel}`, TEPI, 150);

  // tiga angka ringkas di bawah judul
  const lengkap = d.baris.filter((b) => b.isi.every(Boolean)).length;
  const belum = d.baris.filter((b) => !b.isi.some(Boolean)).length;
  const terisi = d.baris.reduce((s, b) => s + b.isi.filter(Boolean).length, 0);
  const totalSlot = d.baris.length * d.kolom.length;
  const persen = totalSlot ? Math.round((terisi / totalSlot) * 100) : 0;

  const angka: [string, string, string][] = [
    [`${lengkap}/${d.baris.length}`, "KAPAL LENGKAP", HIJAU],
    [`${terisi}/${totalSlot}`, "DOKUMEN DITERIMA", "#38bdf8"],
    [`${belum}`, "BELUM KIRIM", belum ? MERAH : HIJAU],
  ];
  let ax = TEPI;
  angka.forEach(([nilai, label, warna]) => {
    c.fillStyle = warna;
    c.font = "bold 44px system-ui, sans-serif";
    c.fillText(nilai, ax, 205);
    const lebarNilai = c.measureText(nilai).width;
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.font = "bold 19px system-ui, sans-serif";
    c.fillText(label, ax, 232);
    ax += Math.max(lebarNilai, c.measureText(label).width) + 56;
  });

  // bilah kelengkapan di kanan atas
  const bilahL = 300;
  const bilahX = LEBAR - TEPI - bilahL;
  c.fillStyle = "rgba(255,255,255,0.22)";
  kotakBulat(c, bilahX, 196, bilahL, 16, 8);
  c.fill();
  c.fillStyle = persen >= 90 ? HIJAU : persen >= 50 ? KUNING : MERAH;
  kotakBulat(c, bilahX, 196, Math.max(16, (bilahL * persen) / 100), 16, 8);
  c.fill();
  c.fillStyle = "#ffffff";
  c.font = "bold 40px system-ui, sans-serif";
  c.textAlign = "right";
  c.fillText(`${persen}%`, LEBAR - TEPI, 160);
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.font = "bold 19px system-ui, sans-serif";
  c.fillText("KELENGKAPAN ARMADA", LEBAR - TEPI, 232);
  c.textAlign = "left";

  // ── kepala kolom ───────────────────────────────────────────────────────
  // kolomnya dilebarkan supaya nama dokumen muat utuh, bukan disingkat
  const kolomL = 152;
  const kolomX = LEBAR - TEPI - d.kolom.length * kolomL;
  let y = 250 + 48;   // kepala kolom

  c.fillStyle = TEKS_REDUP;
  c.font = "bold 20px system-ui, sans-serif";
  c.fillText("KAPAL", TEPI, y);
  c.textAlign = "center";
  d.kolom.forEach((k, i) => {
    const x = kolomX + i * kolomL + kolomL / 2;
    const baris = patahDua(k);
    c.fillStyle = BIRU;
    c.font = "bold 19px system-ui, sans-serif";
    if (baris.length === 1) c.fillText(baris[0], x, y);
    else { c.fillText(baris[0], x, y - 12); c.fillText(baris[1], x, y + 12); }
  });
  c.textAlign = "left";

  // garis tipis memisahkan kepala kolom dari barisnya — tanpa ini, jalur belang
  // baris pertama naik menutupi tulisan kepala kolom
  c.strokeStyle = "#e2e8f0";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(TEPI - 14, 250 + 76);
  c.lineTo(LEBAR - TEPI + 14, 250 + 76);
  c.stroke();

  // ── baris kapal ────────────────────────────────────────────────────────
  y = 250 + 116;
  d.baris.forEach((b, i) => {
    const penuh = b.isi.every(Boolean);
    const kosong = !b.isi.some(Boolean);

    if (i % 2 === 0) {
      c.fillStyle = "#f8fafc";
      c.fillRect(TEPI - 14, y - TINGGI_BARIS / 2 + 4, LEBAR - (TEPI - 14) * 2, TINGGI_BARIS - 8);
    }

    // pita keadaan di tepi kiri — hijau lengkap, merah belum kirim sama sekali
    c.fillStyle = penuh ? HIJAU : kosong ? MERAH : KUNING;
    kotakBulat(c, TEPI - 14, y - 18, 6, 36, 3);
    c.fill();

    c.fillStyle = TEKS_REDUP;
    c.font = "bold 20px system-ui, sans-serif";
    c.fillText(String(i + 1).padStart(2, "0"), TEPI + 4, y);

    c.fillStyle = TEKS;
    c.font = "bold 28px system-ui, sans-serif";
    c.fillText(namaPendek(b.kapal), TEPI + 48, y);

    b.isi.forEach((ada, k) => {
      const x = kolomX + k * kolomL + kolomL / 2;
      c.fillStyle = ada ? HIJAU : "#e2e8f0";
      c.beginPath();
      c.arc(x, y, 17, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = ada ? HIJAU : ABU;
      c.lineWidth = 2;
      c.stroke();

      if (ada) {
        // centang digambar sendiri: huruf centang tidak sama di tiap perangkat
        c.strokeStyle = "#ffffff";
        c.lineWidth = 4;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.beginPath();
        c.moveTo(x - 8, y);
        c.lineTo(x - 2, y + 6);
        c.lineTo(x + 8, y - 7);
        c.stroke();
      }
    });

    y += TINGGI_BARIS;
  });

  // ── keterangan & kaki ──────────────────────────────────────────────────
  y += 18;
  c.strokeStyle = "#e2e8f0";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(TEPI, y);
  c.lineTo(LEBAR - TEPI, y);
  c.stroke();

  y += 36;
  let lx = TEPI;
  const petunjuk: [string, string][] = [[HIJAU, "lengkap 4/4"], [KUNING, "baru sebagian"], [MERAH, "belum kirim"]];
  lx = TEPI;
  petunjuk.forEach(([warna, label]) => {
    c.fillStyle = warna;
    kotakBulat(c, lx, y - 9, 18, 18, 5);
    c.fill();
    c.fillStyle = TEKS_REDUP;
    c.font = "20px system-ui, sans-serif";
    c.fillText(label, lx + 28, y);
    lx += 28 + c.measureText(label).width + 34;
  });

  y += 44;
  c.fillStyle = TEKS_REDUP;
  c.font = "19px system-ui, sans-serif";
  c.fillText(d.catatan, TEPI, y);

  y += 30;
  c.fillStyle = BIRU;
  c.font = "bold 21px system-ui, sans-serif";
  c.fillText(`Kirim dokumen: ${d.tautan}`, TEPI, y);

  // waktu pembuatan ditaruh di baris tersendiri: alamat tautan bisa panjang, dan
  // dua tulisan yang bertabrakan di kaki gambar tidak bisa diperbaiki penerima
  y += 30;
  const kini = new Date();
  c.fillStyle = TEKS_REDUP;
  c.font = "19px system-ui, sans-serif";
  c.textAlign = "right";
  c.fillText(
    `Dibuat ${kini.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} pukul ${kini.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
    LEBAR - TEPI, y);
  c.textAlign = "left";
}
