import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, UserMinus } from 'lucide-react'
import Avatar from '../components/Avatar'
import DirectThread from '../components/DirectThread'
import ListSkeleton from '../components/Skeleton'
import { ask } from '../lib/confirm'
import { blockUser, removeFriendship } from '../lib/social'
import { useFriends } from '../lib/useLive'
import { useAuth } from '../store/useAuth'

/** Conversación con un amigo. */
export default function DirectPage() {
  const { id } = useParams()
  const me = useAuth((s) => s.session?.user.id)
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data: friends, isLoading } = useFriends()
  const friend = friends?.find((f) => f.id === id && f.direction === 'friend')
  if (isLoading) return <ListSkeleton rows={4} />
  if (!me || !id || !friend) return <p className="empty">Esa conversación no está disponible. <Link to="/explorar/amigos" style={{ color: 'var(--amber)' }}>Volver a amigos</Link></p>

  const leave = async () => {
    if (!(await ask({ title: `¿Dejar de ser amigo de ${friend.name}?`, body: 'Ya no podrán escribirse. Pueden volver a enviarse una solicitud.', confirmLabel: 'Dejar de ser amigos' }))) return
    await removeFriendship(friend.friendshipId); await qc.invalidateQueries({ queryKey: ['friends'] }); nav('/explorar/amigos')
  }
  const block = async () => {
    if (!(await ask({ title: `¿Bloquear a ${friend.name}?`, body: 'Deja de ser tu amigo y no podrá enviarte solicitudes ni mensajes.', confirmLabel: 'Bloquear' }))) return
    await blockUser(friend.id); await qc.invalidateQueries({ queryKey: ['friends'] }); nav('/explorar/amigos')
  }

  return (
    <>
      <div className="dm-head">
        <Link to="/explorar/amigos" className="back" aria-label="Volver a amigos"><ArrowLeft size={20} aria-hidden /></Link>
        <Link to={`/explorar/musicos/${friend.id}`} className="dm-who">
          <Avatar name={friend.name} url={friend.avatarUrl} />
          <span><b>{friend.name}</b><small>{friend.instruments.slice(0, 2).join(' · ')}</small></span>
        </Link>
        <button className="btn ghost icon" onClick={() => void leave()} aria-label="Dejar de ser amigos"><UserMinus size={18} aria-hidden /></button>
        <button className="btn ghost icon" onClick={() => void block()} aria-label="Bloquear"><Ban size={18} aria-hidden /></button>
      </div>
      <DirectThread friend={friend} />
    </>
  )
}
