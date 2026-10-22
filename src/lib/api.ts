import { supabase } from './supabase'
import type { SetlistItem } from './setlistItems'
import type { Song } from './song'

export type BandLinks = Partial<Record<'instagram' | 'facebook' | 'youtube' | 'spotify' | 'tiktok' | 'web', string>>
export type Band = {
  id: string; name: string; city: string | null; role: string; genres: string[]; bio: string | null; links: BandLinks
  logoPath: string | null; logoUrl: string | null; isPublic: boolean
}

const BUCKET = 'band-media'
const AVATARS = 'profile-media'
export const avatarUrl = (path: string | null | undefined) => (path ? db().storage.from(AVATARS).getPublicUrl(path).data.publicUrl : null)

const db = () => {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

type SongRow = {
  id: string; band_id: string; title: string; artist: string; key: string; bpm: number; minutes: number
  status: Song['status']; tunings: Song['tunings']; key_changes: Song['keyChanges']
  guest: string | null; links: Song['links']; notes: string | null; lyrics?: string | null; instrument_notes: Record<string, string> | null
}

const fromRow = (r: SongRow): Song => ({
  id: r.id, title: r.title, artist: r.artist, key: r.key, bpm: r.bpm, minutes: r.minutes, status: r.status,
  tunings: r.tunings, keyChanges: r.key_changes, guest: r.guest ?? undefined, links: r.links, notes: r.notes ?? undefined, lyrics: r.lyrics ?? undefined,
  instrumentNotes: r.instrument_notes && Object.keys(r.instrument_notes).length ? r.instrument_notes : undefined,
})

// `lyrics` undefined = no se cargó (la lista no las trae): no se envía y la base conserva la que tiene. '' = la persona la borró.
const toRow = (bandId: string, s: Song) => ({
  id: s.id, band_id: bandId, title: s.title, artist: s.artist, key: s.key, bpm: s.bpm, minutes: s.minutes, status: s.status,
  tunings: s.tunings, key_changes: s.keyChanges, guest: s.guest ?? null, links: s.links, notes: s.notes ?? null, instrument_notes: s.instrumentNotes ?? {},
  ...(s.lyrics === undefined ? {} : { lyrics: s.lyrics.trim() ? s.lyrics : null }),
  updated_at: new Date().toISOString(),
})

const SONG_COLS = 'id, band_id, title, artist, key, bpm, minutes, status, tunings, key_changes, guest, links, notes, instrument_notes, created_at'

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
  const { data, error } = await db().from('songs').select(SONG_COLS).eq('band_id', bandId).order('created_at')
  if (error) throw error
  return (data as unknown as SongRow[]).map(fromRow)
}

/** Letras y acordes de las canciones de la banda que tienen (para el modo escenario). Aparte de la lista: pesan mucho. */
export async function listLyrics(bandId: string): Promise<Map<string, string>> {
  const { data, error } = await db().from('songs').select('id, lyrics').eq('band_id', bandId).not('lyrics', 'is', null)
  if (error) throw error
  return new Map((data as { id: string; lyrics: string }[]).map((r) => [r.id, r.lyrics]))
}

/** Letra de una sola canción (para editarla). */
export async function getLyrics(songId: string): Promise<string> {
  const { data, error } = await db().from('songs').select('lyrics').eq('id', songId).maybeSingle()
  if (error) throw error
  return (data as { lyrics: string | null } | null)?.lyrics ?? ''
}

export async function upsertSong(bandId: string, song: Song) {
  const { error } = await db().from('songs').upsert(toRow(bandId, song))
  if (error) throw error
}

export async function deleteSong(id: string) {
  const { error } = await db().from('songs').delete().eq('id', id)
  if (error) throw error
}

export type Setlist = { id: string; name: string; songIds: string[]; items?: SetlistItem[]; spotifyUrl?: string }

export async function listSetlists(bandId: string): Promise<Setlist[]> {
  const { data, error } = await db().from('setlists').select('id, name, song_ids, spotify_url, items').eq('band_id', bandId).order('created_at')
  if (error) throw error
  return (data as { id: string; name: string; song_ids: string[]; spotify_url: string | null; items: SetlistItem[] | null }[]).map((r) => ({ id: r.id, name: r.name, songIds: r.song_ids, spotifyUrl: r.spotify_url ?? undefined, items: r.items ?? undefined }))
}

export async function upsertSetlist(bandId: string, s: Setlist) {
  const { error } = await db().from('setlists').upsert({ id: s.id, band_id: bandId, name: s.name, song_ids: s.songIds, spotify_url: s.spotifyUrl ?? null, items: s.items ?? null, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function deleteSetlist(id: string) {
  const { error } = await db().from('setlists').delete().eq('id', id)
  if (error) throw error
}

export type Member = { profileId: string; name: string; role: string; instrument: string | null; instruments: string[]; avatarUrl: string | null }

export async function listMembers(bandId: string): Promise<Member[]> {
  const { data, error } = await db().from('band_members').select('profile_id, role, instrument, profiles(display_name, instruments, avatar_path)').eq('band_id', bandId).order('created_at')
  if (error) throw error
  return (data as unknown as { profile_id: string; role: string; instrument: string | null; profiles: { display_name: string; instruments: string[]; avatar_path: string | null } | null }[]).map((m) => ({
    profileId: m.profile_id, name: m.profiles?.display_name || 'Integrante', role: m.role, instrument: m.instrument, instruments: m.profiles?.instruments ?? [], avatarUrl: avatarUrl(m.profiles?.avatar_path),
  }))
}

// ───────── Anotaciones por músico (de cada canción) ─────────
export type MemberNote = { songId: string; profileId: string; note: string }

export async function listMemberNotes(bandId: string): Promise<MemberNote[]> {
  const { data, error } = await db().from('song_member_notes').select('song_id, profile_id, note').eq('band_id', bandId)
  if (error) throw error
  return (data as { song_id: string; profile_id: string; note: string }[]).map((r) => ({ songId: r.song_id, profileId: r.profile_id, note: r.note }))
}

/** Guarda la anotación propia; vacía = borrarla. (Actualiza y, si no existía, inserta: solo se puede cambiar el texto de la propia.) */
export async function saveMyNote(bandId: string, songId: string, userId: string, text: string) {
  const note = text.trim().slice(0, 500)
  if (!note) {
    const { error } = await db().from('song_member_notes').delete().eq('song_id', songId).eq('profile_id', userId)
    if (error) throw error
    return
  }
  const { data, error } = await db().from('song_member_notes').update({ note, updated_at: new Date().toISOString() }).eq('song_id', songId).eq('profile_id', userId).select('song_id')
  if (error) throw error
  if (data.length) return
  const { error: insErr } = await db().from('song_member_notes').insert({ song_id: songId, band_id: bandId, profile_id: userId, note })
  if (insErr) throw insErr
}

export type RsvpStatus = 'yes' | 'maybe' | 'no'
export type BandEvent = {
  id: string; kind: 'rehearsal' | 'gig' | 'other'; title: string; place: string; startsAt: string
  setlistId: string | null; notes: string | null; rsvps: { profileId: string; status: RsvpStatus }[]
}

export async function listEvents(bandId: string): Promise<BandEvent[]> {
  const { data, error } = await db().from('events')
    .select('id, kind, title, place, starts_at, setlist_id, notes, event_rsvps(profile_id, status)')
    .eq('band_id', bandId).gte('starts_at', new Date(Date.now() - 120 * 86_400_000).toISOString()).order('starts_at')
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

export type Profile = { displayName: string; instruments: string[]; city: string; bio: string; whatsapp: string; isPublic: boolean; avatarPath: string | null; avatarUrl: string | null }

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await db().from('profiles').select('display_name, instruments, city, bio, whatsapp, is_public, avatar_path').eq('id', userId).single()
  if (error) throw error
  return { displayName: data.display_name, instruments: data.instruments ?? [], city: data.city ?? '', bio: data.bio ?? '', whatsapp: data.whatsapp ?? '', isPublic: data.is_public, avatarPath: data.avatar_path ?? null, avatarUrl: avatarUrl(data.avatar_path) }
}

export async function updateProfile(userId: string, p: Omit<Profile, 'avatarPath' | 'avatarUrl'>) {
  const { error } = await db().from('profiles').update({
    display_name: p.displayName.trim(), instruments: p.instruments, city: p.city.trim() || null, bio: p.bio.trim() || null, whatsapp: p.whatsapp.trim() || null,
  }).eq('id', userId)
  if (error) throw error
}

/** Ruta nueva en cada subida: el enlace anterior no queda en caché. */
export async function setAvatar(userId: string, blob: Blob, ext: string, previous: string | null) {
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error: upErr } = await db().storage.from(AVATARS).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (upErr) throw upErr
  const { error } = await db().from('profiles').update({ avatar_path: path }).eq('id', userId)
  if (error) {
    await db().storage.from(AVATARS).remove([path]).catch(() => {})
    throw error
  }
  if (previous) await db().storage.from(AVATARS).remove([previous]).catch(() => {})
}

export async function clearAvatar(userId: string, previous: string | null) {
  const { error } = await db().from('profiles').update({ avatar_path: null }).eq('id', userId)
  if (error) throw error
  if (previous) await db().storage.from(AVATARS).remove([previous]).catch(() => {})
}

/** Al borrar la cuenta: quita todo lo que haya en su carpeta de fotos. */
export async function purgeAvatars(userId: string) {
  const store = db().storage.from(AVATARS)
  const { data } = await store.list(userId, { limit: 100 })
  const paths = (data ?? []).filter((f) => f.id).map((f) => `${userId}/${f.name}`)
  if (paths.length) await store.remove(paths)
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
/** Para cuentas anteriores al registro de edad: la persona declara una vez que es mayor de edad. */
export async function confirmAdult() {
  const { error } = await db().rpc('confirm_adult')
  if (error) throw error
}

export async function setProfilePublic(isPublic: boolean) {
  const { error } = await db().rpc('set_profile_public', { p_public: isPublic })
  if (error) throw error
}
