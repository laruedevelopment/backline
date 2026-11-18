import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Member } from '../lib/api'
import { ask } from '../lib/confirm'
import { deleteDirect, listDirect, markDirectRead, sendDirect, type Friend } from '../lib/social'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import ListSkeleton from './Skeleton'
import Thread from './Thread'
import { ReportSheet, type ReportTarget } from './ReportSheet'

/** Conversación con un amigo (la usan la pantalla de mensajes y el panel lateral). Al verla se da por leída. */
export default function DirectThread({ friend }: { friend: Friend }) {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const id = friend.id
  const [report, setReport] = useState<ReportTarget | null>(null)
  const { data: posts } = useQuery({ queryKey: ['dm', me, id], queryFn: () => listDirect(me!, id), enabled: !!supabase && !!me })
  const remove = useMutation({ mutationFn: (pid: string) => deleteDirect(pid), onSuccess: () => qc.invalidateQueries({ queryKey: ['dm'] }) })

  const lastId = posts?.[posts.length - 1]?.id
  useEffect(() => {
    if (!me || !supabase) return
    void markDirectRead(me, id).then(() => qc.invalidateQueries({ queryKey: ['friends'] })).catch(() => {})
  }, [me, id, lastId, qc])

  if (!me || !posts) return <ListSkeleton rows={4} />
  const people: Member[] = [{ profileId: friend.id, name: friend.name, role: 'friend', instrument: null, instruments: friend.instruments, avatarUrl: friend.avatarUrl }]
  return (
    <>
    <Thread
      onReport={(p) => setReport({ kind: 'dm', id: p.id, label: 'este mensaje', excerpt: p.body })}
      variant="chat" posts={posts} members={people} userId={me} max={2000}
      placeholder="Escribe un mensaje…" emptyText={`Escríbele a ${friend.name.split(' ')[0]} para empezar la conversación.`}
      canDelete={() => true}
      onDelete={async (p) => { if (await ask({ title: '¿Borrar el mensaje?', body: 'Se borra para los dos. Si es acoso, denúncialo antes de borrarlo.', confirmLabel: 'Borrar' })) remove.mutate(p.id) }}
      onSend={async (body) => { await sendDirect(me, id, body); await qc.invalidateQueries({ queryKey: ['dm'] }); await qc.invalidateQueries({ queryKey: ['friends'] }) }}
    />
    {report && <ReportSheet target={report} onClose={() => setReport(null)} />}
    </>
  )
}
