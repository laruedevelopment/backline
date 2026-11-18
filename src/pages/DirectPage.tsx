import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, UserMinus } from 'lucide-react'
import Avatar from '../components/Avatar'
import DirectThread, { type Person } from '../components/DirectThread'
import ListSkeleton from '../components/Skeleton'
import { ask } from '../lib/confirm'
import { profileCards } from '../lib/feed'
import { blockUser, removeFriendship, respondRequest } from '../lib/social'
import { supabase } from '../lib/supabase'
import { useConversations, useFriends } from '../lib/useLive'
import { useAuth } from '../store/useAuth'

/** Conversación con una persona: amiga, con una solicitud de mensaje, o una conversación nueva (desde su perfil, anuncio o sala). */
export default function DirectPage() {
  const { id } = useParams()
  const me = useAuth((s) => s.session?.user.id)
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data: friends, isLoading: lf } = useFriends()
  const { data: convs, isLoading: lc } = useConversations()
  const friend = friends?.find((f) => f.id === id && f.direction === 'friend')
  const conv = convs?.find((c) => c.id === id)
  const needCard = !friend && !conv && !!id && !lf && !lc
  const { data: cards, isLoading: lcard } = useQuery({ queryKey: ['cards', id], queryFn: () => profileCards([id!]), enabled: needCard })
  const respond = useMutation({
    mutationFn: (accept: boolean) => respondRequest(id!, accept),
    onSuccess: async (_, accept) => { await qc.invalidateQueries({ queryKey: ['conversations'] }); if (!accept) nav('/explorar/amigos') },
  })

  if (lf || lc || lcard) return <ListSkeleton rows={4} />
  const card = cards?.get(id ?? '')
  const person: Person | null = friend ?? (conv ? { id: conv.id, name: conv.name, avatarUrl: conv.avatarUrl, instruments: conv.instruments } : card ? { id: card.id, name: card.name, avatarUrl: card.avatarUrl, instruments: [] } : null)
  if (!supabase || !me || !id || !person) return <p className="empty">Esa conversación no está disponible. <Link to="/explorar/amigos" style={{ color: 'var(--amber)' }}>Volver a mensajes</Link></p>

  const leave = async () => {
    if (!friend) return
    if (!(await ask({ title: `¿Dejar de ser amigo de ${person.name}?`, body: 'Ya no podrán escribirse como amigos. Pueden volver a enviarse una solicitud.', confirmLabel: 'Dejar de ser amigos' }))) return
    await removeFriendship(friend.friendshipId); await qc.invalidateQueries({ queryKey: ['friends'] }); nav('/explorar/amigos')
  }
  const block = async () => {
    if (!(await ask({ title: `¿Bloquear a ${person.name}?`, body: 'No podrá enviarte solicitudes ni mensajes, y se cierra esta conversación.', confirmLabel: 'Bloquear' }))) return
    await blockUser(person.id); await qc.invalidateQueries({ queryKey: ['friends'] }); await qc.invalidateQueries({ queryKey: ['conversations'] }); nav('/explorar/amigos')
  }

  return (
    <>
      <div className="dm-head">
        <Link to="/explorar/amigos" className="back" aria-label="Volver a mensajes"><ArrowLeft size={20} aria-hidden /></Link>
        <Link to={`/explorar/musicos/${person.id}`} className="dm-who">
          <Avatar name={person.name} url={person.avatarUrl} />
          <span><b>{person.name}</b><small>{person.instruments.slice(0, 2).join(' · ')}</small></span>
        </Link>
        {friend && <button className="btn ghost icon" onClick={() => void leave()} aria-label="Dejar de ser amigos"><UserMinus size={18} aria-hidden /></button>}
        <button className="btn ghost icon" onClick={() => void block()} aria-label="Bloquear"><Ban size={18} aria-hidden /></button>
      </div>
      {conv?.state === 'request_in' && (
        <div className="notice" role="status" style={{ marginBottom: 10 }}>
          <b>{person.name}</b> quiere escribirte. Si aceptas, podrán conversar; si no, no verás más mensajes suyos.
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary sm" disabled={respond.isPending} onClick={() => respond.mutate(true)}>Aceptar</button>
            <button className="btn sm" disabled={respond.isPending} onClick={() => respond.mutate(false)}>Rechazar</button>
          </div>
        </div>
      )}
      {conv?.state === 'request_out' && <p className="li-sub" style={{ marginBottom: 8 }}>Tu mensaje está como solicitud: puedes enviar hasta 3 mientras te responden.</p>}
      <DirectThread friend={person} />
    </>
  )
}
