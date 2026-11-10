Add-Type -AssemblyName System.Drawing
function MakeSquare($srcPath, $dstPath, $sz) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.Clear([System.Drawing.Color]::White)
    $r = [Math]::Min($sz / $src.Width, $sz / $src.Height)
    $w = [int]($src.Width * $r * 0.85)
    $h = [int]($src.Height * $r * 0.85)
    $x = [int](($sz - $w) / 2)
    $y = [int](($sz - $h) / 2)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, $x, $y, $w, $h)
    $dest.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()
    Write-Host "Created $dstPath ($sz x $sz)"
}
$base = Get-Location
MakeSquare "$base/public/funaab-logo.png" "$base/public/icon-192.png" 192
MakeSquare "$base/public/funaab-logo.png" "$base/public/icon-512.png" 512
