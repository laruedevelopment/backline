import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ProgressState = {
  done: string[]
  toggle: (lessonId: string) => void
}

/** Lecciones completadas (local; pasa a Supabase con la cuenta). */
export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      done: [],
      toggle: (id) => set((s) => ({ done: s.done.includes(id) ? s.done.filter((x) => x !== id) : [...s.done, id] })),
    }),
    { name: 'backline-progress-v1' },
  ),
)
