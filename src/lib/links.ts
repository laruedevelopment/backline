import type { BandLinks } from './api'

type Kind = keyof BandLinks
const hosts: Record<Exclude<Kind, 'web'>, RegExp> = {
  instagram: /(^|\.)instagram\.com$/,
  facebook: /(^|\.)(facebook\.com|fb\.com)$/,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  spotify: /(^|\.)spotify\.com$/,
  tiktok: /(^|\.)tiktok\.com$/,
}
const handleBase: Partial<Record<Kind, string>> = { instagram: 'https://instagram.com/', tiktok: 'https://www.tiktok.com/@' }

export const socialLabels: Record<Kind, string> = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', spotify: 'Spotify', tiktok: 'TikTok', web: 'Sitio web',
}
export const socialKinds = Object.keys(socialLabels) as Kind[]

/** Acepta un link https o, para Instagram y TikTok, solo el @usuario. Devuelve undefined si no es válido. */
export function cleanSocial(kind: Kind, raw: string): string | undefined {
  const v = raw.trim()
  if (!v) return undefined
  const base = handleBase[kind]
  if (base && /^@?[\w.]{2,30}$/.test(v)) return base + v.replace(/^@/, '')
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    if (u.protocol !== 'https:') return undefined
    if (kind !== 'web' && !hosts[kind].test(u.hostname)) return undefined
    return u.toString().slice(0, 300)
  } catch {
    return undefined
  }
}

/** Solo links ya guardados y válidos llegan a un href. */
export function safeSocials(links: BandLinks): [Kind, string][] {
  return socialKinds.flatMap((k) => {
    const url = links[k] ? cleanSocial(k, links[k]!) : undefined
    return url ? [[k, url] as [Kind, string]] : []
  })
}
