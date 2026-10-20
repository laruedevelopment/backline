import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { deleteSetlist, listSetlists, upsertSetlist, type Setlist } from './api'
import { useBand } from '../store/useBand'

/** Setlists: Supabase con banda activa, localStorage sin .env.local. */
export function useSetlists(bandId: string | undefined) {
  const local = useBand()
  const qc = useQueryClient()
  const cloud = !!supabase && !!bandId
  const key = ['setlists', bandId]
  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const query = useQuery({ queryKey: key, queryFn: () => listSetlists(bandId!), enabled: cloud })
  const save = useMutation({ mutationFn: (s: Setlist) => upsertSetlist(bandId!, s), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (id: string) => deleteSetlist(id), onSuccess: invalidate })

  if (!cloud) {
    return { setlists: local.setlists, loading: false, error: '', save: async (s: Setlist) => local.saveSetlist(s), remove: async (id: string) => local.removeSetlist(id) }
  }
  return {
    setlists: query.data ?? [],
    loading: query.isLoading,
    error: query.error || save.error || remove.error ? 'No pudimos sincronizar los setlists. Intenta de nuevo.' : '',
    save: (s: Setlist) => save.mutateAsync(s),
    remove: (id: string) => remove.mutateAsync(id),
  }
}
