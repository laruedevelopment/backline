const KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

/** La importación por link solo se ofrece si hay clave de YouTube configurada. */
export const youtubeEnabled = !!KEY

export type LinkKind = 'youtube' | 'spotify' | 'unknown'

export function playlistIdFromUrl(raw: string): { kind: LinkKind; id?: string } {
  try {
    const u = new URL(raw.trim())
    if (/(^|\.)spotify\.com$/.test(u.hostname)) return { kind: 'spotify' }
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname)) {
      const id = u.searchParams.get('list')
      return id && /^[\w-]{10,64}$/.test(id) ? { kind: 'youtube', id } : { kind: 'youtube' }
    }
  } catch { /* no es una URL */ }
  return { kind: 'unknown' }
}

// Ruido típico de los títulos de YouTube.
const NOISE = /[([{]\s*(?:official|oficial|lyrics?|letra|audio|video|vídeo|videoclip|music video|hd|4k|remaster(?:ed)?|live|en vivo|visualizer)[^)\]}]*[)\]}]/gi

/** "Artista - Canción (Official Video)" → "Canción - Artista" (formato que entiende el importador). */
export function cleanYoutubeTitle(title: string, channel: string): string {
  const t = title.replace(NOISE, '').replace(/\s+/g, ' ').trim()
  const m = t.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (m) return `${m[2].trim()} - ${m[1].trim()}`
  const artist = channel.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim()
  return artist ? `${t} - ${artist}` : t
}

type Item = { snippet: { title: string; videoOwnerChannelTitle?: string; channelTitle?: string } }

export async function fetchYoutubePlaylist(playlistId: string, max = 200): Promise<string[]> {
  if (!KEY) throw new Error('sin-clave')
  const out: string[] = []
  let token = ''
  while (out.length < max) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    url.search = new URLSearchParams({ part: 'snippet', maxResults: '50', playlistId, key: KEY, ...(token && { pageToken: token }) }).toString()
    const res = await fetch(url)
    if (res.status === 404) throw new Error('privada')
    if (!res.ok) throw new Error('api')
    const data = (await res.json()) as { items: Item[]; nextPageToken?: string }
    for (const it of data.items) {
      const { title, videoOwnerChannelTitle, channelTitle } = it.snippet
      if (/^(private|deleted) video$/i.test(title)) continue
      out.push(cleanYoutubeTitle(title, videoOwnerChannelTitle ?? channelTitle ?? ''))
    }
    if (!data.nextPageToken) break
    token = data.nextPageToken
  }
  return out.slice(0, max)
}
