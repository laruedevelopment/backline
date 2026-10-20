import { Plus } from 'lucide-react'
import { songs } from '../data/demo'
import SongRow from '../components/SongRow'

export default function RepertoirePage() {
  return (
    <>
      <h1 className="page-title">Repertorio</h1>
      <p className="page-sub">{songs.length} canciones · tono, afinación y quién toca qué</p>
      <div className="stack">
        {songs.map((s) => (
          <SongRow key={s.id} song={s} />
        ))}
      </div>
      <button className="btn primary fab">
        <Plus size={20} aria-hidden /> Agregar canción
      </button>
    </>
  )
}
