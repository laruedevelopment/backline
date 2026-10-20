import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

export default function ProfilePage() {
  const session = useAuth((s) => s.session)
  const name = session?.user.user_metadata?.name as string | undefined
  return (
    <>
      <h1 className="page-title">Perfil</h1>
      <p className="page-sub">Tu rig, tus bandas y tu música</p>
      {session && (
        <div className="card row" style={{ marginBottom: 12 }}>
          <div className="grow">
            <div className="title">{name || 'Músico'}</div>
            <div className="sub">{session.user.email}</div>
          </div>
          <button className="btn" onClick={() => void supabase?.auth.signOut()}>
            <LogOut size={18} aria-hidden /> Salir
          </button>
        </div>
      )}
      <div className="card empty">
        Aquí vas a mostrar tus instrumentos, tu pedalboard y tus videos.
        <br />
        Llega en la Fase 2.
      </div>
    </>
  )
}
