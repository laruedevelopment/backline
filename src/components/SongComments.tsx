import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addSongComment, deleteSongComment, listMembers, listSongComments } from '../lib/api'
import { ask } from '../lib/confirm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import Thread from './Thread'

/** Comentarios de una canción (por ejemplo «subamos medio tono»): los lee toda la banda, en vivo. */
export default function SongComments({ songId, bandId, canWrite, canModerate }: { songId: string; bandId: string; canWrite: boolean; canModerate: boolean }) {
  const qc = useQueryClient()
  const userId = useAuth((s) => s.session?.user.id)
  const { data: posts = [] } = useQuery({ queryKey: ['song-comments', songId], queryFn: () => listSongComments(songId), enabled: !!supabase })
  const { data: members = [] } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId), enabled: !!supabase })
  const refresh = () => qc.invalidateQueries({ queryKey: ['song-comments', songId] })
  const remove = useMutation({ mutationFn: (id: string) => deleteSongComment(id), onSuccess: refresh })
  if (!supabase || !userId) return null

  return (
    <>
      <h3 className="section-title">Comentarios{posts.length ? ` (${posts.length})` : ''}</h3>
      <p className="li-sub wrap">Para hablar de esta canción con la banda: tono, estructura, quién entra cuándo.</p>
      <Thread
        variant="inline" posts={posts} members={members} userId={userId} max={1000}
        placeholder="Escribe un comentario…" emptyText="Todavía no hay comentarios en esta canción."
        canDelete={(p) => p.profileId === userId || canModerate}
        onDelete={async (p) => { if (await ask({ title: '¿Borrar el comentario?', body: 'Se borra para toda la banda.', confirmLabel: 'Borrar' })) remove.mutate(p.id) }}
        onSend={canWrite ? async (body) => { await addSongComment(bandId, songId, userId, body); await refresh() } : null}
      />
    </>
  )
}
