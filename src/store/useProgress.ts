import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ProgressState = {
  done: string[]
  /** Mejor tempo (bpm) que la persona logró tocar limpio en cada lección. */
  best: Record<string, number>
  toggle: (lessonId: string) => void
  setBest: (lessonId: string, bpm: number) => void
}

/** Lecciones completadas (local; pasa a Supabase con la cuenta). */
export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      done: [],
      best: {},
      toggle: (id) => set((s) => ({ done: s.done.includes(id) ? s.done.filter((x) => x !== id) : [...s.done, id] })),
      setBest: (id, bpm) => set((s) => ({ best: { ...s.best, [id]: Math.max(30, Math.min(300, Math.round(bpm))) } })),
    }),
    { name: 'backline-progress-v1' },
  ),
)
