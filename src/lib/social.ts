// Amigos y mensajes directos. Solo entre mayores de edad; solo se escribe entre amigos (lo hace cumplir la base de datos).
import { avatarUrl, type Post } from './api'
import { supabase } from './supabase'

const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export type Friend = {
  friendshipId: string
  id: string
  name: string
  avatarUrl: string | null
  instruments: string[]
  city: string
  /** friend = amigos; in = te la enviaron; out = la enviaste tú. */
  direction: 'friend' | 'in' | 'out'
  unread: number
  lastAt: string | null
}

type OverviewRow = {
  friendship_id: string; other_id: string; display_name: string; avatar_path: string | null; instruments: string[] | null; city: string | null
  status: string; direction: 'friend' | 'in' | 'out'; unread: number | string; last_at: string | null
}

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await db().rpc('friends_overview')
  if (error) throw error
  return (data as OverviewRow[]).map((r) => ({
    friendshipId: r.friendship_id, id: r.other_id, name: r.display_name || 'Músico', avatarUrl: avatarUrl(r.avatar_path),
    instruments: r.instruments ?? [], city: r.city ?? '', direction: r.direction, unread: Number(r.unread), lastAt: r.last_at,
  }))
}

export async function requestFriend(me: string, other: string) {
  const { error } = await db().from('friendships').insert({ requester: me, addressee: other })
  if (error) throw error
}

export async function acceptFriend(friendshipId: string) {
  const { data, error } = await db().from('friendships').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', friendshipId).select('id')
  if (error) throw error
  if (!data.length) throw new Error('La solicitud ya no existe')
}

/** Rechazar una solicitud, cancelar la que enviaste o dejar de ser amigos: todo es borrar la fila. */
export async function removeFriendship(friendshipId: string) {
  const { error } = await db().from('friendships').delete().eq('id', friendshipId)
  if (error) throw error
}

export async function blockUser(other: string) {
  const { error } = await db().rpc('block_user', { p: other })
  if (error) throw error
}

type DmRow = { id: string; sender: string; body: string; created_at: string }

/** Últimos mensajes con una persona, del más viejo al más nuevo. */
export async function listDirect(me: string, other: string): Promise<Post[]> {
  const { data, error } = await db().from('direct_messages').select('id, sender, body, created_at')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`)
    .order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data as DmRow[]).map((r) => ({ id: r.id, profileId: r.sender, body: r.body, createdAt: r.created_at })).reverse()
}

export async function sendDirect(me: string, other: string, body: string) {
  const { error } = await db().from('direct_messages').insert({ sender: me, recipient: other, body: body.trim().slice(0, 2000) })
  if (error) throw error
}

export async function deleteDirect(id: string) {
  const { error } = await db().from('direct_messages').delete().eq('id', id)
  if (error) throw error
}

export async function markDirectRead(me: string, other: string) {
  const { error } = await db().from('direct_messages').update({ read_at: new Date().toISOString() }).eq('sender', other).eq('recipient', me).is('read_at', null)
  if (error) throw error
}
