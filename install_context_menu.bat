@echo off
title Install Desktop Context Menu
echo ===============================================================
echo     Installing Right-Click Desktop Wallpaper Context Menu
echo ===============================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0install_context_menu.ps1"
echo.
pause
