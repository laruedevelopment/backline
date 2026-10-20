import { useCallback, useEffect, useRef, useState } from 'react'

/** Metrónomo con Web Audio: programa los clics por adelantado para no desfasarse. */
export function useMetronome(initialBpm = 80, beatsPerBar = 4) {
  const [bpm, setBpm] = useState(initialBpm)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(0)
  const ctx = useRef<AudioContext | null>(null)
  const bpmRef = useRef(bpm)
  const timer = useRef<number | undefined>(undefined)
  const next = useRef(0)
  const count = useRef(0)

  useEffect(() => { bpmRef.current = bpm }, [bpm])

  const stop = useCallback(() => {
    window.clearInterval(timer.current)
    setRunning(false)
    setBeat(0)
  }, [])

  const start = useCallback(() => {
    const ac = (ctx.current ??= new AudioContext())
    void ac.resume()
    count.current = 0
    next.current = ac.currentTime + 0.05
    const tick = () => {
      while (next.current < ac.currentTime + 0.15) {
        const accent = count.current % beatsPerBar === 0
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.frequency.value = accent ? 1500 : 1000
        gain.gain.setValueAtTime(0.0001, next.current)
        gain.gain.exponentialRampToValueAtTime(0.6, next.current + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, next.current + 0.06)
        osc.connect(gain).connect(ac.destination)
        osc.start(next.current)
        osc.stop(next.current + 0.07)
        const b = count.current % beatsPerBar
        window.setTimeout(() => setBeat(b + 1), Math.max(0, (next.current - ac.currentTime) * 1000))
        next.current += 60 / bpmRef.current
        count.current++
      }
    }
    tick()
    timer.current = window.setInterval(tick, 25)
    setRunning(true)
  }, [beatsPerBar])

  useEffect(() => () => {
    window.clearInterval(timer.current)
    void ctx.current?.close()
  }, [])

  return { bpm, setBpm, running, beat, toggle: () => (running ? stop() : start()), beatsPerBar }
}
