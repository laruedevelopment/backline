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
    id: 'bat-1-rebote', instrument: 'bateria', level: 1, title: 'Rebote y control de baquetas', minutes: 6,
    goal: 'Que cada golpe rebote solo y suene parejo con las dos manos.',
    bpm: { start: 50, goal: 90 },
    steps: [
      'Siéntate con la espalda recta y las baquetas agarradas entre el pulgar y el índice, sin apretar: el resto de los dedos solo acompaña.',
      'Golpea la caja con la mano derecha y deja que la baqueta rebote sola; no la empujes hacia abajo.',
      'Alterna derecha-izquierda, un golpe por clic del metrónomo. Que los dos golpes suenen igual de fuerte.',
      'Sube 5 bpm cuando salgan 16 golpes seguidos parejos, sin tensión en los hombros.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Mano derecha', hits: [0, 2, 4, 6] },
      { name: 'Mano izquierda', hits: [1, 3, 5, 7] },
    ] },
  },
  {
    id: 'bat-1-pulso', instrument: 'bateria', level: 1, title: 'Hi-hat a negras, bombo y caja', minutes: 6,
    goal: 'Tu primer ritmo completo, con el hi-hat marcando solo el pulso.',
    bpm: { start: 60, goal: 100 },
    steps: [
      'Hi-hat con la derecha en cada clic (1, 2, 3, 4).',
      'Suma la caja con la izquierda en los tiempos 2 y 4.',
      'Suma el bombo en los tiempos 1 y 3. Los tres suenan a la vez en el 1 y en el 3 (hi-hat y bombo) y en el 2 y el 4 (hi-hat y caja).',
      'Cuando salga limpio 8 compases seguidos, pasa al ritmo básico de rock con corcheas.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Hi-hat', hits: [0, 2, 4, 6] },
      { name: 'Caja', hits: [2, 6] },
      { name: 'Bombo', hits: [0, 4] },
    ] },
  },
  {
    id: 'bat-1-relleno', instrument: 'bateria', level: 1, title: 'Primer relleno en los toms', minutes: 8,
    goal: 'Cerrar una frase con un relleno de cuatro golpes y volver al ritmo sin perder el tiempo.',
    bpm: { start: 60, goal: 100 },
    steps: [
      'Toca un compás de ritmo básico de rock.',
      'En el segundo compás, en los tiempos 1 y 2 sigue el ritmo; en el 3 y el 4 toca el relleno: caja, tom agudo, tom grave, tom de piso (uno por clic).',
      'Vuelve al ritmo con un golpe de platillo y bombo en el 1 del siguiente compás.',
      'Cuenta en voz alta. Si te pierdes, baja 10 bpm: el relleno debe caer exacto en el 1.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Caja', hits: [4] },
      { name: 'Tom agudo', hits: [5] },
      { name: 'Tom grave', hits: [6] },
      { name: 'Tom de piso', hits: [7] },
    ] },
  },
  {
    id: 'bat-2-semicorcheas', instrument: 'bateria', level: 2, title: 'Hi-hat en semicorcheas', minutes: 10,
    goal: 'Mantener el hi-hat a cuatro golpes por tiempo mientras bombo y caja marcan el groove.',
    bpm: { start: 55, goal: 95 },
    steps: [
      'Cuenta "1 e y a, 2 e y a, 3 e y a, 4 e y a" y toca el hi-hat en cada sílaba, alternando derecha-izquierda o con solo la derecha si te sale mejor.',
      'Añade la caja en el 2 y el 4, y el bombo en el 1 y en el "y" del 3.',
      'Acentúa un poco el hi-hat en cada tiempo (1, 2, 3, 4) para que el pulso se oiga.',
      'Sube de 5 en 5 solo si sientes la mano relajada; si se tensa, baja el tempo.',
    ],
    diagram: { kind: 'drums', steps: 16, rows: [
      { name: 'Hi-hat', hits: row(16) },
      { name: 'Caja', hits: [4, 12] },
      { name: 'Bombo', hits: [0, 10] },
    ] },
  },
  {
    id: 'bat-2-paradiddle', instrument: 'bateria', level: 2, title: 'Paradiddle (D I D D  I D I I)', minutes: 8,
    goal: 'Dominar el rudimento base de la independencia entre manos.',
    bpm: { start: 60, goal: 120 },
    steps: [
      'Practica sobre la caja o un pad: derecha, izquierda, derecha, derecha; luego izquierda, derecha, izquierda, izquierda.',
      'Un golpe por clic. Acentúa el primero de cada grupo de cuatro.',
      'Cuando suene parejo, pasa el patrón a los toms: el primer golpe de cada grupo va a un tom distinto.',
      'Sube el tempo despacio; si el acento se pierde, baja 10 bpm.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Mano derecha', hits: [0, 2, 3, 5] },
      { name: 'Mano izquierda', hits: [1, 4, 6, 7] },
    ] },
  },
  {
    id: 'bat-2-fantasma', instrument: 'bateria', level: 2, title: 'Notas fantasma en la caja', minutes: 10,
    goal: 'Dar groove con golpes suaves entre los golpes fuertes de la caja.',
    bpm: { start: 60, goal: 95 },
    steps: [
      'Hi-hat en semicorcheas constante y caja fuerte en 2 y 4; bombo en 1 y en el "y" del 3.',
      'Añade golpes muy suaves en la caja (casi sin levantar la baqueta) en las posiciones marcadas como «Caja suave».',
      'Los fantasmas deben oírse apenas: la diferencia con el golpe fuerte es lo que da el groove.',
      'Graba un minuto con el teléfono y escucha: el golpe fuerte debe destacar claramente.',
    ],
    diagram: { kind: 'drums', steps: 16, rows: [
      { name: 'Hi-hat', hits: row(16) },
      { name: 'Caja', hits: [4, 12] },
      { name: 'Caja suave', hits: [2, 7, 10, 15] },
      { name: 'Bombo', hits: [0, 10] },
    ] },
  },
  {
    id: 'bat-2-relleno16', instrument: 'bateria', level: 2, title: 'Relleno de semicorcheas en los toms', minutes: 10,
    goal: 'Hacer un relleno de un compás que baja por los toms y cae justo en el 1.',
    bpm: { start: 60, goal: 110 },
    steps: [
      'Cuenta un compás de semicorcheas: "1 e y a, 2 e y a, 3 e y a, 4 e y a".',
      'Primer tiempo: caja (4 golpes alternando D-I-D-I). Segundo: tom agudo. Tercero: tom grave. Cuarto: tom de piso.',
      'Cierra con platillo y bombo juntos en el 1 del siguiente compás.',
      'Practícalo entre dos compases de ritmo base para que el cambio sea fluido.',
    ],
    diagram: { kind: 'drums', steps: 16, rows: [
      { name: 'Caja', hits: [0, 1, 2, 3] },
      { name: 'Tom agudo', hits: [4, 5, 6, 7] },
      { name: 'Tom grave', hits: [8, 9, 10, 11] },
      { name: 'Tom de piso', hits: [12, 13, 14, 15] },
    ] },
  },
  {
    id: 'bat-3-doble', instrument: 'bateria', level: 3, title: 'Doble bombo con un solo pie', minutes: 12,
    goal: 'Dar dos golpes seguidos de bombo con el mismo pie, rápido y parejo.',
    bpm: { start: 70, goal: 130 },
    steps: [
      'Practica primero a tempo bajo: un golpe con el talón apoyado, y el siguiente soltando el pie hacia adelante (método talón-punta).',
      'Dos golpes por clic (corcheas) hasta que los dos suenen igual.',
      'Pasa a patrones de 4 golpes: dos seguidos en el 1 y dos seguidos en el 3, con caja en 2 y 4.',
      'Sube de 5 en 5 y para al primer signo de cansancio: la técnica se hace con repetición corta y limpia.',
    ],
    diagram: { kind: 'drums', steps: 16, rows: [
      { name: 'Caja', hits: [4, 12] },
      { name: 'Bombo', hits: [0, 1, 8, 9] },
    ] },
  },
  {
    id: 'bat-3-blast', instrument: 'bateria', level: 3, title: 'Blast beat básico', minutes: 12,
    goal: 'Tocar el ritmo rápido típico del metal con bombo, caja y platillo a la vez.',
    bpm: { start: 100, goal: 180 },
    steps: [
      'Primero a tempo muy lento: bombo y platillo juntos en los tiempos fuertes, caja y platillo juntos en los débiles.',
      'Un golpe de pie y uno de mano por clic; busca que bombo y caja se alternen sin que se arrastren.',
      'Respira y mantén los hombros sueltos: si te tensas, baja el tempo.',
      'Súbelo de 10 en 10 bpm y para antes de cansarte; es un ejercicio de resistencia.',
    ],
    diagram: { kind: 'drums', steps: 8, rows: [
      { name: 'Platillo', hits: row(8) },
      { name: 'Caja', hits: [1, 3, 5, 7] },
      { name: 'Bombo', hits: [0, 2, 4, 6] },
    ] },
  },
  {
    id: 'bat-3-resistencia', instrument: 'bateria', level: 3, title: 'Resistencia: cinco minutos de semicorcheas', minutes: 5,
    goal: 'Sostener un tempo constante y relajado sin que se te cansen los antebrazos.',
    bpm: { start: 80, goal: 120 },
    steps: [
      'Toca semicorcheas en el pad o la caja, alternando manos, sin acentos, durante 5 minutos seguidos.',
      'Revisa cada minuto: hombros bajos, agarre suelto, rebote parejo.',
      'Si tu tempo se acelera o se arrastra, escúchalo con el metrónomo y corrígelo sin parar.',
      'Anota tu mejor tempo: cuando lo sostengas los 5 minutos, súbelo 5 bpm.',
    ],
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
