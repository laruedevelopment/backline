import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}

/** Aviso cuando no hay señal: se ve lo último guardado, pero los cambios no se envían. */
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return (
    <div className="offline" role="status">
      Sin conexión. Ves lo último que se guardó; el modo escenario sigue funcionando. Los cambios se podrán guardar cuando vuelva la señal.
    </div>
  )
}
