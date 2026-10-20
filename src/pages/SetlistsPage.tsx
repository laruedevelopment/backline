import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import ImportSetlist from '../components/ImportSetlist'
import ListSkeleton from '../components/Skeleton'
import MusicNav from '../components/MusicNav'

export default function SetlistsPage() {
  const band = useActiveBand()
  const nav = useNavigate()
  const { songs, save: saveSong } = useSongs(band?.id)
  const { setlists, loading, error, save } = useSetlists(band?.id)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const canEdit = band ? band.role !== 'guest' : true

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const id = crypto.randomUUID()
    await save({ id, name: name.trim(), songIds: [] })
    nav(`/setlists/${id}`)
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Música</span>
        <h1 className="page-title">Setlists</h1>
      </div>
      <MusicNav />
      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {loading && <ListSkeleton rows={3} />}

      {!loading && setlists.length === 0 && (
        <div className="empty">
          <h3>Sin setlists todavía</h3>
          <p>Arma el orden de cada toque y mira de antemano dónde toca cambiar de afinación. Si ya tienes la lista en el chat de WhatsApp o en una foto, impórtala en vez de escribirla.</p>
        </div>
      )}

      <div className="list cols" style={{ marginTop: 16, borderTop: setlists.length ? undefined : 0 }}>
        {setlists.map((l) => {
          const items = l.songIds.flatMap((id) => songs.find((s) => s.id === id) ?? [])
          return (
            <Link key={l.id} to={`/setlists/${l.id}`} className="li">
              <div className="li-main">
                <div className="li-title">{l.name}</div>
                <div className="li-sub">{items.length} canciones · {items.reduce((t, s) => t + s.minutes, 0)} min</div>
              </div>
              <ChevronRight size={20} color="var(--muted)" aria-hidden />
            </Link>
          )
        })}
      </div>

      {canEdit && (adding ? (
        <form className="stack" style={{ marginTop: 20 }} onSubmit={create}>
          <label className="field">Nombre del setlist
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Toque Bar La Esquina" maxLength={80} autoFocus required />
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn primary grow">Crear</button>
          </div>
        </form>
      ) : (
        <div className="quick" style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={() => setAdding(true)}>Nuevo setlist</button>
          <button className="btn" onClick={() => setImporting(true)}>Importar lista o foto</button>
        </div>
      ))}
      {!canEdit && <p className="notice" style={{ marginTop: 16 }}>Eres invitado: puedes ver los setlists, no editarlos.</p>}
      {importing && (
        <ImportSetlist songs={songs} saveSong={saveSong} saveSetlist={save} onClose={() => setImporting(false)} onDone={(id) => nav(`/setlists/${id}`)} />
      )}
      <p className="sub" style={{ marginTop: 20 }}><Link to="/repertorio" style={{ color: 'var(--amber)' }}>Ir al repertorio</Link></p>
    </>
  )
}
