import type { QueryClient } from '@tanstack/react-query'
import { applyLineupToSongs, getDefaultLineup } from './api'
import { ask } from './confirm'
import type { Song } from './song'

/**
 * Aplica la formación de la banda a un grupo de canciones, pidiendo confirmación.
 * `onlyEmpty`: solo a las que todavía no tienen «Quién toca». Devuelve un mensaje para mostrar, o '' si se canceló.
 */
export async function applyBandLineup(opts: { bandId: string; songs: Song[]; qc: QueryClient; onlyEmpty?: boolean; scope: string }): Promise<string> {
  const lineup = await getDefaultLineup(opts.bandId)
  if (!lineup.length) return 'Primero define la formación de la banda en Banda › Ajustes › Quién toca.'
  const targets = opts.onlyEmpty ? opts.songs.filter((s) => !s.lineup?.some((l) => l.profileId)) : opts.songs
  if (!targets.length) return 'Todas esas canciones ya tienen su formación.'
  const body = opts.onlyEmpty
    ? 'Se llena solo en las que todavía no tienen a nadie asignado. No se cambia ninguna que ya esté armada.'
    : 'Reemplaza la formación de esas canciones por la de la banda. Los invitados que ya tenían se conservan.'
  if (!(await ask({ title: `¿Aplicar la formación a ${targets.length} ${targets.length === 1 ? 'canción' : 'canciones'} ${opts.scope}?`, body, confirmLabel: 'Aplicar' }))) return ''
  await applyLineupToSongs(targets, lineup)
  await opts.qc.invalidateQueries({ queryKey: ['songs', opts.bandId] })
  return `Listo: formación aplicada a ${targets.length} ${targets.length === 1 ? 'canción' : 'canciones'}.`
}
