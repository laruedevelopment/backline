import { describe, expect, it } from 'vitest'
import { detailLine, dimensionsLabel, includedChips, quantityLabel, rentals, type Equipment } from './equipment'
import { distanceKm, mapLinks, osmEmbedUrl, parseCoords } from './geo'

const item = (p: Partial<Equipment>): Equipment => ({
  id: 'x', roomId: 'r', kind: 'guitar_amp', title: '', quantity: 1, format: null, brand: '', model: '', channels: null, details: '',
  included: true, extraPrice: null, extraUnit: 'hour', ...p,
})

describe('equipo', () => {
  it('nombra con cantidad en singular y plural', () => {
    expect(quantityLabel(item({ kind: 'drums' }))).toBe('Batería')
    expect(quantityLabel(item({ kind: 'guitar_amp', quantity: 2 }))).toBe('2 amplificadores de guitarra')
    expect(quantityLabel(item({ kind: 'other', title: 'Pedalera', quantity: 3 }))).toBe('3 × Pedalera')
  })

  it('la referencia es opcional: solo muestra lo que se dio', () => {
    expect(detailLine(item({}))).toBe('')
    expect(detailLine(item({ brand: 'Fender', model: 'Hot Rod Deluxe', format: 'combo' }))).toBe('Fender Hot Rod Deluxe · Combo')
    expect(detailLine(item({ kind: 'mixer', format: 'digital', channels: 16, brand: 'Behringer', model: 'X32' }))).toBe('Behringer X32 · Digital · 16 canales')
    expect(detailLine(item({ format: 'head_cabinet', details: 'Cabina 4×12' }))).toBe('Cabezote y cabina · Cabina 4×12')
  })

  it('separa lo incluido de lo que se alquila aparte, con su precio', () => {
    const items = [
      item({ id: '1', kind: 'drums' }),
      item({ id: '2', kind: 'guitar', quantity: 3, included: false, extraPrice: 15000, extraUnit: 'session', details: 'Stratocaster' }),
      item({ id: '3', kind: 'keyboard', included: false, extraPrice: null }),
    ]
    expect(includedChips(items)).toEqual(['Batería'])
    expect(rentals(items)).toEqual([
      { label: '3 guitarras', detail: 'Stratocaster', price: 15000, unit: 'session' },
      { label: 'Teclado', detail: '', price: null, unit: 'hour' },
    ])
  })

  it('las medidas con área, y sin medidas no inventa nada', () => {
    expect(dimensionsLabel({ widthM: 4.5, lengthM: 6, heightM: 2.8 })).toBe('4,5 × 6 m · 27 m² · 2,8 m de alto')
    expect(dimensionsLabel({ widthM: 4, lengthM: 5, heightM: null })).toBe('4 × 5 m · 20 m²')
    expect(dimensionsLabel({ widthM: null, lengthM: 5, heightM: null })).toBeNull()
  })
})

describe('ubicación', () => {
  it('lee coordenadas sueltas y enlaces de Google Maps y OpenStreetMap', () => {
    const expected = { lat: 7.119349, lng: -73.122742 }
    expect(parseCoords('7.119349, -73.122742')).toEqual(expected)
    expect(parseCoords('https://www.google.com/maps/place/Sala/@7.119349,-73.122742,17z/data=!3m1')).toEqual(expected)
    expect(parseCoords('https://www.google.com/maps?q=7.119349,-73.122742')).toEqual(expected)
    expect(parseCoords('https://www.google.com/maps/place/X/data=!3d7.119349!4d-73.122742')).toEqual(expected)
    expect(parseCoords('https://www.openstreetmap.org/#map=17/7.119349/-73.122742')).toEqual(expected)
  })
  it('rechaza lo que no son coordenadas válidas', () => {
    expect(parseCoords('Cabecera, Bucaramanga')).toBeUndefined()
    expect(parseCoords('200, 300')).toBeUndefined()
    expect(parseCoords('0, 0')).toBeUndefined()
    expect(parseCoords('')).toBeUndefined()
  })
  it('arma los enlaces de mapa y la distancia', () => {
    const l = mapLinks({ lat: 7.1, lng: -73.1 }, 'Sala')
    expect(l.google).toContain('query=7.1,-73.1')
    expect(l.waze).toContain('ll=7.1,-73.1')
    expect(osmEmbedUrl({ lat: 7.1, lng: -73.1 })).toContain('marker=7.1%2C-73.1')
    // Bucaramanga ↔ Floridablanca ≈ 7 km
    const km = distanceKm({ lat: 7.1254, lng: -73.1198 }, { lat: 7.0622, lng: -73.0864 })
    expect(km).toBeGreaterThan(6)
    expect(km).toBeLessThan(9)
  })
})
