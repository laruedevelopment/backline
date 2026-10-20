import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  /** false hasta saber si hay una sesión guardada. */
  ready: boolean
}

export const useAuth = create<AuthState>(() => ({ session: null, ready: !supabase }))

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => useAuth.setState({ session: data.session, ready: true }))
  supabase.auth.onAuthStateChange((_e, session) => useAuth.setState({ session, ready: true }))
}
