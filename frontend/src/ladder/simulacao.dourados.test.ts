/**
 * Arquivos dourados (spec 004, plano D-11): a ponte entre os diagramas de
 * referência deste projeto (TypeScript, `fixtures.ts`) e o segundo executor
 * do arcabouço diferencial (pytest, `test_simulacao_diferencial.py`).
 *
 * Cada `.json` em `backend/tests/fixtures/diagramas/` é `JSON.stringify` do
 * próprio `Diagrama` de `fixtures.ts` — gravado aqui por `toMatchFileSnapshot`,
 * nunca escrito à mão. `SimuladorExecutor` (frente X) resolve o diagrama
 * irmão de um `.st` pelo nome: `.../serializados/blink.st` →
 * `.../diagramas/blink.json` — por isso os seis nomes usados aqui são
 * exatamente os mesmos de `serializador.dourados.test.ts`.
 *
 * Os arquivos são versionados: uma mudança em `fixtures.ts` que altere a
 * forma do diagrama faz este teste falhar (sem `-u`), obrigando quem mudou a
 * olhar o diff e decidir se a mudança é intencional. Para regenerá-los de
 * propósito, depois de revisar o diff:
 *
 *   cd frontend && npx vitest run -u src/ladder/simulacao.dourados.test.ts
 *
 * seguido de uma rodada sem `-u` para confirmar que o resultado é estável.
 */
import { describe, expect, it } from 'vitest'

import { BLINK, IO_ESPELHO, MINIMAL, PORTAO, RAMO_OU, SAIDAS_PARALELAS, SELO, SET_RESET } from './fixtures'

// Caminho relativo ao próprio arquivo de teste — mesmo motivo de
// `serializador.dourados.test.ts`: evita `node:path`/`node:url` (para não
// precisar de `@types/node`) e evita um caminho absoluto fora da raiz do
// Vite, que o vitest resolve mal sob jsdom.
function caminhoDourado(nome: string): string {
  return `../../../backend/tests/fixtures/diagramas/${nome}.json`
}

describe('arquivos dourados (D-11) — diagrama TS -> JSON para o pytest', () => {
  it.each([
    ['io_espelho', IO_ESPELHO],
    ['minimal', MINIMAL],
    ['ramo_ou', RAMO_OU],
    ['set_reset', SET_RESET],
    ['selo', SELO],
    ['blink', BLINK],
    ['portao', PORTAO],
    ['saidas_paralelas', SAIDAS_PARALELAS],
  ] as const)('%s: o diagrama serializado em JSON bate com o arquivo dourado', async (nome, diagrama) => {
    const texto = JSON.stringify(diagrama, null, 2) + '\n'
    await expect(texto).toMatchFileSnapshot(caminhoDourado(nome))
  })
})
