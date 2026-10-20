import { supabase } from './supabase'
import type { Song } from './song'

export type BandLinks = Partial<Record<'instagram' | 'facebook' | 'youtube' | 'spotify' | 'tiktok' | 'web', string>>
export type Band = {
  id: string; name: string; city: string | null; role: string; genres: string[]; bio: string | null; links: BandLinks
  logoPath: string | null; logoUrl: string | null; isPublic: boolean
}

const BUCKET = 'band-media'

const db = () => {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

type SongRow = {
  id: string; band_id: string; title: string; artist: string; key: string; bpm: number; minutes: number
  status: Song['status']; tunings: Song['tunings']; key_changes: Song['keyChanges']
  guest: string | null; links: Song['links']; notes: string | null; lyrics: string | null
}

const fromRow = (r: SongRow): Song => ({
  id: r.id, title: r.title, artist: r.artist, key: r.key, bpm: r.bpm, minutes: r.minutes, status: r.status,
  tunings: r.tunings, keyChanges: r.key_changes, guest: r.guest ?? undefined, links: r.links, notes: r.notes ?? undefined, lyrics: r.lyrics ?? undefined,
})

const toRow = (bandId: string, s: Song) => ({
  id: s.id, band_id: bandId, title: s.title, artist: s.artist, key: s.key, bpm: s.bpm, minutes: s.minutes, status: s.status,
  tunings: s.tunings, key_changes: s.keyChanges, guest: s.guest ?? null, links: s.links, notes: s.notes ?? null, lyrics: s.lyrics ?? null,
  updated_at: new Date().toISOString(),
})

const publicUrl = (path: string) => db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl

export async function myBands(userId: string): Promise<Band[]> {
  const { data, error } = await db().from('band_members').select('role, bands(id, name, city, genres, bio, links, logo_path, is_public)').eq('profile_id', userId)
  if (error) throw error
  type Row = { role: string; bands: { id: string; name: string; city: string | null; genres: string[]; bio: string | null; links: BandLinks; logo_path: string | null; is_public: boolean } }
  return (data as unknown as Row[]).map(({ role, bands: b }) => ({
    id: b.id, name: b.name, city: b.city, role, genres: b.genres, bio: b.bio, links: b.links,
    logoPath: b.logo_path, logoUrl: b.logo_path ? publicUrl(b.logo_path) : null, isPublic: b.is_public,
  }))
}

export async function createBand(name: string, city: string) {
  const { data, error } = await db().rpc('create_band', { p_name: name.trim(), p_city: city.trim() || null })
  if (error) throw error
  return data as string
}

export async function joinBand(code: string) {
  const { data, error } = await db().rpc('join_band', { p_code: code.trim().toLowerCase() })
  if (error) throw error
  return data as string
}

export async function createInvite(bandId: string, userId: string) {
  const { data, error } = await db().from('band_invites').insert({ band_id: bandId, created_by: userId }).select('code').single()
  if (error) throw error
  return data.code as string
}

export async function listSongs(bandId: string): Promise<Song[]> {
  const { data, error } = await db().from('songs').select('*').eq('band_id', bandId).order('created_at')
  if (error) throw error
  return (data as SongRow[]).map(fromRow)
}

export async function upsertSong(bandId: string, song: Song) {
  const { error } = await db().from('songs').upsert(toRow(bandId, song))
  if (error) throw error
}

export async function deleteSong(id: string) {
  const { error } = await db().from('songs').delete().eq('id', id)
  if (error) throw error
}

export type Setlist = { id: string; name: string; songIds: string[] }

export async function listSetlists(bandId: string): Promise<Setlist[]> {
  const { data, error } = await db().from('setlists').select('id, name, song_ids').eq('band_id', bandId).order('created_at')
  if (error) throw error
  return (data as { id: string; name: string; song_ids: string[] }[]).map((r) => ({ id: r.id, name: r.name, songIds: r.song_ids }))
}

export async function upsertSetlist(bandId: string, s: Setlist) {
  const { error } = await db().from('setlists').upsert({ id: s.id, band_id: bandId, name: s.name, song_ids: s.songIds, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function deleteSetlist(id: string) {
  const { error } = await db().from('setlists').delete().eq('id', id)
  if (error) throw error
}

export type Member = { profileId: string; name: string; role: string; instrument: string | null; instruments: string[] }

export async function listMembers(bandId: string): Promise<Member[]> {
  const { data, error } = await db().from('band_members').select('profile_id, role, instrument, profiles(display_name, instruments)').eq('band_id', bandId).order('created_at')
  if (error) throw error
  return (data as unknown as { profile_id: string; role: string; instrument: string | null; profiles: { display_name: string; instruments: string[] } | null }[]).map((m) => ({
    profileId: m.profile_id, name: m.profiles?.display_name || 'Integrante', role: m.role, instrument: m.instrument, instruments: m.profiles?.instruments ?? [],
  }))
}

export type RsvpStatus = 'yes' | 'maybe' | 'no'
export type BandEvent = {
  id: string; kind: 'rehearsal' | 'gig' | 'other'; title: string; place: string; startsAt: string
  setlistId: string | null; notes: string | null; rsvps: { profileId: string; status: RsvpStatus }[]
}

export async function listEvents(bandId: string): Promise<BandEvent[]> {
  const { data, error } = await db().from('events')
    .select('id, kind, title, place, starts_at, setlist_id, notes, event_rsvps(profile_id, status)')
    .eq('band_id', bandId).order('starts_at')
  if (error) throw error
  type Row = { id: string; kind: BandEvent['kind']; title: string; place: string; starts_at: string; setlist_id: string | null; notes: string | null; event_rsvps: { profile_id: string; status: RsvpStatus }[] }
  return (data as unknown as Row[]).map((r) => ({
    id: r.id, kind: r.kind, title: r.title, place: r.place, startsAt: r.starts_at, setlistId: r.setlist_id, notes: r.notes,
    rsvps: r.event_rsvps.map((x) => ({ profileId: x.profile_id, status: x.status })),
  }))
}

export async function upsertEvent(bandId: string, e: Omit<BandEvent, 'rsvps'>) {
  const { error } = await db().from('events').upsert({
    id: e.id, band_id: bandId, kind: e.kind, title: e.title, place: e.place, starts_at: e.startsAt, setlist_id: e.setlistId, notes: e.notes,
  })
  if (error) throw error
}

export async function deleteEvent(id: string) {
  const { error } = await db().from('events').delete().eq('id', id)
  if (error) throw error
}

export async function setRsvp(eventId: string, userId: string, status: RsvpStatus) {
  const { error } = await db().from('event_rsvps').upsert({ event_id: eventId, profile_id: userId, status, updated_at: new Date().toISOString() })
  if (error) throw error
}

export type Profile = { displayName: string; instruments: string[]; city: string; bio: string; whatsapp: string; isPublic: boolean }

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await db().from('profiles').select('display_name, instruments, city, bio, whatsapp, is_public').eq('id', userId).single()
  if (error) throw error
  return { displayName: data.display_name, instruments: data.instruments ?? [], city: data.city ?? '', bio: data.bio ?? '', whatsapp: data.whatsapp ?? '', isPublic: data.is_public }
}

export async function updateProfile(userId: string, p: Profile) {
  const { error } = await db().from('profiles').update({
    display_name: p.displayName.trim(), instruments: p.instruments, city: p.city.trim() || null, bio: p.bio.trim() || null, whatsapp: p.whatsapp.trim() || null,
  }).eq('id', userId)
  if (error) throw error
}

export async function updateBand(id: string, b: { name: string; city: string; genres: string[]; bio: string; links: BandLinks }) {
  const { error } = await db().from('bands').update({ name: b.name.trim(), city: b.city.trim() || null, genres: b.genres, bio: b.bio.trim() || null, links: b.links }).eq('id', id)
  if (error) throw error
}

export async function setMemberRole(bandId: string, profileId: string, role: 'admin' | 'member' | 'guest') {
  const { error } = await db().from('band_members').update({ role }).eq('band_id', bandId).eq('profile_id', profileId)
  if (error) throw error
}

export async function setMemberInstrument(bandId: string, profileId: string, instrument: string) {
  const { error } = await db().from('band_members').update({ instrument: instrument.trim() || null }).eq('band_id', bandId).eq('profile_id', profileId)
  if (error) throw error
}

export async function removeMember(bandId: string, profileId: string) {
  const { error } = await db().from('band_members').delete().eq('band_id', bandId).eq('profile_id', profileId)
  if (error) throw error
}

export async function transferOwnership(bandId: string, toProfileId: string) {
  const { error } = await db().rpc('transfer_ownership', { p_band: bandId, p_to: toProfileId })
  if (error) throw error
}

export async function deleteBand(id: string) {
  const { error } = await db().from('bands').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAccount() {
  const { error } = await db().rpc('delete_account')
  if (error) throw error
}

export async function setMyInstrument(bandId: string, instrument: string) {
  const { error } = await db().rpc('set_my_instrument', { p_band: bandId, p_instrument: instrument })
  if (error) throw error
}

// ───────── Logo y fotos de la banda (Storage) ─────────
export type BandPhoto = { id: string; path: string; url: string }

async function upload(path: string, blob: Blob) {
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
}

const removeFiles = async (paths: string[]) => {
  if (!paths.length) return
  const { error } = await db().storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/** Ruta nueva en cada subida: el enlace anterior no queda en caché y no hace falta invalidar nada. */
export async function setBandLogo(bandId: string, blob: Blob, ext: string, previous: string | null) {
  const path = `${bandId}/logo-${Date.now()}.${ext}`
  await upload(path, blob)
  const { error } = await db().from('bands').update({ logo_path: path }).eq('id', bandId)
  if (error) {
    await removeFiles([path]).catch(() => {})
    throw error
  }
  if (previous) await removeFiles([previous]).catch(() => {})
}

export async function clearBandLogo(bandId: string, previous: string | null) {
  const { error } = await db().from('bands').update({ logo_path: null }).eq('id', bandId)
  if (error) throw error
  if (previous) await removeFiles([previous]).catch(() => {})
}

export async function listPhotos(bandId: string): Promise<BandPhoto[]> {
  const { data, error } = await db().from('band_photos').select('id, path').eq('band_id', bandId).order('created_at', { ascending: false })
  if (error) throw error
  return (data as { id: string; path: string }[]).map((p) => ({ ...p, url: publicUrl(p.path) }))
}

export async function addPhoto(bandId: string, blob: Blob, ext: string) {
  const path = `${bandId}/photos/${crypto.randomUUID()}.${ext}`
  await upload(path, blob)
  const { error } = await db().from('band_photos').insert({ band_id: bandId, path })
  if (error) {
    await removeFiles([path]).catch(() => {})
    throw error
  }
}

export async function deletePhoto(photo: BandPhoto) {
  const { error } = await db().from('band_photos').delete().eq('id', photo.id)
  if (error) throw error
  await removeFiles([photo.path]).catch(() => {})
}

/** Borra todos los archivos de una banda (antes de borrar la banda o la cuenta de su único integrante). */
export async function purgeBandMedia(bandId: string) {
  const store = db().storage.from(BUCKET)
  const [root, photos] = await Promise.all([store.list(bandId, { limit: 100 }), store.list(`${bandId}/photos`, { limit: 100 })])
  const paths = [
    ...(root.data ?? []).filter((f) => f.id).map((f) => `${bandId}/${f.name}`),
    ...(photos.data ?? []).filter((f) => f.id).map((f) => `${bandId}/photos/${f.name}`),
  ]
  await removeFiles(paths)
}

// ───────── Visibilidad (perfil público opcional) ─────────
export async function setBandPublic(bandId: string, isPublic: boolean) {
  const { error } = await db().from('bands').update({ is_public: isPublic }).eq('id', bandId)
  if (error) throw error
}

/** Solo las personas mayores de edad pueden activarlo (lo exige la base de datos). */
export async function setProfilePublic(isPublic: boolean) {
  const { error } = await db().rpc('set_profile_public', { p_public: isPublic })
  if (error) throw error
}
