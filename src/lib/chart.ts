// Letra y acordes para el modo escenario. La banda escribe el texto como quiera:
//  - acordes en su propia línea, encima de la letra («Am      F»), o
//  - acordes dentro de la letra entre corchetes («Hoy [Am]vuelvo a [F]casa»).
// Aquí se separa en líneas (acordes, letra, sección) y se pueden subir o bajar semitonos.
export type ChartLine = { kind: 'chords' | 'lyric' | 'section' | 'blank'; text: string }

const CHORD = /^[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?\d{0,2}(?:sus[24]?|add\d{1,2}|maj\d{1,2}|[#b]\d{1,2})*(?:\([^)\s]*\))?(?:\/[A-G](?:#|b)?)?$/
const SECTION = /^\s*[[(]?\s*(intro|verso|estrofa|pre-?\s?coro|estribillo|coro|puente|solo|interludio|outro|final|verse|chorus|bridge|pre-?chorus)\b[^\n]{0,24}$/i

const isChordToken = (t: string) => CHORD.test(t)

/** Una línea de acordes: todas sus «palabras» son acordes (se ignoran barras y guiones de compás). */
export function isChordLine(line: string): boolean {
  const tokens = line.split(/[\s|]+/).filter((t) => t && !/^[-–—x\d]+$/i.test(t))
  return tokens.length > 0 && tokens.every(isChordToken)
}

/** «Hoy [Am]vuelvo» → acordes sobre la letra, alineados a la sílaba. */
function splitInline(line: string): { chords: string; lyric: string } | null {
  if (!/\[[A-G][^\]]*\]/.test(line)) return null
  let lyric = '', chords = ''
  const re = /\[([^\]]+)\]/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    lyric += line.slice(last, m.index)
    if (isChordToken(m[1].trim())) {
      chords = chords.padEnd(lyric.length, ' ')
      chords += (chords && !chords.endsWith(' ') ? ' ' : '') + m[1].trim()
    } else lyric += m[0]
    last = m.index + m[0].length
  }
  lyric += line.slice(last)
  // Si ningún corchete era un acorde (p. ej. «[Coro]»), no es una línea con acordes.
  if (!chords.trim()) return null
  return { chords: chords.trimEnd(), lyric: lyric.trimEnd() }
}

export function parseChart(text: string): ChartLine[] {
  const out: ChartLine[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { if (out.length && out[out.length - 1].kind !== 'blank') out.push({ kind: 'blank', text: '' }); continue }
    const inline = splitInline(line)
    if (inline) {
      if (inline.chords) out.push({ kind: 'chords', text: inline.chords })
      if (inline.lyric.trim()) out.push({ kind: 'lyric', text: inline.lyric })
      continue
    }
    if (isChordLine(line)) out.push({ kind: 'chords', text: line })
    else if (SECTION.test(line) || /^\s*\[[^\]]{2,24}\]\s*$/.test(line)) out.push({ kind: 'section', text: line.replace(/^\s*[[(]\s*|\s*[\])]\s*$/g, '').replace(/:$/, '') })
    else out.push({ kind: 'lyric', text: line })
  }
  while (out.length && out[out.length - 1].kind === 'blank') out.pop()
  return out
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const idx = (n: string) => { const i = SHARPS.indexOf(n); return i >= 0 ? i : FLATS.indexOf(n) }

function shiftNote(note: string, by: number, flats: boolean) {
  const i = idx(note)
  if (i < 0) return note
  return (flats ? FLATS : SHARPS)[(((i + by) % 12) + 12) % 12]
}

/** Sube o baja un acorde (con bajo si lo tiene): «F#m7/C#» + 2 → «G#m7/D#». */
export function transposeChord(chord: string, by: number): string {
  if (!by) return chord
  const m = chord.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/)
  if (!m) return chord
  const flats = m[1].includes('b')
  return shiftNote(m[1], by, flats) + m[2] + (m[3] ? `/${shiftNote(m[3], by, flats)}` : '')
}

/** Transpone una línea de acordes conservando, en lo posible, la separación entre ellos. */
export function transposeChordLine(line: string, by: number): string {
  if (!by) return line
  let out = '', pos = 0, growth = 0
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const gap = line.slice(pos, m.index)
    // La separación absorbe lo que creció (o se encogió) el acorde anterior; mínimo un espacio entre acordes.
    out += gap ? ' '.repeat(out ? Math.max(1, gap.length - growth) : gap.length) : ''
    const next = isChordToken(m[0]) ? transposeChord(m[0], by) : m[0]
    growth = next.length - m[0].length
    out += next
    pos = m.index + m[0].length
  }
  return out
}

/** «+2» / «−1» / «Original». */
export const transposeLabel = (n: number) => (n === 0 ? 'Original' : n > 0 ? `+${n}` : `−${Math.abs(n)}`)

/**
 * Parte un par acordes/letra (alineados por columna) en tramos de a lo sumo `max` caracteres, cortando en un espacio de la letra
 * y sin partir un acorde, para que cada acorde siga sobre su sílaba. Con `max` muy chico corta duro.
 */
export function wrapAligned(rows: string[], max: number): string[][] {
  const width = Math.max(...rows.map((r) => r.length))
  if (width <= max || max < 8) return [rows]
  const out: string[][] = []
  let rest = rows.map((r) => r.padEnd(width))
  while (rest[0].length > max) {
    const chordsRow = rest.length > 1 ? rest[0] : ''
    const lyricRow = rest[rest.length - 1]
    let k = -1
    for (let c = max; c >= Math.floor(max / 2); c--) {
      if (lyricRow[c] === ' ' && (!chordsRow || chordsRow[c] === ' ' || chordsRow[c - 1] === ' ')) { k = c; break }
    }
    if (k < 0) k = max
    const head = rest.map((r) => r.slice(0, k).trimEnd())
    const tail = rest.map((r) => r.slice(k))
    const lead = Math.min(...tail.map((r) => (r.trim() ? r.length - r.trimStart().length : r.length)))
    out.push(head)
    rest = tail.map((r) => r.slice(lead))
    if (rest.every((r) => !r.trim())) return out
  }
  out.push(rest.map((r) => r.trimEnd()))
  return out
}
