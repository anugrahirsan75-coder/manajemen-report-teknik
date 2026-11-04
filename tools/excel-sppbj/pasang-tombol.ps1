# Rakit templat SPPB/J .xlsm: makro, form, tombol, dan lajur pilihan MA per item.
#
#   powershell -ExecutionPolicy Bypass -File pasang-tombol.ps1 -Sumber "Templet SPPBJ.xlsx" -Hasil "Templet SPPBJ.xlsm"
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
  [string]$Url = "https://manajemen-report-teknik.vercel.app"
)
$ErrorActionPreference = "Stop"

# Sama dengan PILIHAN_MA di src/lib/sppbj/dariExcel.ts.
$DAFTAR_MA = "Permesinan,Akomodasi,Ro-Ro,Pelumas,Sertifikasi Alat,Sertifikasi Produksi,Fumigasi,Mobilisasi,Inv Permesinan,Inv Akomodasi,Inv Ro-Ro"
$KOLOM_MA = "K"

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

function Pasang-LajurMa($ws) {
  $judul = $ws.Range("A1:J60").Find("Nama Barang")
  if ($null -eq $judul) { return $false }
  $r1 = $judul.Row + 2
  $akhir = $ws.Range("A1:J400").Find("Jumlah Rp")
  $r2 = if ($null -ne $akhir) { $akhir.Row - 1 } else { $r1 + 60 }
  if (-not $ws.PageSetup.PrintArea) { $ws.PageSetup.PrintArea = "`$A`$1:`$J`$$r2" }

  $ws.Columns.Item($KOLOM_MA).ColumnWidth = 18
  $kepala = $ws.Range("$KOLOM_MA$($judul.Row)")
  if (-not $kepala.Value2) {
    $kepala.Value2 = "MA"
    $kepala.Font.Bold = $true
    $kepala.HorizontalAlignment = -4108
  }

  $r = $ws.Range("$KOLOM_MA${r1}:$KOLOM_MA$r2")
  $r.Validation.Delete()
  $null = $r.Validation.Add(3, 1, 1, $DAFTAR_MA)   # xlValidateList
  $r.Validation.IgnoreBlank = $true
  $r.Validation.InCellDropdown = $true
  $r.Validation.ShowError = $false                 # ketikan bebas tetap dibaca server
  $r.Validation.InputTitle = "MA per item"
  $r.Validation.InputMessage = "Kosong = ikut MA di kepala lembar. Blok banyak sel lalu pilih sekali: semua baris item terisi."
  $r.Interior.Color = 0xDFF7FF
  $r.Font.Size = 10
  return $true
}

$xl = New-Object -ComObject Excel.Application
try {
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  $xl.AutomationSecurity = 3   # makro berkas sumber tidak dijalankan saat dirakit
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
    if (-not (Pasang-LajurMa $ws)) { continue }

    # Lajur MA melebar, jadi tombol selalu ditempatkan ulang di kanannya.
    $sel = $ws.Range("L1")
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
  }
  $wb.Worksheets.Item(1).Activate()
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
