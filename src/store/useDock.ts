import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DockView = { kind: 'list' } | { kind: 'band' } | { kind: 'friend'; id: string }

/** Qué muestra el panel de chat lateral (en pantallas anchas) y si está contraído. Se puede abrir desde cualquier pantalla. */
export const useDock = create<{ view: DockView; setView: (v: DockView) => void; collapsed: boolean; setCollapsed: (c: boolean) => void }>()(
  persist(
    (set) => ({
      view: { kind: 'list' },
      // Abrir una conversación también expande el panel.
      setView: (view) => set({ view, collapsed: false }),
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    { name: 'backline-dock', partialize: (s) => ({ collapsed: s.collapsed }) },
  ),
)
