import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addPhoto, clearBandLogo, deletePhoto, listPhotos, setBandLogo, type Band, type BandPhoto } from '../lib/api'
import { ask } from '../lib/confirm'
import { processImage } from '../lib/image'
import Sheet from './Sheet'

const MAX_PHOTOS = 12
const MAX_BYTES = 3 * 1024 * 1024

/** Logo y galería de la banda. Solo líder y admins suben o borran; el resto mira. */
export default function BandMedia({ band, canEdit }: { band: Band; canEdit: boolean }) {
  const qc = useQueryClient()
  const logoInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'logo' | 'photo' | null>(null)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<BandPhoto | null>(null)

  const { data: photos = [] } = useQuery({ queryKey: ['photos', band.id], queryFn: () => listPhotos(band.id) })
  const refreshBands = () => qc.invalidateQueries({ queryKey: ['bands'] })
  const refreshPhotos = () => qc.invalidateQueries({ queryKey: ['photos', band.id] })

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
      await setBandLogo(band.id, blob, ext, band.logoPath)
      await refreshBands()
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
        await addPhoto(band.id, blob, ext)
      }
      await refreshPhotos()
    })
  }

  async function removeLogo() {
    if (!(await ask({ title: '¿Quitar el logo?', body: 'La banda vuelve a mostrar sus iniciales.', confirmLabel: 'Quitar' }))) return
    void run('logo', async () => { await clearBandLogo(band.id, band.logoPath); await refreshBands() })
  }

  async function removePhoto(p: BandPhoto) {
    if (!(await ask({ title: '¿Borrar esta foto?', confirmLabel: 'Borrar' }))) return
    setViewing(null)
    void run('photo', async () => { await deletePhoto(p); await refreshPhotos() })
  }

  if (!canEdit && photos.length === 0) return null
  return (
    <>
      {canEdit && (
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 16 }}>
          <button className="btn" disabled={busy !== null} onClick={() => logoInput.current?.click()}>{busy === 'logo' ? 'Subiendo…' : band.logoUrl ? 'Cambiar logo' : 'Subir logo'}</button>
          {band.logoUrl && <button className="btn ghost danger" disabled={busy !== null} onClick={() => void removeLogo()}>Quitar logo</button>}
          <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
        </div>
      )}

      <div className="section-title">Fotos{photos.length ? ` · ${photos.length}` : ''}</div>
      {photos.length === 0 && <p className="li-sub wrap">Aún no hay fotos. Sube las del último toque o del ensayo: es lo que verá la gente en el perfil de la banda.</p>}
      {photos.length > 0 && (
        <ul className="gallery">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button onClick={() => setViewing(p)} aria-label={`Ver foto ${i + 1} de ${photos.length}`}>
                <img src={p.url} alt={`Foto ${i + 1} de ${band.name}`} loading="lazy" decoding="async" />
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
          <img className="photo-full" src={viewing.url} alt={`Foto de ${band.name}`} />
          {canEdit && <button className="btn danger" onClick={() => void removePhoto(viewing)}>Borrar foto</button>}
        </Sheet>
      )}
    </>
  )
}
