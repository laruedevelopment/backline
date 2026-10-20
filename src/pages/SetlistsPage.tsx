import { Monitor } from 'lucide-react'
import { setlist, songs } from '../data/demo'
import SongRow from '../components/SongRow'

export default function SetlistsPage() {
  const items = setlist.songIds.map((id) => songs.find((s) => s.id === id)!)
  const minutes = items.reduce((t, s) => t + s.minutes, 0)
  const changes = items.slice(1).filter((s, i) => s.tuning !== items[i].tuning).length
  return (
    <>
      <h1 className="page-title">{setlist.name}</h1>
      <p className="page-sub">
        {items.length} canciones · {minutes} min · {changes} cambio{changes === 1 ? '' : 's'} de afinación
      </p>
      <div className="stack">
        {items.map((s, i) => (
          <div key={s.id}>
            {i > 0 && s.tuning !== items[i - 1].tuning && (
              <div className="live" style={{ margin: '0 0 6px 4px' }}>
                Cambiar a {s.tuning} antes de esta canción
              </div>
            )}
            <SongRow song={s} index={i + 1} />
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ marginTop: 20, width: '100%' }}>
        <Monitor size={20} aria-hidden /> Modo escenario
      </button>
    </>
  )
}
