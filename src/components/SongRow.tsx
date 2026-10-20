import { ExternalLink, Pencil } from 'lucide-react'
import { isStandard, keyChangeLabel, safeLink, statusLabel, tuningLabel, type Song } from '../lib/song'

type Props = { song: Song; index?: number; onEdit?: () => void }

export default function SongRow({ song, index, onEdit }: Props) {
  const listen = safeLink(song.links.youtube, 'youtube') ?? safeLink(song.links.spotify, 'spotify')
  return (
    <div className="card row">
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
      {listen && (
        <a className="btn" href={listen} target="_blank" rel="noopener noreferrer" aria-label={`Escuchar ${song.title}`}>
          <ExternalLink size={18} aria-hidden />
        </a>
      )}
      {onEdit && (
        <button className="btn" onClick={onEdit} aria-label={`Editar ${song.title}`}>
          <Pencil size={18} aria-hidden />
        </button>
      )}
    </div>
  )
}
