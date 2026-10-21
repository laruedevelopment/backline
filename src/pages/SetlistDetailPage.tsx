import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, GripVertical, Plus, Tag, X } from 'lucide-react'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useActiveBand } from '../store/useBandSession'
import { useQuery } from '@tanstack/react-query'
import { listMemberNotes, listMembers } from '../lib/api'
import { useAuth } from '../store/useAuth'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import { isStandard, safeLink, tuningSignature, tuningSummary, type Song } from '../lib/song'
import { ask } from '../lib/confirm'
import { editLabel, insertLabel, itemsOf, setTags, stageMarks, withItems, type SetlistItem } from '../lib/setlistItems'
import { LabelSheet, TagsSheet } from '../components/SetlistLabelSheets'
import { norm } from '../lib/importSetlist'
import Sheet from '../components/Sheet'
import SongForm from '../components/SongForm'
import StageMode from '../components/StageMode'
import ListSkeleton from '../components/Skeleton'

type Row = { e: SetlistItem; song: Song | null; n: number; retune: boolean }

/** Número de cada canción y aviso automático de afinación (no se repite si ya hay una etiqueta puesta justo antes). */
function buildRows(entries: SetlistItem[], songById: Map<string, Song>): Row[] {
  const out: Row[] = []
  let n = 0
  let prev: Song | null = null
  let prevWasLabel = false
  for (const e of entries) {
    if (e.t === 'l') { out.push({ e, song: null, n: 0, retune: false }); prevWasLabel = true; continue }
    const song = songById.get(e.id)
    if (!song) continue
    n += 1
    out.push({ e, song, n, retune: !!prev && !prevWasLabel && tuningSignature(song) !== tuningSignature(prev) })
    prev = song
    prevWasLabel = false
  }
  return out
}

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
  const [labelSheet, setLabelSheet] = useState<{ id?: string; before?: string | null } | null>(null)
  const [tagSheet, setTagSheet] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const canEdit = band ? band.role !== 'guest' : true
  const userId = useAuth((s) => s.session?.user.id)
  const { data: members = [] } = useQuery({ queryKey: ['members', band?.id], queryFn: () => listMembers(band!.id), enabled: !!band && !!userId })
  const { data: memberNotes = [] } = useQuery({ queryKey: ['song-notes', band?.id], queryFn: () => listMemberNotes(band!.id), enabled: !!band && !!userId })
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

  // Elementos del setlist: canciones y etiquetas sueltas, en orden. Las canciones borradas del repertorio se ignoran.
  const entries: SetlistItem[] = itemsOf(list).filter((e) => e.t === 'l' || songs.some((x) => x.id === e.id))
  const songById = new Map(songs.map((x) => [x.id, x]))
  const items = entries.flatMap((e) => (e.t === 's' ? songById.get(e.id) ?? [] : [])) // solo canciones, en orden
  const ids = items.map((x) => x.id)
  const entryIds = entries.map((e) => e.id)
  const minutes = items.reduce((t, x) => t + x.minutes, 0)
  const changes = items.filter((x, i) => i > 0 && tuningSignature(x) !== tuningSignature(items[i - 1])).length
  const saveEntries = (next: SetlistItem[]) => void save(withItems(list, next))
  const rows = buildRows(entries, songById)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = entryIds.indexOf(String(active.id)), to = entryIds.indexOf(String(over.id))
    if (from >= 0 && to >= 0) saveEntries(arrayMove(entries, from, to))
  }
  const copy = async () => {
    let n = 0
    const lines = entries.flatMap((e) => {
      if (e.t === 'l') return [`— ${e.text} —`]
      const x = songById.get(e.id)!
      n += 1
      const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : ''
      return [`${n}. ${x.title}${x.artist ? ` - ${x.artist}` : ''}${x.key ? ` (${x.key})` : ''}${tags}`]
    })
    try {
      await navigator.clipboard.writeText([list.name, ...lines, `${items.length} canciones · ${minutes} min`].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* sin permiso de portapapeles */ }
  }
  const marks = stageMarks(entries)
  // Cada quien lleva al escenario solo su propia anotación de cada canción.
  const stageSongs = items.map((x) => ({ ...x, ...marks.get(x.id), personal: memberNotes.find((n) => n.songId === x.id && n.profileId === userId)?.note }))
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
  const addPicked = () => { saveEntries([...entries, ...picked.map((id): SetlistItem => ({ t: 's', id }))]); closeAdd() }
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
          <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
            {rows.map(({ e, song, n, retune }) => {
              const grip = canEdit && entries.length > 1
              if (e.t === 'l') {
                return (
                  <SortableRow key={e.id} id={e.id} title={e.text} handle={grip} className={`paper-label-row ${grip ? 'has-grip' : ''}`}>
                    {canEdit ? (
                      <button type="button" className="paper-label" onClick={() => setLabelSheet({ id: e.id })} aria-label={`Editar etiqueta ${e.text}`}>{e.text}</button>
                    ) : (
                      <div className="paper-label">{e.text}</div>
                    )}
                    {editing && <div className="tools"><button aria-label={`Quitar etiqueta ${e.text}`} onClick={() => saveEntries(entries.filter((x) => x.id !== e.id))}><X size={18} aria-hidden /></button></div>}
                  </SortableRow>
                )
              }
              const s = song!
              const tags = e.tags ?? []
              return (
                <SortableRow key={e.id} id={e.id} title={s.title} handle={grip}
                  className={`paper-row ${grip ? 'has-grip' : ''} ${editing ? 'editing' : ''} ${retune ? 'with-retune' : ''}`}>
                  {retune && <div className="retune">{isStandard(s) ? 'VOLVER A E ESTÁNDAR' : `CAMBIAR A ${tuningSummary(s).toUpperCase()}`}</div>}
                  <span className="n">{n}</span>
                  {canEdit && !editing ? (
                    <button type="button" className="paper-main" onClick={() => setEditingSong(s)} aria-label={`Editar detalles de ${s.title}`}>
                      <div className="t">{s.title}</div>
                      <div className="a">{s.artist}{s.tunings.length > 0 && !isStandard(s) ? ` · ${tuningSummary(s)}` : ''}</div>
                      {tags.length > 0 && <div className="paper-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
                    </button>
                  ) : (
                    <div>
                      <div className="t">{s.title}</div>
                      <div className="a">{s.artist}</div>
                      {tags.length > 0 && <div className="paper-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
                    </div>
                  )}
                  <span className="k">{s.key}{s.key && ' · '}{s.bpm}</span>
                  {editing && (
                    <div className="tools">
                      <button aria-label={`Etiquetas de ${s.title}`} onClick={() => setTagSheet(s.id)}><Tag size={18} aria-hidden /></button>
                      <button aria-label={`Quitar ${s.title}`} onClick={() => saveEntries(entries.filter((x) => x.id !== s.id))}><X size={18} aria-hidden /></button>
                    </div>
                  )}
                </SortableRow>
              )
            })}
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
        {canEdit && items.length > 0 && <p className="li-sub wrap">Arrastra el asa ⋮⋮ para cambiar el orden (también las etiquetas). Toca una canción para editar sus detalles. Para cambiar el nombre, el link de Spotify, poner etiquetas a una canción o quitar elementos, pulsa «Editar setlist».</p>}
        {canEdit && <button className="btn block" onClick={() => setAdding(true)}><Plus size={18} aria-hidden /> Agregar canciones</button>}
        {canEdit && <button className="btn block" onClick={() => setLabelSheet({})}><Tag size={16} aria-hidden /> Agregar etiqueta</button>}
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
              <button key={s.id} className="li" onClick={() => saveEntries([...entries, { t: 's', id: s.id }])}>
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
      {labelSheet && (
        <LabelSheet
          positions={items.map((x) => ({ id: x.id, title: x.title }))}
          initial={labelSheet.id ? (entries.find((x) => x.id === labelSheet.id && x.t === 'l') as Extract<SetlistItem, { t: 'l' }> | undefined)?.text : undefined}
          defaultBefore={labelSheet.before ?? null}
          onSave={(text, before) => saveEntries(labelSheet.id ? editLabel(entries, labelSheet.id, text) : insertLabel(entries, text, before))}
          onDelete={labelSheet.id ? () => saveEntries(entries.filter((x) => x.id !== labelSheet.id)) : undefined}
          onClose={() => setLabelSheet(null)}
        />
      )}
      {tagSheet && (
        <TagsSheet
          title={songById.get(tagSheet)?.title ?? ''}
          tags={(entries.find((x) => x.id === tagSheet && x.t === 's') as Extract<SetlistItem, { t: 's' }> | undefined)?.tags ?? []}
          onSave={(tags) => saveEntries(setTags(entries, tagSheet, tags))}
          onClose={() => setTagSheet(null)}
        />
      )}
      {stage && <StageMode songs={stageSongs} instrument={myInstrument} onClose={() => setStage(false)} />}
    </>
  )
}
