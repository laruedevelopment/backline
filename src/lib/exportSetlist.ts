// Setlist en papel / PDF: se arma una página limpia (blanco y negro, letra grande) y se abre el diálogo de imprimir del navegador,
// donde «Guardar como PDF» o la impresora. Sin librerías ni servidor: todo pasa en el dispositivo.
import { parseChart } from './chart'
import type { SetlistItem } from './setlistItems'
import { tuningSummary, type Song } from './song'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
@page { margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; }
h1 { font-size: 26pt; margin: 0 0 4pt; }
.meta { color: #555; font-size: 11pt; margin-bottom: 14pt; }
ol { padding-left: 22pt; font-size: 14pt; line-height: 1.5; }
ol li small { color: #555; font-size: 10.5pt; }
.label { list-style: none; margin-left: -22pt; font-weight: bold; text-transform: uppercase; letter-spacing: .06em; font-size: 10.5pt; color: #333; padding-top: 6pt; }
.song { break-before: page; }
.song h2 { font-size: 20pt; margin: 0; }
.song .sub { color: #444; font-size: 11pt; margin: 2pt 0 8pt; }
.note { font-size: 11pt; border-left: 3pt solid #111; padding: 2pt 8pt; margin: 6pt 0; }
pre { font-family: "Courier New", monospace; font-size: 12.5pt; line-height: 1.3; margin: 10pt 0 0; white-space: pre-wrap; }
.ch { font-weight: bold; }
.sec { font-family: Arial, sans-serif; font-size: 10pt; letter-spacing: .1em; text-transform: uppercase; color: #444; margin-top: 8pt; display: block; }
`

function chartHtml(lyrics: string): string {
  return parseChart(lyrics).map((l) => {
    if (l.kind === 'blank') return ''
    if (l.kind === 'section') return `<span class="sec">${esc(l.text)}</span>`
    return l.kind === 'chords' ? `<span class="ch">${esc(l.text)}</span>` : esc(l.text)
  }).join('\n')
}

/** `lyrics`: letra de cada canción por id (la lista de canciones no las trae). Sin letra, la canción va solo en el resumen. */
export function setlistHtml(name: string, entries: SetlistItem[], songs: Map<string, Song>, lyrics: Map<string, string>, withLyrics: boolean): string {
  const picked = entries.flatMap((e) => (e.t === 's' && songs.get(e.id) ? [songs.get(e.id)!] : []))
  const minutes = picked.reduce((t, s) => t + s.minutes, 0)
  let n = 0
  const rows = entries.map((e) => {
    if (e.t === 'l') return `<li class="label">${esc(e.text)}</li>`
    const s = songs.get(e.id)
    if (!s) return ''
    n += 1
    const tags = e.tags?.length ? ` · ${esc(e.tags.join(', '))}` : ''
    return `<li><b>${esc(s.title)}</b> <small>${esc([s.artist, s.key, `${s.bpm} bpm`, tuningSummary(s)].filter(Boolean).join(' · '))}${tags}</small></li>`
  }).join('')
  const pages = !withLyrics ? '' : entries.map((e) => {
    if (e.t !== 's') return ''
    const s = songs.get(e.id)
    const text = s && (s.lyrics ?? lyrics.get(s.id))
    if (!s || !text) return ''
    const note = s.notes ? `<div class="note">${esc(s.notes)}</div>` : ''
    return `<section class="song"><h2>${esc(s.title)}</h2><div class="sub">${esc([s.artist, s.key && `Tono ${s.key}`, `${s.bpm} bpm`, tuningSummary(s)].filter(Boolean).join(' · '))}</div>${note}<pre>${chartHtml(text)}</pre></section>`
  }).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(name)}</title><style>${CSS}</style></head><body>
<h1>${esc(name)}</h1><div class="meta">${picked.length} canciones · ${minutes} min</div><ol>${rows}</ol>${pages}</body></html>`
}

/** Abre el diálogo de imprimir con el setlist (en un iframe oculto: no depende de ventanas emergentes). */
export function printSetlist(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc || !frame.contentWindow) { frame.remove(); return }
  doc.open(); doc.write(html); doc.close()
  const win = frame.contentWindow
  win.onafterprint = () => frame.remove()
  setTimeout(() => { win.focus(); win.print(); setTimeout(() => frame.remove(), 60_000) }, 150)
}
