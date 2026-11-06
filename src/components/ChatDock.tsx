import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { useChatUnread, useFriends } from '../lib/useLive'
import { supabase } from '../lib/supabase'
import { useActiveBand } from '../store/useBandSession'
import Avatar from './Avatar'
import BandChat from './BandChat'
import BandMark from './BandMark'
import DirectThread from './DirectThread'

type View = { kind: 'list' } | { kind: 'band' } | { kind: 'friend'; id: string }

/** Panel de chat a un costado (en pantallas anchas): el chat de la banda y tus amigos, siempre a mano, como en Facebook. */
export default function ChatDock() {
  const band = useActiveBand()
  const [view, setView] = useState<View>({ kind: 'list' })
  const unreadBand = useChatUnread(band?.id)
  const { data: all = [] } = useFriends()
  if (!supabase) return null
  const friends = all.filter((f) => f.direction === 'friend').sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
  const requests = all.filter((f) => f.direction === 'in').length
  const friend = view.kind === 'friend' ? friends.find((f) => f.id === view.id) : undefined
  const open = view.kind === 'band' && band ? 'band' : friend ? 'friend' : 'list'

  return (
    <aside className="dock" aria-label="Chat">
      {open === 'list' ? (
        <>
          <div className="dock-head"><b>Chat</b>{requests > 0 && <Link to="/explorar/amigos" className="seg-badge" aria-label={`${requests} solicitudes de amistad`}>{requests}</Link>}</div>
          <div className="dock-list">
            {band && (
              <button className="dock-row" onClick={() => setView({ kind: 'band' })}>
                <BandMark name={band.name} logoUrl={band.logoUrl} />
                <span className="dock-name"><b>{band.name}</b><small>Chat de la banda</small></span>
                {unreadBand > 0 && <span className="seg-badge" aria-label={`${unreadBand} sin leer`}>{unreadBand > 99 ? '99+' : unreadBand}</span>}
              </button>
            )}
            <div className="dock-label">Amigos</div>
            {friends.map((f) => (
              <button key={f.id} className="dock-row" onClick={() => setView({ kind: 'friend', id: f.id })}>
                <Avatar name={f.name} url={f.avatarUrl} />
                <span className="dock-name"><b>{f.name}</b><small>{f.instruments.slice(0, 2).join(' · ') || 'Amigo'}</small></span>
                {f.unread > 0 && <span className="seg-badge" aria-label={`${f.unread} sin leer`}>{f.unread}</span>}
              </button>
            ))}
            {friends.length === 0 && <p className="li-sub dock-empty">Aún no tienes amigos. Busca músicos en <Link to="/explorar/musicos" style={{ color: 'var(--amber)' }}>Comunidad</Link>.</p>}
            <Link to="/explorar/amigos" className="dock-more"><Users size={16} aria-hidden /> Administrar amigos y solicitudes</Link>
          </div>
        </>
      ) : (
        <>
          <div className="dock-head">
            <button className="btn ghost icon" onClick={() => setView({ kind: 'list' })} aria-label="Volver a la lista del chat"><ArrowLeft size={18} aria-hidden /></button>
            {open === 'band' && band ? <><BandMark name={band.name} logoUrl={band.logoUrl} /><b>{band.name}</b></> : friend && (
              <Link to={`/explorar/musicos/${friend.id}`} className="dock-who"><Avatar name={friend.name} url={friend.avatarUrl} /><b>{friend.name}</b></Link>
            )}
          </div>
          <div className="dock-body">{open === 'band' ? <BandChat /> : friend && <DirectThread friend={friend} />}</div>
        </>
      )}
    </aside>
  )
}
