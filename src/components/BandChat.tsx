import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteMessage, listMembers, listMessages, markChatRead, sendMessage } from '../lib/api'
import { ask } from '../lib/confirm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { useActiveBand } from '../store/useBandSession'
import ListSkeleton from './Skeleton'
import Thread from './Thread'

/** Conversación del chat de la banda activa (la usan la pantalla de Chat y el panel lateral). Al verla se da por leída. */
export default function BandChat() {
  const band = useActiveBand()
  const userId = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const bandId = band?.id
  const { data: posts, isLoading } = useQuery({ queryKey: ['band-messages', bandId], queryFn: () => listMessages(bandId!), enabled: !!supabase && !!bandId })
  const { data: members = [] } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId!), enabled: !!supabase && !!bandId })
  const remove = useMutation({ mutationFn: (id: string) => deleteMessage(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['band-messages', bandId] }) })

  // Lo que hay en pantalla se da por leído (al abrir y cada vez que llega algo con la conversación abierta).
  const lastId = posts?.[posts.length - 1]?.id
  useEffect(() => {
    if (!bandId || !userId || !supabase) return
    void markChatRead(bandId, userId).then(() => qc.invalidateQueries({ queryKey: ['chat-unread'] })).catch(() => {})
  }, [bandId, userId, lastId, qc])

  if (!band || !userId) return <ListSkeleton rows={4} />
  if (isLoading || !posts) return <ListSkeleton rows={4} />
  const canWrite = band.role !== 'guest'
  const canModerate = band.role === 'owner' || band.role === 'admin'
  return (
    <Thread
      variant="chat" posts={posts} members={members} userId={userId} max={2000}
      placeholder="Escribe un mensaje…" emptyText="Aquí empieza el chat de la banda. Escribe el primer mensaje."
      canDelete={(p) => p.profileId === userId || canModerate}
      onDelete={async (p) => { if (await ask({ title: '¿Borrar el mensaje?', body: 'Se borra para toda la banda.', confirmLabel: 'Borrar' })) remove.mutate(p.id) }}
      onSend={canWrite ? async (body) => { await sendMessage(band.id, userId, body); await qc.invalidateQueries({ queryKey: ['band-messages', band.id] }) } : null}
    />
  )
}
