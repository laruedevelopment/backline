import type { Song } from './song'

export type ParsedLine = { title: string; artist: string; tuning?: string; notes?: string }
export type ParsedSetlist = { name: string; lines: ParsedLine[] }

/** Minúsculas, sin tildes ni signos: para comparar títulos escritos distinto. */
export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Numeración, viñetas y emojis al inicio: "1.", "2)", "- ", "• ", "🎸 ", "[x] "
const LEAD = /^\s*(?:\[[ x]?\]\s*)?(?:\d{1,3}\s*[.)\-:]\s*|[-*•·▪►>]+\s*|\p{Extended_Pictographic}️?\s*)+/u
const SEPARATORS = [' - ', ' – ', ' — ', ' / ', ' by ', ' de ']

/** Entiende listas pegadas desde WhatsApp, notas o Drive: una canción por línea, con o sin artista. */
export function parseSetlistText(text: string): ParsedSetlist {
  let name = ''
  const lines: ParsedLine[] = []
  const seen = new Set<string>()

  for (const raw of text.split(/\r?\n/)) {
    // Quita la cabecera de WhatsApp "[10:32, 3/10/2026] Sebas: …"
    const line = raw.replace(/^\[?\d{1,2}[:.]\d{2}[^\]\n]*\]\s*[^:]{1,30}:\s*/, '').replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}[^-\n]*-\s*[^:]{1,30}:\s*/, '').trim()
    if (line.length < 2) continue
    // Un encabezado tipo "Setlist Bar La Esquina:" da nombre al setlist.
    if (/:\s*$/.test(line) || /^setlist\b/i.test(line)) {
      if (!name) name = line.replace(/:\s*$/, '').replace(/^setlist\s*[:\-–]?\s*/i, '').trim()
      continue
    }
    let rest = line.replace(LEAD, '').trim()
    if (rest.length < 2 || /^https?:\/\//i.test(rest)) continue

    let title = rest
    let artist = ''
    const paren = rest.match(/^(.*?)\s*\(([^)]{2,60})\)\s*$/)
    if (paren) { title = paren[1]; artist = paren[2] }
    else {
      for (const sep of SEPARATORS) {
        const i = rest.toLowerCase().indexOf(sep)
        if (i > 0) { title = rest.slice(0, i); artist = rest.slice(i + sep.length); break }
      }
    }
    title = title.replace(/^["“”']|["“”']$/g, '').trim().slice(0, 120)
    artist = artist.trim().slice(0, 120)
    rest = ''
    const key = norm(title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    lines.push({ title, artist })
  }
  return { name: name.slice(0, 80), lines }
}

export type Match = { line: ParsedLine; song?: Song }

/** Empareja cada línea con una canción del repertorio por título. */
export function matchSongs(lines: ParsedLine[], songs: Song[]): Match[] {
  const byTitle = new Map(songs.map((s) => [norm(s.title), s]))
  return lines.map((line) => ({ line, song: byTitle.get(norm(line.title)) }))
}
