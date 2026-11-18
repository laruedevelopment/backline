// Mercado de equipo: anuncios entre músicos adultos. Backline no cobra ni procesa pagos; hay preguntas públicas.
import { processImage } from './image'
import { signedUrls } from './feed'
import { supabase } from './supabase'

const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}
const BUCKET = 'market-media'

export const categories: [string, string][] = [
  ['guitarra', 'Guitarras'], ['bajo', 'Bajos'], ['bateria', 'Baterías'], ['teclado', 'Teclados'], ['vientos', 'Vientos'], ['cuerdas', 'Cuerdas'],
  ['amplificador', 'Amplificadores'], ['pedal', 'Pedales'], ['microfono', 'Micrófonos'], ['audio', 'Audio'], ['accesorios', 'Accesorios'], ['otro', 'Otros'],
]
export const categoryLabel = Object.fromEntries(categories)
export const conditions: [string, string][] = [['nuevo', 'Nuevo'], ['como_nuevo', 'Como nuevo'], ['usado', 'Usado'], ['para_reparar', 'Para reparar']]
export const conditionLabel = Object.fromEntries(conditions)
export const price = (n: number) => (n === 0 ? 'Gratis' : `$${n.toLocaleString('es-CO')}`)

export type Listing = {
  id: string; seller: string; title: string; description: string; category: string; condition: string; price: number
  brand: string; city: string; acceptsTrade: boolean; whatsapp: string; images: string[]; status: 'active' | 'sold' | 'paused'; createdAt: string
}
type Row = {
  id: string; seller: string; title: string; description: string | null; category: string; condition: string; price: number | string; brand: string | null
  city: string | null; accepts_trade: boolean; whatsapp: string | null; images: string[] | null; status: Listing['status']; created_at: string
}
const COLS = 'id, seller, title, description, category, condition, price, brand, city, accepts_trade, whatsapp, images, status, created_at'
const toListing = (r: Row): Listing => ({
  id: r.id, seller: r.seller, title: r.title, description: r.description ?? '', category: r.category, condition: r.condition, price: Number(r.price),
  brand: r.brand ?? '', city: r.city ?? '', acceptsTrade: r.accepts_trade, whatsapp: r.whatsapp ?? '', images: r.images ?? [], status: r.status, createdAt: r.created_at,
})

export async function listListings(f: { category?: string; q?: string; mine?: string }): Promise<Listing[]> {
  let q = db().from('listings').select(COLS).order('created_at', { ascending: false }).limit(60)
  if (f.mine) q = q.eq('seller', f.mine)
  else q = q.eq('status', 'active')
  if (f.category) q = q.eq('category', f.category)
  const term = f.q?.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`title.ilike.%${term}%,brand.ilike.%${term}%`)
  const { data, error } = await q
  if (error) throw error
  return (data as Row[]).map(toListing)
}
export async function getListing(id: string): Promise<Listing | null> {
  const { data, error } = await db().from('listings').select(COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toListing(data as Row) : null
}
export const marketUrls = (paths: string[]) => signedUrls(BUCKET, paths)

export type NewListing = { title: string; description: string; category: string; condition: string; price: number; brand: string; city: string; acceptsTrade: boolean; whatsapp: string; files: File[] }
export async function createListing(userId: string, l: NewListing): Promise<string> {
  const id = crypto.randomUUID()
  const uploaded: string[] = []
  try {
    for (const [i, f] of l.files.slice(0, 6).entries()) {
      const img = await processImage(f, { maxSide: 1600, quality: 0.82 })
      const path = `${userId}/${id}/${i}.${img.ext}`
      const { error } = await db().storage.from(BUCKET).upload(path, img.blob, { contentType: img.blob.type, cacheControl: '3600', upsert: false })
      if (error) throw error
      uploaded.push(path)
    }
    const { error } = await db().from('listings').insert({
      id, title: l.title.trim(), description: l.description.trim() || null, category: l.category, condition: l.condition, price: Math.max(0, Math.round(l.price)),
      brand: l.brand.trim() || null, city: l.city.trim() || null, accepts_trade: l.acceptsTrade, whatsapp: l.whatsapp.trim() || null, images: uploaded,
    })
    if (error) throw error
    return id
  } catch (e) {
    if (uploaded.length) await db().storage.from(BUCKET).remove(uploaded).catch(() => {})
    throw e
  }
}
export async function setListingStatus(id: string, status: Listing['status']) {
  const { error } = await db().from('listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function deleteListing(l: Listing) {
  const { error } = await db().from('listings').delete().eq('id', l.id)
  if (error) throw error
  if (l.images.length) await db().storage.from(BUCKET).remove(l.images).catch(() => {})
}

export type Question = { id: string; author: string; body: string; answer: string; createdAt: string }
export async function listQuestions(listingId: string): Promise<Question[]> {
  const { data, error } = await db().from('listing_questions').select('id, author, body, answer, created_at').eq('listing_id', listingId).order('created_at').limit(100)
  if (error) throw error
  return (data as { id: string; author: string; body: string; answer: string | null; created_at: string }[]).map((r) => ({ id: r.id, author: r.author, body: r.body, answer: r.answer ?? '', createdAt: r.created_at }))
}
export async function askQuestion(listingId: string, body: string) {
  const { error } = await db().from('listing_questions').insert({ listing_id: listingId, body: body.trim().slice(0, 500) })
  if (error) throw error
}
export async function answerQuestion(id: string, answer: string) {
  const { error } = await db().from('listing_questions').update({ answer: answer.trim().slice(0, 500) || null }).eq('id', id)
  if (error) throw error
}
export async function deleteQuestion(id: string) {
  const { error } = await db().from('listing_questions').delete().eq('id', id)
  if (error) throw error
}
