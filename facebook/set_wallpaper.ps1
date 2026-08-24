param (
    [Parameter(Mandatory=$true)]
    [string]$ImagePath
)

if (-not (Test-Path -Path $ImagePath -PathType Leaf)) {
    Write-Error "File not found: $ImagePath"
    exit 1
}

$resolvedFile = Get-Item -Path $ImagePath
$extension = $resolvedFile.Extension.ToLower()

if ($extension -notin @('.jpg', '.jpeg', '.png', '.bmp')) {
    Write-Error "Invalid image format ($extension). Only .jpg, .jpeg, .png, and .bmp are supported for wallpaper."
    exit 1
}

if ($resolvedFile.Length -lt 1000) {
    Write-Error "Image file is too small or corrupt ($($resolvedFile.Length) bytes)."
    exit 1
}

$fullPath = $resolvedFile.FullName

# Update Registry for persistence
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name wallpaper -Value $fullPath -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value '10' -ErrorAction SilentlyContinue # 10 = Fill, 2 = Stretch, 6 = Fit
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value '0' -ErrorAction SilentlyContinue
} catch {}

# Call Win32 SystemParametersInfo
$code = @"
using System;
using System.Runtime.InteropServices;
public class WallpaperUtil {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
    public static int Set(string path) {
        return SystemParametersInfo(20, 0, path, 0x01 | 0x02);
    }
}
"@

Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
$res = [WallpaperUtil]::Set($fullPath)
if ($res -ne 0) {
    Write-Host "Wallpaper updated successfully to: $fullPath"
} else {
    Write-Error "Failed to update wallpaper."
    exit 1
}
