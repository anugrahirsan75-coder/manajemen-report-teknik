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
var BATAS_MB = 12;          // tolak berkas lebih besar dari ini

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
