@echo off
title Facebook One-Time Cookie Login
echo ===================================================================
echo             Facebook One-Time Cookie Login Activity
echo ===================================================================
echo.
echo This opens a browser window where you can log in to Facebook once.
echo Your session cookies will be saved to cookies.json.
echo.
echo After this, you will NEVER need Chrome Developer Mode, port 9222,
echo or to log in again!
echo.
pause
node wallpaper.js --login
echo.
pause
