import { describe, expect, it } from 'vitest'
import { cleanYoutubeTitle, playlistIdFromUrl } from './youtubePlaylist'

describe('cleanYoutubeTitle', () => {
  it('quita ruido y deja "Canción - Artista"', () => {
    expect(cleanYoutubeTitle('The White Stripes - Seven Nation Army (Official Video)', 'TheWhiteStripesVEVO')).toBe('Seven Nation Army - The White Stripes')
  })
  it('usa el canal como artista si el título no lo trae', () => {
    expect(cleanYoutubeTitle('Black Hole Sun [Remastered 2014]', 'Soundgarden - Topic')).toBe('Black Hole Sun - Soundgarden')
  })
})

describe('playlistIdFromUrl', () => {
  it('detecta playlists de YouTube y reconoce Spotify', () => {
    expect(playlistIdFromUrl('https://www.youtube.com/playlist?list=PLabcdefghijk123')).toEqual({ kind: 'youtube', id: 'PLabcdefghijk123' })
    expect(playlistIdFromUrl('https://open.spotify.com/playlist/xyz')).toEqual({ kind: 'spotify' })
    expect(playlistIdFromUrl('texto cualquiera')).toEqual({ kind: 'unknown' })
  })
})
