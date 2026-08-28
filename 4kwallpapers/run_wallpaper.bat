@echo off
cd /d "%~dp0"
echo ===================================================================
echo        4K Wallpapers - Random Nature Wallpaper Changer
echo ===================================================================
echo.
node wallpaper.js %*
echo.
if "%~1"=="" timeout /t 5
