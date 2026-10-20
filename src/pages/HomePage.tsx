import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { band as demoBand, events } from '../data/demo'
import { listMembers } from '../lib/api'
import { useActiveBand } from '../store/useBandSession'
import { useSongs } from '../lib/useSongs'
import EventCard from '../components/EventCard'

const roleLabel: Record<string, string> = { owner: 'Líder', admin: 'Admin', member: 'Integrante', guest: 'Invitado' }

export default function HomePage() {
  const band = useActiveBand()
  const { songs } = useSongs(band?.id)
  const { data: members = [] } = useQuery({ queryKey: ['members', band?.id], queryFn: () => listMembers(band!.id), enabled: !!band })

  // Sin Supabase: demostración local.
  if (!band) {
    return (
      <>
        <h1 className="page-title">{demoBand.name}</h1>
        <p className="page-sub">{demoBand.genres.join(' · ')} · {demoBand.city} · {demoBand.members.length} integrantes</p>
        <div className="hero">
          <div className="section-title" style={{ marginTop: 0 }}>Lo próximo</div>
          <EventCard event={events[0]} bare />
        </div>
        <p className="sub" style={{ marginTop: 20, whiteSpace: 'normal' }}>Modo demostración (sin cuenta).</p>
      </>
    )
  }

  return (
    <>
      <h1 className="page-title">{band.name}</h1>
      <p className="page-sub">{[band.city, `${members.length || 1} integrante${members.length === 1 ? '' : 's'}`, `${songs.length} canciones`].filter(Boolean).join(' · ')}</p>

      <div className="hero">
        <div className="section-title" style={{ marginTop: 0 }}>Lo próximo</div>
        <p>Todavía no hay ensayos ni toques agendados. La agenda llega pronto.</p>
      </div>

      {songs.length === 0 && (
        <p className="card" style={{ marginTop: 12 }}>
          Empieza por el <Link to="/repertorio" style={{ color: 'var(--amber)' }}>repertorio</Link>: agrega las canciones que tocan.
        </p>
      )}

      <div className="section-title">Banda</div>
      <div className="stack">
        {members.map((m) => (
          <div key={m.profileId} className="card row">
            <div className="grow">
              <div className="title">{m.name}</div>
              <div className="sub">{[m.instrument, roleLabel[m.role]].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="sub" style={{ marginTop: 16, whiteSpace: 'normal' }}>
        Para sumar a alguien, genera un código en <Link to="/perfil" style={{ color: 'var(--amber)' }}>Perfil</Link>.
      </p>
    </>
  )
}
