/** Compases que entiende el pre-conteo. `clicks`: clics por compás; `strong`: posiciones acentuadas (0 = el 1); `perBpm`: clics por cada «bpm». */
export type MeterId = '4/4' | '3/4' | '2/4' | '5/4' | '6/8' | '7/8' | '9/8' | '12/8'
export type MeterSpec = { id: MeterId; clicks: number; strong: number[]; perBpm: number; hint: string }

export const METERS: MeterSpec[] = [
  { id: '4/4', clicks: 4, strong: [0], perBpm: 1, hint: '4 tiempos' },
  { id: '3/4', clicks: 3, strong: [0], perBpm: 1, hint: '3 tiempos (como un vals)' },
  { id: '2/4', clicks: 2, strong: [0], perBpm: 1, hint: '2 tiempos' },
  { id: '5/4', clicks: 5, strong: [0, 3], perBpm: 1, hint: '5 tiempos, agrupados 3 + 2' },
  { id: '6/8', clicks: 6, strong: [0, 3], perBpm: 3, hint: '6 clics (1-2-3 4-5-6); el BPM es la negra con puntillo' },
  { id: '7/8', clicks: 7, strong: [0, 2, 4], perBpm: 2, hint: '7 clics agrupados 2 + 2 + 3; el BPM es la negra' },
  { id: '9/8', clicks: 9, strong: [0, 3, 6], perBpm: 3, hint: '9 clics (1-2-3 4-5-6 7-8-9); el BPM es la negra con puntillo' },
  { id: '12/8', clicks: 12, strong: [0, 3, 6, 9], perBpm: 3, hint: '12 clics en 4 grupos de 3; el BPM es la negra con puntillo' },
]

export const DEFAULT_METER: MeterId = '4/4'
export const meterSpec = (id?: string | null): MeterSpec => METERS.find((m) => m.id === id) ?? METERS[0]
export const isMeter = (v: unknown): v is MeterId => METERS.some((m) => m.id === v)
/** Segundos entre clics para un BPM dado en ese compás. */
export const clickInterval = (bpm: number, id?: string | null) => 60 / (bpm * meterSpec(id).perBpm)
/** Texto del pre-conteo: «1 compás (6 clics)». */
export const countLabel = (bars: number, id?: string | null) => `${bars} ${bars === 1 ? 'compás' : 'compases'} (${bars * meterSpec(id).clicks} clics)`
