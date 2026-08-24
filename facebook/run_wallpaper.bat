@echo off
cd /d "%~dp0"
echo ===================================================
echo        Facebook Desktop Wallpaper Changer
echo ===================================================
echo.
node wallpaper.js %*
echo.
if "%~1"=="" timeout /t 5
