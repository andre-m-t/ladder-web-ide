import { describe, expect, it } from 'vitest'
import { BLINK, IO_ESPELHO, MINIMAL } from './fixtures'
import { validarDiagrama } from './validacao'

describe('fixtures de referencia', () => {
  it.each([
    ['MINIMAL', MINIMAL],
    ['IO_ESPELHO', IO_ESPELHO],
    ['BLINK', BLINK],
  ] as const)('%s nao tem problema nenhum', (_nome, diagrama) => {
    expect(validarDiagrama(diagrama)).toEqual([])
  })

  it('BLINK usa contato NA, contato NF, ramo paralelo, bobina SET/RESET e ctu', () => {
    const tipos = new Set(BLINK.rungs.flatMap((r) => r.elementos.map((e) => e.tipo)))
    expect(tipos).toContain('contato_na')
    expect(tipos).toContain('contato_nf')
    expect(tipos).toContain('bobina_set')
    expect(tipos).toContain('bobina_reset')
    expect(tipos).toContain('ctu')
    expect(BLINK.rungs.some((r) => r.ramos.length > 0)).toBe(true)
  })
})
