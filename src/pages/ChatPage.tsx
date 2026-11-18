import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWide } from '../lib/useWide'
import { useDock } from '../store/useDock'
import BandChat from '../components/BandChat'
import BandNav from '../components/BandNav'

/** Chat de la banda: reemplaza el grupo de WhatsApp para lo de la banda (ensayos, tonos, quién lleva qué). */
export default function ChatPage() {
  const wide = useWide(1240)
  const setView = useDock((s) => s.setView)
  // En pantallas anchas el chat vive en el panel lateral: se abre ahí y esta pantalla no se duplica.
  useEffect(() => { if (wide && supabase) setView({ kind: 'band' }) }, [wide, setView])
  if (wide && supabase) return <Navigate to="/banda" replace />
  return (
    <>
      <BandNav />
      {supabase ? <BandChat /> : <p className="empty">El chat necesita una cuenta. Inicia sesión para usarlo.</p>}
    </>
  )
}
