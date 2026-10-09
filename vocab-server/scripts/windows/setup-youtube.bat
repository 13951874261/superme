@echo off
chcp 65001 >nul
title Super-Agent YouTube Setup
cd /d "%~dp0"
echo.
echo  Starting YouTube one-click setup...
echo  Please: 1) Clash ON  2) Chrome logged into YouTube
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-youtube-oneclick.ps1" -Mode full
echo.
pause
