import { useState } from 'react'
import { ExternalLink, Pause, Pencil, Play } from 'lucide-react'
import { embedsFor } from '../lib/embed'
import { isStandard, keyChangeLabel, statusLabel, tuningLabel, type Song } from '../lib/song'

type Props = { song: Song; index?: number; onEdit?: () => void }

export default function SongRow({ song, index, onEdit }: Props) {
  const embeds = embedsFor(song.links)
  const [open, setOpen] = useState<number | null>(null)
  const current = open === null ? undefined : embeds[open]
  return (
    <div className="card">
      <div className="row">
        {index !== undefined && <div className="num">{index}</div>}
        <div className="grow">
          <div className="title">{song.title}</div>
          <div className="sub">{song.artist}</div>
          <div className="chips">
            {song.key && <span className="chip key">{song.key}</span>}
            <span className="chip">{song.bpm} bpm</span>
            <span className={`chip ${isStandard(song) ? '' : 'warn'}`}>{tuningLabel(song)}</span>
            {song.keyChanges.map((k, i) => <span key={i} className="chip warn">{keyChangeLabel(k)}</span>)}
            {song.guest && <span className="chip">{song.guest}</span>}
            <span className={`chip ${song.status === 'ready' ? 'ok' : ''}`}>{statusLabel[song.status]}</span>
          </div>
          {song.notes && <div className="sub note">{song.notes}</div>}
        </div>
        {embeds.map((e, i) => (
          <button key={e.provider} className={`btn ${open === i ? 'primary' : ''}`} aria-pressed={open === i}
            aria-label={`${open === i ? 'Cerrar' : 'Escuchar'} ${song.title} en ${e.label}`} onClick={() => setOpen(open === i ? null : i)}>
            {open === i ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
          </button>
        ))}
        {onEdit && (
          <button className="btn" onClick={onEdit} aria-label={`Editar ${song.title}`}>
            <Pencil size={18} aria-hidden />
          </button>
        )}
      </div>
      {current && (
        <div className="player">
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
