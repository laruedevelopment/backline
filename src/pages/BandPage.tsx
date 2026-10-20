import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInvite, deleteBand, listMembers, purgeBandMedia, setBandPublic, removeMember, setMemberInstrument, setMyInstrument, setMemberRole, transferOwnership, updateBand,
  type Member,
} from '../lib/api'
import { initials, instrumentOptions } from '../lib/identity'
import { safeSocials, socialLabels } from '../lib/links'
import { inviteLink } from '../lib/pendingInvite'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { useActiveBand, useBands } from '../store/useBandSession'
import BandForm from '../components/BandForm'
import BandMark from '../components/BandMark'
import BandMedia from '../components/BandMedia'
import { ask } from '../lib/confirm'
import Sheet from '../components/Sheet'
import ListSkeleton from '../components/Skeleton'

const roleLabel: Record<string, string> = { owner: 'Líder', admin: 'Admin', member: 'Integrante', guest: 'Invitado' }
const APP_URL = typeof window === 'undefined' ? '' : `${window.location.origin}${import.meta.env.BASE_URL}`

export default function BandPage() {
  const band = useActiveBand()
  const { bands, setActive } = useBands()
  const userId = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [publicBusy, setPublicBusy] = useState(false)

  const bandId = band?.id
  const { data: members = [], isLoading } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId!), enabled: !!bandId })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['members', bandId] }), qc.invalidateQueries({ queryKey: ['bands'] })])

  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateBand>[1]) => updateBand(bandId!, d),
    onSuccess: refresh,
  })

  if (!band || !supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Banda</h1></div>
        <p className="notice">Ingresa con tu cuenta para administrar tu banda.</p>
      </>
    )
  }

  const isOwner = band.role === 'owner'
  const isAdmin = isOwner || band.role === 'admin'
  const socials = safeSocials(band.links)
  const others = bands.filter((b) => b.id !== band.id)

  async function invite() {
    setMsg('')
    try { setCode(await createInvite(band!.id, userId!)) } catch { setMsg('No pudimos crear el código. Intenta de nuevo.') }
  }
  const shareText = `Te invito a ${band.name} en Backline. Entra con este link, crea tu cuenta y quedas dentro de la banda: ${inviteLink(APP_URL, code)}
(Si te pide un código: ${code})`

  async function leave() {
    if (!(await ask({ title: `¿Salir de ${band!.name}?`, body: 'Dejas de ver su repertorio, setlists y agenda. Puedes volver con un código de invitación.', confirmLabel: 'Salir' }))) return
    try {
      await removeMember(band!.id, userId!)
      await qc.invalidateQueries({ queryKey: ['bands'] })
      if (others[0]) setActive(others[0].id)
    } catch { setMsg('No pudimos sacarte de la banda. Intenta de nuevo.') }
  }
  async function destroy() {
    const typed = prompt(`Esto borra la banda, su repertorio, setlists y agenda para todos.\nEscribe el nombre de la banda para confirmar:`)
    if (typed?.trim() !== band!.name) return
    try {
      await purgeBandMedia(band!.id).catch(() => {})
      await deleteBand(band!.id)
      await qc.invalidateQueries({ queryKey: ['bands'] })
      if (others[0]) setActive(others[0].id)
    } catch { setMsg('No pudimos borrar la banda. Intenta de nuevo.') }
  }

  return (
    <>
      <div className="page-head" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 16 }}>
        <BandMark name={band.name} logoUrl={band.logoUrl} size="lg" />
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">{roleLabel[band.role]}</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{band.name}</h1>
        </div>
      </div>
      <p className="page-sub">{band.city || 'Sin ciudad'}</p>
      {band.genres.length > 0 && <div className="chips">{band.genres.map((g) => <span key={g} className="tag">{g}</span>)}</div>}
      {band.bio && <p style={{ marginTop: 14, maxWidth: '60ch' }}>{band.bio}</p>}
      {socials.length > 0 && (
        <div className="links-row" style={{ marginTop: 14 }}>
          {socials.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer">{socialLabels[k]}</a>)}
        </div>
      )}
      {isAdmin && <button className="btn" style={{ marginTop: 16 }} onClick={() => setEditing(true)}>Editar datos de la banda</button>}
      {isAdmin && !band.bio && socials.length === 0 && (
        <p className="notice" style={{ marginTop: 14 }}>Completa la banda con una descripción y sus redes: es lo que verá la gente cuando haya perfil público.</p>
      )}

      {isAdmin && (
        <>
          <div className="section-title">Comunidad</div>
          <label className="check-row" style={{ alignItems: 'start' }}>
            <input type="checkbox" checked={band.isPublic} disabled={publicBusy} onChange={async (e) => {
              setPublicBusy(true); setMsg('')
              try { await setBandPublic(band.id, e.target.checked); await qc.invalidateQueries({ queryKey: ['bands'] }) } catch { setMsg('No pudimos cambiar la visibilidad. Intenta de nuevo.') }
              setPublicBusy(false)
            }} />
            <span>
              <b>Perfil público de la banda</b><br />
              Las demás personas con cuenta podrán encontrarla en Comunidad y ver su logo, géneros, descripción, redes y fotos. El repertorio, los setlists, la agenda y las reservas siguen siendo solo de la banda. Los integrantes solo aparecen si ellos mismos activaron su perfil público.
            </span>
          </label>
          {band.isPublic && <p className="li-sub" style={{ marginTop: 6 }}><Link to={`/explorar/bandas/${band.id}`} style={{ color: 'var(--amber)', fontWeight: 600 }}>Ver cómo la ven los demás</Link></p>}
        </>
      )}

      <BandMedia band={band} canEdit={isAdmin} />

      <div className="section-title">Integrantes · {members.length}</div>
      {isLoading ? <ListSkeleton rows={3} /> : (
        <div className="list cols">
          {members.map((m) => {
            const me = m.profileId === userId
            return (
              <button key={m.profileId} className="li" onClick={() => setMember(m)} aria-label={`${m.name}, ${roleLabel[m.role]}. Ver opciones`}>
                <span className="avatar" style={{ marginLeft: 0 }}>{initials(m.name)}</span>
                <div className="li-main">
                  <div className="li-title">{m.name}{me && <span className="sub"> · tú</span>}</div>
                  <div className="li-sub">{m.instrument ?? m.instruments[0] ?? 'Sin instrumento'}</div>
                </div>
                <span className={`tag ${m.role === 'owner' ? 'key' : ''}`}>{roleLabel[m.role]}</span>
              </button>
            )
          })}
        </div>
      )}

      {isAdmin && (
        <>
          <div className="section-title">Invitar</div>
          <p className="li-sub wrap" style={{ marginBottom: 10 }}>El código sirve 7 días. Quien lo use entra como integrante.</p>
          <button className="btn" onClick={() => void invite()}>Generar código</button>
          {code && (
            <div className="card stack" style={{ marginTop: 12 }}>
              <div className="invite-code">{code}</div>
              <div className="row">
                <button className="btn grow" onClick={() => void navigator.clipboard.writeText(shareText)}>Copiar mensaje</button>
                <a className="btn primary grow" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </div>
            </div>
          )}
        </>
      )}
      {msg && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{msg}</p>}

      <div className="section-title">Zona delicada</div>
      <div className="stack">
        {!isOwner && <button className="btn danger" onClick={() => void leave()}>Salir de la banda</button>}
        {isOwner && members.length > 1 && <p className="li-sub wrap">Eres el líder. Para salir, primero traspasa el liderazgo desde el perfil de otro integrante.</p>}
        {isOwner && <button className="btn danger" onClick={() => void destroy()}>Borrar la banda</button>}
      </div>

      {editing && <BandForm band={band} onSave={(d) => save.mutateAsync(d)} onClose={() => setEditing(false)} />}
      {member && (
        <MemberSheet
          member={member} me={member.profileId === userId} bandId={band.id} isOwner={isOwner} isAdmin={isAdmin}
          onClose={() => setMember(null)} onChanged={refresh}
        />
      )}
    </>
  )
}

function MemberSheet({ member, me, bandId, isOwner, isAdmin, onClose, onChanged }: {
  member: Member; me: boolean; bandId: string; isOwner: boolean; isAdmin: boolean; onClose: () => void; onChanged: () => Promise<unknown>
}) {
  const [instrument, setInstrument] = useState(member.instrument ?? member.instruments[0] ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const canManage = isAdmin && !me && member.role !== 'owner'
  const canInstrument = me || isAdmin

  async function run(fn: () => Promise<unknown>, done = true) {
    setBusy(true)
    setErr('')
    try { await fn(); await onChanged(); if (done) onClose() } catch { setErr('No pudimos aplicar el cambio. Intenta de nuevo.') }
    setBusy(false)
  }

  return (
    <Sheet title={member.name} onClose={onClose} dismissOnBackdrop>
      <div className="row">
        <span className="avatar lg" style={{ marginLeft: 0 }} aria-hidden>{initials(member.name)}</span>
        <span className="eyebrow">{roleLabel[member.role]}</span>
      </div>

      {canInstrument && (
        <label className="field">Instrumento en esta banda
          <input list="instruments" value={instrument} onChange={(e) => setInstrument(e.target.value)} maxLength={40} placeholder="Guitarra" />
          <datalist id="instruments">{instrumentOptions.map((i) => <option key={i} value={i} />)}</datalist>
        </label>
      )}
      {canInstrument && (
        <button className="btn" disabled={busy} onClick={() => void run(() => (me ? setMyInstrument(bandId, instrument) : setMemberInstrument(bandId, member.profileId, instrument)), false)}>Guardar instrumento</button>
      )}

      {canManage && (
        <>
          <label className="field">Rol
            <select value={member.role} disabled={busy} onChange={(e) => void run(() => setMemberRole(bandId, member.profileId, e.target.value as 'admin' | 'member' | 'guest'))}>
              <option value="admin">Admin: administra la banda</option>
              <option value="member">Integrante: edita repertorio y agenda</option>
              <option value="guest">Invitado: solo ve y confirma asistencia</option>
            </select>
          </label>
          {isOwner && (
            <button className="btn" disabled={busy} onClick={async () => (await ask({ title: `¿Traspasar el liderazgo a ${member.name}?`, body: 'Tú quedas como admin. Solo el nuevo líder podrá borrar la banda.', confirmLabel: 'Traspasar' })) && void run(() => transferOwnership(bandId, member.profileId))}>
              Traspasar liderazgo
            </button>
          )}
          <button className="btn danger" disabled={busy} onClick={async () => (await ask({ title: `¿Sacar a ${member.name} de la banda?`, confirmLabel: 'Sacar' })) && void run(() => removeMember(bandId, member.profileId))}>
            Sacar de la banda
          </button>
        </>
      )}
      {err && <p className="form-error" role="alert">{err}</p>}
    </Sheet>
  )
}
