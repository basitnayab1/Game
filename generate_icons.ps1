Add-Type -AssemblyName System.Drawing

$sourcePath = "src\assets\branding\n5_crown_emblem.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source emblem not found at $sourcePath"
    exit 1
}

$sourceImg = [System.Drawing.Bitmap]::FromFile((Resolve-Path $sourcePath).Path)

# Standard icon densities and sizes
$densities = @{
    "mipmap-mdpi"    = @{ iconSize = 48;  fgSize = 108 }
    "mipmap-hdpi"    = @{ iconSize = 72;  fgSize = 162 }
    "mipmap-xhdpi"   = @{ iconSize = 96;  fgSize = 216 }
    "mipmap-xxhdpi"  = @{ iconSize = 144; fgSize = 324 }
    "mipmap-xxxhdpi" = @{ iconSize = 192; fgSize = 432 }
}

$baseResDir = "src\android\app\src\main\res"

foreach ($d in $densities.Keys) {
    $targetDir = Join-Path $baseResDir $d
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    $iconSize = $densities[$d].iconSize
    $fgSize   = $densities[$d].fgSize

    # 1. Create standard legacy ic_launcher.png & ic_launcher_round.png
    $iconBmp = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
    $g = [System.Drawing.Graphics]::FromImage($iconBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Black)
    $g.DrawImage($sourceImg, 0, 0, $iconSize, $iconSize)
    $g.Dispose()

    $launcherPath = Join-Path $targetDir "ic_launcher.png"
    $roundPath = Join-Path $targetDir "ic_launcher_round.png"
    $iconBmp.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()

    # 2. Create adaptive foreground ic_launcher_foreground.png
    # Safe zone is 72dp inside 108dp (approx 70% scale centered)
    $fgBmp = New-Object System.Drawing.Bitmap($fgSize, $fgSize)
    $gFg = [System.Drawing.Graphics]::FromImage($fgBmp)
    $gFg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gFg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gFg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gFg.Clear([System.Drawing.Color]::Transparent)

    $innerSize = [int][Math]::Round($fgSize * 0.72)
    $offset = [int][Math]::Round(($fgSize - $innerSize) / 2)
    $gFg.DrawImage($sourceImg, $offset, $offset, $innerSize, $innerSize)
    $gFg.Dispose()

    $fgPath = Join-Path $targetDir "ic_launcher_foreground.png"
    $fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()

    Write-Output "Generated icons for $($d): icon=${iconSize}x${iconSize}, fg=${fgSize}x${fgSize}"
}

$sourceImg.Dispose()
Write-Output "All mipmap icon assets successfully generated!"
