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
 * "Anyone with the link" hanya berarti URL ini bisa dipanggil siapa saja;
 * tanpa SECRET yang cocok, permintaan ditolak dan tidak ada berkas yang masuk.
 */

var SECRET = "GANTI_SECRET_INI_SAMA_DENGAN_ENV";     // harus sama dgn LAPOR_GAS_SECRET di app
var ROOT_FOLDER_ID = "1EnJybY92LUhmMGg72uBztJlPJR2-OxQj"; // folder Drive tujuan
var BAGIKAN_LINK = false;   // true = berkas bisa dibuka siapa pun yang punya tautan.
                            // Biarkan false: berkas tetap milik & hanya terlihat oleh pemilik Drive.
var BATAS_MB = 50;          // tolak berkas lebih besar dari ini
var FOLDER_POTONGAN = "_potongan sementara"; // tempat singgah potongan berkas besar

var LABEL = {
  permintaan_deck: "Permintaan Deck",
  permintaan_mesin: "Permintaan Mesin",
  laporan_deck: "Laporan Deck",
  laporan_mesin: "Laporan Mesin",
};

function doGet() {
  return json({ ok: true, msg: "Penerima berkas kapal aktif" });
}

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (SECRET && body.secret !== SECRET) return json({ ok: false, error: "secret salah" });

    // Berkas besar datang terpotong-potong (batas ukuran satu permintaan di
    // hosting aplikasi jauh lebih kecil dari berkas kapal). Potongan disimpan
    // sementara, lalu disatukan saat potongan terakhir tiba.
    if (body.aksi === "potongan") return terimaPotongan(body);
    if (body.aksi === "hapus") return hapusBerkas(body);

    var b64 = String(body.dataBase64 || "");
    if (!b64) return json({ ok: false, error: "berkas kosong" });
    // panjang base64 -> perkiraan ukuran asli
    if (b64.length * 0.75 > BATAS_MB * 1024 * 1024) return json({ ok: false, error: "berkas lebih dari " + BATAS_MB + " MB" });

    var kapal = bersih(body.kapal) || "TANPA KAPAL";
    var jenis = String(body.jenis || "lainnya");
    var folder = subFolder(subFolder(DriveApp.getFolderById(ROOT_FOLDER_ID), kapal), LABEL[jenis] || jenis);

    var blob = Utilities.newBlob(Utilities.base64Decode(b64), body.mime || "application/octet-stream", namaBerkas(body));
    var file = folder.createFile(blob);
    if (body.catatan) file.setDescription(String(body.catatan).slice(0, 500));
    if (BAGIKAN_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json({
      ok: true,
      fileId: file.getId(),
      url: file.getUrl(),
      nama: file.getName(),
      ukuran: file.getSize(),
      folder: folder.getUrl(),
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Pindahkan satu berkas ke Sampah. Pemeriksaan induk mencegah fileId dari luar
 * folder laporan ikut terhapus walaupun seseorang mengetahui ID berkasnya.
 */
function hapusBerkas(body) {
  var fileId = String(body.fileId || "").trim();
  if (!fileId) return json({ ok: false, error: "fileId kosong" });

  var file = DriveApp.getFileById(fileId);
  if (!beradaDiFolderLaporan(file)) {
    return json({ ok: false, error: "berkas berada di luar folder laporan" });
  }
  file.setTrashed(true);
  return json({ ok: true, fileId: fileId });
}

/** telusuri semua folder induk sampai ROOT_FOLDER_ID, dengan batas aman */
function beradaDiFolderLaporan(file) {
  var antrean = [];
  var induk = file.getParents();
  while (induk.hasNext()) antrean.push(induk.next());

  var dilihat = {};
  var langkah = 0;
  while (antrean.length && langkah++ < 100) {
    var folder = antrean.shift();
    var id = folder.getId();
    if (id === ROOT_FOLDER_ID) return true;
    if (dilihat[id]) continue;
    dilihat[id] = true;
    var atas = folder.getParents();
    while (atas.hasNext()) antrean.push(atas.next());
  }
  return false;
}

/**
 * Terima satu potongan berkas. Tiap potongan ditulis jadi berkas teks singgah;
 * pada potongan terakhir semuanya dibaca berurutan, disatukan, disimpan sebagai
 * berkas asli, lalu singgahannya dibuang.
 */
function terimaPotongan(body) {
  var akar = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var tmp = subFolder(akar, FOLDER_POTONGAN);
  sapuSinggahan(tmp);

  var unggahId = String(body.unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  var indeks = Number(body.indeks), total = Number(body.total);
  if (!unggahId || !(total > 0) || !(indeks >= 0) || indeks >= total) {
    return json({ ok: false, error: "potongan tidak dikenali" });
  }
  if (total * 3 * 1024 * 1024 > (BATAS_MB + 5) * 1024 * 1024) {
    return json({ ok: false, error: "berkas lebih dari " + BATAS_MB + " MB" });
  }

  var nama = unggahId + "." + indeks;
  buangBernama(tmp, nama);                       // kalau potongan ini dikirim ulang
  tmp.createFile(Utilities.newBlob(String(body.data || ""), "text/plain", nama));

  if (indeks + 1 < total) return json({ ok: true, selesai: false, indeks: indeks });

  var b64 = "";
  for (var i = 0; i < total; i++) {
    var it = tmp.getFilesByName(unggahId + "." + i);
    if (!it.hasNext()) return json({ ok: false, error: "potongan ke-" + (i + 1) + " hilang, ulangi kiriman" });
    b64 += it.next().getBlob().getDataAsString();
  }

  var kapal = bersih(body.kapal) || "TANPA KAPAL";
  var jenis = String(body.jenis || "lainnya");
  var folder = subFolder(subFolder(akar, kapal), LABEL[jenis] || jenis);
  var file = folder.createFile(
    Utilities.newBlob(Utilities.base64Decode(b64), body.mime || "application/octet-stream", namaBerkas(body)));
  if (body.catatan) file.setDescription(String(body.catatan).slice(0, 500));
  if (BAGIKAN_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  for (var k = 0; k < total; k++) buangBernama(tmp, unggahId + "." + k);

  return json({
    ok: true, selesai: true,
    fileId: file.getId(), url: file.getUrl(), nama: file.getName(),
    ukuran: file.getSize(), folder: folder.getUrl(),
  });
}

function buangBernama(folder, nama) {
  var it = folder.getFilesByName(nama);
  while (it.hasNext()) it.next().setTrashed(true);
}

/** buang singgahan yang tertinggal (kiriman putus di tengah jalan) lebih dari sehari */
function sapuSinggahan(tmp) {
  var batas = new Date().getTime() - 24 * 60 * 60 * 1000;
  var it = tmp.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getDateCreated().getTime() < batas) f.setTrashed(true);
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
 * dibuka di luar aplikasi.
 */
function namaBerkas(body) {
  var asli = bersih(body.namaBerkas) || "berkas";
  var titik = asli.lastIndexOf(".");
  var pokok = titik > 0 ? asli.slice(0, titik) : asli;
  var ext = titik > 0 ? asli.slice(titik) : "";
  var cap = Utilities.formatDate(new Date(), "Asia/Jayapura", "yyyyMMdd-HHmmss");
  var bagian = [
    bersih(body.periode) || "tanpa-periode",
    LABEL[body.jenis] || body.jenis || "lainnya",
    bersih(body.kapal),
    pokok,
    cap,
  ].filter(String);
  return bagian.join(" - ").slice(0, 180) + ext;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
