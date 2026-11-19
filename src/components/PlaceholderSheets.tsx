import { useState } from 'react'
import { addPlaceholder, deletePlaceholder, reassignMember, updatePlaceholder, type Member, type Placeholder } from '../lib/api'
import { ask } from '../lib/confirm'
import { instrumentOptions } from '../lib/identity'
import { useRefreshRoster } from '../lib/useRoster'
import Sheet from './Sheet'

const summary = (r: { canciones: number; anotaciones: number; equipo: number }) => {
  const parts = [r.canciones && `${r.canciones} ${r.canciones === 1 ? 'canción' : 'canciones'}`, r.anotaciones && `${r.anotaciones} ${r.anotaciones === 1 ? 'anotación' : 'anotaciones'}`, r.equipo && `${r.equipo} de equipo`].filter(Boolean)
  return parts.length ? `Se pasó: ${parts.join(', ')}.` : 'No había nada asignado que pasar.'
}

/** Agregar a alguien de la banda que todavía no usa Backline. */
export function AddPlaceholderSheet({ bandId, onClose }: { bandId: string; onClose: () => void }) {
  const refresh = useRefreshRoster(bandId)
  const [name, setName] = useState('')
  const [instrument, setInstrument] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || name.trim().length < 2) return
    setBusy(true); setError('')
    try { await addPlaceholder(bandId, name, instrument); await refresh(); onClose() } catch (x) {
      setError(/demasiados/i.test(String((x as Error).message)) ? 'Esta banda ya tiene el máximo de integrantes sin cuenta (12).' : 'No pudimos agregarlo. Intenta de nuevo.')
      setBusy(false)
    }
  }
  return (
    <Sheet title="Integrante sin cuenta" onClose={onClose} onSubmit={submit}>
      <p className="li-sub wrap">Para alguien de la banda que todavía no usa Backline. Ya puedes asignarle canciones, anotaciones y equipo; cuando cree su cuenta, lo enlazas y todo pasa a él.</p>
      <label className="field">Nombre
        <input value={name} maxLength={40} placeholder="Camilo" autoFocus onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="field">Instrumento
        <input list="ph-instruments" value={instrument} maxLength={40} placeholder="Bajo" onChange={(e) => setInstrument(e.target.value)} />
        <datalist id="ph-instruments">{instrumentOptions.map((i) => <option key={i} value={i} />)}</datalist>
      </label>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy || name.trim().length < 2}>{busy ? 'Guardando…' : 'Agregar'}</button>
      </div>
    </Sheet>
  )
}

/** Ver y administrar a un integrante sin cuenta: editar, enlazar con la cuenta de alguien que ya entró, o quitar. */
export function PlaceholderSheet({ bandId, placeholder, accounts, canManage, onClose }: { bandId: string; placeholder: Placeholder; accounts: Member[]; canManage: boolean; onClose: () => void }) {
  const refresh = useRefreshRoster(bandId)
  const [name, setName] = useState(placeholder.name)
  const [instrument, setInstrument] = useState(placeholder.instrument ?? '')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<unknown>, close = false) => {
    setBusy(true); setError(''); setMsg('')
    try { await fn(); await refresh(); if (close) onClose() } catch { setError('No pudimos aplicar el cambio. Intenta de nuevo.') }
    setBusy(false)
  }
  const to = accounts.find((m) => m.profileId === target)

  return (
    <Sheet title={placeholder.name} onClose={onClose} dismissOnBackdrop={!canManage}>
      <p className="li-sub wrap">Todavía no tiene cuenta en Backline.{canManage ? '' : ' Quien lidera la banda puede enlazarlo cuando la cree.'}</p>
      {canManage && (
        <>
          <label className="field">Nombre<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field">Instrumento
            <input list="ph-instruments2" value={instrument} maxLength={40} onChange={(e) => setInstrument(e.target.value)} />
            <datalist id="ph-instruments2">{instrumentOptions.map((i) => <option key={i} value={i} />)}</datalist>
          </label>
          <button className="btn" disabled={busy || name.trim().length < 2} onClick={() => void run(() => updatePlaceholder(placeholder.id, name, instrument))}>Guardar cambios</button>

          <div className="section-title" style={{ margin: '14px 0 0' }}>Ya creó su cuenta</div>
          <p className="li-sub wrap">Elige su cuenta y todo lo que tenía asignado (quién toca, afinaciones propias, anotaciones y equipo) pasa a ella.</p>
          <label className="field">Cuenta
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Elige un integrante…</option>
              {accounts.map((m) => <option key={m.profileId} value={m.profileId}>{m.name}{m.instrument ? ` · ${m.instrument}` : ''}</option>)}
            </select>
          </label>
          <button className="btn primary" disabled={busy || !to} onClick={async () => {
            if (!to || !(await ask({ title: `¿Enlazar a ${placeholder.name} con ${to.name}?`, body: `Todo lo de ${placeholder.name} pasa a ${to.name} y ${placeholder.name} deja de aparecer como integrante sin cuenta.`, confirmLabel: 'Enlazar' }))) return
            setBusy(true); setError('')
            try { const r = await reassignMember(bandId, placeholder.id, to.profileId); await refresh(); setMsg(summary(r)); setTimeout(onClose, 1800) } catch { setError('No pudimos enlazarlo. Intenta de nuevo.') }
            setBusy(false)
          }}>Enlazar con su cuenta</button>

          <button className="btn danger" disabled={busy} onClick={async () => (await ask({ title: `¿Quitar a ${placeholder.name}?`, body: 'Se borran sus anotaciones y deja de aparecer en «Quién toca». Si ya creó su cuenta, mejor enlázalo en vez de quitarlo.', confirmLabel: 'Quitar' })) && void run(() => deletePlaceholder(placeholder.id), true)}>
            Quitar
          </button>
        </>
      )}
      {msg && <p className="form-ok" role="status">{msg}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Sheet>
  )
}

/** Cambió la persona de un puesto (por ejemplo, otro bajista): pasa de una vez todo lo asignado a otra persona de la banda. */
export function ReassignSection({ bandId, from, people, onDone }: { bandId: string; from: Member; people: Member[]; onDone: () => void }) {
  const refresh = useRefreshRoster(bandId)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const options = people.filter((p) => p.profileId !== from.profileId)
  const to = options.find((p) => p.profileId === target)
  if (options.length === 0) return null
  return (
    <>
      <div className="section-title" style={{ margin: '14px 0 0' }}>¿Cambió la persona de este puesto?</div>
      <p className="li-sub wrap">Pasa todo lo de {from.name} (quién toca, afinaciones propias, anotaciones y equipo) a otra persona, sin volver a asignarlo canción por canción.</p>
      <label className="field">Pasarlo a
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Elige una persona…</option>
          {options.map((p) => <option key={p.profileId} value={p.profileId}>{p.name}{p.noAccount ? ' (sin cuenta)' : ''}{p.instrument ? ` · ${p.instrument}` : ''}</option>)}
        </select>
      </label>
      <button className="btn" disabled={busy || !to} onClick={async () => {
        if (!to || !(await ask({ title: `¿Pasar todo de ${from.name} a ${to.name}?`, body: `Lo que estaba asignado a ${from.name} queda para ${to.name}. ${from.name} sigue en la banda hasta que lo saques.`, confirmLabel: 'Pasar todo' }))) return
        setBusy(true); setError(''); setMsg('')
        try { const r = await reassignMember(bandId, from.profileId, to.profileId); await refresh(); setMsg(summary(r)); setTimeout(onDone, 1800) } catch { setError('No pudimos pasarlo. Intenta de nuevo.') }
        setBusy(false)
      }}>Pasar todo a otra persona</button>
      {msg && <p className="form-ok" role="status">{msg}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  )
}
