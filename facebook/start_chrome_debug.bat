@echo off
title Launch Chrome with Facebook Session (Remote Debugging)
echo ===================================================================
echo   Starting Google Chrome with Remote Debugging (Port 9222)
echo ===================================================================
echo.
echo This opens Chrome using your existing profile and login credentials,
echo allowing the wallpaper script to access your Facebook session.
echo.

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME_PATH% (
    set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if not exist %CHROME_PATH% (
    set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

:: Check if Chrome is currently running
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I /N "chrome.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [!] Chrome is currently running without remote debugging.
    echo [!] Closing existing Chrome instances to enable port 9222...
    echo [!] (Your open tabs will be restored automatically via --restore-last-session)
    echo.
    taskkill /F /IM chrome.exe >NUL 2>&1
    timeout /t 2 >NUL
)

echo Launching Chrome with remote debugging on port 9222...
start "" %CHROME_PATH% --remote-debugging-port=9222 --restore-last-session

echo.
echo ===================================================================
echo [OK] Chrome is now running with Remote Debugging on port 9222!
echo [OK] You can now run "node wallpaper.js" to scrape and set wallpapers.
echo ===================================================================
echo.
timeout /t 5
