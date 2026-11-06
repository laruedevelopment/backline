import { supabase } from '../lib/supabase'
import BandChat from '../components/BandChat'
import BandNav from '../components/BandNav'

/** Chat de la banda: reemplaza el grupo de WhatsApp para lo de la banda (ensayos, tonos, quién lleva qué). */
export default function ChatPage() {
  return (
    <>
      <BandNav />
      {supabase ? <BandChat /> : <p className="empty">El chat necesita una cuenta. Inicia sesión para usarlo.</p>}
    </>
  )
}
