import { useState } from 'react'
import { ExternalLink, Pause, Play } from 'lucide-react'
import { startClick, stopClick, useClickFor } from '../lib/clickEngine'
import { embedsFor } from '../lib/embed'
import { meterSpec } from '../lib/meter'
import { useRoster } from '../lib/useRoster'
import { useActiveBand } from '../store/useBandSession'
import { isStandard, keyChangeLabel, statusLabel, tuningSummary, usefulNote, type Song } from '../lib/song'

type Props = { song: Song; onEdit?: () => void }

/** Toda la zona de texto abre el editor (si se puede editar). */
function Main({ onEdit, label, children }: { onEdit?: () => void; label: string; children: React.ReactNode }) {
  return onEdit
    ? <button className="li-main main-btn" onClick={onEdit} aria-label={label}>{children}</button>
    : <div className="li-main">{children}</div>
}

/** Una canción del repertorio: tono y BPM como lectura de equipo, afinación solo destacada si no es estándar. */
export default function SongRow({ song, onEdit }: Props) {
  const embeds = embedsFor(song.links)
  const band = useActiveBand()
  const { people } = useRoster(song.lineup?.length ? band?.id : undefined)
  const who = (song.lineup ?? []).map((l) => `${l.instrument}: ${l.profileId ? (people.find((m) => m.profileId === l.profileId)?.name.split(' ')[0] ?? '…') : l.guest}`)
  const [open, setOpen] = useState<number | null>(null)
  const current = open === null ? undefined : embeds[open]
  const standard = isStandard(song)
  const metro = useClickFor(song.id)
  const clicking = metro.phase !== 'idle'
  const note = usefulNote(song) // sin repetir lo que ya se ve arriba: afinación, tono y BPM
  return (
    <div className="song">
      <div className="li" style={{ borderBottom: current ? 0 : undefined }}>
        <span className={`dot ${song.status}`} title={statusLabel[song.status]} aria-label={statusLabel[song.status]} role="img" />
        <Main onEdit={onEdit} label={`Editar ${song.title}`}>
          <div className="li-title">{song.title}</div>
          <div className="li-sub">{song.artist || 'Sin artista'}</div>
          {(!standard || (song.meter && song.meter !== '4/4') || song.keyChanges.length > 0 || song.guest || song.status === 'paused') && (
            <div className="sub-row">
              {!standard && <span className="flag">{tuningSummary(song)}</span>}
              {song.meter && song.meter !== '4/4' && <span title={meterSpec(song.meter).hint}>Compás {song.meter}</span>}
              {song.keyChanges.map((k, i) => <span key={i} className="flag">{keyChangeLabel(k)}</span>)}
              {song.guest && <span>{song.guest}</span>}
              {song.status === 'paused' && <span>{statusLabel.paused}</span>}
            </div>
          )}
          {who.length > 0 && <div className="li-sub who-line">{who.join(' · ')}</div>}
        </Main>
        {embeds.length > 0 && <div className="song-listen">
        {embeds.map((e, i) => (
          <button key={e.provider} className={`btn listen ${e.provider} ${open === i ? 'primary' : 'ghost'}`} aria-pressed={open === i}
            aria-label={`${open === i ? 'Cerrar' : 'Escuchar'} ${song.title} en ${e.label}`} title={`Escuchar en ${e.label}`} onClick={() => setOpen(open === i ? null : i)}>
            {open === i ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            <span className="listen-label">{e.label}</span>
          </button>
        ))}
        </div>}
        {song.bpm > 0 ? (
          <button type="button" className={`readout key tempo ${clicking ? 'on' : ''}`} aria-pressed={clicking}
            aria-label={`Tono ${song.key || 'sin definir'}, ${song.bpm} bpm. ${clicking ? 'Parar' : 'Activar'} el metrónomo`} title="Toca para escuchar el metrónomo a este tempo"
            onClick={() => (clicking ? stopClick() : startClick(song.id, song.bpm, { keep: true, meter: song.meter }))}>
            <b>{song.key || '—'}</b>
            {song.bpm} bpm
            {clicking && <span className={`tempo-dot b${metro.beat}`} aria-hidden />}
          </button>
        ) : (
          <div className="readout key" role="group" aria-label={`Tono ${song.key || 'sin definir'}`}><b>{song.key || '—'}</b></div>
        )}
      </div>
      {note && !current && <div className="li-sub wrap" style={{ padding: '0 0 12px 20px', borderBottom: '1px solid var(--line)', marginTop: -4, whiteSpace: 'pre-line' }}>{note}</div>}
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
