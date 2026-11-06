import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, UserMinus } from 'lucide-react'
import Avatar from '../components/Avatar'
import ListSkeleton from '../components/Skeleton'
import Thread from '../components/Thread'
import type { Member } from '../lib/api'
import { ask } from '../lib/confirm'
import { blockUser, deleteDirect, listDirect, markDirectRead, removeFriendship, sendDirect } from '../lib/social'
import { supabase } from '../lib/supabase'
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
  const { data: posts } = useQuery({ queryKey: ['dm', me, id], queryFn: () => listDirect(me!, id!), enabled: !!supabase && !!me && !!id && !!friend })
  const remove = useMutation({ mutationFn: (pid: string) => deleteDirect(pid), onSuccess: () => qc.invalidateQueries({ queryKey: ['dm'] }) })

  // Lo que hay en pantalla se da por leído.
  const lastId = posts?.[posts.length - 1]?.id
  const isFriend = !!friend
  useEffect(() => {
    if (!me || !id || !isFriend || !supabase) return
    void markDirectRead(me, id).then(() => qc.invalidateQueries({ queryKey: ['friends'] })).catch(() => {})
  }, [me, id, isFriend, lastId, qc])

  if (isLoading || (friend && !posts)) return <ListSkeleton rows={4} />
  if (!me || !id || !friend) return <p className="empty">Esa conversación no está disponible. <Link to="/explorar/amigos" style={{ color: 'var(--amber)' }}>Volver a amigos</Link></p>

  const people: Member[] = [{ profileId: friend.id, name: friend.name, role: 'friend', instrument: null, instruments: friend.instruments, avatarUrl: friend.avatarUrl }]
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
      <Thread
        variant="chat" posts={posts ?? []} members={people} userId={me} max={2000}
        placeholder="Escribe un mensaje…" emptyText={`Escríbele a ${friend.name.split(' ')[0]} para empezar la conversación.`}
        canDelete={(p) => p.profileId === me}
        onDelete={async (p) => { if (await ask({ title: '¿Borrar el mensaje?', body: 'Se borra para los dos.', confirmLabel: 'Borrar' })) remove.mutate(p.id) }}
        onSend={async (body) => { await sendDirect(me, id, body); await qc.invalidateQueries({ queryKey: ['dm'] }); await qc.invalidateQueries({ queryKey: ['friends'] }) }}
      />
    </>
  )
}
