// Lista de equipo de un evento: qué hay que llevar, quién lo lleva y si ya está listo.
import { supabase } from './supabase'

const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export type Gear = { id: string; eventId: string; item: string; assignedTo: string | null; done: boolean }
type Row = { id: string; event_id: string; item: string; assigned_to: string | null; done: boolean }

export const GEAR_PRESETS = ['Ampli de guitarra', 'Ampli de bajo', 'Batería completa', 'Platillos', 'Baquetas', 'Pedalera', 'Cables', 'Extensión eléctrica', 'Micrófonos', 'Mezcladora', 'Teclado', 'Atriles', 'Cuerdas de repuesto']

/** Todo el equipo de la banda (de sus eventos), para mostrar el avance en la agenda. */
export async function listGear(bandId: string): Promise<Gear[]> {
  const { data, error } = await db().from('event_gear').select('id, event_id, item, assigned_to, done').eq('band_id', bandId).order('created_at').limit(1000)
  if (error) throw error
  return (data as Row[]).map((r) => ({ id: r.id, eventId: r.event_id, item: r.item, assignedTo: r.assigned_to, done: r.done }))
}
export async function addGear(bandId: string, eventId: string, item: string, assignedTo: string | null) {
  const { error } = await db().from('event_gear').insert({ band_id: bandId, event_id: eventId, item: item.trim().slice(0, 60), assigned_to: assignedTo })
  if (error) throw error
}
export async function updateGear(id: string, patch: { done?: boolean; assigned_to?: string | null; item?: string }) {
  const { error } = await db().from('event_gear').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteGear(id: string) {
  const { error } = await db().from('event_gear').delete().eq('id', id)
  if (error) throw error
}
