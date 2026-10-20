import { describe, expect, it } from 'vitest'
import { canonicalCity, suggestCities } from './cities'

describe('ciudades', () => {
  it('normaliza tildes, mayúsculas y espacios a la forma canónica', () => {
    expect(canonicalCity('  bucaramanga ')).toBe('Bucaramanga')
    expect(canonicalCity('BOGOTA')).toBe('Bogotá')
    expect(canonicalCity('medellin')).toBe('Medellín')
    expect(canonicalCity('bga')).toBe('Bucaramanga')
  })
  it('una ciudad fuera de la lista queda limpia, no se pierde', () => {
    expect(canonicalCity('  villa   nueva ')).toBe('Villa Nueva')
    expect(canonicalCity('')).toBe('')
  })
  it('sugiere primero las que empiezan por lo escrito, sin importar tildes', () => {
    expect(suggestCities('buc')[0].name).toBe('Bucaramanga')
    expect(suggestCities('ibague')[0].name).toBe('Ibagué')
    expect(suggestCities('zzzz')).toEqual([])
  })
})
