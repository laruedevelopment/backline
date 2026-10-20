import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import BandMark from '../components/BandMark'
import MediaManager, { type MediaApi, type Photo } from '../components/MediaManager'
import ListSkeleton from '../components/Skeleton'
import { listPhotos } from '../lib/api'
import { bandMembers, getPublicBand } from '../lib/community'
import { initials } from '../lib/identity'
import { safeSocials, socialLabels } from '../lib/links'
import { useBands } from '../store/useBandSession'

const roleLabel: Record<string, string> = { owner: 'Líder', admin: 'Admin', member: 'Integrante', guest: 'Invitado' }

/** Perfil público de una banda (solo lo que la banda decidió mostrar). */
export default function PublicBandPage() {
  const { id } = useParams()
  const { bands } = useBands()
  const [copied, setCopied] = useState(false)
  const bandQ = useQuery({ queryKey: ['public-band', id], queryFn: () => getPublicBand(id!), enabled: !!id })
  const { data: members = [] } = useQuery({ queryKey: ['public-band-members', id], queryFn: () => bandMembers(id!), enabled: !!id })

  if (bandQ.isLoading) return <ListSkeleton rows={4} />
  const band = bandQ.data
  if (!band) return <p className="empty">Esa banda no es pública o ya no existe. <Link to="/explorar" style={{ color: 'var(--amber)' }}>Volver a Comunidad</Link></p>

  const mine = bands.find((b) => b.id === band.id)
  const socials = safeSocials(band.links)
  const photosApi: MediaApi<Photo> = {
    photosKey: ['photos', band.id],
    listPhotos: async () => (await listPhotos(band.id)).map((p) => ({ id: p.id, url: p.url })),
    addPhoto: async () => {}, deletePhoto: async () => {}, setLogo: async () => {}, clearLogo: async () => {}, onLogoChanged: async () => {}, onPhotosChanged: async () => {},
  }

  async function share() {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}explorar/bandas/${band!.id}`
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* sin permiso */ }
  }

  return (
    <>
      <Link to="/explorar" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Comunidad</Link>
      <div className="page-head" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 16, paddingTop: 6 }}>
        <BandMark name={band.name} logoUrl={band.logoUrl} size="lg" />
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">Banda{mine ? ' · es tuya' : ''}</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{band.name}</h1>
        </div>
      </div>
      <p className="page-sub">{band.city || 'Sin ciudad'}</p>
      {band.genres.length > 0 && <div className="chips">{band.genres.map((g) => <span key={g} className="tag">{g}</span>)}</div>}
      {band.bio && <p style={{ marginTop: 14, maxWidth: '60ch', whiteSpace: 'pre-line' }}>{band.bio}</p>}
      {socials.length > 0 && (
        <div className="links-row" style={{ marginTop: 14 }}>
          {socials.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer">{socialLabels[k]}</a>)}
        </div>
      )}
      <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => void share()}>{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
        {mine && <Link className="btn" to="/banda">Administrar mi banda</Link>}
      </div>

      <div className="section-title">Integrantes visibles{members.length ? ` · ${members.length}` : ''}</div>
      {members.length === 0 && <p className="li-sub wrap">Los integrantes aparecen aquí cuando hacen público su propio perfil.</p>}
      <div className="list cols" style={{ borderTop: members.length ? undefined : 0 }}>
        {members.map((m) => (
          <Link key={m.profileId} to={`/explorar/musicos/${m.profileId}`} className="li" style={{ minHeight: 60 }}>
            <span className="avatar" style={{ marginLeft: 0 }} aria-hidden>{initials(m.name)}</span>
            <div className="li-main">
              <div className="li-title">{m.name}</div>
              <div className="li-sub">{m.instrument || m.instruments[0] || 'Sin instrumento'}</div>
            </div>
            <span className={`tag ${m.role === 'owner' ? 'key' : ''}`}>{roleLabel[m.role] ?? m.role}</span>
          </Link>
        ))}
      </div>

      <MediaManager name={band.name} logoUrl={null} canEdit={false} api={photosApi} intro="" />
    </>
  )
}
