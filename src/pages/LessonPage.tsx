import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { instruments, lessons, levelName } from '../lib/learn'
import { useProgress } from '../store/useProgress'
import DiagramView from '../components/diagrams/DiagramView'
import Metronome from '../components/Metronome'

export default function LessonPage() {
  const { id } = useParams()
  const lesson = lessons.find((l) => l.id === id)
  const { done, toggle, best, setBest } = useProgress()
  const [bpm, setBpm] = useState(0)
  if (!lesson) return <p className="empty">No encontramos esa lección. <Link to="/aprender" style={{ color: 'var(--amber)' }}>Volver a Aprender</Link></p>
  const isDone = done.includes(lesson.id)
  const inst = instruments.find((i) => i.id === lesson.instrument)?.name
  return (
    <>
      <Link to="/aprender" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Aprender</Link>
      <div className="page-head" style={{ paddingTop: 6 }}>
        <span className="eyebrow">{inst} · {levelName[lesson.level]} · {lesson.minutes} min</span>
        <h1 className="page-title">{lesson.title}</h1>
        <p className="page-sub">{lesson.goal}</p>
      </div>
      {lesson.diagram && <div className="card"><DiagramView diagram={lesson.diagram} /></div>}
      <h2 className="section-title">Paso a paso</h2>
      <ol className="steps">
        {lesson.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <h2 className="section-title">Metrónomo</h2>
      {/* key: reinicia el metrónomo al cambiar de lección */}
      <Metronome key={lesson.id} start={lesson.bpm.start} goal={lesson.bpm.goal} onBpm={setBpm} />
      <div className="card stack" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span><b>Mi mejor tempo limpio</b></span>
          <span className="mono">{best[lesson.id] ? `${best[lesson.id]} bpm` : '—'} · meta {lesson.bpm.goal}</span>
        </div>
        <progress max={lesson.bpm.goal - lesson.bpm.start} value={Math.max(0, Math.min(lesson.bpm.goal, best[lesson.id] ?? lesson.bpm.start) - lesson.bpm.start)} aria-label="Avance hacia la meta" style={{ width: '100%' }} />
        <button className="btn" disabled={!bpm || bpm <= (best[lesson.id] ?? 0)} onClick={() => setBest(lesson.id, bpm)}>
          {bpm && bpm > (best[lesson.id] ?? 0) ? `Anotar ${bpm} bpm: me salió limpio` : 'Sube el tempo para anotar un nuevo récord'}
        </button>
        {best[lesson.id] >= lesson.bpm.goal && <p className="form-ok" role="status">¡Meta alcanzada! Marca la lección como completada.</p>}
      </div>
      <button className={`btn block ${isDone ? '' : 'primary'}`} style={{ marginTop: 20 }} onClick={() => toggle(lesson.id)}>
        {isDone ? 'Completada · deshacer' : 'Marcar como completada'}
      </button>
    </>
  )
}
