import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useBand } from '../store/useBand'
import type { Song } from '../lib/song'
import SongRow from '../components/SongRow'
import SongForm from '../components/SongForm'

export default function RepertoirePage() {
  const { songs, saveSong, removeSong } = useBand()
  const [editing, setEditing] = useState<Song | 'new' | null>(null)
  const close = () => setEditing(null)
  return (
    <>
      <h1 className="page-title">Repertorio</h1>
      <p className="page-sub">{songs.length} canciones · tono, afinación y quién toca qué</p>
      {songs.length === 0 && <p className="empty">Todavía no hay canciones. Agrega la primera.</p>}
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
          onSave={(s) => { saveSong(s); close() }}
          onDelete={editing === 'new' ? undefined : () => { removeSong(editing.id); close() }}
        />
      )}
    </>
  )
}
