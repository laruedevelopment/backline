import { useState } from 'react'
import { initials } from '../lib/identity'

/** Foto de perfil; si no hay (o no carga), las iniciales. */
export default function Avatar({ name, url, size = 'md', className = '', label }: { name: string; url?: string | null; size?: 'md' | 'lg' | number; className?: string; label?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const showImg = !!url && failed !== url
  const px = typeof size === 'number' ? { width: size, height: size } : undefined
  return (
    <span className={`avatar ${size === 'lg' ? 'lg' : ''} ${showImg ? 'has-img' : ''} ${className}`} style={{ marginLeft: 0, ...px }} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {showImg ? <img src={url} alt="" onError={() => setFailed(url)} decoding="async" /> : initials(name)}
    </span>
  )
}
