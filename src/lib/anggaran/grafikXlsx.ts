/**
 * Penyisip GRAFIK ASLI EXCEL ke berkas .xlsx yang sudah jadi.
 *
 * ExcelJS tidak bisa membuat grafik sama sekali — itu sebabnya berkas ekspor
 * selama ini hanya berisi tabel. Di sini berkasnya dibongkar sebagai zip, lalu
 * bagian chart/drawing ditulis langsung dalam XML, persis cara template SPPBJ
 * disunting (lihat lib/sppbj/fill.ts).
 *
 * Grafiknya grafik Excel sungguhan: masih tertaut ke selnya, jadi kalau angka di
 * sheet diubah saat rapat, grafiknya ikut berubah — bukan gambar mati.
 */
import PizZip from "pizzip";

export type JenisGrafik = "batang" | "batang-tumpuk" | "batang-mendatar" | "garis";

export interface DeretGrafik {
  /** nama deret; boleh berupa acuan sel (mis. "'1. Ringkasan'!$C$5") atau teks biasa */
  nama: string;
  /** acuan nilai, mis. "'1. Ringkasan'!$C$6:$C$13" */
  nilai: string;
  /** true = deret ini digambar sebagai garis pada sumbu kanan (persen) */
  garisKanan?: boolean;
}

export interface PermintaanGrafik {
  sheet: string;            // nama sheet tempat grafik ditempel
  jenis: JenisGrafik;
  judul: string;
  kategori: string;         // acuan label sumbu X
  deret: DeretGrafik[];
  /** posisi kiri-atas dalam indeks kolom & baris (0-based) */
  kolom: number;
  baris: number;
  lebarKolom?: number;      // lebar dalam jumlah kolom (bawaan 9)
  tinggiBaris?: number;     // tinggi dalam jumlah baris (bawaan 18)
  formatNilai?: string;     // format angka sumbu kiri
}

const EMU_KOLOM = 640080;   // ±0,7 inci per kolom — cukup mendekati untuk penempatan
const EMU_BARIS = 190500;   // ±0,2 inci per baris

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** warna deret — mengikuti palet aplikasi supaya grafik terasa satu keluarga */
const WARNA = ["1CA3DD", "16357F", "F59E0B", "16A34A", "DC2626", "6D28D9", "0891B2", "CA8A04"];

function xmlDeret(d: DeretGrafik, i: number, kategori: string, garis: boolean) {
  const warna = WARNA[i % WARNA.length];
  const namaXml = d.nama.includes("!")
    ? `<c:tx><c:strRef><c:f>${esc(d.nama)}</c:f></c:strRef></c:tx>`
    : `<c:tx><c:v>${esc(d.nama)}</c:v></c:tx>`;
  const isi = garis
    ? `<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${warna}"/></a:solidFill></a:ln></c:spPr>`
    : `<c:spPr><a:solidFill><a:srgbClr val="${warna}"/></a:solidFill></c:spPr>`;
  return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${namaXml}${isi}`
    + `<c:cat><c:strRef><c:f>${esc(kategori)}</c:f></c:strRef></c:cat>`
    + `<c:val><c:numRef><c:f>${esc(d.nilai)}</c:f></c:numRef></c:val>`
    + (garis ? `<c:smooth val="0"/>` : "")
    + `</c:ser>`;
}

function xmlChart(g: PermintaanGrafik) {
  const batang = g.deret.filter((d) => !d.garisKanan);
  const garis = g.deret.filter((d) => d.garisKanan);
  const fmt = g.formatNilai || "#,##0";
  const mendatar = g.jenis === "batang-mendatar";
  const tumpuk = g.jenis === "batang-tumpuk";

  const plotBatang = batang.length && g.jenis !== "garis"
    ? `<c:barChart><c:barDir val="${mendatar ? "bar" : "col"}"/>`
      + `<c:grouping val="${tumpuk ? "stacked" : "clustered"}"/><c:varyColors val="0"/>`
      + batang.map((d, i) => xmlDeret(d, i, g.kategori, false)).join("")
      + `<c:gapWidth val="${tumpuk ? 40 : 70}"/>${tumpuk ? '<c:overlap val="100"/>' : '<c:overlap val="-20"/>'}`
      + `<c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>`
    : "";

  const plotGarisUtama = g.jenis === "garis"
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>`
      + g.deret.map((d, i) => xmlDeret(d, i, g.kategori, true)).join("")
      + `<c:marker val="1"/><c:axId val="111111111"/><c:axId val="222222222"/></c:lineChart>`
    : "";

  // deret persen digambar sebagai garis pada pasangan sumbu kedua (sumbu kanan)
  const plotGarisKanan = garis.length
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>`
      + garis.map((d, i) => xmlDeret(d, batang.length + i, g.kategori, true)).join("")
      + `<c:marker val="1"/><c:axId val="333333333"/><c:axId val="444444444"/></c:lineChart>`
    : "";

  const sumbuUtama =
    `<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="${mendatar ? "l" : "b"}"/><c:crossAx val="222222222"/>`
    + `<c:txPr><a:bodyPr rot="${mendatar ? 0 : -2700000}"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>`
    + `</c:catAx>`
    + `<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="${mendatar ? "b" : "l"}"/>`
    + `<c:majorGridlines/><c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/>`
    + `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>`
    + `<c:crossAx val="111111111"/></c:valAx>`;

  const sumbuKanan = garis.length
    ? `<c:valAx><c:axId val="444444444"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
      + `<c:delete val="0"/><c:axPos val="r"/><c:numFmt formatCode="0%" sourceLinked="0"/>`
      + `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>`
      + `<c:crossAx val="333333333"/><c:crosses val="max"/></c:valAx>`
      + `<c:catAx><c:axId val="333333333"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
      + `<c:delete val="1"/><c:axPos val="b"/><c:crossAx val="444444444"/></c:catAx>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" `
    + `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr>`
    + `<a:r><a:rPr lang="id-ID" sz="1100" b="1"/><a:t>${esc(g.judul)}</a:t></a:r></a:p></c:rich></c:tx>`
    + `<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    + `<c:plotArea><c:layout/>${plotBatang}${plotGarisUtama}${plotGarisKanan}${sumbuUtama}${sumbuKanan}</c:plotArea>`
    + `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>`
    + `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>`
    + `</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function xmlDrawing(daftar: PermintaanGrafik[], idAwal: number) {
  const anchor = daftar.map((g, i) => {
    const lebar = g.lebarKolom ?? 9;
    const tinggi = g.tinggiBaris ?? 18;
    return `<xdr:twoCellAnchor editAs="oneCell">`
      + `<xdr:from><xdr:col>${g.kolom}</xdr:col><xdr:colOff>0</xdr:colOff>`
      + `<xdr:row>${g.baris}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
      + `<xdr:to><xdr:col>${g.kolom + lebar}</xdr:col><xdr:colOff>0</xdr:colOff>`
      + `<xdr:row>${g.baris + tinggi}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>`
      + `<xdr:cNvPr id="${idAwal + i}" name="Grafik ${idAwal + i}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
      + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU_KOLOM * lebar}" cy="${EMU_BARIS * tinggi}"/></xdr:xfrm>`
      + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">`
      + `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" `
      + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/>`
      + `</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" `
    + `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchor}</xdr:wsDr>`;
}

/** cari berkas sheet (xl/worksheets/sheetN.xml) dari NAMA sheet */
function jalurSheet(zip: PizZip, nama: string): string | null {
  const wb = zip.file("xl/workbook.xml")?.asText() || "";
  const rels = zip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
  const cocok = new RegExp(`<sheet[^>]*name="${nama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*r:id="([^"]+)"`).exec(wb);
  if (!cocok) return null;
  const target = new RegExp(`Id="${cocok[1]}"[^>]*Target="([^"]+)"`).exec(rels);
  if (!target) return null;
  const t = target[1].replace(/^\/?xl\//, "").replace(/^\//, "");
  return `xl/${t}`;
}

/**
 * Sisipkan grafik ke buffer .xlsx yang sudah jadi.
 * Berkas dikembalikan sebagai Uint8Array baru; masukan tidak diubah.
 */
export function sisipkanGrafik(buf: Uint8Array | ArrayBuffer, permintaan: PermintaanGrafik[]): Uint8Array {
  if (!permintaan.length) return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const zip = new PizZip(buf instanceof Uint8Array ? buf : new Uint8Array(buf));

  // kelompokkan per sheet: satu sheet = satu drawing yang memuat semua grafiknya
  const perSheet = new Map<string, PermintaanGrafik[]>();
  permintaan.forEach((g) => perSheet.set(g.sheet, [...(perSheet.get(g.sheet) || []), g]));

  let nomorChart = 1;
  let nomorDrawing = 1;
  const tambahOverride: string[] = [];

  perSheet.forEach((daftar, namaSheet) => {
    const sheetPath = jalurSheet(zip, namaSheet);
    if (!sheetPath || !zip.file(sheetPath)) return;      // sheet tak ditemukan: lewati, jangan merusak berkas

    const idDrawing = nomorDrawing++;
    const drawingPath = `xl/drawings/drawing${idDrawing}.xml`;
    const relsDrawing: string[] = [];

    daftar.forEach((g, i) => {
      const idChart = nomorChart++;
      zip.file(`xl/charts/chart${idChart}.xml`, xmlChart(g));
      tambahOverride.push(`<Override PartName="/xl/charts/chart${idChart}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      relsDrawing.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${idChart}.xml"/>`);
    });

    zip.file(drawingPath, xmlDrawing(daftar, idDrawing * 100));
    zip.file(`xl/drawings/_rels/drawing${idDrawing}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsDrawing.join("")}</Relationships>`);
    tambahOverride.push(`<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);

    // kaitkan drawing ke sheet-nya
    const relPath = sheetPath.replace(/worksheets\/(.+)$/, "worksheets/_rels/$1.rels");
    const relLama = zip.file(relPath)?.asText();
    const idRel = `rIdGrafik${idDrawing}`;
    const relBaru = relLama
      ? relLama.replace("</Relationships>",
          `<Relationship Id="${idRel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${idDrawing}.xml"/></Relationships>`)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="${idRel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${idDrawing}.xml"/></Relationships>`;
    zip.file(relPath, relBaru);

    // <drawing> WAJIB berada di ujung <worksheet>, sesudah elemen lain
    let xml = zip.file(sheetPath)!.asText();
    xml = xml.replace(/<drawing[^>]*\/>/g, "");
    xml = xml.replace("</worksheet>", `<drawing r:id="${idRel}"/></worksheet>`);
    if (!/xmlns:r=/.test(xml)) {
      xml = xml.replace("<worksheet ", `<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `);
    }
    zip.file(sheetPath, xml);
  });

  if (tambahOverride.length) {
    const ct = zip.file("[Content_Types].xml")!.asText();
    zip.file("[Content_Types].xml", ct.replace("</Types>", `${tambahOverride.join("")}</Types>`));
  }

  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}
