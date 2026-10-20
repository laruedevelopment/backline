import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { safeLink, statusLabel, type Song, type SongStatus } from '../lib/song'

const empty = (): Song => ({
  id: crypto.randomUUID(),
  title: '',
  artist: '',
  key: '',
  bpm: 100,
  minutes: 4,
  status: 'learning',
  tunings: [{ instrument: 'Todos', tuning: 'E estándar' }],
  keyChanges: [],
  links: {},
})

type Props = { song?: Song; onSave: (s: Song) => void; onDelete?: () => void; onClose: () => void }

export default function SongForm({ song, onSave, onDelete, onClose }: Props) {
  const [s, setS] = useState<Song>(() => song ?? empty())
  const [error, setError] = useState('')
  const patch = (p: Partial<Song>) => setS((v) => ({ ...v, ...p }))
  const setTuning = (i: number, p: Partial<Song['tunings'][number]>) =>
    patch({ tunings: s.tunings.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const setChange = (i: number, p: Partial<Song['keyChanges'][number]>) =>
    patch({ keyChanges: s.keyChanges.map((x, j) => (j === i ? { ...x, ...p } : x)) })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!s.title.trim()) return setError('Falta el título de la canción.')
    const yt = s.links.youtube?.trim()
    const sp = s.links.spotify?.trim()
    if (yt && !safeLink(yt, 'youtube')) return setError('El link de YouTube no parece válido (debe empezar por https://).')
    if (sp && !safeLink(sp, 'spotify')) return setError('El link de Spotify no parece válido (debe empezar por https://).')
    onSave({
      ...s,
      title: s.title.trim(),
      artist: s.artist.trim(),
      bpm: Math.min(300, Math.max(30, Number(s.bpm) || 100)),
      minutes: Math.min(30, Math.max(1, Number(s.minutes) || 4)),
      tunings: s.tunings.filter((t) => t.tuning.trim()),
      keyChanges: s.keyChanges.filter((k) => k.from.trim() && k.to.trim()),
      links: { youtube: yt || undefined, spotify: sp || undefined },
    })
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={song ? 'Editar canción' : 'Agregar canción'}>
      <form className="sheet" onSubmit={submit}>
        <div className="row">
          <h2 className="grow">{song ? 'Editar canción' : 'Agregar canción'}</h2>
          <button type="button" className="btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>

        <label className="field">Título
          <input value={s.title} onChange={(e) => patch({ title: e.target.value })} autoFocus required maxLength={120} />
        </label>
        <label className="field">Artista original
          <input value={s.artist} onChange={(e) => patch({ artist: e.target.value })} maxLength={120} />
        </label>
        <div className="grid3">
          <label className="field">Tono
            <input value={s.key} onChange={(e) => patch({ key: e.target.value })} placeholder="Dm" maxLength={6} />
          </label>
          <label className="field">BPM
            <input type="number" inputMode="numeric" value={s.bpm} onChange={(e) => patch({ bpm: Number(e.target.value) })} />
          </label>
          <label className="field">Minutos
            <input type="number" inputMode="numeric" value={s.minutes} onChange={(e) => patch({ minutes: Number(e.target.value) })} />
          </label>
        </div>
        <label className="field">Estado
          <select value={s.status} onChange={(e) => patch({ status: e.target.value as SongStatus })}>
            {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <h3 className="section-title">Afinación por instrumento</h3>
        {s.tunings.map((t, i) => (
          <div className="grid-row" key={i}>
            <input aria-label="Instrumento" value={t.instrument} placeholder="Guitarra" maxLength={30}
              onChange={(e) => setTuning(i, { instrument: e.target.value })} />
            <input aria-label="Afinación" value={t.tuning} placeholder="Drop D" maxLength={30}
              onChange={(e) => setTuning(i, { tuning: e.target.value })} />
            <input aria-label="Capo" type="number" inputMode="numeric" min={0} max={12} value={t.capo ?? ''} placeholder="Capo" className="narrow"
              onChange={(e) => setTuning(i, { capo: Number(e.target.value) || undefined })} />
            <button type="button" className="btn" aria-label="Quitar afinación" onClick={() => patch({ tunings: s.tunings.filter((_, j) => j !== i) })}>
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => patch({ tunings: [...s.tunings, { instrument: '', tuning: '' }] })}>
          <Plus size={16} aria-hidden /> Otra afinación
        </button>

        <h3 className="section-title">Cambios de tono</h3>
        {s.keyChanges.map((k, i) => (
          <div className="grid-row" key={i}>
            <input aria-label="Sección" value={k.section} placeholder="Puente" maxLength={30}
              onChange={(e) => setChange(i, { section: e.target.value })} />
            <input aria-label="De" value={k.from} placeholder="B" className="narrow" maxLength={6}
              onChange={(e) => setChange(i, { from: e.target.value })} />
            <input aria-label="A" value={k.to} placeholder="D" className="narrow" maxLength={6}
              onChange={(e) => setChange(i, { to: e.target.value })} />
            <button type="button" className="btn" aria-label="Quitar cambio" onClick={() => patch({ keyChanges: s.keyChanges.filter((_, j) => j !== i) })}>
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => patch({ keyChanges: [...s.keyChanges, { section: '', from: s.key, to: '' }] })}>
          <Plus size={16} aria-hidden /> Agregar cambio de tono
        </button>

        <h3 className="section-title">Escuchar y notas</h3>
        <label className="field">Link de YouTube
          <input type="url" value={s.links.youtube ?? ''} onChange={(e) => patch({ links: { ...s.links, youtube: e.target.value } })} placeholder="https://youtu.be/…" />
        </label>
        <label className="field">Link de Spotify
          <input type="url" value={s.links.spotify ?? ''} onChange={(e) => patch({ links: { ...s.links, spotify: e.target.value } })} placeholder="https://open.spotify.com/…" />
        </label>
        <label className="field">Invitado (opcional)
          <input value={s.guest ?? ''} onChange={(e) => patch({ guest: e.target.value || undefined })} placeholder="Trompeta en la segunda estrofa" maxLength={80} />
        </label>
        <label className="field">Notas
          <textarea rows={3} value={s.notes ?? ''} onChange={(e) => patch({ notes: e.target.value || undefined })} maxLength={2000} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row">
          {onDelete && (
            <button type="button" className="btn danger" onClick={() => confirm(`¿Borrar "${s.title}" del repertorio?`) && onDelete()}>
              <Trash2 size={16} aria-hidden /> Borrar
            </button>
          )}
          <button type="submit" className="btn primary grow">Guardar</button>
        </div>
      </form>
    </div>
  )
}
