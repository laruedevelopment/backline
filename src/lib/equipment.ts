export type EquipKind = 'guitar_amp' | 'bass_amp' | 'drums' | 'keyboard' | 'mixer' | 'pa' | 'mics' | 'guitar' | 'bass' | 'percussion' | 'other'
export type EquipFormat = 'combo' | 'head_cabinet' | 'analog' | 'digital'
export type ExtraUnit = 'hour' | 'session'

export type Equipment = {
  id: string
  roomId: string
  kind: EquipKind
  title: string
  quantity: number
  format: EquipFormat | null
  brand: string
  model: string
  channels: number | null
  details: string
  included: boolean
  extraPrice: number | null
  extraUnit: ExtraUnit
}

type KindInfo = {
  label: string
  one: string
  many: string
  formats?: EquipFormat[]
  channels?: boolean
  /** Lo típico: si no suele venir incluido, se propone «alquiler aparte». */
  rentDefault?: boolean
  /** Ejemplo de marca y referencia para el formulario. */
  example: [string, string]
}

export const kindInfo: Record<EquipKind, KindInfo> = {
  guitar_amp: { label: 'Amplificador de guitarra', one: 'amplificador de guitarra', many: 'amplificadores de guitarra', formats: ['combo', 'head_cabinet'], example: ['Fender', 'Hot Rod Deluxe'] },
  bass_amp: { label: 'Amplificador de bajo', one: 'amplificador de bajo', many: 'amplificadores de bajo', formats: ['combo', 'head_cabinet'], example: ['Ampeg', 'SVT-4 Pro'] },
  drums: { label: 'Batería', one: 'batería', many: 'baterías', example: ['Pearl', 'Export'] },
  keyboard: { label: 'Teclado / organeta', one: 'teclado', many: 'teclados', rentDefault: true, example: ['Yamaha', 'PSR-E373'] },
  mixer: { label: 'Consola / mezcladora', one: 'consola', many: 'consolas', formats: ['analog', 'digital'], channels: true, example: ['Behringer', 'X32 Compact'] },
  pa: { label: 'Parlantes / PA', one: 'sistema de sonido (PA)', many: 'sistemas de sonido (PA)', channels: true, example: ['Yamaha', 'DBR12'] },
  mics: { label: 'Micrófonos', one: 'micrófono', many: 'micrófonos', example: ['Shure', 'SM58'] },
  guitar: { label: 'Guitarra', one: 'guitarra', many: 'guitarras', rentDefault: true, example: ['Fender', 'Stratocaster'] },
  bass: { label: 'Bajo', one: 'bajo', many: 'bajos', rentDefault: true, example: ['Fender', 'Precision Bass'] },
  percussion: { label: 'Percusión', one: 'instrumento de percusión', many: 'instrumentos de percusión', example: ['LP', 'Congas'] },
  other: { label: 'Otro', one: 'equipo', many: 'equipos', example: ['', ''] },
}

export const formatLabel: Record<EquipFormat, string> = {
  combo: 'Combo',
  head_cabinet: 'Cabezote y cabina',
  analog: 'Análoga',
  digital: 'Digital',
}

export const kindOrder = Object.keys(kindInfo) as EquipKind[]

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

/** Nombre con cantidad: «Batería», «2 amplificadores de guitarra». */
export function quantityLabel(e: Pick<Equipment, 'kind' | 'title' | 'quantity'>): string {
  const info = kindInfo[e.kind]
  const name = e.kind === 'other' && e.title.trim() ? e.title.trim() : null
  if (name) return e.quantity > 1 ? `${e.quantity} × ${name}` : cap(name)
  return e.quantity > 1 ? `${e.quantity} ${info.many}` : cap(info.one)
}

/** Marca, referencia y formato, solo lo que se quiso dar: «Fender Hot Rod Deluxe · Combo». */
export function detailLine(e: Equipment): string {
  const parts = [
    [e.brand.trim(), e.model.trim()].filter(Boolean).join(' '),
    e.format ? formatLabel[e.format] : '',
    e.channels ? `${e.channels} canales` : '',
    e.details.trim(),
  ].filter(Boolean)
  return parts.join(' · ')
}

/** Lo que incluye el precio de la sala, en etiquetas cortas. */
export function includedChips(items: Equipment[]): string[] {
  return items.filter((e) => e.included).map(quantityLabel)
}

export type Rental = { label: string; detail: string; price: number | null; unit: ExtraUnit }

/** Lo que se alquila aparte y a qué precio. */
export function rentals(items: Equipment[]): Rental[] {
  return items.filter((e) => !e.included).map((e) => ({ label: quantityLabel(e), detail: detailLine(e), price: e.extraPrice, unit: e.extraUnit }))
}

export const unitLabel: Record<ExtraUnit, string> = { hour: 'por hora', session: 'por sesión' }

/** «4,5 × 6 m · 27 m²» (y la altura, si se dio). null si no hay medidas. */
export function dimensionsLabel(r: { widthM: number | null; lengthM: number | null; heightM: number | null }): string | null {
  const n = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
  if (!r.widthM || !r.lengthM) return null
  const area = Math.round(r.widthM * r.lengthM * 10) / 10
  return `${n(r.widthM)} × ${n(r.lengthM)} m · ${n(area)} m²${r.heightM ? ` · ${n(r.heightM)} m de alto` : ''}`
}

/** Agrupa por salas para consultarlo de una vez. */
export function byRoom(items: Equipment[]): Map<string, Equipment[]> {
  const out = new Map<string, Equipment[]>()
  for (const e of items) out.set(e.roomId, [...(out.get(e.roomId) ?? []), e])
  return out
}
