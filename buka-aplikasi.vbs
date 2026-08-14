' ══════════════════════════════════════════════════════════════════════════
'  BUKA APLIKASI DI LAPTOP BER-OLLAMA
'
'  Aplikasi harus dibuka lewat http://localhost:3001, BUKAN lewat alamat
'  Vercel. Sebabnya bukan selera: halaman https dilarang peramban memanggil
'  alamat http, dan Ollama melayani http di laptop ini. Dibuka dari localhost,
'  yang menghubungi Ollama adalah server Next.js di laptop sendiri — tak ada
'  urusan izin asal, tak ada larangan peramban, dan Juru Baca langsung bekerja.
'
'  Berkas ini: nyalakan server bila belum menyala, tunggu siap, lalu buka
'  halaman Isi Permintaan Kapal. Taruh pintasannya di desktop.
' ══════════════════════════════════════════════════════════════════════════
Option Explicit

Dim sh, fso, dir, alamat, i
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
alamat = "http://localhost:3001/permintaan-laporan/isi"

' Server sudah menyala? Kalau belum, nyalakan tanpa jendela.
If Not Hidup() Then
  sh.Run """" & dir & "\run-hidden.vbs""", 0, False
  ' Build pertama kali bisa memakan beberapa menit; 5 menit sudah lapang.
  For i = 1 To 150
    WScript.Sleep 2000
    If Hidup() Then Exit For
  Next
End If

If Hidup() Then
  sh.Run alamat
Else
  MsgBox "Server belum menyala setelah 5 menit." & vbCrLf & vbCrLf & _
         "Buka " & dir & "\server.log untuk melihat sebabnya.", 48, "Juru Baca"
End If

' Server menjawab? Objek dibuat baru tiap kali — objek yang sudah gagal
' menyambung tak bisa dipakai lagi untuk percobaan berikutnya.
Function Hidup()
  Dim http
  Hidup = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", "http://localhost:3001/api/surat/baca-tabel-ollama", False
  http.Send
  If Err.Number = 0 Then Hidup = (http.Status = 200)
  On Error GoTo 0
End Function
