// Lógica pura de `notify-social` (sin Deno ni red): qué dice cada aviso. Está aparte para probarla con vitest.
export type Notice = { title: string; body: string; url: string; tag: string }

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
const first = (name: string) => (name || 'Alguien').trim().split(/\s+/)[0]

export const bandMessageNotice = (bandId: string, bandName: string, senderName: string, text: string): Notice => ({
  title: bandName, body: `${first(senderName)}: ${clip(text, 110)}`, url: 'banda/chat', tag: `chat-${bandId}`,
})
export const directNotice = (senderId: string, senderName: string, text: string): Notice => ({
  title: senderName || 'Mensaje nuevo', body: clip(text, 120), url: `explorar/amigos/${senderId}`, tag: `dm-${senderId}`,
})
export const friendRequestNotice = (senderName: string): Notice => ({
  title: 'Nueva solicitud de amistad', body: `${senderName || 'Alguien'} quiere ser tu amigo en Backline.`, url: 'explorar/amigos', tag: 'amigos',
})
export const friendAcceptedNotice = (name: string): Notice => ({
  title: 'Solicitud aceptada', body: `${name || 'Alguien'} y tú ahora son amigos. Escríbele.`, url: 'explorar/amigos', tag: 'amigos',
})

/** Un aviso solo se manda si lo que avisa es reciente: así un id viejo no se puede reusar para molestar. */
export const isFresh = (createdAt: string, now = Date.now(), maxMinutes = 5) => now - new Date(createdAt).getTime() <= maxMinutes * 60_000
