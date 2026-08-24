@echo off
title Uninstall Desktop Context Menu
echo ===============================================================
echo     Uninstalling Right-Click Desktop Wallpaper Context Menu
echo ===============================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0uninstall_context_menu.ps1"
echo.
pause
