/// <reference lib="webworker" />
// Service worker de Backline: funciona sin conexión (precarga la app) y recibe notificaciones push.
// Está fuera de src/ a propósito: usa los tipos del worker, no los del navegador.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Cualquier ruta de la app (p. ej. /setlists/abc) abre el index precargado, también sin señal.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

type PushPayload = { title?: string; body?: string; url?: string; tag?: string }

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try { data = event.data?.json() ?? {} } catch { data = { body: event.data?.text() } }
  const icon = new URL('icon-192.png', self.registration.scope).href
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Backline', {
      body: data.body,
      icon,
      badge: icon,
      tag: data.tag, // el mismo tipo de aviso reemplaza al anterior en vez de apilarse
      data: { url: data.url ?? '' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data as { url?: string } | undefined)?.url ?? '', self.registration.scope).href
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of open) {
        await client.focus()
        if ('navigate' in client) await (client as WindowClient).navigate(target)
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
