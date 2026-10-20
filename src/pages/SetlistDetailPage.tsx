import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Monitor, Plus, Trash2, X } from 'lucide-react'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import { tuningLabel, tuningSignature } from '../lib/song'
import SongRow from '../components/SongRow'
import StageMode from '../components/StageMode'

export default function SetlistDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const band = useActiveBand()
  const { songs } = useSongs(band?.id)
  const { setlists, loading, save, remove } = useSetlists(band?.id)
  const [picking, setPicking] = useState(false)
  const [stage, setStage] = useState(false)

  const list = setlists.find((l) => l.id === id)
  if (loading) return <p className="empty">Cargando…</p>
  if (!list) return <p className="empty">No encontramos ese setlist. <Link to="/setlists">Volver</Link></p>

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
  const available = songs.filter((s) => !ids.includes(s.id))

  return (
    <>
      <Link to="/setlists" className="back"><ArrowLeft size={18} aria-hidden /> Setlists</Link>
      <h1 className="page-title">{list.name}</h1>
      <p className="page-sub">
        {items.length} canciones · {minutes} min · {changes} cambio{changes === 1 ? '' : 's'} de afinación
      </p>
      {items.length === 0 && <p className="empty">Vacío. Agrega canciones de tu repertorio.</p>}
      <div className="stack">
        {items.map((s, i) => (
          <div key={s.id}>
            {differs(i) && <div className="live" style={{ margin: '0 0 6px 4px' }}>Cambiar a {tuningLabel(s)} antes de esta canción</div>}
            <div className="reorder">
              <div className="grow"><SongRow song={s} index={i + 1} /></div>
              <div className="reorder-btns">
                <button className="btn" aria-label={`Subir ${s.title}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden /></button>
                <button className="btn" aria-label={`Bajar ${s.title}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden /></button>
                <button className="btn" aria-label={`Quitar ${s.title}`} onClick={() => update(ids.filter((x) => x !== s.id))}><X size={16} aria-hidden /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={() => setPicking(!picking)}>
        <Plus size={20} aria-hidden /> {picking ? 'Listo' : 'Agregar canciones'}
      </button>
      {picking && (
        <div className="stack" style={{ marginTop: 10 }}>
          {available.length === 0 && <p className="empty">Ya están todas las canciones del repertorio.</p>}
          {available.map((s) => (
            <button key={s.id} className="card row pick" onClick={() => update([...ids, s.id])}>
              <div className="grow"><div className="title">{s.title}</div><div className="sub">{s.artist} · {s.key} · {tuningLabel(s)}</div></div>
              <Plus size={18} aria-hidden />
            </button>
          ))}
        </div>
      )}

      <button className="btn primary" style={{ marginTop: 12, width: '100%' }} disabled={!items.length} onClick={() => setStage(true)}>
        <Monitor size={20} aria-hidden /> Modo escenario
      </button>
      <button className="btn danger" style={{ marginTop: 12, width: '100%' }}
        onClick={() => confirm(`¿Borrar el setlist "${list.name}"?`) && void remove(list.id).then(() => nav('/setlists'))}>
        <Trash2 size={18} aria-hidden /> Borrar setlist
      </button>
      {stage && <StageMode songs={items} onClose={() => setStage(false)} />}
    </>
  )
}
