import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import InfoTip, { HelpRow } from './InfoTip'
import { METERS, meterSpec, type MeterId } from '../lib/meter'
import { safeLink, shiftText, statusLabel, type Song, type SongStatus } from '../lib/song'
import { ask } from '../lib/confirm'
import { instrumentOptions } from '../lib/identity'
import { useQuery } from '@tanstack/react-query'
import { getDefaultLineup, getLyrics } from '../lib/api'
import { useRoster } from '../lib/useRoster'
import { supabase } from '../lib/supabase'
import { useActiveBand } from '../store/useBandSession'
import MemberNotes from './MemberNotes'
import SongComments from './SongComments'
import Sheet from './Sheet'
import InstrumentPicker from './InstrumentPicker'
import LineupEditor from './LineupEditor'

const SHIFTS = Array.from({ length: 25 }, (_, k) => 12 - k)

const empty = (): Song => ({
  id: crypto.randomUUID(),
  title: '',
  artist: '',
  key: '',
  bpm: 100,
  meter: '4/4',
  minutes: 4,
  status: 'learning',
  tunings: [{ instrument: 'Todos', tuning: 'E estándar' }],
  keyChanges: [],
  links: {},
})

/** `guestNames`: invitados del setlist desde el que se edita la canción (aparecen como opción en «Quién toca»). */
type Props = { song?: Song; guestNames?: string[]; onSave: (s: Song) => Promise<unknown>; onDelete?: () => Promise<unknown>; onClose: () => void }

export default function SongForm({ song, guestNames = [], onSave, onDelete, onClose }: Props) {
  const [s, setS] = useState<Song>(() => song ?? empty())
  const band = useActiveBand()
  // Con cuenta, la lista de canciones no trae las letras: se piden al abrir el editor (y solo se envían si se tocan).
  const needsLyrics = !!song && !!supabase && song.lyrics === undefined
  const { data: loadedLyrics, isLoading: lyricsLoading, isError: lyricsError } = useQuery({ queryKey: ['song-lyrics-one', song?.id], queryFn: () => getLyrics(song!.id), enabled: needsLyrics })
  const { members, people } = useRoster(band?.id)
  // Una canción nueva nace con la formación que la banda dejó en Ajustes (si no la han tocado todavía).
  const { data: defaultLineup } = useQuery({ queryKey: ['default-lineup', band?.id], queryFn: () => getDefaultLineup(band!.id), enabled: !song && !!band && !!supabase })
  const seeded = !song && defaultLineup?.length ? defaultLineup.filter((l) => !l.profileId || people.some((p) => p.profileId === l.profileId)) : undefined
  const lineup = s.lineup ?? seeded ?? []
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
        tunings: s.tunings.filter((t) => t.tuning.trim()).map((t) => (t.profileId ? t : { instrument: t.instrument, tuning: t.tuning, ...(t.capo ? { capo: t.capo } : {}), ...(t.shift ? { shift: t.shift } : {}) })),
        lineup: lineup.filter((l) => l.instrument.trim() && (l.profileId || l.guest?.trim())).map((l) => ({ ...l, instrument: l.instrument.trim(), guest: l.profileId ? undefined : l.guest?.trim() })),
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
      <label className="field">Compás (para el pre-conteo)
        <select value={s.meter ?? '4/4'} onChange={(e) => patch({ meter: e.target.value as MeterId })}>
          {METERS.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
        </select>
        <small className="li-sub wrap">{meterSpec(s.meter).hint}.</small>
      </label>
      <label className="field">Estado
        <select value={s.status} onChange={(e) => patch({ status: e.target.value as SongStatus })}>
          {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <details className="fold">
        <summary>Quién toca{lineup.length ? <small>{lineup.length}</small> : null}</summary>
        <div className="fold-body">
      <HelpRow text="Qué instrumentos lleva la canción y quién lo toca: alguien de la banda o un invitado." />
      <LineupEditor value={lineup} onChange={(lineup) => patch({ lineup })} people={people} guestNames={guestNames} fillFrom={members} />
        </div>
      </details>

      <details className="fold">
        <summary>Afinación y cambios{s.tunings.length || s.keyChanges.length ? <small>{s.tunings.length} afin.{s.keyChanges.length ? ` · ${s.keyChanges.length} de tono` : ''}</small> : null}</summary>
        <div className="fold-body">
      <h4 className="fold-sub">Afinación por instrumento</h4>
      <HelpRow text="«Todos» sirve para toda la banda. Si una guitarra va en Drop D y el bajo en estándar, agrega una afinación por instrumento. «Pitch» es lo que se le pone al pedal de pitch shifter (por ejemplo -2): el instrumento no se reafina." />
      {s.tunings.map((t, i) => (
        <div className="subform" key={i}>
          <InstrumentPicker label="Instrumento" includeAll first={lineup.map((l) => l.instrument)} value={t.instrument} onChange={(v) => setTuning(i, { instrument: v })} />
          {people.length > 0 && (
            <label className="field">Para
              <select value={t.profileId ?? ''} onChange={(e) => setTuning(i, { profileId: e.target.value || undefined })}>
                <option value="">Todos los que toquen ese instrumento</option>
                {people.map((m) => <option key={m.profileId} value={m.profileId}>{m.name}{m.noAccount ? ' (sin cuenta)' : ''}</option>)}
              </select>
            </label>
          )}
          <div className="grid-row tuning-row">
            <label className="field grow">Afinación
              <input value={t.tuning} placeholder="Drop D" maxLength={30} onChange={(e) => setTuning(i, { tuning: e.target.value })} />
            </label>
            <label className="field" style={{ width: 84 }}>Capo
              <input type="number" inputMode="numeric" min={0} max={12} value={t.capo ?? ''} onChange={(e) => setTuning(i, { capo: Number(e.target.value) || undefined })} />
            </label>
            <label className="field" style={{ width: 96 }}>Pitch
              <select value={t.shift ?? 0} aria-label="Semitonos en el pedal de pitch shifter" onChange={(e) => setTuning(i, { shift: Number(e.target.value) || undefined })}>
                {SHIFTS.map((n) => <option key={n} value={n}>{n ? shiftText(n) : 'No'}</option>)}
              </select>
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

      <h4 className="fold-sub">Cambios de tono</h4>
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

        </div>
      </details>

      <details className="fold">
        <summary>Notas y comentarios{noteRows.length ? <small>{noteRows.length} por instrumento</small> : null}</summary>
        <div className="fold-body">
      <h4 className="fold-sub">Notas por instrumento</h4>
      <HelpRow text="Lo que cada integrante necesita saber de esta canción. En el modo escenario cada quien ve la nota de su instrumento." />
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

      {song && band && <MemberNotes songId={song.id} bandId={band.id} canWrite canManage={band.role === 'owner' || band.role === 'admin'} />}
      {song && band && <SongComments songId={song.id} bandId={band.id} canWrite={band.role !== 'guest'} canModerate={band.role === 'owner' || band.role === 'admin'} />}

        </div>
      </details>

      <details className="fold">
        <summary>Links, invitado y letra{(s.links.youtube || s.links.spotify || s.lyrics || loadedLyrics) ? <small>{[s.links.youtube && 'YouTube', s.links.spotify && 'Spotify', (s.lyrics || loadedLyrics) && 'letra'].filter(Boolean).join(' · ')}</small> : null}</summary>
        <div className="fold-body">
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
        <textarea rows={8} className="chart-input" value={s.lyrics ?? loadedLyrics ?? ''} disabled={needsLyrics && s.lyrics === undefined && (lyricsLoading || lyricsError)} onChange={(e) => patch({ lyrics: e.target.value })} maxLength={12000} spellCheck={false}
          placeholder={'[Verso]\nAm        F\nHoy vuelvo a casa\n\nO así: Hoy [Am]vuelvo a [F]casa'} />
        <InfoTip text="Pon los acordes encima de la letra o entre corchetes. Se ve en el modo escenario, y ahí puedes subir o bajar el tono. Solo la ve tu banda: usa letras que puedas compartir con ella." label="Cómo escribir la letra y los acordes" />
      </label>

        </div>
      </details>

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
