import { describe, expect, it } from 'vitest'
import { bandMessageNotice, directNotice, friendAcceptedNotice, friendRequestNotice, isFresh } from './logic'

describe('avisos sociales', () => {
  it('el chat de banda lleva el nombre de la banda y el primer nombre de quien escribe', () => {
    const n = bandMessageNotice('b1', 'Kabaret', 'Sebastián Gómez', '  Ensayo   mañana a las 7 ')
    expect(n).toEqual({ title: 'Kabaret', body: 'Sebastián: Ensayo mañana a las 7', url: 'banda/chat', tag: 'chat-b1' })
  })
  it('recorta los mensajes largos', () => {
    expect(bandMessageNotice('b', 'K', 'Ana', 'x'.repeat(300)).body.length).toBeLessThanOrEqual(117)
    expect(directNotice('u', 'Ana', 'y'.repeat(300)).body.length).toBeLessThanOrEqual(120)
  })
  it('un mensaje directo abre la conversación de quien lo envió', () => {
    expect(directNotice('u9', 'Ana Ríos', 'hola').url).toBe('explorar/amigos/u9')
  })
  it('solicitud y aceptación apuntan a Amigos', () => {
    expect(friendRequestNotice('Ana').url).toBe('explorar/amigos')
    expect(friendAcceptedNotice('Ana').title).toBe('Solicitud aceptada')
  })
  it('solo avisa lo reciente', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    expect(isFresh('2026-11-18T11:58:00Z', now)).toBe(true)
    expect(isFresh('2026-11-18T11:30:00Z', now)).toBe(false)
  })
})
