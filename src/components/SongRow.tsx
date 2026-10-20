import { Play } from 'lucide-react'
import type { Song } from '../data/demo'

const statusLabel = { ready: 'Lista', learning: 'Aprendiendo', paused: 'En pausa' }

export default function SongRow({ song, index }: { song: Song; index?: number }) {
  const drop = song.tuning.includes('Drop')
  return (
    <div className="card row">
      {index !== undefined && <div className="num">{index}</div>}
      <div className="grow">
        <div className="title">{song.title}</div>
        <div className="sub">{song.artist}</div>
        <div className="chips">
          <span className="chip key">{song.key}</span>
          <span className="chip">{song.bpm} bpm</span>
          <span className={`chip ${drop ? 'warn' : ''}`}>{song.tuning}</span>
          {song.keyChange && <span className="chip warn">{song.keyChange}</span>}
          {song.guest && <span className="chip">{song.guest}</span>}
          <span className={`chip ${song.status === 'ready' ? 'ok' : ''}`}>{statusLabel[song.status]}</span>
        </div>
      </div>
      <button className="btn" aria-label={`Escuchar ${song.title}`}>
        <Play size={18} aria-hidden />
      </button>
    </div>
  )
}
