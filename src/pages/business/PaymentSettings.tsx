import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import InfoTip from '../../components/InfoTip'
import { getPaySettings, savePaySettings, type PaySettings, type Venue } from '../../lib/venues'

const HOLDS = [6, 12, 24, 48, 72]

/** Cómo cobra la sala: método(s), anticipo y cuánto espera el pago. Backline no recibe dinero: va directo al dueño. */
export default function PaymentSettings({ venue }: { venue: Venue }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['pay-settings', venue.id], queryFn: () => getPaySettings(venue.id) })
  const [draft, setF] = useState<PaySettings | null>(null)
  const f = draft ?? data ?? null
  const [msg, setMsg] = useState('')
  const save = useMutation({
    mutationFn: (p: PaySettings) => savePaySettings(venue.id, p),
    onSuccess: async () => { setMsg('Guardado'); await Promise.all([qc.invalidateQueries({ queryKey: ['pay-settings', venue.id] }), qc.invalidateQueries({ queryKey: ['my-venues'] }), qc.invalidateQueries({ queryKey: ['venues'] })]) },
    onError: () => setMsg('No se pudo guardar. Si activas el cobro, escribe al menos un método de pago (el link debe empezar por https://).'),
  })
  if (!f) return null
  const set = (p: Partial<PaySettings>) => { setMsg(''); setF({ ...f, ...p }) }
  const hasMethod = !!(f.nequi.trim() || f.breb.trim() || f.link.trim())

  return (
    <>
      <div className="section-title">Pagos <InfoTip text="El dinero va directo a tu cuenta: Backline no lo recibe. El cliente adjunta aquí el comprobante, tú lo apruebas y la reserva queda pagada. Si no paga dentro del plazo, la reserva se cancela sola; si adjuntó el comprobante a tiempo, la revisión es tuya." /></div>
      <label className="check-row">
        <input type="checkbox" checked={f.required} onChange={(e) => set({ required: e.target.checked })} /> <span><b>Pedir pago para mantener la reserva</b></span>
      </label>
      <div className="stack" style={{ marginTop: 10 }}>
        <label className="field">Nequi (número)
          <input inputMode="tel" value={f.nequi} maxLength={20} placeholder="300 123 4567" onChange={(e) => set({ nequi: e.target.value.replace(/[^\d +]/g, '') })} />
        </label>
        <label className="field">Bre-B (llave)
          <input value={f.breb} maxLength={60} placeholder="@tusala o tu número" onChange={(e) => set({ breb: e.target.value })} />
        </label>
        <label className="field">Link de tu pasarela (opcional)
          <input type="url" value={f.link} maxLength={300} placeholder="https://…" onChange={(e) => set({ link: e.target.value })} />
        </label>
        <label className="field">Indicaciones (opcional)
          <input value={f.notes} maxLength={300} placeholder="Ej.: pon tu nombre y la fecha en el mensaje" onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="grid-row">
          <label className="field grow">Cobro por adelantado
            <select value={f.depositPct ?? ''} onChange={(e) => set({ depositPct: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Pago total</option>
              <option value="30">Anticipo 30 %</option>
              <option value="50">Anticipo 50 %</option>
            </select>
          </label>
          <label className="field grow">Plazo para pagar
            <select value={f.holdHours} onChange={(e) => set({ holdHours: Number(e.target.value) })}>
              {HOLDS.map((h) => <option key={h} value={h}>{h} horas</option>)}
            </select>
          </label>
        </div>
        <p className="li-sub wrap">{f.depositPct ? `El cliente paga el ${f.depositPct} % al reservar y el resto en la sala.` : 'El cliente paga todo al reservar.'} Si no adjunta el comprobante en {f.holdHours} horas, la reserva se cancela sola.</p>
        {f.required && !hasMethod && <p className="form-error" role="status">Escribe al menos un método de pago para activar el cobro.</p>}
        <div className="row">
          <button className="btn primary" disabled={save.isPending || (f.required && !hasMethod)} onClick={() => save.mutate(f)}>{save.isPending ? 'Guardando…' : 'Guardar pagos'}</button>
          {msg && <span className="li-sub" role="status">{msg}</span>}
        </div>
      </div>
    </>
  )
}
