import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { clearLocalCache } from '../lib/queryClient'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  /** false hasta saber si hay una sesión guardada. */
  ready: boolean
  /** true cuando la persona llegó desde el enlace de "olvidé mi contraseña". */
  recovery: boolean
}

export const useAuth = create<AuthState>(() => ({ session: null, ready: !supabase, recovery: false }))

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => useAuth.setState({ session: data.session, ready: true }))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') clearLocalCache()
    useAuth.setState({ session, ready: true, ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}) })
  })
}
