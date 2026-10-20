/** Iniciales para el monograma de una banda ("Los Dedos de Hielo" → "LD") o de una persona ("Javier Rueda" → "JR"). */
export function initials(name: string, max = 2): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
  const letters = (words.length ? words : name.trim().split(/\s+/)).map((w) => w[0]?.toUpperCase() ?? '')
  return letters.slice(0, max).join('') || '?'
}

export const instrumentOptions = ['Guitarra', 'Bajo', 'Batería', 'Voz', 'Teclado / piano', 'Percusión', 'Vientos', 'Cuerdas', 'DJ / producción', 'Otro']
export const genreOptions = ['Rock', 'Pop', 'Funk', 'Jazz', 'Blues', 'Metal', 'Punk', 'Salsa', 'Vallenato', 'Reggae', 'Indie', 'Electrónica', 'Folk', 'Hip hop', 'Cumbia']

export const amenityOptions = [
  'Batería completa', 'Amplificador de guitarra', 'Amplificador de bajo', 'Micrófonos', 'Consola y parlantes (PA)', 'Teclado',
  'Aire acondicionado', 'Parqueadero', 'Zona de espera', 'Tienda de cuerdas y accesorios', 'Grabación', 'Nevera',
]

/** Enlace de WhatsApp desde un número colombiano ("300 123 4567" o "+57 300…"). undefined si no parece un número. */
export function waLink(raw: string, text?: string): string | undefined {
  const digits = raw.replace(/\D/g, '')
  const full = digits.length === 10 ? `57${digits}` : digits
  if (full.length < 11 || full.length > 15) return undefined
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
