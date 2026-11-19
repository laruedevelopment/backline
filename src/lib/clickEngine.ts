import { useSyncExternalStore } from 'react'
import { clickInterval, meterSpec, type MeterId } from './meter'

/**
 * Metrónomo compartido de toda la app (el modo escenario, las canciones del repertorio…): suena uno solo a la vez.
 * Usa Web Audio programando los clics por adelantado para no desfasarse. Puede dar un pre-conteo (1 o 2 compases) y seguir con el clic.
 */
export type ClickPhase = 'idle' | 'count' | 'click'
export type ClickState = { owner: string | null; phase: ClickPhase; beat: number; bpm: number; total: number }
export type ClickOptions = { bars?: number; meter?: MeterId | string; keep?: boolean }

const IDLE: ClickState = { owner: null, phase: 'idle', beat: 0, bpm: 0, total: 0 }
let state: ClickState = IDLE
const listeners = new Set<() => void>()
const emit = (s: ClickState) => { state = s; listeners.forEach((l) => l()) }

let ctx: AudioContext | null = null
let timer: number | undefined
let uiTimers: number[] = []
let session = 0

const clearUi = () => { uiTimers.forEach((t) => window.clearTimeout(t)); uiTimers = [] }

export function stopClick() {
  session++
  window.clearInterval(timer)
  clearUi()
  emit(IDLE)
}

/** Empieza el pre-conteo (si `bars` > 0) y, con `keep`, sigue con el clic hasta que se pare. Debe llamarse tras un toque del usuario. */
export function startClick(owner: string, bpm: number, opts: ClickOptions = {}) {
  const tempo = Math.min(300, Math.max(20, Math.round(bpm)))
  const spec = meterSpec(opts.meter)
  const perBar = spec.clicks
  const countBeats = Math.max(0, Math.round((opts.bars ?? 0) * perBar))
  const keep = opts.keep ?? false
  if (!countBeats && !keep) return
  stopClick()
  const my = ++session
  const ac = (ctx ??= new AudioContext())
  void ac.resume()
  let next = ac.currentTime + 0.08
  let n = 0
  const interval = clickInterval(tempo, spec.id)
  emit({ owner, phase: countBeats ? 'count' : 'click', beat: 0, bpm: tempo, total: countBeats })

  const schedule = () => {
    if (my !== session) return
    while (next < ac.currentTime + 0.15) {
      const inCount = n < countBeats
      const pos = n % perBar
      const main = pos === 0
      const strong = spec.strong.includes(pos)
      if (inCount || keep) {
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.frequency.value = main ? 1500 : strong ? 1250 : 1000
        gain.gain.setValueAtTime(0.0001, next)
        gain.gain.exponentialRampToValueAtTime(0.7, next + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, next + 0.06)
        osc.connect(gain).connect(ac.destination)
        osc.start(next)
        osc.stop(next + 0.07)
        const beatInBar = (n % perBar) + 1
        const idx = n
        uiTimers.push(window.setTimeout(() => {
          if (my !== session) return
          emit({ owner, phase: idx < countBeats ? 'count' : 'click', beat: beatInBar, bpm: tempo, total: countBeats })
        }, Math.max(0, (next - ac.currentTime) * 1000)))
      }
      n++
      next += interval
      // Termina el pre-conteo: sin «seguir», se acaba justo cuando la canción debe empezar (en el tiempo 1).
      if (n === countBeats && !keep) {
        uiTimers.push(window.setTimeout(() => { if (my === session) stopClick() }, Math.max(0, (next - ac.currentTime) * 1000)))
        window.clearInterval(timer)
        return
      }
    }
  }
  schedule()
  timer = window.setInterval(schedule, 25)
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
export const useClickState = () => useSyncExternalStore(subscribe, () => state, () => IDLE)

/** Estado del metrónomo para un dueño concreto (por ejemplo, una canción): idle si suena otro. */
export function useClickFor(owner: string): ClickState {
  const s = useClickState()
  return s.owner === owner ? s : IDLE
}
