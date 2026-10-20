/** Iniciales para el monograma de una banda ("Los Dedos de Hielo" → "LD") o de una persona ("Javier Rueda" → "JR"). */
export function initials(name: string, max = 2): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
  const letters = (words.length ? words : name.trim().split(/\s+/)).map((w) => w[0]?.toUpperCase() ?? '')
  return letters.slice(0, max).join('') || '?'
}

export const instrumentOptions = ['Guitarra', 'Bajo', 'Batería', 'Voz', 'Teclado / piano', 'Percusión', 'Vientos', 'Cuerdas', 'DJ / producción', 'Otro']
export const genreOptions = ['Rock', 'Pop', 'Funk', 'Jazz', 'Blues', 'Metal', 'Punk', 'Salsa', 'Vallenato', 'Reggae', 'Indie', 'Electrónica', 'Folk', 'Hip hop', 'Cumbia']
