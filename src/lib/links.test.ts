import { describe, expect, it } from 'vitest'
import { cleanSocial, safeSocials } from './links'

describe('cleanSocial', () => {
  it('convierte @usuario en link para Instagram y TikTok', () => {
    expect(cleanSocial('instagram', '@kabaret')).toBe('https://instagram.com/kabaret')
    expect(cleanSocial('tiktok', 'kabaret')).toBe('https://www.tiktok.com/@kabaret')
  })
  it('acepta links https del dominio correcto, con o sin esquema', () => {
    expect(cleanSocial('youtube', 'youtube.com/@kabaret')).toBe('https://youtube.com/@kabaret')
    expect(cleanSocial('spotify', 'https://open.spotify.com/artist/abc')).toBe('https://open.spotify.com/artist/abc')
  })
  it('rechaza dominios ajenos, http y esquemas peligrosos', () => {
    expect(cleanSocial('instagram', 'https://evil.com/kabaret')).toBeUndefined()
    expect(cleanSocial('youtube', 'https://youtube.com.evil.com/x')).toBeUndefined()
    expect(cleanSocial('web', 'http://kabaret.com')).toBeUndefined()
    expect(cleanSocial('web', 'javascript:alert(1)')).toBeUndefined()
  })
  it('la web puede ser cualquier dominio https', () => {
    expect(cleanSocial('web', 'kabaret.com')).toBe('https://kabaret.com/')
  })
  it('vacío es undefined', () => {
    expect(cleanSocial('web', '  ')).toBeUndefined()
  })
})

describe('safeSocials', () => {
  it('filtra lo inválido que haya quedado guardado', () => {
    expect(safeSocials({ instagram: 'javascript:alert(1)', web: 'https://kabaret.com' })).toEqual([['web', 'https://kabaret.com/']])
  })
})
