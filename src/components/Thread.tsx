import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import type { Member, Post } from '../lib/api'
import Avatar from './Avatar'

const TZ = 'America/Bogota'
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ })
const dayLabel = (iso: string) => {
  const d = dayKey(iso)
  if (d === dayKey(new Date().toISOString())) return 'Hoy'
  if (d === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return 'Ayer'
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
}
const hour = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })

type Props = {
  posts: Post[]
  members: Member[]
  userId: string
  canDelete: (p: Post) => boolean
  onDelete: (p: Post) => void
  /** Quien escribe; si es null no puede (por ejemplo un invitado) y se muestra el aviso. */
  onSend: ((body: string) => Promise<void>) | null
  placeholder: string
  max: number
  emptyText: string
  /** `chat`: la lista llena el alto y se queda abajo; `inline`: lista corta dentro de un formulario. */
  variant: 'chat' | 'inline'
}

/** Lista de mensajes con caja de escritura: la usan el chat de la banda y los comentarios de cada canción. */
export default function Thread({ posts, members, userId, canDelete, onDelete, onSend, placeholder, max, emptyText, variant }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = posts[posts.length - 1]?.id

  // Al llegar un mensaje nuevo (o abrir) se baja al final.
  useEffect(() => { if (variant === 'chat') endRef.current?.scrollIntoView({ block: 'end' }) }, [lastId, variant])

  const byId = new Map(members.map((m) => [m.profileId, m]))
  async function send() {
    const body = draft.trim()
    if (!body || busy || !onSend) return
    setBusy(true)
    setError('')
    try {
      await onSend(body)
      setDraft('')
    } catch (e) {
      setError(/demasiados/.test(String((e as { message?: string })?.message)) ? 'Vas muy rápido: espera unos segundos.' : 'No se pudo enviar. Revisa tu conexión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`thread ${variant}`}>
      <div className="thread-list" role="log" aria-live="polite" aria-label="Mensajes">
        {posts.length === 0 && <p className="li-sub thread-empty">{emptyText}</p>}
        {posts.map((p, idx) => {
          const m = byId.get(p.profileId)
          const mine = p.profileId === userId
          const day = dayKey(p.createdAt)
          const head = idx === 0 || dayKey(posts[idx - 1].createdAt) !== day ? <div className="thread-day">{dayLabel(p.createdAt)}</div> : null
          return (
            <div key={p.id}>
              {head}
              <div className={`msg ${mine ? 'mine' : ''}`}>
                {!mine && <Avatar name={m?.name ?? 'Integrante'} url={m?.avatarUrl} size={32} />}
                <div className="msg-body">
                  <div className="msg-meta">
                    <b>{mine ? 'Tú' : m?.name ?? 'Integrante'}</b> · {hour(p.createdAt)}
                    {canDelete(p) && <button type="button" className="msg-del" onClick={() => onDelete(p)} aria-label="Borrar mensaje">Borrar</button>}
                  </div>
                  <p>{p.body}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      {onSend ? (
        <form className="thread-form" onSubmit={(e) => { e.preventDefault(); void send() }}>
          <textarea rows={variant === 'chat' ? 1 : 2} value={draft} maxLength={max} placeholder={placeholder} aria-label={placeholder}
            onChange={(e) => { setDraft(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); void send() } }} />
          <button className="btn primary" disabled={busy || !draft.trim()} aria-label="Enviar"><Send size={18} aria-hidden /> <span className="hide-sm">Enviar</span></button>
        </form>
      ) : <p className="li-sub">Como invitado puedes leer, pero no escribir.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
