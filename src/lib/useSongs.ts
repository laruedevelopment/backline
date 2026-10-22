import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { deleteSong, listSongs, upsertSong } from './api'
import { useBand } from '../store/useBand'
import type { Song } from './song'

/** Repertorio: Supabase si hay cuenta/banda, localStorage si la app corre sin .env.local. */
export function useSongs(bandId: string | undefined) {
  const local = useBand()
  const qc = useQueryClient()
  const cloud = !!supabase && !!bandId
  const key = ['songs', bandId]

  const query = useQuery({ queryKey: key, queryFn: () => listSongs(bandId!), enabled: cloud })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ['song-lyrics'] }), qc.invalidateQueries({ queryKey: ['song-lyrics-one'] })])
  const save = useMutation({ mutationFn: (s: Song) => upsertSong(bandId!, s), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: string) => deleteSong(id), onSuccess: refresh })

  if (!cloud) return { songs: local.songs, loading: false, error: '', save: async (s: Song) => local.saveSong(s), remove: async (id: string) => local.removeSong(id) }
  return {
    songs: query.data ?? [],
    loading: query.isLoading,
    error: query.error || save.error || remove.error ? 'No pudimos sincronizar con la base de datos. Intenta de nuevo.' : '',
    save: (s: Song) => save.mutateAsync(s),
    remove: (id: string) => remove.mutateAsync(id),
  }
}
