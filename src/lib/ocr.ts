import type { OcrLine } from './setlistImage'

export type OcrResult = { text: string; lines: OcrLine[]; width: number; height: number }

const TARGET_WIDTH = 1800
const MAX_SIDE = 3000
/** La columna derecha (etiquetas de afinación) se lee aparte, a partir de este punto del ancho. */
const BADGE_FROM = 0.66

type Mode = 'grey' | 'min'

/**
 * Prepara la imagen para el lector: la agranda (los setlists de celular traen letra pequeña), estira el contraste y
 * deja texto oscuro sobre fondo claro (lo que mejor lee Tesseract).
 *  - 'grey': pasa a grises; si el fondo es oscuro, invierte.
 *  - 'min': toma el canal más bajo de cada punto: el texto blanco sobre una etiqueta de color (azul, rojo…) queda
 *    claramente separado del fondo, cosa que los grises no logran con azules.
 * `cropFrom` recorta el lado izquierdo (fracción del ancho) para leer solo una columna.
 */
async function preprocess(file: File, mode: Mode, cropFrom = 0): Promise<{ blob: Blob; width: number; height: number; offsetX: number }> {
  // Algunos navegadores no aceptan la opción de orientación; otros no pueden abrir el formato (p. ej. HEIC de iPhone).
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file)).catch(() => { throw new Error('decode') })
  try {
    const scale = Math.min(MAX_SIDE / Math.max(bmp.width, bmp.height), Math.max(1, TARGET_WIDTH / bmp.width))
    const fullW = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
    const offsetX = Math.round(fullW * cropFrom)
    const w = fullW - offsetX
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, offsetX / scale, 0, bmp.width - offsetX / scale, bmp.height, 0, 0, w, h)
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data

    const val = new Uint8ClampedArray(w * h)
    const hist = new Uint32Array(256)
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = mode === 'min' ? Math.min(d[i], d[i + 1], d[i + 2]) : Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
      val[p] = v
      hist[v]++
    }
    // Percentiles 2 % y 98 % para estirar el contraste.
    const total = w * h
    let acc = 0, lo = 0, hi = 255
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break } }
    acc = 0
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break } }
    const range = Math.max(1, hi - lo)
    // Fondo oscuro = la mediana está en la mitad baja. En 'min' el texto siempre es lo claro: se invierte siempre.
    let median = 0
    acc = 0
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total / 2) { median = v; break } }
    const invert = mode === 'min' || median < 120

    for (let p = 0, i = 0; p < val.length; p++, i += 4) {
      let v = Math.min(255, Math.max(0, ((val[p] - lo) * 255) / range))
      if (invert) v = 255 - v
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('No pudimos preparar la imagen')
    return { blob, width: fullW, height: h, offsetX }
  } finally {
    bmp.close()
  }
}

type Worker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>

async function recognizeLines(worker: Worker, blob: Blob, offsetX: number): Promise<{ text: string; lines: OcrLine[] }> {
  const { data } = await worker.recognize(blob, {}, { blocks: true })
  const shift = (b: { x0: number; y0: number; x1: number; y1: number }) => ({ x0: b.x0 + offsetX, y0: b.y0, x1: b.x1 + offsetX, y1: b.y1 })
  const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({
    text: l.text.replace(/\s+/g, ' ').trim(),
    bbox: shift(l.bbox),
    words: l.words.map((w) => ({ text: w.text, bbox: shift(w.bbox), confidence: w.confidence })),
  })).filter((l) => l.text)
  return { text: data.text, lines }
}

/**
 * Lee texto de una foto o captura en el propio dispositivo (Tesseract.js): la imagen no se envía a nuestros servidores.
 * El motor descarga sus componentes de un CDN de terceros (declarado en la política de privacidad).
 * Devuelve el texto y cada línea con su posición, para poder reconstruir listas diseñadas (filas numeradas, etiquetas…).
 * Hace dos lecturas: la imagen completa y, aparte, la columna derecha donde suelen ir las etiquetas de color.
 */
export async function readTextFromImage(file: File, onProgress?: (pct: number) => void): Promise<OcrResult> {
  if (!file.type.startsWith('image/')) throw new Error('No es una imagen')
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen pesa más de 12 MB')
  // Carga perezosa: el motor (varios MB) solo se baja si alguien usa esta función.
  const { createWorker, PSM } = await import('tesseract.js')
  let phase = 0
  const worker = await createWorker('spa+eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round((phase * 100 + m.progress * 100) / 2))
    },
  })
  try {
    // Modo «bloques de texto dispersos»: mejor para listas con columnas y etiquetas que para un párrafo corrido.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' })
    const main = await preprocess(file, 'grey')
    const a = await recognizeLines(worker, main.blob, 0)
    phase = 1
    const side = await preprocess(file, 'min', BADGE_FROM)
    const b = await recognizeLines(worker, side.blob, side.offsetX)
    // Las líneas de la columna derecha que ya leyó la pasada principal no se repiten.
    const seen = (l: OcrLine) => a.lines.some((m) => Math.abs(m.bbox.y0 - l.bbox.y0) < 12 && m.bbox.x0 > side.offsetX - 5 && m.text.toLowerCase().replace(/\s/g, '') === l.text.toLowerCase().replace(/\s/g, ''))
    const lines = [...a.lines, ...b.lines.filter((l) => !seen(l))]
    return { text: a.text, lines, width: main.width, height: main.height }
  } finally {
    await worker.terminate()
  }
}
