import { supabase } from './supabase'
import type { BandLinks } from './api'
import type { Busy } from './slots'

const db = () => {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}
const BUCKET = 'venue-media'
const publicUrl = (path: string) => db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl

export type VenueKind = 'rehearsal_room' | 'studio' | 'venue'
export const kindLabel: Record<VenueKind, string> = { rehearsal_room: 'Sala de ensayo', studio: 'Estudio', venue: 'Lugar de toques' }

export type Venue = {
  id: string; ownerId: string; kind: VenueKind; name: string; city: string; address: string; description: string
  amenities: string[]; whatsapp: string; links: BandLinks; bookingUrl: string
  logoPath: string | null; logoUrl: string | null; isPublished: boolean; autoConfirm: boolean
}
export type Room = { id: string; venueId: string; name: string; capacity: number; pricePerHour: number; description: string }
export type Hours = { weekday: number; opens: string; closes: string }
export type VenuePhoto = { id: string; path: string; url: string }
export type BookingStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled'
export type Booking = {
  id: string; venueId: string; roomId: string; bandId: string | null; status: BookingStatus
  startsAt: string; endsAt: string; note: string; responseNote: string
  contactName: string; contactPhone: string; source: 'app' | 'owner'
  venueName: string; venueCity: string; roomName: string
}

type VenueRow = {
  id: string; owner_id: string; kind: VenueKind; name: string; city: string; address: string; description: string | null
  amenities: string[]; whatsapp: string | null; links: BandLinks; booking_url: string | null; logo_path: string | null; is_published: boolean; auto_confirm: boolean
}
const toVenue = (r: VenueRow): Venue => ({
  id: r.id, ownerId: r.owner_id, kind: r.kind, name: r.name, city: r.city, address: r.address, description: r.description ?? '',
  amenities: r.amenities, whatsapp: r.whatsapp ?? '', links: r.links, bookingUrl: r.booking_url ?? '',
  logoPath: r.logo_path, logoUrl: r.logo_path ? publicUrl(r.logo_path) : null, isPublished: r.is_published, autoConfirm: r.auto_confirm,
})
const VENUE_COLS = 'id, owner_id, kind, name, city, address, description, amenities, whatsapp, links, booking_url, logo_path, is_published, auto_confirm'

export async function listVenues(): Promise<Venue[]> {
  const { data, error } = await db().from('venues').select(VENUE_COLS).eq('is_published', true).order('name')
  if (error) throw error
  return (data as VenueRow[]).map(toVenue)
}

export async function myVenues(userId: string): Promise<Venue[]> {
  const { data, error } = await db().from('venues').select(VENUE_COLS).eq('owner_id', userId).order('created_at')
  if (error) throw error
  return (data as VenueRow[]).map(toVenue)
}

export async function getVenue(id: string): Promise<Venue | null> {
  const { data, error } = await db().from('venues').select(VENUE_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toVenue(data as VenueRow) : null
}

export type VenueDraft = { kind: VenueKind; name: string; city: string; address: string; description: string; amenities: string[]; whatsapp: string; links: BandLinks; bookingUrl: string }
const toPayload = (d: VenueDraft) => ({
  kind: d.kind, name: d.name.trim(), city: d.city.trim(), address: d.address.trim(), description: d.description.trim() || null,
  amenities: d.amenities, whatsapp: d.whatsapp.trim() || null, links: d.links, booking_url: d.bookingUrl.trim() || null,
})

export async function createVenue(d: VenueDraft): Promise<string> {
  const { data, error } = await db().from('venues').insert(toPayload(d)).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateVenue(id: string, d: VenueDraft) {
  const { error } = await db().from('venues').update(toPayload(d)).eq('id', id)
  if (error) throw error
}

export async function setPublished(id: string, published: boolean) {
  const { error } = await db().from('venues').update({ is_published: published }).eq('id', id)
  if (error) throw error
}

export async function setAutoConfirm(id: string, on: boolean) {
  const { error } = await db().from('venues').update({ auto_confirm: on }).eq('id', id)
  if (error) throw error
}

export async function deleteVenue(id: string) {
  const { error } = await db().from('venues').delete().eq('id', id)
  if (error) throw error
}

// ───────── Salitas y horarios ─────────
export async function listRooms(venueId: string): Promise<Room[]> {
  const { data, error } = await db().from('venue_rooms').select('id, venue_id, name, capacity, price_per_hour, description').eq('venue_id', venueId).order('created_at')
  if (error) throw error
  return (data as { id: string; venue_id: string; name: string; capacity: number; price_per_hour: number; description: string | null }[]).map((r) => ({
    id: r.id, venueId: r.venue_id, name: r.name, capacity: r.capacity, pricePerHour: r.price_per_hour, description: r.description ?? '',
  }))
}

export async function saveRoom(venueId: string, r: Omit<Room, 'venueId'>) {
  const { error } = await db().from('venue_rooms').upsert({
    id: r.id, venue_id: venueId, name: r.name.trim(), capacity: r.capacity, price_per_hour: r.pricePerHour, description: r.description.trim() || null,
  })
  if (error) throw error
}

export async function deleteRoom(id: string) {
  const { error } = await db().from('venue_rooms').delete().eq('id', id)
  if (error) throw error
}

export async function listHours(venueId: string): Promise<Hours[]> {
  const { data, error } = await db().from('venue_hours').select('weekday, opens, closes').eq('venue_id', venueId)
  if (error) throw error
  return data as Hours[]
}

/** Reemplaza el horario semanal completo. */
export async function saveHours(venueId: string, rows: Hours[]) {
  const del = await db().from('venue_hours').delete().eq('venue_id', venueId)
  if (del.error) throw del.error
  if (!rows.length) return
  const { error } = await db().from('venue_hours').insert(rows.map((h) => ({ venue_id: venueId, weekday: h.weekday, opens: h.opens, closes: h.closes })))
  if (error) throw error
}

// ───────── Fotos y logo ─────────
async function upload(path: string, blob: Blob) {
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
}
const removeFiles = async (paths: string[]) => {
  if (!paths.length) return
  const { error } = await db().storage.from(BUCKET).remove(paths)
  if (error) throw error
}

export async function listVenuePhotos(venueId: string): Promise<VenuePhoto[]> {
  const { data, error } = await db().from('venue_photos').select('id, path').eq('venue_id', venueId).order('created_at', { ascending: false })
  if (error) throw error
  return (data as { id: string; path: string }[]).map((p) => ({ ...p, url: publicUrl(p.path) }))
}

export async function addVenuePhoto(venueId: string, blob: Blob, ext: string) {
  const path = `${venueId}/photos/${crypto.randomUUID()}.${ext}`
  await upload(path, blob)
  const { error } = await db().from('venue_photos').insert({ venue_id: venueId, path })
  if (error) {
    await removeFiles([path]).catch(() => {})
    throw error
  }
}

export async function deleteVenuePhoto(p: VenuePhoto) {
  const { error } = await db().from('venue_photos').delete().eq('id', p.id)
  if (error) throw error
  await removeFiles([p.path]).catch(() => {})
}

export async function setVenueLogo(venueId: string, blob: Blob, ext: string, previous: string | null) {
  const path = `${venueId}/logo-${Date.now()}.${ext}`
  await upload(path, blob)
  const { error } = await db().from('venues').update({ logo_path: path }).eq('id', venueId)
  if (error) {
    await removeFiles([path]).catch(() => {})
    throw error
  }
  if (previous) await removeFiles([previous]).catch(() => {})
}

export async function clearVenueLogo(venueId: string, previous: string | null) {
  const { error } = await db().from('venues').update({ logo_path: null }).eq('id', venueId)
  if (error) throw error
  if (previous) await removeFiles([previous]).catch(() => {})
}

export async function purgeVenueMedia(venueId: string) {
  const store = db().storage.from(BUCKET)
  const [root, photos] = await Promise.all([store.list(venueId, { limit: 100 }), store.list(`${venueId}/photos`, { limit: 100 })])
  await removeFiles([
    ...(root.data ?? []).filter((f) => f.id).map((f) => `${venueId}/${f.name}`),
    ...(photos.data ?? []).filter((f) => f.id).map((f) => `${venueId}/photos/${f.name}`),
  ])
}

// ───────── Reservas ─────────
export async function roomBusy(roomId: string, from: Date, to: Date): Promise<Busy[]> {
  const { data, error } = await db().rpc('room_busy', { p_room: roomId, p_from: from.toISOString(), p_to: to.toISOString() })
  if (error) throw error
  return data as Busy[]
}

export async function requestBooking(v: { roomId: string; start: Date; end: Date; bandId: string | null; note: string; phone: string }): Promise<string> {
  const { data, error } = await db().rpc('request_booking', {
    p_room: v.roomId, p_start: v.start.toISOString(), p_end: v.end.toISOString(), p_band: v.bandId, p_note: v.note || null, p_phone: v.phone || null,
  })
  if (error) throw error
  return data as string
}

export async function respondBooking(id: string, status: 'confirmed' | 'rejected', note: string) {
  const { error } = await db().rpc('respond_booking', { p_id: id, p_status: status, p_note: note || null })
  if (error) throw error
}

/** El dueño registra una reserva que le llegó por WhatsApp o llamada: queda confirmada y la franja se bloquea. */
export async function ownerBooking(v: { roomId: string; start: Date; end: Date; label: string; phone: string; note: string }): Promise<string> {
  const { data, error } = await db().rpc('owner_booking', {
    p_room: v.roomId, p_start: v.start.toISOString(), p_end: v.end.toISOString(), p_label: v.label, p_phone: v.phone || null, p_note: v.note || null,
  })
  if (error) throw error
  return data as string
}

export async function cancelBooking(id: string) {
  const { error } = await db().rpc('cancel_booking', { p_id: id })
  if (error) throw error
}

type BookingRow = {
  id: string; venue_id: string; room_id: string; band_id: string | null; status: BookingStatus; starts_at: string; ends_at: string
  note: string | null; response_note: string | null; contact_name: string; contact_phone: string | null; source: 'app' | 'owner'
}
const BOOKING_COLS = 'id, venue_id, room_id, band_id, status, starts_at, ends_at, note, response_note, contact_name, contact_phone, source'

async function hydrate(rows: BookingRow[]): Promise<Booking[]> {
  if (!rows.length) return []
  const venueIds = [...new Set(rows.map((r) => r.venue_id))]
  const roomIds = [...new Set(rows.map((r) => r.room_id))]
  const [v, r] = await Promise.all([
    db().from('venues').select('id, name, city').in('id', venueIds),
    db().from('venue_rooms').select('id, name').in('id', roomIds),
  ])
  const venues = new Map((v.data ?? []).map((x: { id: string; name: string; city: string }) => [x.id, x]))
  const rooms = new Map((r.data ?? []).map((x: { id: string; name: string }) => [x.id, x.name]))
  return rows.map((b) => ({
    id: b.id, venueId: b.venue_id, roomId: b.room_id, bandId: b.band_id, status: b.status, startsAt: b.starts_at, endsAt: b.ends_at,
    note: b.note ?? '', responseNote: b.response_note ?? '', contactName: b.contact_name, contactPhone: b.contact_phone ?? '', source: b.source,
    venueName: venues.get(b.venue_id)?.name ?? 'Sala', venueCity: venues.get(b.venue_id)?.city ?? '', roomName: rooms.get(b.room_id) ?? '',
  }))
}

/** Las que pedí yo o mis bandas (RLS decide), de las más próximas a las más lejanas. */
export async function myBookings(): Promise<Booking[]> {
  const { data, error } = await db().from('bookings').select(BOOKING_COLS).order('starts_at', { ascending: false }).limit(60)
  if (error) throw error
  return hydrate(data as BookingRow[])
}

export async function venueBookings(venueId: string): Promise<Booking[]> {
  const { data, error } = await db().from('bookings').select(BOOKING_COLS).eq('venue_id', venueId).order('starts_at', { ascending: true }).limit(200)
  if (error) throw error
  return hydrate(data as BookingRow[])
}

/** Mensaje claro para los errores que lanza la base. */
export function bookingError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e)
  if (/ocupada|bookings_sin_solape|conflicting key/i.test(m)) return 'Esa franja ya está ocupada. Elige otra.'
  if (/anticipación/i.test(m)) return 'Esa franja empieza muy pronto: pide con al menos una hora de anticipación.'
  if (/cerrada|fuera del horario/i.test(m)) return 'La sala no atiende en ese horario.'
  if (/demasiadas solicitudes/i.test(m)) return 'Tienes muchas solicitudes pendientes. Espera a que respondan alguna.'
  if (/falta el nombre/i.test(m)) return 'Escribe el nombre de quien reservó.'
  if (/ya pasó|muy lejos/i.test(m)) return 'Esa fecha no es válida.'
  if (/duración/i.test(m)) return 'La duración debe estar entre 30 minutos y 12 horas.'
  if (/propia sala/i.test(m)) return 'No puedes reservar tu propia sala desde aquí.'
  if (/no está pendiente|ya no se puede/i.test(m)) return 'Esa reserva ya cambió. Recarga para ver su estado.'
  if (/no disponible/i.test(m)) return 'Esa sala ya no está disponible.'
  return 'No pudimos completar la reserva. Intenta de nuevo.'
}

/** Precio más bajo por hora de cada sala (para mostrar "desde $X"). */
export async function minPrices(venueIds: string[]): Promise<Record<string, number>> {
  if (!venueIds.length) return {}
  const { data, error } = await db().from('venue_rooms').select('venue_id, price_per_hour').in('venue_id', venueIds)
  if (error) throw error
  const out: Record<string, number> = {}
  for (const r of data as { venue_id: string; price_per_hour: number }[]) {
    if (r.price_per_hour > 0) out[r.venue_id] = Math.min(out[r.venue_id] ?? Infinity, r.price_per_hour)
  }
  return out
}
