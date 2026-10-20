import { useState } from 'react'
import { initials } from '../lib/identity'

/** Logo de la banda; si no hay (o no carga), el monograma con sus iniciales. */
export default function BandMark({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string | null; size?: 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const showImg = !!logoUrl && !failed
  return (
    <span className={`mono-mark ${size === 'lg' ? 'lg' : ''} ${showImg ? 'has-img' : ''}`} aria-hidden>
      {showImg ? <img src={logoUrl} alt="" onError={() => setFailed(true)} decoding="async" /> : initials(name)}
    </span>
  )
}
