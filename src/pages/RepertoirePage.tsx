import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import { norm } from '../lib/importSetlist'
import type { Song, SongStatus } from '../lib/song'
import MusicNav from '../components/MusicNav'
import SongRow from '../components/SongRow'
import SongForm from '../components/SongForm'
import ListSkeleton from '../components/Skeleton'

const filters: { v: 'all' | SongStatus; label: string }[] = [
  { v: 'all', label: 'Todas' },
  { v: 'ready', label: 'Listas' },
  { v: 'learning', label: 'Aprendiendo' },
  { v: 'paused', label: 'En pausa' },
]

export default function RepertoirePage() {
  const band = useActiveBand()
  const { songs, loading, error, save, remove } = useSongs(band?.id)
  const [editing, setEditing] = useState<Song | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | SongStatus>('all')
  const canEdit = band ? band.role !== 'guest' : true

  const shown = useMemo(() => {
    const needle = norm(q)
    return songs
      .filter((s) => (status === 'all' || s.status === status) && (!needle || norm(`${s.title} ${s.artist}`).includes(needle)))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [songs, q, status])

  const ready = songs.filter((s) => s.status === 'ready').length
  const minutes = songs.reduce((t, s) => t + s.minutes, 0)

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Música</span>
        <h1 className="page-title">Repertorio</h1>
      </div>
      <MusicNav />

      {songs.length > 0 && (
        <>
          <div className="stats" style={{ marginTop: 18 }}>
            <div className="stat"><b>{songs.length}</b><span>Canciones</span></div>
            <div className="stat"><b>{ready}</b><span>Listas</span></div>
            <div className="stat"><b>{minutes}</b><span>Minutos</span></div>
          </div>
          <div className="meter" role="img" aria-label={`${ready} de ${songs.length} canciones listas`}><i style={{ width: `${(ready / songs.length) * 100}%` }} /></div>

          <div className="stack" style={{ marginTop: 18 }}>
            <label className="search">
              <Search size={18} aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por canción o artista" aria-label="Buscar canciones" />
            </label>
            <div className="tabs" role="tablist" aria-label="Estado">
              {filters.map((f) => (
                <button key={f.v} role="tab" aria-selected={status === f.v} className={status === f.v ? 'active' : ''} onClick={() => setStatus(f.v)}>{f.label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {loading && <ListSkeleton />}

      {!loading && songs.length === 0 && (
        <div className="empty">
          <h3>Aún no hay canciones</h3>
          <p>Aquí vive lo que toca la banda: tono, BPM, afinación de cada instrumento y el link para escucharla. Empieza con una, o trae toda la lista de una vez.</p>
          {canEdit && <button className="btn primary" onClick={() => setEditing('new')}>Agregar la primera</button>}
          {canEdit && <Link className="link-btn" to="/setlists">Importar una lista desde el chat</Link>}
        </div>
      )}
      {!loading && songs.length > 0 && shown.length === 0 && <p className="empty">Ninguna canción coincide con esa búsqueda.</p>}

      <div className="list" style={{ marginTop: 14, borderTop: shown.length ? undefined : 0 }}>
        {shown.map((s) => <SongRow key={s.id} song={s} onEdit={canEdit ? () => setEditing(s) : undefined} />)}
      </div>

      {canEdit && songs.length > 0 && (
        <button className="btn primary fab" onClick={() => setEditing('new')}>
          <Plus size={20} aria-hidden /> Agregar canción
        </button>
      )}
      {editing && (
        <SongForm
          song={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(s) => { void save(s).then(() => setEditing(null)) }}
          onDelete={editing === 'new' ? undefined : () => { void remove(editing.id).then(() => setEditing(null)) }}
        />
      )}
    </>
  )
}
