import { CHUNK } from './reload'
import { supabase } from './supabase'

const seen = new Set<string>()
let sent = 0
// Ruido que no es un fallo de Backline: el navegador avisando de redibujos, extensiones o cortes de red.
const NOISE = /ResizeObserver loop|Script error|Failed to fetch|Load failed|NetworkError|AbortError|chrome-extension|moz-extension/i

/** Guarda el error en la base propia (sin terceros). Solo con sesión, sin repetir el mismo mensaje y máximo 5 por visita. */
export function reportError(error: unknown, extra?: string) {
  try {
    const msg = String((error as Error)?.message ?? error ?? '').trim()
    if (!supabase || !msg || NOISE.test(msg) || CHUNK.test(msg) || seen.has(msg) || sent >= 5) return
    seen.add(msg); sent++
    const stack = [(error as Error)?.stack, extra].filter(Boolean).join('\n')
    void supabase.rpc('log_client_error', {
      p_message: msg, p_stack: stack || null, p_url: location.pathname, p_agent: navigator.userAgent, p_version: import.meta.env.MODE,
    }).then(() => {}, () => {})
  } catch { /* registrar un error nunca debe causar otro */ }
}

export function installErrorLog() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason))
}
