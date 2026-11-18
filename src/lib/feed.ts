// Muro: publicaciones, seguidores, me gusta y comentarios. Las fotos viven en un espacio privado y se ven con enlaces firmados.
import { avatarUrl } from './api'
import { processImage } from './image'
import { supabase } from './supabase'

const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}
const BUCKET = 'feed-media'
const PAGE = 20

export type Visibility = 'public' | 'friends' | 'band'
export const visibilityLabel: Record<Visibility, string> = { public: 'Público', friends: 'Amigos', band: 'Mi banda' }

export type FeedPost = { id: string; author: string; bandId: string | null; body: string; images: string[]; link: string; visibility: Visibility; createdAt: string }
type Row = { id: string; author: string; band_id: string | null; body: string | null; images: string[] | null; link: string | null; visibility: Visibility; created_at: string }
const COLS = 'id, author, band_id, body, images, link, visibility, created_at'
const toPost = (r: Row): FeedPost => ({ id: r.id, author: r.author, bandId: r.band_id, body: r.body ?? '', images: r.images ?? [], link: r.link ?? '', visibility: r.visibility, createdAt: r.created_at })

/** «Para ti»: lo tuyo, lo de tus amigos y de tus bandas, y lo de quienes sigues. */
export async function listForYou(before?: string): Promise<FeedPost[]> {
  const { data, error } = await db().rpc('feed_for_me', { p_limit: PAGE, p_before: before ?? new Date(Date.now() + 60_000).toISOString() })
  if (error) throw error
  return (data as Row[]).map(toPost)
}
/** «Descubrir»: lo público de toda la comunidad. */
export async function listPublic(before?: string): Promise<FeedPost[]> {
  let q = db().from('posts').select(COLS).eq('visibility', 'public').order('created_at', { ascending: false }).limit(PAGE)
  if (before) q = q.lt('created_at', before)
  const { data, error } = await q
  if (error) throw error
  return (data as Row[]).map(toPost)
}
export const PAGE_SIZE = PAGE

export type Stats = { likes: number; comments: number; liked: boolean }
export async function postStats(ids: string[]): Promise<Map<string, Stats>> {
  if (!ids.length) return new Map()
  const { data, error } = await db().rpc('post_stats', { p_ids: ids.slice(0, 50) })
  if (error) throw error
  return new Map((data as { post_id: string; likes: number; comments: number; liked: boolean }[]).map((r) => [r.post_id, { likes: r.likes, comments: r.comments, liked: r.liked }]))
}

export type Card = { id: string; name: string; avatarUrl: string | null }
/** Nombre y foto de las personas que aparecen (solo de quienes puedes conocer). */
export async function profileCards(ids: string[]): Promise<Map<string, Card>> {
  const uniq = [...new Set(ids)].slice(0, 60)
  if (!uniq.length) return new Map()
  const { data, error } = await db().rpc('profile_cards', { p_ids: uniq })
  if (error) throw error
  return new Map((data as { id: string; display_name: string; avatar_path: string | null }[]).map((r) => [r.id, { id: r.id, name: r.display_name || 'Músico', avatarUrl: avatarUrl(r.avatar_path) }]))
}

export async function bandNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)].filter(Boolean)
  if (!uniq.length) return new Map()
  const { data } = await db().from('bands').select('id, name').in('id', uniq)
  return new Map(((data ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]))
}

/** Enlaces firmados (1 hora) de fotos privadas. */
export async function signedUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map()
  const { data, error } = await db().storage.from(bucket).createSignedUrls(paths, 3600)
  if (error) throw error
  return new Map((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as [string, string]] : [])))
}
export const feedUrls = (paths: string[]) => signedUrls(BUCKET, paths)

export type NewPost = { body: string; link: string; visibility: Visibility; bandId: string | null; files: File[] }
export async function createPost(userId: string, p: NewPost): Promise<void> {
  const id = crypto.randomUUID()
  const uploaded: string[] = []
  try {
    for (const [i, f] of p.files.slice(0, 4).entries()) {
      const img = await processImage(f, { maxSide: 1600, quality: 0.82 })
      const path = `${userId}/${id}/${i}.${img.ext}`
      const { error } = await db().storage.from(BUCKET).upload(path, img.blob, { contentType: img.blob.type, cacheControl: '3600', upsert: false })
      if (error) throw error
      uploaded.push(path)
    }
    const { error } = await db().from('posts').insert({
      id, band_id: p.bandId, body: p.body.trim() || null, images: uploaded, link: p.link.trim() || null, visibility: p.visibility,
    })
    if (error) throw error
  } catch (e) {
    if (uploaded.length) await db().storage.from(BUCKET).remove(uploaded).catch(() => {})
    throw e
  }
}
export async function deletePost(post: FeedPost) {
  const { error } = await db().from('posts').delete().eq('id', post.id)
  if (error) throw error
  if (post.images.length) await db().storage.from(BUCKET).remove(post.images).catch(() => {})
}

export async function setLike(postId: string, userId: string, on: boolean) {
  const t = db().from('post_likes')
  const { error } = on ? await t.insert({ post_id: postId }) : await t.delete().eq('post_id', postId).eq('profile_id', userId)
  if (error && !/duplicate/.test(error.message)) throw error
}

export type PostComment = { id: string; author: string; body: string; createdAt: string }
export async function listPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await db().from('post_comments').select('id, author, body, created_at').eq('post_id', postId).order('created_at').limit(100)
  if (error) throw error
  return (data as { id: string; author: string; body: string; created_at: string }[]).map((r) => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at }))
}
export async function addPostComment(postId: string, body: string) {
  const { error } = await db().from('post_comments').insert({ post_id: postId, body: body.trim().slice(0, 500) })
  if (error) throw error
}
export async function deletePostComment(id: string) {
  const { error } = await db().from('post_comments').delete().eq('id', id)
  if (error) throw error
}

export async function myFollows(): Promise<Set<string>> {
  const { data, error } = await db().from('follows').select('target_kind, target_id')
  if (error) throw error
  return new Set((data as { target_kind: string; target_id: string }[]).map((f) => `${f.target_kind}:${f.target_id}`))
}
export async function setFollow(kind: 'band' | 'profile', targetId: string, on: boolean, userId: string) {
  const t = db().from('follows')
  const { error } = on ? await t.insert({ target_kind: kind, target_id: targetId }) : await t.delete().eq('follower', userId).eq('target_kind', kind).eq('target_id', targetId)
  if (error && !/duplicate/.test(error.message)) throw error
}

/** ¿Declaró ser mayor de edad? (el muro público, seguir y el mercado son solo para adultos). */
export async function amAdult(userId: string): Promise<boolean> {
  const { data, error } = await db().rpc('is_adult', { p: userId })
  if (error) return false
  return data === true
}

/** Borra las fotos de la persona en un espacio privado (al borrar la cuenta). */
export async function purgeFolder(bucket: 'feed-media' | 'market-media' | 'payment-proofs', userId: string) {
  const store = db().storage.from(bucket)
  const { data: dirs } = await store.list(userId, { limit: 200 })
  for (const d of dirs ?? []) {
    const { data: files } = await store.list(`${userId}/${d.name}`, { limit: 100 })
    const paths = (files ?? []).map((f) => `${userId}/${d.name}/${f.name}`)
    if (paths.length) await store.remove(paths)
  }
}
