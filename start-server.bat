@echo off
title Otomatisasi Dokumen Teknik ASDP - Server (port 3001)
cd /d "D:\ASDP\02. PROJEK\files\generator-swakelola"

rem Build sekali jika belum ada hasil build
if not exist ".next\BUILD_ID" (
  echo Membuild aplikasi pertama kali...
  call npm run build
)

echo Menjalankan server di http://localhost:3001
call npm run start
pause
