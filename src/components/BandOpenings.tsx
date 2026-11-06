import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { ask } from '../lib/confirm'
import { instrumentOptions } from '../lib/identity'
import { createOpening, deleteOpening, kindText, listBandOpenings, listReplies, setOpeningStatus, type MyOpening, type NewOpening } from '../lib/openings'
import { requestFriend } from '../lib/social'
import { useFriends } from '../lib/useLive'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import Avatar from './Avatar'
import Sheet from './Sheet'

const blank = (city: string): NewOpening => ({ instrument: 'Bajo', kind: 'temporary', neededOn: '', city, details: '' })

/** «Busco músico» para el líder o admin: publicar qué instrumento necesita la banda y leer quién respondió. */
export default function BandOpenings({ bandId, bandName, city, isPublic }: { bandId: string; bandName: string; city: string; isPublic: boolean }) {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [form, setForm] = useState<NewOpening | null>(null)
  const [viewing, setViewing] = useState<MyOpening | null>(null)
  const [error, setError] = useState('')
  const { data: items = [] } = useQuery({ queryKey: ['band-openings', bandId], queryFn: () => listBandOpenings(bandId), enabled: !!supabase })
  const refresh = () => qc.invalidateQueries({ queryKey: ['band-openings', bandId] }).then(() => qc.invalidateQueries({ queryKey: ['openings'] }))
  const create = useMutation({
    mutationFn: (o: NewOpening) => createOpening(bandId, me!, o),
    onSuccess: async () => { setForm(null); setError(''); await refresh() },
    onError: () => setError('No se pudo publicar. Revisa tu conexión e intenta de nuevo.'),
  })
  const toggle = useMutation({ mutationFn: (o: MyOpening) => setOpeningStatus(o.id, o.status === 'open' ? 'closed' : 'open'), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (o: MyOpening) => deleteOpening(o.id), onSuccess: refresh })
  if (!supabase) return null

  return (
    <>
      <h2 className="section-title">Busco músico</h2>
      <p className="li-sub wrap">¿Se fue el bajista o uno está enfermo para un toque? Publica qué necesitas y los músicos de Comunidad te responden.</p>
      {!isPublic && <p className="li-sub wrap" style={{ color: 'var(--amber)' }}>Para que otros músicos vean tus búsquedas, la banda debe ser pública (actívalo arriba, en «Banda pública»).</p>}
      {items.length > 0 && (
        <div className="list">
          {items.map((o) => (
            <div key={o.id} className="li" style={{ opacity: o.status === 'closed' ? 0.6 : 1 }}>
              <div className="li-main">
                <div className="li-title">{o.instrument} · {kindText[o.kind]}{o.status === 'closed' ? ' · cerrada' : ''}</div>
                <div className="li-sub">{[o.neededOn && new Date(`${o.neededOn}T12:00:00-05:00`).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' }), o.details].filter(Boolean).join(' · ') || 'Sin detalles'}</div>
              </div>
              <button className="btn sm" onClick={() => setViewing(o)}>{o.replies} {o.replies === 1 ? 'respuesta' : 'respuestas'}</button>
              <button className="btn sm" disabled={toggle.isPending} onClick={() => toggle.mutate(o)}>{o.status === 'open' ? 'Cerrar' : 'Reabrir'}</button>
              <button className="btn sm danger" onClick={async () => { if (await ask({ title: '¿Borrar la búsqueda?', body: 'También se borran las respuestas.', confirmLabel: 'Borrar' })) remove.mutate(o) }}>Borrar</button>
            </div>
          ))}
        </div>
      )}
      <button className="btn" onClick={() => { setForm(blank(city)); setError('') }}><Plus size={16} aria-hidden /> Publicar una búsqueda</button>

      {form && (
        <Sheet title={`Se busca músico para ${bandName}`} onClose={() => setForm(null)} onSubmit={(e) => { e.preventDefault(); if (!create.isPending) create.mutate(form) }}>
          <label className="field">Instrumento
            <select value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })}>{instrumentOptions.map((i) => <option key={i} value={i}>{i}</option>)}</select>
          </label>
          <div className="seg" role="group" aria-label="Tipo de búsqueda">
            {(['temporary', 'permanent'] as const).map((k) => <button type="button" key={k} className={form.kind === k ? 'active' : ''} aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })}>{kindText[k]}</button>)}
          </div>
          {form.kind === 'temporary' && (
            <label className="field">Para qué fecha (opcional)
              <input type="date" value={form.neededOn} onChange={(e) => setForm({ ...form, neededOn: e.target.value })} />
            </label>
          )}
          <label className="field">Ciudad
            <input value={form.city} maxLength={60} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="field">Detalles
            <textarea rows={4} value={form.details} maxLength={1000} placeholder="Género, repertorio, cuándo ensayan, si se paga, nivel que buscan…" onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="sheet-foot"><div className="row"><button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button><button className="btn primary grow" disabled={create.isPending}>{create.isPending ? 'Publicando…' : 'Publicar'}</button></div></div>
        </Sheet>
      )}
      {viewing && <Replies opening={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function Replies({ opening, onClose }: { opening: MyOpening; onClose: () => void }) {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const { data: replies, isLoading } = useQuery({ queryKey: ['opening-replies', opening.id], queryFn: () => listReplies(opening.id) })
  const { data: friends = [] } = useFriends()
  const [error, setError] = useState('')
  const add = useMutation({
    mutationFn: (id: string) => requestFriend(me!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
    onError: () => setError('No se pudo enviar la solicitud. Las amistades son solo entre mayores de edad.'),
  })
  return (
    <Sheet title={`Respuestas · ${opening.instrument}`} onClose={onClose}>
      {isLoading && <p className="li-sub">Cargando…</p>}
      {replies && replies.length === 0 && <p className="li-sub">Todavía nadie respondió.</p>}
      <div className="list">
        {replies?.map((r) => {
          const rel = friends.find((f) => f.id === r.profileId)
          return (
            <div key={r.id} className="li" style={{ alignItems: 'flex-start' }}>
              <Avatar name={r.name} url={r.avatarUrl} />
              <div className="li-main">
                <div className="li-title">{r.name}</div>
                <div className="li-sub">{[r.instruments.slice(0, 3).join(' · '), r.city].filter(Boolean).join(' · ')}</div>
                <p className="opening-details">{r.message}</p>
                <div className="row" style={{ marginTop: 6 }}>
                  {rel?.direction === 'friend' ? <Link className="btn sm primary" to={`/explorar/amigos/${r.profileId}`} onClick={onClose}>Escribirle</Link>
                    : rel?.direction === 'out' ? <button className="btn sm" disabled>Solicitud enviada</button>
                    : <button className="btn sm primary" disabled={add.isPending} onClick={() => add.mutate(r.profileId)}>Agregar amigo para escribirle</button>}
                  <Link className="btn sm" to={`/explorar/musicos/${r.profileId}`} onClick={onClose}>Ver perfil</Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Sheet>
  )
}
