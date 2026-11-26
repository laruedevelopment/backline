// Compartir un setlist como texto (para WhatsApp) o como imagen, eligiendo qué información incluir.
import type { SetlistItem } from './setlistItems'
import { fullTuning, type Song } from './song'

export type ShareFields = { number: boolean; artist: boolean; minutes: boolean; key: boolean; bpm: boolean; tuning: boolean; tags: boolean; total: boolean }
export const defaultFields: ShareFields = { number: true, artist: true, minutes: false, key: false, bpm: false, tuning: false, tags: true, total: true }

export const fieldLabels: [keyof ShareFields, string][] = [
  ['number', 'Número'], ['artist', 'Artista'], ['minutes', 'Duración'], ['key', 'Tonalidad'], ['bpm', 'BPM'], ['tuning', 'Afinación'], ['tags', 'Etiquetas'], ['total', 'Total de canciones y minutos'],
]

const KEY = 'backline-share-fields'
export function loadFields(): ShareFields {
  try { return { ...defaultFields, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ShareFields>) } } catch { return defaultFields }
}
export function saveFields(f: ShareFields) {
  try { localStorage.setItem(KEY, JSON.stringify(f)) } catch { /* solo en memoria */ }
}

export type ShareRow = { kind: 'song'; n: number; title: string; detail: string } | { kind: 'label'; text: string }
export type ShareDoc = { name: string; rows: ShareRow[]; footer: string }

/** Arma lo que se va a compartir, según los datos elegidos. */
export function buildShare(name: string, entries: SetlistItem[], songs: Map<string, Song>, f: ShareFields): ShareDoc {
  const rows: ShareRow[] = []
  let n = 0
  let minutes = 0
  for (const e of entries) {
    if (e.t === 'l') { rows.push({ kind: 'label', text: e.text }); continue }
    const s = songs.get(e.id)
    if (!s) continue
    n += 1
    minutes += s.minutes
    const detail = [
      f.artist && s.artist,
      f.key && s.key && `Tono ${s.key}`,
      f.bpm && `${s.bpm} bpm`,
      f.minutes && `${s.minutes} min`,
      f.tuning && fullTuning(s),
      f.tags && e.tags?.length ? e.tags.join(', ') : '',
    ].filter(Boolean).join(' · ')
    rows.push({ kind: 'song', n, title: s.title, detail })
  }
  return { name, rows, footer: f.total ? `${n} canciones · ${minutes} min` : '' }
}

/** Texto listo para pegar en WhatsApp. */
export function shareText(doc: ShareDoc, f: ShareFields): string {
  const lines = doc.rows.map((r) => (r.kind === 'label' ? `— ${r.text} —` : `${f.number ? `${r.n}. ` : ''}${r.title}${r.detail ? ` — ${r.detail}` : ''}`))
  return [doc.name, '', ...lines, ...(doc.footer ? ['', doc.footer] : [])].join('\n')
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(next).width > max) { out.push(cur); cur = word } else cur = next
  }
  if (cur) out.push(cur)
  return out
}

/** Imagen (PNG) del setlist, lista para compartir por redes o chat. */
export async function shareImage(doc: ShareDoc, f: ShareFields): Promise<Blob> {
  const W = 1080
  const PAD = 72
  const inner = W - PAD * 2
  const measure = document.createElement('canvas').getContext('2d')!
  const fontTitle = '900 76px "Archivo Variable", Archivo, "Arial Narrow", Arial, sans-serif'
  const fontRow = '700 42px "Instrument Sans Variable", "Instrument Sans", Arial, sans-serif'
  const fontDetail = '400 30px "Instrument Sans Variable", "Instrument Sans", Arial, sans-serif'
  const fontLabel = '700 28px "IBM Plex Mono", ui-monospace, monospace'

  measure.font = fontTitle
  const titleLines = wrap(measure, doc.name.toUpperCase(), inner)
  type Laid = { row: ShareRow; titleLines: string[]; detailLines: string[]; h: number }
  const laid: Laid[] = doc.rows.map((row) => {
    if (row.kind === 'label') return { row, titleLines: [], detailLines: [], h: 76 }
    measure.font = fontRow
    const tl = wrap(measure, row.title, inner - (f.number ? 84 : 0))
    measure.font = fontDetail
    const dl = row.detail ? wrap(measure, row.detail, inner - (f.number ? 84 : 0)) : []
    return { row, titleLines: tl, detailLines: dl, h: tl.length * 52 + dl.length * 40 + 38 }
  })
  const headH = 70 + titleLines.length * 84 + 40
  const footH = doc.footer ? 110 : 40
  const H = headH + laid.reduce((t, r) => t + r.h, 0) + footH + 60

  const scale = 1
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0d0c0a'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#f2a33a'
  ctx.fillRect(0, 0, W, 14)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#f2a33a'
  ctx.font = fontLabel
  ctx.fillText('SETLIST', PAD, 80)
  ctx.fillStyle = '#f1ece2'
  ctx.font = fontTitle
  titleLines.forEach((l, i) => ctx.fillText(l, PAD, 80 + 84 * (i + 1)))

  let y = headH
  ctx.strokeStyle = '#3b352b'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(PAD, y - 12); ctx.lineTo(W - PAD, y - 12); ctx.stroke()
  for (const r of laid) {
    if (r.row.kind === 'label') {
      ctx.fillStyle = '#f2a33a'
      ctx.font = fontLabel
      ctx.fillText(`— ${r.row.text.toUpperCase()} —`, PAD, y + 44)
    } else {
      const x = PAD + (f.number ? 84 : 0)
      if (f.number) { ctx.fillStyle = '#f2a33a'; ctx.font = '900 44px "Archivo Variable", Archivo, Arial, sans-serif'; ctx.fillText(String(r.row.n), PAD, y + 46) }
      ctx.fillStyle = '#f1ece2'
      ctx.font = fontRow
      r.titleLines.forEach((l, i) => ctx.fillText(l, x, y + 46 + i * 52))
      ctx.fillStyle = '#a1998b'
      ctx.font = fontDetail
      r.detailLines.forEach((l, i) => ctx.fillText(l, x, y + 46 + (r.titleLines.length - 1) * 52 + 40 * (i + 1)))
    }
    y += r.h
  }
  if (doc.footer) {
    ctx.fillStyle = '#a1998b'
    ctx.font = fontLabel
    ctx.fillText(doc.footer.toUpperCase(), PAD, H - 70)
  }
  ctx.fillStyle = '#f2a33a'
  ctx.font = '900 30px "Archivo Variable", Archivo, Arial, sans-serif'
  const brand = 'BACKLINE'
  ctx.fillText(brand, W - PAD - ctx.measureText(brand).width, H - 70)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('imagen'))), 'image/png'))
}
