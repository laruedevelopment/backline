import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { instruments, lessons, levelName, type InstrumentId } from '../lib/learn'
import { useProgress } from '../store/useProgress'

export default function LearnPage() {
  const [inst, setInst] = useState<InstrumentId>('guitarra')
  const done = useProgress((s) => s.done)
  const list = lessons.filter((l) => l.instrument === inst)
  const finished = list.filter((l) => done.includes(l.id)).length
  return (
    <>
      <h1 className="page-title">Aprender</h1>
      <p className="page-sub">Lecciones paso a paso con metrónomo. {finished} de {list.length} completadas.</p>
      <div className="tabs" role="tablist" aria-label="Instrumento">
        {instruments.map((i) => (
          <button key={i.id} role="tab" aria-selected={inst === i.id} className={inst === i.id ? 'active' : ''} onClick={() => setInst(i.id)}>
            {i.name}
          </button>
        ))}
      </div>
      {([1, 2, 3] as const).map((lv) => {
        const items = list.filter((l) => l.level === lv)
        if (!items.length) return null
        return (
          <section key={lv}>
            <h2 className="section-title">{levelName[lv]}</h2>
            <div className="stack">
              {items.map((l) => (
                <Link key={l.id} to={`/aprender/${l.id}`} className="card row">
                  <div className="grow">
                    <div className="title">{l.title}</div>
                    <div className="sub">{l.minutes} min · {l.bpm.start}→{l.bpm.goal} bpm</div>
                  </div>
                  {done.includes(l.id) ? <Check size={20} color="var(--sage)" aria-label="Completada" /> : <ChevronRight size={20} aria-hidden />}
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
