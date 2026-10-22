import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Columns2, Minus, Pause, Play, Plus, RotateCw, Scan, Sun, X } from 'lucide-react'
import { useKeepAwake } from '../lib/keepAwake'
import { parseChart, transposeChordLine, transposeLabel, type ChartLine } from '../lib/chart'
import { instrumentOptions } from '../lib/identity'
import { instrumentKind, noteFor, otherNotes, tuningsFor } from '../lib/instrument'
import type { StageSong } from '../lib/setlistItems'
import { isStandard, keyChangeLabel, tuningSignature, tuningSummary, type Song } from '../lib/song'

const SIZE_KEY = 'backline-stage-size-v2'
const INSTR_KEY = 'backline-stage-instrument'
const MIN_SIZE = 16, MAX_SIZE = 72, DEFAULT_SIZE = 32
const MIN_FIT = 20 // «Ajustar» no baja de aquí: si no cabe, la letra queda en páginas legibles en vez de diminuta
const readSize = () => { try { const n = Number(localStorage.getItem(SIZE_KEY)); return n >= MIN_SIZE && n <= MAX_SIZE ? n : DEFAULT_SIZE } catch { return DEFAULT_SIZE } }
const readInstrument = () => { try { return localStorage.getItem(INSTR_KEY) } catch { return null } }
const COLS_KEY = 'backline-stage-cols'
const FIT_KEY = 'backline-stage-fit'
const COLUMN_GAP = 48 // px; igual que en el CSS de .chart.cols2
const readCols = (): 1 | 2 => { try { return localStorage.getItem(COLS_KEY) === '2' ? 2 : 1 } catch { return 1 } }
const readFit = () => { try { return localStorage.getItem(FIT_KEY) === '1' } catch { return false } }
const remember = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* solo en memoria */ } }

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
  const [cols, setCols] = useState<1 | 2>(readCols)
  const [fit, setFit] = useState(readFit)
  const [autoId, setAutoId] = useState<string | null>(null) // canción que se desplaza sola (se detiene al cambiar de canción)
  const [speed, setSpeed] = useState(1)
  const [awakeNote, setAwakeNote] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)
  const awake = useKeepAwake(true)
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
  // Girar la pantalla solo tiene sentido en celulares y tabletas (táctiles o de pantalla angosta), no en un computador.
  const canRotate = forced || locked || window.matchMedia('(pointer: coarse)').matches || vw < 900
  const columns: 1 | 2 = cols === 2 && vw >= 700 ? 2 : 1
  const playing = autoId === cur.id
  // Con la letra ajustada o en dos páginas no hay desplazamiento: se muestra solo una línea con lo esencial y la letra ocupa todo.
  // En el modo normal la información va dentro del mismo desplazamiento que la letra: sale sola al bajar, sin saltos ni líneas cortadas.
  const compact = chart.length > 0 && (fit || columns === 2)
  const infoRef = useRef<HTMLDivElement>(null)
  // Estructura de la canción (para quien no lee la letra, como la batería).
  const sections = useMemo(() => (cur.lyrics ? parseChart(cur.lyrics).filter((l) => l.kind === 'section').map((l) => l.text) : []), [cur.lyrics])
  const blocks = useMemo(() => toBlocks(chart, (t) => transposeChordLine(t, shift), hasChords), [chart, shift, hasChords])
  // Con acordes la letra va en monoespaciada (para alinear) y se reduce lo justo para que cada línea quepa sin desplazarse de lado.
  const stageW = ((forced ? window.innerHeight : vw) - 40 - (columns === 2 ? COLUMN_GAP : 0)) / columns
  const longest = Math.max(1, ...blocks.flatMap((b) => (b.kind === 'pair' ? b.lines.map((l) => l.text.length) : [])))
  const chartSize = hasChords ? Math.max(14, Math.min(size, Math.floor(stageW / (longest * 0.62)))) : size
  const toggleCols = () => setCols((c) => { const n = c === 2 ? 1 : 2; remember(COLS_KEY, String(n)); return n })
  const toggleFit = () => setFit((f) => { remember(FIT_KEY, f ? '0' : '1'); return !f })
  const togglePlay = () => setAutoId((a) => (a === cur.id ? null : cur.id))

  // «Ajustar»: el mayor tamaño de letra con el que toda la canción cabe en pantalla sin desplazarse (en una o en dos páginas).
  useLayoutEffect(() => {
    const el = chartRef.current
    if (!el || !fit) return
    const fits = (n: number) => {
      el.style.fontSize = `${n}px`
      return columns === 2 ? el.scrollWidth <= el.clientWidth + 2 : el.scrollHeight <= el.clientHeight + 2
    }
    let lo = MIN_FIT, hi = hasChords ? Math.min(MAX_SIZE, Math.floor(stageW / (longest * 0.62))) : MAX_SIZE, best = MIN_FIT
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (fits(mid)) { best = mid; lo = mid + 1 } else hi = mid - 1
    }
    el.style.fontSize = `${Math.max(12, best)}px`
  }, [fit, columns, cur.id, blocks, vw, compact, stageW, longest, hasChords])

  // Páginas (en dos columnas): cuántas hay y en cuál estás, para saber siempre si falta letra por ver.
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1 })
  const measurePages = () => {
    const el = chartRef.current
    if (!el || columns !== 2) { setPageInfo((v) => (v.pages === 1 && v.page === 1 ? v : { page: 1, pages: 1 })); return }
    const step = el.clientWidth + COLUMN_GAP
    const pages = Math.max(1, Math.ceil((el.scrollWidth + COLUMN_GAP - 4) / step))
    const page = Math.min(pages, Math.round(el.scrollLeft / step) + 1)
    setPageInfo((v) => (v.pages === pages && v.page === page ? v : { page, pages }))
  }
  useEffect(() => {
    const id = requestAnimationFrame(measurePages)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, blocks, vw, fit, size, compact, cur.id, shift])

  // La rueda del ratón (vertical) pasa de página cuando la letra está en dos páginas.
  useEffect(() => {
    const el = chartRef.current
    if (!el || columns !== 2) return
    let last = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = e.deltaY || e.deltaX
      const now = performance.now()
      if (Math.abs(d) < 4 || now - last < 450) return // un giro de rueda = una página
      last = now
      el.scrollBy({ left: Math.sign(d) * (el.clientWidth + COLUMN_GAP), behavior: 'smooth' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [columns, cur.id, compact, chart.length])

  // Desplazamiento automático: recorre la letra durante lo que dura la canción (con la velocidad elegida). En dos páginas cambia de página a ese ritmo.
  useEffect(() => {
    const el = chartRef.current
    if (!playing || !el) return
    const seconds = Math.max(40, (cur.minutes || 4) * 60) * 0.92
    if (columns === 2) {
      const page = el.clientWidth + COLUMN_GAP
      const pages = Math.max(1, Math.ceil((el.scrollWidth + COLUMN_GAP) / page))
      if (pages <= 1) return
      const timer = window.setInterval(() => {
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) { setAutoId(null); return }
        el.scrollBy({ left: page, behavior: 'smooth' })
      }, (seconds / pages / speed) * 1000)
      return () => window.clearInterval(timer)
    }
    let raf = 0
    let last = performance.now()
    const start = infoRef.current?.offsetHeight ?? 0 // la letra empieza debajo de la información de la canción
    let pos = Math.max(el.scrollTop, start)
    el.scrollTop = pos
    const tick = (now: number) => {
      const total = el.scrollHeight - el.clientHeight
      if (total <= 0) return
      if (Math.abs(el.scrollTop - pos) > 3) pos = el.scrollTop // la persona movió la letra: se sigue desde ahí
      pos += (Math.max(1, total - start) / seconds) * speed * ((now - last) / 1000)
      last = now
      if (pos >= total) { el.scrollTop = total; setAutoId(null); return }
      el.scrollTop = pos
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, columns, cur.id, cur.minutes, speed])

  useLayoutEffect(() => {
    const el = chartRef.current, info = infoRef.current
    if (!el || !info || !window.matchMedia('(max-height: 520px)').matches) return
    el.scrollTop = info.offsetHeight
  }, [cur.id, compact])

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

  // Adelante / atrás: baja o cambia de página; al llegar al final pasa a la siguiente canción (así un pedal de página o las flechas bastan para todo el toque).
  const move = (dir: 1 | -1) => {
    const el = chartRef.current
    if (el && chart.length > 0) {
      if (columns === 2) {
        const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
        const atStart = el.scrollLeft <= 4
        if (dir === 1 ? !atEnd : !atStart) { el.scrollBy({ left: dir * (el.clientWidth + COLUMN_GAP), behavior: 'smooth' }); return }
      } else {
        const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
        const atStart = el.scrollTop <= 4
        if (dir === 1 ? !atEnd : !atStart) { el.scrollBy({ top: dir * el.clientHeight * 0.85, behavior: 'smooth' }); return }
      }
    }
    if (dir === 1 && i < songs.length - 1) go(i + 1)
    else if (dir === -1 && i > 0) go(i - 1)
  }
  const moveRef = useRef(move)
  useEffect(() => { moveRef.current = move })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); moveRef.current(1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); moveRef.current(-1) }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const layoutControls = chart.length > 0 && (
    <>
      {vw >= 700 && (
        <button type="button" className={`btn sm ${columns === 2 ? 'on' : ''}`} aria-pressed={columns === 2} onClick={toggleCols} aria-label="Mostrar la letra en dos páginas"><Columns2 size={16} aria-hidden /> <span className="hide-sm">2 págs</span></button>
      )}
      <button type="button" className={`btn sm ${fit ? 'on' : ''}`} aria-pressed={fit} onClick={toggleFit} aria-label="Ajustar toda la letra a la pantalla"><Scan size={16} aria-hidden /> <span className="hide-sm">Ajustar</span></button>
      <button type="button" className={`btn sm ${playing ? 'on' : ''}`} aria-pressed={playing} onClick={togglePlay} aria-label={playing ? 'Pausar el desplazamiento automático' : 'Desplazar la letra sola, al ritmo de la canción'}>
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />} <span className="hide-sm">Auto</span>
      </button>
      {playing && (
        <>
          <button type="button" className="btn sm" onClick={() => setSpeed((v) => Math.max(0.5, Math.round((v - 0.25) * 100) / 100))} aria-label="Más lento"><Minus size={14} aria-hidden /></button>
          <span className="speed" aria-live="polite">{speed}×</span>
          <button type="button" className="btn sm" onClick={() => setSpeed((v) => Math.min(2, Math.round((v + 0.25) * 100) / 100))} aria-label="Más rápido"><Plus size={14} aria-hidden /></button>
        </>
      )}
    </>
  )

  const showInfo = () => {
    if (compact) { setFit(false); setCols(1); remember(FIT_KEY, '0'); remember(COLS_KEY, '1') }
    chartRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Lo que va arriba de la letra: se desplaza junto con ella y sale solo al bajar.
  const infoNode = (
    <>
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
      {cur.personal && <p className="stage-mynote personal"><b>Mi anotación</b>{cur.personal}</p>}
      {myNote && <p className="stage-mynote"><b>Para ti · {view}</b>{myNote}</p>}
      {cur.notes && <p className="stage-notes">{cur.notes}</p>}
      {cur.after?.map((t) => <div key={t} className="stage-label" role="note"><b>Al terminar</b>{t}</div>)}
      {others.length > 0 && (
        <ul className="stage-others" aria-label="Notas de los demás instrumentos">
          {others.map(([k, v]) => <li key={k}><b>{k}</b> {v}</li>)}
        </ul>
      )}
      {chart.length > 0 && hasChords && (
        <div className="stage-tools" role="group" aria-label="Tono de los acordes">
          <button className="btn" onClick={() => setShift((v) => Math.max(-11, v - 1))} aria-label="Bajar un semitono"><Minus size={18} aria-hidden /></button>
          <span aria-live="polite" aria-label={`Tono ${transposeLabel(shift)}`}>Tono {transposeLabel(shift)}</span>
          <button className="btn" onClick={() => setShift((v) => Math.min(11, v + 1))} aria-label="Subir un semitono"><Plus size={18} aria-hidden /></button>
        </div>
      )}
    </>
  )

  // Barra fina siempre a la vista junto a la letra: lo esencial de la canción y los controles de lectura.
  const miniBar = (
    <div className={`stage-mini ${compact ? '' : 'sticky'}`}>
      <span className="mini-title"><b>{cur.title}</b>{cur.key ? ` · ${cur.key}` : ''} · {cur.bpm} bpm</span>
      <span className="mini-actions">
        {columns === 2 && pageInfo.pages > 1 && (
          <>
            <button type="button" className="btn sm" disabled={pageInfo.page <= 1} onClick={() => move(-1)} aria-label="Página anterior"><ChevronLeft size={16} aria-hidden /></button>
            <span className="speed" role="status" aria-label={`Página ${pageInfo.page} de ${pageInfo.pages}`}>{pageInfo.page}/{pageInfo.pages}</span>
            <button type="button" className="btn sm" disabled={pageInfo.page >= pageInfo.pages} onClick={() => move(1)} aria-label="Página siguiente"><ChevronRight size={16} aria-hidden /></button>
          </>
        )}
        <button type="button" className="btn sm" onClick={() => resize(-3)} aria-label="Letra más pequeña"><Minus size={14} aria-hidden /></button>
        <span aria-hidden className="aa">Aa</span>
        <button type="button" className="btn sm" onClick={() => resize(3)} aria-label="Letra más grande"><Plus size={14} aria-hidden /></button>
        {layoutControls}
        <button type="button" className="btn sm" onClick={showInfo} aria-label="Volver a la información de la canción">Info</button>
      </span>
    </div>
  )

  const retune = next && tuningSignature(forView(next)) !== tuningSignature(forView(cur))

  return (
    <div className={`stage ${forced ? 'rotated' : ''}`} role="dialog" aria-modal="true" aria-label="Modo escenario"
      onTouchStart={(e) => setTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={onSwipeEnd}>
      <div className="stage-top">
        <span>{i + 1} / {songs.length}{awake !== 'off' && <Sun size={13} aria-label="Pantalla encendida" style={{ marginLeft: 8, verticalAlign: -1, color: 'var(--amber)' }} />}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setPicking((v) => !v)} aria-expanded={picking} aria-label={view ? `Vista de ${view}. Cambiar de instrumento` : 'Elegir mi instrumento'}>
            {view ?? 'Mi vista'}
          </button>
          {canRotate && <button className="btn" onClick={() => void rotate()} aria-label="Girar la pantalla" aria-pressed={locked || forced}><RotateCw size={20} aria-hidden /></button>}
          <button className="btn" onClick={onClose} aria-label="Salir del modo escenario"><X size={20} aria-hidden /></button>
        </div>
      </div>
      {awake === 'off' && awakeNote && (
        <div className="stage-note" role="status">
          <span>Este navegador no dejó mantener la pantalla encendida. Sube el tiempo de apagado de pantalla en los ajustes del teléfono.</span>
          <button type="button" className="btn sm" onClick={() => setAwakeNote(false)}>Entendido</button>
        </div>
      )}
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
        {chart.length === 0 && <div className="stage-info">{infoNode}</div>}
        {chart.length > 0 && compact && miniBar}
        {chart.length > 0 && (
          <div key={cur.id} ref={chartRef} className={`chart ${hasChords ? 'mono' : 'prose'} ${columns === 2 ? 'cols2' : ''} ${fit && pageInfo.pages === 1 ? 'fitted' : ''} ${playing ? 'auto' : ''}`} style={{ fontSize: fit ? undefined : chartSize }} tabIndex={0} aria-label="Letra y acordes" onScroll={measurePages}>
            {!compact && <div ref={infoRef} className="stage-info in-scroll">{infoNode}</div>}
            {!compact && miniBar}
            {blocks.map((b, n) => b.kind === 'gap' ? <div key={n} className="chart-gap" />
              : b.kind === 'section' ? <div key={n} className="chart-section">{b.text}</div>
              : b.kind === 'line' ? <div key={n} className="chart-lyric">{b.text}</div>
              : (
                <div key={n} className="chart-pair">
                  {b.lines.map((l, k) => <div key={k} className={l.chords ? 'chart-chords' : 'chart-lyric'}>{l.text || ' '}</div>)}
                </div>
              ))}
          </div>
        )}
      </div>
      {retune && next && (
        <div className="stage-banner" role="alert">{isStandard(forView(next)) ? 'Después: vuelve a E estándar' : `Después: cambia a ${tuningSummary(forView(next))}`}</div>
      )}
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
