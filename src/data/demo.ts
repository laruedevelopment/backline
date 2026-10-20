export type Song = {
  id: string
  title: string
  artist: string
  key: string
  bpm: number
  tuning: string
  status: 'ready' | 'learning' | 'paused'
  minutes: number
  keyChange?: string
  guest?: string
}

export type EventItem = {
  id: string
  kind: 'gig' | 'rehearsal'
  title: string
  place: string
  date: string
  time: string
  going: number
  total: number
}

export const band = {
  name: 'Los Dedos de Hielo',
  genres: ['Rock', 'Funk'],
  city: 'Bucaramanga',
  members: [
    { name: 'Javier', role: 'Guitarra' },
    { name: 'Sebas', role: 'Bajo' },
    { name: 'Dani', role: 'Batería' },
    { name: 'Mafe', role: 'Voz' },
  ],
}

export const songs: Song[] = [
  { id: '1', title: 'Come Together', artist: 'The Beatles', key: 'Dm', bpm: 82, tuning: 'E estándar', status: 'ready', minutes: 4 },
  { id: '2', title: 'Seven Nation Army', artist: 'The White Stripes', key: 'Em', bpm: 124, tuning: 'E estándar', status: 'ready', minutes: 4 },
  { id: '3', title: 'Smooth Operator', artist: 'Sade', key: 'Dm', bpm: 118, tuning: 'E estándar', status: 'learning', minutes: 5, guest: 'Trompeta invitada' },
  { id: '4', title: 'Black Hole Sun', artist: 'Soundgarden', key: 'B', bpm: 104, tuning: 'Drop D', status: 'ready', minutes: 5, keyChange: 'B → D en el puente' },
  { id: '5', title: 'Wonderwall', artist: 'Oasis', key: 'F#m', bpm: 87, tuning: 'E estándar · capo 2', status: 'paused', minutes: 4 },
]

export const setlist = {
  name: 'Toque Bar La Esquina',
  songIds: ['2', '1', '4', '3'],
}

export const events: EventItem[] = [
  { id: 'e1', kind: 'rehearsal', title: 'Ensayo general', place: 'Sala Resonancia', date: 'Jue 22 oct', time: '7:00 pm', going: 3, total: 4 },
  { id: 'e2', kind: 'gig', title: 'Bar La Esquina', place: 'Cabecera, Bucaramanga', date: 'Sáb 31 oct', time: '9:30 pm', going: 2, total: 4 },
]
