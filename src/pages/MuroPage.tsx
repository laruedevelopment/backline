import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import CommunityNav from '../components/CommunityNav'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'
import ListSkeleton from '../components/Skeleton'
import { amAdult, bandNames, feedUrls, listForYou, listPublic, PAGE_SIZE, postStats, profileCards } from '../lib/feed'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { useBands } from '../store/useBandSession'

/** Muro de la comunidad: lo de tus amigos, tus bandas y quienes sigues («Para ti»), y lo público («Descubrir»). */
export default function MuroPage() {
  const me = useAuth((s) => s.session?.user.id)
  const { bands } = useBands()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'you' | 'public'>('you')
  const { data: adult } = useQuery({ queryKey: ['am-adult', me], queryFn: () => amAdult(me!), enabled: !!supabase && !!me, staleTime: 30 * 60_000 })
  const feed = useInfiniteQuery({
    queryKey: ['feed', tab],
    queryFn: ({ pageParam }) => (tab === 'you' ? listForYou(pageParam) : listPublic(pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length >= PAGE_SIZE ? last[last.length - 1].createdAt : undefined),
    enabled: !!supabase,
    staleTime: 30_000,
  })
  const posts = feed.data?.pages.flat() ?? []
  const ids = posts.map((p) => p.id)
  const key = ids.join(',')
  const { data: stats } = useQuery({ queryKey: ['feed-stats', key], queryFn: () => postStats(ids), enabled: ids.length > 0 })
  const { data: cards } = useQuery({ queryKey: ['feed-cards', key], queryFn: () => profileCards(posts.map((p) => p.author)), enabled: ids.length > 0 })
  const { data: bn } = useQuery({ queryKey: ['feed-bands', key], queryFn: () => bandNames(posts.flatMap((p) => (p.bandId ? [p.bandId] : []))), enabled: ids.length > 0 })
  const imgs = posts.flatMap((p) => p.images)
  const { data: urls } = useQuery({ queryKey: ['feed-urls', imgs.join(',')], queryFn: () => feedUrls(imgs), enabled: imgs.length > 0, staleTime: 50 * 60_000 })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['feed'] }); void qc.invalidateQueries({ queryKey: ['feed-stats'] }) }

  if (!supabase) return <><CommunityNav title="Muro" /><p className="empty">El muro necesita una cuenta. Inicia sesión para usarlo.</p></>
  return (
    <>
      <CommunityNav title="Muro" sub="Lo que comparten los músicos: ensayos, toques y canciones nuevas." />
      {adult === false && <p className="notice" style={{ marginTop: 12 }}>El muro público es para personas mayores de edad. Aquí verás lo que tus bandas publiquen para sus integrantes.</p>}
      {adult && <Composer onPosted={refresh} />}
      <div className="filter-chips" role="group" aria-label="Qué ver" style={{ marginTop: 14 }}>
        <button className={tab === 'you' ? 'active' : ''} aria-pressed={tab === 'you'} onClick={() => setTab('you')}>Para ti</button>
        <button className={tab === 'public' ? 'active' : ''} aria-pressed={tab === 'public'} onClick={() => setTab('public')}>Descubrir</button>
      </div>
      {feed.isLoading && <ListSkeleton rows={3} />}
      {feed.isError && <p className="empty">No pudimos cargar el muro. Revisa tu conexión.</p>}
      {feed.data && posts.length === 0 && (
        <div className="empty">
          <h3>{tab === 'you' ? 'Tu muro está vacío' : 'Todavía no hay publicaciones públicas'}</h3>
          <p>{tab === 'you' ? <>Publica algo, agrega amigos o sigue a bandas y músicos desde <Link to="/explorar" style={{ color: 'var(--amber)' }}>Bandas</Link> y <Link to="/explorar/musicos" style={{ color: 'var(--amber)' }}>Músicos</Link>.</> : 'Sé el primero en publicar algo para toda la comunidad.'}</p>
        </div>
      )}
      <div className="feed">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} stats={stats?.get(p.id)} author={cards?.get(p.author)} bandName={p.bandId ? bn?.get(p.bandId) : undefined}
            urls={urls ?? new Map()} canModerate={!!p.bandId && bands.some((b) => b.id === p.bandId && (b.role === 'owner' || b.role === 'admin'))} onChanged={refresh} />
        ))}
      </div>
      {feed.hasNextPage && <button className="btn block" style={{ marginTop: 12 }} disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? 'Cargando…' : 'Ver más'}</button>}
    </>
  )
}
