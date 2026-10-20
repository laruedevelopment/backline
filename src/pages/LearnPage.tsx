import { useState } from 'react'
import { Link } from 'react-router-dom'
import { instruments, lessons, levelName, type InstrumentId } from '../lib/learn'
import { useProgress } from '../store/useProgress'

export default function LearnPage() {
  const [inst, setInst] = useState<InstrumentId>('guitarra')
  const done = useProgress((s) => s.done)
  const list = lessons.filter((l) => l.instrument === inst)
  const finished = list.filter((l) => done.includes(l.id)).length
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Práctica</span>
        <h1 className="page-title">Aprender</h1>
        <p className="page-sub">Lecciones cortas con diagrama y metrónomo. Sube el tempo solo cuando salga limpio.</p>
      </div>
      <div className="tabs" role="group" aria-label="Instrumento">
        {instruments.map((i) => (
          <button key={i.id} aria-pressed={inst === i.id} className={inst === i.id ? 'active' : ''} onClick={() => setInst(i.id)}>{i.name}</button>
        ))}
      </div>
      <div className="meter" role="img" aria-label={`${finished} de ${list.length} lecciones completadas`} style={{ marginTop: 16 }}>
        <i style={{ width: `${list.length ? (finished / list.length) * 100 : 0}%` }} />
      </div>
      <p className="eyebrow" style={{ marginTop: 6 }}>{finished} de {list.length} completadas</p>

      {([1, 2, 3] as const).map((lv) => {
        const items = list.filter((l) => l.level === lv)
        if (!items.length) return null
        return (
          <section key={lv}>
            <h2 className="section-title">{levelName[lv]}</h2>
            <div className="list cols">
              {items.map((l) => (
                <Link key={l.id} to={`/aprender/${l.id}`} className="li">
                  <span className={`dot ${done.includes(l.id) ? 'ready' : 'paused'}`} role="img" aria-label={done.includes(l.id) ? 'Completada' : 'Pendiente'} />
                  <div className="li-main">
                    <div className="li-title">{l.title}</div>
                    <div className="li-sub">{l.goal}</div>
                  </div>
                  <div className="readout"><b>{l.minutes}′</b>{l.bpm.start}→{l.bpm.goal}</div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
      {list.length < 3 && <p className="notice" style={{ marginTop: 24 }}>Estamos sumando más lecciones de {instruments.find((i) => i.id === inst)?.name.toLowerCase()}.</p>}
    </>
  )
}
