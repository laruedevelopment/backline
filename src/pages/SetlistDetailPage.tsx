import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, GripVertical, Plus, X } from 'lucide-react'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useActiveBand } from '../store/useBandSession'
import { useQuery } from '@tanstack/react-query'
import { listMembers } from '../lib/api'
import { useAuth } from '../store/useAuth'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import { isStandard, safeLink, tuningSignature, tuningSummary, type Song } from '../lib/song'
import { ask } from '../lib/confirm'
import { norm } from '../lib/importSetlist'
import Sheet from '../components/Sheet'
import SongForm from '../components/SongForm'
import StageMode from '../components/StageMode'
import ListSkeleton from '../components/Skeleton'

type RowProps = { id: string; className: string; handle: boolean; title: string; children: React.ReactNode }

/** Fila del setlist que se puede arrastrar desde su asa (así el resto de la fila sigue siendo táctil y no estorba al desplazar). */
function SortableRow({ id, className, handle, title, children }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} className={`${className} ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      {handle && (
        <button ref={setActivatorNodeRef} type="button" className="grip" aria-label={`Mover ${title}`} {...attributes} {...listeners}>
          <GripVertical size={20} aria-hidden />
        </button>
      )}
      {children}
    </div>
  )
}

export default function SetlistDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const band = useActiveBand()
  const { songs, save: saveSong, remove: removeSong } = useSongs(band?.id)
  const { setlists, loading, save, remove } = useSetlists(band?.id)
  const [editing, setEditing] = useState(false)
  const [stage, setStage] = useState(false)
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(false)
  const [spotifyDraft, setSpotifyDraft] = useState<string | null>(null)
  const [spotifyError, setSpotifyError] = useState('')
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [q, setQ] = useState('')
  const canEdit = band ? band.role !== 'guest' : true
  const userId = useAuth((s) => s.session?.user.id)
  const { data: members = [] } = useQuery({ queryKey: ['members', band?.id], queryFn: () => listMembers(band!.id), enabled: !!band && !!userId })
  // Lo que toca quien abre el modo escenario: el instrumento que eligió en esta banda o, si no, el primero de su perfil.
  const me = members.find((m) => m.profileId === userId)
  const myInstrument = me?.instrument || me?.instruments[0] || null
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const list = setlists.find((l) => l.id === id)
  if (loading) return <ListSkeleton rows={4} />
  if (!list) return <p className="empty">No encontramos ese setlist. <Link to="/setlists" style={{ color: 'var(--amber)' }}>Volver a setlists</Link></p>

  const items = list.songIds.flatMap((sid) => songs.find((s) => s.id === sid) ?? [])
  const ids = items.map((s) => s.id) // sin canciones borradas
  const minutes = items.reduce((t, s) => t + s.minutes, 0)
  const differs = (i: number) => i > 0 && tuningSignature(items[i]) !== tuningSignature(items[i - 1])
  const changes = items.filter((_, i) => differs(i)).length
  const update = (songIds: string[]) => void save({ ...list, songIds })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id)), to = ids.indexOf(String(over.id))
    if (from >= 0 && to >= 0) update(arrayMove(ids, from, to))
  }
  const copy = async () => {
    const lines = items.map((s, i) => `${i + 1}. ${s.title}${s.artist ? ` - ${s.artist}` : ''}${s.key ? ` (${s.key})` : ''}`)
    try {
      await navigator.clipboard.writeText([list.name, ...lines, `${items.length} canciones · ${minutes} min`].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* sin permiso de portapapeles */ }
  }
  const saveName = () => {
    const n = (nameDraft ?? '').trim()
    if (nameDraft !== null && n && n !== list.name) void save({ ...list, name: n.slice(0, 80) })
    setNameDraft(null)
  }
  const spotify = safeLink(list.spotifyUrl, 'spotify')
  const spotifyValue = spotifyDraft ?? list.spotifyUrl ?? ''
  const saveSpotify = () => {
    const raw = (spotifyDraft ?? '').trim()
    if (spotifyDraft === null || raw === (list.spotifyUrl ?? '')) return setSpotifyDraft(null)
    if (raw && !safeLink(raw, 'spotify')) return setSpotifyError('Pega el link de Spotify completo (empieza por https://).')
    setSpotifyError('')
    void save({ ...list, spotifyUrl: raw || undefined })
    setSpotifyDraft(null)
  }
  const available = songs.filter((s) => !ids.includes(s.id))
  const shown = available.filter((s) => !q.trim() || norm(`${s.title} ${s.artist}`).includes(norm(q)))
  const closeAdd = () => { setAdding(false); setPicked([]); setQ('') }
  const addPicked = () => { update([...ids, ...picked]); closeAdd() }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <>
      <Link to="/setlists" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Setlists</Link>

      <div className="detail-split">
      <article className="paper" style={{ marginTop: 6 }}>
        <h1>{list.name}</h1>
        <div className="meta">{items.length} CANCIONES · {minutes} MIN · {changes} CAMBIO{changes === 1 ? '' : 'S'} DE AFINACIÓN</div>
        {items.length === 0 && <p style={{ padding: '18px 0' }}>Vacío. Agrega canciones de tu repertorio.</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {items.map((s, i) => (
              <SortableRow key={s.id} id={s.id} title={s.title} handle={canEdit && items.length > 1}
                className={`paper-row ${canEdit && items.length > 1 ? 'has-grip' : ''} ${editing ? 'editing' : ''} ${differs(i) ? 'with-retune' : ''}`}>
                {differs(i) && <div className="retune">{isStandard(s) ? 'VOLVER A E ESTÁNDAR' : `CAMBIAR A ${tuningSummary(s).toUpperCase()}`}</div>}
                <span className="n">{i + 1}</span>
                {canEdit && !editing ? (
                  <button type="button" className="paper-main" onClick={() => setEditingSong(s)} aria-label={`Editar detalles de ${s.title}`}>
                    <div className="t">{s.title}</div>
                    <div className="a">{s.artist}{s.tunings.length > 0 && !isStandard(s) ? ` · ${tuningSummary(s)}` : ''}</div>
                  </button>
                ) : (
                  <div>
                    <div className="t">{s.title}</div>
                    <div className="a">{s.artist}</div>
                  </div>
                )}
                <span className="k">{s.key}{s.key && ' · '}{s.bpm}</span>
                {editing && (
                  <div className="tools">
                    <button aria-label={`Quitar ${s.title}`} onClick={() => update(ids.filter((x) => x !== s.id))}><X size={18} aria-hidden /></button>
                  </div>
                )}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </article>

      <div className="stack detail-side" style={{ marginTop: 16 }}>
        {editing && (
          <div className="card stack">
          <label className="field" style={{ marginBottom: 8 }}>Nombre del setlist
            <input value={nameDraft ?? list.name} maxLength={80} onChange={(e) => setNameDraft(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          </label>
          <label className="field" style={{ marginBottom: 8 }}>Link de la playlist de Spotify (opcional)
            <input type="url" inputMode="url" value={spotifyValue} placeholder="https://open.spotify.com/playlist/…" maxLength={300}
              onChange={(e) => { setSpotifyDraft(e.target.value); setSpotifyError('') }} onBlur={saveSpotify} />
          </label>
          {spotifyError && <p className="form-error" role="alert">{spotifyError}</p>}
          </div>
        )}
        {canEdit && items.length > 0 && <p className="li-sub wrap">Arrastra el asa ⋮⋮ para cambiar el orden. Toca una canción para editar sus detalles. Para cambiar el nombre, el link de Spotify o quitar canciones, pulsa «Editar setlist».</p>}
        {canEdit && <button className="btn block" onClick={() => setAdding(true)}><Plus size={18} aria-hidden /> Agregar canciones</button>}
        <button className="btn primary block" disabled={!items.length} onClick={() => setStage(true)}>Modo escenario</button>
        {spotify && <a className="btn block" href={spotify} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden /> Escuchar en Spotify</a>}
        <button className="btn block" disabled={!items.length} onClick={() => void copy()}>{copied ? 'Copiado: pégalo en WhatsApp' : 'Copiar para WhatsApp'}</button>
        {canEdit && (
          <button className="btn block" onClick={() => setEditing(!editing)}>{editing ? 'Listo' : 'Editar setlist'}</button>
        )}
      </div>

      </div>

      {editing && (
        <>
          <div className="section-title">Agregar del repertorio</div>
          {available.length === 0 && <p className="sub">Ya están todas las canciones del repertorio.</p>}
          <div className="list">
            {available.map((s) => (
              <button key={s.id} className="li" onClick={() => update([...ids, s.id])}>
                <div className="li-main">
                  <div className="li-title">{s.title}</div>
                  <div className="li-sub">{s.artist} · {tuningSummary(s)}</div>
                </div>
                <span className="tag">Agregar</span>
              </button>
            ))}
          </div>
          <button className="btn danger block" style={{ marginTop: 24 }}
            onClick={async () => (await ask({ title: `¿Borrar «${list.name}»?`, body: 'Las canciones siguen en el repertorio.', confirmLabel: 'Borrar' })) && void remove(list.id).then(() => nav('/setlists'))}>
            Borrar setlist
          </button>
        </>
      )}
      {adding && (
        <Sheet title="Agregar canciones" onClose={closeAdd}>
          {available.length === 0 ? (
            <p className="li-sub wrap">Ya están todas las canciones del repertorio en este setlist. <Link to="/repertorio" style={{ color: 'var(--amber)' }}>Agregar más al repertorio</Link></p>
          ) : (
            <>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o artista" aria-label="Buscar canción" />
              <div className="list" role="group" aria-label="Canciones del repertorio">
                {shown.map((s) => (
                  <button key={s.id} type="button" className="li" aria-pressed={picked.includes(s.id)} onClick={() => toggle(s.id)}>
                    <div className="li-main">
                      <div className="li-title">{s.title}</div>
                      <div className="li-sub">{[s.artist, tuningSummary(s)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className={`tag ${picked.includes(s.id) ? 'key' : ''}`}>{picked.includes(s.id) ? <Check size={12} aria-hidden /> : <Plus size={12} aria-hidden />}</span>
                  </button>
                ))}
                {shown.length === 0 && <p className="li-sub wrap">Nada con esa búsqueda.</p>}
              </div>
              <p className="li-sub wrap"><Link to="/repertorio" style={{ color: 'var(--amber)' }}>¿No está? Agrégala al repertorio primero.</Link></p>
              <div className="sheet-foot">
                <button className="btn primary block" disabled={!picked.length} onClick={addPicked}>{picked.length ? `Agregar ${picked.length} canción${picked.length === 1 ? '' : 'es'}` : 'Elige canciones'}</button>
              </div>
            </>
          )}
        </Sheet>
      )}
      {editingSong && (
        <SongForm song={editingSong} onClose={() => setEditingSong(null)}
          onSave={async (s) => { await saveSong(s); setEditingSong(null) }}
          onDelete={async () => { await removeSong(editingSong.id); setEditingSong(null) }} />
      )}
      {stage && <StageMode songs={items} instrument={myInstrument} onClose={() => setStage(false)} />}
    </>
  )
}
