import { create } from 'zustand'

export type ConfirmOptions = {
  title: string
  body?: string
  confirmLabel?: string
  /** Si se define, hay que escribir este texto para habilitar el botón (acciones irreversibles). */
  typeToConfirm?: string
}
export type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void }

export const useConfirmStore = create<{ pending: PendingConfirm | null }>(() => ({ pending: null }))

/** Reemplaza confirm()/prompt() del navegador: `if (!(await ask({ title: '¿Borrar?' }))) return`. */
export function ask(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ pending: { ...options, resolve } }))
}
