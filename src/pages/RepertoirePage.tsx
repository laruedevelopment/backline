import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import type { Song } from '../lib/song'
import SongRow from '../components/SongRow'
import SongForm from '../components/SongForm'

export default function RepertoirePage() {
  const band = useActiveBand()
  const { songs, loading, error, save, remove } = useSongs(band?.id)
  const [editing, setEditing] = useState<Song | 'new' | null>(null)
  const close = () => setEditing(null)
  return (
    <>
      <h1 className="page-title">Repertorio</h1>
      <p className="page-sub">{songs.length} canciones · tono, afinación y quién toca qué</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="empty">Cargando canciones…</p>}
      {!loading && songs.length === 0 && <p className="empty">Todavía no hay canciones. Agrega la primera.</p>}
      <div className="stack">
        {songs.map((s) => (
          <SongRow key={s.id} song={s} onEdit={() => setEditing(s)} />
        ))}
      </div>
      <button className="btn primary fab" onClick={() => setEditing('new')}>
        <Plus size={20} aria-hidden /> Agregar canción
      </button>
      {editing && (
        <SongForm
          song={editing === 'new' ? undefined : editing}
          onClose={close}
          onSave={(s) => { void save(s).then(close) }}
          onDelete={editing === 'new' ? undefined : () => { void remove(editing.id).then(close) }}
        />
      )}
    </>
  )
}
