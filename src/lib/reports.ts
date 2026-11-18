// Denuncias de contenido o de personas. Quien administra Backline las revisa desde el panel de Supabase (tabla content_reports).
import { supabase } from './supabase'

export type ReportKind = 'profile' | 'band' | 'message' | 'comment' | 'dm' | 'opening' | 'post' | 'post_comment' | 'listing' | 'listing_question'
export const reportReasons: [string, string][] = [
  ['acoso', 'Acoso, amenazas o insultos'],
  ['spam', 'Spam o publicidad no pedida'],
  ['estafa', 'Estafa o información falsa'],
  ['derechos_autor', 'Derechos de autor'],
  ['sexual_menores', 'Contenido sexual o que involucra menores'],
  ['otro', 'Otro motivo'],
]

export async function reportContent(kind: ReportKind, targetId: string, reason: string, details: string, excerpt?: string) {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('content_reports').insert({ kind, target_id: targetId, reason, details: details.trim().slice(0, 500) || null, excerpt: excerpt?.slice(0, 300) || null })
  if (error) throw error
}
