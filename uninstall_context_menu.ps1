$locations = @(
    "HKCU:\Software\Classes\DesktopBackground\Shell\WallpaperChanger",
    "HKCU:\Software\Classes\Directory\Background\shell\WallpaperChanger"
)

foreach ($loc in $locations) {
    if (Test-Path $loc) {
        Remove-Item -Path $loc -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "==============================================================="
Write-Host " [OK] Desktop Right-Click Context Menu Uninstalled Successfully."
Write-Host "==============================================================="
