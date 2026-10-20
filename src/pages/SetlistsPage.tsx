import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus, Upload } from 'lucide-react'
import { tuningSignature } from '../lib/song'
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
  const [params, setParams] = useSearchParams()
  const [importing, setImporting] = useState(params.get('importar') === '1')
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
      <MusicNav>
        {canEdit && (
          <>
            <button className="btn sm" onClick={() => setAdding(true)} aria-label="Nuevo setlist"><Plus size={16} aria-hidden /><span>Nuevo</span></button>
            <button className="btn sm" onClick={() => setImporting(true)} aria-label="Importar lista o foto"><Upload size={16} aria-hidden /><span className="hide-sm">Importar</span></button>
          </>
        )}
      </MusicNav>
      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {loading && <ListSkeleton rows={3} />}

      {!loading && setlists.length === 0 && (
        <div className="empty">
          <h3>Sin setlists todavía</h3>
          <p>Arma el orden de cada toque y mira de antemano dónde toca cambiar de afinación. Si ya tienes la lista en el chat de WhatsApp o en una foto, impórtala en vez de escribirla.</p>
          {canEdit && (
            <div className="quick">
              <button className="btn primary" onClick={() => setAdding(true)}>Nuevo setlist</button>
              <button className="btn" onClick={() => setImporting(true)}>Importar lista o foto</button>
            </div>
          )}
        </div>
      )}

      <div className="setlist-grid">
        {setlists.map((l) => {
          const items = l.songIds.flatMap((id) => songs.find((s) => s.id === id) ?? [])
          const changes = items.filter((s, k) => k > 0 && tuningSignature(s) !== tuningSignature(items[k - 1])).length
          return (
            <Link key={l.id} to={`/setlists/${l.id}`} className="setlist-card">
              <div className="setlist-card-head">
                <h2>{l.name}</h2>
                <ChevronRight size={22} color="var(--muted)" aria-hidden />
              </div>
              <div className="setlist-meta">{items.length} canciones · {items.reduce((t, s) => t + s.minutes, 0)} min{changes > 0 ? ` · ${changes} cambio${changes === 1 ? '' : 's'} de afinación` : ''}</div>
              {items.length > 0 && (
                <ol className="setlist-peek" aria-label="Primeras canciones">
                  {items.slice(0, 3).map((s) => <li key={s.id}>{s.title}</li>)}
                  {items.length > 3 && <li className="more">+{items.length - 3} más</li>}
                </ol>
              )}
            </Link>
          )
        })}
      </div>

      {canEdit && adding && (
        <form className="card stack" style={{ marginTop: 16 }} onSubmit={create}>
          <label className="field">Nombre del setlist
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Toque Bar La Esquina" maxLength={80} autoFocus required />
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn primary grow">Crear</button>
          </div>
        </form>
      )}
      {!canEdit && <p className="notice" style={{ marginTop: 16 }}>Eres invitado: puedes ver los setlists, no editarlos.</p>}
      {importing && (
        <ImportSetlist songs={songs} saveSong={saveSong} saveSetlist={save} onClose={() => { setImporting(false); if (params.get('importar')) setParams({}, { replace: true }) }} onDone={(id) => nav(`/setlists/${id}`)} />
      )}
    </>
  )
}
