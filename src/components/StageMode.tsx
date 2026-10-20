import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw, X } from 'lucide-react'
import { parseChart, transposeChordLine, transposeLabel } from '../lib/chart'
import { isStandard, keyChangeLabel, tuningSignature, tuningSummary, type Song } from '../lib/song'

const SIZE_KEY = 'backline-stage-size'
const readSize = () => { try { const n = Number(localStorage.getItem(SIZE_KEY)); return n >= 12 && n <= 40 ? n : 22 } catch { return 22 } }

/** Pantalla limpia para el toque: canción actual en grande, tono, afinación y la siguiente. */
export default function StageMode({ songs, onClose }: { songs: Song[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [shift, setShift] = useState(0)
  const [size, setSize] = useState(readSize)
  const [forced, setForced] = useState(false) // giro por CSS cuando el navegador no deja bloquear la orientación
  const [locked, setLocked] = useState(false)
  const cur = songs[i]
  const next = songs[i + 1]
  const chart = useMemo(() => (cur.lyrics ? parseChart(cur.lyrics) : []), [cur.lyrics])
  const hasChords = chart.some((l) => l.kind === 'chords')

  // Cada canción empieza en su tono original.
  const go = (n: number) => { setI(n); setShift(0) }
  const resize = (d: number) => setSize((v) => { const n = Math.min(40, Math.max(12, v + d)); try { localStorage.setItem(SIZE_KEY, String(n)) } catch { /* solo en memoria */ } return n })

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

  const retune = next && tuningSignature(next) !== tuningSignature(cur)

  return (
    <div className={`stage ${forced ? 'rotated' : ''}`} role="dialog" aria-modal="true" aria-label="Modo escenario">
      <div className="stage-top">
        <span>{i + 1} / {songs.length}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => void rotate()} aria-label="Girar la pantalla" aria-pressed={locked || forced}><RotateCw size={20} aria-hidden /></button>
          <button className="btn" onClick={onClose} aria-label="Salir del modo escenario"><X size={20} aria-hidden /></button>
        </div>
      </div>
      <div className={`stage-main ${chart.length ? 'has-chart' : ''}`}>
        {retune && next && (
          <div className="stage-banner" role="alert">{isStandard(next) ? 'Después: vuelve a E estándar' : `Después: cambia a ${tuningSummary(next)}`}</div>
        )}
        <h1 className={`stage-title ${chart.length ? 'compact' : ''}`}>{cur.title}</h1>
        <div className="stage-artist">{cur.artist}</div>
        <div className="stage-chips">
          {cur.key && <span className="stage-chip key">{cur.key}</span>}
          <span className="stage-chip">{cur.bpm} bpm</span>
          <span className="stage-chip">{tuningSummary(cur)}</span>
        </div>
        {cur.keyChanges.map((k, n) => <div key={n} className="stage-warn">Cambio de tono: {keyChangeLabel(k)}</div>)}
        {cur.guest && <div className="stage-artist">{cur.guest}</div>}
        {cur.notes && <p className="stage-notes">{cur.notes}</p>}
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
            <div className="chart" style={{ fontSize: size }} tabIndex={0} aria-label="Letra y acordes">
              {chart.map((l, n) => l.kind === 'blank'
                ? <div key={n} className="chart-gap" />
                : <div key={n} className={`chart-${l.kind}`}>{l.kind === 'chords' ? transposeChordLine(l.text, shift) : l.text}</div>)}
            </div>
          </>
        )}
      </div>
      <div className="stage-next">
        {next ? (
          <>
            <span>Sigue: <b>{next.title}</b></span>
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
