import { useMemo, useState } from 'react'
import { Camera, Check, Link2, Plus, X } from 'lucide-react'
import { fetchYoutubePlaylist, playlistIdFromUrl, youtubeEnabled } from '../lib/youtubePlaylist'
import { readTextFromImage } from '../lib/ocr'
import type { Song } from '../lib/song'
import { matchSongs, parseSetlistText } from '../lib/importSetlist'

type Props = {
  songs: Song[]
  saveSong: (s: Song) => Promise<unknown>
  saveSetlist: (l: { id: string; name: string; songIds: string[] }) => Promise<unknown>
  onDone: (setlistId: string) => void
  onClose: () => void
}

export default function ImportSetlist({ songs, saveSong, saveSetlist, onDone, onClose }: Props) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState<number | null>(null)
  const [link, setLink] = useState('')
  const [fetching, setFetching] = useState(false)

  const parsed = useMemo(() => parseSetlistText(text), [text])
  const matches = useMemo(() => matchSongs(parsed.lines, songs), [parsed, songs])
  const fresh = matches.filter((m) => !m.song).length
  const title = name || parsed.name || 'Setlist importado'

  const append = (more: string) => setText((t) => (t ? `${t}\n${more}` : more))

  async function fromImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setReading(0)
    try {
      const out = await readTextFromImage(file, setReading)
      if (!out.trim()) setError('No pudimos leer texto en esa imagen. Prueba con una foto más nítida y de frente.')
      else append(out)
    } catch {
      setError('No pudimos leer la imagen. Revisa que sea una foto o captura de menos de 12 MB.')
    }
    setReading(null)
  }

  async function fromLink() {
    const { kind, id } = playlistIdFromUrl(link)
    setError('')
    if (kind === 'spotify') return setError('Spotify no deja leer playlists de otras personas. Toma una captura de la lista y súbela con "Foto o captura de pantalla".')
    if (kind !== 'youtube' || !id) return setError('Pega el link de una playlist de YouTube (debe incluir "list=").')
    setFetching(true)
    try {
      const lines = await fetchYoutubePlaylist(id)
      if (!lines.length) setError('La playlist está vacía.')
      else append(lines.join('\n'))
      setLink('')
    } catch (e) {
      setError((e as Error).message === 'privada' ? 'No pudimos abrir esa playlist. Debe ser pública o "no listada".' : 'No pudimos leer la playlist de YouTube. Intenta de nuevo en un rato.')
    }
    setFetching(false)
  }

  async function create() {
    if (busy || !matches.length) return
    setBusy(true)
    setError('')
    try {
      const ids: string[] = []
      for (const m of matches) {
        if (m.song) { ids.push(m.song.id); continue }
        const song: Song = {
          id: crypto.randomUUID(), title: m.line.title, artist: m.line.artist, key: '', bpm: 100, minutes: 4,
          status: 'learning', tunings: [{ instrument: 'Todos', tuning: 'E estándar' }], keyChanges: [], links: {},
        }
        await saveSong(song)
        ids.push(song.id)
      }
      const id = crypto.randomUUID()
      await saveSetlist({ id, name: title.slice(0, 80), songIds: ids })
      onDone(id)
    } catch {
      setError('No pudimos terminar la importación. Revisa tu repertorio e intenta de nuevo.')
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Importar setlist">
      <div className="sheet">
        <div className="row">
          <h2 className="grow">Importar setlist</h2>
          <button className="btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </div>
        <p className="sub note">Pega la lista del chat, de tus notas o de un documento, o sube una foto o captura (se lee en tu celular). Revisa el texto antes de crear: el reconocimiento de letra a mano falla más que el texto impreso. Una canción por línea. Funciona con "Canción - Artista", "Canción (Artista)" o solo el nombre.</p>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Setlist Bar La Esquina:\n1. Seven Nation Army - The White Stripes\n2. Come Together (Beatles)\n3. Black Hole Sun'} aria-label="Lista de canciones" />
        {youtubeEnabled && (
          <div className="row">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link de playlist de YouTube o Spotify" aria-label="Link de playlist" inputMode="url" />
            <button className="btn" disabled={fetching || !link.trim()} onClick={() => void fromLink()}>
              <Link2 size={18} aria-hidden /> {fetching ? 'Leyendo…' : 'Traer'}
            </button>
          </div>
        )}
        <label className="btn" style={reading === null ? undefined : { opacity: 0.6 }}>
          <Camera size={18} aria-hidden /> {reading === null ? 'Foto o captura de pantalla' : `Leyendo imagen… ${reading}%`}
          <input type="file" accept="image/*" hidden disabled={reading !== null} onChange={(e) => void fromImage(e)} />
        </label>
        {matches.length > 0 && (
          <>
            <label className="field">Nombre del setlist
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={parsed.name || 'Setlist importado'} maxLength={80} />
            </label>
            <div className="section-title" style={{ margin: '4px 0' }}>{matches.length} canciones · {fresh} nuevas</div>
            <div className="stack">
              {matches.map((m, i) => (
                <div key={i} className="card row">
                  <div className="num">{i + 1}</div>
                  <div className="grow">
                    <div className="title">{m.line.title}</div>
                    <div className="sub">{m.song?.artist || m.line.artist || 'Sin artista'}</div>
                  </div>
                  {m.song ? <span className="chip ok"><Check size={12} aria-hidden /> En repertorio</span> : <span className="chip key"><Plus size={12} aria-hidden /> Nueva</span>}
                </div>
              ))}
            </div>
            {fresh > 0 && <p className="sub note">Las canciones nuevas se agregan al repertorio como "Aprendiendo"; después les pones tono, BPM y afinación.</p>}
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !matches.length} onClick={() => void create()}>
          {busy ? 'Importando…' : matches.length ? `Crear "${title}"` : 'Pega tu lista para empezar'}
        </button>
      </div>
    </div>
  )
}
