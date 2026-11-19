import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listMembers, listPlaceholders, type Member } from './api'
import { supabase } from './supabase'

/**
 * Quiénes son «la banda» para asignar cosas: los integrantes con cuenta (`members`) y los que aún no la tienen (`placeholders`).
 * `people` junta a los dos (los sin cuenta llevan `noAccount`) para las listas de «Quién toca», anotaciones y equipo.
 */
export function useRoster(bandId?: string) {
  const enabled = !!supabase && !!bandId
  const { data: members = [], isLoading } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId!), enabled })
  const { data: placeholders = [] } = useQuery({ queryKey: ['placeholders', bandId], queryFn: () => listPlaceholders(bandId!), enabled })
  const people = useMemo<Member[]>(() => [
    ...members,
    ...placeholders.map((p) => ({ profileId: p.id, name: p.name, role: 'member', instrument: p.instrument, instruments: [], avatarUrl: null, noAccount: true })),
  ], [members, placeholders])
  return { members, placeholders, people, isLoading }
}

/** Refresca todo lo que depende de quién es quién en la banda (integrantes, canciones, anotaciones y equipo). */
export function useRefreshRoster(bandId: string) {
  const qc = useQueryClient()
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['members', bandId] }), qc.invalidateQueries({ queryKey: ['placeholders', bandId] }),
    qc.invalidateQueries({ queryKey: ['songs'] }), qc.invalidateQueries({ queryKey: ['song-notes', bandId] }), qc.invalidateQueries({ queryKey: ['gear', bandId] }),
  ])
}
