import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { VenueForm } from '../../components/VenueForms'
import VenueMedia from '../../components/VenueMedia'
import { ask } from '../../lib/confirm'
import { deleteVenue, kindLabel, listHours, listRooms, purgeVenueMedia, setAutoConfirm, setPublished, updateVenue } from '../../lib/venues'
import { useVenue } from './BusinessContext'

// Perfil público del negocio, publicación y forma de recibir reservas.
export default function BusinessProfile() {
  const venue = useVenue()
  const qc = useQueryClient()
  const { data: rooms = [] } = useQuery({ queryKey: ['venue-rooms', venue.id], queryFn: () => listRooms(venue.id) })
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', venue.id], queryFn: () => listHours(venue.id) })
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['my-venues'] }), qc.invalidateQueries({ queryKey: ['venue', venue.id] }), qc.invalidateQueries({ queryKey: ['venues'] })])

  const steps = [
    { label: 'Datos del ensayadero (nombre, ciudad, contacto)', done: !!venue.name && !!venue.city },
    { label: 'Al menos una sala con su precio', done: rooms.length > 0 },
    { label: 'Horario de atención', done: hours.length > 0 },
  ]
  const ready = steps.every((s) => s.done)

  const publish = useMutation({
    mutationFn: (v: boolean) => setPublished(venue.id, v),
    onSuccess: refresh,
    onError: () => setErr('No pudimos cambiar la publicación. Intenta de nuevo.'),
  })

  const auto = useMutation({
    mutationFn: (on: boolean) => setAutoConfirm(venue.id, on),
    onSuccess: refresh,
    onError: () => setErr('No pudimos cambiar esa opción. Intenta de nuevo.'),
  })

  async function destroy() {
    if (!(await ask({ title: `¿Borrar ${venue.name}?`, body: 'Se borran el ensayadero, sus salas, horarios, fotos y reservas. No se puede deshacer.', confirmLabel: 'Borrar el ensayadero', typeToConfirm: venue.name }))) return
    try {
      await purgeVenueMedia(venue.id).catch(() => {})
      await deleteVenue(venue.id)
      await refresh()
    } catch { setErr('No pudimos borrar el ensayadero. Intenta de nuevo.') }
  }

  return (
    <>
      <div className="section-title">Publicación</div>
      <div className="checklist">
        {steps.map((s) => (
          <div key={s.label} className={`check ${s.done ? 'done' : ''}`}>
            <span className="box" aria-hidden>{s.done ? '✓' : ''}</span>
            <span className="check-label">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {venue.isPublished
          ? <button className="btn" disabled={publish.isPending} onClick={() => publish.mutate(false)}>Dejar de publicar (ocultar el ensayadero)</button>
          : <button className="btn primary" disabled={!ready || publish.isPending} onClick={() => publish.mutate(true)}>{ready ? 'Publicar mi ensayadero' : 'Completa los pasos para publicar'}</button>}
        <p className="li-sub wrap">{venue.isPublished ? 'Tu ensayadero es visible para todas las personas con cuenta en Backline.' : 'Mientras no esté publicado, solo tú lo ves.'}</p>
        <Link to={`/ensayaderos/${venue.id}`} className="link-btn" style={{ justifySelf: 'start' }}>Ver cómo lo ven las bandas</Link>
      </div>

      <div className="section-title">Cómo reciben reservas</div>
      <label className="check-row" style={{ alignItems: 'start' }}>
        <input type="checkbox" checked={venue.autoConfirm} disabled={auto.isPending} onChange={(e) => auto.mutate(e.target.checked)} />
        <span>
          <b>Confirmar automáticamente</b><br />
          Si la franja está libre y dentro de tu horario, la reserva queda confirmada al instante y el ensayo aparece solo en la agenda de la banda. Tú no tienes que hacer nada; puedes cancelar cuando quieras.
          {!venue.autoConfirm && ' Ahora cada solicitud espera tu respuesta.'}
        </span>
      </label>

      <div className="section-title">Datos</div>
      <div className="kv">
        <span>Tipo</span><span className="readout">{kindLabel[venue.kind]}</span>
        <span>Nombre</span><span className="readout">{venue.name}</span>
        <span>Ciudad</span><span className="readout">{venue.city || '—'}</span>
        <span>WhatsApp</span><span className="readout">{venue.whatsapp || '—'}</span>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Editar datos</button>

      <VenueMedia venue={venue} canEdit />

      <div className="section-title">Zona delicada</div>
      <button className="btn danger" onClick={() => void destroy()}>Borrar mi ensayadero</button>
      {err && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{err}</p>}

      {editing && <VenueForm venue={venue} onClose={() => setEditing(false)} onSave={async (d) => { await updateVenue(venue.id, d); await refresh() }} />}
    </>
  )
}
