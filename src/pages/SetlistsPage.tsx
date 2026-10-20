import { Monitor } from 'lucide-react'
import { setlist } from '../data/demo'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import { tuningLabel, tuningSignature } from '../lib/song'
import SongRow from '../components/SongRow'

export default function SetlistsPage() {
  const band = useActiveBand()
  const { songs: all } = useSongs(band?.id)
  // Sin tabla de setlists todavía: en la nube se muestran las canciones "listas".
  const items = band ? all.filter((s) => s.status === 'ready') : setlist.songIds.flatMap((id) => all.find((s) => s.id === id) ?? [])
  const title = band ? 'Canciones listas' : setlist.name
  const minutes = items.reduce((t, s) => t + s.minutes, 0)
  const differs = (i: number) => i > 0 && tuningSignature(items[i]) !== tuningSignature(items[i - 1])
  const changes = items.filter((_, i) => differs(i)).length
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">
        {items.length} canciones · {minutes} min · {changes} cambio{changes === 1 ? '' : 's'} de afinación
      </p>
      {items.length === 0 && <p className="empty">Este setlist no tiene canciones.</p>}
      <div className="stack">
        {items.map((s, i) => (
          <div key={s.id}>
            {differs(i) && (
              <div className="live" style={{ margin: '0 0 6px 4px' }}>
                Cambiar a {tuningLabel(s)} antes de esta canción
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
