@echo off
title Otomatisasi Dokumen Teknik ASDP - Server (port 3001)
cd /d "D:\ASDP\02. PROJEK\files\generator-swakelola"

rem Build sekali jika belum ada hasil build
if not exist ".next\BUILD_ID" (
  echo Membuild aplikasi pertama kali... >> server.log
  call npm run build >> server.log 2>&1
)

echo [%date% %time%] Menjalankan server di http://localhost:3001 >> server.log
call npm run start >> server.log 2>&1
