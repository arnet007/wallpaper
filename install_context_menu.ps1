# Context-menu installer for the wallpaper changer suite
# Creates a right-click menu on the Desktop background:
#   Change Desktop Wallpaper
#     ├─ Next Facebook Wallpaper / Status / Re-scrape / Open Wallpapers / Edit Profiles
#     └─ Next SantaBanta (Random) / Cars / Nature / Outdoors / Bollywood / Status / Open / Edit
#
# Uses the classic flat Shell\NN_Name\command structure, which renders
# reliably on DesktopBackground context menus.

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

# Root registry locations
$locations = @(
    "HKCU:\Software\Classes\DesktopBackground\Shell\WallpaperChanger",
    "HKCU:\Software\Classes\Directory\Background\Shell\WallpaperChanger"
)

foreach ($loc in $locations) {

    # --- Root "Change Desktop Wallpaper" cascading menu ---
    New-Item -Path $loc -Force | Out-Null
    Set-ItemProperty -Path $loc -Name "MUIVerb" -Value "Change Desktop Wallpaper" -Force
    Set-ItemProperty -Path $loc -Name "SubCommands" -Value "" -Force
    Set-ItemProperty -Path $loc -Name "Icon" -Value "imageres.dll,110" -Force

    # =============================================
    # Facebook items
    # =============================================

    # 01 - Next Facebook Wallpaper (silent)
    $fbNext = "$loc\Shell\01_FacebookNext"
    New-Item -Path "$fbNext\command" -Force | Out-Null
    Set-ItemProperty -Path $fbNext -Name "MUIVerb" -Value "Next Facebook Wallpaper" -Force
    Set-ItemProperty -Path $fbNext -Name "Icon" -Value "imageres.dll,117" -Force
    Set-ItemProperty -Path "$fbNext\command" -Name "(Default)" -Value "wscript.exe `"$fbSilentVbs`" `"$fbScript`"" -Force

    # 02 - Facebook Status (visible)
    $fbStatus = "$loc\Shell\02_FacebookStatus"
    New-Item -Path "$fbStatus\command" -Force | Out-Null
    Set-ItemProperty -Path $fbStatus -Name "MUIVerb" -Value "Facebook Status" -Force
    Set-ItemProperty -Path $fbStatus -Name "Icon" -Value "imageres.dll,118" -Force
    Set-ItemProperty -Path "$fbStatus\command" -Name "(Default)" -Value "wscript.exe `"$fbVisibleVbs`" `"$fbScript`" --status" -Force

    # 03 - Re-scrape Facebook (visible)
    $fbScrape = "$loc\Shell\03_FacebookRescrape"
    New-Item -Path "$fbScrape\command" -Force | Out-Null
    Set-ItemProperty -Path $fbScrape -Name "MUIVerb" -Value "Re-scrape Facebook (High-Res)" -Force
    Set-ItemProperty -Path $fbScrape -Name "Icon" -Value "imageres.dll,119" -Force
    Set-ItemProperty -Path "$fbScrape\command" -Name "(Default)" -Value "wscript.exe `"$fbVisibleVbs`" `"$fbScript`" --force-scrape" -Force

    # 04 - Open Facebook wallpapers folder
    $fbOpen = "$loc\Shell\04_FacebookOpen"
    New-Item -Path "$fbOpen\command" -Force | Out-Null
    Set-ItemProperty -Path $fbOpen -Name "MUIVerb" -Value "Open Facebook Wallpapers" -Force
    Set-ItemProperty -Path $fbOpen -Name "Icon" -Value "shell32.dll,220" -Force
    Set-ItemProperty -Path "$fbOpen\command" -Name "(Default)" -Value "explorer.exe `"$fbWallpapersDir`"" -Force

    # 05 - Edit Facebook profiles.txt
    $fbEdit = "$loc\Shell\05_FacebookEdit"
    New-Item -Path "$fbEdit\command" -Force | Out-Null
    Set-ItemProperty -Path $fbEdit -Name "MUIVerb" -Value "Edit Facebook Profiles (profiles.txt)" -Force
    Set-ItemProperty -Path $fbEdit -Name "Icon" -Value "notepad.exe,0" -Force
    Set-ItemProperty -Path "$fbEdit\command" -Name "(Default)" -Value "notepad.exe `"$profilesFile`"" -Force

    # =============================================
    # SantaBanta items
    # =============================================

    # 06 - Next SantaBanta Random (silent)
    $sbNext = "$loc\Shell\06_SantaBantaNext"
    New-Item -Path "$sbNext\command" -Force | Out-Null
    Set-ItemProperty -Path $sbNext -Name "MUIVerb" -Value "Next SantaBanta (Random)" -Force
    Set-ItemProperty -Path $sbNext -Name "Icon" -Value "imageres.dll,201" -Force
    Set-ItemProperty -Path "$sbNext\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`"" -Force

    # 07 - SantaBanta Cars (silent)
    $sbCars = "$loc\Shell\07_SantaBantaCars"
    New-Item -Path "$sbCars\command" -Force | Out-Null
    Set-ItemProperty -Path $sbCars -Name "MUIVerb" -Value "SantaBanta - Cars" -Force
    Set-ItemProperty -Path $sbCars -Name "Icon" -Value "imageres.dll,202" -Force
    Set-ItemProperty -Path "$sbCars\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"cars`"" -Force

    # 08 - SantaBanta Nature (silent)
    $sbNature = "$loc\Shell\08_SantaBantaNature"
    New-Item -Path "$sbNature\command" -Force | Out-Null
    Set-ItemProperty -Path $sbNature -Name "MUIVerb" -Value "SantaBanta - Nature" -Force
    Set-ItemProperty -Path $sbNature -Name "Icon" -Value "imageres.dll,203" -Force
    Set-ItemProperty -Path "$sbNature\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"nature`"" -Force

    # 09 - SantaBanta Outdoors (silent)
    $sbOutdoors = "$loc\Shell\09_SantaBantaOutdoors"
    New-Item -Path "$sbOutdoors\command" -Force | Out-Null
    Set-ItemProperty -Path $sbOutdoors -Name "MUIVerb" -Value "SantaBanta - Outdoors" -Force
    Set-ItemProperty -Path $sbOutdoors -Name "Icon" -Value "imageres.dll,204" -Force
    Set-ItemProperty -Path "$sbOutdoors\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"outdoors`"" -Force

    # 10 - SantaBanta Bollywood (silent)
    $sbBolly = "$loc\Shell\10_SantaBantaBollywood"
    New-Item -Path "$sbBolly\command" -Force | Out-Null
    Set-ItemProperty -Path $sbBolly -Name "MUIVerb" -Value "SantaBanta - Bollywood" -Force
    Set-ItemProperty -Path $sbBolly -Name "Icon" -Value "imageres.dll,205" -Force
    Set-ItemProperty -Path "$sbBolly\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"bollywood-movies`"" -Force

    # 11 - SantaBanta Status (visible)
    $sbStatus = "$loc\Shell\11_SantaBantaStatus"
    New-Item -Path "$sbStatus\command" -Force | Out-Null
    Set-ItemProperty -Path $sbStatus -Name "MUIVerb" -Value "SantaBanta Status" -Force
    Set-ItemProperty -Path $sbStatus -Name "Icon" -Value "imageres.dll,206" -Force
    Set-ItemProperty -Path "$sbStatus\command" -Name "(Default)" -Value "wscript.exe `"$sbVisibleVbs`" `"$sbScript`" --status" -Force

    # 12 - Open SantaBanta wallpapers folder
    $sbOpen = "$loc\Shell\12_SantaBantaOpen"
    New-Item -Path "$sbOpen\command" -Force | Out-Null
    Set-ItemProperty -Path $sbOpen -Name "MUIVerb" -Value "Open SantaBanta Wallpapers" -Force
    Set-ItemProperty -Path $sbOpen -Name "Icon" -Value "shell32.dll,221" -Force
    Set-ItemProperty -Path "$sbOpen\command" -Name "(Default)" -Value "explorer.exe `"$sbWallpapersDir`"" -Force

    # 13 - Edit SantaBanta categories.txt
    $sbEdit = "$loc\Shell\13_SantaBantaEdit"
    New-Item -Path "$sbEdit\command" -Force | Out-Null
    Set-ItemProperty -Path $sbEdit -Name "MUIVerb" -Value "Edit SantaBanta Categories (categories.txt)" -Force
    Set-ItemProperty -Path $sbEdit -Name "Icon" -Value "notepad.exe,0" -Force
    Set-ItemProperty -Path "$sbEdit\command" -Name "(Default)" -Value "notepad.exe `"$categoriesFile`"" -Force

}

Write-Host ""
Write-Host "==============================================================="
Write-Host " [OK] Right-click Context Menu Installed!"
Write-Host " Right-click Desktop -> Change Desktop Wallpaper"
Write-Host "==============================================================="