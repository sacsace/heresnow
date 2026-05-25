Add-Type -AssemblyName System.Drawing

function Get-ContentBounds([System.Drawing.Bitmap]$bmp) {
  $minX = $bmp.Width
  $minY = $bmp.Height
  $maxX = 0
  $maxY = 0
  $found = $false
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -gt 200 -and $c.R -lt 80 -and $c.G -lt 80 -and $c.B -lt 100) {
        $found = $true
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if (-not $found) { return $null }
  return @{ X = $minX; Y = $minY; W = ($maxX - $minX + 1); H = ($maxY - $minY + 1) }
}

function Save-NormalizedLogo([string]$SrcPath, [string]$DestPath, [int]$CanvasSize) {
  $srcBmp = New-Object System.Drawing.Bitmap $SrcPath
  $bounds = Get-ContentBounds $srcBmp
  if ($null -eq $bounds) { throw "No logo content found in $SrcPath" }

  $crop = New-Object System.Drawing.Bitmap $bounds.W, $bounds.H
  $cg = [System.Drawing.Graphics]::FromImage($crop)
  $cg.DrawImage($srcBmp, 0, 0, (New-Object System.Drawing.Rectangle $bounds.X, $bounds.Y, $bounds.W, $bounds.H), [System.Drawing.GraphicsUnit]::Pixel)
  $cg.Dispose()

  $out = New-Object System.Drawing.Bitmap $CanvasSize, $CanvasSize
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::White)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $pad = [int]($CanvasSize * 0.08)
  $inner = $CanvasSize - (2 * $pad)
  $scale = [Math]::Min($inner / $bounds.W, $inner / $bounds.H)
  $w = [int]($bounds.W * $scale)
  $h = [int]($bounds.H * $scale)
  $x = [int](($CanvasSize - $w) / 2)
  $y = [int](($CanvasSize - $h) / 2)
  $g.DrawImage($crop, $x, $y, $w, $h)
  $g.Dispose()
  $tmp = [System.IO.Path]::ChangeExtension($DestPath, ".tmp.png")
  $out.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  $crop.Dispose()
  $srcBmp.Dispose()
  if (Test-Path $DestPath) { Remove-Item $DestPath -Force }
  Move-Item $tmp $DestPath -Force
}

$root = Split-Path $PSScriptRoot -Parent
$candidates = @(
  (Join-Path $root "public\logo-source.png"),
  (Join-Path $root "assets\c__Users_NXTGN-PC_AppData_Roaming_Cursor_User_workspaceStorage_01d400c4363e64b397fdb1e33f51e83a_images_Logo__MSV___Network_-aea3faec-9acc-4264-acae-80b44cdd7229.png")
)
$asset = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $asset) {
  throw "Original logo source not found. Place file at public/logo-source.png"
}
$dest = Join-Path $root "public\logo.png"
Save-NormalizedLogo $asset $dest 512
Write-Host "Normalized logo -> $dest"
