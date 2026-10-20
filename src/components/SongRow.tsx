import { useState } from 'react'
import { ExternalLink, Pause, Pencil, Play } from 'lucide-react'
import { embedsFor } from '../lib/embed'
import { isStandard, keyChangeLabel, statusLabel, tuningSummary, type Song } from '../lib/song'

type Props = { song: Song; onEdit?: () => void }

/** Una canción del repertorio: tono y BPM como lectura de equipo, afinación solo destacada si no es estándar. */
export default function SongRow({ song, onEdit }: Props) {
  const embeds = embedsFor(song.links)
  const [open, setOpen] = useState<number | null>(null)
  const current = open === null ? undefined : embeds[open]
  const standard = isStandard(song)
  return (
    <div className="song">
      <div className="li" style={{ borderBottom: current ? 0 : undefined }}>
        <span className={`dot ${song.status}`} title={statusLabel[song.status]} aria-label={statusLabel[song.status]} role="img" />
        <div className="li-main">
          <div className="li-title">{song.title}</div>
          <div className="li-sub">{song.artist || 'Sin artista'}</div>
          <div className="sub-row">
            <span className={standard ? '' : 'flag'}>{tuningSummary(song)}</span>
            {song.keyChanges.map((k, i) => <span key={i} className="flag">{keyChangeLabel(k)}</span>)}
            {song.guest && <span>{song.guest}</span>}
            {song.status !== 'ready' && <span>{statusLabel[song.status]}</span>}
          </div>
        </div>
        <div className="readout key" aria-label={`Tono ${song.key || 'sin definir'}, ${song.bpm} bpm`}>
          <b>{song.key || '—'}</b>
          {song.bpm} bpm
        </div>
        {embeds.map((e, i) => (
          <button key={e.provider} className={`btn ${open === i ? 'primary' : 'ghost'}`} aria-pressed={open === i}
            aria-label={`${open === i ? 'Cerrar' : 'Escuchar'} ${song.title} en ${e.label}`} onClick={() => setOpen(open === i ? null : i)}>
            {open === i ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
          </button>
        ))}
        {onEdit && (
          <button className="btn ghost" onClick={onEdit} aria-label={`Editar ${song.title}`}>
            <Pencil size={17} aria-hidden />
          </button>
        )}
      </div>
      {song.notes && !current && <div className="li-sub wrap" style={{ padding: '0 0 12px 20px', borderBottom: '1px solid var(--line)', marginTop: -4 }}>{song.notes}</div>}
      {current && (
        <div className="player" style={{ paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
          {/* Se carga solo al pulsar play: no se descarga nada de YouTube/Spotify hasta entonces. */}
          <iframe
            src={current.src}
            title={`${song.title} en ${current.label}`}
            height={current.height}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          />
          <a className="player-link" href={current.openUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden /> Abrir en {current.label}
          </a>
        </div>
      )}
    </div>
  )
}
