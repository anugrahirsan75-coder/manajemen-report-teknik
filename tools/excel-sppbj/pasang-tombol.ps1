# Rakit templat SPPB/J .xlsm: makro, form, tombol, dan lajur pilihan MA per item.
#
#   powershell -ExecutionPolicy Bypass -File pasang-tombol.ps1 -Sumber "Templet SPPBJ.xlsx" -Hasil "Templet SPPBJ.xlsm"
#
# -KakDari <berkas lama> memindahkan Kerangka Acuan Kerja dari berkas itu ke bawah
# formulir dengan tata letak cetak yang baru. Teks dan rumusnya dibaca dari berkas
# tersebut, tidak ditulis di sini, jadi narasinya tetap persis sama.
#
# -Induk <berkas templat bersih> menaruh sheet pertama berkas itu sebagai sheet
# induk tersembunyi, sumber tombol TAMBAH SHEET BARU. Berkas yang sudah berisi
# bisa dirakit ulang dengan cara ini tanpa mengubah sheet-sheetnya.
#
# Sumber boleh .xlsx atau .xlsm hasil rakitan lama: isi lembar dipertahankan,
# makronya diganti dengan versi terbaru. Hanya perlu dijalankan di satu laptop;
# hasil .xlsm-nya yang dibagikan. Butuh "Trust access to the VBA project object
# model" di Excel laptop perakit. Laptop pemakai tidak butuh pengaturan itu.
#
# Selalu membuka instans Excel baru dan bekerja pada salinan, jadi Excel yang
# sedang dipakai tidak tersentuh.
param(
  [Parameter(Mandatory = $true)][string]$Sumber,
  [Parameter(Mandatory = $true)][string]$Hasil,
  [string]$Url = "https://manajemen-report-teknik.vercel.app",
  [string]$KakDari = "",
  [string]$Induk = ""
)
$ErrorActionPreference = "Stop"

# Sama dengan PILIHAN_MA di src/lib/sppbj/dariExcel.ts.
$DAFTAR_MA = "Permesinan,Akomodasi,Ro-Ro,Pelumas,Sertifikasi Alat,Sertifikasi Produksi,Fumigasi,Mobilisasi,Inv Permesinan,Inv Akomodasi,Inv Ro-Ro"

$sini = Split-Path -Parent $MyInvocation.MyCommand.Path
$Sumber = (Resolve-Path $Sumber).Path
$Hasil = [IO.Path]::GetFullPath($Hasil)
$kode = [guid]::NewGuid().ToString("N")
$salinan = Join-Path $env:TEMP ("sppbj-rakit-$kode" + [IO.Path]::GetExtension($Sumber))
Copy-Item $Sumber $salinan

# Teks CRLF ditulis ulang di sini: impor VBE memecah modul kalau akhir barisnya LF.
$bas = Join-Path $env:TEMP "KirimSppbj-$kode.bas"
$isiBas = (Get-Content (Join-Path $sini "KirimSppbj.bas") -Raw) -replace "`r?`n", "`r`n"
[IO.File]::WriteAllText($bas, $isiBas, [Text.Encoding]::ASCII)

function Teks($nama) { Get-Content (Join-Path $sini $nama) -Raw }

function Cari-Komponen($vb, $nama) {
  foreach ($k in $vb.VBComponents) { if ($k.Name -eq $nama) { return $k } }
  return $null
}

function Ganti-Kode($komponen, $teks) {
  $m = $komponen.CodeModule
  if ($m.CountOfLines -gt 0) { $m.DeleteLines(1, $m.CountOfLines) }
  $m.AddFromString($teks)
}

function Tambah-Kendali($form, $jenis, $nama, $kiri, $atas, $lebar, $tinggi) {
  $k = $form.Designer.Controls.Add($jenis, $nama)
  $k.Left = $kiri; $k.Top = $atas; $k.Width = $lebar; $k.Height = $tinggi
  return $k
}

function Buat-FormMasuk($vb) {
  $f = $vb.VBComponents.Add(3)   # vbext_ct_MSForm
  $f.Name = "FormMasuk"
  $f.Properties.Item("Caption").Value = "Masuk ke aplikasi"
  $f.Properties.Item("Width").Value = 270
  $f.Properties.Item("Height").Value = 170
  $k = Tambah-Kendali $f "Forms.Label.1" "lblInfo" 12 10 240 26
  $k.Caption = "Akun aplikasi Manajemen Report Teknik. Cukup sekali di tiap laptop."
  $k = Tambah-Kendali $f "Forms.Label.1" "lblUser" 12 44 60 14
  $k.Caption = "User"
  $null = Tambah-Kendali $f "Forms.TextBox.1" "txtUser" 76 41 176 18
  $k = Tambah-Kendali $f "Forms.Label.1" "lblSandi" 12 70 60 14
  $k.Caption = "Password"
  $k = Tambah-Kendali $f "Forms.TextBox.1" "txtSandi" 76 67 176 18
  $k.PasswordChar = "*"
  $k = Tambah-Kendali $f "Forms.CommandButton.1" "btnMasuk" 112 100 68 26
  $k.Caption = "Masuk"
  $k.Default = $true
  $k = Tambah-Kendali $f "Forms.CommandButton.1" "btnBatal" 184 100 68 26
  $k.Caption = "Batal"
  $k.Cancel = $true
  $f.CodeModule.AddFromString((Teks "FormMasuk.txt"))
}

function Buat-FormKirim($vb) {
  $f = $vb.VBComponents.Add(3)
  $f.Name = "FormKirim"
  $f.Properties.Item("Caption").Value = "Kirim ke Aplikasi"
  $f.Properties.Item("Width").Value = 470
  $f.Properties.Item("Height").Value = 350
  $k = Tambah-Kendali $f "Forms.TextBox.1" "txtRingkas" 10 10 442 250
  $k.MultiLine = $true
  $k.Locked = $true
  $k.ScrollBars = 2
  $k = Tambah-Kendali $f "Forms.Label.1" "lblJenis" 10 272 90 16
  $k.Caption = "Kirim sebagai:"
  $k = Tambah-Kendali $f "Forms.CommandButton.1" "btnRutin" 100 266 110 30
  $k.Caption = "RUTIN"
  $k = Tambah-Kendali $f "Forms.CommandButton.1" "btnDocking" 216 266 110 30
  $k.Caption = "DOCKING"
  $k = Tambah-Kendali $f "Forms.CommandButton.1" "btnBatal" 372 266 80 30
  $k.Caption = "Batal"
  $k.Cancel = $true
  $f.CodeModule.AddFromString((Teks "FormKirim.txt"))
}

function Ada-Bentuk($ws, $nama) {
  foreach ($s in $ws.Shapes) { if ($s.Name -eq $nama) { return $true } }
  return $false
}

function Huruf($kol) {
  $t = ""
  while ($kol -gt 0) { $m = ($kol - 1) % 26; $t = [char](65 + $m) + $t; $kol = [int](($kol - $m - 1) / 26) }
  return $t
}

# Baris judul dan lajur tabel dibaca dari isi lembar, karena formulir lama dan
# formulir C.SCM.2.2.01.00.01-HR berbeda letaknya.
function Baca-Tabel($ws) {
  $judul = $ws.Range("A1:K60").Find("Barang")
  while ($null -ne $judul -and $judul.Text -notmatch '^(Nama|Uraian)\s+Barang') { $judul = $ws.Range("A1:K60").FindNext($judul) }
  if ($null -eq $judul) { return $null }
  $baris = $judul.Row
  $kolTotal = 0
  for ($c = 1; $c -le 11; $c++) { if ($ws.Cells.Item($baris + 1, $c).Text -match '^Jumlah$') { $kolTotal = $c } }
  $penutup = 0
  for ($r = $baris + 2; $r -le 450; $r++) {
    foreach ($c in 1, 9) { if ($ws.Cells.Item($r, $c).Text -match '^\s*Jumlah\s+Rp') { $penutup = $r } }
    if ($penutup) { break }
  }
  return @{ baris = $baris; kolMa = $kolTotal + 1; akhir = $(if ($penutup) { $penutup - 1 } else { $baris + 60 }) }
}

function Pasang-LajurMa($ws, $t) {
  $r1 = $t.baris + 2
  $r2 = $t.akhir
  $kol = Huruf $t.kolMa
  if (-not $ws.PageSetup.PrintArea) { $ws.PageSetup.PrintArea = "`$A`$1:`$J`$$r2" }

  $ws.Columns.Item($kol).ColumnWidth = 18
  $kepala = $ws.Range("$kol$($t.baris)")
  if (-not $kepala.Value2) {
    $kepala.Value2 = "MA"
    $kepala.Font.Bold = $true
    $kepala.HorizontalAlignment = -4108
  }

  $r = $ws.Range("$kol${r1}:$kol$r2")
  $r.Validation.Delete()
  $null = $r.Validation.Add(3, 1, 1, $DAFTAR_MA)   # xlValidateList
  $r.Validation.IgnoreBlank = $true
  $r.Validation.InCellDropdown = $true
  $r.Validation.ShowError = $false                 # ketikan bebas tetap dibaca server
  $r.Validation.InputTitle = "MA per item"
  $r.Validation.InputMessage = "Kosong = ikut MA di kepala lembar. Blok banyak sel lalu pilih sekali: semua baris item terisi."
  $r.Interior.Color = 0xDFF7FF
  $r.Font.Size = 10
}

function Gaya($r, $ukuran, $tebal, $rata) {
  $r.NumberFormat = "General"
  $r.Font.Name = "Arial"
  $r.Font.Size = $ukuran
  $r.Font.Bold = $tebal
  $r.HorizontalAlignment = $rata
  $r.VerticalAlignment = -4160   # xlTop
  $r.WrapText = $true
}

function Tulis($ws, $alamat, $nilai, $ukuran, $tebal, $rata) {
  $r = $ws.Range($alamat)
  if ($r.Cells.Count -gt 1) { $r.Merge() }
  Gaya $r $ukuran $tebal $rata
  $r.Cells.Item(1, 1).Formula = $nilai
}

# Lembar dicetak pas selebar halaman (sekitar 68%), jadi 15 pt tercetak sekitar
# 10 pt. Tinggi baris diatur makro RapikanKak, jeda halaman oleh AturHalamanKak.
function Pasang-Kak($ws, $asal) {
  $RATA_TENGAH = -4108; $KIRI = -4131; $KANAN = -4152; $RATA_KIRI_KANAN = -4130
  foreach ($p in @(@("A11", "Nama Pekerjaan"), @("A9", "No. PR atau SPPB/J"), @("A10", "Tanggal PR atau SPPB/J"))) {
    if ($ws.Range($p[0]).Text -notmatch [regex]::Escape($p[1])) { throw "Sel $($p[0]) bukan '$($p[1])': tata letak formulir berubah" }
  }

  $awal = $asal.Range("A1:K1000").Find("KERANGKA ACUAN KERJA").Row
  $akhir = $asal.UsedRange.Row + $asal.UsedRange.Rows.Count - 1
  $n = 51
  $ws.Range("A50:K80").Clear() | Out-Null
  $barisNama = $n + 2
  $namaLama = "B$($awal + 2)"
  $rujuk = { param($f) ($f -replace "(?<![A-Z\$])$namaLama(?!\d)", "`$A`$$barisNama") -replace '(?<![A-Z\$])J6(?!\d)', '$$E$$9' }

  Tulis $ws "A${n}:K$n" $asal.Range("B$awal").Formula 18 $true $RATA_TENGAH; $ws.Rows.Item($n).RowHeight = 26; $n++
  Tulis $ws "A${n}:K$n" $asal.Range("B$($awal + 1)").Formula 15 $true $RATA_TENGAH; $ws.Rows.Item($n).RowHeight = 21; $n++
  Tulis $ws "A${n}:K$n" '=TRIM(SUBSTITUTE($E$11,":","",1))' 16 $true $RATA_TENGAH; $ws.Rows.Item($n).RowHeight = 44; $n++

  $tandaTangan = 0
  $kosong = $true
  for ($r = $awal + 3; $r -le $akhir; $r++) {
    $b = [string]$asal.Range("B$r").Formula
    $c = [string]$asal.Range("C$r").Formula
    $d = [string]$asal.Range("D$r").Formula
    $h = [string]$asal.Range("H$r").Formula
    if ($h) { $tandaTangan = $r; break }
    if (-not ($b -or $c -or $d)) {
      if (-not $kosong) { $ws.Rows.Item($n).RowHeight = 12; $n++ }
      $kosong = $true
      continue
    }
    $kosong = $false
    if ($b -match '^[A-Z]\.$') {
      Tulis $ws "A$n" $b 15 $true $KIRI
      Tulis $ws "B${n}:K$n" $c 15 $true $KIRI
      $ws.Rows.Item($n).RowHeight = 22
    }
    elseif ($c -match '^\d+\.$') {
      Tulis $ws "B$n" "'$c" 15 $false $KANAN   # tanda kutip: "1." tetap teks, bukan angka
      Tulis $ws "C${n}:K$n" (& $rujuk $d) 15 $false $RATA_KIRI_KANAN
    }
    else {
      Tulis $ws "B${n}:K$n" (& $rujuk $c) 15 $false $RATA_KIRI_KANAN
    }
    $n++
  }
  if (-not $tandaTangan) { throw "Bagian tanda tangan KAK tidak ketemu" }

  $ws.Rows.Item($n).RowHeight = 12; $n++
  Tulis $ws "I${n}:K$n" $asal.Range("H$tandaTangan").Formula 15 $false $KIRI; $ws.Rows.Item($n).RowHeight = 21; $n++
  Tulis $ws "I${n}:K$n" '=CONCATENATE("Tanggal       : ",TRIM(SUBSTITUTE($E$10,":","",1)))' 15 $false $KIRI; $ws.Rows.Item($n).RowHeight = 21; $n++
  $ws.Rows.Item($n).RowHeight = 12; $n++
  $baris = $tandaTangan + 2
  while (-not $asal.Range("C$baris").Formula) { $baris++ }
  Tulis $ws "B${n}:E$n" $asal.Range("C$baris").Formula 15 $false $RATA_TENGAH
  Tulis $ws "I${n}:K$n" $asal.Range("H$baris").Formula 15 $false $RATA_TENGAH
  $ws.Rows.Item($n).RowHeight = 21; $n++
  $ws.Rows.Item($n).RowHeight = 96; $n++
  Tulis $ws "B${n}:E$n" '=TRIM(SUBSTITUTE(SUBSTITUTE($I$47,"(",""),")",""))' 15 $true $RATA_TENGAH
  Tulis $ws "I${n}:K$n" '=TRIM(SUBSTITUTE(SUBSTITUTE($I$39,"(",""),")",""))' 15 $true $RATA_TENGAH
  $ws.Rows.Item($n).RowHeight = 21; $n++
  Tulis $ws "B${n}:E$n" '=$I$48' 15 $false $RATA_TENGAH
  Tulis $ws "I${n}:K$n" '=$I$40' 15 $false $RATA_TENGAH
  $ws.Rows.Item($n).RowHeight = 21

  $ws.PageSetup.PrintArea = "`$A`$1:`$K`$$n"
  # Skala tetap bawaan formulir (66%) membuat kolom kanan terpotong di sebagian printer.
  $ws.PageSetup.Zoom = $false
  $ws.PageSetup.FitToPagesWide = 1
  $ws.PageSetup.FitToPagesTall = $false
  "KAK dipasang di baris 51 sampai $n"
}

$xl = New-Object -ComObject Excel.Application
try {
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  $xl.EnableEvents = $false    # makro berkas sumber dan pengingatnya tidak ikut berjalan
  $xl.AutomationSecurity = 1   # RapikanKak dijalankan sekali saat merakit; hanya untuk instans ini
  $wb = $xl.Workbooks.Open($salinan)
  $vb = $wb.VBProject

  $modul = Cari-Komponen $vb "KirimSppbj"
  if ($null -eq $modul) {
    $null = $vb.VBComponents.Import($bas)
  }
  else {
    $tanpaAtribut = ($isiBas -split "`r`n" | Where-Object { $_ -notmatch '^Attribute VB_' }) -join "`r`n"
    Ganti-Kode $modul $tanpaAtribut
  }
  Ganti-Kode ($vb.VBComponents.Item($wb.CodeName)) (Teks "ThisWorkbook.txt")

  if ($null -eq (Cari-Komponen $vb "FormMasuk")) { Buat-FormMasuk $vb }
  $form = Cari-Komponen $vb "FormKirim"
  if ($null -eq $form) { Buat-FormKirim $vb } else { Ganti-Kode $form (Teks "FormKirim.txt") }

  foreach ($ws in $wb.Worksheets) {
    if ($ws.Visible -ne -1) { continue }      # sheet induk tersembunyi tidak disentuh
    $tabel = Baca-Tabel $ws
    if ($null -eq $tabel) { continue }
    Pasang-LajurMa $ws $tabel

    if ($KakDari) {
      $sumberKak = Join-Path $env:TEMP ("sppbj-kak-$kode" + [IO.Path]::GetExtension($KakDari))
      Copy-Item $KakDari $sumberKak
      $wbKak = $xl.Workbooks.Open($sumberKak, 0, $true)
      try { Pasang-Kak $ws $wbKak.Worksheets.Item(1) }
      finally { $wbKak.Close($false); Remove-Item $sumberKak -ErrorAction SilentlyContinue }
    }

    # Lajur MA melebar, jadi tombol selalu ditempatkan ulang di kanannya.
    $sel = $ws.Range("$(Huruf ($tabel.kolMa + 1))1")
    if (Ada-Bentuk $ws "TombolKirim") {
      $b = $ws.Buttons("TombolKirim")
      $b.Left = $sel.Left + 6
    }
    else {
      $b = $ws.Buttons().Add($sel.Left + 6, $sel.Top + 2, 190, 30)
      $b.Name = "TombolKirim"
      $b.Caption = "KIRIM KE APLIKASI"
      $b.OnAction = "KirimKeAplikasi"
      $b.Font.Bold = $true
      $b.PrintObject = $false
      $b.Placement = 3   # xlFreeFloating: tidak ikut meregang saat baris diubah
    }

    if (Ada-Bentuk $ws "TautanImporWeb") {
      $ws.Shapes.Item("TautanImporWeb").Left = $sel.Left + 6
    }
    else {
      # Bukan makro: tetap bisa diklik saat makronya diblokir.
      $s = $ws.Shapes.AddShape(1, $sel.Left + 6, $sel.Top + 36, 190, 20)
      $s.Name = "TautanImporWeb"
      $s.Fill.ForeColor.RGB = 0xF8F4EE
      $s.Line.ForeColor.RGB = 0xC4A882
      $s.TextFrame2.TextRange.Text = "Makro diblokir? Unggah di web"
      $s.TextFrame2.TextRange.Font.Size = 9
      $s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = 0x7F3516
      $s.TextFrame2.VerticalAnchor = 3
      $s.TextFrame2.TextRange.ParagraphFormat.Alignment = 2
      $s.Placement = 3
      $null = $ws.Hyperlinks.Add($s, "$Url/sppbj?impor=1")
      # Shape tidak punya PrintObject sendiri; DrawingObjects punya.
      $ws.DrawingObjects("TautanImporWeb").PrintObject = $false
    }

    if (Ada-Bentuk $ws "TombolSheet") {
      $ws.Buttons("TombolSheet").Left = $sel.Left + 6
    }
    else {
      $b = $ws.Buttons().Add($sel.Left + 6, $sel.Top + 62, 190, 30)
      $b.Name = "TombolSheet"
      $b.Caption = "TAMBAH SHEET BARU"
      $b.OnAction = "TambahSheet"
      $b.Font.Bold = $true
      $b.PrintObject = $false
      $b.Placement = 3
    }
  }

  if ($Induk) {
    $ada = $false
    foreach ($ws in $wb.Worksheets) { if ($ws.Name -eq "_TEMPLAT") { $ada = $true } }
    if (-not $ada) {
      $sumberInduk = Join-Path $env:TEMP "sppbj-induk-$kode.xlsm"
      Copy-Item $Induk $sumberInduk
      $wbInduk = $xl.Workbooks.Open($sumberInduk, 0, $true)
      try { $wbInduk.Worksheets.Item(1).Copy([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) }
      finally { $wbInduk.Close($false); Remove-Item $sumberInduk -ErrorAction SilentlyContinue }
      $t = $wb.Worksheets.Item($wb.Worksheets.Count)
      $t.Name = "_TEMPLAT"
      # tombol salinan masih menunjuk berkas asalnya
      $t.Buttons("TombolKirim").OnAction = "KirimKeAplikasi"
      $t.Buttons("TombolSheet").OnAction = "TambahSheet"
      $t.Visible = 2   # xlSheetVeryHidden
    }
  }
  $wb.Worksheets.Item(1).Activate()
  if ($KakDari) {
    # Tinggi baris diukur dengan isi panjang lalu isinya dikembalikan, supaya teks
    # tetap tidak terpotong di laptop yang makronya mati. Dengan makro hidup,
    # RapikanKak mengukur ulang sesuai isi sebenarnya setiap kali mencetak.
    $panjang = (": " + ("Pekerjaan Dengan Nama Yang Cukup Panjang " * 3)).Trim()
    foreach ($ws in $wb.Worksheets) {
      $ws.Activate()
      $asli = @{}
      foreach ($a in "E9", "E10", "E11") { $asli[$a] = $ws.Range($a).Formula; $ws.Range($a).Value2 = $panjang }
      $xl.Run("KirimSppbj.RapikanKakAktif")
      $xl.Run("KirimSppbj.AturHalamanKakAktif")
      foreach ($a in "E9", "E10", "E11") { $ws.Range($a).Formula = $asli[$a] }
    }
    $wb.Worksheets.Item(1).Activate()
  }
  if (Test-Path $Hasil) { Remove-Item $Hasil }
  $wb.SaveAs($Hasil, 52)   # xlOpenXMLWorkbookMacroEnabled
  $wb.Close($false)
  "Selesai: $Hasil"
}
finally {
  $xl.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
  Remove-Item $salinan, $bas -ErrorAction SilentlyContinue
}
