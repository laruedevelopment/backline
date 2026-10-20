import { useQueryClient } from '@tanstack/react-query'
import {
  addVenuePhoto, clearVenueLogo, deleteVenuePhoto, listVenuePhotos, setVenueLogo, type Venue, type VenuePhoto,
} from '../lib/venues'
import MediaManager, { type MediaApi } from './MediaManager'

/** Logo y fotos de la sala. Solo su dueño sube o borra; el resto mira. */
export default function VenueMedia({ venue, canEdit }: { venue: Venue; canEdit: boolean }) {
  const qc = useQueryClient()
  const api: MediaApi<VenuePhoto> = {
    photosKey: ['venue-photos', venue.id],
    listPhotos: () => listVenuePhotos(venue.id),
    addPhoto: (blob, ext) => addVenuePhoto(venue.id, blob, ext),
    deletePhoto: deleteVenuePhoto,
    setLogo: (blob, ext) => setVenueLogo(venue.id, blob, ext, venue.logoPath),
    clearLogo: () => clearVenueLogo(venue.id, venue.logoPath),
    onLogoChanged: () => Promise.all([qc.invalidateQueries({ queryKey: ['my-venues'] }), qc.invalidateQueries({ queryKey: ['venue', venue.id] }), qc.invalidateQueries({ queryKey: ['venues'] })]),
    onPhotosChanged: () => qc.invalidateQueries({ queryKey: ['venue-photos', venue.id] }),
  }
  return (
    <MediaManager
      name={venue.name} logoUrl={venue.logoUrl} canEdit={canEdit} api={api}
      intro="Aún no hay fotos. Muestra las salas por dentro, el equipo y la entrada: es lo primero que mira una banda antes de reservar."
    />
  )
}
