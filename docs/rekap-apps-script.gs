/**
 * REKAP PJK KAPAL PERBULAN — penerima data dari app "Manajemen Report Teknik".
 * Cara pasang:
 *  1. Buka spreadsheet REKAP -> Ekstensi -> Apps Script.
 *  2. Tempel SELURUH kode ini (ganti file Code.gs). Set SECRET di bawah.
 *  3. Deploy -> New deployment -> type "Web app" ->
 *       Execute as: Me (pemilik), Who has access: Anyone with the link.
 *  4. Copy URL /exec -> berikan ke app: env REKAP_GAS_URL. SECRET -> env REKAP_GAS_SECRET.
 */

var SECRET = "GANTI_SECRET_INI_SAMA_DENGAN_ENV"; // harus sama dgn REKAP_GAS_SECRET di app
var DATA_START_ROW = 4;
var MON3 = ["", "JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
// kolom 1-based: A NO, B SPPBJ, C NAMA, D FILE, E KET, F PR, G TGL, H NILAI_SPPBJ, I NILAI_SPBJ, J PO, K GR
var COL = { no: 1, sppbj: 2, nama: 3, file: 4, ket: 5, pr: 6, tgl: 7, nSppbj: 8, nSpbj: 9, po: 10, gr: 11 };
var TEMPLATE_NAME = ""; // opsional: nama tab yg dijadikan cetakan tab bulan baru (kosong = pakai tab bulan terbaru)

function doGet() {
  return json({ ok: true, msg: "REKAP webhook aktif" });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (SECRET && body.secret !== SECRET) return json({ ok: false, error: "secret salah" });
    var rows = body.rows || [];
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var results = [];
    for (var i = 0; i < rows.length; i++) results.push(writeRow(ss, rows[i]));
    return json({ ok: true, results: results });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
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

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
