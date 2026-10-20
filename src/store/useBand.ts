import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { songs as demoSongs } from '../data/demo'
import type { Song } from '../lib/song'

type BandState = {
  songs: Song[]
  saveSong: (song: Song) => void
  removeSong: (id: string) => void
}

/**
 * Capa de datos local (localStorage). Misma forma que las tablas de Supabase:
 * cuando se conecte Supabase se reemplaza este store por consultas de TanStack Query.
 */
export const useBand = create<BandState>()(
  persist(
    (set) => ({
      songs: demoSongs,
      saveSong: (song) =>
        set((s) => ({
          songs: s.songs.some((x) => x.id === song.id) ? s.songs.map((x) => (x.id === song.id ? song : x)) : [...s.songs, song],
        })),
      removeSong: (id) => set((s) => ({ songs: s.songs.filter((x) => x.id !== id) })),
    }),
    { name: 'backline-band-v1' },
  ),
)
