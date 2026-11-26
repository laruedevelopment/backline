import { useEffect, useMemo, useState } from 'react'
import { Copy, FileText, Image as ImageIcon, Link2, Share2 } from 'lucide-react'
import InfoTip from './InfoTip'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getShareToken, setShare, shareUrl } from '../lib/shareLink'
import { supabase } from '../lib/supabase'
import { printSetlist, setlistHtml } from '../lib/exportSetlist'
import type { SetlistItem } from '../lib/setlistItems'
import { buildShare, fieldLabels, loadFields, saveFields, shareImage, shareText, type ShareFields } from '../lib/shareSetlist'
import type { Song } from '../lib/song'
import Sheet from './Sheet'

type Props = { name: string; setlistId: string; canShareLink: boolean; entries: SetlistItem[]; songs: Map<string, Song>; lyrics: Map<string, string>; onClose: () => void }

/** Compartir el setlist: se eligen los datos con casillas y sale como texto, imagen o PDF. */
export default function ShareSetlistSheet({ name, setlistId, canShareLink, entries, songs, lyrics, onClose }: Props) {
  const [fields, setFields] = useState<ShareFields>(loadFields)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => saveFields(fields), [fields])
  const doc = useMemo(() => buildShare(name, entries, songs, fields), [name, entries, songs, fields])
  const text = useMemo(() => shareText(doc, fields), [doc, fields])
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
  const qc = useQueryClient()
  const { data: token } = useQuery({ queryKey: ['share-token', setlistId], queryFn: () => getShareToken(setlistId), enabled: canShareLink && !!supabase })
  async function toggleLink(on: boolean) {
    setBusy(true)
    try { const t = await setShare(setlistId, on); await qc.invalidateQueries({ queryKey: ['share-token', setlistId] }); if (on && t) { await navigator.clipboard.writeText(shareUrl(t)).catch(() => {}); flash('Link copiado: quien lo abra ve el setlist sin cuenta') } else flash('Link desactivado') }
    catch { flash('No se pudo cambiar el link.') } finally { setBusy(false) }
  }
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function copy() {
    try { await navigator.clipboard.writeText(text); flash('Copiado: pégalo en WhatsApp') } catch { flash('No se pudo copiar. Selecciona el texto y cópialo.') }
  }
  async function image(share: boolean) {
    setBusy(true)
    try {
      const blob = await shareImage(doc, fields)
      const file = new File([blob], `${name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'setlist'}.png`, { type: 'image/png' })
      if (share && canShareFiles && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return }
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url; a.download = file.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      flash('Imagen descargada')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') flash('No se pudo crear la imagen.')
    } finally { setBusy(false) }
  }
  const pdf = (withLyrics: boolean) => printSetlist(setlistHtml(name, entries, songs, lyrics, withLyrics))

  return (
    <Sheet title="Compartir setlist" onClose={onClose}>
      <fieldset className="share-fields">
        <legend className="section-title" style={{ margin: '0 0 6px' }}>Qué incluir</legend>
        <div className="share-checks">
          {fieldLabels.map(([k, label]) => (
            <label key={k} className="check-row">
              <input type="checkbox" checked={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.checked })} /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="section-title" style={{ margin: '14px 0 6px' }}>Vista previa</div>
      <pre className="share-preview" aria-label="Vista previa del texto">{text}</pre>
      <div className="share-actions">
        <button className="btn primary" onClick={() => void copy()}><Copy size={18} aria-hidden /> Copiar texto</button>
        <button className="btn" disabled={busy} onClick={() => void image(canShareFiles)}>{canShareFiles ? <Share2 size={18} aria-hidden /> : <ImageIcon size={18} aria-hidden />} {canShareFiles ? 'Compartir imagen' : 'Descargar imagen'}</button>
        {canShareFiles && <button className="btn" disabled={busy} onClick={() => void image(false)}><ImageIcon size={18} aria-hidden /> Guardar imagen</button>}
        <button className="btn" onClick={() => pdf(false)}><FileText size={18} aria-hidden /> PDF de la lista</button>
        <button className="btn" onClick={() => pdf(true)}><FileText size={18} aria-hidden /> PDF con letras y acordes</button>
      </div>
      {canShareLink && supabase && (
        <div className="card stack" style={{ marginTop: 12 }}>
          <span className="title-row"><b>Link de solo lectura</b>
          <InfoTip text="Quien tenga el link ve el orden y los datos básicos (título, artista, tono, BPM, duración y afinación), sin cuenta. Nunca letras ni notas. Lo puedes apagar cuando quieras." label="Qué ve quien abre el link" /></span>
          {token ? (
            <>
              <input readOnly value={shareUrl(token)} aria-label="Link del setlist" onFocus={(e) => e.currentTarget.select()} />
              <div className="row">
                <button className="btn primary grow" onClick={() => void navigator.clipboard.writeText(shareUrl(token)).then(() => flash('Link copiado'))}><Link2 size={16} aria-hidden /> Copiar link</button>
                <button className="btn" disabled={busy} onClick={() => void toggleLink(false)}>Dejar de compartir</button>
              </div>
            </>
          ) : <button className="btn" disabled={busy} onClick={() => void toggleLink(true)}><Link2 size={16} aria-hidden /> Crear link</button>}
        </div>
      )}
      {msg && <p className="li-sub" role="status" style={{ marginTop: 8 }}>{msg}</p>}
    </Sheet>
  )
}
