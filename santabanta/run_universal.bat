@echo off
cd /d "%~dp0"
echo ===================================================================
echo     SantaBanta Universal Random Wallpaper Changer
echo ===================================================================
echo.
node universal.js %*
echo.
if "%~1"=="" timeout /t 5
