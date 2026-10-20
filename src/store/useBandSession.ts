import { createContext, useContext } from 'react'
import type { Band } from '../lib/api'

/** Banda activa; undefined en modo local (sin Supabase). */
export const BandContext = createContext<Band | undefined>(undefined)
export const useActiveBand = () => useContext(BandContext)
