import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGE_CLICK, parseStageClick } from './stageClick'

describe('ajustes del metrónomo del escenario', () => {
  it('sin nada guardado usa los valores por defecto (pre-conteo automático de 1 compás, sin seguir)', () => {
    expect(parseStageClick(null)).toEqual(DEFAULT_STAGE_CLICK)
    expect(DEFAULT_STAGE_CLICK).toEqual({ auto: true, bars: 1, keep: false })
  })
  it('lee lo guardado y corrige valores raros', () => {
    expect(parseStageClick('{"auto":false,"bars":2,"keep":true}')).toEqual({ auto: false, bars: 2, keep: true })
    expect(parseStageClick('{"auto":"si","bars":7,"keep":1}')).toEqual(DEFAULT_STAGE_CLICK)
    expect(parseStageClick('no es json')).toEqual(DEFAULT_STAGE_CLICK)
  })
})
