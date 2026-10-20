import { describe, expect, it } from 'vitest'
import { inviteLink, isInviteCode, normalizeInvite } from './pendingInvite'

describe('código de invitación', () => {
  it('acepta códigos normales y los normaliza', () => {
    expect(isInviteCode('AbC123xy')).toBe(true)
    expect(normalizeInvite('  AbC123XY ')).toBe('abc123xy')
  })
  it('rechaza basura que venga en el link', () => {
    expect(isInviteCode('')).toBe(false)
    expect(isInviteCode('ab')).toBe(false)
    expect(isInviteCode('a b/c')).toBe(false)
    expect(isInviteCode('<script>alert(1)</script>')).toBe(false)
  })
  it('arma el link con la base de la app', () => {
    expect(inviteLink('https://x.github.io/backline/', 'abc123')).toBe('https://x.github.io/backline/unirse/abc123')
  })
})
