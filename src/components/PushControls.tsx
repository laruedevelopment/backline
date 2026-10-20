import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { disablePush, enablePush, pushConfigured, pushState } from '../lib/push'

function usePush() {
  const qc = useQueryClient()
  const { data: state } = useQuery({ queryKey: ['push-state'], queryFn: pushState, enabled: pushConfigured, staleTime: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try { await fn() } catch { setError('No pudimos activar los avisos. Intenta de nuevo.') }
    await qc.invalidateQueries({ queryKey: ['push-state'] })
    setBusy(false)
  }
  return { state, busy, error, enable: () => run(enablePush), disable: () => run(disablePush) }
}

/** Ajuste completo (en Perfil): estado, activar y desactivar en este dispositivo. */
export function PushSettings() {
  const { state, busy, error, enable, disable } = usePush()
  if (!pushConfigured || !state) return null
  return (
    <>
      <div className="section-title">Avisos en este dispositivo</div>
      {state === 'unsupported' && <p className="li-sub wrap">Este navegador no permite notificaciones. Prueba desde Chrome en Android o desde la app instalada.</p>}
      {state === 'needs-install' && <p className="li-sub wrap">En iPhone los avisos funcionan cuando instalas Backline: abre el menú Compartir de Safari y elige «Agregar a pantalla de inicio». Luego ábrela desde ahí y vuelve aquí.</p>}
      {state === 'denied' && <p className="li-sub wrap">Bloqueaste las notificaciones de Backline. Para recibirlas, actívalas en los ajustes del sitio de tu navegador.</p>}
      {state === 'off' && (
        <div className="stack">
          <p className="li-sub wrap">Entérate al instante cuando llegue una solicitud de reserva, te la confirmen o la cancelen. Sin depender del chat.</p>
          <button className="btn primary" disabled={busy} onClick={() => void enable()}>{busy ? 'Activando…' : 'Activar avisos'}</button>
        </div>
      )}
      {state === 'on' && (
        <div className="stack">
          <p className="form-ok">Los avisos están activados en este dispositivo.</p>
          <button className="btn" disabled={busy} onClick={() => void disable()}>Desactivar</button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  )
}

/** Invitación breve para quien está esperando reservas o respuestas. Desaparece al activar. */
export function PushPrompt({ text }: { text: string }) {
  const { state, busy, error, enable } = usePush()
  if (!pushConfigured || (state !== 'off' && state !== 'needs-install')) return null
  return (
    <div className="notice" style={{ marginTop: 14 }}>
      {state === 'needs-install'
        ? <>Para recibir avisos en iPhone, instala Backline: Compartir → «Agregar a pantalla de inicio».</>
        : (
          <>
            {text}{' '}
            <button className="link-btn" style={{ minHeight: 32, padding: 0 }} disabled={busy} onClick={() => void enable()}>{busy ? 'Activando…' : 'Activar avisos'}</button>
          </>
        )}
      {error && <span className="form-error" role="alert"> {error}</span>}
    </div>
  )
}
