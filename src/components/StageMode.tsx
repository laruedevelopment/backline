import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw, X } from 'lucide-react'
import { parseChart, transposeChordLine, transposeLabel, type ChartLine } from '../lib/chart'
import { instrumentOptions } from '../lib/identity'
import { instrumentKind, noteFor, otherNotes, tuningsFor } from '../lib/instrument'
import type { StageSong } from '../lib/setlistItems'
import { isStandard, keyChangeLabel, tuningSignature, tuningSummary, type Song } from '../lib/song'

const SIZE_KEY = 'backline-stage-size-v2'
const INSTR_KEY = 'backline-stage-instrument'
const MIN_SIZE = 16, MAX_SIZE = 72, DEFAULT_SIZE = 32
const readSize = () => { try { const n = Number(localStorage.getItem(SIZE_KEY)); return n >= MIN_SIZE && n <= MAX_SIZE ? n : DEFAULT_SIZE } catch { return DEFAULT_SIZE } }
const readInstrument = () => { try { return localStorage.getItem(INSTR_KEY) } catch { return null } }

/** Letra y acordes en bloques centrados: cada línea de acordes va pegada a su letra (se alinean por columna). */
type Block = { kind: 'pair'; lines: { text: string; chords: boolean }[] } | { kind: 'section'; text: string } | { kind: 'line'; text: string } | { kind: 'gap' }
function toBlocks(chart: ChartLine[], shiftLine: (s: string) => string, mono: boolean): Block[] {
  const out: Block[] = []
  for (let k = 0; k < chart.length; k++) {
    const l = chart[k]
    if (l.kind === 'blank') out.push({ kind: 'gap' })
    else if (l.kind === 'section') out.push({ kind: 'section', text: l.text })
    else if (l.kind === 'chords') {
      const nextLine = chart[k + 1]
      if (nextLine?.kind === 'lyric') { out.push({ kind: 'pair', lines: [{ text: shiftLine(l.text), chords: true }, { text: nextLine.text, chords: false }] }); k++ } else out.push({ kind: 'pair', lines: [{ text: shiftLine(l.text), chords: true }] })
    } else out.push(mono ? { kind: 'pair', lines: [{ text: l.text, chords: false }] } : { kind: 'line', text: l.text })
  }
  // Una sección sin letra debajo (por ejemplo «Intro» para la voz) se omite.
  return out.filter((b, k) => b.kind !== 'section' || out.slice(k + 1).find((x) => x.kind !== 'gap')?.kind === 'pair' || out.slice(k + 1).find((x) => x.kind !== 'gap')?.kind === 'line')
}

/** Pantalla limpia para el toque: canción actual en grande, tono, afinación y la siguiente. */
/** `instrument`: lo que toca quien lo abre. Con eso ve primero lo suyo: su afinación, su nota y, según el instrumento, la letra o los acordes. */
export default function StageMode({ songs, instrument, onClose }: { songs: StageSong[]; instrument?: string | null; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(readInstrument)
  const [picking, setPicking] = useState(false)
  const who = instrument || picked // lo que toca esta persona: el de la banda o el que eligió aquí
  const [mine, setMine] = useState(true)
  const [vw, setVw] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setVw(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const [shift, setShift] = useState(0)
  const [size, setSize] = useState(readSize)
  const [forced, setForced] = useState(false) // giro por CSS cuando el navegador no deja bloquear la orientación
  const [locked, setLocked] = useState(false)
  const cur = songs[i]
  const next = songs[i + 1]
  // Deslizar a los lados cambia de canción (en el celular no hay teclado). Se ignora si el dedo empezó sobre la letra y fue un desplazamiento vertical.
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null)
  const onSwipeEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0]
    if (touch && t) {
      const dx = t.clientX - touch.x, dy = t.clientY - touch.y
      if (Math.abs(dx) > 80 && Math.abs(dy) < 50) { if (dx < 0 && i < songs.length - 1) go(i + 1); else if (dx > 0 && i > 0) go(i - 1) }
    }
    setTouch(null)
  }
  const view = mine && who ? who : null
  const kind = view ? instrumentKind(view) : 'melodic'
  // La batería no lee acordes ni letra; la voz lee la letra sin acordes.
  const chart = useMemo(() => {
    const all = cur.lyrics ? parseChart(cur.lyrics) : []
    return kind === 'rhythm' ? [] : kind === 'voice' ? all.filter((l) => l.kind !== 'chords') : all
  }, [cur.lyrics, kind])
  const forView = (s: Song): Song => (view ? { ...s, tunings: tuningsFor(s, view) } : s)
  const myNote = view ? noteFor(cur, view) : ''
  // En «mi vista» solo lo mío; las notas de los demás instrumentos se ven en «Todo».
  const others = view ? [] : otherNotes(cur, null)
  const hasChords = chart.some((l) => l.kind === 'chords')
  // Estructura de la canción (para quien no lee la letra, como la batería).
  const sections = useMemo(() => (cur.lyrics ? parseChart(cur.lyrics).filter((l) => l.kind === 'section').map((l) => l.text) : []), [cur.lyrics])
  const blocks = useMemo(() => toBlocks(chart, (t) => transposeChordLine(t, shift), hasChords), [chart, shift, hasChords])
  // Con acordes la letra va en monoespaciada (para alinear) y se reduce lo justo para que cada línea quepa sin desplazarse de lado.
  const stageW = (forced ? window.innerHeight : vw) - 40
  const longest = Math.max(1, ...blocks.flatMap((b) => (b.kind === 'pair' ? b.lines.map((l) => l.text.length) : [])))
  const chartSize = hasChords ? Math.max(14, Math.min(size, Math.floor(stageW / (longest * 0.62)))) : size
  const pickInstrument = (name: string | null) => {
    setPicked(name)
    setMine(!!name)
    setPicking(false)
    setShift(0)
    try { if (name) localStorage.setItem(INSTR_KEY, name); else localStorage.removeItem(INSTR_KEY) } catch { /* solo en memoria */ }
  }

  // Cada canción empieza en su tono original.
  const go = (n: number) => { setI(n); setShift(0) }
  const resize = (d: number) => setSize((v) => { const n = Math.min(MAX_SIZE, Math.max(MIN_SIZE, v + d)); try { localStorage.setItem(SIZE_KEY, String(n)) } catch { /* solo en memoria */ } return n })

  async function rotate() {
    // Android (instalada o en pantalla completa) deja bloquear la orientación; iPhone no: ahí se gira la vista por CSS.
    if (locked || forced) {
      try { screen.orientation.unlock() } catch { /* sin bloqueo activo */ }
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      setLocked(false); setForced(false)
      return
    }
    const landscape = window.matchMedia('(orientation: landscape)').matches
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      await (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock(landscape ? 'portrait' : 'landscape')
      setLocked(true)
    } catch {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      setForced(true)
    }
  }
  useEffect(() => () => {
    try { screen.orientation.unlock() } catch { /* nada que liberar */ }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [])

  // Mantiene la pantalla encendida mientras se toca.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    const ask = () => navigator.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    void ask()
    const onVisible = () => document.visibilityState === 'visible' && void ask()
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); void lock?.release() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setI((v) => Math.min(songs.length - 1, v + 1)); setShift(0) }
      if (e.key === 'ArrowLeft') { setI((v) => Math.max(0, v - 1)); setShift(0) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [songs.length, onClose])

  const retune = next && tuningSignature(forView(next)) !== tuningSignature(forView(cur))

  return (
    <div className={`stage ${forced ? 'rotated' : ''}`} role="dialog" aria-modal="true" aria-label="Modo escenario"
      onTouchStart={(e) => setTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={onSwipeEnd}>
      <div className="stage-top">
        <span>{i + 1} / {songs.length}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setPicking((v) => !v)} aria-expanded={picking} aria-label={view ? `Vista de ${view}. Cambiar de instrumento` : 'Elegir mi instrumento'}>
            {view ?? 'Mi vista'}
          </button>
          <button className="btn" onClick={() => void rotate()} aria-label="Girar la pantalla" aria-pressed={locked || forced}><RotateCw size={20} aria-hidden /></button>
          <button className="btn" onClick={onClose} aria-label="Salir del modo escenario"><X size={20} aria-hidden /></button>
        </div>
      </div>
      {(picking || !who) && (
        <div className="stage-pick" role="group" aria-label="Qué tocas">
          <span>{who ? 'Ver lo mío:' : '¿Qué tocas? Así ves solo lo tuyo:'}</span>
          {instrumentOptions.filter((o) => o !== 'Otro').map((o) => (
            <button key={o} type="button" className={`tag ${view === o ? 'key' : ''}`} aria-pressed={view === o} onClick={() => pickInstrument(o)}>{o}</button>
          ))}
          <button type="button" className={`tag ${!view && who ? 'key' : ''}`} onClick={() => { setMine(false); setPicking(false) }}>Todo</button>
        </div>
      )}
      <div className={`stage-main ${chart.length ? 'has-chart' : ''}`}>
        {retune && next && (
          <div className="stage-banner" role="alert">{isStandard(forView(next)) ? 'Después: vuelve a E estándar' : `Después: cambia a ${tuningSummary(forView(next))}`}</div>
        )}
        {cur.before?.map((t) => <div key={t} className="stage-label" role="note"><b>Antes</b>{t}</div>)}
        <h1 className={`stage-title ${chart.length ? 'compact' : ''}`}>{cur.title}</h1>
        <div className="stage-artist">{cur.artist}</div>
        {cur.tags && cur.tags.length > 0 && <div className="stage-tags">{cur.tags.map((t) => <span key={t}>{t}</span>)}</div>}
        <div className="stage-chips">
          {cur.key && <span className="stage-chip key">{cur.key}</span>}
          <span className="stage-chip">{cur.bpm} bpm</span>
          <span className="stage-chip">{tuningSummary(forView(cur))}</span>
        </div>
        {cur.keyChanges.map((k, n) => <div key={n} className="stage-warn">Cambio de tono: {keyChangeLabel(k)}</div>)}
        {cur.guest && <div className="stage-artist">{cur.guest}</div>}
        {kind === 'rhythm' && sections.length > 0 && <p className="stage-structure"><b>Estructura</b>{sections.join(' · ')}</p>}
        {myNote && <p className="stage-mynote"><b>Para ti · {view}</b>{myNote}</p>}
        {cur.notes && <p className="stage-notes">{cur.notes}</p>}
        {cur.after?.map((t) => <div key={t} className="stage-label" role="note"><b>Al terminar</b>{t}</div>)}
        {others.length > 0 && (
          <ul className="stage-others" aria-label="Notas de los demás instrumentos">
            {others.map(([k, v]) => <li key={k}><b>{k}</b> {v}</li>)}
          </ul>
        )}
        {chart.length > 0 && (
          <>
            <div className="stage-tools" role="group" aria-label="Letra y acordes">
              <button className="btn" onClick={() => resize(-2)} aria-label="Letra más pequeña"><Minus size={18} aria-hidden /></button>
              <span aria-hidden>Aa</span>
              <button className="btn" onClick={() => resize(2)} aria-label="Letra más grande"><Plus size={18} aria-hidden /></button>
              {hasChords && (
                <>
                  <span className="sep" aria-hidden />
                  <button className="btn" onClick={() => setShift((v) => Math.max(-11, v - 1))} aria-label="Bajar un semitono"><Minus size={18} aria-hidden /></button>
                  <span aria-live="polite" aria-label={`Tono ${transposeLabel(shift)}`}>{transposeLabel(shift)}</span>
                  <button className="btn" onClick={() => setShift((v) => Math.min(11, v + 1))} aria-label="Subir un semitono"><Plus size={18} aria-hidden /></button>
                </>
              )}
            </div>
            <div className={`chart ${hasChords ? 'mono' : 'prose'}`} style={{ fontSize: chartSize }} tabIndex={0} aria-label="Letra y acordes">
              {blocks.map((b, n) => b.kind === 'gap' ? <div key={n} className="chart-gap" />
                : b.kind === 'section' ? <div key={n} className="chart-section">{b.text}</div>
                : b.kind === 'line' ? <div key={n} className="chart-lyric">{b.text}</div>
                : (
                  <div key={n} className="chart-pair">
                    {b.lines.map((l, k) => <div key={k} className={l.chords ? 'chart-chords' : 'chart-lyric'}>{l.text || ' '}</div>)}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
      <div className="stage-next">
        {next ? (
          <>
            <span>Sigue: {next.before && next.before.length > 0 && <em>{next.before.join(' · ')} → </em>}<b>{next.title}</b></span>
          </>
        ) : <span>Última canción</span>}
      </div>
      <div className="stage-nav">
        <button className="btn" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft size={28} aria-hidden /> Anterior</button>
        <button className="btn primary" disabled={i === songs.length - 1} onClick={() => go(i + 1)}>Siguiente <ChevronRight size={28} aria-hidden /></button>
      </div>
    </div>
  )
}
