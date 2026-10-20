// Ciudades para el selector (evita errores de escritura y duplicados como «bga», «Bucaramanga » o «bucaramanga»).
// Se guarda solo el nombre canónico. Lo que no esté en la lista se puede escribir igual, pero normalizado.
export const CITIES: { name: string; area: string }[] = [
  ['Bogotá', 'Bogotá D.C.'], ['Medellín', 'Antioquia'], ['Cali', 'Valle del Cauca'], ['Barranquilla', 'Atlántico'],
  ['Cartagena', 'Bolívar'], ['Bucaramanga', 'Santander'], ['Cúcuta', 'Norte de Santander'], ['Pereira', 'Risaralda'],
  ['Manizales', 'Caldas'], ['Santa Marta', 'Magdalena'], ['Ibagué', 'Tolima'], ['Villavicencio', 'Meta'],
  ['Pasto', 'Nariño'], ['Montería', 'Córdoba'], ['Neiva', 'Huila'], ['Armenia', 'Quindío'],
  ['Popayán', 'Cauca'], ['Valledupar', 'Cesar'], ['Sincelejo', 'Sucre'], ['Tunja', 'Boyacá'],
  ['Florencia', 'Caquetá'], ['Riohacha', 'La Guajira'], ['Quibdó', 'Chocó'], ['Yopal', 'Casanare'],
  ['Arauca', 'Arauca'], ['Mocoa', 'Putumayo'], ['San Andrés', 'San Andrés y Providencia'], ['Leticia', 'Amazonas'],
  ['Floridablanca', 'Santander'], ['Girón', 'Santander'], ['Piedecuesta', 'Santander'], ['San Gil', 'Santander'],
  ['Barrancabermeja', 'Santander'], ['Socorro', 'Santander'], ['Málaga', 'Santander'], ['Barichara', 'Santander'],
  ['Soacha', 'Cundinamarca'], ['Chía', 'Cundinamarca'], ['Zipaquirá', 'Cundinamarca'], ['Facatativá', 'Cundinamarca'],
  ['Fusagasugá', 'Cundinamarca'], ['Girardot', 'Cundinamarca'], ['Cajicá', 'Cundinamarca'], ['Mosquera', 'Cundinamarca'],
  ['Envigado', 'Antioquia'], ['Bello', 'Antioquia'], ['Itagüí', 'Antioquia'], ['Sabaneta', 'Antioquia'],
  ['Rionegro', 'Antioquia'], ['Apartadó', 'Antioquia'], ['Turbo', 'Antioquia'], ['La Ceja', 'Antioquia'],
  ['Palmira', 'Valle del Cauca'], ['Buenaventura', 'Valle del Cauca'], ['Tuluá', 'Valle del Cauca'], ['Buga', 'Valle del Cauca'],
  ['Cartago', 'Valle del Cauca'], ['Jamundí', 'Valle del Cauca'], ['Yumbo', 'Valle del Cauca'],
  ['Soledad', 'Atlántico'], ['Malambo', 'Atlántico'], ['Ciénaga', 'Magdalena'], ['Maicao', 'La Guajira'],
  ['Dosquebradas', 'Risaralda'], ['Santa Rosa de Cabal', 'Risaralda'], ['Chinchiná', 'Caldas'], ['Calarcá', 'Quindío'],
  ['Montenegro', 'Quindío'], ['Salento', 'Quindío'], ['Duitama', 'Boyacá'], ['Sogamoso', 'Boyacá'],
  ['Villa de Leyva', 'Boyacá'], ['Ocaña', 'Norte de Santander'], ['Pamplona', 'Norte de Santander'], ['Villa del Rosario', 'Norte de Santander'],
  ['Tumaco', 'Nariño'], ['Ipiales', 'Nariño'], ['Pitalito', 'Huila'], ['Garzón', 'Huila'],
  ['Espinal', 'Tolima'], ['Honda', 'Tolima'], ['Acacías', 'Meta'], ['Granada', 'Meta'],
  ['Sahagún', 'Córdoba'], ['Lorica', 'Córdoba'], ['Magangué', 'Bolívar'], ['Turbaco', 'Bolívar'],
  ['Aguachica', 'Cesar'], ['Santander de Quilichao', 'Cauca'], ['Tame', 'Arauca'],
].map(([name, area]) => ({ name, area }))

/** Minúsculas, sin tildes ni signos, espacios simples. */
export const normCity = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

const ALIASES: Record<string, string> = { bga: 'Bucaramanga', bogota: 'Bogotá', 'bogota dc': 'Bogotá', mde: 'Medellín', bq: 'Barranquilla', ctg: 'Cartagena' }

const byNorm = new Map(CITIES.map((c) => [normCity(c.name), c.name]))

/** Nombre canónico si coincide (sin tildes ni mayúsculas) con una ciudad de la lista; si no, el texto limpio con mayúscula inicial por palabra. */
export function canonicalCity(raw: string): string {
  const n = normCity(raw)
  if (!n) return ''
  const hit = byNorm.get(n) ?? ALIASES[n]
  if (hit) return hit
  return raw.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
}

/** Sugerencias: primero las que empiezan por lo escrito, luego las que lo contienen. */
export function suggestCities(query: string, limit = 7) {
  const n = normCity(query)
  if (!n) return CITIES.slice(0, limit)
  const starts: typeof CITIES = [], has: typeof CITIES = []
  for (const c of CITIES) {
    const cn = normCity(c.name)
    if (cn.startsWith(n)) starts.push(c)
    else if (cn.includes(n)) has.push(c)
  }
  return [...starts, ...has].slice(0, limit)
}
