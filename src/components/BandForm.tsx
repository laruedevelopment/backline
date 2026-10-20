import { useState } from 'react'
import type { Band, BandLinks } from '../lib/api'
import { genreOptions } from '../lib/identity'
import { cleanSocial, socialKinds, socialLabels } from '../lib/links'
import Sheet from './Sheet'

type Draft = { name: string; city: string; genres: string[]; bio: string; links: BandLinks }
type Props = { band: Band; onSave: (d: Draft) => Promise<unknown>; onClose: () => void }

const placeholders: Record<string, string> = {
  instagram: '@tubanda', facebook: 'facebook.com/tubanda', youtube: 'youtube.com/@tubanda', spotify: 'open.spotify.com/artist/…', tiktok: '@tubanda', web: 'tubanda.com',
}

export default function BandForm({ band, onSave, onClose }: Props) {
  const [name, setName] = useState(band.name)
  const [city, setCity] = useState(band.city ?? '')
  const [genres, setGenres] = useState<string[]>(band.genres)
  const [bio, setBio] = useState(band.bio ?? '')
  const [links, setLinks] = useState<Record<string, string>>(() => ({ ...band.links }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (g: string) => setGenres((v) => (v.includes(g) ? v.filter((x) => x !== g) : v.length < 6 ? [...v, g] : v))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const clean: BandLinks = {}
    for (const k of socialKinds) {
      const raw = links[k] ?? ''
      if (!raw.trim()) continue
      const url = cleanSocial(k, raw)
      if (!url) return setError(`El link de ${socialLabels[k]} no parece válido.`)
      clean[k] = url
    }
    setBusy(true)
    setError('')
    try {
      await onSave({ name, city, genres, bio, links: clean })
      onClose()
    } catch {
      setError('No pudimos guardar los cambios. Intenta de nuevo.')
      setBusy(false)
    }
  }

  return (
    <Sheet title="Ajustes de la banda" onClose={onClose} onSubmit={submit}>
        <label className="field">Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <label className="field">Ciudad
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
        </label>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="field" style={{ marginBottom: 6 }}>Géneros (hasta 6)</legend>
          <div className="chips" style={{ marginTop: 0 }}>
            {genreOptions.map((g) => (
              <button key={g} type="button" className={`tag ${genres.includes(g) ? 'key' : ''}`} aria-pressed={genres.includes(g)} style={{ background: 'none', cursor: 'pointer' }} onClick={() => toggle(g)}>{g}</button>
            ))}
          </div>
        </fieldset>
        <label className="field">Sobre la banda
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Quiénes son, qué tocan, desde cuándo." />
        </label>
        <div className="section-title" style={{ margin: '8px 0 0' }}>Redes y enlaces</div>
        {socialKinds.map((k) => (
          <label key={k} className="field">{socialLabels[k]}
            <input value={links[k] ?? ''} onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value }))} placeholder={placeholders[k]} inputMode="url" autoCapitalize="none" />
          </label>
        ))}
        <div className="sheet-foot">
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
    </Sheet>
  )
}
