import sharp from 'sharp'

export interface ImageProfile {
  maxSide: number
  quality: number
}

export interface CompressedImage {
  buffer: Buffer
  contentType: string
  extension: string
}

export async function compressImage(
  input: Buffer,
  profile: ImageProfile,
): Promise<CompressedImage> {
  // `rotate()` va primero: al reescribir se pierde el EXIF, y sin aplicar antes
  // su orientación las fotos verticales quedan acostadas.
  const buffer = await sharp(input)
    .rotate()
    .resize({
      width: profile.maxSide,
      height: profile.maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: profile.quality })
    .toBuffer()

  return { buffer, contentType: 'image/webp', extension: 'webp' }
}
