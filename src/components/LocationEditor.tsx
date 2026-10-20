import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { currentPosition, geocodeAddress, mapLinks, osmEmbedUrl, parseCoords, type Coords } from '../lib/geo'
import { setLocation, type Venue } from '../lib/venues'

/** Ubicación del negocio en el mapa: la ubicación actual del celular, la dirección o unas coordenadas/enlace de Google Maps. */
export default function LocationEditor({ venue }: { venue: Venue }) {
  const qc = useQueryClient()
  const saved: Coords | null = venue.lat != null && venue.lng != null ? { lat: venue.lat, lng: venue.lng } : null
  const [draft, setDraft] = useState<Coords | null>(null)
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState<'gps' | 'address' | 'save' | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const shown = draft ?? saved

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['my-venues'] }), qc.invalidateQueries({ queryKey: ['venue', venue.id] })])

  async function locateMe() {
    setBusy('gps'); setMsg(null)
    try { setDraft(await currentPosition()); setMsg({ kind: 'ok', text: 'Tomamos tu ubicación actual. Si estás en el ensayadero, está bien; si no, ajústala con la dirección.' }) } catch (e) {
      const m = (e as Error).message
      setMsg({ kind: 'error', text: m === 'permiso-denegado' ? 'Bloqueaste el permiso de ubicación. Actívalo en los ajustes del sitio, o usa la dirección.' : 'No pudimos obtener tu ubicación. Prueba con la dirección.' })
    }
    setBusy(null)
  }

  async function byAddress() {
    if (!venue.address.trim()) return setMsg({ kind: 'error', text: 'Primero escribe la dirección en «Editar datos».' })
    setBusy('address'); setMsg(null)
    try {
      const c = await geocodeAddress(venue.address, venue.city)
      if (c) { setDraft(c); setMsg({ kind: 'ok', text: 'Encontramos la dirección. Revisa el mapa y guarda si el punto es el correcto.' }) }
      else setMsg({ kind: 'error', text: 'No encontramos esa dirección. Prueba con tu ubicación actual o pega un enlace de Google Maps.' })
    } catch { setMsg({ kind: 'error', text: 'El buscador de direcciones no respondió. Intenta de nuevo o pega un enlace de Google Maps.' }) }
    setBusy(null)
  }

  function fromPaste() {
    const c = parseCoords(paste)
    if (!c) return setMsg({ kind: 'error', text: 'No entendimos eso. Pega unas coordenadas (7.119, -73.122) o el enlace del lugar en Google Maps.' })
    setDraft(c); setPaste(''); setMsg({ kind: 'ok', text: 'Listo. Revisa el mapa y guarda.' })
  }

  async function save(c: Coords | null) {
    setBusy('save'); setMsg(null)
    try { await setLocation(venue.id, c?.lat ?? null, c?.lng ?? null); await refresh(); setDraft(null); setMsg({ kind: 'ok', text: c ? 'Ubicación guardada.' : 'Ubicación quitada.' }) } catch { setMsg({ kind: 'error', text: 'No pudimos guardar la ubicación. Intenta de nuevo.' }) }
    setBusy(null)
  }

  return (
    <>
      <div className="section-title">Ubicación en el mapa</div>
      <p className="li-sub wrap">Las bandas ven dónde estás y tocan «Cómo llegar». {venue.address ? `Dirección: ${venue.address}.` : 'Escribe la dirección en «Editar datos».'}</p>
      {shown && (
        <div className="player" style={{ marginTop: 10 }}>
          <iframe title="Vista previa del mapa" src={osmEmbedUrl(shown)} height={220} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
          <a className="player-link" href={mapLinks(shown, venue.name).osm} target="_blank" rel="noopener noreferrer">{shown.lat}, {shown.lng} · abrir en OpenStreetMap</a>
        </div>
      )}
      <div className="stack" style={{ marginTop: 10 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy !== null} onClick={() => void locateMe()}>{busy === 'gps' ? 'Buscando…' : 'Usar mi ubicación actual'}</button>
          <button className="btn" disabled={busy !== null} onClick={() => void byAddress()}>{busy === 'address' ? 'Buscando…' : 'Buscar por la dirección'}</button>
        </div>
        <div className="grid-row">
          <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Pega coordenadas o un enlace de Google Maps" aria-label="Coordenadas o enlace de Google Maps" autoCapitalize="none" spellCheck={false} />
          <button className="btn" onClick={fromPaste} disabled={!paste.trim()}>Usar</button>
        </div>
        {draft && <button className="btn primary" disabled={busy !== null} onClick={() => void save(draft)}>{busy === 'save' ? 'Guardando…' : 'Guardar esta ubicación'}</button>}
        {saved && !draft && <button className="btn ghost danger" disabled={busy !== null} onClick={() => void save(null)}>Quitar la ubicación</button>}
        {msg && <p className={msg.kind === 'ok' ? 'form-ok' : 'form-error'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
        <p className="li-sub wrap">Al buscar la dirección usamos OpenStreetMap (Nominatim) y el mapa lo muestra OpenStreetMap: reciben esa consulta, no tus datos personales. Tu ubicación actual solo se usa cuando pulsas el botón.</p>
      </div>
    </>
  )
}
