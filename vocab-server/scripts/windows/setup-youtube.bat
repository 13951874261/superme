@echo off
chcp 65001 >nul
title Super-Agent YouTube 一键配置
cd /d "%~dp0"
echo.
echo  正在启动 YouTube 一键配置...
echo  请确保：1) Clash 已打开  2) Chrome 已登录 YouTube
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-youtube-oneclick.ps1" -Mode full
echo.
pause
