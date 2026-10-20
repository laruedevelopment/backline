export type Processed = { blob: Blob; ext: 'webp' | 'jpg'; width: number; height: number }

const MAX_SOURCE = 12 * 1024 * 1024

/**
 * Reduce y recodifica la imagen en el dispositivo antes de subirla:
 * - corrige la orientación y descarta los metadatos (EXIF, incluida la ubicación GPS de la foto);
 * - limita el lado mayor y el peso (el bucket acepta hasta 3 MB).
 */
export async function processImage(file: File, opts: { maxSide: number; quality?: number; square?: boolean }): Promise<Processed> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !file.type.startsWith('image/')) throw new Error('No es una imagen')
  if (file.size > MAX_SOURCE) throw new Error('La imagen pesa más de 12 MB')

  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height
    if (opts.square) {
      const side = Math.min(bmp.width, bmp.height)
      sx = (bmp.width - side) / 2
      sy = (bmp.height - side) / 2
      sw = sh = side
    }
    const scale = Math.min(1, opts.maxSide / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Tu navegador no puede procesar imágenes')
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h)

    const quality = opts.quality ?? 0.85
    const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality))
    // Safari antiguo no codifica WebP: cae a JPEG.
    const webp = await toBlob('image/webp')
    if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp', width: w, height: h }
    const jpg = await toBlob('image/jpeg')
    if (!jpg) throw new Error('No pudimos procesar la imagen')
    return { blob: jpg, ext: 'jpg', width: w, height: h }
  } finally {
    bmp.close()
  }
}
