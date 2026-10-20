import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CalendarSheet from '../../components/CalendarSheet'
import EquipmentSheet from '../../components/EquipmentSheet'
import ListSkeleton from '../../components/Skeleton'
import { RoomForm } from '../../components/VenueForms'
import { ask } from '../../lib/confirm'
import { byRoom, dimensionsLabel, includedChips, rentals } from '../../lib/equipment'
import { money, weekOrder, weekdayNames } from '../../lib/slots'
import { deleteRoom, listCalendarSources, listEquipment, listHours, listRooms, saveHours, saveRoom, syncCalendars, type Hours, type Room } from '../../lib/venues'
import { useVenue } from './BusinessContext'

// Salas del ensayadero: precios, horario de atención y calendarios de Google.
export default function BusinessRooms() {
  const venue = useVenue()
  const qc = useQueryClient()
  const { data: rooms = [], isLoading } = useQuery({ queryKey: ['venue-rooms', venue.id], queryFn: () => listRooms(venue.id) })
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', venue.id], queryFn: () => listHours(venue.id) })
  const { data: sources = [] } = useQuery({ queryKey: ['calendar-sources', venue.id], queryFn: () => listCalendarSources(venue.id) })
  const { data: equipment = [] } = useQuery({ queryKey: ['equipment', venue.id], queryFn: () => listEquipment(venue.id) })
  const equipByRoom = byRoom(equipment)
  const [equipRoom, setEquipRoom] = useState<Room | null>(null)
  const [calRoom, setCalRoom] = useState<Room | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState<Room | 'new' | null>(null)
  const refreshCalendars = () => Promise.all([qc.invalidateQueries({ queryKey: ['calendar-sources', venue.id] }), qc.invalidateQueries({ queryKey: ['busy'] })])
  const refreshRooms = () => qc.invalidateQueries({ queryKey: ['venue-rooms', venue.id] })

  async function removeRoom(r: Room): Promise<boolean> {
    if (!(await ask({ title: `¿Borrar «${r.name}»?`, body: 'Se borran también sus reservas.', confirmLabel: 'Borrar' }))) return false
    await deleteRoom(r.id)
    await refreshRooms()
    return true
  }

  return (
    <>
      <div className="section-title">Salas de ensayo</div>
      {isLoading && <ListSkeleton rows={2} />}
      {!isLoading && rooms.length === 0 && <p className="li-sub wrap">Agrega al menos una sala para poder publicar tu ensayadero: cada una se reserva por separado.</p>}
      <div className="list cols" style={{ borderTop: rooms.length ? undefined : 0 }}>
        {rooms.map((r) => {
          const items = equipByRoom.get(r.id) ?? []
          const dims = dimensionsLabel(r)
          const included = includedChips(items)
          const extra = rentals(items)
          return (
            <div key={r.id} className="li" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <button className="li-main main-btn" onClick={() => setEditing(r)} aria-label={`Editar ${r.name}`}>
                <div className="li-title">{r.name}</div>
                <div className="li-sub">Hasta {r.capacity} personas{dims ? ` · ${dims}` : ''}</div>
                {r.description && <div className="li-sub wrap">{r.description}</div>}
                {included.length > 0 && <div className="chips">{included.map((c) => <span key={c} className="tag">{c}</span>)}</div>}
                {extra.length > 0 && <div className="li-sub" style={{ marginTop: 6 }}>Alquiler aparte: {extra.map((x) => x.label).join(', ')}</div>}
              </button>
              <div className="readout"><b>{money(r.pricePerHour)}</b>{r.pricePerHour ? 'por hora' : ''}</div>
              <div className="row" style={{ width: '100%', justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setEquipRoom(r)}>Equipo{items.length ? ` · ${items.length}` : ''}</button>
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>Agregar sala</button>

      <div className="section-title">Calendario de Google</div>
      <p className="li-sub wrap">Conecta el Google Calendar de cada sala y lo que ya anotas allí bloquea esas horas solo. Es opcional.</p>
      <div className="list" style={{ marginTop: 10 }}>
        {rooms.map((r) => {
          const src = sources.find((x) => x.roomId === r.id)
          const when = src?.lastSyncedAt ? new Date(src.lastSyncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null
          return (
            <button key={r.id} className="li" onClick={() => setCalRoom(r)} aria-label={`Calendario de ${r.name}`}>
              <div className="li-main">
                <div className="li-title">{r.name}</div>
                <div className="li-sub">
                  {!src ? 'Sin conectar'
                    : src.lastStatus === 'error' ? `No se pudo leer: ${src.lastError || 'error desconocido'}`
                    : src.lastStatus === 'ok' ? `Conectado · ${src.blocks} bloques ocupados · leído ${when}`
                    : 'Conectado · esperando la primera lectura'}
                </div>
              </div>
              <span className={`tag ${src?.lastStatus === 'ok' ? 'ok' : src?.lastStatus === 'error' ? 'warn' : ''}`}>{src ? (src.lastStatus === 'error' ? 'Revisar' : 'Conectado') : 'Conectar'}</span>
            </button>
          )
        })}
      </div>
      {sources.length > 0 && (
        <button className="btn" style={{ marginTop: 12 }} disabled={syncing} onClick={async () => { setSyncing(true); await syncCalendars(venue.id, true); await refreshCalendars(); setSyncing(false) }}>
          {syncing ? 'Leyendo…' : 'Sincronizar ahora'}
        </button>
      )}

      <div className="section-title">Horario de atención</div>
      <HoursEditor venueId={venue.id} initial={hours} />

      {equipRoom && <EquipmentSheet venueId={venue.id} room={equipRoom} onClose={() => setEquipRoom(null)} />}
      {calRoom && <CalendarSheet venueId={venue.id} room={calRoom} otherRooms={rooms.filter((r) => r.id !== calRoom.id)} source={sources.find((x) => x.roomId === calRoom.id)} onChanged={refreshCalendars} onClose={() => setCalRoom(null)} />}
      {editing && (
        <RoomForm
          room={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (r) => { await saveRoom(venue.id, r); await refreshRooms() }}
          onDelete={editing === 'new' ? undefined : () => removeRoom(editing)}
        />
      )}
    </>
  )
}

type Day = { open: boolean; opens: string; closes: string }
const hm = (t: string) => t.slice(0, 5)

function HoursEditor({ venueId, initial }: { venueId: string; initial: Hours[] }) {
  const qc = useQueryClient()
  // key en el padre no reinicia esto; se parte de lo guardado una sola vez.
  const [days, setDays] = useState<Record<number, Day>>(() => {
    const map: Record<number, Day> = {}
    for (let d = 0; d < 7; d++) {
      const h = initial.find((x) => x.weekday === d)
      map[d] = h ? { open: true, opens: hm(h.opens), closes: hm(h.closes) } : { open: false, opens: '16:00', closes: '22:00' }
    }
    return map
  })
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const [error, setError] = useState('')

  const set = (d: number, p: Partial<Day>) => { setDays((v) => ({ ...v, [d]: { ...v[d], ...p } })); setStatus('') }
  const firstOpen = useMemo(() => weekOrder.find((d) => days[d].open), [days])

  function copyToAll() {
    if (firstOpen === undefined) return
    const src = days[firstOpen]
    setDays((v) => Object.fromEntries(Object.entries(v).map(([k, d]) => [k, d.open ? { ...d, opens: src.opens, closes: src.closes } : d])) as Record<number, Day>)
    setStatus('')
  }

  async function save() {
    const rows: Hours[] = []
    for (const d of weekOrder) {
      const x = days[d]
      if (!x.open) continue
      if (x.closes <= x.opens) return setError(`${weekdayNames[d]}: la hora de cierre debe ser después de la de apertura.`)
      rows.push({ weekday: d, opens: x.opens, closes: x.closes })
    }
    setError('')
    setStatus('saving')
    try {
      await saveHours(venueId, rows)
      await qc.invalidateQueries({ queryKey: ['venue-hours', venueId] })
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="stack">
      {weekOrder.map((d) => {
        const x = days[d]
        return (
          <div key={d} className="hours-row">
            <label className="check-row" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={x.open} onChange={(e) => set(d, { open: e.target.checked })} />
              <span>{weekdayNames[d]}</span>
            </label>
            {x.open ? (
              <div className="hours-times">
                <input type="time" value={x.opens} onChange={(e) => set(d, { opens: e.target.value })} aria-label={`${weekdayNames[d]}: abre`} />
                <span aria-hidden>a</span>
                <input type="time" value={x.closes} onChange={(e) => set(d, { closes: e.target.value })} aria-label={`${weekdayNames[d]}: cierra`} />
              </div>
            ) : <span className="li-sub">Cerrado</span>}
          </div>
        )
      })}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={copyToAll} disabled={firstOpen === undefined}>Usar el mismo horario en todos los días abiertos</button>
        <button className="btn primary" onClick={() => void save()} disabled={status === 'saving'}>{status === 'saving' ? 'Guardando…' : 'Guardar horario'}</button>
      </div>
      {status === 'saved' && <p role="status" className="form-ok">Horario guardado.</p>}
      {status === 'error' && <p className="form-error" role="alert">No pudimos guardar el horario. Intenta de nuevo.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}

