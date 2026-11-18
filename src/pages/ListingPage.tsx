import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Flag, MessageCircle } from 'lucide-react'
import Avatar from '../components/Avatar'
import { ReportSheet, type ReportTarget } from '../components/ReportSheet'
import ListSkeleton from '../components/Skeleton'
import { ago } from '../lib/ago'
import { ask } from '../lib/confirm'
import { profileCards } from '../lib/feed'
import { answerQuestion, askQuestion, conditionLabel, categoryLabel, deleteListing, deleteQuestion, getListing, listQuestions, marketUrls, price, setListingStatus } from '../lib/market'
import { waLink } from '../lib/identity'
import { useAuth } from '../store/useAuth'
import InfoTip from '../components/InfoTip'

/** Detalle de un anuncio: fotos, datos, preguntas públicas y, si el vendedor quiso, su WhatsApp. */
export default function ListingPage() {
  const { id } = useParams()
  const me = useAuth((s) => s.session?.user.id)
  const nav = useNavigate()
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [answering, setAnswering] = useState<{ id: string; text: string } | null>(null)
  const [report, setReport] = useState<ReportTarget | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const { data: l, isLoading } = useQuery({ queryKey: ['listing', id], queryFn: () => getListing(id!), enabled: !!id })
  const { data: urls } = useQuery({ queryKey: ['market-urls', (l?.images ?? []).join(',')], queryFn: () => marketUrls(l!.images), enabled: !!l && l.images.length > 0, staleTime: 50 * 60_000 })
  const { data: qs = [] } = useQuery({ queryKey: ['listing-qs', id], queryFn: () => listQuestions(id!), enabled: !!l })
  const ids = [l?.seller ?? '', ...qs.map((q) => q.author)].filter(Boolean)
  const { data: cards } = useQuery({ queryKey: ['cards', ids.sort().join(',')], queryFn: () => profileCards(ids), enabled: ids.length > 0 })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['listing', id] }); void qc.invalidateQueries({ queryKey: ['listings'] }) }
  const ask$ = useMutation({ mutationFn: () => askQuestion(id!, draft), onSuccess: async () => { setDraft(''); await qc.invalidateQueries({ queryKey: ['listing-qs', id] }) } })
  const reply = useMutation({ mutationFn: (v: { id: string; text: string }) => answerQuestion(v.id, v.text), onSuccess: async () => { setAnswering(null); await qc.invalidateQueries({ queryKey: ['listing-qs', id] }) } })
  const delQ = useMutation({ mutationFn: (qid: string) => deleteQuestion(qid), onSuccess: () => qc.invalidateQueries({ queryKey: ['listing-qs', id] }) })
  const status = useMutation({ mutationFn: (s: 'active' | 'sold' | 'paused') => setListingStatus(id!, s), onSuccess: refresh })

  if (isLoading) return <ListSkeleton rows={4} />
  if (!l) return <p className="empty">Este anuncio ya no está disponible. <Link to="/explorar/mercado" style={{ color: 'var(--amber)' }}>Volver al Mercado</Link></p>
  const mine = l.seller === me
  const seller = cards?.get(l.seller)
  const wa = l.whatsapp ? waLink(l.whatsapp, `Hola, vi tu anuncio «${l.title}» en Backline.`) : undefined

  return (
    <>
      <Link to="/explorar/mercado" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Mercado</Link>
      {l.images.length > 0 && (
        <div className="gallery-strip" style={{ marginTop: 10 }}>
          {l.images.map((p) => urls?.get(p) ? <button key={p} type="button" onClick={() => setZoom(urls.get(p)!)} aria-label="Ver foto grande"><img src={urls.get(p)} alt="" decoding="async" /></button> : <button key={p} type="button" className="skeleton" aria-hidden />)}
        </div>
      )}
      <div className="page-head" style={{ paddingTop: 14 }}>
        <span className="eyebrow">{categoryLabel[l.category]} · {conditionLabel[l.condition]}{l.status === 'sold' ? ' · Vendido' : l.status === 'paused' ? ' · En pausa' : ''}</span>
        <h1 className="page-title" style={{ fontSize: 'clamp(1.7rem, 7vw, 2.4rem)' }}>{l.title}</h1>
        <div className="lcard-price" style={{ fontSize: '1.8rem' }}>{price(l.price)}</div>
      </div>
      <p className="li-sub">{[l.brand, l.city, l.acceptsTrade ? 'Acepta cambios' : '', ago(l.createdAt)].filter(Boolean).join(' · ')}</p>
      {l.description && <p style={{ marginTop: 12, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{l.description}</p>}

      {mine ? (
        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {l.status !== 'sold' && <button className="btn primary" onClick={() => status.mutate('sold')}>Marcar como vendido</button>}
          {l.status === 'active' && <button className="btn" onClick={() => status.mutate('paused')}>Pausar</button>}
          {l.status !== 'active' && <button className="btn" onClick={() => status.mutate('active')}>Volver a publicar</button>}
          <button className="btn danger" onClick={async () => { if (await ask({ title: '¿Borrar el anuncio?', body: 'Se borra con sus fotos y preguntas.', confirmLabel: 'Borrar' })) { await deleteListing(l); void qc.invalidateQueries({ queryKey: ['listings'] }); nav('/explorar/mercado') } }}>Borrar</button>
        </div>
      ) : (
        <div className="card stack" style={{ marginTop: 14 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <Avatar name={seller?.name ?? 'Vendedor'} url={seller?.avatarUrl} />
            <div className="grow"><b>{seller?.name ?? 'Vendedor'}</b><div className="li-sub">Vendedor</div></div>
            <button className="icon-quiet" aria-label="Denunciar anuncio" onClick={() => setReport({ kind: 'listing', id: l.id, label: 'este anuncio', excerpt: l.title })}><Flag size={16} aria-hidden /></button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="btn primary" to={`/explorar/amigos/${l.seller}`}><MessageCircle size={16} aria-hidden /> Enviar mensaje</Link>
            {wa && <a className="btn ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          </div>
          <div className="safety">Encuéntrense en un lugar público, no adelantes dinero y revisa el equipo antes de pagar. Backline no cobra ni garantiza el trato. <InfoTip label="Más sobre la seguridad" text="Si algo te parece una estafa o el equipo es robado o falso, denuncia el anuncio. Desconfía de precios demasiado bajos, de quien tiene prisa o de quien pide pagar por adelantado." /></div>
        </div>
      )}

      <h2 className="section-title">Preguntas{qs.length ? ` · ${qs.length}` : ''}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {qs.length === 0 && <p className="li-sub">Todavía nadie ha preguntado.</p>}
        {qs.map((q) => (
          <div key={q.id} className="qa">
            <div><b>{cards?.get(q.author)?.name ?? (q.author === me ? 'Tú' : 'Músico')}</b> <span className="li-sub">{ago(q.createdAt)}</span></div>
            <div>{q.body}</div>
            {q.answer && <div className="a"><b>Vendedor:</b> {q.answer}</div>}
            {mine && answering?.id === q.id ? (
              <form className="thread-form" onSubmit={(e) => { e.preventDefault(); reply.mutate(answering) }}>
                <input value={answering.text} maxLength={500} aria-label="Tu respuesta" autoFocus onChange={(e) => setAnswering({ id: q.id, text: e.target.value })} />
                <button className="btn primary sm" disabled={reply.isPending}>Responder</button>
              </form>
            ) : (
              <div className="row">
                {mine && <button className="btn sm" onClick={() => setAnswering({ id: q.id, text: q.answer })}>{q.answer ? 'Editar respuesta' : 'Responder'}</button>}
                {(mine || q.author === me) && <button className="btn sm danger" onClick={() => delQ.mutate(q.id)}>Borrar</button>}
                {!mine && q.author !== me && <button className="icon-quiet" aria-label="Denunciar pregunta" onClick={() => setReport({ kind: 'listing_question', id: q.id, label: 'esta pregunta', excerpt: q.body })}><Flag size={14} aria-hidden /></button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {!mine && l.status === 'active' && (
        <form className="thread-form" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !ask$.isPending) ask$.mutate() }}>
          <input value={draft} maxLength={500} placeholder="Haz una pregunta pública sobre el equipo…" aria-label="Preguntar" onChange={(e) => setDraft(e.target.value)} />
          <button className="btn primary sm" disabled={!draft.trim() || ask$.isPending}>Preguntar</button>
        </form>
      )}
      {report && <ReportSheet target={report} onClose={() => setReport(null)} />}
      {zoom && <button className="lightbox" onClick={() => setZoom(null)} aria-label="Cerrar foto"><img src={zoom} alt="" /></button>}
    </>
  )
}
