@echo off
chcp 65001 >nul
title Super-Agent YouTube Tunnel
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-youtube-oneclick.ps1" -Mode tunnel
