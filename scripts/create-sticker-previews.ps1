Add-Type -AssemblyName System.Drawing

$sourceRoot = Join-Path $PSScriptRoot "..\public\stickers"
$targetRoot = Join-Path $PSScriptRoot "..\public\sticker-previews"
$maxWidth = 420
$quality = 78L

if (!(Test-Path $targetRoot)) {
  New-Item -ItemType Directory -Path $targetRoot | Out-Null
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } |
  Select-Object -First 1

$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality,
  $quality
)

Get-ChildItem $sourceRoot -Directory | ForEach-Object {
  $teamSource = $_.FullName
  $teamTarget = Join-Path $targetRoot $_.Name
  if (!(Test-Path $teamTarget)) {
    New-Item -ItemType Directory -Path $teamTarget | Out-Null
  }

  Get-ChildItem $teamSource -File | Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp)$' } | ForEach-Object {
    $image = [System.Drawing.Image]::FromFile($_.FullName)
    try {
      $scale = [Math]::Min(1.0, [double]$maxWidth / [double]$image.Width)
      $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
      $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))
      $bitmap = New-Object System.Drawing.Bitmap($width, $height)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.DrawImage($image, 0, 0, $width, $height)
        } finally {
          $graphics.Dispose()
        }

        $targetFile = Join-Path $teamTarget ($_.BaseName + ".jpg")
        $bitmap.Save($targetFile, $jpegCodec, $encoderParams)
      } finally {
        $bitmap.Dispose()
      }
    } finally {
      $image.Dispose()
    }
  }
}
