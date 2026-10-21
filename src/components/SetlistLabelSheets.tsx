import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { cleanLabel, cleanTag, LABEL_MAX_LEN, LABEL_PRESETS, MAX_TAGS, TAG_MAX_LEN, TAG_PRESETS } from '../lib/setlistItems'
import Sheet from './Sheet'

type Position = { id: string; title: string }

/** Etiqueta suelta entre canciones: «Afinar a Drop C», «Pausa», «Cambio de guitarra»… Se arrastra a su lugar o se elige dónde va. */
export function LabelSheet({ positions, initial, defaultBefore, onSave, onDelete, onClose }: {
  positions: Position[]
  initial?: string
  defaultBefore?: string | null
  onSave: (text: string, beforeId: string | null) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [text, setText] = useState(initial ?? '')
  const [before, setBefore] = useState<string>(defaultBefore ?? '')
  const editing = initial !== undefined

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = cleanLabel(text)
    if (!t) return
    onSave(t, before || null)
    onClose()
  }

  return (
    <Sheet title={editing ? 'Editar etiqueta' : 'Agregar etiqueta'} onClose={onClose} onSubmit={submit}>
      <p className="li-sub wrap">Un aviso entre canciones que se ve en el setlist y en el modo escenario. Por ejemplo, para cambiar de afinación o de guitarra.</p>
      <label className="field">Texto
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={LABEL_MAX_LEN} placeholder="Afinar a Drop C" autoFocus required />
      </label>
      <div className="chips" role="group" aria-label="Sugerencias">
        {LABEL_PRESETS.map((p) => <button key={p} type="button" className="tag" onClick={() => setText(p)}>{p}</button>)}
      </div>
      {!editing && (
        <label className="field">Dónde va
          <select value={before} onChange={(e) => setBefore(e.target.value)}>
            <option value="">Al final del setlist</option>
            {positions.map((p, i) => <option key={p.id} value={p.id}>Antes de {i + 1}. {p.title}</option>)}
          </select>
        </label>
      )}
      <div className="sheet-foot">
        <div className="row">
          {onDelete && <button type="button" className="btn danger" onClick={() => { onDelete(); onClose() }}><Trash2 size={16} aria-hidden /> Quitar</button>}
          <button className="btn primary grow" disabled={!cleanLabel(text)}>{editing ? 'Guardar' : 'Agregar etiqueta'}</button>
        </div>
      </div>
    </Sheet>
  )
}

/** Etiquetas de una canción dentro de este setlist («Intro largo», «Sin guitarra»…). */
export function TagsSheet({ title, tags, onSave, onClose }: { title: string; tags: string[]; onSave: (tags: string[]) => void; onClose: () => void }) {
  const [list, setList] = useState<string[]>(tags)
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const t = cleanTag(raw)
    if (!t || list.includes(t) || list.length >= MAX_TAGS) return
    setList([...list, t])
    setDraft('')
  }

  return (
    <Sheet title={`Etiquetas · ${title}`} onClose={onClose} onSubmit={(e) => { e.preventDefault(); const t = cleanTag(draft); onSave(t && !list.includes(t) && list.length < MAX_TAGS ? [...list, t] : list); onClose() }}>
      <p className="li-sub wrap">Notas cortas sobre esta canción en este setlist. Hasta {MAX_TAGS}.</p>
      <div className="chips" aria-label="Etiquetas de la canción">
        {list.length === 0 && <span className="li-sub">Sin etiquetas todavía.</span>}
        {list.map((t) => (
          <button key={t} type="button" className="tag key" onClick={() => setList(list.filter((x) => x !== t))} aria-label={`Quitar etiqueta ${t}`}>{t} <X size={11} aria-hidden /></button>
        ))}
      </div>
      <label className="field">Nueva etiqueta
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={TAG_MAX_LEN} placeholder="Intro largo"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft) } }} />
      </label>
      <div className="chips" role="group" aria-label="Sugerencias">
        {TAG_PRESETS.filter((p) => !list.includes(p)).map((p) => <button key={p} type="button" className="tag" onClick={() => add(p)}>{p}</button>)}
      </div>
      <div className="sheet-foot">
        <button className="btn primary block">Listo</button>
      </div>
    </Sheet>
  )
}
