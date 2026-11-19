import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Link2, X } from 'lucide-react'
import { createPost, visibilityLabel, type Visibility } from '../lib/feed'
import { useAuth } from '../store/useAuth'
import { useBands } from '../store/useBandSession'
import InfoTip from './InfoTip'

/** Caja para publicar en el muro: texto, hasta 4 fotos y un link de YouTube o Spotify; tú eliges quién lo ve. */
export default function Composer({ onPosted }: { onPosted: () => void }) {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const { bands } = useBands()
  const adminBands = bands.filter((b) => b.role === 'owner' || b.role === 'admin')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [as, setAs] = useState('') // '' = yo; si no, el id de la banda
  const [visibility, setVisibility] = useState<Visibility>('friends')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])

  const options: Visibility[] = as ? ['public', 'band'] : ['friends', 'public']
  const vis = options.includes(visibility) ? visibility : options[0]
  const ready = (body.trim() || files.length || link.trim()) && (!files.length || consent)

  const post = useMutation({
    mutationFn: () => createPost(me!, { body, link, visibility: vis, bandId: as || null, files }),
    onSuccess: async () => { setBody(''); setLink(''); setShowLink(false); setFiles([]); setConsent(false); setError(''); await qc.invalidateQueries({ queryKey: ['feed'] }); onPosted() },
    onError: (e) => {
      const m = String((e as { message?: string })?.message ?? '')
      setError(/demasiadas/.test(m) ? 'Publicaste mucho hoy. Intenta mañana.' : /violates|row-level/.test(m) ? 'Solo las personas mayores de edad pueden publicar para amigos o para el público.' : /link/.test(m) ? 'El link debe ser de YouTube o Spotify (empieza por https://).' : 'No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.')
    },
  })

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); if (ready && !post.isPending) post.mutate() }}>
      <textarea rows={3} value={body} maxLength={1500} placeholder="¿Qué está pasando?" aria-label="Escribe tu publicación" onChange={(e) => setBody(e.target.value)} />
      {previews.length > 0 && (
        <div className="composer-previews">
          {previews.map((u, i) => (
            <span key={u} className="composer-thumb"><img src={u} alt="" /><button type="button" aria-label="Quitar foto" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} aria-hidden /></button></span>
          ))}
        </div>
      )}
      {showLink && <input type="url" inputMode="url" value={link} maxLength={300} placeholder="Link de YouTube o Spotify" aria-label="Link" onChange={(e) => setLink(e.target.value)} />}
      {files.length > 0 && (
        <label className="check-row consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Tengo permiso de las personas que aparecen y derecho sobre las fotos <InfoTip label="Por qué lo pedimos" text="Cada persona es responsable de lo que sube. No publiques fotos de menores de edad ni de personas que no quieran aparecer. A las fotos se les quita la ubicación antes de subirlas." /></span>
        </label>
      )}
      <div className="composer-bar">
        <label className="btn ghost sm" aria-disabled={files.length >= 4}>
          <ImagePlus size={18} aria-hidden /> Fotos
          <input type="file" accept="image/*" multiple hidden disabled={files.length >= 4} onChange={(e) => { setFiles([...files, ...[...(e.target.files ?? [])]].slice(0, 4)); e.target.value = '' }} />
        </label>
        <button type="button" className={`btn ghost sm ${showLink ? 'on' : ''}`} onClick={() => setShowLink((v) => !v)} aria-pressed={showLink}><Link2 size={18} aria-hidden /> Link</button>
        {adminBands.length > 0 && (
          <select className="composer-vis" value={as} onChange={(e) => setAs(e.target.value)} aria-label="Publicar como">
            <option value="">Como yo</option>
            {adminBands.map((b) => <option key={b.id} value={b.id}>Como {b.name}</option>)}
          </select>
        )}
        <select className="composer-vis" value={vis} onChange={(e) => setVisibility(e.target.value as Visibility)} aria-label="Quién lo ve">
          {options.map((v) => <option key={v} value={v}>{visibilityLabel[v]}</option>)}
        </select>
        <button className="btn primary sm" disabled={!ready || post.isPending}>{post.isPending ? 'Publicando…' : 'Publicar'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}
