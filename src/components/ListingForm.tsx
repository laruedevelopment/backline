import { useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { categories, conditions, createListing, type NewListing } from '../lib/market'
import { useAuth } from '../store/useAuth'
import InfoTip from './InfoTip'
import Sheet from './Sheet'

const blank: NewListing = { title: '', description: '', category: 'guitarra', condition: 'usado', price: 0, brand: '', city: '', acceptsTrade: false, whatsapp: '', files: [] }

/** Publicar un anuncio en el Mercado. Backline no cobra ni procesa pagos: el trato es entre las dos personas. */
export default function ListingForm({ defaultCity, onDone, onClose }: { defaultCity: string; onDone: (id: string) => void; onClose: () => void }) {
  const me = useAuth((s) => s.session?.user.id)
  const [l, setL] = useState<NewListing>({ ...blank, city: defaultCity })
  const [priceText, setPriceText] = useState('')
  const [showWa, setShowWa] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previews = useMemo(() => l.files.map((f) => URL.createObjectURL(f)), [l.files])
  const patch = (p: Partial<NewListing>) => setL((v) => ({ ...v, ...p }))
  const ok = l.title.trim().length >= 3 && priceText.trim() !== '' && consent && (!showWa || /^[0-9+ ]{7,20}$/.test(l.whatsapp.trim()))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true); setError('')
    try {
      const id = await createListing(me!, { ...l, price: Number(priceText.replace(/\D/g, '')) || 0, whatsapp: showWa ? l.whatsapp : '' })
      onDone(id)
    } catch (err) {
      const m = String((err as { message?: string })?.message ?? '')
      setError(/20 anuncios/.test(m) ? 'Ya tienes 20 anuncios activos. Marca alguno como vendido o bórralo.' : /demasiados/.test(m) ? 'Publicaste muchos anuncios hoy. Intenta mañana.' : /violates|row-level/.test(m) ? 'Solo las personas mayores de edad pueden publicar anuncios.' : 'No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.')
      setBusy(false)
    }
  }

  return (
    <Sheet title="Publicar anuncio" onClose={onClose} onSubmit={submit}>
      <label className="field">Título
        <input value={l.title} maxLength={80} required placeholder="Bajo Fender Precision 2019" onChange={(e) => patch({ title: e.target.value })} />
      </label>
      <div className="grid-row">
        <label className="field grow">Categoría
          <select value={l.category} onChange={(e) => patch({ category: e.target.value })}>{categories.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <label className="field grow">Estado
          <select value={l.condition} onChange={(e) => patch({ condition: e.target.value })}>{conditions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
      </div>
      <div className="grid-row">
        <label className="field grow">Precio (COP)
          <input inputMode="numeric" value={priceText} required placeholder="1500000" onChange={(e) => setPriceText(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} />
        </label>
        <label className="field grow">Marca (opcional)
          <input value={l.brand} maxLength={40} onChange={(e) => patch({ brand: e.target.value })} />
        </label>
      </div>
      <label className="field">Ciudad
        <input value={l.city} maxLength={60} onChange={(e) => patch({ city: e.target.value })} />
      </label>
      <label className="field">Descripción
        <textarea rows={4} value={l.description} maxLength={1500} placeholder="Estado real, qué incluye, por qué lo vendes, si hay detalles…" onChange={(e) => patch({ description: e.target.value })} />
      </label>
      <label className="check-row"><input type="checkbox" checked={l.acceptsTrade} onChange={(e) => patch({ acceptsTrade: e.target.checked })} /> Acepto cambios por otro equipo</label>
      <div className="composer-previews">
        {previews.map((u, i) => <span key={u} className="composer-thumb"><img src={u} alt="" /><button type="button" aria-label="Quitar foto" onClick={() => patch({ files: l.files.filter((_, j) => j !== i) })}><X size={14} aria-hidden /></button></span>)}
        {l.files.length < 6 && (
          <label className="btn" style={{ minHeight: 84 }}><ImagePlus size={18} aria-hidden /> Fotos
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { patch({ files: [...l.files, ...[...(e.target.files ?? [])]].slice(0, 6) }); e.target.value = '' }} />
          </label>
        )}
      </div>
      <label className="check-row"><input type="checkbox" checked={showWa} onChange={(e) => setShowWa(e.target.checked)} /> Mostrar mi WhatsApp para que me escriban <InfoTip label="Sobre el WhatsApp" text="Es opcional. Si lo muestras, cualquier persona adulta de Backline que vea el anuncio podrá escribirte. Si no, te preguntan en el anuncio y respondes ahí." /></label>
      {showWa && <input value={l.whatsapp} inputMode="tel" maxLength={20} placeholder="3001234567" aria-label="WhatsApp" onChange={(e) => patch({ whatsapp: e.target.value.replace(/[^0-9+ ]/g, '') })} />}
      <label className="check-row consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>El equipo es mío o puedo venderlo, y es como lo describo. Entiendo que Backline no cobra ni garantiza la venta. <InfoTip label="Cómo funciona el Mercado" text="Backline solo muestra el anuncio: no procesa pagos, no entrega ni garantiza productos. El trato es entre las dos personas. Encuéntrense en un lugar público, no adelantes dinero y revisa el equipo antes de pagar." /></span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-foot"><div className="row"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary grow" disabled={!ok || busy}>{busy ? 'Publicando…' : 'Publicar'}</button></div></div>
    </Sheet>
  )
}
