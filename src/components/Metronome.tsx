import { Minus, Pause, Play, Plus } from 'lucide-react'
import { useMetronome } from '../lib/useMetronome'

export default function Metronome({ start = 80, goal }: { start?: number; goal?: number }) {
  const m = useMetronome(start)
  const set = (v: number) => m.setBpm(Math.min(240, Math.max(30, v)))
  return (
    <div className="card metro">
      <div className="row">
        <button className="btn" aria-label="Bajar 5 bpm" onClick={() => set(m.bpm - 5)}><Minus size={18} aria-hidden /></button>
        <div className="grow bpm-read" aria-live="polite">
          <b>{m.bpm}</b> bpm
          {goal && <span className="sub"> · meta {goal}</span>}
        </div>
        <button className="btn" aria-label="Subir 5 bpm" onClick={() => set(m.bpm + 5)}><Plus size={18} aria-hidden /></button>
      </div>
      <input type="range" min={30} max={240} value={m.bpm} onChange={(e) => set(Number(e.target.value))} aria-label="Tempo" />
      <div className="beats" aria-hidden>
        {Array.from({ length: m.beatsPerBar }, (_, i) => (
          <span key={i} className={m.running && m.beat === i + 1 ? (i === 0 ? 'on accent' : 'on') : ''} />
        ))}
      </div>
      <button className="btn primary" onClick={m.toggle}>
        {m.running ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
        {m.running ? 'Parar' : 'Empezar'}
      </button>
    </div>
  )
}
