import type { Song } from './song'

export type Embed = { provider: 'youtube' | 'spotify'; src: string; height: number; openUrl: string; label: string }

const YT_ID = /^[\w-]{11}$/
const SP_ID = /^[A-Za-z0-9]{22}$/

function youtube(raw: string): Embed | undefined {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    const parts = u.pathname.split('/').filter(Boolean)
    let video = ''
    if (host === 'youtu.be') video = parts[0] ?? ''
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') video = u.searchParams.get('v') ?? ''
      else if (['shorts', 'embed', 'live'].includes(parts[0])) video = parts[1] ?? ''
    } else return undefined
    const list = u.searchParams.get('list') ?? ''
    // La URL del reproductor se arma desde IDs validados, nunca con la URL pegada.
    if (YT_ID.test(video)) {
      return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${video}`, height: 220, openUrl: `https://www.youtube.com/watch?v=${video}`, label: 'YouTube' }
    }
    if (/^[\w-]{10,64}$/.test(list)) {
      return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`, height: 220, openUrl: `https://www.youtube.com/playlist?list=${list}`, label: 'YouTube' }
    }
  } catch { /* no es una URL */ }
  return undefined
}

function spotify(raw: string): Embed | undefined {
  try {
    const u = new URL(raw)
    if (!/(^|\.)spotify\.com$/.test(u.hostname)) return undefined
    const parts = u.pathname.split('/').filter((p) => !p.startsWith('intl-') && p !== '')
    const [type, id] = parts
    if (!['track', 'album', 'playlist', 'episode', 'show'].includes(type) || !SP_ID.test(id ?? '')) return undefined
    return { provider: 'spotify', src: `https://open.spotify.com/embed/${type}/${id}`, height: type === 'track' || type === 'episode' ? 152 : 352, openUrl: `https://open.spotify.com/${type}/${id}`, label: 'Spotify' }
  } catch { return undefined }
}

/** Reproductores disponibles para una canción, según los links guardados. */
export function embedsFor(links: Song['links']): Embed[] {
  return [links.youtube && youtube(links.youtube.trim()), links.spotify && spotify(links.spotify.trim())].filter((e): e is Embed => !!e)
}
