import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, X } from 'lucide-react'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import { isStandard, tuningSignature, tuningSummary } from '../lib/song'
import { ask } from '../lib/confirm'
import StageMode from '../components/StageMode'
import ListSkeleton from '../components/Skeleton'

export default function SetlistDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const band = useActiveBand()
  const { songs } = useSongs(band?.id)
  const { setlists, loading, save, remove } = useSetlists(band?.id)
  const [editing, setEditing] = useState(false)
  const [stage, setStage] = useState(false)
  const [copied, setCopied] = useState(false)
  const canEdit = band ? band.role !== 'guest' : true

  const list = setlists.find((l) => l.id === id)
  if (loading) return <ListSkeleton rows={4} />
  if (!list) return <p className="empty">No encontramos ese setlist. <Link to="/setlists" style={{ color: 'var(--amber)' }}>Volver a setlists</Link></p>

  const items = list.songIds.flatMap((sid) => songs.find((s) => s.id === sid) ?? [])
  const ids = items.map((s) => s.id) // sin canciones borradas
  const minutes = items.reduce((t, s) => t + s.minutes, 0)
  const differs = (i: number) => i > 0 && tuningSignature(items[i]) !== tuningSignature(items[i - 1])
  const changes = items.filter((_, i) => differs(i)).length
  const update = (songIds: string[]) => void save({ ...list, songIds })
  const move = (i: number, d: -1 | 1) => {
    const next = [...ids]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    update(next)
  }
  const copy = async () => {
    const lines = items.map((s, i) => `${i + 1}. ${s.title}${s.artist ? ` - ${s.artist}` : ''}${s.key ? ` (${s.key})` : ''}`)
    try {
      await navigator.clipboard.writeText([list.name, ...lines, `${items.length} canciones · ${minutes} min`].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* sin permiso de portapapeles */ }
  }
  const available = songs.filter((s) => !ids.includes(s.id))

  return (
    <>
      <Link to="/setlists" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Setlists</Link>

      <article className="paper" style={{ marginTop: 6 }}>
        <h2>{list.name}</h2>
        <div className="meta">{items.length} CANCIONES · {minutes} MIN · {changes} CAMBIO{changes === 1 ? '' : 'S'} DE AFINACIÓN</div>
        {items.length === 0 && <p style={{ padding: '18px 0' }}>Vacío. Agrega canciones de tu repertorio.</p>}
        {items.map((s, i) => (
          <div key={s.id} className={`paper-row ${editing ? 'editing' : ''}`}>
            {differs(i) && <div className="retune">{isStandard(s) ? 'VOLVER A E ESTÁNDAR' : `CAMBIAR A ${tuningSummary(s).toUpperCase()}`}</div>}
            <span className="n">{i + 1}</span>
            <div>
              <div className="t">{s.title}</div>
              <div className="a">{s.artist}</div>
            </div>
            <span className="k">{s.key}{s.key && ' · '}{s.bpm}</span>
            {editing && (
              <div className="tools">
                <button aria-label={`Subir ${s.title}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={18} aria-hidden /></button>
                <button aria-label={`Bajar ${s.title}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={18} aria-hidden /></button>
                <button aria-label={`Quitar ${s.title}`} onClick={() => update(ids.filter((x) => x !== s.id))}><X size={18} aria-hidden /></button>
              </div>
            )}
          </div>
        ))}
      </article>

      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn primary block" disabled={!items.length} onClick={() => setStage(true)}>Modo escenario</button>
        <button className="btn block" disabled={!items.length} onClick={() => void copy()}>{copied ? 'Copiado: pégalo en WhatsApp' : 'Copiar para WhatsApp'}</button>
        {canEdit && (
          <button className="btn block" onClick={() => setEditing(!editing)}>{editing ? 'Listo' : 'Editar orden y canciones'}</button>
        )}
      </div>

      {editing && (
        <>
          <div className="section-title">Agregar del repertorio</div>
          {available.length === 0 && <p className="sub">Ya están todas las canciones del repertorio.</p>}
          <div className="list">
            {available.map((s) => (
              <button key={s.id} className="li" onClick={() => update([...ids, s.id])}>
                <div className="li-main">
                  <div className="li-title">{s.title}</div>
                  <div className="li-sub">{s.artist} · {tuningSummary(s)}</div>
                </div>
                <span className="tag">Agregar</span>
              </button>
            ))}
          </div>
          <button className="btn danger block" style={{ marginTop: 24 }}
            onClick={async () => (await ask({ title: `¿Borrar «${list.name}»?`, body: 'Las canciones siguen en el repertorio.', confirmLabel: 'Borrar' })) && void remove(list.id).then(() => nav('/setlists'))}>
            Borrar setlist
          </button>
        </>
      )}
      {stage && <StageMode songs={items} onClose={() => setStage(false)} />}
    </>
  )
}
