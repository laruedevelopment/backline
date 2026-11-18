import { create } from 'zustand'

export type DockView = { kind: 'list' } | { kind: 'band' } | { kind: 'friend'; id: string }

/** Qué muestra el panel de chat lateral (en pantallas anchas). Se puede abrir desde cualquier pantalla. */
export const useDock = create<{ view: DockView; setView: (v: DockView) => void }>((set) => ({
  view: { kind: 'list' },
  setView: (view) => set({ view }),
}))
