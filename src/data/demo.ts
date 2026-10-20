import type { Song } from '../lib/song'

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
  { id: '1', title: 'Come Together', artist: 'The Beatles', key: 'Dm', bpm: 82, status: 'ready', minutes: 4, tunings: [{ instrument: 'Todos', tuning: 'E estándar' }], keyChanges: [], links: {} },
  { id: '2', title: 'Seven Nation Army', artist: 'The White Stripes', key: 'Em', bpm: 124, status: 'ready', minutes: 4, tunings: [{ instrument: 'Todos', tuning: 'E estándar' }], keyChanges: [], links: {} },
  { id: '3', title: 'Smooth Operator', artist: 'Sade', key: 'Dm', bpm: 118, status: 'learning', minutes: 5, tunings: [{ instrument: 'Todos', tuning: 'E estándar' }], keyChanges: [], guest: 'Trompeta invitada', links: {} },
  { id: '4', title: 'Black Hole Sun', artist: 'Soundgarden', key: 'B', bpm: 104, status: 'ready', minutes: 5, tunings: [{ instrument: 'Guitarra', tuning: 'Drop D' }, { instrument: 'Bajo', tuning: 'E estándar' }], keyChanges: [{ section: 'Puente', from: 'B', to: 'D' }], links: {} },
  { id: '5', title: 'Wonderwall', artist: 'Oasis', key: 'F#m', bpm: 87, status: 'paused', minutes: 4, tunings: [{ instrument: 'Guitarra', tuning: 'E estándar', capo: 2 }], keyChanges: [], links: {} },
]

export const setlist = {
  name: 'Toque Bar La Esquina',
  songIds: ['2', '1', '4', '3'],
}

export const events: EventItem[] = [
  { id: 'e1', kind: 'rehearsal', title: 'Ensayo general', place: 'Sala Resonancia', date: 'Jue 22 oct', time: '7:00 pm', going: 3, total: 4 },
  { id: 'e2', kind: 'gig', title: 'Bar La Esquina', place: 'Cabecera, Bucaramanga', date: 'Sáb 31 oct', time: '9:30 pm', going: 2, total: 4 },
]
