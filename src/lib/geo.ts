export type Coords = { lat: number; lng: number }

const valid = (lat: number, lng: number): Coords | undefined =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) ? { lat, lng } : undefined

const round = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Lee coordenadas de lo que pegue el dueño: "7.119349, -73.122742", un enlace de Google Maps
 * (…/@7.1193,-73.1227,17z, …?q=7.1193,-73.1227 o …!3d7.1193!4d-73.1227) o uno de OpenStreetMap (#map=17/7.1193/-73.1227).
 */
export function parseCoords(raw: string): Coords | undefined {
  const text = decodeURIComponent(raw.trim().replace(/\+/g, ' '))
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|mlat)=(-?\d+(?:\.\d+)?)[,&]\s*(?:mlon=)?(-?\d+(?:\.\d+)?)/,
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
    /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const c = valid(Number(m[1]), Number(m[2]))
      if (c) return { lat: round(c.lat), lng: round(c.lng) }
    }
  }
  return undefined
}

export function mapLinks({ lat, lng }: Coords, name: string) {
  const q = `${lat},${lng}`
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?ll=${q}&navigate=yes`,
    osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
    label: name,
  }
}

/** Mapa de OpenStreetMap para incrustar (con un marcador). */
export function osmEmbedUrl({ lat, lng }: Coords): string {
  const d = 0.004
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(6)).join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`
}

/** Distancia en km entre dos puntos (fórmula de haversine). */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Ubicación actual del dispositivo (pide permiso al usuario, solo al pulsar el botón). */
export function currentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('sin-geolocalizacion'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: round(p.coords.latitude), lng: round(p.coords.longitude) }),
      (e) => reject(new Error(e.code === 1 ? 'permiso-denegado' : 'no-disponible')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  })
}

/** Busca una dirección en Nominatim (OpenStreetMap), solo en Colombia. Se llama únicamente cuando el dueño lo pide. */
export async function geocodeAddress(address: string, city: string): Promise<Coords | undefined> {
  const q = [address, city, 'Colombia'].filter(Boolean).join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=co&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('geocodificador')
  const rows = (await res.json()) as { lat: string; lon: string }[]
  return rows[0] ? valid(Number(rows[0].lat), Number(rows[0].lon)) : undefined
}
