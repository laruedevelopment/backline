import { createContext, useContext } from 'react'
import type { Band } from '../lib/api'

/** Banda activa; undefined en modo local (sin Supabase). */
export const BandContext = createContext<Band | undefined>(undefined)
export const useActiveBand = () => useContext(BandContext)

/** Todas las bandas del músico y cómo cambiar de una a otra. */
export type BandsValue = { bands: Band[]; setActive: (id: string) => void }
export const BandsContext = createContext<BandsValue>({ bands: [], setActive: () => {} })
export const useBands = () => useContext(BandsContext)
