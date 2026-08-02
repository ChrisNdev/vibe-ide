Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

function RoundedRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
  $path.AddArc(($x + $w - $r * 2), $y, $r * 2, $r * 2, 270, 90)
  $path.AddArc(($x + $w - $r * 2), ($y + $h - $r * 2), $r * 2, $r * 2, 0, 90)
  $path.AddArc($x, ($y + $h - $r * 2), $r * 2, $r * 2, 90, 90)
  $path.CloseFigure()
  return $path
}

[single]$margin = 24
[single]$radius = 190
$panel = RoundedRect $margin $margin ([single]($size - $margin * 2)) ([single]($size - $margin * 2)) $radius

$topPoint = New-Object System.Drawing.Point -ArgumentList 0, 0
$bottomPoint = New-Object System.Drawing.Point -ArgumentList 0, $size
$colorTop = [System.Drawing.Color]::FromArgb(255, 24, 24, 28)
$colorBottom = [System.Drawing.Color]::FromArgb(255, 10, 10, 12)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $topPoint, $bottomPoint, $colorTop, $colorBottom
$g.FillPath($bg, $panel)

$borderColor = [System.Drawing.Color]::FromArgb(60, 255, 255, 255)
$borderPen = New-Object System.Drawing.Pen -ArgumentList $borderColor, 6
$g.DrawPath($borderPen, $panel)

$accentBright = [System.Drawing.Color]::FromArgb(255, 92, 240, 165)
$accent = [System.Drawing.Color]::FromArgb(255, 57, 217, 138)
$accentDim = [System.Drawing.Color]::FromArgb(255, 43, 168, 107)

$font = New-Object System.Drawing.Font -ArgumentList "Consolas", 480, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$text = ">_"
$textSize = $g.MeasureString($text, $font)
[single]$tx = ($size - $textSize.Width) / 2 + 46
[single]$ty = ($size - $textSize.Height) / 2 + 46

for ($i = 4; $i -ge 1; $i--) {
  $alpha = [int](8 + $i * 3)
  $glowColor = [System.Drawing.Color]::FromArgb($alpha, $accentDim.R, $accentDim.G, $accentDim.B)
  $glowBrush = New-Object System.Drawing.SolidBrush -ArgumentList $glowColor
  [single]$offset = $i * 2
  $g.DrawString($text, $font, $glowBrush, ($tx - $offset), ($ty - $offset))
  $g.DrawString($text, $font, $glowBrush, ($tx + $offset), ($ty + $offset))
}

$textTopPoint = New-Object System.Drawing.PointF -ArgumentList $tx, $ty
[single]$tyBottom = $ty + $textSize.Height
$textBottomPoint = New-Object System.Drawing.PointF -ArgumentList $tx, $tyBottom
$textBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $textTopPoint, $textBottomPoint, $accentBright, $accent
$g.DrawString($text, $font, $textBrush, $tx, $ty)

$outPath = Join-Path $PSScriptRoot "icon.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Output "saved $outPath"
