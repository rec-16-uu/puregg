# PurpleEgg - launcher icon: a cute Q-style purple egg on a soft rounded square.
# ASCII-only on purpose: Windows PowerShell may read this file as GBK.
Add-Type -AssemblyName System.Drawing

$res = Join-Path $PSScriptRoot '..\app\src\main\res'
$sizes = [ordered]@{ 'mipmap-mdpi' = 48; 'mipmap-hdpi' = 72; 'mipmap-xhdpi' = 96; 'mipmap-xxhdpi' = 144; 'mipmap-xxxhdpi' = 192 }

function New-RoundedPath([single]$w, [single]$h, [single]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc(0, 0, $d, $d, 180, 90)
    $p.AddArc($w - $d, 0, $d, $d, 270, 90)
    $p.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
    $p.AddArc(0, $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

# Egg body: narrow top, round bottom, via 4 cubic beziers (centered at cx,cy).
function New-EggPath([single]$cx, [single]$cy, [single]$w, [single]$h) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $l = [single]($cx - $w / 2); $r = [single]($cx + $w / 2)
    $t = [single]($cy - $h / 2); $b = [single]($cy + $h / 2)
    $p.AddBezier(
        [single]$cx, $t,
        [single]($cx + $w * 0.30), $t,
        [single]$r, [single]($cy - $h * 0.16),
        [single]$r, [single]($cy + $h * 0.04))
    $p.AddBezier(
        [single]$r, [single]($cy + $h * 0.04),
        [single]$r, [single]($cy + $h * 0.42),
        [single]($cx + $w * 0.20), $b,
        [single]$cx, $b)
    $p.AddBezier(
        [single]$cx, $b,
        [single]($cx - $w * 0.20), $b,
        [single]$l, [single]($cy + $h * 0.42),
        [single]$l, [single]($cy + $h * 0.04))
    $p.AddBezier(
        [single]$l, [single]($cy + $h * 0.04),
        [single]$l, [single]($cy - $h * 0.16),
        [single]($cx - $w * 0.30), $t,
        [single]$cx, $t)
    $p.CloseFigure()
    return $p
}

foreach ($k in $sizes.Keys) {
    $size = $sizes[$k]
    $dir = Join-Path $res $k
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = [single]$size

    # 1) rounded-square background (soft lavender -> pink)
    $bgPath = New-RoundedPath $s $s ([single]($s * 0.24))
    $bgRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect,
        [System.Drawing.ColorTranslator]::FromHtml('#F4EDFF'),
        [System.Drawing.ColorTranslator]::FromHtml('#FFE9F5'), [single]45)
    $g.FillPath($bgBrush, $bgPath)

    # 2) egg body (purple gradient + darker outline)
    $cx = [single]($s * 0.50); $cy = [single]($s * 0.52)
    $ew = [single]($s * 0.60); $eh = [single]($s * 0.70)
    $egg = New-EggPath $cx $cy $ew $eh
    $eggRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $eggBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($eggRect,
        [System.Drawing.ColorTranslator]::FromHtml('#B998FF'),
        [System.Drawing.ColorTranslator]::FromHtml('#8A5CF0'), [single]90)
    $g.FillPath($eggBrush, $egg)
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#6D4AFF'), [single]($s * 0.035))
    $pen.LineJoin = 'Round'
    $g.DrawPath($pen, $egg)

    # 3) glossy highlight
    $gloss = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 255, 255, 255))
    $g.FillEllipse($gloss,
        [single]($cx - $ew * 0.30), [single]($cy - $eh * 0.32),
        [single]($ew * 0.20), [single]($eh * 0.26))

    # 4) eyes
    $ink = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#2B1A3F'))
    $eyeR = [single]($ew * 0.095)
    $eyY = [single]($cy - $eh * 0.02)
    $g.FillEllipse($ink,
        [single]($cx - $ew * 0.17 - $eyeR), [single]($eyY - $eyeR),
        [single]($eyeR * 2), [single]($eyeR * 2))
    $g.FillEllipse($ink,
        [single]($cx + $ew * 0.17 - $eyeR), [single]($eyY - $eyeR),
        [single]($eyeR * 2), [single]($eyeR * 2))

    # 5) eye sparkles
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $spR = [single]($eyeR * 0.40)
    $g.FillEllipse($white,
        [single]($cx - $ew * 0.17 - $eyeR + $spR * 0.2), [single]($eyY - $eyeR + $spR * 0.1),
        [single]($spR * 2), [single]($spR * 2))
    $g.FillEllipse($white,
        [single]($cx + $ew * 0.17 - $eyeR + $spR * 0.2), [single]($eyY - $eyeR + $spR * 0.1),
        [single]($spR * 2), [single]($spR * 2))

    # 6) smile
    $smilePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#3A2456'), [single]($s * 0.03))
    $smilePen.StartCap = 'Round'; $smilePen.EndCap = 'Round'
    $g.DrawArc($smilePen,
        [single]($cx - $ew * 0.11), [single]($cy + $eh * 0.04),
        [single]($ew * 0.22), [single]($eh * 0.16), 20, 140)

    # 7) blush
    $blush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 255, 158, 210))
    $blR = [single]($ew * 0.085)
    $g.FillEllipse($blush,
        [single]($cx - $ew * 0.30 - $blR), [single]($cy + $eh * 0.08 - $blR),
        [single]($blR * 2), [single]($blR * 2))
    $g.FillEllipse($blush,
        [single]($cx + $ew * 0.30 - $blR), [single]($cy + $eh * 0.08 - $blR),
        [single]($blR * 2), [single]($blR * 2))

    $out = Join-Path $dir 'ic_launcher.png'
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose(); $bmp.Dispose(); $bgPath.Dispose(); $egg.Dispose()
    $bgBrush.Dispose(); $eggBrush.Dispose(); $pen.Dispose(); $gloss.Dispose()
    $ink.Dispose(); $white.Dispose(); $smilePen.Dispose(); $blush.Dispose()
    "icon -> $out  ($size x $size)"
}
