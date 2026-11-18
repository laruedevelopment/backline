import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Trash2 } from 'lucide-react'
import { ask } from '../lib/confirm'
import { bogotaDate, dayKey, formatDay, formatTime, todayBogota } from '../lib/slots'
import { addBlock, BlockConflict, listBlocks, removeBlock, type Room, type RoomBlock } from '../lib/venues'
import { HelpRow } from './InfoTip'
import Sheet from './Sheet'

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00-05:00`)
  d.setUTCDate(d.getUTCDate() + n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

const hhmm = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

function rangeText(b: RoomBlock) {
  const s = new Date(b.startsAt), e = new Date(b.endsAt)
  const last = new Date(e.getTime() - 1000)
  const whole = hhmm(s) === '00:00' && hhmm(e) === '00:00'
  if (whole) return dayKey(s) === dayKey(last) ? formatDay(s) : `Del ${formatDay(s)} al ${formatDay(last)}`
  return dayKey(s) === dayKey(last) ? `${formatDay(s)} · ${formatTime(s)} a ${formatTime(e)}` : `${formatDay(s)} ${formatTime(s)} → ${formatDay(last)} ${formatTime(e)}`
}

/** Cierres y bloqueos: cerrar todo el negocio, una sala en mejoras, un evento privado… Se bloquea por días completos o por horas. */
export default function BlocksSection({ venueId, rooms }: { venueId: string; rooms: Room[] }) {
  const qc = useQueryClient()
  const { data: blocks = [] } = useQuery({ queryKey: ['blocks', venueId], queryFn: () => listBlocks(venueId) })
  const [open, setOpen] = useState<null | { all: boolean }>(null)
  const [err, setErr] = useState('')
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['blocks', venueId] }), qc.invalidateQueries({ queryKey: ['busy'] }), qc.invalidateQueries({ queryKey: ['venue-bookings', venueId] })])
  const roomName = (id: string | null) => (id ? rooms.find((r) => r.id === id)?.name ?? 'Una sala' : 'Todo el negocio')

  async function remove(b: RoomBlock) {
    if (!(await ask({ title: '¿Quitar este bloqueo?', body: `${roomName(b.roomId)} · ${rangeText(b)}. Esas horas vuelven a estar disponibles.`, confirmLabel: 'Quitar bloqueo' }))) return
    try { await removeBlock(b.id); await refresh() } catch { setErr('No pudimos quitar el bloqueo. Intenta de nuevo.') }
  }

  return (
    <>
      <div className="section-title">Cierres y bloqueos</div>
      <HelpRow text="Cierra el negocio por unos días o bloquea una sala (mejoras, evento privado, vacaciones). Mientras esté bloqueado nadie puede reservar esas horas. Si ya había reservas, te preguntamos antes de cancelarlas." />
      {blocks.length === 0 && <p className="li-sub wrap">No tienes cierres programados.</p>}
      {blocks.length > 0 && (
        <div className="list">
          {blocks.map((b) => (
            <div key={b.id} className="li">
              <Lock size={18} aria-hidden style={{ flex: 'none', color: 'var(--amber)' }} />
              <div className="li-main">
                <div className="li-title">{roomName(b.roomId)}{b.reason ? ` · ${b.reason}` : ''}</div>
                <div className="li-sub wrap">{rangeText(b)}</div>
              </div>
              <button className="icon-quiet" onClick={() => void remove(b)} aria-label="Quitar bloqueo"><Trash2 size={16} aria-hidden /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setOpen({ all: true })}>Cerrar el negocio</button>
        <button className="btn" onClick={() => setOpen({ all: false })} disabled={rooms.length === 0}>Bloquear una sala</button>
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      {open && <BlockSheet venueId={venueId} rooms={rooms} startAll={open.all} onClose={() => setOpen(null)} onSaved={refresh} />}
    </>
  )
}

function BlockSheet({ venueId, rooms, startAll, onClose, onSaved }: { venueId: string; rooms: Room[]; startAll: boolean; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const today = todayBogota()
  const [roomId, setRoomId] = useState(startAll ? '' : rooms[0]?.id ?? '')
  const [mode, setMode] = useState<'days' | 'hours'>('days')
  const [from, setFrom] = useState(addDays(today, 1))
  const [to, setTo] = useState(addDays(today, 1))
  const [t1, setT1] = useState('08:00')
  const [t2, setT2] = useState('22:00')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const start = mode === 'days' ? bogotaDate(from, '00:00') : bogotaDate(from, t1)
    const end = mode === 'days' ? bogotaDate(addDays(to, 1), '00:00') : bogotaDate(from, t2)
    if (end <= start) return setError(mode === 'days' ? 'El último día no puede ser anterior al primero.' : 'La hora final debe ser después de la inicial.')
    setBusy(true); setError('')
    const v = { venueId, roomId: roomId || null, start, end, reason: reason.trim() }
    try {
      try { await addBlock(v) } catch (x) {
        if (!(x instanceof BlockConflict)) throw x
        const ok = await ask({ title: `Hay ${x.count} ${x.count === 1 ? 'reserva' : 'reservas'} en ese rango`, body: 'Si sigues, se cancelan y se les avisa a las personas con el motivo del bloqueo.', confirmLabel: 'Bloquear y cancelar' })
        if (!ok) { setBusy(false); return }
        await addBlock({ ...v, cancel: true })
      }
      await onSaved()
      onClose()
    } catch { setError('No pudimos guardar el bloqueo. Revisa las fechas e intenta de nuevo.'); setBusy(false) }
  }

  return (
    <Sheet title={roomId ? 'Bloquear una sala' : 'Cerrar el negocio'} onClose={onClose} onSubmit={submit}>
      <label className="field">Qué se bloquea
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Todo el negocio (todas las salas)</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>Solo: {r.name}</option>)}
        </select>
      </label>
      <div className="seg" role="group" aria-label="Tipo de bloqueo">
        <button type="button" className={mode === 'days' ? 'active' : ''} aria-pressed={mode === 'days'} onClick={() => setMode('days')}>Días completos</button>
        <button type="button" className={mode === 'hours' ? 'active' : ''} aria-pressed={mode === 'hours'} onClick={() => setMode('hours')}>Unas horas</button>
      </div>
      {mode === 'days' ? (
        <div className="grid-row">
          <label className="field grow">Desde
            <input type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} required />
          </label>
          <label className="field grow">Hasta (incluido)
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
          </label>
        </div>
      ) : (
        <>
          <label className="field">Día
            <input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} required />
          </label>
          <div className="grid-row">
            <label className="field grow">De<input type="time" value={t1} onChange={(e) => setT1(e.target.value)} required /></label>
            <label className="field grow">A<input type="time" value={t2} onChange={(e) => setT2(e.target.value)} required /></label>
          </div>
        </>
      )}
      <label className="field">Motivo (solo lo ves tú; se le muestra a quien tenga una reserva cancelada)
        <input value={reason} maxLength={80} placeholder="Mejoras, vacaciones, evento privado…" onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Bloquear'}</button>
      </div>
    </Sheet>
  )
}
