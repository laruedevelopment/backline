import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { listMembers } from '../lib/api'
import { addGear, deleteGear, GEAR_PRESETS, listGear, updateGear } from '../lib/gear'
import Sheet from './Sheet'

/** Lista de equipo de un toque o ensayo: quién lleva qué y qué ya está listo. */
export default function EventGear({ bandId, eventId, title, canEdit, onClose }: { bandId: string; eventId: string; title: string; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const { data: all = [] } = useQuery({ queryKey: ['gear', bandId], queryFn: () => listGear(bandId) })
  const { data: members = [] } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId) })
  const items = all.filter((g) => g.eventId === eventId)
  const refresh = () => qc.invalidateQueries({ queryKey: ['gear', bandId] })
  const fail = () => setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
  const add = useMutation({ mutationFn: (item: string) => addGear(bandId, eventId, item, null), onSuccess: () => { setError(''); return refresh() }, onError: fail })
  const change = useMutation({ mutationFn: (v: { id: string; patch: { done?: boolean; assigned_to?: string | null } }) => updateGear(v.id, v.patch), onSuccess: refresh, onError: fail })
  const remove = useMutation({ mutationFn: (id: string) => deleteGear(id), onSuccess: refresh, onError: fail })
  const done = items.filter((g) => g.done).length
  const pending = items.filter((g) => !g.done)

  return (
    <Sheet title={`Equipo · ${title}`} onClose={onClose}>
      <p className="li-sub wrap">{items.length ? `${done} de ${items.length} listo${done === 1 ? '' : 's'}${pending.length ? `. Falta: ${pending.slice(0, 4).map((g) => g.item).join(', ')}${pending.length > 4 ? '…' : ''}` : '. ¡Todo listo!'}` : 'Anota qué hay que llevar y quién se encarga. Así nadie llega sin los cables.'}</p>
      <div className="gear-list">
        {items.map((g) => {
          const who = members.find((m) => m.profileId === g.assignedTo)
          return (
            <div key={g.id} className={`gear-row ${g.done ? 'done' : ''}`}>
              <label className="check-row gear-check">
                <input type="checkbox" checked={g.done} disabled={!canEdit || change.isPending} onChange={(e) => change.mutate({ id: g.id, patch: { done: e.target.checked } })} />
                <span>{g.item}</span>
              </label>
              {canEdit ? (
                <select aria-label={`Quién lleva ${g.item}`} value={g.assignedTo ?? ''} onChange={(e) => change.mutate({ id: g.id, patch: { assigned_to: e.target.value || null } })}>
                  <option value="">Sin asignar</option>
                  {members.map((m) => <option key={m.profileId} value={m.profileId}>{m.name}</option>)}
                </select>
              ) : <span className="li-sub">{who?.name ?? 'Sin asignar'}</span>}
              {canEdit && <button type="button" className="btn ghost icon" aria-label={`Quitar ${g.item}`} onClick={() => remove.mutate(g.id)}><Trash2 size={16} aria-hidden /></button>}
            </div>
          )
        })}
      </div>
      {canEdit && (
        <>
          <form className="row" onSubmit={(e) => { e.preventDefault(); const t = draft.trim(); if (t && !add.isPending) { add.mutate(t); setDraft('') } }}>
            <input value={draft} maxLength={60} placeholder="Agregar equipo (por ejemplo, cable XLR)" aria-label="Agregar equipo" onChange={(e) => setDraft(e.target.value)} />
            <button className="btn primary" disabled={!draft.trim() || add.isPending}>Agregar</button>
          </form>
          <div className="chips" role="group" aria-label="Sugerencias">
            {GEAR_PRESETS.filter((p) => !items.some((g) => g.item === p)).slice(0, 8).map((p) => <button key={p} type="button" className="tag" onClick={() => add.mutate(p)}>+ {p}</button>)}
          </div>
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Sheet>
  )
}
