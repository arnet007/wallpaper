@echo off
cd /d "%~dp0"
echo ===================================================
echo        SantaBanta Desktop Wallpaper Changer
echo ===================================================
echo.
node wallpaper.js %*
echo.
if "%~1"=="" timeout /t 5
