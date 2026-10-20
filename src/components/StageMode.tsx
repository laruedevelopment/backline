import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { isStandard, keyChangeLabel, tuningSignature, tuningSummary, type Song } from '../lib/song'

/** Pantalla limpia para el toque: canción actual en grande, tono, afinación y la siguiente. */
export default function StageMode({ songs, onClose }: { songs: Song[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const cur = songs[i]
  const next = songs[i + 1]

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
      if (e.key === 'ArrowRight') setI((v) => Math.min(songs.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [songs.length, onClose])

  const retune = next && tuningSignature(next) !== tuningSignature(cur)

  return (
    <div className="stage" role="dialog" aria-modal="true" aria-label="Modo escenario">
      <div className="stage-top">
        <span>{i + 1} / {songs.length}</span>
        <button className="btn" onClick={onClose} aria-label="Salir del modo escenario"><X size={20} aria-hidden /></button>
      </div>
      <div className="stage-main">
        {retune && next && (
          <div className="stage-banner" role="alert">{isStandard(next) ? 'Después: vuelve a E estándar' : `Después: cambia a ${tuningSummary(next)}`}</div>
        )}
        <h1 className="stage-title">{cur.title}</h1>
        <div className="stage-artist">{cur.artist}</div>
        <div className="stage-chips">
          {cur.key && <span className="stage-chip key">{cur.key}</span>}
          <span className="stage-chip">{cur.bpm} bpm</span>
          <span className="stage-chip">{tuningSummary(cur)}</span>
        </div>
        {cur.keyChanges.map((k, n) => <div key={n} className="stage-warn">Cambio de tono: {keyChangeLabel(k)}</div>)}
        {cur.guest && <div className="stage-artist">{cur.guest}</div>}
        {cur.notes && <p className="stage-notes">{cur.notes}</p>}
      </div>
      <div className="stage-next">
        {next ? (
          <>
            <span>Sigue: <b>{next.title}</b></span>
          </>
        ) : <span>Última canción</span>}
      </div>
      <div className="stage-nav">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={28} aria-hidden /> Anterior</button>
        <button className="btn primary" disabled={i === songs.length - 1} onClick={() => setI(i + 1)}>Siguiente <ChevronRight size={28} aria-hidden /></button>
      </div>
    </div>
  )
}
