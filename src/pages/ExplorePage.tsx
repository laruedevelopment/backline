import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import BandMark from '../components/BandMark'
import ListSkeleton from '../components/Skeleton'
import { exploreBands, exploreMusicians, PAGE, type PublicBand, type PublicMusician } from '../lib/community'
import { genreOptions, initials, instrumentOptions } from '../lib/identity'
import { supabase } from '../lib/supabase'
import CityInput from '../components/CityInput'

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

/** Comunidad: descubrir bandas y músicos que decidieron hacerse públicos. */
export default function ExplorePage() {
  const musicians = useLocation().pathname.startsWith('/explorar/musicos')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [tag, setTag] = useState('')
  const dq = useDebounced(q), dcity = useDebounced(city)
  const options = musicians ? instrumentOptions : genreOptions

  const query = useInfiniteQuery<(PublicBand | PublicMusician)[], Error, { pages: (PublicBand | PublicMusician)[][] }, (string | boolean)[], number>({
    queryKey: ["explore", musicians ? "musicians" : "bands", dq, dcity, tag],
    queryFn: ({ pageParam }) => (musicians
      ? exploreMusicians({ q: dq, city: dcity, instrument: tag, offset: pageParam })
      : exploreBands({ q: dq, city: dcity, genre: tag, offset: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled: !!supabase,
  })
  const rows = query.data?.pages.flat() ?? []
  const filtered = !!(dq.trim() || dcity.trim() || tag)

  if (!supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Comunidad</h1></div>
        <p className="notice">Ingresa con tu cuenta para descubrir bandas y músicos.</p>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Comunidad</span>
        <h1 className="page-title">Explorar</h1>
        <p className="page-sub">Bandas y músicos que decidieron hacerse visibles. Encuentra con quién tocar, a quién invitar o qué se mueve en tu ciudad.</p>
      </div>
      <div className="seg" role="navigation" aria-label="Comunidad" onClick={() => setTag('')}>
        <NavLink to="/explorar" end className={({ isActive }) => (isActive ? 'active' : '')}>Bandas</NavLink>
        <NavLink to="/explorar/musicos" className={({ isActive }) => (isActive ? 'active' : '')}>Músicos</NavLink>
      </div>

      <div className="explore-filters">
        <label className="search">
          <Search size={18} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={musicians ? 'Buscar músico por nombre' : 'Buscar banda por nombre'} aria-label="Buscar" />
        </label>
        <CityInput live value={city} onChange={setCity} ariaLabel="Filtrar por ciudad" />
      </div>
      <div className="filter-chips" role="group" aria-label={musicians ? 'Filtrar por instrumento' : 'Filtrar por género'}>
        {options.map((o) => (
          <button key={o} aria-pressed={tag === o} className={tag === o ? 'active' : ''} onClick={() => setTag(tag === o ? '' : o)}>{o}</button>
        ))}
      </div>

      {query.isLoading && <ListSkeleton rows={4} />}
      {query.error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>No pudimos cargar la comunidad. Revisa tu conexión.</p>}

      {!query.isLoading && !query.error && rows.length === 0 && (
        <div className="empty">
          <h3>{filtered ? 'Nada con esos filtros' : musicians ? 'Aún no hay músicos visibles' : 'Aún no hay bandas visibles'}</h3>
          <p>{filtered ? 'Prueba con otra ciudad, otro género o menos filtros.' : 'Nadie aparece aquí si no lo decide. Sé de los primeros: haz público tu perfil o el de tu banda y deja que te encuentren.'}</p>
          {!filtered && <Link className="btn primary" to={musicians ? '/perfil' : '/banda'}>{musicians ? 'Hacer público mi perfil' : 'Hacer pública mi banda'}</Link>}
        </div>
      )}

      <div className="explore-grid">
        {rows.map((r) => musicians
          ? <MusicianRow key={r.id} m={r as PublicMusician} />
          : <BandRow key={r.id} b={r as PublicBand} />)}
      </div>

      {query.hasNextPage && (
        <button className="btn block" style={{ marginTop: 16 }} disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {query.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
        </button>
      )}

      {rows.length > 0 && (
        <p className="notice" style={{ marginTop: 24 }}>
          ¿Quieres que te encuentren? Haz público <Link to="/perfil" style={{ color: 'var(--amber)', fontWeight: 600 }}>tu perfil</Link> o <Link to="/banda" style={{ color: 'var(--amber)', fontWeight: 600 }}>tu banda</Link>. Solo tú decides y puedes apagarlo cuando quieras.
        </p>
      )}
    </>
  )
}

function BandRow({ b }: { b: PublicBand }) {
  return (
    <Link to={`/explorar/bandas/${b.id}`} className="explore-card">
      <BandMark name={b.name} logoUrl={b.logoUrl} />
      <div className="explore-card-main">
        <div className="li-title">{b.name}</div>
        <div className="li-sub">{b.city || 'Sin ciudad'}</div>
        {b.genres.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{b.genres.slice(0, 3).map((g) => <span key={g} className="tag">{g}</span>)}</div>}
        {b.bio && <p className="explore-bio">{b.bio}</p>}
      </div>
    </Link>
  )
}

function MusicianRow({ m }: { m: PublicMusician }) {
  return (
    <Link to={`/explorar/musicos/${m.id}`} className="explore-card">
      <span className="avatar" style={{ marginLeft: 0 }} aria-hidden>{initials(m.name)}</span>
      <div className="explore-card-main">
        <div className="li-title">{m.name}</div>
        <div className="li-sub">{m.city || 'Sin ciudad'}</div>
        {m.instruments.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{m.instruments.slice(0, 3).map((i) => <span key={i} className="tag key">{i}</span>)}</div>}
        {m.bio && <p className="explore-bio">{m.bio}</p>}
      </div>
    </Link>
  )
}
