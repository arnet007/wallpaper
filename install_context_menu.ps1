# Context-menu installer for the wallpaper changer suite
# Creates a right-click menu on the Desktop background:
#   Change Desktop Wallpaper
#     ├─ Next Instagram Wallpaper / Status / Re-scrape / Open Wallpapers / Edit Profiles (AnonyIG)
#     ├─ Next Facebook Wallpaper / Status / Re-scrape / Open Wallpapers / Edit Profiles
#     └─ Next SantaBanta (Random) / Indian Celebrities (Female) / Bollywood / Cars / Nature / Outdoors / Status / Open / Edit
#
# Uses the classic flat Shell\NN_Name\command structure, which renders
# reliably on DesktopBackground context menus.

$rootDir = $PSScriptRoot

# Instagram (AnonyIG)
$igSilentVbs = Join-Path $rootDir "anonyig\run_silent.vbs"
$igVisibleVbs = Join-Path $rootDir "anonyig\run_visible.vbs"
$igScript = Join-Path $rootDir "anonyig\wallpaper.js"
$igWallpapersDir = Join-Path $rootDir "anonyig\wallpapers"
$igProfilesFile = Join-Path $rootDir "anonyig\profiles.txt"

# Facebook
$fbSilentVbs = Join-Path $rootDir "facebook\run_silent.vbs"
$fbVisibleVbs = Join-Path $rootDir "facebook\run_visible.vbs"
$fbScript = Join-Path $rootDir "facebook\wallpaper.js"
$fbWallpapersDir = Join-Path $rootDir "facebook\wallpapers"
$fbProfilesFile = Join-Path $rootDir "facebook\profiles.txt"

# SantaBanta
$sbSilentVbs = Join-Path $rootDir "santabanta\run_silent.vbs"
$sbVisibleVbs = Join-Path $rootDir "santabanta\run_visible.vbs"
$sbScript = Join-Path $rootDir "santabanta\universal.js"
$sbWallpapersDir = Join-Path $rootDir "santabanta\wallpapers"
$sbCategoriesFile = Join-Path $rootDir "santabanta\categories.txt"

# Root registry locations
$locations = @(
    "HKCU:\Software\Classes\DesktopBackground\Shell\WallpaperChanger",
    "HKCU:\Software\Classes\Directory\Background\Shell\WallpaperChanger"
)

foreach ($loc in $locations) {

    # Clean existing menu to prevent stale/orphaned registry entries
    if (Test-Path $loc) {
        Remove-Item -Path $loc -Recurse -Force -ErrorAction SilentlyContinue
    }

    # --- Root "Change Desktop Wallpaper" cascading menu ---
    New-Item -Path $loc -Force | Out-Null
    Set-ItemProperty -Path $loc -Name "MUIVerb" -Value "Change Desktop Wallpaper" -Force
    Set-ItemProperty -Path $loc -Name "SubCommands" -Value "" -Force
    Set-ItemProperty -Path $loc -Name "Icon" -Value "imageres.dll,110" -Force

    # =============================================
    # Instagram (AnonyIG) items
    # =============================================

    # 01 - Next Instagram Wallpaper (silent)
    $igNext = "$loc\Shell\01_InstagramNext"
    New-Item -Path "$igNext\command" -Force | Out-Null
    Set-ItemProperty -Path $igNext -Name "MUIVerb" -Value "Next Instagram Wallpaper" -Force
    Set-ItemProperty -Path $igNext -Name "Icon" -Value "imageres.dll,115" -Force
    Set-ItemProperty -Path "$igNext\command" -Name "(Default)" -Value "wscript.exe `"$igSilentVbs`" `"$igScript`"" -Force

    # 02 - Instagram Status (visible)
    $igStatus = "$loc\Shell\02_InstagramStatus"
    New-Item -Path "$igStatus\command" -Force | Out-Null
    Set-ItemProperty -Path $igStatus -Name "MUIVerb" -Value "Instagram Status" -Force
    Set-ItemProperty -Path $igStatus -Name "Icon" -Value "imageres.dll,116" -Force
    Set-ItemProperty -Path "$igStatus\command" -Name "(Default)" -Value "wscript.exe `"$igVisibleVbs`" `"$igScript`" --status" -Force

    # 03 - Re-scrape Instagram (visible)
    $igScrape = "$loc\Shell\03_InstagramRescrape"
    New-Item -Path "$igScrape\command" -Force | Out-Null
    Set-ItemProperty -Path $igScrape -Name "MUIVerb" -Value "Re-scrape Instagram (AnonyIG)" -Force
    Set-ItemProperty -Path $igScrape -Name "Icon" -Value "imageres.dll,119" -Force
    Set-ItemProperty -Path "$igScrape\command" -Name "(Default)" -Value "wscript.exe `"$igVisibleVbs`" `"$igScript`" --force-scrape" -Force

    # 04 - Open Instagram wallpapers folder
    $igOpen = "$loc\Shell\04_InstagramOpen"
    New-Item -Path "$igOpen\command" -Force | Out-Null
    Set-ItemProperty -Path $igOpen -Name "MUIVerb" -Value "Open Instagram Wallpapers" -Force
    Set-ItemProperty -Path $igOpen -Name "Icon" -Value "shell32.dll,220" -Force
    Set-ItemProperty -Path "$igOpen\command" -Name "(Default)" -Value "explorer.exe `"$igWallpapersDir`"" -Force

    # 05 - Edit Instagram profiles.txt
    $igEdit = "$loc\Shell\05_InstagramEdit"
    New-Item -Path "$igEdit\command" -Force | Out-Null
    Set-ItemProperty -Path $igEdit -Name "MUIVerb" -Value "Edit Instagram Profiles (profiles.txt)" -Force
    Set-ItemProperty -Path $igEdit -Name "Icon" -Value "notepad.exe,0" -Force
    Set-ItemProperty -Path "$igEdit\command" -Name "(Default)" -Value "notepad.exe `"$igProfilesFile`"" -Force

    # =============================================
    # Facebook items
    # =============================================

    # 06 - Next Facebook Wallpaper (silent)
    $fbNext = "$loc\Shell\06_FacebookNext"
    New-Item -Path "$fbNext\command" -Force | Out-Null
    Set-ItemProperty -Path $fbNext -Name "MUIVerb" -Value "Next Facebook Wallpaper" -Force
    Set-ItemProperty -Path $fbNext -Name "Icon" -Value "imageres.dll,117" -Force
    Set-ItemProperty -Path "$fbNext\command" -Name "(Default)" -Value "wscript.exe `"$fbSilentVbs`" `"$fbScript`"" -Force

    # 07 - Facebook Status (visible)
    $fbStatus = "$loc\Shell\07_FacebookStatus"
    New-Item -Path "$fbStatus\command" -Force | Out-Null
    Set-ItemProperty -Path $fbStatus -Name "MUIVerb" -Value "Facebook Status" -Force
    Set-ItemProperty -Path $fbStatus -Name "Icon" -Value "imageres.dll,118" -Force
    Set-ItemProperty -Path "$fbStatus\command" -Name "(Default)" -Value "wscript.exe `"$fbVisibleVbs`" `"$fbScript`" --status" -Force

    # 08 - Re-scrape Facebook (visible)
    $fbScrape = "$loc\Shell\08_FacebookRescrape"
    New-Item -Path "$fbScrape\command" -Force | Out-Null
    Set-ItemProperty -Path $fbScrape -Name "MUIVerb" -Value "Re-scrape Facebook (High-Res)" -Force
    Set-ItemProperty -Path $fbScrape -Name "Icon" -Value "imageres.dll,119" -Force
    Set-ItemProperty -Path "$fbScrape\command" -Name "(Default)" -Value "wscript.exe `"$fbVisibleVbs`" `"$fbScript`" --force-scrape" -Force

    # 09 - Open Facebook wallpapers folder
    $fbOpen = "$loc\Shell\09_FacebookOpen"
    New-Item -Path "$fbOpen\command" -Force | Out-Null
    Set-ItemProperty -Path $fbOpen -Name "MUIVerb" -Value "Open Facebook Wallpapers" -Force
    Set-ItemProperty -Path $fbOpen -Name "Icon" -Value "shell32.dll,220" -Force
    Set-ItemProperty -Path "$fbOpen\command" -Name "(Default)" -Value "explorer.exe `"$fbWallpapersDir`"" -Force

    # 10 - Edit Facebook profiles.txt
    $fbEdit = "$loc\Shell\10_FacebookEdit"
    New-Item -Path "$fbEdit\command" -Force | Out-Null
    Set-ItemProperty -Path $fbEdit -Name "MUIVerb" -Value "Edit Facebook Profiles (profiles.txt)" -Force
    Set-ItemProperty -Path $fbEdit -Name "Icon" -Value "notepad.exe,0" -Force
    Set-ItemProperty -Path "$fbEdit\command" -Name "(Default)" -Value "notepad.exe `"$fbProfilesFile`"" -Force

    # =============================================
    # SantaBanta items
    # =============================================

    # 11 - Next SantaBanta Random (silent)
    $sbNext = "$loc\Shell\11_SantaBantaNext"
    New-Item -Path "$sbNext\command" -Force | Out-Null
    Set-ItemProperty -Path $sbNext -Name "MUIVerb" -Value "Next SantaBanta (Random)" -Force
    Set-ItemProperty -Path $sbNext -Name "Icon" -Value "imageres.dll,201" -Force
    Set-ItemProperty -Path "$sbNext\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`"" -Force

    # 12 - SantaBanta Indian Celebrities (Female) (silent)
    $sbIndianFem = "$loc\Shell\12_SantaBantaIndianCelebrityFemale"
    New-Item -Path "$sbIndianFem\command" -Force | Out-Null
    Set-ItemProperty -Path $sbIndianFem -Name "MUIVerb" -Value "SantaBanta - Indian Celebrities (Female)" -Force
    Set-ItemProperty -Path $sbIndianFem -Name "Icon" -Value "imageres.dll,206" -Force
    Set-ItemProperty -Path "$sbIndianFem\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"indian-celebrities-f`"" -Force

    # 13 - SantaBanta Bollywood (silent)
    $sbBolly = "$loc\Shell\13_SantaBantaBollywood"
    New-Item -Path "$sbBolly\command" -Force | Out-Null
    Set-ItemProperty -Path $sbBolly -Name "MUIVerb" -Value "SantaBanta - Bollywood" -Force
    Set-ItemProperty -Path $sbBolly -Name "Icon" -Value "imageres.dll,205" -Force
    Set-ItemProperty -Path "$sbBolly\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"bollywood-movies`"" -Force

    # 14 - SantaBanta Cars (silent)
    $sbCars = "$loc\Shell\14_SantaBantaCars"
    New-Item -Path "$sbCars\command" -Force | Out-Null
    Set-ItemProperty -Path $sbCars -Name "MUIVerb" -Value "SantaBanta - Cars" -Force
    Set-ItemProperty -Path $sbCars -Name "Icon" -Value "imageres.dll,202" -Force
    Set-ItemProperty -Path "$sbCars\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"cars`"" -Force

    # 15 - SantaBanta Nature (silent)
    $sbNature = "$loc\Shell\15_SantaBantaNature"
    New-Item -Path "$sbNature\command" -Force | Out-Null
    Set-ItemProperty -Path $sbNature -Name "MUIVerb" -Value "SantaBanta - Nature" -Force
    Set-ItemProperty -Path $sbNature -Name "Icon" -Value "imageres.dll,203" -Force
    Set-ItemProperty -Path "$sbNature\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"nature`"" -Force

    # 16 - SantaBanta Outdoors (silent)
    $sbOutdoors = "$loc\Shell\16_SantaBantaOutdoors"
    New-Item -Path "$sbOutdoors\command" -Force | Out-Null
    Set-ItemProperty -Path $sbOutdoors -Name "MUIVerb" -Value "SantaBanta - Outdoors" -Force
    Set-ItemProperty -Path $sbOutdoors -Name "Icon" -Value "imageres.dll,204" -Force
    Set-ItemProperty -Path "$sbOutdoors\command" -Name "(Default)" -Value "wscript.exe `"$sbSilentVbs`" `"$sbScript`" `"outdoors`"" -Force

    # 17 - SantaBanta Status (visible)
    $sbStatus = "$loc\Shell\17_SantaBantaStatus"
    New-Item -Path "$sbStatus\command" -Force | Out-Null
    Set-ItemProperty -Path $sbStatus -Name "MUIVerb" -Value "SantaBanta Status" -Force
    Set-ItemProperty -Path $sbStatus -Name "Icon" -Value "imageres.dll,207" -Force
    Set-ItemProperty -Path "$sbStatus\command" -Name "(Default)" -Value "wscript.exe `"$sbVisibleVbs`" `"$sbScript`" --status" -Force

    # 18 - Open SantaBanta wallpapers folder
    $sbOpen = "$loc\Shell\18_SantaBantaOpen"
    New-Item -Path "$sbOpen\command" -Force | Out-Null
    Set-ItemProperty -Path $sbOpen -Name "MUIVerb" -Value "Open SantaBanta Wallpapers" -Force
    Set-ItemProperty -Path $sbOpen -Name "Icon" -Value "shell32.dll,221" -Force
    Set-ItemProperty -Path "$sbOpen\command" -Name "(Default)" -Value "explorer.exe `"$sbWallpapersDir`"" -Force

    # 19 - Edit SantaBanta categories.txt
    $sbEdit = "$loc\Shell\19_SantaBantaEdit"
    New-Item -Path "$sbEdit\command" -Force | Out-Null
    Set-ItemProperty -Path $sbEdit -Name "MUIVerb" -Value "Edit SantaBanta Categories (categories.txt)" -Force
    Set-ItemProperty -Path $sbEdit -Name "Icon" -Value "notepad.exe,0" -Force
    Set-ItemProperty -Path "$sbEdit\command" -Name "(Default)" -Value "notepad.exe `"$sbCategoriesFile`"" -Force

    # =============================================
    # Wallhere items
    # =============================================

    # 20 - Next Wallhere Random (silent)
    $whNext = "$loc\Shell\20_WallhereNext"
    New-Item -Path "$whNext\command" -Force | Out-Null
    Set-ItemProperty -Path $whNext -Name "MUIVerb" -Value "Next Wallhere Wallpaper (Random)" -Force
    Set-ItemProperty -Path $whNext -Name "Icon" -Value "imageres.dll,108" -Force
    Set-ItemProperty -Path "$whNext\command" -Name "(Default)" -Value "wscript.exe `"$rootDir\wallhere\run_silent.vbs`" `"$rootDir\wallhere\wallhere.js`"" -Force

    # 21 - Wallhere Popular (silent)
    $whPop = "$loc\Shell\21_WallherePopular"
    New-Item -Path "$whPop\command" -Force | Out-Null
    Set-ItemProperty -Path $whPop -Name "MUIVerb" -Value "Wallhere - Popular Wallpapers" -Force
    Set-ItemProperty -Path $whPop -Name "Icon" -Value "imageres.dll,109" -Force
    Set-ItemProperty -Path "$whPop\command" -Name "(Default)" -Value "wscript.exe `"$rootDir\wallhere\run_silent.vbs`" `"$rootDir\wallhere\wallhere.js`" `"--popular`"" -Force

    # 22 - Wallhere Status (visible)
    $whStatus = "$loc\Shell\22_WallhereStatus"
    New-Item -Path "$whStatus\command" -Force | Out-Null
    Set-ItemProperty -Path $whStatus -Name "MUIVerb" -Value "Wallhere Status" -Force
    Set-ItemProperty -Path $whStatus -Name "Icon" -Value "imageres.dll,116" -Force
    Set-ItemProperty -Path "$whStatus\command" -Name "(Default)" -Value "wscript.exe `"$rootDir\wallhere\run_visible.vbs`" `"$rootDir\wallhere\wallhere.js`" `"--status`"" -Force

    # 23 - Open Wallhere wallpapers folder
    $whOpen = "$loc\Shell\23_WallhereOpen"
    New-Item -Path "$whOpen\command" -Force | Out-Null
    Set-ItemProperty -Path $whOpen -Name "MUIVerb" -Value "Open Wallhere Wallpapers" -Force
    Set-ItemProperty -Path $whOpen -Name "Icon" -Value "shell32.dll,220" -Force
    Set-ItemProperty -Path "$whOpen\command" -Name "(Default)" -Value "explorer.exe `"$rootDir\wallhere\wallpapers`"" -Force

}

Write-Host ""
Write-Host "==============================================================="
Write-Host " [OK] Right-click Context Menu Installed!"
Write-Host " Right-click Desktop -> Change Desktop Wallpaper"
Write-Host "   - Instagram (AnonyIG) Wallpapers"
Write-Host "   - Facebook Wallpapers"
Write-Host "   - SantaBanta Wallpapers"
Write-Host "   - Wallhere Wallpapers"
Write-Host "==============================================================="