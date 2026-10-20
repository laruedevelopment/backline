import { useQueryClient } from '@tanstack/react-query'
import { addPhoto, clearBandLogo, deletePhoto, listPhotos, setBandLogo, type Band, type BandPhoto } from '../lib/api'
import MediaManager, { type MediaApi } from './MediaManager'

/** Logo y galería de la banda. Solo líder y admins suben o borran; el resto mira. */
export default function BandMedia({ band, canEdit }: { band: Band; canEdit: boolean }) {
  const qc = useQueryClient()
  const api: MediaApi<BandPhoto> = {
    photosKey: ['photos', band.id],
    listPhotos: () => listPhotos(band.id),
    addPhoto: (blob, ext) => addPhoto(band.id, blob, ext),
    deletePhoto,
    setLogo: (blob, ext) => setBandLogo(band.id, blob, ext, band.logoPath),
    clearLogo: () => clearBandLogo(band.id, band.logoPath),
    onLogoChanged: () => qc.invalidateQueries({ queryKey: ['bands'] }),
    onPhotosChanged: () => qc.invalidateQueries({ queryKey: ['photos', band.id] }),
  }
  return (
    <MediaManager
      name={band.name} logoUrl={band.logoUrl} canEdit={canEdit} api={api}
      intro="Aún no hay fotos. Sube las del último toque o del ensayo: es lo que verá la gente en el perfil de la banda."
    />
  )
}
