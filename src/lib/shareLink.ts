import type { Tuning } from './song'
// Link de solo lectura de un setlist: se ve sin cuenta y solo trae lo básico (nunca letras ni notas).
import { supabase } from './supabase'

const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export type SharedRow = { kind: 'label'; text: string } | { kind: 'song'; title: string; artist: string; key: string; bpm: number; minutes: number; tags: string[]; tunings?: Tuning[] }
export type SharedSetlist = { name: string; band: string; rows: SharedRow[] }

export const shareUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}s/${token}`

export async function getShareToken(setlistId: string): Promise<string | null> {
  const { data, error } = await db().rpc('setlist_share_token', { p_setlist: setlistId })
  if (error) throw error
  return (data as string | null) ?? null
}
export async function setShare(setlistId: string, on: boolean): Promise<string | null> {
  const { data, error } = await db().rpc('set_setlist_share', { p_setlist: setlistId, p_on: on })
  if (error) throw error
  return (data as string | null) ?? null
}
export async function getSharedSetlist(token: string): Promise<SharedSetlist | null> {
  const { data, error } = await db().rpc('shared_setlist', { p_token: token })
  if (error) throw error
  return (data as SharedSetlist | null) ?? null
}
