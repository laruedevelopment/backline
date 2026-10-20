# Diseño

Seguir la skill `diseno-humano`: nada de gradiente morado genérico, emojis como íconos ni textos "de IA". Que se sienta hecho por un músico.

## Tema: "tarima de noche"
Fondo oscuro cálido (se lee en un bar o en escenario), un acento ámbar tipo luz de escenario, rojo "ensayo/en vivo" para estados críticos.

| Token | Valor | Uso |
|---|---|---|
| `--ink` | #0F0E0D | fondo |
| `--surface` | #1A1816 | tarjetas |
| `--surface-2` | #242120 | elevaciones / inputs |
| `--line` | #332F2B | bordes |
| `--text` | #F3EEE6 | texto |
| `--muted` | #A39B90 | texto secundario |
| `--amber` | #F5A524 | acción principal, tono/afinación destacados |
| `--ember` | #E5484D | en vivo / alerta / cambio de afinación |
| `--sage` | #5FB38A | confirmado / listo |

Tipografía: títulos **Bricolage Grotesque**, texto **Inter**; números de tono/BPM en tabular-nums (mono-feeling) para leerse rápido.

## Principios UX
- Navegación inferior de 5 pestañas en móvil: Inicio · Repertorio · Setlists · Agenda · Perfil. Lateral en escritorio ≥ 900 px.
- Zonas de toque ≥ 44 px, acción principal al alcance del pulgar (botón flotante "+").
- "Chips" de tono / BPM / afinación siempre visibles y consistentes: es la información que más se consulta.
- Estados vacíos con una acción clara; estados de carga y error siempre.
- **Modo escenario**: contraste máximo, texto grande, sin distracciones, no se apaga la pantalla (Wake Lock API).
- Accesibilidad: contraste AA, foco visible, `prefers-reduced-motion`.
- Microcopy en español natural: "Agregar canción", no "Añadir elemento".
