import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, ClipboardPaste, Plus } from 'lucide-react'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import ImportSetlist from '../components/ImportSetlist'

export default function SetlistsPage() {
  const band = useActiveBand()
  const nav = useNavigate()
  const { songs, save: saveSong } = useSongs(band?.id)
  const { setlists, loading, error, save } = useSetlists(band?.id)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const id = crypto.randomUUID()
    await save({ id, name: name.trim(), songIds: [] })
    nav(`/setlists/${id}`)
  }

  return (
    <>
      <h1 className="page-title">Setlists</h1>
      <p className="page-sub">Arma el orden de cada toque y mira cuándo toca cambiar de afinación.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="empty">Cargando…</p>}
      {!loading && setlists.length === 0 && <p className="empty">Aún no hay setlists. Crea el del próximo toque.</p>}
      <div className="stack">
        {setlists.map((l) => {
          const items = l.songIds.flatMap((id) => songs.find((s) => s.id === id) ?? [])
          return (
            <Link key={l.id} to={`/setlists/${l.id}`} className="card row">
              <div className="grow">
                <div className="title">{l.name}</div>
                <div className="sub">{items.length} canciones · {items.reduce((t, s) => t + s.minutes, 0)} min</div>
              </div>
              <ChevronRight size={20} aria-hidden />
            </Link>
          )
        })}
      </div>
      {adding ? (
        <form className="card login-form" style={{ marginTop: 16, maxWidth: 'none' }} onSubmit={create}>
          <label className="field">Nombre del setlist
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Toque Bar La Esquina" maxLength={80} autoFocus required />
          </label>
          <button className="btn primary">Crear</button>
        </form>
      ) : (
        <>
          <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={() => setImporting(true)}>
            <ClipboardPaste size={20} aria-hidden /> Importar desde el chat o una nota
          </button>
          <button className="btn primary fab" onClick={() => setAdding(true)}>
            <Plus size={20} aria-hidden /> Nuevo setlist
          </button>
        </>
      )}
      {importing && (
        <ImportSetlist songs={songs} saveSong={saveSong} saveSetlist={save} onClose={() => setImporting(false)} onDone={(id) => nav(`/setlists/${id}`)} />
      )}
    </>
  )
}
