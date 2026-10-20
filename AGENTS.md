# Backline — contexto del proyecto

Hereda las reglas de `C:\projects\AGENTS.md` (español, breve, hacer en vez de describir, plan antes de cambios grandes, nunca secretos en git, verificar antes de decir "listo").

## Qué es
Web app (PWA, **móvil primero**, también escritorio) para **centralizar la vida de una banda y la escena musical**: bandas, repertorio, setlists, ensayos, toques, rigs, miembros, salas de ensayo, red social y (luego) compraventa de equipo. Idea de Javier, que es músico: hoy su banda busca el setlist y las canciones perdidos en un chat de WhatsApp.

## Stack (todo en plan gratis al inicio)
- Vite + React 19 + TypeScript, react-router, TanStack Query, Zustand, lucide-react.
- PWA instalable con `vite-plugin-pwa`.
- Backend: **Supabase** (Postgres + RLS + Auth + Storage + Realtime). Sin backend propio al inicio.
- Hosting: GitHub Pages / Cloudflare Pages / Vercel (gratis). Repo en la organización `laruedevelopment` (pendiente de crear).
- Verificar: `npx tsc -b`, `npm run lint`, `npm run build`.

## Estado
Ver `docs/ROADMAP.md`. Hoy: Fase 0 (esqueleto + diseño + docs). Sin Supabase conectado todavía; la app corre con datos de demo locales (`src/data/demo.ts`).

## Documentos
- `docs/VISION.md` — visión, usuarios, módulos, ideas, nombre.
- `docs/ROADMAP.md` — fases y qué sigue.
- `docs/DATA_MODEL.md` — entidades y relaciones (borrador del esquema Supabase).
- `docs/DESIGN.md` — sistema de diseño y principios de UX.
- `docs/PENDIENTES-JAVIER.md` — lo que solo Javier puede hacer (cuentas, claves, amigo del ensayadero).

## Reglas propias
- Móvil primero: diseñar a 390 px, luego escalar. Navegación inferior en móvil, lateral en escritorio.
- Textos de interfaz en español natural (colombiano neutro); i18n ES/EN con diccionario (como su portafolio) se agrega en Fase 1.
- Todo cambio de esquema = migración versionada en `supabase/migrations/` (skill `supabase-cambio-seguro`).
- Menores de edad, música/video con derechos de autor y compraventa tienen implicaciones legales: consultar `lucia-cumplimiento` antes de abrirlas.
- Anotar en `docs/PENDIENTES-JAVIER.md` cualquier costo o cuenta nueva.
