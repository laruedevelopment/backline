import { createContext, useContext } from 'react'
import type { Venue } from '../../lib/venues'

/** El negocio con el que está trabajando el dueño (hoy, su primera sala de ensayos). */
export const VenueContext = createContext<Venue | undefined>(undefined)

export function useVenue(): Venue {
  const v = useContext(VenueContext)
  if (!v) throw new Error('useVenue debe usarse dentro del área Mi negocio')
  return v
}
