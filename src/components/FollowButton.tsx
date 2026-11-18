import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, UserPlus } from 'lucide-react'
import { myFollows, setFollow } from '../lib/feed'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

/** Seguir a una banda o a un músico: sus publicaciones aparecen en «Para ti». Solo personas adultas. */
export default function FollowButton({ kind, id }: { kind: 'band' | 'profile'; id: string }) {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const { data: follows } = useQuery({ queryKey: ['follows', me], queryFn: myFollows, enabled: !!supabase && !!me, staleTime: 5 * 60_000 })
  const on = follows?.has(`${kind}:${id}`) ?? false
  const toggle = useMutation({ mutationFn: () => setFollow(kind, id, !on, me!), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['follows'] }); await qc.invalidateQueries({ queryKey: ['feed'] }) } })
  if (!supabase || !me || id === me) return null
  return (
    <button className={`btn ${on ? '' : 'primary'}`} disabled={toggle.isPending || !follows} onClick={() => toggle.mutate()} aria-pressed={on}>
      {on ? <><Check size={16} aria-hidden /> Siguiendo</> : <><UserPlus size={16} aria-hidden /> Seguir</>}
    </button>
  )
}
