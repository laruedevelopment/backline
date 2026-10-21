import { useEffect, useState } from 'react'

export type AwakeStatus = 'on' | 'fallback' | 'off'

type WakeLockLike = { release: () => Promise<void>; addEventListener: (t: 'release', cb: () => void) => void }

/**
 * Mantiene la pantalla encendida mientras `active`. Usa la API de «Wake Lock» y, donde no existe (iPhone antiguos, algunos navegadores),
 * un video mudo en bucle generado en el momento, que es lo que impide que el teléfono apague la pantalla.
 * Devuelve el estado real para poder avisar si no fue posible. Se reintenta al volver a la pestaña y con el primer toque o tecla
 * (algunos navegadores solo lo permiten tras una acción de la persona).
 */
export function useKeepAwake(active = true): AwakeStatus {
  const [status, setStatus] = useState<AwakeStatus>('off')

  useEffect(() => {
    if (!active) return
    let lock: WakeLockLike | null = null
    let video: HTMLVideoElement | null = null
    let timer = 0
    let gone = false

    const startFallback = () => {
      if (video) return
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 16
      const ctx = canvas.getContext('2d')
      const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream?.(2)
      if (!ctx || !stream) { setStatus('off'); return }
      let n = 0
      const paint = () => { ctx.fillStyle = n++ % 2 ? '#000' : '#010101'; ctx.fillRect(0, 0, 16, 16) }
      paint()
      timer = window.setInterval(paint, 1000)
      const v = document.createElement('video')
      v.setAttribute('playsinline', '')
      v.muted = true
      v.loop = true
      v.srcObject = stream
      v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0'
      document.body.appendChild(v)
      video = v
      v.play().then(() => { if (!gone) setStatus('fallback') }).catch(() => { v.remove(); video = null; window.clearInterval(timer); if (!gone) setStatus('off') })
    }

    const request = async () => {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock
      if (wl) {
        try {
          const l = await wl.request('screen')
          if (gone) { void l.release(); return }
          lock = l
          l.addEventListener('release', () => { if (!gone && lock === l) { lock = null; setStatus(video ? 'fallback' : 'off') } })
          setStatus('on')
          return
        } catch { /* sin permiso o sin batería: se prueba el respaldo */ }
      }
      startFallback()
    }

    void request()
    const retry = () => { if (!lock && !video) void request() }
    const onVisible = () => { if (document.visibilityState === 'visible') { if (!lock) void request() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', retry)
    window.addEventListener('keydown', retry)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', retry)
      window.removeEventListener('keydown', retry)
      void lock?.release()
      window.clearInterval(timer)
      if (video) { video.pause(); video.srcObject = null; video.remove() }
    }
  }, [active])

  return active ? status : 'off'
}
