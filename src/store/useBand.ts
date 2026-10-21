import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setlist as demoSetlist, songs as demoSongs } from '../data/demo'
import type { Song } from '../lib/song'

type BandState = {
  setlists: { id: string; name: string; songIds: string[]; items?: import('../lib/setlistItems').SetlistItem[]; spotifyUrl?: string }[]
  saveSetlist: (s: { id: string; name: string; songIds: string[]; items?: import('../lib/setlistItems').SetlistItem[]; spotifyUrl?: string }) => void
  removeSetlist: (id: string) => void
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
      setlists: [{ id: 'demo', ...demoSetlist }],
      saveSetlist: (l) =>
        set((s) => ({ setlists: s.setlists.some((x) => x.id === l.id) ? s.setlists.map((x) => (x.id === l.id ? l : x)) : [...s.setlists, l] })),
      removeSetlist: (id) => set((s) => ({ setlists: s.setlists.filter((x) => x.id !== id) })),
      saveSong: (song) =>
        set((s) => ({
          songs: s.songs.some((x) => x.id === song.id) ? s.songs.map((x) => (x.id === song.id ? song : x)) : [...s.songs, song],
        })),
      removeSong: (id) => set((s) => ({ songs: s.songs.filter((x) => x.id !== id) })),
    }),
    { name: 'backline-band-v2' },
  ),
)
