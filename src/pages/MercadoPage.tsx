import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Store } from 'lucide-react'
import CommunityNav from '../components/CommunityNav'
import ListingForm from '../components/ListingForm'
import ListSkeleton from '../components/Skeleton'
import { amAdult } from '../lib/feed'
import { categories, listListings, marketUrls, price, conditionLabel } from '../lib/market'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

/** Mercado de equipo entre músicos adultos: guitarras, bajos, amplis, pedales… Sin pagos dentro de la app. */
export default function MercadoPage() {
  const me = useAuth((s) => s.session?.user.id)
  const nav = useNavigate()
  const [category, setCategory] = useState('')
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [adding, setAdding] = useState(false)
  const { data: adult } = useQuery({ queryKey: ['am-adult', me], queryFn: () => amAdult(me!), enabled: !!supabase && !!me, staleTime: 30 * 60_000 })
  const list = useQuery({ queryKey: ['listings', category, mine, dq, me], queryFn: () => listListings({ category, q: dq, mine: mine ? me : undefined }), enabled: !!supabase && !!me })
  const items = list.data ?? []
  const paths = items.flatMap((l) => (l.images[0] ? [l.images[0]] : []))
  const { data: urls } = useQuery({ queryKey: ['market-urls', paths.join(',')], queryFn: () => marketUrls(paths), enabled: paths.length > 0, staleTime: 50 * 60_000 })

  if (!supabase) return <><CommunityNav title="Mercado" /><p className="empty">El Mercado necesita una cuenta. Inicia sesión para usarlo.</p></>
  return (
    <>
      <CommunityNav title="Mercado" sub="Compra, vende o cambia equipo con otros músicos. Backline no cobra ni procesa pagos." />
      {adult === false && <p className="notice" style={{ marginTop: 12 }}>El Mercado es para personas mayores de edad.</p>}
      <div className="explore-filters">
        <form className="search" onSubmit={(e) => { e.preventDefault(); setDq(q) }}>
          <Search size={18} aria-hidden />
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setDq('') }} placeholder="Buscar guitarra, ampli, pedal…" aria-label="Buscar en el Mercado" />
        </form>
        {adult && <button className="btn primary" onClick={() => setAdding(true)}><Plus size={18} aria-hidden /> Publicar</button>}
      </div>
      <div className="filter-chips" role="group" aria-label="Categoría">
        <button className={!category && !mine ? 'active' : ''} aria-pressed={!category && !mine} onClick={() => { setCategory(''); setMine(false) }}>Todo</button>
        {adult && <button className={mine ? 'active' : ''} aria-pressed={mine} onClick={() => setMine(!mine)}>Mis anuncios</button>}
        {categories.map(([v, t]) => <button key={v} className={category === v ? 'active' : ''} aria-pressed={category === v} onClick={() => { setCategory(category === v ? '' : v); setMine(false) }}>{t}</button>)}
      </div>
      {list.isLoading && <ListSkeleton rows={3} />}
      {list.isError && <p className="empty">No pudimos cargar el Mercado. Revisa tu conexión.</p>}
      {list.data && items.length === 0 && (
        <div className="empty">
          <h3>{mine ? 'No has publicado anuncios' : 'No hay anuncios por ahora'}</h3>
          <p>{mine ? 'Publica el equipo que ya no uses.' : 'Cuando alguien publique equipo, aparece aquí.'}</p>
        </div>
      )}
      <div className="market-grid">
        {items.map((l) => (
          <Link key={l.id} to={`/explorar/mercado/${l.id}`} className={`lcard ${l.status !== 'active' ? 'sold' : ''}`}>
            <div className="lcard-photo">{l.images[0] && urls?.get(l.images[0]) ? <img src={urls.get(l.images[0])} alt="" loading="lazy" decoding="async" /> : <Store size={34} aria-hidden />}</div>
            <div className="lcard-body">
              <span className="lcard-price">{price(l.price)}</span>
              <span className="lcard-title">{l.title}</span>
              <span className="lcard-sub">{[conditionLabel[l.condition], l.city].filter(Boolean).join(' · ')}{l.status === 'sold' ? ' · Vendido' : l.status === 'paused' ? ' · En pausa' : ''}</span>
            </div>
          </Link>
        ))}
      </div>
      {adding && <ListingForm defaultCity="" onClose={() => setAdding(false)} onDone={(id) => { setAdding(false); void list.refetch(); nav(`/explorar/mercado/${id}`) }} />}
    </>
  )
}
