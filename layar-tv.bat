@echo off
rem ===================================================================
rem  PAPAN MONITOR SERTIFIKAT — untuk laptop/PC yang disambung ke TV
rem
rem  Peramban bawaan TV LG mematikan layarnya sendiri sesudah beberapa
rem  menit tanpa tombol remote ditekan, dan itu tidak bisa dicegah dari
rem  halaman web. Jadi yang menampilkan papan ini komputer, TV cuma jadi
rem  layarnya — lewat kabel HDMI atau Screen Share.
rem
rem  Berkas ini melakukan dua hal:
rem   1. mematikan seluruh pengatur tidur Windows selama tercolok listrik
rem   2. membuka papan monitor dalam mode layar penuh tanpa alamat & menu
rem
rem  CARA PAKAI          : klik dua kali berkas ini.
rem  KELUAR DARI LAYAR   : tekan Alt + F4.
rem  AGAR JALAN SENDIRI  : tekan Win + R, ketik  shell:startup  , lalu
rem                        salin PINTASAN berkas ini ke folder yang
rem                        terbuka. Begitu listrik nyala dan Windows
rem                        masuk, papan langsung tampil tanpa disentuh.
rem ===================================================================

echo Mematikan pengatur tidur Windows...
rem 0 = tidak pernah. Hanya saat tercolok listrik (-ac), setelan baterai
rem dibiarkan apa adanya supaya laptop tetap hemat waktu dibawa pergi.
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

rem Laptop yang layarnya ditutup jangan ikut tidur — papannya keluar di TV.
powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1

set PAPAN=https://manajemen-report-teknik.vercel.app/layar-sertifikat

rem Kiosk = layar penuh tanpa bilah alamat, tab, atau menu — tidak ada yang
rem bisa tersenggol. Pemeriksaan pembaruan dijauhkan supaya tidak ada kotak
rem pesan yang muncul menutupi papan di tengah jam kerja.
set BENDERA=--kiosk --noerrdialogs --disable-session-crashed-bubble --disable-infobars --check-for-update-interval=31536000 --autoplay-policy=no-user-gesture-required

echo Membuka papan monitor...

set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% goto :buka
set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% goto :buka
set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% goto :buka

rem Tidak ada Chrome — Edge selalu ada di Windows 10/11 dan sama-sama bisa kiosk.
set CHROME="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist %CHROME% goto :buka
set CHROME="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist %CHROME% goto :buka

echo.
echo Chrome maupun Edge tidak ditemukan. Buka alamat ini sendiri lalu tekan F11:
echo   %PAPAN%
echo.
pause
exit /b 1

:buka
start "" %CHROME% %BENDERA% %PAPAN%
exit /b 0
