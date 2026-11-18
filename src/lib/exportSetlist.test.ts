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

import { buildShare, shareText, defaultFields } from './shareSetlist'
describe('compartir setlist', () => {
  const songs = new Map([['a', { ...song('a', 'Hysteria'), bpm: 94, minutes: 4, tunings: [{ instrument: 'Todos', tuning: 'Drop D' }] }], ['b', song('b', 'Muse Song')]])
  const entries = [{ t: 's' as const, id: 'a', tags: ['Solo'] }, { t: 'l' as const, id: 'x', text: 'Pausa' }, { t: 's' as const, id: 'b' }]
  it('incluye solo lo elegido y respeta etiquetas y orden', () => {
    const f = { ...defaultFields, artist: false, key: true, bpm: true, minutes: true, tuning: true }
    const t = shareText(buildShare('Toque', entries, songs, f), f)
    expect(t).toContain('1. Hysteria — Tono Am · 94 bpm · 4 min · Drop D · Solo')
    expect(t).toContain('— Pausa —')
    expect(t).toContain('2. Muse Song')
    expect(t).toContain('2 canciones · 8 min')
    expect(t).not.toContain('Muse —')
  })
  it('sin número ni total', () => {
    const f = { ...defaultFields, number: false, total: false, artist: false, tags: false }
    const t = shareText(buildShare('Toque', entries, songs, f), f)
    expect(t).toBe('Toque\n\nHysteria\n— Pausa —\nMuse Song')
  })
})
