import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMembers, listMemberNotes, saveMyNote } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

/** Anotaciones por músico de una canción: cada quien escribe la suya (se ve solo en su modo escenario); la banda las lee aquí. */
export default function MemberNotes({ songId, bandId, canWrite }: { songId: string; bandId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const userId = useAuth((s) => s.session?.user.id)
  const { data: notes = [] } = useQuery({ queryKey: ['song-notes', bandId], queryFn: () => listMemberNotes(bandId), enabled: !!supabase })
  const { data: members = [] } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId), enabled: !!supabase })
  const mine = notes.find((n) => n.songId === songId && n.profileId === userId)?.note ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const save = useMutation({
    mutationFn: (text: string) => saveMyNote(bandId, songId, userId!, text),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['song-notes', bandId] }); setMsg('Guardada') },
    onError: () => setMsg('No pudimos guardarla. Intenta de nuevo.'),
  })
  if (!supabase || !userId) return null

  const others = notes.filter((n) => n.songId === songId && n.profileId !== userId)
  const nameOf = (id: string) => members.find((m) => m.profileId === id)?.name ?? 'Integrante'
  const commit = () => {
    const text = (draft ?? mine).trim()
    setDraft(null)
    if (text !== mine.trim()) { setMsg('Guardando…'); save.mutate(text) }
  }

  return (
    <>
      <h3 className="section-title">Anotaciones de cada músico</h3>
      <p className="li-sub wrap">Lo que cada quien necesita en esta canción (por ejemplo, qué guitarra usa). Toda la banda lo ve aquí; en el modo escenario cada quien ve solo la suya.</p>
      {canWrite && (
        <label className="field">Mi anotación
          <textarea rows={2} value={draft ?? mine} maxLength={500} placeholder="Les Paul, afinada en Drop D" onChange={(e) => { setDraft(e.target.value); setMsg('') }} onBlur={commit} />
          {msg && <span className="li-sub" role="status">{msg}</span>}
        </label>
      )}
      {others.length > 0 && (
        <ul className="member-notes">
          {others.map((n) => <li key={n.profileId}><b>{nameOf(n.profileId)}</b> {n.note}</li>)}
        </ul>
      )}
      {!canWrite && others.length === 0 && <p className="li-sub">Todavía nadie anotó nada en esta canción.</p>}
    </>
  )
}
