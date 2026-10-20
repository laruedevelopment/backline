import { describe, expect, it } from 'vitest'
import { buildNotice, type BookingFacts } from './logic'

const base: BookingFacts = {
  status: 'requested', source: 'app', requestedBy: 'banda-user', ownerId: 'dueno', contactName: 'Sebas Gómez',
  roomName: 'Sala A', venueName: 'Sala Resonancia', startsAt: '2026-10-27T00:00:00Z', endsAt: '2026-10-27T02:00:00Z',
  autoConfirmed: false, lastNotifiedStatus: null,
}

describe('buildNotice', () => {
  it('una solicitud nueva avisa al dueño, con la hora de Colombia', () => {
    const n = buildNotice(base, 'banda-user')!
    expect(n.to).toBe('dueno')
    expect(n.title).toBe('Nueva solicitud de reserva')
    expect(n.body).toContain('Sebas Gómez')
    expect(n.body).toMatch(/7:00/) // 00:00 UTC = 7:00 pm en Colombia
    expect(n.url).toBe('mi-sala')
  })

  it('cuando el dueño confirma, avisa a quien pidió', () => {
    const n = buildNotice({ ...base, status: 'confirmed' }, 'dueno')!
    expect(n.to).toBe('banda-user')
    expect(n.title).toBe('¡Tu reserva fue confirmada!')
    expect(n.url).toBe('salas')
  })

  it('una reserva confirmada al instante avisa al dueño', () => {
    expect(buildNotice({ ...base, status: 'confirmed', autoConfirmed: true }, 'banda-user')!.title).toBe('Nueva reserva confirmada')
  })

  it('rechazo y cancelación llegan a la otra parte', () => {
    expect(buildNotice({ ...base, status: 'rejected' }, 'dueno')!.to).toBe('banda-user')
    expect(buildNotice({ ...base, status: 'cancelled' }, 'banda-user')!.to).toBe('dueno')
    expect(buildNotice({ ...base, status: 'cancelled' }, 'dueno')!.to).toBe('banda-user')
  })

  it('no avisa dos veces el mismo estado', () => {
    expect(buildNotice({ ...base, lastNotifiedStatus: 'requested' }, 'banda-user')).toBeNull()
  })

  it('un tercero que llama no genera avisos', () => {
    expect(buildNotice(base, 'intruso')).toBeNull()
  })

  it('el solicitante no puede disparar mensajes que corresponden al dueño (confirmar/rechazar)', () => {
    expect(buildNotice({ ...base, status: 'rejected' }, 'banda-user')).toBeNull()
  })

  it('las reservas anotadas por el dueño no tienen a quién avisar', () => {
    expect(buildNotice({ ...base, status: 'confirmed', source: 'owner', requestedBy: null }, 'dueno')).toBeNull()
  })

  it('si dueño y solicitante fueran la misma persona no se avisa a sí misma', () => {
    expect(buildNotice({ ...base, requestedBy: 'dueno' }, 'dueno')).toBeNull()
  })
})
