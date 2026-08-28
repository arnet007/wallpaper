@echo off
cd /d "%~dp0"
echo Rotating Instagram Desktop Wallpaper via AnonyIG...
node wallpaper.js %*
if errorlevel 1 (
    echo.
    echo An error occurred while setting the wallpaper.
    pause
)
