param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Sheet = ""
)
$ErrorActionPreference = "Stop"
$ext = [System.IO.Path]::GetExtension($In).ToLower()

if ($ext -eq ".docx" -or $ext -eq ".doc") {
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0
  try {
    $doc = $app.Documents.Open($In, $false, $true)
    # 17 = wdFormatPDF
    $doc.SaveAs([ref]$Out, [ref]17)
    $doc.Close([ref]$false)
  } finally {
    $app.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  }
}
elseif ($ext -eq ".xlsx" -or $ext -eq ".xls") {
  $app = New-Object -ComObject Excel.Application
  $app.Visible = $false
  $app.DisplayAlerts = $false
  try {
    $wb = $app.Workbooks.Open($In, $false, $true)
    # 0 = xlTypePDF. Jika -Sheet diisi, ekspor sheet itu saja.
    if ($Sheet -ne "") {
      $ws = $wb.Worksheets.Item($Sheet)
      $ws.ExportAsFixedFormat(0, $Out)
    } else {
      $wb.ExportAsFixedFormat(0, $Out)
    }
    $wb.Close($false)
  } finally {
    $app.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  }
}
else {
  throw "Format tidak didukung: $ext"
}
Write-Output "OK"
