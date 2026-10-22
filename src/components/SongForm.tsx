import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { safeLink, statusLabel, type Song, type SongStatus } from '../lib/song'
import { ask } from '../lib/confirm'
import { instrumentOptions } from '../lib/identity'
import { useQuery } from '@tanstack/react-query'
import { getLyrics } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useActiveBand } from '../store/useBandSession'
import MemberNotes from './MemberNotes'
import Sheet from './Sheet'

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

type Props = { song?: Song; onSave: (s: Song) => Promise<unknown>; onDelete?: () => Promise<unknown>; onClose: () => void }

export default function SongForm({ song, onSave, onDelete, onClose }: Props) {
  const [s, setS] = useState<Song>(() => song ?? empty())
  const band = useActiveBand()
  // Con cuenta, la lista de canciones no trae las letras: se piden al abrir el editor (y solo se envían si se tocan).
  const needsLyrics = !!song && !!supabase && song.lyrics === undefined
  const { data: loadedLyrics, isLoading: lyricsLoading } = useQuery({ queryKey: ['song-lyrics-one', song?.id], queryFn: () => getLyrics(song!.id), enabled: needsLyrics })
  // Los números se editan como texto para poder borrarlos y escribir de nuevo.
  const [bpm, setBpm] = useState(String(song?.bpm ?? 100))
  const [minutes, setMinutes] = useState(String(song?.minutes ?? 4))
  const [error, setError] = useState('')
  const [noteRows, setNoteRows] = useState<{ instrument: string; text: string }[]>(() => Object.entries(song?.instrumentNotes ?? {}).map(([instrument, text]) => ({ instrument, text })))
  const setNote = (i: number, p: Partial<{ instrument: string; text: string }>) => setNoteRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const [busy, setBusy] = useState(false)
  const patch = (p: Partial<Song>) => setS((v) => ({ ...v, ...p }))
  const setTuning = (i: number, p: Partial<Song['tunings'][number]>) =>
    patch({ tunings: s.tunings.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const setChange = (i: number, p: Partial<Song['keyChanges'][number]>) =>
    patch({ keyChanges: s.keyChanges.map((x, j) => (j === i ? { ...x, ...p } : x)) })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!s.title.trim()) return setError('Falta el título de la canción.')
    const yt = s.links.youtube?.trim()
    const sp = s.links.spotify?.trim()
    if (yt && !safeLink(yt, 'youtube')) return setError('El link de YouTube no parece válido (debe empezar por https://).')
    if (sp && !safeLink(sp, 'spotify')) return setError('El link de Spotify no parece válido (debe empezar por https://).')
    setBusy(true)
    setError('')
    try {
      await onSave({
        ...s,
        title: s.title.trim(),
        artist: s.artist.trim(),
        bpm: Math.min(300, Math.max(30, Number(bpm) || 100)),
        minutes: Math.min(30, Math.max(1, Number(minutes) || 4)),
        tunings: s.tunings.filter((t) => t.tuning.trim()),
        keyChanges: s.keyChanges.filter((k) => k.from.trim() && k.to.trim()),
        links: { youtube: yt || undefined, spotify: sp || undefined },
        instrumentNotes: noteRows.reduce<Record<string, string>>((acc, r) => { if (r.instrument.trim() && r.text.trim()) acc[r.instrument.trim()] = r.text.trim(); return acc }, {}),
      })
    } catch {
      setError('No pudimos guardar la canción. Revisa tu conexión e intenta de nuevo.')
      setBusy(false)
    }
  }

  async function del() {
    if (!onDelete || !(await ask({ title: `¿Borrar «${s.title}»?`, body: 'Se quita del repertorio y de los setlists donde esté.', confirmLabel: 'Borrar' }))) return
    setBusy(true)
    try { await onDelete() } catch { setError('No pudimos borrarla. Intenta de nuevo.'); setBusy(false) }
  }

  return (
    <Sheet title={song ? 'Editar canción' : 'Agregar canción'} onClose={onClose} onSubmit={submit}>
      <label className="field">Título
        <input value={s.title} onChange={(e) => patch({ title: e.target.value })} required maxLength={120} />
      </label>
      <label className="field">Artista original
        <input value={s.artist} onChange={(e) => patch({ artist: e.target.value })} maxLength={120} />
      </label>
      <div className="grid3">
        <label className="field">Tono
          <input value={s.key} onChange={(e) => patch({ key: e.target.value })} placeholder="Dm" maxLength={6} />
        </label>
        <label className="field">BPM
          <input type="number" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value)} />
        </label>
        <label className="field">Duración (min)
          <input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
      </div>
      <label className="field">Estado
        <select value={s.status} onChange={(e) => patch({ status: e.target.value as SongStatus })}>
          {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <h3 className="section-title">Afinación por instrumento</h3>
      <datalist id="tuning-instruments">{['Todos', ...instrumentOptions].map((o) => <option key={o} value={o} />)}</datalist>
      <p className="li-sub wrap">«Todos» sirve para toda la banda. Si una guitarra va en Drop D y el bajo en estándar, agrega una afinación por instrumento.</p>
      {s.tunings.map((t, i) => (
        <div className="subform" key={i}>
          <label className="field">Instrumento
            <input value={t.instrument} placeholder="Guitarra" maxLength={30} list="tuning-instruments" onChange={(e) => setTuning(i, { instrument: e.target.value })} />
          </label>
          <div className="grid-row">
            <label className="field grow">Afinación
              <input value={t.tuning} placeholder="Drop D" maxLength={30} onChange={(e) => setTuning(i, { tuning: e.target.value })} />
            </label>
            <label className="field" style={{ width: 84 }}>Capo
              <input type="number" inputMode="numeric" min={0} max={12} value={t.capo ?? ''} onChange={(e) => setTuning(i, { capo: Number(e.target.value) || undefined })} />
            </label>
            <button type="button" className="btn ghost icon" style={{ alignSelf: 'end' }} aria-label={`Quitar afinación ${i + 1}`} onClick={() => patch({ tunings: s.tunings.filter((_, j) => j !== i) })}>
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => patch({ tunings: [...s.tunings, { instrument: '', tuning: '' }] })}>
        <Plus size={16} aria-hidden /> Otra afinación
      </button>

      <h3 className="section-title">Cambios de tono</h3>
      {s.keyChanges.map((k, i) => (
        <div className="grid-row" key={i} style={{ alignItems: 'end' }}>
          <label className="field grow">Sección
            <input value={k.section} placeholder="Puente" maxLength={30} onChange={(e) => setChange(i, { section: e.target.value })} />
          </label>
          <label className="field" style={{ width: 64 }}>De
            <input value={k.from} placeholder="B" maxLength={6} onChange={(e) => setChange(i, { from: e.target.value })} />
          </label>
          <label className="field" style={{ width: 64 }}>A
            <input value={k.to} placeholder="D" maxLength={6} onChange={(e) => setChange(i, { to: e.target.value })} />
          </label>
          <button type="button" className="btn ghost icon" aria-label={`Quitar cambio de tono ${i + 1}`} onClick={() => patch({ keyChanges: s.keyChanges.filter((_, j) => j !== i) })}>
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => patch({ keyChanges: [...s.keyChanges, { section: '', from: s.key, to: '' }] })}>
        <Plus size={16} aria-hidden /> Agregar cambio de tono
      </button>

      <h3 className="section-title">Notas por instrumento</h3>
      <p className="li-sub wrap">Lo que cada integrante necesita saber de esta canción. En el modo escenario cada quien ve la nota de su instrumento.</p>
      {noteRows.map((r, i) => (
        <div className="subform" key={i}>
          <div className="grid-row">
            <label className="field grow">Instrumento
              <select value={r.instrument} onChange={(e) => setNote(i, { instrument: e.target.value })}>
                {!instrumentOptions.includes(r.instrument) && <option value={r.instrument}>{r.instrument || 'Elige…'}</option>}
                {instrumentOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <button type="button" className="btn ghost icon" style={{ alignSelf: 'end' }} aria-label={`Quitar nota ${i + 1}`} onClick={() => setNoteRows((x) => x.filter((_, j) => j !== i))}>
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
          <label className="field">Nota
            <textarea rows={2} value={r.text} maxLength={400} placeholder="Entra con el hi-hat en el coro" onChange={(e) => setNote(i, { text: e.target.value })} />
          </label>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => setNoteRows((r) => [...r, { instrument: instrumentOptions.find((o) => !r.some((x) => x.instrument === o)) ?? 'Otro', text: '' }])}>
        <Plus size={16} aria-hidden /> Agregar nota por instrumento
      </button>

      {song && band && <MemberNotes songId={song.id} bandId={band.id} canWrite={band.role !== 'guest'} />}

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
      <label className="field">Letra y acordes (opcional)
        <textarea rows={8} className="chart-input" value={s.lyrics ?? loadedLyrics ?? ''} disabled={needsLyrics && s.lyrics === undefined && lyricsLoading} onChange={(e) => patch({ lyrics: e.target.value })} maxLength={12000} spellCheck={false}
          placeholder={'[Verso]\nAm        F\nHoy vuelvo a casa\n\nO así: Hoy [Am]vuelvo a [F]casa'} />
        <span className="li-sub wrap">Pon los acordes encima de la letra o entre corchetes. Se ve en el modo escenario, y ahí puedes subir o bajar el tono. Solo la ve tu banda: usa letras que puedas compartir con ella.</span>
      </label>

      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row">
          {onDelete && <button type="button" className="btn danger" disabled={busy} onClick={() => void del()}>Borrar</button>}
          <button className="btn primary grow" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Sheet>
  )
}
