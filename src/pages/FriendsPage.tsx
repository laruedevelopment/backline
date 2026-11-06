import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Avatar from '../components/Avatar'
import ListSkeleton from '../components/Skeleton'
import CommunityNav from '../components/CommunityNav'
import { acceptFriend, removeFriendship, type Friend } from '../lib/social'
import { useFriends } from '../lib/useLive'
import { supabase } from '../lib/supabase'

const hora = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const same = d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) === new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
  return same ? d.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
}

/** Amigos: solicitudes por responder, amigos con sus conversaciones y solicitudes enviadas. */
export default function FriendsPage() {
  const qc = useQueryClient()
  const { data: all, isLoading, isError } = useFriends()
  const refresh = () => qc.invalidateQueries({ queryKey: ['friends'] })
  const accept = useMutation({ mutationFn: (f: Friend) => acceptFriend(f.friendshipId), onSuccess: refresh })
  const drop = useMutation({ mutationFn: (f: Friend) => removeFriendship(f.friendshipId), onSuccess: refresh })

  if (!supabase) return <><CommunityNav /><p className="empty">Los amigos necesitan una cuenta. Inicia sesión para usarlos.</p></>
  const incoming = (all ?? []).filter((f) => f.direction === 'in')
  const friends = (all ?? []).filter((f) => f.direction === 'friend').sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
  const sent = (all ?? []).filter((f) => f.direction === 'out')

  return (
    <>
      <CommunityNav />
      {isLoading && <ListSkeleton rows={3} />}
      {isError && <p className="empty">No pudimos cargar tus amigos. Revisa tu conexión.</p>}
      {all && all.length === 0 && (
        <div className="empty">
          <h3>Todavía no tienes amigos aquí</h3>
          <p>Busca músicos en <Link to="/explorar/musicos" style={{ color: 'var(--amber)' }}>Comunidad</Link> y envíales una solicitud. Cuando la acepten podrán escribirse.</p>
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <div className="section-title">Solicitudes · {incoming.length}</div>
          <div className="list">
            {incoming.map((f) => (
              <div key={f.friendshipId} className="li" style={{ minHeight: 64 }}>
                <Avatar name={f.name} url={f.avatarUrl} />
                <div className="li-main">
                  <div className="li-title">{f.name}</div>
                  <div className="li-sub">{[f.instruments.slice(0, 2).join(' · '), f.city].filter(Boolean).join(' · ') || 'Quiere ser tu amigo'}</div>
                </div>
                <button className="btn primary sm" disabled={accept.isPending} onClick={() => accept.mutate(f)}>Aceptar</button>
                <button className="btn sm" disabled={drop.isPending} onClick={() => drop.mutate(f)} aria-label={`Rechazar a ${f.name}`}>Rechazar</button>
              </div>
            ))}
          </div>
        </>
      )}

      {friends.length > 0 && (
        <>
          <div className="section-title">Amigos · {friends.length}</div>
          <div className="list">
            {friends.map((f) => (
              <Link key={f.friendshipId} to={`/explorar/amigos/${f.id}`} className="li" style={{ minHeight: 64 }}>
                <Avatar name={f.name} url={f.avatarUrl} />
                <div className="li-main">
                  <div className="li-title">{f.name}</div>
                  <div className="li-sub">{[f.instruments.slice(0, 2).join(' · '), f.city].filter(Boolean).join(' · ') || 'Escríbele un mensaje'}</div>
                </div>
                {f.lastAt && <span className="li-sub">{hora(f.lastAt)}</span>}
                {f.unread > 0 && <span className="seg-badge" aria-label={`${f.unread} sin leer`}>{f.unread}</span>}
              </Link>
            ))}
          </div>
        </>
      )}

      {sent.length > 0 && (
        <>
          <div className="section-title">Enviadas · {sent.length}</div>
          <div className="list">
            {sent.map((f) => (
              <div key={f.friendshipId} className="li" style={{ minHeight: 64 }}>
                <Avatar name={f.name} url={f.avatarUrl} />
                <div className="li-main">
                  <div className="li-title">{f.name}</div>
                  <div className="li-sub">Esperando respuesta</div>
                </div>
                <button className="btn sm" disabled={drop.isPending} onClick={() => drop.mutate(f)}>Cancelar</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
