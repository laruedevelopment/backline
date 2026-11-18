import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Copy, ExternalLink } from 'lucide-react'
import { money } from '../lib/slots'
import { attachProof, bookingError, bookingPayInfo, type Booking } from '../lib/venues'
import { useAuth } from '../store/useAuth'

function left(due: string, now: number) {
  const ms = new Date(due).getTime() - now
  if (ms <= 0) return 'vencido'
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
  return h >= 1 ? `${h} h ${m} min` : `${m} min`
}

/** Cómo pagar una reserva: datos del dueño con botón de copiar, valores, plazo y adjuntar el comprobante dentro de Backline. */
export default function PayPanel({ b }: { b: Pick<Booking, 'id' | 'payStatus' | 'payDueAt' | 'totalAmount' | 'depositAmount' | 'payNote'> }) {
  const qc = useQueryClient()
  const me = useAuth((s) => s.session?.user.id)
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const { data: info } = useQuery({ queryKey: ['pay-info', b.id], queryFn: () => bookingPayInfo(b.id), enabled: b.payStatus === 'awaiting' })
  const send = useMutation({
    mutationFn: (f: File) => attachProof(me!, b.id, f),
    onSuccess: async () => { setMsg(''); await qc.invalidateQueries({ queryKey: ['my-bookings'] }) },
    onError: (e) => setMsg(/imagen|pesa/i.test(String((e as Error).message)) ? 'Usa una foto o captura del comprobante (máximo 12 MB).' : bookingError(e)),
  })
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text.replace(/\s/g, '')); setMsg(`${what} copiado`) } catch { setMsg('No se pudo copiar. Selecciónalo y cópialo.') }
  }
  const deposit = b.depositAmount ?? 0, total = b.totalAmount ?? 0
  const partial = deposit > 0 && deposit < total

  if (b.payStatus === 'paid') return <p className="tag ok" style={{ alignSelf: 'flex-start' }}>Pago confirmado</p>
  if (b.payStatus === 'proof_sent') return <p className="li-sub wrap">Comprobante enviado. La sala lo revisa y confirma tu pago; tu reserva sigue apartada mientras tanto.</p>
  if (b.payStatus !== 'awaiting') return null

  return (
    <div className="pay-panel">
      <div className="pay-amount">
        <span><small>{partial ? 'Anticipo a pagar ahora' : 'Valor a pagar'}</small><b>{money(deposit || total)}</b></span>
        {partial && <span><small>Total · el resto en la sala</small><b>{money(total)}</b></span>}
      </div>
      {b.payDueAt && <p className="li-sub wrap">Paga y adjunta el comprobante dentro de <b>{left(b.payDueAt, now)}</b>. Si no, la reserva se cancela sola.</p>}
      {b.payNote && <p className="form-error" role="status">La sala no pudo validar tu comprobante: {b.payNote}. Adjunta uno nuevo.</p>}
      <div className="pay-methods">
        {info?.nequi && <div className="pay-method"><span><small>Nequi</small><b>{info.nequi}</b></span><button type="button" className="btn sm" onClick={() => void copy(info.nequi, 'Número')}><Copy size={14} aria-hidden /> Copiar</button></div>}
        {info?.breb && <div className="pay-method"><span><small>Bre-B (llave)</small><b>{info.breb}</b></span><button type="button" className="btn sm" onClick={() => void copy(info.breb, 'Llave')}><Copy size={14} aria-hidden /> Copiar</button></div>}
        {info?.link && <div className="pay-method"><span><small>Pasarela de la sala</small><b>Pagar con tarjeta o PSE</b></span><a className="btn sm" href={info.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden /> Abrir</a></div>}
      </div>
      {info?.notes && <p className="li-sub wrap">{info.notes}</p>}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) send.mutate(f) }} />
      <button type="button" className="btn primary" disabled={send.isPending} onClick={() => file.current?.click()}><Camera size={16} aria-hidden /> {send.isPending ? 'Enviando…' : 'Adjuntar comprobante'}</button>
      {msg && <p className="li-sub" role="status">{msg}</p>}
    </div>
  )
}
