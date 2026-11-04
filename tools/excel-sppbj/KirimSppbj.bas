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
Private Const KOLOM_JUMLAH As Long = 3     ' C: baris item selalu punya kuantiti
Private Const KOLOM_MA As Long = 11        ' K: pilihan MA per item
Private Const VERSI As Long = 2

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

' ---- pilihan MA per item -------------------------------------------------------

' Daftar pilihan Excel hanya mengisi sel aktif. Supaya tidak memilih satu per
' satu: blok banyak sel lajur MA lalu pilih sekali, baris item yang terblok ikut
' terisi. Baris judul dan baris kosong dilewati.
Public Sub SebarkanMa(ByVal sh As Object, ByVal Target As Range)
    Dim sel As Range, blok As Range

    On Error GoTo Selesai
    If Target.Cells.Count <> 1 Or Target.Column <> KOLOM_MA Then Exit Sub
    If IsEmpty(Target.Value2) Or TypeName(Selection) <> "Range" Then Exit Sub
    Set blok = Selection
    If blok.Parent.Name <> sh.Name Or blok.Cells.Count < 2 Then Exit Sub
    If Intersect(blok, sh.Columns(KOLOM_MA)).Cells.Count <> blok.Cells.Count Then Exit Sub

    Application.EnableEvents = False
    For Each sel In blok.Cells
        If sel.Row <> Target.Row And Not sel.EntireRow.Hidden Then
            If Not IsEmpty(sh.Cells(sel.Row, KOLOM_JUMLAH).Value2) Then sel.Value2 = Target.Value2
        End If
    Next sel
Selesai:
    Application.EnableEvents = True
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
