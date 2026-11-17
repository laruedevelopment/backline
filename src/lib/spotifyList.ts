// Listas copiadas o fotografiadas desde Spotify (o exportadas a CSV): título y artista vienen en celdas o en líneas separadas.
// Spotify no deja leer playlists ajenas por su API, así que se entiende lo que la persona copia, sube o fotografía.
import type { ParsedLine } from './importSetlist'

const DURATION = /^\d{1,2}:\d{2}(?::\d{2})?$/
const NUMBER = /^\d{1,3}$/
const NOISE = /^(e|explicit|reproducir|play|pausar|shuffle|aleatorio|descargar|download|siguiendo|seguir|título|titulo|title|artista|álbum|album|fecha en que se agregó|duración|#|·|…|\.\.\.|\d+\s+(canciones|songs)(,.*)?)$/i

/** Parte una línea de CSV respetando comillas. */
function csvCells(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

const clean = (s: string, max: number) => s.replace(/^["“”']|["“”']$/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const firstArtist = (s: string) => clean(s.split(/;|\s·\s/)[0], 120)

function fromCsv(rows: string[]): ParsedLine[] | null {
  const head = csvCells(rows[0]).map((h) => h.toLowerCase())
  const t = head.findIndex((h) => /^(track name|track|title|título|titulo|nombre de la canción|nombre)$/.test(h))
  const a = head.findIndex((h) => /^(artist name\(s\)|artist names?|artist|artista|artistas|artista\(s\))$/.test(h))
  if (t < 0 || a < 0) return null
  return rows.slice(1).map(csvCells).filter((c) => c[t]).map((c) => ({ title: clean(c[t], 120), artist: firstArtist(c[a] ?? '') }))
}

function fromTabs(rows: string[]): ParsedLine[] | null {
  const tabbed = rows.filter((r) => r.split('\t').length >= 3)
  if (tabbed.length < 2 || tabbed.length < rows.length * 0.6) return null
  const out: ParsedLine[] = []
  for (const r of tabbed) {
    const cells = r.split('\t').map((c) => c.trim()).filter((c) => c && !NUMBER.test(c) && !DURATION.test(c) && !NOISE.test(c))
    if (cells.length >= 2) out.push({ title: clean(cells[0], 120), artist: firstArtist(cells[1]) })
  }
  return out.length ? out : null
}

/** Título y artista en líneas seguidas (lo que sale al copiar desde la app de escritorio o al leer una captura). */
function fromPairs(rows: string[]): ParsedLine[] | null {
  const keep = rows.map((r) => r.trim()).filter((r) => r && !NUMBER.test(r) && !DURATION.test(r) && !NOISE.test(r))
  if (keep.length < 4) return null
  // Si casi todas las líneas ya traen «título - artista», no es este formato.
  const inline = keep.filter((r) => / [-–—] | \/ /.test(r)).length
  if (inline > keep.length * 0.3) return null
  // Con álbum (tres líneas por canción) o sin él (dos): se elige la que deje el reparto exacto.
  const per = keep.length % 3 === 0 && keep.length % 2 !== 0 ? 3 : keep.length % 2 === 0 ? 2 : 0
  if (!per) return null
  const out: ParsedLine[] = []
  for (let i = 0; i + per <= keep.length; i += per) out.push({ title: clean(keep[i], 120), artist: firstArtist(keep[i + 1].replace(/^E\s+(?=\S)/, '')) })
  return out
}

/** Si el texto parece venir de Spotify (CSV exportado, celdas con tabulador o título/artista en líneas separadas) devuelve sus canciones. */
export function parseSpotifyText(text: string): ParsedLine[] | null {
  const rows = text.replace(/\r/g, '').split('\n').filter((r) => r.trim())
  if (rows.length < 2) return null
  const found = fromCsv(rows) ?? fromTabs(rows) ?? fromPairs(rows)
  if (!found?.length) return null
  const seen = new Set<string>()
  return found.filter((l) => { const k = l.title.toLowerCase(); if (!l.title || seen.has(k)) return false; seen.add(k); return true })
}
