import { supabase } from './supabase'
import type { BandLinks } from './api'

const db = () => {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}
const avatar = (path: string | null | undefined) => (path ? db().storage.from('profile-media').getPublicUrl(path).data.publicUrl : null)
const logoUrl = (path: string | null) => (path ? db().storage.from('band-media').getPublicUrl(path).data.publicUrl : null)
export const PAGE = 20

export type PublicBand = { id: string; name: string; city: string; genres: string[]; bio: string; links: BandLinks; logoUrl: string | null }
export type PublicMusician = { id: string; name: string; instruments: string[]; city: string; bio: string; whatsapp: string; avatarUrl: string | null }
export type PublicMember = { profileId: string; name: string; instrument: string; instruments: string[]; role: string; avatarUrl: string | null }
export type MusicianBand = { bandId: string; name: string; city: string; genres: string[]; logoUrl: string | null; instrument: string }

type BandRow = { id: string; name: string; city: string | null; genres: string[]; bio: string | null; links: BandLinks; logo_path: string | null }
const toBand = (r: BandRow): PublicBand => ({ id: r.id, name: r.name, city: r.city ?? '', genres: r.genres, bio: r.bio ?? '', links: r.links, logoUrl: logoUrl(r.logo_path) })
const BAND_COLS = 'id, name, city, genres, bio, links, logo_path'

// Los comodines de ilike no deben llegar desde lo que escribe la persona.
const like = (s: string) => `%${s.trim().replace(/[%_,()]/g, ' ')}%`

export async function exploreBands(f: { q: string; city: string; genre: string; offset: number }): Promise<PublicBand[]> {
  let query = db().from('bands').select(BAND_COLS).eq('is_public', true).order('name').range(f.offset, f.offset + PAGE - 1)
  if (f.q.trim()) query = query.ilike('name', like(f.q))
  if (f.city.trim()) query = query.ilike('city', like(f.city))
  if (f.genre) query = query.contains('genres', [f.genre])
  const { data, error } = await query
  if (error) throw error
  return (data as BandRow[]).map(toBand)
}

export async function getPublicBand(id: string): Promise<PublicBand | null> {
  const { data, error } = await db().from('bands').select(BAND_COLS).eq('id', id).eq('is_public', true).maybeSingle()
  if (error) throw error
  return data ? toBand(data as BandRow) : null
}

export async function bandMembers(bandId: string): Promise<PublicMember[]> {
  const { data, error } = await db().rpc('band_public_members', { p_band: bandId })
  if (error) throw error
  return (data as { profile_id: string; display_name: string; instrument: string | null; instruments: string[]; role: string; avatar_path: string | null }[]).map((m) => ({
    profileId: m.profile_id, name: m.display_name, instrument: m.instrument ?? '', instruments: m.instruments ?? [], role: m.role, avatarUrl: avatar(m.avatar_path),
  }))
}

export async function bandMemberCount(bandId: string): Promise<number> {
  const { data, error } = await db().rpc('band_member_count', { p_band: bandId })
  if (error) throw error
  return data as number
}

type MusicianRow = { id: string; display_name: string; instruments: string[]; city: string | null; bio: string | null; whatsapp: string | null; avatar_path: string | null }
const toMusician = (r: MusicianRow): PublicMusician => ({ id: r.id, name: r.display_name, instruments: r.instruments ?? [], city: r.city ?? '', bio: r.bio ?? '', whatsapp: r.whatsapp ?? '', avatarUrl: avatar(r.avatar_path) })
const MUSICIAN_COLS = 'id, display_name, instruments, city, bio, whatsapp, avatar_path'

export async function exploreMusicians(f: { q: string; city: string; instrument: string; offset: number }): Promise<PublicMusician[]> {
  let query = db().from('profiles').select(MUSICIAN_COLS).eq('is_public', true).order('display_name').range(f.offset, f.offset + PAGE - 1)
  if (f.q.trim()) query = query.ilike('display_name', like(f.q))
  if (f.city.trim()) query = query.ilike('city', like(f.city))
  if (f.instrument) query = query.contains('instruments', [f.instrument])
  const { data, error } = await query
  if (error) throw error
  return (data as MusicianRow[]).map(toMusician)
}

export async function getPublicMusician(id: string): Promise<PublicMusician | null> {
  const { data, error } = await db().from('profiles').select(MUSICIAN_COLS).eq('id', id).eq('is_public', true).maybeSingle()
  if (error) throw error
  return data ? toMusician(data as MusicianRow) : null
}

export async function musicianBands(profileId: string): Promise<MusicianBand[]> {
  const { data, error } = await db().rpc('profile_public_bands', { p_profile: profileId })
  if (error) throw error
  return (data as { band_id: string; name: string; city: string | null; genres: string[]; logo_path: string | null; instrument: string | null }[]).map((b) => ({
    bandId: b.band_id, name: b.name, city: b.city ?? '', genres: b.genres, logoUrl: logoUrl(b.logo_path), instrument: b.instrument ?? '',
  }))
}
