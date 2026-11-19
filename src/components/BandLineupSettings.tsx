import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDefaultLineup, saveDefaultLineup } from '../lib/api'
import { applyBandLineup } from '../lib/bandLineup'
import type { LineupSlot } from '../lib/song'
import { useRoster } from '../lib/useRoster'
import { useSongs } from '../lib/useSongs'
import { HelpRow } from './InfoTip'
import LineupEditor from './LineupEditor'

/** Ajustes de la banda › «Quién toca» por defecto: se define una vez y se aplica a todo el repertorio o a un setlist. */
export default function BandLineupSettings({ bandId }: { bandId: string }) {
  const qc = useQueryClient()
  const { people, members } = useRoster(bandId)
  const { songs } = useSongs(bandId)
  const { data } = useQuery({ queryKey: ['default-lineup', bandId], queryFn: () => getDefaultLineup(bandId) })
  const [draft, setDraft] = useState<LineupSlot[] | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const value = draft ?? data ?? []
  const dirty = draft !== null

  async function run(fn: () => Promise<string>) {
    setBusy(true); setMsg('')
    try { setMsg(await fn()) } catch { setMsg('No pudimos hacerlo. Revisa tu conexión e intenta de nuevo.') }
    setBusy(false)
  }
  const save = () => run(async () => {
    await saveDefaultLineup(bandId, value)
    await qc.invalidateQueries({ queryKey: ['default-lineup', bandId] })
    setDraft(null)
    return 'Formación guardada. Las canciones nuevas nacerán con ella.'
  })

  return (
    <>
      <div className="section-title">Quién toca (formación de la banda)</div>
      <HelpRow text="Arma aquí quién toca qué una sola vez. Las canciones nuevas nacen con esta formación, y puedes aplicarla al repertorio completo o solo a un setlist (desde el setlist). Después cada canción se puede ajustar por separado." />
      <LineupEditor value={value} onChange={setDraft} people={people} allowGuests={false} fillFrom={members} />
      <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn primary" disabled={!dirty || busy} onClick={() => void save()}>Guardar formación</button>
      </div>
      {!dirty && value.length > 0 && songs.length > 0 && (
        <div className="stack" style={{ marginTop: 14 }}>
          <button className="btn block" disabled={busy} onClick={() => void run(() => applyBandLineup({ bandId, songs, qc, onlyEmpty: true, scope: 'sin formación' }))}>Aplicar a las canciones sin formación</button>
          <button className="btn block ghost" disabled={busy} onClick={() => void run(() => applyBandLineup({ bandId, songs, qc, scope: 'del repertorio' }))}>Aplicar a todo el repertorio (reemplaza)</button>
        </div>
      )}
      {dirty && <p className="li-sub" style={{ marginTop: 8 }}>Guarda la formación antes de aplicarla a las canciones.</p>}
      {msg && <p className="notice" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </>
  )
}
