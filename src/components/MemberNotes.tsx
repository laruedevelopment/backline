import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMembers, listMemberNotes, saveMemberNote } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

type Props = { songId: string; bandId: string; canWrite: boolean; canManage: boolean }

/** Una anotación editable: se guarda al salir del campo. */
function NoteField({ songId, bandId, profileId, actorId, label, current, by, placeholder }: { songId: string; bandId: string; profileId: string; actorId: string; label: string; current: string; by?: string; placeholder?: string }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const save = useMutation({
    mutationFn: (text: string) => saveMemberNote(bandId, songId, profileId, actorId, text),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['song-notes', bandId] }); setDraft(null); setMsg('Guardada') },
    onError: () => setMsg('No pudimos guardarla. Intenta de nuevo.'),
  })
  const commit = () => {
    const text = (draft ?? current).trim()
    if (text !== current.trim()) { setMsg('Guardando…'); save.mutate(text) } else setDraft(null)
  }
  return (
    <label className="field">{label}
      <textarea rows={2} value={draft ?? current} maxLength={500} placeholder={placeholder} onChange={(e) => { setDraft(e.target.value); setMsg('') }} onBlur={commit} />
      {(msg || by) && <span className="li-sub" role="status">{msg || by}</span>}
    </label>
  )
}

/**
 * Anotaciones por músico de una canción. Cada quien escribe la suya (se ve solo en su modo escenario); quien lidera la banda
 * (dueño o admin) escribe la de cualquier integrante; el resto de la banda las lee aquí.
 */
export default function MemberNotes({ songId, bandId, canWrite, canManage }: Props) {
  const userId = useAuth((s) => s.session?.user.id)
  const { data: notes = [] } = useQuery({ queryKey: ['song-notes', bandId], queryFn: () => listMemberNotes(bandId), enabled: !!supabase })
  const { data: members = [] } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId), enabled: !!supabase })
  if (!supabase || !userId) return null

  const noteOf = (id: string) => notes.find((n) => n.songId === songId && n.profileId === id)
  const nameOf = (id: string) => members.find((m) => m.profileId === id)?.name ?? 'Integrante'
  const byLabel = (id: string) => { const n = noteOf(id); return n?.updatedBy && n.updatedBy !== id ? `La escribió ${nameOf(n.updatedBy)}` : undefined }
  const others = members.filter((m) => m.profileId !== userId)

  return (
    <>
      <h3 className="section-title">Anotaciones de cada músico</h3>
      <p className="li-sub wrap">
        Lo que cada quien necesita en esta canción (por ejemplo, qué guitarra usa). En el modo escenario cada quien ve solo la suya.
        {canManage ? ' Como lideras la banda, puedes escribir la de cada integrante.' : ' Tú escribes la tuya; la banda las lee aquí.'}
      </p>
      {canWrite && (
        <NoteField songId={songId} bandId={bandId} profileId={userId} actorId={userId} label="Mi anotación" current={noteOf(userId)?.note ?? ''} by={byLabel(userId)} placeholder="Les Paul, afinada en Drop D" />
      )}
      {canManage
        ? others.map((m) => <NoteField key={m.profileId} songId={songId} bandId={bandId} profileId={m.profileId} actorId={userId} label={`Anotación de ${m.name}${m.instrument ? ` · ${m.instrument}` : ''}`} current={noteOf(m.profileId)?.note ?? ''} by={byLabel(m.profileId)} />)
        : (
          <ul className="member-notes">
            {others.filter((m) => noteOf(m.profileId)).map((m) => <li key={m.profileId}><b>{m.name}</b> {noteOf(m.profileId)!.note}</li>)}
          </ul>
        )}
      {!canWrite && !canManage && !notes.some((n) => n.songId === songId) && <p className="li-sub">Todavía nadie anotó nada en esta canción.</p>}
    </>
  )
}
