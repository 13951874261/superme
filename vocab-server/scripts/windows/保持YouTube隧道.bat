@echo off
chcp 65001 >nul
title Super-Agent YouTube 隧道保活
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-youtube-oneclick.ps1" -Mode tunnel
