export type InstrumentId = 'guitarra' | 'bajo' | 'bateria' | 'piano'

/** Casilla de diapasón: cuerda 1 = la más aguda (guitarra) / G (bajo). */
export type FretDot = { string: number; fret: number; label?: string }
export type Diagram =
  | { kind: 'fretboard'; strings: 4 | 6; frets: number; dots: FretDot[] }
  | { kind: 'drums'; steps: number; rows: { name: string; hits: number[] }[] }
  | { kind: 'keys'; octaves: 1 | 2; highlight: string[] }

export type Lesson = {
  id: string
  instrument: InstrumentId
  level: 1 | 2 | 3
  title: string
  minutes: number
  goal: string
  steps: string[]
  diagram?: Diagram
  /** BPM sugerido de partida y meta. */
  bpm: { start: number; goal: number }
}

export const instruments: { id: InstrumentId; name: string }[] = [
  { id: 'guitarra', name: 'Guitarra' },
  { id: 'bajo', name: 'Bajo' },
  { id: 'bateria', name: 'Batería' },
  { id: 'piano', name: 'Piano' },
]

export const levelName = { 1: 'Primeros pasos', 2: 'Intermedio', 3: 'Avanzado' } as const

const row = (n: number) => Array.from({ length: n }, (_, i) => i)

export const lessons: Lesson[] = [
  {
    id: 'gtr-1-spider', instrument: 'guitarra', level: 1, title: 'Araña cromática 1-2-3-4', minutes: 5,
    goal: 'Coordinar los cuatro dedos de la mano izquierda y la púa alternada.',
    bpm: { start: 60, goal: 100 },
    steps: [
      'Pon el dedo 1 en el traste 1, el 2 en el 2, el 3 en el 3 y el 4 en el 4 de la sexta cuerda.',
      'Toca cada nota con púa alternada (abajo-arriba), una por clic del metrónomo.',
      'Al terminar la cuerda, pasa a la siguiente y sigue el mismo patrón.',
      'Mantén los dedos cerca del traste, sin apretar de más. Sube 5 bpm solo cuando salga limpio 3 veces seguidas.',
    ],
    diagram: { kind: 'fretboard', strings: 6, frets: 5, dots: [
      { string: 6, fret: 1, label: '1' }, { string: 6, fret: 2, label: '2' }, { string: 6, fret: 3, label: '3' }, { string: 6, fret: 4, label: '4' },
      { string: 5, fret: 1, label: '1' }, { string: 5, fret: 2, label: '2' }, { string: 5, fret: 3, label: '3' }, { string: 5, fret: 4, label: '4' },
    ] },
  },
  {
    id: 'gtr-1-em', instrument: 'guitarra', level: 1, title: 'Acordes Em y Am', minutes: 8,
    goal: 'Armar dos acordes abiertos y cambiar entre ellos sin parar el ritmo.',
    bpm: { start: 50, goal: 90 },
    steps: [
      'Em: dedos 2 y 3 en el traste 2 de las cuerdas 5 y 4. Rasguea las seis cuerdas.',
      'Am: dedo 1 en el traste 1 de la cuerda 2, y dedos 2 y 3 en el traste 2 de las cuerdas 4 y 3.',
      'Cambia Em → Am cada 4 clics del metrónomo. Rasgueo: abajo, abajo, arriba.',
      'Cuando salga sin pausas, acorta a 2 clics por acorde.',
    ],
    diagram: { kind: 'fretboard', strings: 6, frets: 4, dots: [
      { string: 5, fret: 2, label: '2' }, { string: 4, fret: 2, label: '3' },
      { string: 2, fret: 1, label: '1' }, { string: 3, fret: 2, label: '3' },
    ] },
  },
  {
    id: 'gtr-2-penta', instrument: 'guitarra', level: 2, title: 'Pentatónica menor de La', minutes: 10,
    goal: 'Tener la forma 1 de la escala pentatónica para improvisar rock y blues.',
    bpm: { start: 70, goal: 120 },
    steps: [
      'Ubica la raíz: traste 5 de la sexta cuerda (La).',
      'Sube y baja la forma tocando dos notas por cuerda.',
      'Hazlo en corcheas con púa alternada, una nota por medio clic.',
      'Improvisa 4 compases sobre una base de La menor usando solo estas notas.',
    ],
    diagram: { kind: 'fretboard', strings: 6, frets: 8, dots: [
      { string: 6, fret: 5, label: 'R' }, { string: 6, fret: 8 }, { string: 5, fret: 5 }, { string: 5, fret: 7 },
      { string: 4, fret: 5 }, { string: 4, fret: 7 }, { string: 3, fret: 5 }, { string: 3, fret: 7 },
      { string: 2, fret: 5 }, { string: 2, fret: 8 }, { string: 1, fret: 5, label: 'R' }, { string: 1, fret: 8 },
    ] },
  },
  {
    id: 'bajo-1-raiz', instrument: 'bajo', level: 1, title: 'Notas raíz con el metrónomo', minutes: 5,
    goal: 'Sonar firme y a tiempo: la base de todo bajista.',
    bpm: { start: 60, goal: 100 },
    steps: [
      'Toca la nota Mi (cuerda 4 al aire) una vez por clic, alternando índice y medio.',
      'Apoya el pulgar en la pastilla y silencia las cuerdas que no tocas.',
      'Cambia a La, Re y Sol (cuerdas al aire) cada 4 clics.',
      'Cierra los ojos 8 compases: si te sigues oyendo con el clic, vas bien.',
    ],
    diagram: { kind: 'fretboard', strings: 4, frets: 5, dots: [
      { string: 4, fret: 0, label: 'E' }, { string: 3, fret: 0, label: 'A' }, { string: 2, fret: 0, label: 'D' }, { string: 1, fret: 0, label: 'G' },
    ] },
  },
  {
    id: 'bajo-1-octava', instrument: 'bajo', level: 1, title: 'Patrón raíz-octava', minutes: 8,
    goal: 'Tu primer groove de disco/funk: raíz y octava.',
    bpm: { start: 70, goal: 110 },
    steps: [
      'Raíz en la cuerda 4, traste 3 (Sol). La octava está en la cuerda 2, traste 5.',
      'Toca raíz, octava, raíz, octava en corcheas.',
      'Deja que la nota suene corta y pareja, sin arrastrar.',
      'Repite sobre Do (cuerda 3 traste 3 y cuerda 1 traste 5).',
    ],
    diagram: { kind: 'fretboard', strings: 4, frets: 6, dots: [
      { string: 4, fret: 3, label: 'R' }, { string: 2, fret: 5, label: '8va' }, { string: 3, fret: 3, label: 'R' }, { string: 1, fret: 5, label: '8va' },
    ] },
  },
  {
    id: 'bat-1-rock', instrument: 'bateria', level: 1, title: 'Ritmo básico de rock', minutes: 8,
    goal: 'Hi-hat, bombo y caja en un patrón de 8 pulsos.',
    bpm: { start: 60, goal: 110 },
    steps: [
      'Hi-hat en todas las corcheas (1 y 2 y 3 y 4 y).',
      'Bombo en los tiempos 1 y 3; caja en los tiempos 2 y 4.',
      'Empieza lento y suma una extremidad a la vez: primero hi-hat solo, luego con la caja, luego con el bombo.',
      'Sube de 5 en 5 bpm cuando lo tengas limpio 4 compases seguidos.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Hi-hat', hits: row(8) },
      { name: 'Caja', hits: [2, 6] },
      { name: 'Bombo', hits: [0, 4] },
    ] },
  },
  {
    id: 'bat-2-funk', instrument: 'bateria', level: 2, title: 'Groove funk con bombo sincopado', minutes: 10,
    goal: 'Separar el bombo del hi-hat y sentir la síncopa.',
    bpm: { start: 70, goal: 100 },
    steps: [
      'Mantén el hi-hat constante en corcheas, sin acentuar.',
      'Caja en 2 y 4. Bombo en 1, en el "y" del 2 y en el 3.',
      'Cuenta en voz alta "1 y 2 y 3 y 4 y" hasta que el bombo caiga solo.',
      'Añade una nota fantasma suave en la caja antes del 4.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Hi-hat', hits: row(8) },
      { name: 'Caja', hits: [2, 6] },
      { name: 'Bombo', hits: [0, 3, 4] },
    ] },
  },
  {
    id: 'pno-1-do', instrument: 'piano', level: 1, title: 'Escala de Do mayor, mano derecha', minutes: 6,
    goal: 'Ubicar las notas y pasar el pulgar por debajo con fluidez.',
    bpm: { start: 50, goal: 90 },
    steps: [
      'Pulgar en Do. Toca Do-Re-Mi con los dedos 1-2-3.',
      'Pasa el pulgar por debajo del 3 para tocar Fa y sigue hasta el Do de arriba (dedos 1-2-3-1-2-3-4-5).',
      'Baja con el mismo orden al revés.',
      'Una nota por clic. Que el pulgar pase sin que la mano se mueva a saltos.',
    ],
    diagram: { kind: 'keys', octaves: 1, highlight: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  },
  {
    id: 'pno-1-triadas', instrument: 'piano', level: 1, title: 'Tríadas de Do, Fa y Sol', minutes: 8,
    goal: 'Los tres acordes con los que suenan miles de canciones.',
    bpm: { start: 50, goal: 90 },
    steps: [
      'Do mayor: Do-Mi-Sol (dedos 1-3-5).',
      'Fa mayor: Fa-La-Do. Sol mayor: Sol-Si-Re.',
      'Toca cada acorde 4 clics: Do, Fa, Sol, Do.',
      'Con la izquierda añade la nota más grave de cada acorde.',
    ],
    diagram: { kind: 'keys', octaves: 1, highlight: ['C', 'E', 'G'] },
  },
]
