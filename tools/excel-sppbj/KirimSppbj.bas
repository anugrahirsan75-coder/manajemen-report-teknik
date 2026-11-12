Attribute VB_Name = "KirimSppbj"
Option Explicit
'
' Kirim lembar SPPB/J yang sedang terbuka ke aplikasi Manajemen Report Teknik.
'
' Makro ini sengaja tipis: ia hanya mengirim isi sel apa adanya. Membaca judul,
' MA, DRP, dan item dikerjakan server (src/lib/sppbj/dariExcel.ts), jadi aturan
' bacanya bisa berubah tanpa membagikan ulang berkas Excel.
'
' Tidak ada kunci rahasia di berkas ini. Klik pertama di sebuah laptop meminta
' akun aplikasi, lalu sesinya disimpan di registry pengguna Windows laptop itu
' (setara cookie peramban), sehingga berkasnya aman dipindah-pindah. Sub
' LupakanAkun menghapusnya.
'
' Sumber ada di tools/excel-sppbj. Teksnya hanya ASCII karena VBA menyimpan kode
' memakai halaman kode lokal; teks Indonesia di lembar dikirim sebagai \uXXXX.

Private Const URL_APP As String = "https://manajemen-report-teknik.vercel.app"
Private Const JALUR_IMPOR As String = "/sppbj?impor=1"
Private Const BAG As String = "ManajemenReportTeknik"
Private Const JUDUL As String = "Kirim ke Aplikasi"
Private Const BARIS_MAKS As Long = 400
Private Const KOLOM_MAKS As Long = 16
Private Const VERSI As Long = 2
Private Const LAJUR_BANTU As Long = 52     ' AZ sampai BB, di luar area cetak
Private Const NAMA_INDUK As String = "_TEMPLAT"

' Nama lembar yang berubah sejak berkas dibuka, dan tanda isi yang sudah
' ditanyakan: pengingat cukup sekali untuk satu isi lembar.
Private mBerubah As String
Private mDitanya As String
Private mGalat As String

Public Sub KirimKeAplikasi()
    If TypeName(ActiveSheet) <> "Worksheet" Then Exit Sub
    KirimLembar ActiveSheet
End Sub

Public Sub BukaImporWeb()
    On Error Resume Next
    ThisWorkbook.FollowHyperlink Alamat() & JALUR_IMPOR
End Sub

' Hapus sesi yang tersimpan di laptop ini (Alt+F8). Dipakai di laptop bersama.
Public Sub LupakanAkun()
    HapusToken
    MsgBox "Akun aplikasi sudah dilupakan di laptop ini.", vbInformation, JUDUL
End Sub

Private Sub KirimLembar(ByVal ws As Worksheet)
    Dim isi As String, jawab As String, kode As String, jenis As String

    On Error GoTo Galat
    Application.StatusBar = "Membaca lembar..."
    isi = LembarJson(ws)
    Application.StatusBar = "Memeriksa ke aplikasi..."
    If Not Minta("cek", isi, jawab) Then GoTo Selesai

    kode = KodeJawab(jawab)
    If kode <> "SIAP" Then
        ' lembar yang terkunci tidak perlu diingatkan lagi
        If kode = "TERKUNCI" Then SaveSetting BAG, "Terkirim", KunciLembar(ws), Tanda(isi)
        MsgBox PesanJawab(jawab), IIf(kode = "GAGAL", vbExclamation, vbInformation), JUDUL
        GoTo Selesai
    End If
    Application.StatusBar = False
    jenis = PilihJenis(PesanJawab(jawab))
    If Len(jenis) = 0 Then GoTo Selesai

    Application.StatusBar = "Mengirim..."
    If Not Minta("kirim", isi, jawab, jenis) Then GoTo Selesai
    If KodeJawab(jawab) = "TERKIRIM" Then
        SaveSetting BAG, "Terkirim", KunciLembar(ws), Tanda(isi)
        MsgBox PesanJawab(jawab), vbInformation, JUDUL
    Else
        MsgBox PesanJawab(jawab), vbExclamation, JUDUL
    End If
Selesai:
    Application.StatusBar = False
    Exit Sub

Galat:
    Application.StatusBar = False
    MsgBox "Gagal mengirim: " & Err.Description, vbExclamation, JUDUL
End Sub

' Ringkasan dan dua tombol jenis. Mengembalikan "" bila dibatalkan.
Private Function PilihJenis(ByVal pesan As String) As String
    Dim f As FormKirim
    Set f = New FormKirim
    f.txtRingkas.Text = Replace(pesan, vbLf, vbCrLf)
    f.txtRingkas.SelStart = 0
    f.Show
    PilihJenis = f.Pilihan
    Unload f
End Function

' ---- sheet baru ----------------------------------------------------------------

' SPPBJ docking terdiri dari beberapa pengadaan dalam satu berkas (Alat Kerja, ILR,
' Cat, ...). Sheet baru disalin dari sheet induk yang tersembunyi, bukan dari sheet
' yang sedang dibuka, supaya selalu kosong walau sheet yang aktif sudah terisi.
Public Sub TambahSheet()
    Dim nama As String, masalah As String

    nama = Trim$(InputBox("Nama sheet baru, misalnya Alat Kerja, ILR, atau Cat:", JUDUL))
    If Len(nama) = 0 Then Exit Sub
    masalah = BuatSheet(nama)
    If Len(masalah) > 0 Then MsgBox masalah, vbExclamation, JUDUL
End Sub

' Mengembalikan alasan gagal, atau teks kosong bila berhasil.
Public Function BuatSheet(ByVal nama As String) As String
    Dim induk As Worksheet, ws As Worksheet, i As Long, peringatan As Boolean

    If Len(nama) > 31 Then
        BuatSheet = "Nama sheet paling panjang 31 huruf."
        Exit Function
    End If
    For i = 1 To Len(nama)
        If InStr("\/?*[]:", Mid$(nama, i, 1)) > 0 Then
            BuatSheet = "Nama sheet tidak boleh memuat tanda \ / ? * [ ] :"
            Exit Function
        End If
    Next i
    For Each ws In ThisWorkbook.Worksheets
        If StrComp(ws.Name, nama, vbTextCompare) = 0 Then
            BuatSheet = "Sheet """ & nama & """ sudah ada."
            Exit Function
        End If
    Next ws

    On Error Resume Next
    Set induk = ThisWorkbook.Worksheets(NAMA_INDUK)
    On Error GoTo Galat
    If induk Is Nothing Then
        BuatSheet = "Sheet induk tidak ada di berkas ini. Pakai templat terbaru."
        Exit Function
    End If

    peringatan = Application.DisplayAlerts
    Application.DisplayAlerts = False
    Application.ScreenUpdating = False
    induk.Visible = xlSheetVisible
    induk.Copy After:=ThisWorkbook.ActiveSheet
    ActiveSheet.Name = nama
    induk.Visible = xlSheetVeryHidden
    ThisWorkbook.Worksheets(nama).Activate
Selesai:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = peringatan
    Exit Function

Galat:
    BuatSheet = "Gagal membuat sheet: " & Err.Description
    If Not induk Is Nothing Then induk.Visible = xlSheetVeryHidden
    Resume Selesai
End Function

' ---- pilihan MA per item -------------------------------------------------------

' Daftar pilihan Excel hanya mengisi sel aktif. Supaya tidak memilih satu per
' satu: blok banyak sel lajur MA lalu pilih sekali, baris item yang terblok ikut
' terisi. Baris judul dan baris kosong dilewati. Lajur MA dikenali dari judulnya,
' karena letaknya beda antara formulir lama (K) dan formulir baru (L).
Public Sub SebarkanMa(ByVal sh As Object, ByVal Target As Range)
    Dim sel As Range, blok As Range, r As Long, c As Long
    Dim kolomMa As Long, kolomJumlah As Long

    On Error GoTo Selesai
    If Target.Cells.Count <> 1 Then Exit Sub
    If IsEmpty(Target.Value2) Or TypeName(Selection) <> "Range" Then Exit Sub
    Set blok = Selection
    kolomMa = Target.Column
    If blok.Parent.Name <> sh.Name Or blok.Cells.Count < 2 Then Exit Sub
    If Intersect(blok, sh.Columns(kolomMa)).Cells.Count <> blok.Cells.Count Then Exit Sub

    For r = 1 To 40
        If CStr(sh.Cells(r, kolomMa).Value2) = "MA" Then Exit For
    Next r
    If r > 40 Then Exit Sub
    For c = 1 To kolomMa - 1
        If CStr(sh.Cells(r, c).Value2) = "Jumlah" Then
            kolomJumlah = c
            Exit For
        End If
    Next c
    If kolomJumlah = 0 Then Exit Sub

    Application.EnableEvents = False
    For Each sel In blok.Cells
        If sel.Row <> Target.Row And Not sel.EntireRow.Hidden Then
            If Not IsEmpty(sh.Cells(sel.Row, kolomJumlah).Value2) Then sel.Value2 = Target.Value2
        End If
    Next sel
Selesai:
    Application.EnableEvents = True
End Sub

' ---- Kerangka Acuan Kerja ------------------------------------------------------

Private Function CariKak(ByVal ws As Worksheet, ByRef awal As Long, ByRef akhir As Long) As Boolean
    Dim cari As Range
    Set cari = ws.Range("A1:K1000").Find("KERANGKA ACUAN KERJA", LookIn:=xlValues, LookAt:=xlWhole)
    If cari Is Nothing Then Exit Function
    awal = cari.Row
    akhir = ws.Cells(ws.Rows.Count, 9).End(xlUp).Row
    CariKak = True
End Function

' Tinggi baris KAK mengikuti panjang teks, supaya tidak terpotong saat dicetak.
' Sel gabungan tidak bisa AutoFit sendiri, jadi teksnya ditaruh sebentar di lajur
' bantu yang selebar gabungan itu. Dijalankan tiap kali mencetak karena panjang
' teks ikut berubah bersama nama pekerjaan. Area cetak, skala, dan jeda halaman
' tidak disentuh: itu pengaturan pemakai.
Public Sub RapikanKak(ByVal ws As Worksheet)
    Dim awal As Long, akhir As Long, r As Long
    Dim sel As Range, kolom As Long, bantu As Range, acara As Boolean

    If Not CariKak(ws, awal, akhir) Then Exit Sub

    acara = Application.EnableEvents
    On Error GoTo Selesai
    Application.EnableEvents = False
    SetelLebar ws.Columns(LAJUR_BANTU), ws.Range("B1:K1").Width * 0.97
    SetelLebar ws.Columns(LAJUR_BANTU + 1), ws.Range("C1:K1").Width * 0.97
    SetelLebar ws.Columns(LAJUR_BANTU + 2), ws.Range("A1:K1").Width * 0.97

    For r = awal To akhir
        Set sel = Nothing
        If ws.Cells(r, 1).MergeCells And ws.Cells(r, 1).MergeArea.Columns.Count = 11 Then
            Set sel = ws.Cells(r, 1)
            kolom = LAJUR_BANTU + 2
        ElseIf ws.Cells(r, 2).MergeCells And ws.Cells(r, 2).MergeArea.Columns.Count = 10 Then
            Set sel = ws.Cells(r, 2)
            kolom = LAJUR_BANTU
        ElseIf ws.Cells(r, 3).MergeCells And ws.Cells(r, 3).MergeArea.Columns.Count = 9 Then
            Set sel = ws.Cells(r, 3)
            kolom = LAJUR_BANTU + 1
        End If
        If Not sel Is Nothing Then
            Set bantu = ws.Cells(r, kolom)
            bantu.WrapText = True
            bantu.Font.Name = sel.Font.Name
            bantu.Font.Size = sel.Font.Size
            bantu.Font.Bold = sel.Font.Bold
            bantu.Value2 = CStr(sel.Value2)
            ws.Rows(r).AutoFit
            ws.Rows(r).RowHeight = ws.Rows(r).RowHeight + 3
            bantu.Clear
        End If
    Next r
Selesai:
    Application.EnableEvents = acara
End Sub

' Pengaturan halaman awal: hanya dijalankan sekali saat templat dirakit, tidak
' pernah saat mencetak, karena menghapus jeda halaman yang diatur pemakai.
Public Sub AturHalamanKak(ByVal ws As Worksheet)
    Dim awal As Long, akhir As Long, r As Long, s As Long
    Dim batas As Double, isi As Double, t As Double, skala As Double
    Dim lebarKertas As Double, tinggiKertas As Double

    If Not CariKak(ws, awal, akhir) Then Exit Sub
    If ws.PageSetup.PaperSize = xlPaperA4 Then
        lebarKertas = 595.28: tinggiKertas = 841.89
    Else
        lebarKertas = 612: tinggiKertas = 792
    End If
    skala = (lebarKertas - ws.PageSetup.LeftMargin - ws.PageSetup.RightMargin) / ws.Range("A1:K1").Width
    If skala > 1 Then skala = 1
    ' 45 pt untuk catatan kaki formulir di bagian bawah halaman
    batas = (tinggiKertas - ws.PageSetup.TopMargin - 45) / skala

    ws.ResetAllPageBreaks
    ' ResetAllPageBreaks ikut mengubah skala cetak, dan skala tetap membuat kolom
    ' kanan terpotong ke halaman lain di sebagian printer
    With ws.PageSetup
        .Zoom = False
        .FitToPagesWide = 1
        .FitToPagesTall = False
    End With
    ws.HPageBreaks.Add Before:=ws.Rows(awal)
    r = awal
    Do While r <= akhir
        s = r + 1
        Do While s <= akhir
            If AwalBagianKak(ws, s) Then Exit Do
            s = s + 1
        Loop
        t = ws.Range(ws.Rows(r), ws.Rows(s - 1)).Height
        If isi > 0 And isi + t > batas Then
            ws.HPageBreaks.Add Before:=ws.Rows(r)
            isi = 0
        End If
        isi = isi + t
        r = s
    Loop
End Sub

Public Sub AturHalamanKakAktif()
    On Error Resume Next
    If TypeName(ActiveSheet) = "Worksheet" Then AturHalamanKak ActiveSheet
End Sub

' Beberapa sheet bisa dipilih sekaligus untuk dicetak bersama.
Public Sub RapikanKakAktif()
    Dim sh As Object
    On Error Resume Next
    For Each sh In ActiveWindow.SelectedSheets
        If TypeName(sh) = "Worksheet" Then RapikanKak sh
    Next sh
End Sub

Private Function AwalBagianKak(ByVal ws As Worksheet, ByVal r As Long) As Boolean
    AwalBagianKak = CStr(ws.Cells(r, 1).Value2) Like "[A-Z]." _
        Or InStr(CStr(ws.Cells(r, 9).Value2), "Dibuat di") = 1
End Function

Private Sub SetelLebar(ByVal kol As Range, ByVal lebar As Double)
    Dim i As Long
    For i = 1 To 3
        kol.ColumnWidth = kol.ColumnWidth * lebar / kol.Width
    Next i
End Sub

' ---- pengingat saat cetak dan tutup berkas ------------------------------------

Public Sub CatatBerubah(ByVal sh As Object)
    If InStr(mBerubah, "|" & sh.Name & "|") = 0 Then mBerubah = mBerubah & "|" & sh.Name & "|"
End Sub

Public Sub IngatkanSebelumCetak()
    On Error Resume Next
    If TypeName(ActiveSheet) = "Worksheet" Then Ingatkan ActiveSheet
End Sub

Public Sub IngatkanSebelumTutup()
    Dim ws As Worksheet
    On Error Resume Next
    For Each ws In ThisWorkbook.Worksheets
        If InStr(mBerubah, "|" & ws.Name & "|") > 0 Then Ingatkan ws
    Next ws
End Sub

Private Sub Ingatkan(ByVal ws As Worksheet)
    Dim isi As String, t As String
    If Not LembarSppbj(ws) Then Exit Sub
    isi = LembarJson(ws)
    t = Tanda(isi)
    If GetSetting(BAG, "Terkirim", KunciLembar(ws), "") = t Then Exit Sub
    If InStr(mDitanya, "|" & t & "|") > 0 Then Exit Sub
    mDitanya = mDitanya & "|" & t & "|"
    If MsgBox("Lembar """ & ws.Name & """ belum dikirim ke aplikasi." & vbLf & vbLf & _
              "Kirim sekarang?", vbYesNo + vbQuestion, JUDUL) = vbYes Then KirimLembar ws
End Sub

Private Function LembarSppbj(ByVal ws As Worksheet) As Boolean
    Dim sel As Range
    For Each sel In ws.Range("A1:K14").Cells
        If Not IsError(sel.Value2) Then
            If InStr(1, CStr(sel.Value2), "SPPB/J", vbTextCompare) > 0 Then
                LembarSppbj = True
                Exit Function
            End If
        End If
    Next sel
End Function

Private Function KunciLembar(ByVal ws As Worksheet) As String
    KunciLembar = ws.Parent.Name & "|" & ws.Name
End Function

' Sidik isi lembar, cukup untuk tahu lembarnya berubah sejak terakhir terkirim.
Private Function Tanda(ByVal s As String) As String
    Const M As Double = 4294967291#
    Dim i As Long, h As Double
    h = 5381
    For i = 1 To Len(s)
        h = h * 33 + (AscW(Mid$(s, i, 1)) And &HFFFF&)
        h = h - Fix(h / M) * M
    Next i
    Tanda = Len(s) & "-" & Format$(h, "0")
End Function

' ---- hubungan ke aplikasi -----------------------------------------------------

Private Function Alamat() As String
    Alamat = GetSetting(BAG, "Umum", "Url", URL_APP)
End Function

Private Function BuatPermintaan() As Object
    Dim h As Object
    Set h = CreateObject("WinHttp.WinHttpRequest.5.1")
    h.SetTimeouts 10000, 15000, 30000, 90000
    On Error Resume Next
    h.Option(6) = False       ' jangan ikuti pengalihan ke halaman login
    h.Option(9) = &HA00       ' TLS 1.1 dan 1.2, untuk Windows lama
    On Error GoTo 0
    Set BuatPermintaan = h
End Function

Private Sub BilangTakTersambung(ByVal rinci As String)
    If MsgBox("Tidak tersambung ke aplikasi." & vbLf & rinci & vbLf & vbLf & _
              "Buka halaman impor di peramban? Simpan dulu berkas ini, lalu unggah di sana.", _
              vbYesNo + vbExclamation, JUDUL) = vbYes Then BukaImporWeb
End Sub

' Kirim satu permintaan. Mengembalikan False bila sudah dijelaskan ke pemakai.
Private Function Minta(ByVal aksi As String, ByVal isi As String, ByRef jawab As String, _
                       Optional ByVal jenis As String = "") As Boolean
    Dim h As Object, coba As Long, status As Long, token As String

    For coba = 1 To 3
        token = GetSetting(BAG, "Sesi", "Token", "")
        If Len(token) = 0 Then
            If Not Masuk() Then Exit Function
            token = GetSetting(BAG, "Sesi", "Token", "")
        End If

        On Error GoTo GagalSambung
        Set h = BuatPermintaan()
        h.Open "POST", Alamat() & "/api/sppbj/dari-excel", False
        h.SetRequestHeader "Content-Type", "application/json"
        h.SetRequestHeader "X-Klien", "excel"
        h.SetRequestHeader "Cookie", "mrt_session=" & token
        h.Send "{""aksi"":""" & aksi & """,""versi"":" & VERSI & ",""jenis"":""" & jenis & """,""lembar"":" & isi & "}"
        status = h.Status
        On Error GoTo 0

        Select Case status
            Case 200
                jawab = h.ResponseText
                Minta = True
                Exit Function
            Case 401
                HapusToken
            Case 403
                HapusToken
                MsgBox "Akun ini tidak berhak mengirim SPPBJ. Masuk memakai akun Teknik.", vbExclamation, JUDUL
                Exit Function
            Case Else
                BilangTakTersambung "Jawaban server: " & status
                Exit Function
        End Select
    Next coba
    MsgBox "Sesi ditolak terus oleh aplikasi.", vbExclamation, JUDUL
    Exit Function

GagalSambung:
    BilangTakTersambung Err.Description
End Function

Private Function Masuk() As Boolean
    Dim f As FormMasuk, status As Long

    Set f = New FormMasuk
    Do
        f.Ok = False
        f.Show
        If Not f.Ok Then Exit Do
        status = CobaMasuk(f.txtUser.Text, f.txtSandi.Text)
        Select Case status
            Case 200
                Masuk = True
                Exit Do
            Case 401
                f.txtSandi.Text = ""
                MsgBox "User atau password salah.", vbExclamation, JUDUL
            Case 0
                BilangTakTersambung mGalat
                Exit Do
            Case Else
                BilangTakTersambung "Jawaban server: " & status
                Exit Do
        End Select
    Loop
    Unload f
End Function

' Status HTTP login; 0 bila tidak tersambung (alasannya di mGalat), -1 bila
' server menjawab sukses tetapi tidak memberi sesi.
Private Function CobaMasuk(ByVal user As String, ByVal sandi As String) As Long
    Dim h As Object, token As String

    On Error GoTo GagalSambung
    Set h = BuatPermintaan()
    h.Open "POST", Alamat() & "/api/auth/login", False
    h.SetRequestHeader "Content-Type", "application/json"
    h.Send "{""user"":" & KutipJson(user) & ",""pass"":" & KutipJson(sandi) & "}"
    CobaMasuk = h.Status
    If h.Status = 200 Then
        token = AmbilCookie(h.GetAllResponseHeaders)
        If Len(token) = 0 Then CobaMasuk = -1 Else SaveSetting BAG, "Sesi", "Token", token
    End If
    Exit Function

GagalSambung:
    mGalat = Err.Description
    CobaMasuk = 0
End Function

Private Function AmbilCookie(ByVal kepala As String) As String
    Const NAMA As String = "mrt_session="
    Dim baris As Variant, p As Long, q As Long
    For Each baris In Split(kepala, vbCrLf)
        If LCase$(Left$(baris, 11)) = "set-cookie:" Then
            p = InStr(baris, NAMA)
            If p > 0 Then
                p = p + Len(NAMA)
                q = InStr(p, baris, ";")
                If q = 0 Then q = Len(baris) + 1
                AmbilCookie = Mid$(baris, p, q - p)
                Exit Function
            End If
        End If
    Next baris
End Function

Private Sub HapusToken()
    On Error Resume Next
    DeleteSetting BAG, "Sesi", "Token"
End Sub

' Jawaban server: baris pertama kode, sisanya pesan.
Private Function KodeJawab(ByVal jawab As String) As String
    Dim p As Long
    p = InStr(jawab, vbLf)
    If p = 0 Then KodeJawab = Trim$(jawab) Else KodeJawab = Trim$(Left$(jawab, p - 1))
End Function

Private Function PesanJawab(ByVal jawab As String) As String
    Dim p As Long
    p = InStr(jawab, vbLf)
    If p > 0 Then PesanJawab = Mid$(jawab, p + 1)
End Function

' ---- isi lembar menjadi JSON --------------------------------------------------

Private Function LembarJson(ByVal ws As Worksheet) As String
    Dim akhir As Long, r As Long, c As Long, n As Long
    Dim nilai As Variant, kosong As Boolean, baris() As String
    Dim bagian As String, tebal As String, sel As Range, teks As String

    akhir = ws.UsedRange.Row + ws.UsedRange.Rows.Count - 1
    If akhir > BARIS_MAKS Then akhir = BARIS_MAKS
    If akhir < 2 Then akhir = 2
    ' sel anak gabungan selalu kosong di array ini, jadi otomatis terlewat
    nilai = ws.Range(ws.Cells(1, 1), ws.Cells(akhir, KOLOM_MAKS)).Value2
    ReDim baris(1 To akhir)

    For r = 1 To akhir
        kosong = True
        If Not ws.Rows(r).Hidden Then
            bagian = "": tebal = ""
            For c = 1 To KOLOM_MAKS
                If Not IsEmpty(nilai(r, c)) And Not IsError(nilai(r, c)) Then
                    Set sel = ws.Cells(r, c)
                    teks = NilaiJson(sel, nilai(r, c))
                    If Len(teks) > 0 Then
                        If InStr(1, CStr(nilai(r, c)), "kerangka acuan kerja", vbTextCompare) > 0 Then GoTo Habis
                        If kosong Then kosong = False Else bagian = bagian & ","
                        bagian = bagian & """" & Chr$(64 + c) & """:" & teks
                        If SelTebal(sel) Then tebal = tebal & Chr$(64 + c)
                    End If
                End If
            Next c
            If Not kosong Then
                n = n + 1
                baris(n) = "{""n"":" & r & ",""s"":{" & bagian & "},""b"":""" & tebal & """}"
            End If
        End If
    Next r
Habis:
    If n = 0 Then ReDim baris(1 To 1) Else ReDim Preserve baris(1 To n)
    LembarJson = "{""nama"":" & KutipJson(ws.Name) & ",""berkas"":" & KutipJson(ws.Parent.Name) & _
                 ",""baris"":[" & Join(baris, ",") & "]}"
End Function

Private Function SelTebal(ByVal sel As Range) As Boolean
    Dim b As Variant
    b = sel.Font.Bold
    If IsNull(b) Then SelTebal = True Else SelTebal = CBool(b)
End Function

Private Function NilaiJson(ByVal sel As Range, ByVal v As Variant) As String
    Dim t As String
    If VarType(v) = vbString Then
        If Len(Trim$(v)) > 0 Then NilaiJson = KutipJson(CStr(v))
    ElseIf VarType(v) = vbBoolean Then
        NilaiJson = ""
    ElseIf VarType(sel.Value) = vbDate Then
        NilaiJson = KutipJson(TanggalIndo(sel.Value))
    Else
        t = Trim$(Str$(CDbl(v)))
        If Left$(t, 1) = "." Then t = "0" & t
        If Left$(t, 2) = "-." Then t = "-0" & Mid$(t, 2)
        NilaiJson = t
    End If
End Function

' Selalu nama bulan Indonesia supaya tidak bergantung pada pengaturan wilayah Windows.
Private Function TanggalIndo(ByVal d As Date) As String
    TanggalIndo = Day(d) & " " & Split("Januari Februari Maret April Mei Juni Juli Agustus " & _
                  "September Oktober November Desember")(Month(d) - 1) & " " & Year(d)
End Function

Private Function KutipJson(ByVal s As String) As String
    Dim i As Long, k As Long, b() As String
    If Len(s) = 0 Then
        KutipJson = """"""
        Exit Function
    End If
    ReDim b(1 To Len(s))
    For i = 1 To Len(s)
        k = AscW(Mid$(s, i, 1)) And &HFFFF&
        Select Case k
            Case 34: b(i) = "\"""
            Case 92: b(i) = "\\"
            Case 32 To 126: b(i) = ChrW$(k)
            Case Else: b(i) = "\u" & Right$("0000" & LCase$(Hex$(k)), 4)
        End Select
    Next i
    KutipJson = """" & Join(b, "") & """"
End Function

' Pintu untuk skrip uji: tanpa kotak dialog. Mengembalikan jawaban mentah server.
Public Function MintaLembar(ByVal aksi As String, ByVal namaLembar As String, _
                            Optional ByVal jenis As String = "") As String
    Dim jawab As String
    If Minta(aksi, LembarJson(ThisWorkbook.Worksheets(namaLembar)), jawab, jenis) Then MintaLembar = jawab
End Function
