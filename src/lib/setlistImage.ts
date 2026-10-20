// Reconstruye una lista de canciones desde las líneas que leyó el OCR (con su posición en la imagen).
// Pensado para setlists «diseñados» (los que se mandan por WhatsApp): una canción por fila, con el nombre más grande,
// el artista debajo, notas opcionales y una etiqueta de afinación a la derecha. Si no reconoce esa estructura devuelve
// null y se usa el lector de texto simple.
export type Box = { x0: number; y0: number; x1: number; y1: number }
export type OcrWord = { text: string; bbox: Box; confidence: number }
export type OcrLine = { text: string; bbox: Box; words: OcrWord[] }

export type ImageRow = { title: string; artist: string; tuning: string; notes: string; original: boolean }
export type ImageSetlist = { name: string; rows: ImageRow[] }

const mid = (b: Box) => (b.y0 + b.y1) / 2

/** «DROP D» → «Drop D», «ESTÁNDAR» → «E estándar», «Drop Bb»… Vacío si no parece una afinación. */
export function normalizeTuning(raw: string): string {
  const t = raw.trim()
  const drop = t.match(/dr[o0]p\s*([a-g])\s*([#b♭])?/i)
  if (drop) return `Drop ${drop[1].toUpperCase()}${drop[2] ? (drop[2] === '♭' ? 'b' : drop[2]) : ''}`
  if (/est[aá]ndar|standard|estandar/i.test(t)) return 'E estándar'
  const half = t.match(/^(?:medio\s*tono\s*abajo|eb|d#|re\s*bemol)$/i)
  return half ? 'Eb estándar' : ''
}

// Líneas que describen un cambio y no son el artista.
const NOTE_LIKE = /^[+\-−±]|tono|original en|acordes|riffs?\b|octava|capo|reacomod|versi[oó]n|cambio|afinaci|tuning|key\b/i
// Leyendas y pies de página del diseño.
const LEGEND = /^\W*(e\s+)?drop\s*d\b|^\W*(e\s+)?est[aá]ndar|cambio respecto|sin marca|marca amarilla/i

const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)([a-záéíóúñ])/g, (_, a, b) => a + b.toUpperCase()) : s)

function cleanNote(s: string): string {
  return s
    .replace(/\+\s*[%½1]\/2/g, '+½').replace(/\+%/g, '+½').replace(/-\s*%/g, '-½')
    .replace(/\s[-–—]\s/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Valor más repetido (con tolerancia): el margen izquierdo donde empiezan los nombres de las canciones. */
function dominantX(xs: number[], tolerance: number): number | null {
  let best: { x: number; n: number } | null = null
  for (const x of xs) {
    const n = xs.filter((o) => Math.abs(o - x) <= tolerance).length
    if (!best || n > best.n) best = { x, n }
  }
  return best && best.n >= 3 ? best.x : null
}

export function parseSetlistLayout(lines: OcrLine[], width: number): ImageSetlist | null {
  if (lines.length < 4 || width <= 0) return null
  const rightFrom = width * 0.62
  const badges = lines.filter((l) => l.bbox.x0 > rightFrom && l.text.length <= 14)
  const left = lines.filter((l) => !badges.includes(l)).sort((a, b) => a.bbox.y0 - b.bbox.y0)

  const margin = dominantX(left.map((l) => l.bbox.x0), width * 0.02)
  if (margin === null) return null
  const headerLines = left.filter((l) => l.bbox.x0 < margin - width * 0.025)
  // Más a la derecha del margen = leyendas, pies o ruido, no canciones.
  const body = left.filter((l) => Math.abs(l.bbox.x0 - margin) <= width * 0.04 && !LEGEND.test(l.text))
  if (body.length < 3) return null

  // Agrupar por filas: dentro de una fila las líneas están pegadas; entre filas hay un hueco claro.
  const gaps = body.slice(1).map((l, i) => Math.max(0, l.bbox.y0 - body[i].bbox.y1))
  let threshold = Infinity
  const sorted = [...gaps].sort((a, b) => a - b)
  let bestRatio = 1
  for (let i = 0; i < sorted.length - 1; i++) {
    const ratio = (sorted[i + 1] + 4) / (sorted[i] + 4)
    if (ratio > bestRatio) { bestRatio = ratio; threshold = (sorted[i] + sorted[i + 1]) / 2 }
  }
  if (bestRatio < 1.5) threshold = -1 // sin hueco claro: cada línea es una canción
  const groups: OcrLine[][] = []
  body.forEach((l, i) => {
    if (i === 0 || gaps[i - 1] > threshold) groups.push([l])
    else groups[groups.length - 1].push(l)
  })

  const rows: (ImageRow & { y0: number; y1: number })[] = groups.map((g) => {
    const clean = g.map((l) => l.text.replace(/^\d{1,2}[.)]?\s+(?=\D)/, '').trim())
    let title = clean[0]
    const original = /\bpropia\b/i.test(title)
    title = title.replace(/\s*\bpropia\b\s*$/i, '').trim()
    const rest = clean.slice(1)
    const artist = rest.length && !NOTE_LIKE.test(rest[0]) ? rest[0].replace(/\s[-–—]\s/g, ' · ') : ''
    const notes = (artist ? rest.slice(1) : rest).map(cleanNote).filter(Boolean).join(' · ')
    return { title, artist, tuning: '', notes, original, y0: g[0].bbox.y0, y1: g[g.length - 1].bbox.y1 }
  })

  // Cada etiqueta de afinación va a la fila con la que más se alinea verticalmente.
  for (const b of badges) {
    const t = normalizeTuning(b.text)
    if (!t) continue
    const c = mid(b.bbox)
    let best = -1, bestD = Infinity
    rows.forEach((r, i) => {
      const d = c >= r.y0 && c <= r.y1 ? 0 : Math.min(Math.abs(c - r.y0), Math.abs(c - r.y1))
      if (d < bestD) { bestD = d; best = i }
    })
    const pitch = rows.length > 1 ? (rows[rows.length - 1].y0 - rows[0].y0) / (rows.length - 1) : 100
    if (best >= 0 && bestD < pitch / 2 && !rows[best].tuning) rows[best].tuning = t
  }

  const titleLines = headerLines
    .filter((l) => l.bbox.y1 <= body[0].bbox.y0 && !LEGEND.test(l.text) && !/^setlist$/i.test(l.text.replace(/\s/g, '')) && !/^s\s*e\s*t\s*l\s*i\s*s\s*t$/i.test(l.text))
    .slice(0, 2)
    .map((l) => titleCase(l.text))
  const name = titleLines.join(' · ')

  return { name, rows: rows.map(({ y0: _a, y1: _b, ...r }) => r) }
}
