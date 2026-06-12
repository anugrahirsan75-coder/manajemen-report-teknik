' Watchdog server ASDP (port 3001): kalau mati -> hidupkan lagi (tanpa jendela).
' Dipanggil Scheduled Task "ASDP Server Watchdog" tiap 5 menit.
Set sh = CreateObject("WScript.Shell")
rc = sh.Run("cmd /c netstat -ano | findstr "":3001"" | findstr LISTENING >nul", 0, True)
If rc <> 0 Then
  sh.Run """D:\ASDP\02. PROJEK\files\generator-swakelola\start-server.bat""", 0, False
End If
