import { useEffect, useState } from 'react'

/** ¿La ventana tiene al menos este ancho (px)? Se actualiza al redimensionar. */
export function useWide(min: number): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(`(min-width: ${min}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [min])
  return wide
}
