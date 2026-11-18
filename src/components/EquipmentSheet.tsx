import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { formatLabel, kindInfo, kindOrder, unitLabel, type EquipFormat, type EquipKind, type Equipment } from '../lib/equipment'
import { ask } from '../lib/confirm'
import { copyIncluded, listEquipment, saveEquipmentBatch, type Room } from '../lib/venues'
import { HelpRow } from './InfoTip'
import Sheet from './Sheet'

const blank = (kind: EquipKind, roomId: string | null): Equipment => ({
  id: `new-${crypto.randomUUID()}`, isNew: true, roomId, kind, title: '', quantity: 1, format: null, brand: '', model: '', channels: null, details: '',
  included: roomId !== null, extraPrice: null, extraUnit: 'hour',
})

/**
 * Equipo del ensayadero con casillas: marcas lo que tienes y, en la misma fila, completas (si quieres) cantidad, marca, referencia y detalles.
 * Con `room` es lo que incluye esa sala en su precio; sin `room` es el alquiler de todo el ensayadero (con precio).
 */
export default function EquipmentSheet({ venueId, room, rooms, onClose }: { venueId: string; room?: Room; rooms: Room[]; onClose: () => void }) {
  const qc = useQueryClient()
  const roomId = room?.id ?? null
  const { data: all, isLoading } = useQuery({ queryKey: ['equipment', venueId], queryFn: () => listEquipment(venueId) })
  const original = (all ?? []).filter((e) => (roomId ? e.roomId === roomId : e.roomId === null && !e.included))
  const [rows, setRows] = useState<Equipment[] | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = rows ?? original
  const rental = roomId === null

  const patchRows = (next: Equipment[]) => setRows(next)
  const toggle = (kind: EquipKind, on: boolean) => {
    if (on) return patchRows([...current, blank(kind, roomId)])
    const gone = current.filter((r) => r.kind === kind)
    setRemoved((x) => [...x, ...gone.filter((g) => !g.isNew).map((g) => g.id)])
    patchRows(current.filter((r) => r.kind !== kind))
  }
  const change = (id: string, p: Partial<Equipment>) => patchRows(current.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const drop = (r: Equipment) => {
    if (!r.isNew) setRemoved((x) => [...x, r.id])
    patchRows(current.filter((x) => x.id !== r.id))
  }

  async function save(): Promise<boolean> {
    setBusy(true); setError('')
    try {
      await saveEquipmentBatch(venueId, roomId, current, removed)
      await qc.invalidateQueries({ queryKey: ['equipment', venueId] })
      return true
    } catch { setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'); return false } finally { setBusy(false) }
  }
  async function saveAndClose() { if (await save()) onClose() }
  async function copyToOthers() {
    const others = rooms.filter((r) => r.id !== roomId)
    if (!others.length || !(await ask({ title: 'Copiar a las demás salas', body: `Las otras ${others.length} salas quedarán con este mismo equipo incluido (se reemplaza lo que tuvieran).`, confirmLabel: 'Copiar' }))) return
    if (!(await save())) return
    try { await copyIncluded(venueId, current, others.map((r) => r.id)); await qc.invalidateQueries({ queryKey: ['equipment', venueId] }); onClose() } catch { setError('No se pudo copiar a las demás salas.') }
  }

  return (
    <Sheet title={rental ? 'Alquiler del ensayadero' : `Equipo incluido · ${room!.name}`} onClose={onClose}>
      <HelpRow text={rental
        ? 'Lo que alquilas aparte vale para todas las salas del ensayadero y se toma por orden de llegada: no se reserva con la sala. Marca lo que ofreces y, si quieres, completa marca, referencia y precio.'
        : 'Marca lo que trae esta sala dentro de su precio. La cantidad y el tipo bastan; marca, referencia y detalles son opcionales.'} />
      {isLoading && <p className="li-sub">Cargando…</p>}
      {!isLoading && (
        <div className="eq-list">
          {kindOrder.map((kind) => {
            const info = kindInfo[kind]
            const mine = current.filter((r) => r.kind === kind)
            return (
              <div key={kind} className={`eq-block ${mine.length ? 'on' : ''}`}>
                <label className="check-row eq-check">
                  <input type="checkbox" checked={mine.length > 0} onChange={(e) => toggle(kind, e.target.checked)} /> <span>{info.label}</span>
                </label>
                {mine.map((r, i) => (
                  <div key={r.id} className="eq-fields">
                    {kind === 'other' && <input className="eq-wide" value={r.title} maxLength={60} placeholder="¿Qué equipo es?" aria-label="Nombre del equipo" onChange={(e) => change(r.id, { title: e.target.value })} />}
                    <label className="eq-qty">Cant.
                      <input type="number" inputMode="numeric" min={1} max={99} value={r.quantity} onChange={(e) => change(r.id, { quantity: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
                    </label>
                    <input value={r.brand} maxLength={60} placeholder={`Marca${info.example[0] ? ` (${info.example[0]})` : ''}`} aria-label="Marca" onChange={(e) => change(r.id, { brand: e.target.value })} />
                    <input value={r.model} maxLength={80} placeholder={`Referencia${info.example[1] ? ` (${info.example[1]})` : ''}`} aria-label="Referencia" onChange={(e) => change(r.id, { model: e.target.value })} />
                    {info.formats && (
                      <select value={r.format ?? ''} aria-label="Formato" onChange={(e) => change(r.id, { format: (e.target.value || null) as EquipFormat | null })}>
                        <option value="">Formato</option>
                        {info.formats.map((f) => <option key={f} value={f}>{formatLabel[f]}</option>)}
                      </select>
                    )}
                    {info.channels && <input type="number" inputMode="numeric" min={1} max={128} value={r.channels ?? ''} placeholder="Canales" aria-label="Canales" onChange={(e) => change(r.id, { channels: Number(e.target.value) || null })} />}
                    <input className="eq-wide" value={r.details} maxLength={300} placeholder="Detalles u observaciones (opcional)" aria-label="Detalles" onChange={(e) => change(r.id, { details: e.target.value })} />
                    {rental && (
                      <span className="eq-price">
                        <input inputMode="numeric" value={r.extraPrice ?? ''} placeholder="Precio" aria-label="Precio del alquiler" onChange={(e) => change(r.id, { extraPrice: e.target.value ? Math.min(2_000_000, Number(e.target.value.replace(/\D/g, '')) || 0) : null })} />
                        <select value={r.extraUnit} aria-label="Cobro por" onChange={(e) => change(r.id, { extraUnit: e.target.value as 'hour' | 'session' })}>
                          <option value="hour">{unitLabel.hour}</option>
                          <option value="session">{unitLabel.session}</option>
                        </select>
                      </span>
                    )}
                    <span className="eq-actions">
                      {i === mine.length - 1 && mine.length < 6 && <button type="button" className="btn ghost sm" onClick={() => patchRows([...current, blank(kind, roomId)])} aria-label={`Agregar otro: ${info.label}`}><Plus size={14} aria-hidden /> Otro</button>}
                      {mine.length > 1 && <button type="button" className="icon-quiet" onClick={() => drop(r)} aria-label="Quitar esta fila"><Trash2 size={16} aria-hidden /></button>}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-foot">
        <div className="row">
          {!rental && rooms.length > 1 && <button type="button" className="btn" disabled={busy} onClick={() => void copyToOthers()}>Copiar a las demás salas</button>}
          <button type="button" className="btn primary grow" disabled={busy || isLoading} onClick={() => void saveAndClose()}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Sheet>
  )
}
