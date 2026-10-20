import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import BandMark from '../components/BandMark'
import ListSkeleton from '../components/Skeleton'
import { getPublicMusician, musicianBands } from '../lib/community'
import { initials, waLink } from '../lib/identity'
import { useAuth } from '../store/useAuth'

/** Perfil público de un músico (solo lo que esa persona decidió mostrar). */
export default function PublicMusicianPage() {
  const { id } = useParams()
  const me = useAuth((s) => s.session?.user.id)
  const [copied, setCopied] = useState(false)
  const musicianQ = useQuery({ queryKey: ['public-musician', id], queryFn: () => getPublicMusician(id!), enabled: !!id })
  const { data: bands = [] } = useQuery({ queryKey: ['public-musician-bands', id], queryFn: () => musicianBands(id!), enabled: !!id })

  if (musicianQ.isLoading) return <ListSkeleton rows={4} />
  const m = musicianQ.data
  if (!m) return <p className="empty">Ese perfil no es público o ya no existe. <Link to="/explorar/musicos" style={{ color: 'var(--amber)' }}>Volver a Comunidad</Link></p>

  const wa = m.whatsapp ? waLink(m.whatsapp, `Hola ${m.name.split(' ')[0]}, te vi en Backline y me gustaría hablar contigo.`) : undefined

  async function share() {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}explorar/musicos/${m!.id}`
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* sin permiso */ }
  }

  return (
    <>
      <Link to="/explorar/musicos" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Comunidad</Link>
      <div className="page-head" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 16, paddingTop: 6 }}>
        <span className="avatar lg" style={{ marginLeft: 0 }} aria-hidden>{initials(m.name)}</span>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">Músico{m.id === me ? ' · eres tú' : ''}</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{m.name}</h1>
        </div>
      </div>
      <p className="page-sub">{m.city || 'Sin ciudad'}</p>
      {m.instruments.length > 0 && <div className="chips">{m.instruments.map((i) => <span key={i} className="tag key">{i}</span>)}</div>}
      {m.bio && <p style={{ marginTop: 14, maxWidth: '60ch', whiteSpace: 'pre-line' }}>{m.bio}</p>}
      <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {wa && m.id !== me && <a className="btn primary" href={wa} target="_blank" rel="noopener noreferrer">Escribirle por WhatsApp</a>}
        <button className="btn" onClick={() => void share()}>{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
        {m.id === me && <Link className="btn" to="/perfil">Editar mi perfil</Link>}
      </div>

      <div className="section-title">Sus bandas{bands.length ? ` · ${bands.length}` : ''}</div>
      {bands.length === 0 && <p className="li-sub wrap">No tiene bandas públicas.</p>}
      <div className="list" style={{ borderTop: bands.length ? undefined : 0 }}>
        {bands.map((b) => (
          <Link key={b.bandId} to={`/explorar/bandas/${b.bandId}`} className="li" style={{ minHeight: 64 }}>
            <BandMark name={b.name} logoUrl={b.logoUrl} />
            <div className="li-main">
              <div className="li-title">{b.name}</div>
              <div className="li-sub">{[b.instrument, b.city, b.genres.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
