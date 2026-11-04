# Rakit templat SPPB/J .xlsm dari .xlsx: makro, form masuk, dan dua tombol per sheet.
#
#   powershell -ExecutionPolicy Bypass -File pasang-tombol.ps1 -Sumber "Templet SPPBJ.xlsx" -Hasil "Templet SPPBJ.xlsm"
#
# Hanya perlu dijalankan di satu laptop; hasil .xlsm-nya yang dibagikan. Butuh
# "Trust access to the VBA project object model" di Excel laptop perakit. Laptop
# pemakai tidak butuh pengaturan itu.
#
# Selalu membuka instans Excel baru dan bekerja pada salinan, jadi Excel yang
# sedang dipakai tidak tersentuh.
param(
  [Parameter(Mandatory = $true)][string]$Sumber,
  [Parameter(Mandatory = $true)][string]$Hasil,
  [string]$Url = "https://manajemen-report-teknik.vercel.app"
)
$ErrorActionPreference = "Stop"
$sini = Split-Path -Parent $MyInvocation.MyCommand.Path
$Sumber = (Resolve-Path $Sumber).Path
$Hasil = [IO.Path]::GetFullPath($Hasil)
$salinan = Join-Path $env:TEMP ("sppbj-rakit-" + [guid]::NewGuid().ToString("N") + ".xlsx")
Copy-Item $Sumber $salinan

# Teks CRLF ditulis ulang di sini: impor VBE memecah modul kalau akhir barisnya LF.
$bas = Join-Path $env:TEMP ("KirimSppbj-" + [guid]::NewGuid().ToString("N") + ".bas")
$isi = (Get-Content (Join-Path $sini "KirimSppbj.bas") -Raw) -replace "`r?`n", "`r`n"
[IO.File]::WriteAllText($bas, $isi, [Text.Encoding]::ASCII)

function Teks($nama) { Get-Content (Join-Path $sini $nama) -Raw }

function Tambah-Kendali($form, $jenis, $nama, $kiri, $atas, $lebar, $tinggi) {
  $k = $form.Designer.Controls.Add($jenis, $nama)
  $k.Left = $kiri; $k.Top = $atas; $k.Width = $lebar; $k.Height = $tinggi
  return $k
}

$xl = New-Object -ComObject Excel.Application
try {
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  $wb = $xl.Workbooks.Open($salinan)
  $vb = $wb.VBProject

  $null = $vb.VBComponents.Import($bas)

  $inti = $vb.VBComponents.Item($wb.CodeName)
  $inti.CodeModule.DeleteLines(1, $inti.CodeModule.CountOfLines)
  $inti.CodeModule.AddFromString((Teks "ThisWorkbook.txt"))

  # vbext_ct_MSForm = 3
  $f = $vb.VBComponents.Add(3)
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

  foreach ($ws in $wb.Worksheets) {
    $sel = $ws.Range("L1")
    $b = $ws.Buttons().Add($sel.Left + 6, $sel.Top + 2, 190, 30)
    $b.Name = "TombolKirim"
    $b.Caption = "KIRIM KE APLIKASI"
    $b.OnAction = "KirimKeAplikasi"
    $b.Font.Bold = $true
    $b.PrintObject = $false
    $b.Placement = 3   # xlFreeFloating: tidak ikut meregang saat baris diubah

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
