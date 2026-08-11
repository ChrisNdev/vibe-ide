Add-Type -AssemblyName System.Drawing

# Arte do instalador NSIS. Mesma abordagem do make-icon.ps1: System.Drawing, sem dependência
# nova. NSIS exige BMP nos dois slots (o formato é dos anos 90 e não negocia), e 24bpp sem
# canal alfa — 32bpp aparece com fundo preto ou lixo em algumas versões.
#
#   installerSidebar.bmp  164x314  painel da página final ("terminou, abrir agora?")
#   installerHeader.bmp   150x57   faixa do topo das páginas internas (pasta de instalação)
#
# A sidebar é o momento visual do instalador, então leva o tratamento escuro do app. O header
# fica sobre a barra branca que o NSIS desenha por conta própria e não dá pra escurecer sem
# trocar a UI inteira do instalador — então ele é claro de propósito, pra parecer parte da
# página em vez de um adesivo preto colado no canto.

# Tokens de src/renderer/src/styles/tokens.css — a paleta neutra estilo macOS dark.
$substrate = [System.Drawing.Color]::FromArgb(255, 28, 28, 30)   # --substrate #1c1c1e
$deep      = [System.Drawing.Color]::FromArgb(255, 16, 16, 18)   # fim do gradiente, mais fundo que --substrate
$rule      = [System.Drawing.Color]::FromArgb(255, 58, 58, 60)   # --rule #3a3a3c
$paper     = [System.Drawing.Color]::FromArgb(255, 245, 245, 247) # --paper #f5f5f7
$muted     = [System.Drawing.Color]::FromArgb(255, 142, 142, 147) # --muted #8e8e93
$accent    = [System.Drawing.Color]::FromArgb(255, 10, 132, 255)  # --ink-cyan (systemBlue)

# Segoe UI Light/Semibold existem no Windows 10+, mas não em toda instalação (imagens LTSC
# enxutas cortam variantes). Cai pro peso comum em vez de deixar o GDI+ escolher sozinho —
# família inexistente vira Microsoft Sans Serif, que destoa de tudo.
function PickFamily([string[]]$candidates) {
  $installed = [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }
  foreach ($name in $candidates) {
    if ($installed -contains $name) { return $name }
  }
  return 'Segoe UI'
}
$displayFamily = PickFamily @('Segoe UI Semibold', 'Segoe UI')
$bodyFamily = PickFamily @('Segoe UI', 'Tahoma')

function NewCanvas([int]$w, [int]$h) {
  # Format24bppRgb explícito: é o que o NSIS aceita sem reclamar.
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  return @($bmp, $g)
}

# ⊕ — a marca de registro, mesmo glifo do ícone do app e da tira de controle na interface.
function DrawRegistrationMark($g, [single]$cx, [single]$cy, [single]$r, [single]$stroke, $color) {
  $pen = New-Object System.Drawing.Pen -ArgumentList $color, $stroke
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat
  $g.DrawEllipse($pen, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
  [single]$arm = $r * 0.64
  $g.DrawLine($pen, $cx, ($cy - $arm), $cx, ($cy + $arm))
  $g.DrawLine($pen, ($cx - $arm), $cy, ($cx + $arm), $cy)
  $pen.Dispose()
}

function DrawCentered($g, [string]$text, $font, $color, [single]$centerX, [single]$y) {
  $brush = New-Object System.Drawing.SolidBrush -ArgumentList $color
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString($text, $font, $brush, $centerX, $y, $format)
  $brush.Dispose()
  $format.Dispose()
}

# ---------------------------------------------------------------- sidebar (164x314)
$pair = NewCanvas 164 314
$bmp = $pair[0]; $g = $pair[1]

$gradRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, 164, 314
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $gradRect, $substrate, $deep, ([System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillRectangle($grad, $gradRect)
$grad.Dispose()

# Espinha de acento na borda esquerda — a única cor saturada da peça inteira.
$accentBrush = New-Object System.Drawing.SolidBrush -ArgumentList $accent
$g.FillRectangle($accentBrush, 0, 0, 3, 314)
$accentBrush.Dispose()

DrawRegistrationMark $g 86 108 34 7 $paper

$wordmarkFont = New-Object System.Drawing.Font -ArgumentList $displayFamily, 21, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
DrawCentered $g 'vibeIDE' $wordmarkFont $paper 86 172

$rulePen = New-Object System.Drawing.Pen -ArgumentList $rule, 1
$g.DrawLine($rulePen, 56, 208, 116, 208)
$rulePen.Dispose()

$captionFont = New-Object System.Drawing.Font -ArgumentList $bodyFamily, 11, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
DrawCentered $g 'Cockpit para o' $captionFont $muted 86 220
DrawCentered $g 'Claude Code' $captionFont $muted 86 235

$sidebarPath = Join-Path $PSScriptRoot 'installerSidebar.bmp'
$bmp.Save($sidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$wordmarkFont.Dispose(); $captionFont.Dispose(); $g.Dispose(); $bmp.Dispose()

# ---------------------------------------------------------------- header (150x57)
$pair = NewCanvas 150 57
$bmp = $pair[0]; $g = $pair[1]

# Branco puro: é a cor que o NSIS pinta no resto da faixa do topo.
$g.Clear([System.Drawing.Color]::White)

# Centralizado no tile em vez de encostado na esquerda: dependendo da versão do NSIS o
# bitmap fica alinhado à direita da faixa, e aí conteúdo colado na esquerda abre um buraco
# entre a marca e a borda da janela. Centralizado funciona nos dois alinhamentos.
$headerFont = New-Object System.Drawing.Font -ArgumentList $displayFamily, 16, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$textWidth = $g.MeasureString('vibeIDE', $headerFont).Width
[single]$markDiameter = 29
[single]$gap = 8
[single]$blockStart = (150 - ($markDiameter + $gap + $textWidth)) / 2

DrawRegistrationMark $g ($blockStart + $markDiameter / 2) 28 13 3 $substrate
$headerBrush = New-Object System.Drawing.SolidBrush -ArgumentList $substrate
$g.DrawString('vibeIDE', $headerFont, $headerBrush, ($blockStart + $markDiameter + $gap), 18)
$headerBrush.Dispose()

$headerPath = Join-Path $PSScriptRoot 'installerHeader.bmp'
$bmp.Save($headerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$headerFont.Dispose(); $g.Dispose(); $bmp.Dispose()

Write-Output "saved $sidebarPath"
Write-Output "saved $headerPath"
