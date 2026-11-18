import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TERMS_VERSION } from '../content/legal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

/** Cuando cambian los términos o la política, se pide aceptar la versión nueva antes de seguir (quien no la acepta puede cerrar sesión). */
export default function TermsGate() {
  const userId = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const { data: version, isSuccess } = useQuery({
    queryKey: ['my-terms', userId],
    queryFn: async () => { const { data, error } = await supabase!.rpc('my_terms_version'); if (error) throw error; return (data as string | null) ?? '' },
    enabled: !!supabase && !!userId,
    staleTime: 10 * 60_000,
  })
  const accept = useMutation({
    mutationFn: async () => { const { error } = await supabase!.rpc('accept_terms', { p_version: TERMS_VERSION }); if (error) throw error },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-terms'] }),
  })
  if (!supabase || !userId || !isSuccess || version === TERMS_VERSION) return null
  const base = import.meta.env.BASE_URL
  return (
    <div className="terms-gate" role="alertdialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="terms-card">
        <h2 id="terms-title">Actualizamos los términos y la política de datos</h2>
        <p>Agregamos lo nuevo de Backline: chat, mensajes directos, amistades, «Se busca músico», invitados por días, links de setlists y avisos. También quedó claro que cada persona es responsable del contenido que sube y que puedes denunciar lo que no te parezca bien.</p>
        <p><a href={`${base}terminos`} target="_blank" rel="noopener noreferrer">Leer los términos</a> · <a href={`${base}privacidad`} target="_blank" rel="noopener noreferrer">Leer la política de datos</a> (versión {TERMS_VERSION})</p>
        {accept.isError && <p className="form-error" role="alert">No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.</p>}
        <button className="btn primary block" disabled={accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? 'Guardando…' : 'Acepto'}</button>
        <button className="btn block" onClick={() => void supabase?.auth.signOut()}>No acepto: cerrar sesión</button>
      </div>
    </div>
  )
}
