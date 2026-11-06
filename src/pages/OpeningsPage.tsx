import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import BandMark from '../components/BandMark'
import CommunityNav from '../components/CommunityNav'
import Sheet from '../components/Sheet'
import ListSkeleton from '../components/Skeleton'
import { instrumentOptions } from '../lib/identity'
import { kindText, listOpenings, replyToOpening, type Opening } from '../lib/openings'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

const dateText = (d: string) => new Date(`${d}T12:00:00-05:00`).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short' })

/** Bandas que buscan músico: el instrumento, si es temporal o definitivo, la fecha y los detalles. */
export default function OpeningsPage() {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [instrument, setInstrument] = useState('')
  const [replying, setReplying] = useState<Opening | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { data, isLoading, isError } = useQuery({ queryKey: ['openings'], queryFn: listOpenings, enabled: !!supabase, staleTime: 60_000 })
  const reply = useMutation({
    mutationFn: () => replyToOpening(replying!.id, me!, message),
    onSuccess: async () => { setReplying(null); setMessage(''); setError(''); await qc.invalidateQueries({ queryKey: ['openings'] }) },
    onError: () => setError('No se pudo enviar. Solo pueden responder mayores de edad que no sean de esa banda; revisa tu conexión.'),
  })
  const shown = useMemo(() => (data ?? []).filter((o) => !instrument || o.instrument === instrument), [data, instrument])
  const present = useMemo(() => [...new Set((data ?? []).map((o) => o.instrument))].sort(), [data])

  if (!supabase) return <><CommunityNav /><p className="empty">Las búsquedas necesitan una cuenta. Inicia sesión para verlas.</p></>
  return (
    <>
      <CommunityNav />
      <p className="page-sub">Bandas que necesitan un músico: para un toque o para quedarse. Responde y la banda te escribe.</p>
      {present.length > 1 && (
        <div className="filter-chips" role="group" aria-label="Filtrar por instrumento">
          <button className={!instrument ? 'active' : ''} aria-pressed={!instrument} onClick={() => setInstrument('')}>Todos</button>
          {present.map((i) => <button key={i} className={instrument === i ? 'active' : ''} aria-pressed={instrument === i} onClick={() => setInstrument(i)}>{i}</button>)}
        </div>
      )}
      {isLoading && <ListSkeleton rows={3} />}
      {isError && <p className="empty">No pudimos cargar las búsquedas. Revisa tu conexión.</p>}
      {data && shown.length === 0 && (
        <div className="empty">
          <h3>Ahora nadie está buscando{instrument ? ` ${instrument.toLowerCase()}` : ''}</h3>
          <p>Si tu banda necesita un músico, publícalo desde <Link to="/banda" style={{ color: 'var(--amber)' }}>Banda</Link> (la banda debe ser pública).</p>
        </div>
      )}
      <div className="list">
        {shown.map((o) => (
          <div key={o.id} className="li opening">
            <BandMark name={o.bandName} logoUrl={o.bandLogoUrl} />
            <div className="li-main">
              <div className="li-title" style={{ whiteSpace: 'normal' }}>Se busca {o.instrument.toLowerCase()}</div>
              <div style={{ margin: '4px 0' }}><span className={`tag ${o.kind === 'temporary' ? '' : 'key'}`}>{kindText[o.kind]}</span></div>
              <div className="li-sub"><Link to={`/explorar/bandas/${o.bandId}`} style={{ color: 'var(--amber)' }}>{o.bandName}</Link>{[o.city || o.bandCity, o.neededOn && `para el ${dateText(o.neededOn)}`].filter(Boolean).map((t) => ` · ${t}`).join('')}</div>
              {o.details && <p className="opening-details">{o.details}</p>}
            </div>
            {o.replied ? <span className="li-sub">Ya respondiste</span> : <button className="btn primary sm" onClick={() => { setReplying(o); setError('') }}>Me interesa</button>}
          </div>
        ))}
      </div>

      {replying && (
        <Sheet title={`Responder a ${replying.bandName}`} onClose={() => setReplying(null)} onSubmit={(e) => { e.preventDefault(); if (message.trim() && !reply.isPending) reply.mutate() }}>
          <p className="li-sub wrap">Buscan {replying.instrument.toLowerCase()} ({kindText[replying.kind].toLowerCase()}). La banda verá tu nombre, tu foto, tus instrumentos y tu ciudad junto a este mensaje.</p>
          <label className="field">Tu mensaje
            <textarea rows={4} value={message} maxLength={1000} required placeholder="Cuéntales qué tocas, tu experiencia y cuándo estás disponible." onChange={(e) => setMessage(e.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="sheet-foot"><div className="row"><button type="button" className="btn" onClick={() => setReplying(null)}>Cancelar</button><button className="btn primary grow" disabled={reply.isPending || !message.trim()}>{reply.isPending ? 'Enviando…' : 'Enviar'}</button></div></div>
        </Sheet>
      )}
      <datalist id="opening-instruments">{instrumentOptions.map((i) => <option key={i} value={i} />)}</datalist>
    </>
  )
}
