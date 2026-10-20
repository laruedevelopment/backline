// Código de invitación guardado mientras la persona crea su cuenta o inicia sesión.
const KEY = 'backline-pending-invite'
// Mismo formato que genera la base de datos: letras y números, sin signos.
const VALID = /^[a-z0-9]{4,40}$/

export const normalizeInvite = (raw: string) => raw.trim().toLowerCase()
export const isInviteCode = (raw: string) => VALID.test(normalizeInvite(raw))

export function savePendingInvite(code: string) {
  if (!isInviteCode(code)) return
  try { localStorage.setItem(KEY, normalizeInvite(code)) } catch { /* sin almacenamiento: tendrá que usar el código a mano */ }
}
export function readPendingInvite(): string | null {
  try { const c = localStorage.getItem(KEY); return c && isInviteCode(c) ? c : null } catch { return null }
}
export function clearPendingInvite() {
  try { localStorage.removeItem(KEY) } catch { /* nada que limpiar */ }
}
/** Link que se comparte por WhatsApp. */
export const inviteLink = (base: string, code: string) => `${base}unirse/${encodeURIComponent(code)}`
