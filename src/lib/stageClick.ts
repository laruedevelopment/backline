const KEY = 'backline-stage-click-v1'

/** Ajustes del metrónomo del modo escenario (se guardan en este dispositivo). */
export type StageClickSettings = {
  /** Dar el pre-conteo solo al cambiar de canción. */
  auto: boolean
  /** Compases de pre-conteo (1 o 2). */
  bars: 1 | 2
  /** Seguir con el clic durante toda la canción. */
  keep: boolean
}

export const DEFAULT_STAGE_CLICK: StageClickSettings = { auto: true, bars: 1, keep: false }

export function parseStageClick(raw: string | null): StageClickSettings {
  try {
    const j = raw ? JSON.parse(raw) : {}
    return {
      auto: typeof j.auto === 'boolean' ? j.auto : DEFAULT_STAGE_CLICK.auto,
      bars: j.bars === 2 ? 2 : 1,
      keep: typeof j.keep === 'boolean' ? j.keep : DEFAULT_STAGE_CLICK.keep,
    }
  } catch { return DEFAULT_STAGE_CLICK }
}

export const readStageClick = (): StageClickSettings => { try { return parseStageClick(localStorage.getItem(KEY)) } catch { return DEFAULT_STAGE_CLICK } }
export const saveStageClick = (s: StageClickSettings) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* solo en memoria */ } }
