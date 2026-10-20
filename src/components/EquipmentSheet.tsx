import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  detailLine, formatLabel, kindInfo, kindOrder, quantityLabel, unitLabel, type EquipFormat, type EquipKind, type Equipment,
} from '../lib/equipment'
import { ask } from '../lib/confirm'
import { money } from '../lib/slots'
import { deleteEquipment, listEquipment, saveEquipment, type Room } from '../lib/venues'
import Sheet from './Sheet'

const blank = (roomId: string, kind: EquipKind): Equipment => ({
  id: crypto.randomUUID(), roomId, kind, title: '', quantity: 1, format: null, brand: '', model: '', channels: null, details: '',
  included: !kindInfo[kind].rentDefault, extraPrice: null, extraUnit: 'hour',
})

/** Equipo de una sala: lista y formulario. Lo básico (qué y cuántos) basta; la referencia exacta es opcional. */
export default function EquipmentSheet({ venueId, room, onClose }: { venueId: string; room: Room; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: all = [] } = useQuery({ queryKey: ['equipment', venueId], queryFn: () => listEquipment(venueId) })
  const items = all.filter((e) => e.roomId === room.id)
  const [form, setForm] = useState<{ item: Equipment; isNew: boolean } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['equipment', venueId] })

  if (form) {
    return (
      <ItemForm
        title={`${form.isNew ? 'Agregar equipo' : 'Editar equipo'} · ${room.name}`}
        initial={form.item}
        onBack={() => setForm(null)}
        onSave={async (e) => { await saveEquipment(venueId, e, form.isNew); await refresh(); setForm(null) }}
        onDelete={form.isNew ? undefined : async () => {
          if (!(await ask({ title: `¿Quitar «${quantityLabel(form.item)}»?`, confirmLabel: 'Quitar' }))) return
          await deleteEquipment(form.item.id); await refresh(); setForm(null)
        }}
      />
    )
  }

  const included = items.filter((e) => e.included)
  const extra = items.filter((e) => !e.included)
  const row = (e: Equipment) => (
    <button key={e.id} className="li" onClick={() => setForm({ item: e, isNew: false })} aria-label={`Editar ${quantityLabel(e)}`}>
      <div className="li-main">
        <div className="li-title">{quantityLabel(e)}</div>
        {detailLine(e) && <div className="li-sub wrap">{detailLine(e)}</div>}
      </div>
      {!e.included && <div className="readout"><b>{e.extraPrice != null ? money(e.extraPrice) : 'Consultar'}</b>{e.extraPrice != null ? unitLabel[e.extraUnit] : ''}</div>}
    </button>
  )

  return (
    <Sheet title={`Equipo · ${room.name}`} onClose={onClose}>
      <p className="li-sub wrap">Cuéntales a las bandas con qué van a ensayar. Con el tipo y la cantidad basta; la marca y la referencia exacta son opcionales.</p>
      <div className="section-title" style={{ margin: '4px 0 0' }}>Incluido en el precio{included.length ? ` · ${included.length}` : ''}</div>
      {included.length === 0 && <p className="li-sub wrap">Aún no has agregado equipo incluido.</p>}
      <div className="list" style={{ borderTop: included.length ? undefined : 0 }}>{included.map(row)}</div>
      <div className="section-title" style={{ margin: '10px 0 0' }}>Alquiler aparte{extra.length ? ` · ${extra.length}` : ''}</div>
      {extra.length === 0 && <p className="li-sub wrap">Lo que ofrezcas con costo adicional (guitarras, bajos, teclado…) aparece aquí.</p>}
      <div className="list" style={{ borderTop: extra.length ? undefined : 0 }}>{extra.map(row)}</div>

      <div className="section-title" style={{ margin: '10px 0 0' }}>Agregar</div>
      <div className="chips" style={{ marginTop: 0 }}>
        {kindOrder.map((k) => (
          <button key={k} type="button" className="tag" style={{ background: 'none', cursor: 'pointer', minHeight: 44, padding: '0 12px', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => setForm({ item: blank(room.id, k), isNew: true })}>{kindInfo[k].label}</button>
        ))}
      </div>
      <div className="sheet-foot"><button className="btn primary" onClick={onClose}>Listo</button></div>
    </Sheet>
  )
}

function ItemForm({ title, initial, onBack, onSave, onDelete }: {
  title: string; initial: Equipment; onBack: () => void; onSave: (e: Equipment) => Promise<unknown>; onDelete?: () => Promise<unknown>
}) {
  const [e, setE] = useState<Equipment>(initial)
  const [price, setPrice] = useState(initial.extraPrice != null ? String(initial.extraPrice) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const info = kindInfo[e.kind]
  const patch = (p: Partial<Equipment>) => setE((v) => ({ ...v, ...p }))

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (busy) return
    if (e.kind === 'other' && !e.title.trim()) return setError('Escribe qué equipo es.')
    setBusy(true)
    setError('')
    try {
      await onSave({ ...e, extraPrice: e.included ? null : price.replace(/\D/g, '') ? Number(price.replace(/\D/g, '')) : null })
    } catch {
      setError('No pudimos guardar el equipo. Intenta de nuevo.')
      setBusy(false)
    }
  }

  return (
    <Sheet title={title} onClose={onBack} onSubmit={submit}>
      <label className="field">Tipo
        <select value={e.kind} onChange={(ev) => { const kind = ev.target.value as EquipKind; patch({ kind, format: null, channels: null }) }}>
          {kindOrder.map((k) => <option key={k} value={k}>{kindInfo[k].label}</option>)}
        </select>
      </label>
      {e.kind === 'other' && (
        <label className="field">¿Qué equipo es?
          <input value={e.title} onChange={(ev) => patch({ title: ev.target.value })} maxLength={60} placeholder="Pedalera, atril, cajón peruano…" required />
        </label>
      )}
      <div className="grid-row">
        <label className="field" style={{ width: 96 }}>Cantidad
          <input type="number" inputMode="numeric" min={1} max={99} value={e.quantity} onChange={(ev) => patch({ quantity: Math.min(99, Math.max(1, Number(ev.target.value) || 1)) })} />
        </label>
        {info.formats && (
          <label className="field grow">{e.kind === 'mixer' ? 'Tipo de consola' : 'Formato'}
            <select value={e.format ?? ''} onChange={(ev) => patch({ format: (ev.target.value || null) as EquipFormat | null })}>
              <option value="">Sin dato</option>
              {info.formats.map((f) => <option key={f} value={f}>{formatLabel[f]}</option>)}
            </select>
          </label>
        )}
        {info.channels && (
          <label className="field" style={{ width: 104 }}>Canales
            <input type="number" inputMode="numeric" min={1} max={128} value={e.channels ?? ''} onChange={(ev) => patch({ channels: ev.target.value ? Number(ev.target.value) : null })} placeholder="16" />
          </label>
        )}
      </div>

      <div className="grid-row">
        <label className="field grow">Marca (opcional)
          <input value={e.brand} onChange={(ev) => patch({ brand: ev.target.value })} maxLength={60} placeholder={info.example[0]} />
        </label>
        <label className="field grow">Referencia (opcional)
          <input value={e.model} onChange={(ev) => patch({ model: ev.target.value })} maxLength={80} placeholder={info.example[1]} />
        </label>
      </div>
      <label className="field">Detalles (opcional)
        <textarea rows={2} value={e.details} onChange={(ev) => patch({ details: ev.target.value })} maxLength={300}
          placeholder={e.kind === 'drums' ? 'Pearl Export: bombo, caja, 2 toms, tom de piso y 3 platillos.' : e.kind === 'guitar_amp' ? 'Cabina 4×12 Celestion, 100 W.' : 'Estado, accesorios, lo que quieras contar.'} />
      </label>

      <fieldset className="radio-group" style={{ border: 0, padding: 0 }}>
        <legend>¿Cómo se ofrece?</legend>
        <label className="check-row">
          <input type="radio" name="inc" checked={e.included} onChange={() => patch({ included: true })} />
          <span>Incluido en el precio de la sala.</span>
        </label>
        <label className="check-row">
          <input type="radio" name="inc" checked={!e.included} onChange={() => patch({ included: false })} />
          <span>Alquiler aparte, con costo adicional.</span>
        </label>
      </fieldset>
      {!e.included && (
        <div className="grid-row">
          <label className="field grow">Precio (COP, opcional)
            <input inputMode="numeric" value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="15000" />
          </label>
          <label className="field grow">Se cobra
            <select value={e.extraUnit} onChange={(ev) => patch({ extraUnit: ev.target.value as 'hour' | 'session' })}>
              <option value="hour">Por hora</option>
              <option value="session">Por sesión</option>
            </select>
          </label>
        </div>
      )}

      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row">
          {onDelete && <button type="button" className="btn danger" disabled={busy} onClick={() => void onDelete()}>Quitar</button>}
          <button className="btn grow" type="button" onClick={onBack} disabled={busy}>Volver</button>
          <button className="btn primary grow" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Sheet>
  )
}
