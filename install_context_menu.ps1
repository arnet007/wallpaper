# Context-menu installer for the wallpaper changer suite
# Creates a right-click menu on the Desktop background:
#   Change Desktop Wallpaper
#     ├─ Facebook   ── Next Wallpaper / Status / Re-scrape / Open Wallpapers / Edit Profiles
#     └─ SantaBanta ── Next Random / Cars / Nature / Outdoors / Bollywood / Status / Open Wallpapers / Edit Categories
#
# Uses the Windows CommandStore so nested flyout submenus render reliably.

$rootDir = $PSScriptRoot
$fbSilentVbs = Join-Path $rootDir "facebook\run_silent.vbs"
$fbVisibleVbs = Join-Path $rootDir "facebook\run_visible.vbs"
$fbScript = Join-Path $rootDir "facebook\wallpaper.js"
$sbSilentVbs = Join-Path $rootDir "santabanta\run_silent.vbs"
$sbVisibleVbs = Join-Path $rootDir "santabanta\run_visible.vbs"
$sbScript = Join-Path $rootDir "santabanta\universal.js"

$fbWallpapersDir = Join-Path $rootDir "facebook\wallpapers"
$sbWallpapersDir = Join-Path $rootDir "santabanta\wallpapers"
$profilesFile = Join-Path $rootDir "facebook\profiles.txt"
$categoriesFile = Join-Path $rootDir "santabanta\categories.txt"

# ---------------------------------------------------------------------------
# CommandStore entries (actual menu items & flyouts)
# ---------------------------------------------------------------------------
$store = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\CommandStore\shell"

function New-MenuItem {
    param(
        [string]$Id,
        [string]$Label,
        [string]$Command,
        [string]$Icon = ""
    )
    $path = "$store\$Id"
    New-Item -Path "$path\command" -Force | Out-Null
    Set-ItemProperty -Path $path -Name "MUIVerb" -Value $Label -Force
    if ($Icon) { Set-ItemProperty -Path $path -Name "Icon" -Value $Icon -Force }
    Set-ItemProperty -Path "$path\command" -Name "(Default)" -Value $Command -Force
}

function New-SubMenu {
    param(
        [string]$Id,
        [string]$Label,
        [string[]]$SubCommands,
        [string]$Icon = ""
    )
    $path = "$store\$Id"
    New-Item -Path $path -Force | Out-Null
    Set-ItemProperty -Path $path -Name "MUIVerb" -Value $Label -Force
    if ($Icon) { Set-ItemProperty -Path $path -Name "Icon" -Value $Icon -Force }
    Set-ItemProperty -Path $path -Name "SubCommands" -Value ($SubCommands -join ';') -Force
}

# --- Facebook flyout + items ---
New-SubMenu -Id "wpc_fb" -Label "Facebook" -Icon "imageres.dll,117" -SubCommands @(
    "wpc_fb_next", "wpc_fb_status", "wpc_fb_rescrape", "wpc_fb_open", "wpc_fb_edit"
)
New-MenuItem -Id "wpc_fb_next" -Label "Next Facebook Wallpaper" -Icon "imageres.dll,117" -Command "wscript.exe `"$fbSilentVbs`" `"$fbScript`""
New-MenuItem -Id "wpc_fb_status" -Label "Facebook Status" -Icon "imageres.dll,118" -Command "wscript.exe `"$fbVisibleVbs`" `"$fbScript`" --status"
New-MenuItem -Id "wpc_fb_rescrape" -Label "Re-scrape Facebook (High-Res)" -Icon "imageres.dll,119" -Command "wscript.exe `"$fbVisibleVbs`" `"$fbScript`" --force-scrape"
New-MenuItem -Id "wpc_fb_open" -Label "Open Downloaded Wallpapers" -Icon "shell32.dll,220" -Command "explorer.exe `"$fbWallpapersDir`""
New-MenuItem -Id "wpc_fb_edit" -Label "Edit Facebook Profiles (profiles.txt)" -Icon "notepad.exe,0" -Command "notepad.exe `"$profilesFile`""

# --- SantaBanta flyout + items ---
New-SubMenu -Id "wpc_sb" -Label "SantaBanta" -Icon "imageres.dll,201" -SubCommands @(
    "wpc_sb_next", "wpc_sb_cars", "wpc_sb_nature", "wpc_sb_outdoors",
    "wpc_sb_bollywood", "wpc_sb_status", "wpc_sb_open", "wpc_sb_edit"
)
New-MenuItem -Id "wpc_sb_next" -Label "Next SantaBanta (Random)" -Icon "imageres.dll,201" -Command "wscript.exe `"$sbSilentVbs`" `"$sbScript`""
New-MenuItem -Id "wpc_sb_cars" -Label "Cars" -Icon "imageres.dll,202" -Command "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"cars`""
New-MenuItem -Id "wpc_sb_nature" -Label "Nature" -Icon "imageres.dll,203" -Command "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"nature`""
New-MenuItem -Id "wpc_sb_outdoors" -Label "Outdoors" -Icon "imageres.dll,204" -Command "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"outdoors`""
New-MenuItem -Id "wpc_sb_bollywood" -Label "Bollywood" -Icon "imageres.dll,205" -Command "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"bollywood-movies`""
New-MenuItem -Id "wpc_sb_status" -Label "SantaBanta Status" -Icon "imageres.dll,206" -Command "wscript.exe `"$sbVisibleVbs`" `"$sbScript`" --status"
New-MenuItem -Id "wpc_sb_open" -Label "Open Downloaded Wallpapers" -Icon "shell32.dll,221" -Command "explorer.exe `"$sbWallpapersDir`""
New-MenuItem -Id "wpc_sb_edit" -Label "Edit SantaBanta Categories (categories.txt)" -Icon "notepad.exe,0" -Command "notepad.exe `"$categoriesFile`""

# ---------------------------------------------------------------------------
# Root cascading verb on Desktop background + Folder background
# ---------------------------------------------------------------------------
$locations = @(
    "HKCU:\Software\Classes\DesktopBackground\Shell\WallpaperChanger",
    "HKCU:\Software\Classes\Directory\Background\Shell\WallpaperChanger"
)

foreach ($loc in $locations) {
    New-Item -Path $loc -Force | Out-Null
    Set-ItemProperty -Path $loc -Name "MUIVerb" -Value "Change Desktop Wallpaper" -Force
    Set-ItemProperty -Path $loc -Name "SubCommands" -Value "wpc_fb;wpc_sb" -Force
    Set-ItemProperty -Path $loc -Name "Icon" -Value "imageres.dll,110" -Force
}

Write-Host ""
Write-Host "==============================================================="
Write-Host " [OK] Right-click Context Menu Installed!"
Write-Host " Right-click Desktop -> Change Desktop Wallpaper"
Write-Host "==============================================================="