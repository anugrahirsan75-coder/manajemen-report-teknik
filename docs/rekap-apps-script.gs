/**
 * REKAP PJK KAPAL PERBULAN — penerima data dari app "Manajemen Report Teknik".
 * Cara pasang:
 *  1. Buka spreadsheet REKAP -> Ekstensi -> Apps Script.
 *  2. Tempel SELURUH kode ini (ganti file Code.gs). Set SECRET di bawah.
 *  3. Deploy -> New deployment -> type "Web app" ->
 *       Execute as: Me (pemilik), Who has access: Anyone with the link.
 *  4. Copy URL /exec -> berikan ke app: env REKAP_GAS_URL. SECRET -> env REKAP_GAS_SECRET.
 *
 * Memperbarui script yang sudah jalan (URL /exec TIDAK berubah):
 *    Deploy -> Manage deployments -> ikon pensil -> Version: New version -> Deploy.
 *    Google meminta izin ulang karena script kini juga membuat/menulis spreadsheet
 *    REKAP SPPBJ di Drive pemilik: pilih akun -> Advanced -> Allow.
 *
 * LAMPIRAN PERMOHONAN (sejak 19 Nov 2026): {aksi:"folderPermohonan"} membuat subfolder
 * bernomor, {aksi:"potonganPermohonan"} menerima berkas per potongan. Perlu izin Google Drive.
 *
 * KONTROL PERMOHONAN CABANG (sejak 19 Nov 2026): app menulis/ubah baris di spreadsheet
 * "Kontrol Permohonan Ternate 2026" (perintah {permohonan:[...]}) dan menariknya ({tarikPermohonan:true}).
 * Id spreadsheet: konstanta PERMOHONAN_ID_BAWAAN atau Script Properties "PERMOHONAN_ID".
 *
 * REKAP SPPBJ (sejak 15 Nov 2026): spreadsheet terpisah berisi satu baris per
 * pengadaan (NO, NAMA PENGADAAN, NOMOR PR, TANGGAL, VENDOR PELAKSANA, JENIS).
 * Dibuat otomatis pada kiriman pertama di Drive pemilik script; id-nya disimpan di
 * Script Properties "DAFTAR_ID". Mau pakai spreadsheet lain: isi DAFTAR_ID dengan
 * id spreadsheet itu (Project Settings -> Script Properties).
 */

var SECRET = "GANTI_SECRET_INI_SAMA_DENGAN_ENV"; // harus sama dgn REKAP_GAS_SECRET di app
var DATA_START_ROW = 4;
var MON3 = ["", "JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
// kolom 1-based: A NO, B SPPBJ, C NAMA, D FILE, E KET, F PR, G TGL, H NILAI_SPPBJ, I NILAI_SPBJ, J PO, K GR
var COL = { no: 1, sppbj: 2, nama: 3, file: 4, ket: 5, pr: 6, tgl: 7, nSppbj: 8, nSpbj: 9, po: 10, gr: 11 };
var TEMPLATE_NAME = ""; // opsional: nama tab yg dijadikan cetakan tab bulan baru (kosong = pakai tab bulan terbaru)

// REKAP SPPBJ: daftar ringkas satu baris per pengadaan. Kolom G (ID APLIKASI)
// adalah kunci baris dan disembunyikan; jangan dihapus atau diubah.
var DAFTAR_NAMA = "REKAP SPPBJ - ASDP CABANG TERNATE";
var DAFTAR_TAB = "REKAP SPPBJ";
var DAFTAR_KOLOM = ["NO", "NAMA PENGADAAN", "NOMOR PR", "TANGGAL", "VENDOR PELAKSANA", "JENIS", "ID APLIKASI"];
var DAFTAR_JENIS = ["Docking", "Rutin", "Persetujuan Lainnya"];

// KONTROL PERMOHONAN CABANG (sejak 19 Nov 2026): spreadsheet "Kontrol Permohonan Ternate 2026".
// Id diambil dari Script Properties "PERMOHONAN_ID" bila ada, kalau tidak dari konstanta ini.
// Kolom dicari dari judul header baris 2; kolom kunci "ID APLIKASI" dibuat & disembunyikan otomatis.
var PERMOHONAN_ID_BAWAAN = "";
var PERMOHONAN_GID = 0;
var P_HEADER_ROW = 2, P_DATA_ROW = 3;

// LAMPIRAN PERMOHONAN (sejak 19 Nov 2026): berkas yang diunggah dari borang
// Monitoring Permohonan Cabang masuk ke subfolder bernomor ("17. ADDENDUM ...")
// di folder Drive "KONTROL PERMOHONAN CABANG". Folder induk TIDAK dikirim dari
// aplikasi: diambil dari Script Properties "PERMOHONAN_FOLDER_ID", konstanta di
// bawah, atau dicari sendiri dari tautan folder di spreadsheet Kontrol.
var PERMOHONAN_FOLDER_ID_BAWAAN = "";
var P_SINGGAH = "_potongan sementara";   // tempat singgah potongan berkas besar
var P_BATAS_MB = 35;
var P_JENIS = "lampiranPermohonan";       // penanda jawaban versi ini
var D = { no: 1, nama: 2, pr: 3, tgl: 4, vendor: 5, jenis: 6, id: 7 };

function doGet() {
  return json({ ok: true, msg: "REKAP webhook aktif" });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (SECRET && body.secret !== SECRET) return json({ ok: false, error: "secret salah" });
    // Lampiran Monitoring Permohonan Cabang: dijawab sendiri, tidak menyentuh rekap
    if (body.aksi === "folderPermohonan" || body.aksi === "potonganPermohonan" || body.aksi === "aturFolderPermohonan") {
      var lockL = LockService.getScriptLock();
      lockL.waitLock(30000);   // nomor folder berikutnya tidak boleh dipakai dua kiriman sekaligus
      try { return json(lampiranPermohonan(body)); } finally { lockL.releaseLock(); }
    }
    var rows = body.rows || [];
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var results = [];
    for (var i = 0; i < rows.length; i++) results.push(writeRow(ss, rows[i]));

    var out = { ok: true, results: results };
    var daftar = body.daftar || [];
    // siapkan: buat/buka spreadsheet REKAP SPPBJ dan kembalikan link-nya tanpa menulis baris
    if (daftar.length || body.siapkan) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);   // dua kiriman bersamaan tidak boleh berebut baris kosong yang sama
      try {
        var tempat = daftarSheet();
        out.daftar = [];
        for (var j = 0; j < daftar.length; j++) out.daftar.push(writeDaftar(tempat.sh, daftar[j]));
        out.rekapUrl = tempat.ss.getUrl() + "#gid=" + tempat.sh.getSheetId();
      } finally {
        lock.releaseLock();
      }
    }
    // Monitoring Permohonan Cabang: tulis/ubah baris, atau tarik semua baris
    if ((body.permohonan && body.permohonan.length) || body.tarikPermohonan) {
      var lockP = LockService.getScriptLock();
      lockP.waitLock(20000);
      try { out.permohonan = prosesPermohonan(body); } finally { lockP.releaseLock(); }
    }
    return json(out);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Buka spreadsheet REKAP SPPBJ; buat bila belum ada.
function daftarSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("DAFTAR_ID");
  var ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(DAFTAR_NAMA);
    props.setProperty("DAFTAR_ID", ss.getId());
  }
  var sh = ss.getSheetByName(DAFTAR_TAB);
  if (!sh) {
    var pertama = ss.getSheets()[0];
    sh = pertama.getLastRow() === 0 ? pertama.setName(DAFTAR_TAB) : ss.insertSheet(DAFTAR_TAB, 0);
  }
  if (String(sh.getRange(1, 1).getValue()) !== "NO") siapkanDaftar(sh);
  return { ss: ss, sh: sh };
}

function siapkanDaftar(sh) {
  sh.getRange(1, 1, 1, DAFTAR_KOLOM.length).setValues([DAFTAR_KOLOM])
    .setFontWeight("bold").setFontColor("#ffffff").setBackground("#0e2a5c")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
  var lebar = [50, 380, 130, 140, 260, 160, 120];
  for (var i = 0; i < lebar.length; i++) sh.setColumnWidth(i + 1, lebar[i]);
  sh.getRange("A:A").setHorizontalAlignment("center");
  sh.getRange("C:D").setHorizontalAlignment("center");
  sh.getRange("C:C").setNumberFormat("@");   // nomor PR tetap teks, nol di depan tidak hilang
  var aturan = SpreadsheetApp.newDataValidation().requireValueInList(DAFTAR_JENIS, true).setAllowInvalid(true).build();
  sh.getRange(2, D.jenis, sh.getMaxRows() - 1, 1).setDataValidation(aturan);
  sh.hideColumns(D.id);
}

// Upsert berdasarkan ID APLIKASI (kolom G).
function writeDaftar(sh, d) {
  if (!d || !d.id) return { error: "id kosong" };
  var last = sh.getLastRow();
  var target = -1, maxNo = 0;
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, DAFTAR_KOLOM.length).getValues();
    for (var k = 0; k < vals.length; k++) {
      var no = parseInt(vals[k][D.no - 1], 10);
      if (!isNaN(no) && no > maxNo) maxNo = no;
      if (target < 0 && String(vals[k][D.id - 1]).trim() === String(d.id)) target = k + 2;
    }
  }
  var action = "update";
  if (target < 0) {
    target = Math.max(last, 1) + 1;
    action = "append";
    sh.getRange(target, D.no).setValue(maxNo + 1);
    sh.getRange(target, D.id).setValue(String(d.id));
  }
  sh.getRange(target, D.nama).setValue(d.namaPengadaan || "");
  if (d.nomorPR) sh.getRange(target, D.pr).setValue(String(d.nomorPR));
  sh.getRange(target, D.tgl).setValue(d.tanggal || "");
  if (d.vendor) sh.getRange(target, D.vendor).setValue(d.vendor);   // vendor yang diisi manual tidak dihapus
  if (d.jenis) sh.getRange(target, D.jenis).setValue(d.jenis);
  return { id: d.id, row: target, action: action };
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

function desiredName(month, year) {
  var yy = String(year).slice(-2);
  return pad2(month) + ". " + MON3[month] + " " + yy;
}

// cari tab bulan (fuzzy), buat bila belum ada
function resolveSheet(ss, month, year) {
  var want = desiredName(month, year);
  var exact = ss.getSheetByName(want);
  if (exact) return exact;

  var yy = String(year).slice(-2), yyyy = String(year);
  var sheets = ss.getSheets();
  var monthLike = null;
  for (var i = 0; i < sheets.length; i++) {
    var nm = sheets[i].getName();
    var up = nm.toUpperCase();
    if (up.indexOf("(") >= 0) continue;                 // lewati sub-tab (RUTIN)/(DOCKING)
    var startsMonth = up.indexOf(pad2(month) + ".") === 0 || up.indexOf(pad2(month) + " ") === 0;
    var hasMonth = up.indexOf(MON3[month]) >= 0;
    if (!(startsMonth || hasMonth)) continue;
    if (!monthLike) monthLike = sheets[i];              // cetakan cadangan (bulan mana pun)
    if (up.indexOf(yy) >= 0 || up.indexOf(yyyy) >= 0) return sheets[i]; // cocok bulan+tahun
  }
  // belum ada -> buat dari template
  var tpl = (TEMPLATE_NAME && ss.getSheetByName(TEMPLATE_NAME)) || monthLike || ss.getSheets()[0];
  var ns = ss.insertSheet(want, { template: tpl });
  // bersihkan data (baris DATA_START_ROW ke bawah), sisakan header
  var last = ns.getLastRow();
  if (last >= DATA_START_ROW) ns.getRange(DATA_START_ROW, 1, last - DATA_START_ROW + 1, ns.getLastColumn()).clearContent();
  return ns;
}

// baris data terakhir = baris terakhir yg kolom B (NOMOR SPPBJ) ada isinya.
// JANGAN pakai getLastRow(): dia ikut menghitung sisa format/konten jauh di bawah -> baris nyasar.
function lastDataRow(sh) {
  var last = sh.getLastRow();
  if (last < DATA_START_ROW) return DATA_START_ROW - 1;
  var vals = sh.getRange(DATA_START_ROW, COL.sppbj, last - DATA_START_ROW + 1, 1).getValues();
  var r = DATA_START_ROW - 1;
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() !== "") r = DATA_START_ROW + i;
  return r;
}

function writeRow(ss, r) {
  if (!r.month || !r.year) return { sppbj: r.nomorSppbj, error: "tanggal kosong" };
  var sh = resolveSheet(ss, r.month, r.year);

  // cari baris berdasarkan NOMOR SPPBJ (kolom B) -> upsert
  var lastData = lastDataRow(sh);
  var targetRow = -1, maxNo = 0;
  if (lastData >= DATA_START_ROW) {
    var rng = sh.getRange(DATA_START_ROW, COL.no, lastData - DATA_START_ROW + 1, COL.sppbj).getValues();
    for (var k = 0; k < rng.length; k++) {
      var no = parseInt(rng[k][0], 10); if (!isNaN(no) && no > maxNo) maxNo = no;
      var b = String(rng[k][1]).trim();
      if (b && b === String(r.nomorSppbj).trim()) { targetRow = DATA_START_ROW + k; break; }
    }
  }
  var action = "update";
  if (targetRow < 0) { targetRow = lastData + 1; action = "append"; }

  if (action === "append") sh.getRange(targetRow, COL.no).setValue(maxNo + 1);
  // kolom milik app (D FILE & K GR TIDAK ditimpa -> data manual aman)
  sh.getRange(targetRow, COL.sppbj).setValue(r.nomorSppbj || "");
  sh.getRange(targetRow, COL.nama).setValue(r.namaPekerjaan || "");
  if (r.ket) sh.getRange(targetRow, COL.ket).setValue(r.ket);
  sh.getRange(targetRow, COL.pr).setValue(r.nomorPR || "");
  sh.getRange(targetRow, COL.tgl).setValue(r.tanggal || "");
  var h = sh.getRange(targetRow, COL.nSppbj); h.setValue(r.nilaiSppbj || 0); h.setNumberFormat('"Rp" #,##0');
  if (r.nilaiSpbj != null) { var ii = sh.getRange(targetRow, COL.nSpbj); ii.setValue(r.nilaiSpbj); ii.setNumberFormat('"Rp" #,##0'); }
  if (r.nomorPO) sh.getRange(targetRow, COL.po).setValue(r.nomorPO);

  return { sppbj: r.nomorSppbj, sheet: sh.getName(), row: targetRow, action: action };
}

/* ── KONTROL PERMOHONAN CABANG ─────────────────────────────────────────── */

function permohonanSheet() {
  var id = PropertiesService.getScriptProperties().getProperty("PERMOHONAN_ID") || PERMOHONAN_ID_BAWAAN;
  if (!id) throw new Error("PERMOHONAN_ID belum diisi (Project Settings -> Script Properties)");
  var ss = SpreadsheetApp.openById(id);
  var all = ss.getSheets(), sh = all[0];
  for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === PERMOHONAN_GID) { sh = all[i]; break; }
  return { ss: ss, sh: sh };
}

// nomor kolom (1-based) dari judul header; KETERANGAN muncul dua kali (I = keterangan, J = catatan persetujuan)
function pKolom(sh) {
  var last = sh.getLastColumn();
  var head = sh.getRange(P_HEADER_ROW, 1, 1, last).getDisplayValues()[0]
    .map(function (h) { return String(h).replace(/\s+/g, " ").trim().toUpperCase(); });
  function cari(pola, mulai) { for (var c = mulai || 0; c < head.length; c++) if (pola.test(head[c])) return c + 1; return 0; }
  var k = {
    no: cari(/^NO\.?$/), judul: cari(/JENIS SURVEY|PEKERJAAN/), biaya: cari(/TOTAL BIAYA/), status: cari(/STATUS/),
    lampiran: cari(/LAMPIRAN/), tglAju: cari(/TANGGAL PENGAJUAN/), tglSelesai: cari(/TANGGAL SELESAI/),
    jenis: cari(/JENIS USULAN/), id: cari(/^ID APLIKASI$/)
  };
  k.ket = cari(/^KETERANGAN$/);
  k.ketSetuju = k.ket ? cari(/^KETERANGAN$/, k.ket) : 0;
  if (!k.judul) throw new Error("kolom 'Jenis Survey / Pekerjaan' tidak ditemukan di baris " + P_HEADER_ROW);
  if (!k.id) {
    k.id = last + 1;
    sh.getRange(P_HEADER_ROW, k.id).setValue("ID APLIKASI");
    try { sh.hideColumns(k.id); } catch (e) {}
  }
  return k;
}

function pTglKeDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : "";
}
function pKeIso(v, teks) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(teks || "").trim());
  return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : "";
}
function pKunci(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function prosesPermohonan(body) {
  var t = permohonanSheet(), sh = t.sh, k = pKolom(sh);
  var out = { url: t.ss.getUrl() + "#gid=" + sh.getSheetId(), hasil: [], baris: [] };
  var last = Math.max(sh.getLastRow(), P_DATA_ROW);
  var n = last - P_DATA_ROW + 1;
  var lebar = Math.max(k.id, k.judul, k.biaya, k.status, k.lampiran, k.tglAju, k.tglSelesai, k.jenis, k.ket, k.ketSetuju);
  var nilai = sh.getRange(P_DATA_ROW, 1, n, lebar).getValues();
  var tampil = sh.getRange(P_DATA_ROW, 1, n, lebar).getDisplayValues();
  var sel = function (i, kol) { return kol ? String(tampil[i][kol - 1]).trim() : ""; };

  if (body.tarikPermohonan) {
    var rich = k.lampiran ? sh.getRange(P_DATA_ROW, k.lampiran, n, 1).getRichTextValues() : [];
    for (var i = 0; i < n; i++) {
      if (!sel(i, k.judul)) continue;
      var url = "";
      try { url = rich[i] && rich[i][0] ? (rich[i][0].getLinkUrl() || "") : ""; } catch (e) {}
      var b = k.biaya ? nilai[i][k.biaya - 1] : 0;
      out.baris.push({
        baris: P_DATA_ROW + i, id: sel(i, k.id), judul: sel(i, k.judul),
        totalBiaya: typeof b === "number" ? b : Number(String(b).replace(/[^\d]/g, "")) || 0,
        status: sel(i, k.status), lampiranNama: sel(i, k.lampiran), lampiranUrl: url,
        tglPengajuan: k.tglAju ? pKeIso(nilai[i][k.tglAju - 1], sel(i, k.tglAju)) : "",
        tglSelesai: k.tglSelesai ? pKeIso(nilai[i][k.tglSelesai - 1], sel(i, k.tglSelesai)) : "",
        jenisUsulan: sel(i, k.jenis), keterangan: sel(i, k.ket), ketPersetujuan: sel(i, k.ketSetuju)
      });
    }
    return out;
  }

  var judul = [], ids = [];
  for (var r = 0; r < n; r++) { judul.push(sel(r, k.judul)); ids.push(sel(r, k.id)); }
  var list = body.permohonan || [];
  for (var a = 0; a < list.length; a++) {
    var p = list[a] || {};
    if (!p.id || !String(p.judul || "").trim()) { out.hasil.push({ id: p.id || "", ok: false, error: "id/judul kosong" }); continue; }
    var idx = ids.indexOf(String(p.id)), aksi = "ubah";
    if (idx < 0) {                                   // baris lama tanpa ID: cocokkan judul
      var kj = pKunci(p.judul);
      for (var x = 0; x < judul.length; x++) if (!ids[x] && judul[x] && pKunci(judul[x]) === kj) { idx = x; break; }
    }
    if (idx < 0) {                                   // baris kosong pertama, atau tambah baris
      aksi = "tambah";
      idx = judul.indexOf("");
      if (idx < 0) { sh.insertRowAfter(P_DATA_ROW + judul.length - 1); judul.push(""); ids.push(""); idx = judul.length - 1; }
    }
    var row = P_DATA_ROW + idx;
    tulisPermohonan(sh, k, row, p, aksi === "tambah", sel(Math.min(idx, n - 1), k.lampiran));
    judul[idx] = String(p.judul); ids[idx] = String(p.id);
    if (aksi === "tambah" && k.no) {
      var urut = 0;
      for (var y = 0; y <= idx; y++) if (judul[y]) urut++;
      sh.getRange(row, k.no).setValue(urut);
    }
    out.hasil.push({ id: p.id, ok: true, baris: row, aksi: aksi });
  }
  return out;
}

function tulisPermohonan(sh, k, row, p, baru, lampiranLama) {
  sh.getRange(row, k.judul).setValue(String(p.judul));
  if (k.biaya) sh.getRange(row, k.biaya).setValue(Number(p.totalBiaya) || 0);
  if (k.status && p.status) sh.getRange(row, k.status).setValue(String(p.status));
  if (k.lampiran && (p.lampiranUrl || p.lampiranNama)) {
    var teks = String(p.lampiranNama || p.lampiranUrl);
    // chip/tautan yang sudah ada tidak ditimpa bila teksnya sama
    if (baru || lampiranLama !== teks) {
      var c = sh.getRange(row, k.lampiran);
      if (p.lampiranUrl) c.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(teks).setLinkUrl(String(p.lampiranUrl)).build());
      else c.setValue(teks);
    }
  }
  if (k.tglAju) sh.getRange(row, k.tglAju).setValue(pTglKeDate(p.tglPengajuan));
  if (k.tglSelesai) sh.getRange(row, k.tglSelesai).setValue(pTglKeDate(p.tglSelesai));
  if (k.jenis && p.jenisUsulan) sh.getRange(row, k.jenis).setValue(String(p.jenisUsulan));
  if (k.ket) sh.getRange(row, k.ket).setValue(String(p.keterangan || ""));
  if (k.ketSetuju) sh.getRange(row, k.ketSetuju).setValue(String(p.ketPersetujuan || ""));
  sh.getRange(row, k.id).setValue(String(p.id));
}

/* ── LAMPIRAN PERMOHONAN CABANG ────────────────────────────────────────── */

function lampiranPermohonan(body) {
  if (body.aksi === "aturFolderPermohonan") {
    // dipakai sekali bila folder induk tidak bisa ditemukan sendiri
    var idA = pIdFolder(body.url);
    if (!idA) return { ok: false, jenis: P_JENIS, error: "Tautan itu bukan tautan folder Google Drive." };
    var fA;
    try { fA = DriveApp.getFolderById(idA); fA.getName(); }
    catch (e) { return { ok: false, jenis: P_JENIS, error: "Folder itu tidak bisa dibuka oleh akun pemilik skrip." }; }
    PropertiesService.getScriptProperties().setProperty("PERMOHONAN_FOLDER_ID", idA);
    return { ok: true, jenis: P_JENIS, folderNama: fA.getName(), folderUrl: fA.getUrl() };
  }
  var induk = pFolderInduk();
  if (!induk) {
    return { ok: false, jenis: P_JENIS, perluFolder: true,
      error: "Folder Drive KONTROL PERMOHONAN CABANG belum diketahui." };
  }
  if (body.aksi === "folderPermohonan") return pBuatFolder(induk, body);
  return pTerimaPotongan(induk, body);
}

function pFolderInduk() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("PERMOHONAN_FOLDER_ID") || PERMOHONAN_FOLDER_ID_BAWAAN;
  if (!id) {
    try { id = pCariFolderInduk(); } catch (e) { id = ""; }
    if (id) props.setProperty("PERMOHONAN_FOLDER_ID", id);
  }
  if (!id) return null;
  try { return DriveApp.getFolderById(id); } catch (e) { return null; }
}

// 1) tautan folder di baris 1 ("LINK G DRIVE >>>>> 01. KONTROL PERMOHONAN CABANG 2026"),
// 2) kalau tidak ada: induk dari folder lampiran baris yang sudah terisi
function pCariFolderInduk() {
  var sh = permohonanSheet().sh;
  var lebar = Math.max(sh.getLastColumn(), 1);
  var baris1 = sh.getRange(1, 1, 1, lebar).getRichTextValues()[0];
  for (var c = 0; c < baris1.length; c++) {
    var id = pIdFolder(pLink(baris1[c]));
    if (id) return id;
  }
  var k = pKolom(sh), n = sh.getLastRow() - P_DATA_ROW + 1;
  if (!k.lampiran || n < 1) return "";
  var rich = sh.getRange(P_DATA_ROW, k.lampiran, n, 1).getRichTextValues();
  for (var i = 0; i < rich.length; i++) {
    var sub = pIdFolder(pLink(rich[i][0]));
    if (!sub) continue;
    try {
      var par = DriveApp.getFolderById(sub).getParents();
      if (par.hasNext()) return par.next().getId();
    } catch (e) {}
  }
  return "";
}

function pLink(rt) {
  if (!rt) return "";
  try { var u = rt.getLinkUrl(); if (u) return u; } catch (e) {}
  try {
    var runs = rt.getRuns();
    for (var i = 0; i < runs.length; i++) { var u2 = runs[i].getLinkUrl(); if (u2) return u2; }
  } catch (e) {}
  return "";
}

function pIdFolder(url) {
  var s = String(url || "");
  var m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(s) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(s);
  return m ? m[1] : "";
}

function pBersih(s) {
  return String(s || "").replace(/[\\\/:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function pSub(induk, nama) {
  var it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}

/**
 * Siapkan folder lampiran. Nama yang sudah bernomor ("17. ...") dipakai apa
 * adanya (folder lama, atau dibuat bila belum ada); nama tanpa nomor diberi
 * nomor berikutnya sesudah folder bernomor terbesar di folder induk.
 */
function pBuatFolder(induk, body) {
  var nama = pBersih(body.nama);
  if (!nama) return { ok: false, jenis: P_JENIS, error: "nama folder kosong" };
  if (/^\d+\s*\./.test(nama)) {
    var f0 = pSub(induk, nama);
    return { ok: true, jenis: P_JENIS, folderNama: f0.getName(), folderUrl: f0.getUrl() };
  }
  var maks = 0, it = induk.getFolders();
  while (it.hasNext()) {
    var m = /^(\d+)\s*\./.exec(it.next().getName());
    if (m) maks = Math.max(maks, Number(m[1]));
  }
  var f = induk.createFolder(pad2(maks + 1) + ". " + nama);
  return { ok: true, jenis: P_JENIS, folderNama: f.getName(), folderUrl: f.getUrl() };
}

/**
 * Satu potongan berkas (2,25 MB isi asli). Potongan disinggahkan sebagai berkas
 * teks; pada potongan terakhir semuanya disatukan jadi berkas di folder
 * lampiran. Penanda "<id>.jadi" ditulis sebelum singgahan dibuang, supaya
 * potongan terakhir yang dikirim ulang (jawaban sempat putus) tetap menemukan
 * hasilnya, bukan galat "potongan hilang".
 */
function pTerimaPotongan(induk, body) {
  var folderNama = pBersih(body.folder);
  if (!folderNama) return { ok: false, jenis: P_JENIS, error: "folder tujuan kosong" };
  var unggahId = String(body.unggahId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  var indeks = Number(body.indeks), total = Number(body.total);
  if (!unggahId || !(total > 0) || !(indeks >= 0) || indeks >= total) {
    return { ok: false, jenis: P_JENIS, error: "potongan tidak dikenali" };
  }
  if (total * 2.25 > P_BATAS_MB + 2) return { ok: false, jenis: P_JENIS, error: "berkas lebih dari " + P_BATAS_MB + " MB" };

  var tmp = pSub(induk, P_SINGGAH);
  var jadi = pBacaPenanda(tmp, unggahId);
  if (jadi) { jadi.ok = true; jadi.selesai = true; jadi.jenis = P_JENIS; return jadi; }

  var nama = unggahId + "." + indeks;
  pBuang(tmp, nama);
  tmp.createFile(Utilities.newBlob(String(body.data || ""), "text/plain", nama));
  if (indeks + 1 < total) {
    if (indeks === 0) pSapu(tmp);
    return { ok: true, jenis: P_JENIS, selesai: false, indeks: indeks };
  }

  var b64 = "";
  for (var i = 0; i < total; i++) {
    var it = tmp.getFilesByName(unggahId + "." + i);
    if (!it.hasNext()) return { ok: false, jenis: P_JENIS, sementara: true, error: "potongan ke-" + (i + 1) + " belum sampai, coba lagi" };
    b64 += it.next().getBlob().getDataAsString();
  }
  var folder = pSub(induk, folderNama);
  var namaBerkas = pBersih(body.namaBerkas) || "berkas";
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64),
    String(body.mime || "application/octet-stream"), namaBerkas));
  var hasil = {
    fileId: file.getId(), url: file.getUrl(), nama: file.getName(), ukuran: file.getSize(),
    folderUrl: folder.getUrl(), folderNama: folder.getName()
  };
  tmp.createFile(Utilities.newBlob(JSON.stringify(hasil), "application/json", unggahId + ".jadi"));
  for (var k = 0; k < total; k++) pBuang(tmp, unggahId + "." + k);
  hasil.ok = true; hasil.selesai = true; hasil.jenis = P_JENIS;
  return hasil;
}

function pBacaPenanda(tmp, unggahId) {
  var it = tmp.getFilesByName(unggahId + ".jadi");
  if (!it.hasNext()) return null;
  try { return JSON.parse(it.next().getBlob().getDataAsString()); } catch (e) { return null; }
}

function pBuang(folder, nama) {
  var it = folder.getFilesByName(nama);
  while (it.hasNext()) it.next().setTrashed(true);
}

// singgahan lebih tua dari 2 hari (unggahan yang ditinggal di tengah jalan)
function pSapu(tmp) {
  var batas = Date.now() - 2 * 24 * 3600 * 1000, it = tmp.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getDateCreated().getTime() < batas) f.setTrashed(true);
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
