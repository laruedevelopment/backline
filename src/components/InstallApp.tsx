import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Instalar Backline como app: botón en Android/Chrome/Edge; instrucciones en iPhone (Safari no tiene botón). */
export default function InstallApp() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(standalone())

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent) }
    const onInstalled = () => { setInstalled(true); setEvent(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  if (installed) return null
  if (!event && !isIos()) return null

  return (
    <>
      <div className="section-title">Instalar la app</div>
      {event ? (
        <>
          <p className="li-sub wrap">Ábrela como una app desde tu pantalla de inicio, a pantalla completa y con avisos.</p>
          <button className="btn primary" style={{ marginTop: 8 }} onClick={() => { void event.prompt(); setEvent(null) }}>Instalar Backline</button>
        </>
      ) : (
        <p className="notice">En iPhone: toca <b>Compartir</b> en Safari y luego <b>Agregar a pantalla de inicio</b>. Así se abre como app y puedes activar los avisos.</p>
      )}
    </>
  )
}
