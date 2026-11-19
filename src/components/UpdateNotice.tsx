import { useEffect, useState } from 'react'

/**
 * Avisa cuando hay una versión nueva de Backline. El service worker se actualiza solo, pero la pantalla abierta sigue con el código
 * viejo hasta recargar: aquí se busca la actualización cada vez que vuelves a la app y se ofrece recargar (sin perder lo que escribías).
 */
export default function UpdateNotice() {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const hadController = !!navigator.serviceWorker.controller
    const onChange = () => { if (hadController) setFresh(true) }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    const check = () => { if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {}) }
    document.addEventListener('visibilitychange', check)
    check()
    return () => { navigator.serviceWorker.removeEventListener('controllerchange', onChange); document.removeEventListener('visibilitychange', check) }
  }, [])
  if (!fresh) return null
  return (
    <div className="offline" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderLeftColor: 'var(--amber)' }}>
      <span style={{ flex: '1 1 180px' }}>Hay una versión nueva de Backline.</span>
      <button className="btn primary sm" onClick={() => window.location.reload()}>Actualizar</button>
    </div>
  )
}
