$rootDir = $PSScriptRoot
$fbVbs = Join-Path $rootDir "facebook\run_silent.vbs"
$fbScript = Join-Path $rootDir "facebook\wallpaper.js"
$sbVbs = Join-Path $rootDir "santabanta\run_silent.vbs"
$sbScript = Join-Path $rootDir "santabanta\universal.js"

$locations = @(
    "HKCU:\Software\Classes\DesktopBackground\Shell\WallpaperChanger",
    "HKCU:\Software\Classes\Directory\Background\shell\WallpaperChanger"
)

foreach ($loc in $locations) {
    # Create Root Cascading Menu
    New-Item -Path $loc -Force | Out-Null
    Set-ItemProperty -Path $loc -Name "MUIVerb" -Value "Change Desktop Wallpaper" -Force
    Set-ItemProperty -Path $loc -Name "SubCommands" -Value "" -Force
    Set-ItemProperty -Path $loc -Name "Icon" -Value "imageres.dll,110" -Force

    # 1. Facebook Wallpaper
    $fb = "$loc\Shell\01_Facebook"
    New-Item -Path "$fb\command" -Force | Out-Null
    Set-ItemProperty -Path $fb -Name "MUIVerb" -Value "Next Facebook Wallpaper" -Force
    Set-ItemProperty -Path $fb -Name "Icon" -Value "imageres.dll,117" -Force
    Set-ItemProperty -Path "$fb\command" -Name "(Default)" -Value "wscript.exe `"$fbVbs`" `"$fbScript`"" -Force

    # 2. SantaBanta Random
    $sb = "$loc\Shell\02_SantaBantaRandom"
    New-Item -Path "$sb\command" -Force | Out-Null
    Set-ItemProperty -Path $sb -Name "MUIVerb" -Value "Next SantaBanta Wallpaper (Random)" -Force
    Set-ItemProperty -Path $sb -Name "Icon" -Value "imageres.dll,118" -Force
    Set-ItemProperty -Path "$sb\command" -Name "(Default)" -Value "wscript.exe `"$sbVbs`" `"$sbScript`"" -Force

    # 3. SantaBanta Outdoors
    $sbOut = "$loc\Shell\03_SantaBantaOutdoors"
    New-Item -Path "$sbOut\command" -Force | Out-Null
    Set-ItemProperty -Path $sbOut -Name "MUIVerb" -Value "Next SantaBanta (Outdoors)" -Force
    Set-ItemProperty -Path $sbOut -Name "Icon" -Value "imageres.dll,119" -Force
    Set-ItemProperty -Path "$sbOut\command" -Name "(Default)" -Value "wscript.exe `"$sbVbs`" `"$sbScript`" `"outdoors`"" -Force

    # 4. SantaBanta Cars
    $sbCars = "$loc\Shell\04_SantaBantaCars"
    New-Item -Path "$sbCars\command" -Force | Out-Null
    Set-ItemProperty -Path $sbCars -Name "MUIVerb" -Value "Next SantaBanta (Cars)" -Force
    Set-ItemProperty -Path $sbCars -Name "Icon" -Value "imageres.dll,120" -Force
    Set-ItemProperty -Path "$sbCars\command" -Name "(Default)" -Value "wscript.exe `"$sbVbs`" `"$sbScript`" `"cars`"" -Force

    # 5. SantaBanta Nature
    $sbNature = "$loc\Shell\05_SantaBantaNature"
    New-Item -Path "$sbNature\command" -Force | Out-Null
    Set-ItemProperty -Path $sbNature -Name "MUIVerb" -Value "Next SantaBanta (Nature)" -Force
    Set-ItemProperty -Path $sbNature -Name "Icon" -Value "imageres.dll,121" -Force
    Set-ItemProperty -Path "$sbNature\command" -Name "(Default)" -Value "wscript.exe `"$sbVbs`" `"$sbScript`" `"nature`"" -Force
}

Write-Host "==============================================================="
Write-Host " [OK] Desktop Right-Click Context Menu Installed Successfully!"
Write-Host " Right-click on your Desktop background to see 'Change Desktop Wallpaper'."
Write-Host "==============================================================="