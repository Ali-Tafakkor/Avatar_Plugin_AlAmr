$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskProject = Split-Path -Parent $PSScriptRoot
$taskWorkspace = Split-Path -Parent $taskProject
$taskPublic = Join-Path $taskProject 'public'
New-Item -ItemType Directory -Force -Path $taskPublic | Out-Null
function Write-AvatarArtwork([int]$width,[int]$height,[string]$path) {
    $bitmap = [System.Drawing.Bitmap]::new($width,$height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#163D39'))
    $scale = $height / 512.0
    $graphics.ScaleTransform([single]$scale,[single]$scale)
    $brushes = @{}
    foreach($entry in @{paper='#EBEDE3';skin='#CCA58A';shirt='#A497B6';dark='#26332F';line='#72978B';accent='#C0AA7E'}.GetEnumerator()) {
        $brushes[$entry.Key]=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($entry.Value))
    }
    $pen=[System.Drawing.Pen]::new($brushes.line.Color,2)
    $graphics.DrawEllipse($pen,45,45,422,422)
    $graphics.FillEllipse($brushes.skin,213,109,87,103)
    $graphics.FillPie($brushes.dark,207,97,99,72,180,180)
    $graphics.FillRectangle($brushes.skin,240,196,31,41)
    $points=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(216,219),[System.Drawing.PointF]::new(295,219),[System.Drawing.PointF]::new(341,263),[System.Drawing.PointF]::new(317,289),[System.Drawing.PointF]::new(302,271),[System.Drawing.PointF]::new(300,359),[System.Drawing.PointF]::new(211,359),[System.Drawing.PointF]::new(210,271),[System.Drawing.PointF]::new(192,289),[System.Drawing.PointF]::new(170,262))
    $graphics.FillPolygon($brushes.shirt,$points)
    $graphics.FillRectangle($brushes.dark,215,359,34,72)
    $graphics.FillRectangle($brushes.dark,267,359,31,72)
    $font=[System.Drawing.Font]::new('Segoe UI',26,[System.Drawing.FontStyle]::Bold)
    $small=[System.Drawing.Font]::new('Segoe UI',11,[System.Drawing.FontStyle]::Regular)
    $graphics.DrawString('03',$font,$brushes.accent,365,375)
    if($width -gt $height) {
        $title=[System.Drawing.Font]::new('Segoe UI',34,[System.Drawing.FontStyle]::Regular)
        $graphics.DrawString('AL-AMR',$small,$brushes.accent,545,183)
        $graphics.DrawString('AVATAR LAB',$title,$brushes.paper,538,212)
        $graphics.DrawString('Character 03 / motion studies',$small,$brushes.line,545,278)
        $title.Dispose()
    }
    $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose();$bitmap.Dispose();$font.Dispose();$small.Dispose();$pen.Dispose()
    foreach($brush in $brushes.Values){$brush.Dispose()}
}
Write-AvatarArtwork 1280 720 (Join-Path $taskPublic 'environment-cover.png')
Write-AvatarArtwork 512 512 (Join-Path $taskWorkspace 'آواتار\plugin-icon.png')
