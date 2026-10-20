import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { lessons } from '../lib/learn'
import { useProgress } from '../store/useProgress'
import DiagramView from '../components/diagrams/DiagramView'
import Metronome from '../components/Metronome'

export default function LessonPage() {
  const { id } = useParams()
  const lesson = lessons.find((l) => l.id === id)
  const { done, toggle } = useProgress()
  if (!lesson) return <p className="empty">No encontramos esa lección. <Link to="/aprender">Volver a Aprender</Link></p>
  const isDone = done.includes(lesson.id)
  return (
    <>
      <Link to="/aprender" className="back"><ArrowLeft size={18} aria-hidden /> Aprender</Link>
      <h1 className="page-title">{lesson.title}</h1>
      <p className="page-sub">{lesson.goal}</p>
      {lesson.diagram && <div className="card"><DiagramView diagram={lesson.diagram} /></div>}
      <h2 className="section-title">Paso a paso</h2>
      <ol className="steps">
        {lesson.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <h2 className="section-title">Metrónomo</h2>
      {/* key: reinicia el metrónomo al cambiar de lección */}
      <Metronome key={lesson.id} start={lesson.bpm.start} goal={lesson.bpm.goal} />
      <button className={`btn ${isDone ? '' : 'primary'}`} style={{ marginTop: 20, width: '100%' }} onClick={() => toggle(lesson.id)}>
        <Check size={20} aria-hidden /> {isDone ? 'Completada · deshacer' : 'Marcar como completada'}
      </button>
    </>
  )
}
