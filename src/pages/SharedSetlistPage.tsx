import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ListSkeleton from '../components/Skeleton'
import { getSharedSetlist, type SharedSetlist } from '../lib/shareLink'

/** Setlist compartido por link (solo lectura, sin cuenta). */
export default function SharedSetlistPage() {
  const { token } = useParams()
  // Esta pantalla es pública y vive fuera del proveedor de datos de la app: se pide directo.
  const [state, setState] = useState<{ data: SharedSetlist | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false })
  useEffect(() => {
    let alive = true
    getSharedSetlist(token ?? '').then((data) => alive && setState({ data, loading: false, error: false }), () => alive && setState({ data: null, loading: false, error: true }))
    return () => { alive = false }
  }, [token])
  const { data, loading: isLoading, error: isError } = state
  let n = 0
  return (
    <main className="content" style={{ maxWidth: 720, margin: '0 auto', padding: '16px' }}>
      <div className="wordmark" style={{ display: 'block', marginBottom: 12 }}>back<span>line</span></div>
      {isLoading && <ListSkeleton rows={4} />}
      {(isError || (!isLoading && !data)) && <p className="empty">Este link ya no está disponible. Pide a la banda uno nuevo.</p>}
      {data && (
        <>
          <span className="eyebrow">Setlist · {data.band}</span>
          <h1 className="page-title" style={{ margin: '4px 0 14px' }}>{data.name}</h1>
          <div className="list">
            {data.rows.map((r, i) => r.kind === 'label'
              ? <div key={i} className="section-title" style={{ margin: '8px 0 0' }}>{r.text}</div>
              : (
                <div key={i} className="li">
                  <b style={{ color: 'var(--amber)', width: 28 }}>{++n}</b>
                  <div className="li-main">
                    <div className="li-title">{r.title}</div>
                    <div className="li-sub">{[r.artist, r.key && `Tono ${r.key}`, `${r.bpm} bpm`, `${r.minutes} min`, r.tags.length ? r.tags.join(', ') : ''].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))}
          </div>
          <p className="li-sub" style={{ marginTop: 18 }}>Hecho con <Link to="/" style={{ color: 'var(--amber)' }}>Backline</Link>: repertorio, setlists y ensayos de tu banda en un solo lugar.</p>
        </>
      )}
    </main>
  )
}
