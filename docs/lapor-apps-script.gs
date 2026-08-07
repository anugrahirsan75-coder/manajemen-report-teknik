/**
 * PENERIMA BERKAS KAPAL — untuk app "Manajemen Report Teknik".
 *
 * Berkas dari ABK (Permintaan Deck/Mesin, Laporan Deck/Mesin) disimpan ke
 * Google Drive PEMILIK, bukan ke Supabase. Aplikasi hanya menyimpan catatan
 * kecil (nama kapal, jenis, periode, tautan berkas), jadi kuota Supabase tidak
 * terpakai untuk berkas.
 *
 * Cara pasang:
 *  1. Buka https://script.google.com -> New project.
 *  2. Tempel SELURUH kode ini ke Code.gs.
 *  3. Isi SECRET (bebas, acak) dan pastikan ROOT_FOLDER_ID benar.
 *  4. Deploy -> New deployment -> type "Web app" ->
 *       Execute as: Me (pemilik Drive), Who has access: Anyone with the link.
 *     (Jalankan sekali dari editor supaya muncul izin akses Drive.)
 *  5. Salin URL /exec -> env LAPOR_GAS_URL. SECRET -> env LAPOR_GAS_SECRET.
 *
 * SETIAP kali kode ini diperbarui: Deploy -> Kelola deployment -> pensil ->
 * Versi baru -> Terapkan. URL /exec tidak berubah, tapi versi lama akan terus
 * dilayani sampai langkah itu dilakukan.
 *
 * "Anyone with the link" hanya berarti URL ini bisa dipanggil siapa saja;
 * tanpa SECRET yang cocok, permintaan ditolak dan tidak ada berkas yang masuk.
 */

var SECRET = "9hYKmF5iIAvauQmf3jpKJfEqYNne1K6g";     // harus sama dgn LAPOR_GAS_SECRET di app
var ROOT_FOLDER_ID = "1EnJybY92LUhmMGg72uBztJlPJR2-OxQj"; // folder Drive tujuan (berkas dari kapal)
var FOLDER_DOCKING = "1asHma-Ln4vYxcLg96MTevIKP2v9S7WGs"; // folder Laporan Docking

/**
 * Folder yang BOLEH disentuh skrip ini, dipanggil dengan nama pendek dari
 * aplikasi. Daftar tertutup seperti ini penting: tanpa itu, siapa pun yang tahu
 * SECRET bisa menyuruh skrip membaca atau menulis folder mana saja di Drive
 * pemilik hanya dengan mengirim ID folder lain.
 */
var AKAR = {
  kapal: ROOT_FOLDER_ID,
  docking: FOLDER_DOCKING,
};

function akarDari(body) {
  var n = String(body.akar || "kapal");
  return DriveApp.getFolderById(Object.prototype.hasOwnProperty.call(AKAR, n) ? AKAR[n] : ROOT_FOLDER_ID);
}
var BAGIKAN_LINK = false;   // true = berkas bisa dibuka siapa pun yang punya tautan.
                            // Biarkan false: berkas tetap milik & hanya terlihat oleh pemilik Drive.
var BATAS_MB = 35;          // tolak berkas lebih besar dari ini (harus sama dgn batas di aplikasi)
var FOLDER_POTONGAN = "_potongan sementara"; // tempat singgah potongan berkas besar

var LABEL = {
  permintaan_deck: "Permintaan Deck",
  permintaan_mesin: "Permintaan Mesin",
  laporan_deck: "Laporan Deck",
  laporan_mesin: "Laporan Mesin",
};

function doGet() {
  return json({ ok: true, msg: "Penerima berkas kapal aktif", versi: 5, akar: Object.keys(AKAR) });
}

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    // SECRET kosong TIDAK berarti bebas masuk. Kalau pemasangan belum selesai,
    // lebih baik semua ditolak daripada Drive pemilik terbuka untuk siapa saja.
    if (!SECRET || SECRET === "GANTI_SECRET_INI_SAMA_DENGAN_ENV" || body.secret !== SECRET) {
      return json({ ok: false, error: "secret salah" });
    }

    if (body.aksi === "potongan") return terimaPotongan(body);
    if (body.aksi === "status") return statusPotongan(body);
    if (body.aksi === "hapus") return hapusBerkas(body);
    if (body.aksi === "daftar") return daftarIsi(body);
    if (body.aksi === "isi") return isiBerkas(body);

    var b64 = String(body.dataBase64 || "");
    if (!b64) return json({ ok: false, error: "berkas kosong" });
    if (b64.length * 0.75 > BATAS_MB * 1024 * 1024) {
      return json({ ok: false, error: "berkas lebih dari " + BATAS_MB + " MB" });
    }

    var folder = folderTujuan(body);
    var file = folder.createFile(
      Utilities.newBlob(Utilities.base64Decode(b64), mimeAman(body), namaBerkas(body)));
    hiasBerkas(file, body);

    return json({
      ok: true, selesai: true,
      fileId: file.getId(), url: file.getUrl(), nama: file.getName(),
      ukuran: file.getSize(), folder: folder.getUrl(),
    });
  } catch (err) {
    // Galat Drive yang sifatnya sesaat (sibuk, kuota sesaat, batas waktu) harus
    // ditandai supaya aplikasi tahu unggahan itu layak diulang, bukan digagalkan.
    return json({ ok: false, error: String(err), sementara: galatSesaat(err) });
  }
}

function galatSesaat(err) {
  var t = String(err || "").toLowerCase();
  return t.indexOf("timed out") >= 0 || t.indexOf("timeout") >= 0
    || t.indexOf("try again") >= 0 || t.indexOf("temporar") >= 0
    || t.indexOf("service") >= 0 || t.indexOf("unavailable") >= 0
    || t.indexOf("internal error") >= 0 || t.indexOf("rate") >= 0;
}

/**
 * Pindahkan satu berkas ke Sampah. Pemeriksaan induk mencegah fileId dari luar
 * folder laporan ikut terhapus walaupun seseorang mengetahui ID berkasnya.
 */
function hapusBerkas(body) {
  var fileId = String(body.fileId || "").trim();
  if (!fileId) return json({ ok: false, error: "fileId kosong" });

  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    // Sudah dihapus atau dipindah manual dari Drive. Anggap selesai, supaya
    // catatannya tetap bisa dibersihkan dari rekap kantor.
    return json({ ok: true, fileId: fileId, sudahTiada: true });
  }
  if (file.isTrashed()) return json({ ok: true, fileId: fileId, sudahTiada: true });
  if (!beradaDiFolderLaporan(file)) {
    return json({ ok: false, error: "berkas berada di luar folder laporan" });
  }
  file.setTrashed(true);
  return json({ ok: true, fileId: fileId });
}

/**
 * Isi satu berkas, dikirim sebagai base64.
 *
 * Dipakai kantor untuk MEMBACA permintaan ABK tanpa membuka Drive satu per
 * satu. Pemeriksaan induknya sama dengan penghapusan: berkas di luar folder
 * yang dilayani skrip ini tidak bisa diambil walaupun ID-nya diketahui, jadi
 * SECRET yang bocor pun tak membuka isi Drive pemilik seluruhnya.
 */
function isiBerkas(body) {
  var fileId = String(body.fileId || "").trim();
  if (!fileId) return json({ ok: false, error: "fileId kosong" });

  var file;
  try { file = DriveApp.getFileById(fileId); }
  catch (err) { return json({ ok: false, error: "berkas tidak ditemukan" }); }
  if (file.isTrashed()) return json({ ok: false, error: "berkas sudah dihapus" });
  if (!beradaDiFolderLaporan(file)) return json({ ok: false, error: "berkas berada di luar folder laporan" });

  // 20 MB sudah jauh di atas ukuran permintaan kapal yang wajar; di atas itu
  // base64-nya tak akan muat dikirim balik dalam satu jawaban.
  if (file.getSize() > 20 * 1024 * 1024) return json({ ok: false, error: "berkas terlalu besar untuk dibaca (>20 MB)" });

  var blob = file.getBlob();
  return json({
    ok: true, nama: file.getName(), mime: blob.getContentType(),
    ukuran: file.getSize(), dataBase64: Utilities.base64Encode(blob.getBytes()),
  });
}

/** telusuri semua folder induk sampai salah satu folder yang dilayani skrip ini */
function beradaDiFolderLaporan(file) {
  var sah = {};
  for (var k in AKAR) if (Object.prototype.hasOwnProperty.call(AKAR, k)) sah[AKAR[k]] = true;
  var antrean = [];
  var induk = file.getParents();
  while (induk.hasNext()) antrean.push(induk.next());

  var dilihat = {};
  var langkah = 0;
  while (antrean.length && langkah++ < 100) {
    var folder = antrean.shift();
    var id = folder.getId();
    if (sah[id]) return true;
    if (dilihat[id]) continue;
    dilihat[id] = true;
    var atas = folder.getParents();
    while (atas.hasNext()) antrean.push(atas.next());
  }
  return false;
}

/**
 * Potongan mana saja yang sudah tersimpan untuk satu unggahan.
 * Dipakai halaman ABK untuk MELANJUTKAN unggahan yang putus di tengah jalan,
 * bukan mengulang berkas dari potongan pertama.
 */
function statusPotongan(body) {
  var unggahId = idUnggah(body);
  if (!unggahId) return json({ ok: false, error: "unggahan tidak dikenali" });
  var tmp = subFolder(akarDari(body), FOLDER_POTONGAN);

  var jadi = bacaPenanda(tmp, unggahId);
  if (jadi) return json({ ok: true, selesai: true, hasil: jadi });

  var ada = [];
  var it = tmp.getFiles();
  var awalan = unggahId + ".";
  while (it.hasNext()) {
    var nm = it.next().getName();
    if (nm.indexOf(awalan) === 0) {
      var sisa = nm.slice(awalan.length);
      if (/^\d+$/.test(sisa)) ada.push(Number(sisa));
    }
  }
  ada.sort(function (a, b) { return a - b; });
  return json({ ok: true, selesai: false, potongan: ada });
}

/**
 * Terima satu potongan berkas. Tiap potongan ditulis jadi berkas teks singgah;
 * pada potongan terakhir semuanya dibaca berurutan, disatukan, disimpan sebagai
 * berkas asli, lalu singgahannya dibuang.
 *
 * Penyatuan dibuat IDEMPOTEN: hasilnya dicatat dalam berkas penanda. Kalau
 * jawaban tidak sampai ke ponsel dan potongan terakhir dikirim ulang, yang
 * dikembalikan adalah berkas yang sama — bukan salinan kedua di Drive, dan
 * bukan galat "potongan hilang" karena singgahannya sudah dibuang.
 */
function terimaPotongan(body) {
  var akar = akarDari(body);
  var tmp = subFolder(akar, FOLDER_POTONGAN);

  var unggahId = idUnggah(body);
  var indeks = Number(body.indeks), total = Number(body.total);
  if (!unggahId || !(total > 0) || !(indeks >= 0) || indeks >= total) {
    return json({ ok: false, error: "potongan tidak dikenali" });
  }
  // 1 potongan = 2,25 MB isi asli. Batas dihitung dari ukuran sebenarnya,
  // bukan taksiran 3 MB yang dulu menolak berkas yang sebetulnya muat.
  if (total * 2.25 * 1024 * 1024 > (BATAS_MB + 2) * 1024 * 1024) {
    return json({ ok: false, error: "berkas lebih dari " + BATAS_MB + " MB" });
  }

  var jadi = bacaPenanda(tmp, unggahId);
  if (jadi) return json({ ok: true, selesai: true, fileId: jadi.fileId, url: jadi.url, nama: jadi.nama, ukuran: jadi.ukuran });

  var nama = unggahId + "." + indeks;
  buangBernama(tmp, nama);                       // kalau potongan ini dikirim ulang
  tmp.createFile(Utilities.newBlob(String(body.data || ""), "text/plain", nama));

  if (indeks + 1 < total) {
    // Penyapuan singgahan lama hanya dilakukan sesekali. Kalau dijalankan pada
    // setiap potongan, satu unggahan 15 potongan memindai folder 15 kali dan
    // makin lambat justru saat jaringan kapal sedang payah.
    if (indeks === 0) sapuSinggahan(tmp);
    return json({ ok: true, selesai: false, indeks: indeks, tersimpan: indeks + 1 });
  }

  var b64 = "";
  for (var i = 0; i < total; i++) {
    var it = tmp.getFilesByName(unggahId + "." + i);
    if (!it.hasNext()) return json({ ok: false, error: "potongan ke-" + (i + 1) + " belum sampai, tekan coba lagi" });
    b64 += it.next().getBlob().getDataAsString();
  }

  var folder = folderTujuan(body);
  var file = folder.createFile(
    Utilities.newBlob(Utilities.base64Decode(b64), mimeAman(body), namaBerkas(body)));
  hiasBerkas(file, body);

  var hasil = {
    fileId: file.getId(), url: file.getUrl(),
    nama: file.getName(), ukuran: file.getSize(),
  };
  // Penanda ditulis LEBIH DULU, baru singgahannya dibuang. Urutan ini yang
  // membuat percobaan ulang tetap menemukan hasilnya.
  tulisPenanda(tmp, unggahId, hasil);
  for (var k = 0; k < total; k++) buangBernama(tmp, unggahId + "." + k);

  return json({
    ok: true, selesai: true,
    fileId: hasil.fileId, url: hasil.url, nama: hasil.nama,
    ukuran: hasil.ukuran, folder: folder.getUrl(),
  });
}

function idUnggah(body) {
  return String(body.unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
}

function namaPenanda(unggahId) { return unggahId + ".jadi"; }

function bacaPenanda(tmp, unggahId) {
  var it = tmp.getFilesByName(namaPenanda(unggahId));
  if (!it.hasNext()) return null;
  try { return JSON.parse(it.next().getBlob().getDataAsString()); } catch (err) { return null; }
}

function tulisPenanda(tmp, unggahId, hasil) {
  buangBernama(tmp, namaPenanda(unggahId));
  tmp.createFile(Utilities.newBlob(JSON.stringify(hasil), "application/json", namaPenanda(unggahId)));
}

/**
 * Folder tujuan sebuah kiriman.
 *
 * Dua bentuk dipakai berdampingan: berkas dari kapal tetap masuk
 * <kapal>/<jenis> seperti semula, sedangkan Laporan Docking menyebut sendiri
 * jalur foldernya (mis. ["KMP. TUNA", "2026", "Foto"]). Folder yang belum ada
 * dibuatkan, jadi susunan di Drive tidak perlu disiapkan lebih dulu.
 */
function folderTujuan(body) {
  var folder = akarDari(body);
  if (Array.isArray(body.jalur) && body.jalur.length) {
    for (var i = 0; i < body.jalur.length && i < 6; i++) {
      var n = bersih(body.jalur[i]);
      if (n) folder = subFolder(folder, n);
    }
    return folder;
  }
  var kapal = bersih(body.kapal) || "TANPA KAPAL";
  var jenis = String(body.jenis || "lainnya");
  var label = Object.prototype.hasOwnProperty.call(LABEL, jenis) ? LABEL[jenis] : jenis;
  return subFolder(subFolder(folder, kapal), label);
}

/**
 * Isi sebuah folder: subfolder dan berkasnya. Dipakai halaman Laporan Docking
 * untuk menelusuri Drive langsung, sehingga berkas yang ditaruh manual lewat
 * Google Drive pun ikut terlihat tanpa perlu dicatat ulang di aplikasi.
 *
 * Folder dicari dengan MENELUSURI NAMA dari akar, bukan dengan menerima ID dari
 * luar — supaya permintaan tak bisa diarahkan ke folder lain di Drive pemilik.
 */
function daftarIsi(body) {
  var folder = akarDari(body);
  var jalur = Array.isArray(body.jalur) ? body.jalur : [];
  for (var i = 0; i < jalur.length && i < 6; i++) {
    var nama = bersih(jalur[i]);
    if (!nama) continue;
    var it = folder.getFoldersByName(nama);
    if (!it.hasNext()) return json({ ok: true, jalur: jalur, folder: [], berkas: [], kosong: true });
    folder = it.next();
  }

  var folders = [];
  var fit = folder.getFolders();
  while (fit.hasNext() && folders.length < 300) {
    var f = fit.next();
    if (f.getName() === FOLDER_POTONGAN) continue;   // singgahan potongan, bukan isi laporan
    folders.push({ nama: f.getName(), id: f.getId(), url: f.getUrl(), diubah: f.getLastUpdated().toISOString() });
  }
  folders.sort(function (a, b) { return a.nama.localeCompare(b.nama); });

  var berkas = [];
  var bit = folder.getFiles();
  while (bit.hasNext() && berkas.length < 500) {
    var x = bit.next();
    berkas.push({
      nama: x.getName(), id: x.getId(), url: x.getUrl(), mime: x.getMimeType(),
      ukuran: x.getSize(), diubah: x.getLastUpdated().toISOString(),
    });
  }
  berkas.sort(function (a, b) { return a.diubah < b.diubah ? 1 : -1; });

  return json({
    ok: true, jalur: jalur, folderId: folder.getId(), folderUrl: folder.getUrl(),
    nama: folder.getName(), folder: folders, berkas: berkas,
  });
}

function mimeAman(body) {
  var m = String(body.mime || "").trim();
  return m || "application/octet-stream";
}

function hiasBerkas(file, body) {
  if (body.catatan) file.setDescription(String(body.catatan).slice(0, 500));
  if (BAGIKAN_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
}

function buangBernama(folder, nama) {
  var it = folder.getFilesByName(nama);
  while (it.hasNext()) it.next().setTrashed(true);
}

/** buang singgahan yang tertinggal (kiriman putus di tengah jalan) lebih dari sehari */
function sapuSinggahan(tmp) {
  var batas = new Date().getTime() - 24 * 60 * 60 * 1000;
  var it = tmp.getFiles();
  var dibuang = 0;
  while (it.hasNext() && dibuang < 200) {
    var f = it.next();
    if (f.getDateCreated().getTime() < batas) { f.setTrashed(true); dibuang++; }
  }
}

/** buang karakter yang bikin nama folder/berkas kacau */
function bersih(s) {
  return String(s || "").replace(/[\\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** cari subfolder bernama `nama`, buat kalau belum ada */
function subFolder(induk, nama) {
  var n = bersih(nama) || "LAIN-LAIN";
  var it = induk.getFoldersByName(n);
  return it.hasNext() ? it.next() : induk.createFolder(n);
}

/**
 * Nama berkas dibuat berurutan sendiri: periode dulu, lalu jenis, kapal, waktu
 * kirim. Dengan begitu isi folder tetap terbaca walau diunduh berombongan atau
 * dibuka di luar aplikasi. EKSTENSI selalu dipertahankan di ujung — kalau ikut
 * terpotong, berkasnya tidak bisa dibuka dengan aplikasi yang benar.
 */
function namaBerkas(body) {
  var asli = bersih(body.namaBerkas) || "berkas";
  // Laporan Docking diunggah dari kantor dengan nama yang sudah rapi dari
  // sananya; hiasan periode/jenis/kapal justru membuatnya sulit dicocokkan
  // dengan berkas yang ditaruh manual di Drive.
  if (body.namaApaAdanya) return asli.slice(0, 190);
  var titik = asli.lastIndexOf(".");
  var pokok = titik > 0 ? asli.slice(0, titik) : asli;
  var ext = titik > 0 ? asli.slice(titik) : "";
  if (ext.length > 10) { pokok = asli; ext = ""; }      // titik di tengah nama, bukan ekstensi
  var cap = Utilities.formatDate(new Date(), "Asia/Jayapura", "yyyyMMdd-HHmmss");
  var label = Object.prototype.hasOwnProperty.call(LABEL, body.jenis) ? LABEL[body.jenis] : (body.jenis || "lainnya");
  var bagian = [
    bersih(body.periode) || "tanpa-periode",
    label,
    bersih(body.kapal),
    pokok,
    cap,
  ].filter(String);
  var gabung = bagian.join(" - ");
  var maksPokok = 180 - ext.length;
  if (gabung.length > maksPokok) gabung = gabung.slice(0, maksPokok);
  return gabung + ext;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
