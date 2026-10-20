import { supabase } from './supabase'
import type { Song } from './song'

export type Band = { id: string; name: string; city: string | null; role: string }

const db = () => {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

type SongRow = {
  id: string; band_id: string; title: string; artist: string; key: string; bpm: number; minutes: number
  status: Song['status']; tunings: Song['tunings']; key_changes: Song['keyChanges']
  guest: string | null; links: Song['links']; notes: string | null
}

const fromRow = (r: SongRow): Song => ({
  id: r.id, title: r.title, artist: r.artist, key: r.key, bpm: r.bpm, minutes: r.minutes, status: r.status,
  tunings: r.tunings, keyChanges: r.key_changes, guest: r.guest ?? undefined, links: r.links, notes: r.notes ?? undefined,
})

const toRow = (bandId: string, s: Song) => ({
  id: s.id, band_id: bandId, title: s.title, artist: s.artist, key: s.key, bpm: s.bpm, minutes: s.minutes, status: s.status,
  tunings: s.tunings, key_changes: s.keyChanges, guest: s.guest ?? null, links: s.links, notes: s.notes ?? null,
  updated_at: new Date().toISOString(),
})

export async function myBands(): Promise<Band[]> {
  const { data, error } = await db().from('band_members').select('role, bands(id, name, city)')
  if (error) throw error
  return (data as unknown as { role: string; bands: { id: string; name: string; city: string | null } }[]).map((m) => ({ ...m.bands, role: m.role }))
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
