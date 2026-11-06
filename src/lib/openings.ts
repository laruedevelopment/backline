// «Busco músico»: publicaciones de bandas públicas que necesitan un instrumento, y las respuestas de los músicos.
import { avatarUrl } from './api'
import { supabase } from './supabase'

const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}
const logo = (path: string | null) => (path ? db().storage.from('band-media').getPublicUrl(path).data.publicUrl : null)

export type OpeningKind = 'temporary' | 'permanent'
export const kindText: Record<OpeningKind, string> = { temporary: 'Temporal', permanent: 'Definitivo' }

export type Opening = {
  id: string; bandId: string; bandName: string; bandLogoUrl: string | null; bandCity: string
  instrument: string; kind: OpeningKind; neededOn: string | null; city: string; details: string; createdAt: string; replied: boolean
}
type OpeningRow = {
  id: string; band_id: string; band_name: string; band_logo: string | null; band_city: string | null; instrument: string; kind: OpeningKind
  needed_on: string | null; city: string | null; details: string | null; created_at: string; replied: boolean
}

/** Búsquedas abiertas de bandas públicas. */
export async function listOpenings(): Promise<Opening[]> {
  const { data, error } = await db().rpc('open_openings')
  if (error) throw error
  return (data as OpeningRow[]).map((r) => ({
    id: r.id, bandId: r.band_id, bandName: r.band_name, bandLogoUrl: logo(r.band_logo), bandCity: r.band_city ?? '', instrument: r.instrument, kind: r.kind,
    neededOn: r.needed_on, city: r.city ?? '', details: r.details ?? '', createdAt: r.created_at, replied: r.replied,
  }))
}

export type MyOpening = { id: string; instrument: string; kind: OpeningKind; neededOn: string | null; city: string; details: string; status: 'open' | 'closed'; replies: number }

/** Las búsquedas de una banda (para su admin), con cuántas respuestas tiene cada una. */
export async function listBandOpenings(bandId: string): Promise<MyOpening[]> {
  const { data, error } = await db().from('band_openings').select('id, instrument, kind, needed_on, city, details, status, opening_replies(count)').eq('band_id', bandId).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  type Row = { id: string; instrument: string; kind: OpeningKind; needed_on: string | null; city: string | null; details: string | null; status: 'open' | 'closed'; opening_replies: { count: number }[] }
  return (data as unknown as Row[]).map((r) => ({ id: r.id, instrument: r.instrument, kind: r.kind, neededOn: r.needed_on, city: r.city ?? '', details: r.details ?? '', status: r.status, replies: r.opening_replies?.[0]?.count ?? 0 }))
}

export type NewOpening = { instrument: string; kind: OpeningKind; neededOn: string; city: string; details: string }

export async function createOpening(bandId: string, userId: string, o: NewOpening) {
  const { error } = await db().from('band_openings').insert({
    band_id: bandId, created_by: userId, instrument: o.instrument.trim(), kind: o.kind,
    needed_on: o.kind === 'temporary' && o.neededOn ? o.neededOn : null, city: o.city.trim() || null, details: o.details.trim() || null,
  })
  if (error) throw error
}
export async function setOpeningStatus(id: string, status: 'open' | 'closed') {
  const { error } = await db().from('band_openings').update({ status }).eq('id', id)
  if (error) throw error
}
export async function deleteOpening(id: string) {
  const { error } = await db().from('band_openings').delete().eq('id', id)
  if (error) throw error
}
export async function replyToOpening(openingId: string, userId: string, message: string) {
  const { error } = await db().from('opening_replies').insert({ opening_id: openingId, profile_id: userId, message: message.trim().slice(0, 1000) })
  if (error) throw error
}

export type Reply = { id: string; profileId: string; name: string; avatarUrl: string | null; instruments: string[]; city: string; message: string; createdAt: string }
export async function listReplies(openingId: string): Promise<Reply[]> {
  const { data, error } = await db().rpc('opening_replies_for', { p_opening: openingId })
  if (error) throw error
  type Row = { id: string; profile_id: string; display_name: string; avatar_path: string | null; instruments: string[] | null; city: string | null; message: string; created_at: string }
  return (data as Row[]).map((r) => ({ id: r.id, profileId: r.profile_id, name: r.display_name || 'Músico', avatarUrl: avatarUrl(r.avatar_path), instruments: r.instruments ?? [], city: r.city ?? '', message: r.message, createdAt: r.created_at }))
}
