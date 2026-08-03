Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
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

# SISTEMA DE DESIGN (docs/PLANO.md): flexographic-press control strip — flat
# substrate, CMYK inks as semantic patches, a registration mark. No gradients,
# no shadows: depth is a step of value plus a 1px rule, same as the app chrome.
[single]$margin = 24
[single]$radius = 190
$panel = RoundedRect $margin $margin ([single]($size - $margin * 2)) ([single]($size - $margin * 2)) $radius

$substrate = [System.Drawing.Color]::FromArgb(255, 20, 18, 16)   # --substrate #141210
$rule = [System.Drawing.Color]::FromArgb(255, 42, 39, 36)        # --rule #2A2724
$paper = [System.Drawing.Color]::FromArgb(255, 237, 230, 218)    # --paper #EDE6DA
$inkCyan = [System.Drawing.Color]::FromArgb(255, 46, 147, 184)   # --ink-cyan
$inkMagenta = [System.Drawing.Color]::FromArgb(255, 196, 69, 127) # --ink-magenta
$inkYellow = [System.Drawing.Color]::FromArgb(255, 217, 165, 33)  # --ink-yellow
$inkOverprint = [System.Drawing.Color]::FromArgb(255, 122, 94, 158) # --ink-overprint

$bgBrush = New-Object System.Drawing.SolidBrush -ArgumentList $substrate
$g.FillPath($bgBrush, $panel)
$borderPen = New-Object System.Drawing.Pen -ArgumentList $rule, 6
$g.DrawPath($borderPen, $panel)

# Registration mark (⊕) — the design system's "in register" indicator.
$regPen = New-Object System.Drawing.Pen -ArgumentList $paper, 34
$regPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
$regPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat
[single]$cx = 512
[single]$cy = 430
[single]$r = 170
$g.DrawEllipse($regPen, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
$g.DrawLine($regPen, $cx, ($cy - 110), $cx, ($cy + 110))
$g.DrawLine($regPen, ($cx - 110), $cy, ($cx + 110), $cy)

# Step-wedge control strip — one patch per ink, same semantics as the in-app strip.
$patchColors = @($inkCyan, $inkMagenta, $inkYellow, $inkOverprint)
[single]$patchW = 130
[single]$patchH = 100
[single]$gap = 24
[single]$totalW = $patchColors.Length * $patchW + ($patchColors.Length - 1) * $gap
[single]$startX = $cx - $totalW / 2
[single]$patchY = 660
$patchPen = New-Object System.Drawing.Pen -ArgumentList $rule, 4

for ($i = 0; $i -lt $patchColors.Length; $i++) {
  [single]$px = $startX + $i * ($patchW + $gap)
  $patchBrush = New-Object System.Drawing.SolidBrush -ArgumentList $patchColors[$i]
  $g.FillRectangle($patchBrush, $px, $patchY, $patchW, $patchH)
  $g.DrawRectangle($patchPen, $px, $patchY, $patchW, $patchH)
}

$outPath = Join-Path $PSScriptRoot "icon.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Output "saved $outPath"
