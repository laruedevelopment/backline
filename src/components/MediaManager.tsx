import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ask } from '../lib/confirm'
import { processImage } from '../lib/image'
import Sheet from './Sheet'

export type Photo = { id: string; url: string }

export type MediaApi<P extends Photo> = {
  /** Clave de caché de las fotos. */
  photosKey: unknown[]
  listPhotos: () => Promise<P[]>
  addPhoto: (blob: Blob, ext: string) => Promise<unknown>
  deletePhoto: (photo: P) => Promise<unknown>
  setLogo: (blob: Blob, ext: string) => Promise<unknown>
  clearLogo: () => Promise<unknown>
  /** Se llama después de cambiar el logo (para refrescar quien lo muestra). */
  onLogoChanged: () => Promise<unknown>
  onPhotosChanged: () => Promise<unknown>
}

const MAX_PHOTOS = 12
const MAX_BYTES = 3 * 1024 * 1024

/** Logo y galería. Solo quien puede editar sube o borra; el resto mira. */
export default function MediaManager<P extends Photo>({ name, logoUrl, canEdit, api, intro }: {
  name: string; logoUrl: string | null; canEdit: boolean; api: MediaApi<P>; intro: string
}) {
  const logoInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'logo' | 'photo' | null>(null)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<P | null>(null)

  const { data: photos = [] } = useQuery({ queryKey: api.photosKey, queryFn: api.listPhotos })

  async function run(kind: 'logo' | 'photo', fn: () => Promise<unknown>) {
    setBusy(kind)
    setError('')
    try { await fn() } catch (e) {
      setError(/pesa|pesada/i.test(String((e as Error).message)) ? 'La imagen es muy pesada. Prueba con otra.' : 'No pudimos subir la imagen. Revisa tu conexión e intenta de nuevo.')
    }
    setBusy(null)
  }

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('logo', async () => {
      const { blob, ext } = await processImage(file, { maxSide: 512, square: true, quality: 0.85 })
      await api.setLogo(blob, ext)
      await api.onLogoChanged()
    })
  }

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length)
    e.target.value = ''
    if (!files.length) return
    void run('photo', async () => {
      for (const file of files) {
        const { blob, ext } = await processImage(file, { maxSide: 1600, quality: 0.8 })
        if (blob.size > MAX_BYTES) throw new Error('pesada')
        await api.addPhoto(blob, ext)
      }
      await api.onPhotosChanged()
    })
  }

  async function removeLogo() {
    if (!(await ask({ title: '¿Quitar el logo?', body: 'Se muestran las iniciales en su lugar.', confirmLabel: 'Quitar' }))) return
    void run('logo', async () => { await api.clearLogo(); await api.onLogoChanged() })
  }

  async function removePhoto(p: P) {
    if (!(await ask({ title: '¿Borrar esta foto?', confirmLabel: 'Borrar' }))) return
    setViewing(null)
    void run('photo', async () => { await api.deletePhoto(p); await api.onPhotosChanged() })
  }

  if (!canEdit && photos.length === 0) return null
  return (
    <>
      {canEdit && (
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 16 }}>
          <button className="btn" disabled={busy !== null} onClick={() => logoInput.current?.click()}>{busy === 'logo' ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}</button>
          {logoUrl && <button className="btn ghost danger" disabled={busy !== null} onClick={() => void removeLogo()}>Quitar logo</button>}
          <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
        </div>
      )}

      <div className="section-title">Fotos{photos.length ? ` · ${photos.length}` : ''}</div>
      {photos.length === 0 && <p className="li-sub wrap">{intro}</p>}
      {photos.length > 0 && (
        <ul className="gallery">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button onClick={() => setViewing(p)} aria-label={`Ver foto ${i + 1} de ${photos.length}`}>
                <img src={p.url} alt={`Foto ${i + 1} de ${name}`} loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <>
          <button className="btn" style={{ marginTop: 12 }} disabled={busy !== null || photos.length >= MAX_PHOTOS} onClick={() => photoInput.current?.click()}>
            {busy === 'photo' ? 'Subiendo…' : photos.length >= MAX_PHOTOS ? `Máximo ${MAX_PHOTOS} fotos` : 'Agregar fotos'}
          </button>
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhoto} />
          <p className="li-sub wrap" style={{ marginTop: 8 }}>Sube solo fotos tuyas o con permiso de quienes salen. Las imágenes son visibles para quien tenga el enlace. Se reducen y se les quita la ubicación antes de subirse.</p>
        </>
      )}
      {error && <p className="form-error" role="alert" style={{ marginTop: 8 }}>{error}</p>}

      {viewing && (
        <Sheet title="Foto" hideTitle onClose={() => setViewing(null)} dismissOnBackdrop>
          <img className="photo-full" src={viewing.url} alt={`Foto de ${name}`} />
          {canEdit && <button className="btn danger" onClick={() => void removePhoto(viewing)}>Borrar foto</button>}
        </Sheet>
      )}
    </>
  )
}
