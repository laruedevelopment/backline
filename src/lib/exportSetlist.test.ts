import { describe, expect, it } from 'vitest'
import { setlistHtml } from './exportSetlist'
import type { Song } from './song'

const song = (id: string, title: string): Song => ({ id, title, artist: 'Muse', key: 'Am', bpm: 94, minutes: 4, status: 'ready', tunings: [], keyChanges: [], links: {} })

describe('setlistHtml', () => {
  const songs = new Map([['a', song('a', 'Hysteria <b>')], ['b', song('b', 'Sin letra')]])
  const entries = [{ t: 's' as const, id: 'a' }, { t: 'l' as const, id: 'x', text: 'Pausa' }, { t: 's' as const, id: 'b' }]
  it('escapa el texto, incluye etiquetas y una página por canción con letra', () => {
    const html = setlistHtml('Toque <1>', entries, songs, new Map([['a', 'Am   F\nHoy vuelvo a casa']]), true)
    expect(html).toContain('Toque &lt;1&gt;')
    expect(html).toContain('Hysteria &lt;b&gt;')
    expect(html).toContain('Pausa')
    expect(html.match(/class="song"/g)?.length).toBe(1)
    expect(html).toContain('<span class="ch">Am   F</span>')
  })
  it('sin letras solo trae la lista', () => {
    expect(setlistHtml('X', entries, songs, new Map([['a', 'Am']]), false)).not.toContain('class="song"')
  })
})
