Add-Type -AssemblyName System.Drawing

function Save-CircleIcon([string]$SrcPath, [string]$DestPath, [int]$Size) {
  $src = [System.Drawing.Image]::FromFile($SrcPath)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::White)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, $Size, $Size)
  $g.SetClip($path)
  $padding = [int]($Size * 0.12)
  $inner = $Size - (2 * $padding)
  $scale = [Math]::Min($inner / $src.Width, $inner / $src.Height)
  $w = [int]($src.Width * $scale)
  $h = [int]($src.Height * $scale)
  $x = [int](($Size - $w) / 2)
  $y = [int](($Size - $h) / 2)
  $g.DrawImage($src, $x, $y, $w, $h)
  $g.Dispose()
  $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $src.Dispose()
}

$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "public\logo.png"
Save-CircleIcon $src (Join-Path $root "public\favicon.png") 512
Save-CircleIcon $src (Join-Path $root "public\apple-touch-icon.png") 180
Save-CircleIcon $src (Join-Path $root "public\icons\icon-192.png") 192
Save-CircleIcon $src (Join-Path $root "app\icon.png") 512
Write-Host "Circle icons written under $root"
