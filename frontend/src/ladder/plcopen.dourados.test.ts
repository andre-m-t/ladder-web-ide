import { describe, expect, it } from 'vitest'

import { BLINK, IO_ESPELHO, SAIDAS_PARALELAS, SELO, SET_RESET } from './fixtures'
import { exportarPlcopen } from './plcopen'

const DATA_FIXA = '2026-09-23T12:00:00.000Z'

function caminhoDourado(nome: string): string {
  return `../../tests/fixtures/plcopen/${nome}.xml`
}

describe('arquivos dourados PLCopen', () => {
  it.each([
    ['io_espelho', IO_ESPELHO],
    ['selo', SELO],
    ['set_reset', SET_RESET],
    ['saidas_paralelas', SAIDAS_PARALELAS],
    ['blink', BLINK],
  ] as const)('%s: XML exportado bate com o dourado', async (nome, diagrama) => {
    const xml = exportarPlcopen(diagrama, nome, { creationDateTime: DATA_FIXA })
    await expect(xml).toMatchFileSnapshot(caminhoDourado(nome))
  })
})
