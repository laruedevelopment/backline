import { useState } from 'react'
import { amenityOptions } from '../lib/identity'
import { cleanSocial } from '../lib/links'
import { kindLabel, type Room, type Venue, type VenueDraft, type VenueKind } from '../lib/venues'
import Sheet from './Sheet'
import CityInput from './CityInput'

const emptyDraft: VenueDraft = { kind: 'rehearsal_room', name: '', city: '', address: '', description: '', amenities: [], whatsapp: '', links: {}, bookingUrl: '' }

export function VenueForm({ venue, onSave, onClose }: { venue?: Venue; onSave: (d: VenueDraft) => Promise<unknown>; onClose: () => void }) {
  const [d, setD] = useState<VenueDraft>(() => venue
    ? { kind: venue.kind, name: venue.name, city: venue.city, address: venue.address, description: venue.description, amenities: venue.amenities, whatsapp: venue.whatsapp, links: venue.links, bookingUrl: venue.bookingUrl }
    : emptyDraft)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const patch = (p: Partial<VenueDraft>) => setD((v) => ({ ...v, ...p }))
  const toggle = (a: string) => patch({ amenities: d.amenities.includes(a) ? d.amenities.filter((x) => x !== a) : d.amenities.length < 20 ? [...d.amenities, a] : d.amenities })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const links = { ...d.links }
    for (const k of ['instagram', 'web'] as const) {
      const raw = (links[k] ?? '').trim()
      if (!raw) { delete links[k]; continue }
      const url = cleanSocial(k, raw)
      if (!url) return setError(`El enlace de ${k === 'web' ? 'tu sitio web' : 'Instagram'} no parece válido.`)
      links[k] = url
    }
    const booking = d.bookingUrl.trim()
    if (booking && !/^https:\/\/\S+$/i.test(booking)) return setError('El enlace para reservar debe empezar por https://')
    setBusy(true)
    setError('')
    try {
      await onSave({ ...d, links, bookingUrl: booking })
      onClose()
    } catch {
      setError('No pudimos guardar. Revisa los datos e intenta de nuevo.')
      setBusy(false)
    }
  }

  return (
    <Sheet title={venue ? 'Datos de tu sala de ensayos' : 'Publicar mi sala de ensayos'} onClose={onClose} onSubmit={submit}>
      <div className="tabs" role="group" aria-label="Tipo de lugar">
        {(Object.keys(kindLabel) as VenueKind[]).map((k) => (
          <button key={k} type="button" aria-pressed={d.kind === k} className={d.kind === k ? 'active' : ''} onClick={() => patch({ kind: k })}>{kindLabel[k]}</button>
        ))}
      </div>
      <label className="field">Nombre
        <input value={d.name} onChange={(e) => patch({ name: e.target.value })} maxLength={80} required placeholder="Sala Resonancia" />
      </label>
      <div className="grid-row">
        <label className="field grow">Ciudad
          <CityInput value={d.city} onChange={(city) => patch({ city })} required placeholder="Bucaramanga" />
        </label>
        <label className="field grow">WhatsApp
          <input type="tel" inputMode="tel" value={d.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} maxLength={20} placeholder="300 123 4567" />
        </label>
      </div>
      <label className="field">Dirección
        <input value={d.address} onChange={(e) => patch({ address: e.target.value })} maxLength={160} placeholder="Cra 33 # 45-12, Cabecera" />
      </label>
      <label className="field">Descripción
        <textarea rows={4} value={d.description} onChange={(e) => patch({ description: e.target.value })} maxLength={1000} placeholder="Cómo son las salas, qué equipo hay, normas, cómo llegar." />
      </label>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="field" style={{ marginBottom: 6 }}>Qué ofrece</legend>
        <div className="chips" style={{ marginTop: 0 }}>
          {amenityOptions.map((a) => (
            <button key={a} type="button" className={`tag ${d.amenities.includes(a) ? 'key' : ''}`} aria-pressed={d.amenities.includes(a)} style={{ background: 'none', cursor: 'pointer' }} onClick={() => toggle(a)}>{a}</button>
          ))}
        </div>
      </fieldset>
      <label className="field">Instagram
        <input value={d.links.instagram ?? ''} onChange={(e) => patch({ links: { ...d.links, instagram: e.target.value } })} placeholder="@tuensayadero" autoCapitalize="none" />
      </label>
      <label className="field">Sitio web
        <input value={d.links.web ?? ''} onChange={(e) => patch({ links: { ...d.links, web: e.target.value } })} placeholder="tuensayadero.com" inputMode="url" autoCapitalize="none" />
      </label>
      <label className="field">Enlace para reservar en otro sistema (opcional)
        <input value={d.bookingUrl} onChange={(e) => setD({ ...d, bookingUrl: e.target.value })} placeholder="https://…" inputMode="url" autoCapitalize="none" />
      </label>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : venue ? 'Guardar' : 'Crear mi sala de ensayos'}</button>
      </div>
    </Sheet>
  )
}

export function RoomForm({ room, onSave, onDelete, onClose }: {
  room?: Room; onSave: (r: Omit<Room, 'venueId'>) => Promise<unknown>; onDelete?: () => Promise<boolean>; onClose: () => void
}) {
  const [name, setName] = useState(room?.name ?? '')
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 6))
  const [price, setPrice] = useState(room ? String(room.pricePerHour) : '')
  const [description, setDescription] = useState(room?.description ?? '')
  const [width, setWidth] = useState(room?.widthM != null ? String(room.widthM) : '')
  const [length, setLength] = useState(room?.lengthM != null ? String(room.lengthM) : '')
  const [height, setHeight] = useState(room?.heightM != null ? String(room.heightM) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const num = (t: string) => { const v = Number(t.replace(',', '.')); return t.trim() && Number.isFinite(v) && v > 0 ? v : null }
  const area = num(width) && num(length) ? Math.round(num(width)! * num(length)! * 10) / 10 : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if ((width.trim() && !num(width)) || (length.trim() && !num(length)) || (height.trim() && !num(height))) return setError('Las medidas deben ser números mayores que cero (en metros).')
    if (!!num(width) !== !!num(length)) return setError('Si das las medidas, escribe el ancho y el largo.')
    const cap = Number(capacity)
    const p = Number(price.replace(/\D/g, '')) || 0
    if (!(cap >= 1 && cap <= 60)) return setError('La capacidad debe estar entre 1 y 60 personas.')
    setBusy(true)
    setError('')
    try {
      await onSave({ id: room?.id ?? crypto.randomUUID(), name, capacity: cap, pricePerHour: p, description, widthM: num(width), lengthM: num(length), heightM: num(height) })
      onClose()
    } catch {
      setError('No pudimos guardar la sala. Intenta de nuevo.')
      setBusy(false)
    }
  }

  return (
    <Sheet title={room ? 'Editar sala' : 'Nueva sala'} onClose={onClose} onSubmit={submit}>
      <label className="field">Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Sala A" />
      </label>
      <div className="grid-row">
        <label className="field grow">Capacidad (personas)
          <input type="number" inputMode="numeric" min={1} max={60} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
        </label>
        <label className="field grow">Precio por hora (COP)
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="35000" />
        </label>
      </div>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="field" style={{ marginBottom: 6 }}>Tamaño de la sala (metros, opcional)</legend>
        <div className="grid3">
          <label className="field">Ancho
            <input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="4,5" />
          </label>
          <label className="field">Largo
            <input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} placeholder="6" />
          </label>
          <label className="field">Alto
            <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="2,8" />
          </label>
        </div>
        {area !== null && <p className="li-sub" style={{ marginTop: 6 }}>Área: {String(area).replace('.', ',')} m²</p>}
      </fieldset>
      <label className="field">Descripción (opcional)
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Batería Pearl, 2 amplificadores de guitarra, bajo Ampeg, PA con 3 micrófonos." />
      </label>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row">
          {onDelete && <button type="button" className="btn danger" disabled={busy} onClick={async () => { if (await onDelete()) onClose() }}>Borrar</button>}
          <button className="btn primary grow" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Sheet>
  )
}
