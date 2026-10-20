import { describe, expect, it } from 'vitest'
import { embedsFor } from './embed'

const srcs = (links: Parameters<typeof embedsFor>[0]) => embedsFor(links).map((e) => e.src)

describe('embedsFor', () => {
  it('arma la URL oficial desde el ID, no desde lo pegado', () => {
    expect(srcs({ youtube: 'https://youtu.be/dQw4w9WgXcQ?t=10', spotify: 'https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=abc' })).toEqual([
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
    ])
  })
  it('maneja watch, shorts y playlists', () => {
    expect(srcs({ youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijk' })).toEqual(['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'])
    expect(srcs({ youtube: 'https://youtube.com/shorts/dQw4w9WgXcQ' })).toHaveLength(1)
    expect(srcs({ youtube: 'https://www.youtube.com/playlist?list=PLabcdefghijk123' })).toEqual(['https://www.youtube-nocookie.com/embed/videoseries?list=PLabcdefghijk123'])
  })
  it('descarta dominios falsos, esquemas peligrosos e IDs inválidos', () => {
    expect(srcs({ youtube: 'https://evil.com/watch?v=dQw4w9WgXcQ' })).toEqual([])
    expect(srcs({ spotify: 'https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC' })).toEqual([])
    expect(srcs({ youtube: 'javascript:alert(1)', spotify: 'https://open.spotify.com/track/corto' })).toEqual([])
  })
})
