/** Lee texto de una foto o captura en el propio dispositivo (Tesseract.js): la imagen no se sube a ningún servidor. */
export async function readTextFromImage(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('No es una imagen')
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen pesa más de 12 MB')
  // Carga perezosa: el motor (varios MB) solo se baja si alguien usa esta función.
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa+eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100))
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}
