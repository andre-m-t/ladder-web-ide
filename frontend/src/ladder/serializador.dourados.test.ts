/**
 * Arquivos dourados (D-11): a ponte entre este serializador (TypeScript) e
 * os testes diferenciais do back-end (pytest, `test_serializador_diferencial.py`).
 *
 * Cada `.st` em `backend/tests/fixtures/serializados/` é o texto que
 * `serializar` produz de verdade para um diagrama de referência — gravado
 * aqui por `toMatchFileSnapshot`, não escrito à mão. Isso quita a ressalva
 * R-1 do plano 002: antes desta spec, a equivalência diagrama↔ST era
 * assumida (o ST de referência era escrito por uma pessoa); a partir daqui,
 * o pytest roda exatamente o texto que a serialização produziu, então uma
 * divergência de comportamento aponta para um defeito real do serializador,
 * não para uma cópia manual desatualizada.
 *
 * Os arquivos são versionados: uma mudança no serializador que altere o
 * texto produzido faz este teste falhar (sem `-u`), obrigando quem mudou a
 * olhar o diff e decidir se a mudança é intencional. Para regenerá-los de
 * propósito, depois de revisar o diff:
 *
 *   cd frontend && npx vitest run -u src/ladder/serializador.dourados.test.ts
 *
 * seguido de uma rodada sem `-u` para confirmar que o resultado é estável.
 */
import { describe, expect, it } from 'vitest'

import { IO_ESPELHO, MINIMAL, RAMO_OU, SELO, SET_RESET } from './fixtures'
import { serializar } from './serializador'

// Caminho relativo ao próprio arquivo de teste — `toMatchFileSnapshot`
// resolve relativo a ele. Evita `node:path`/`node:url` (para não precisar de
// `@types/node` como dependência nova, plano §2) e evita passar um caminho
// absoluto fora da raiz do Vite, que o vitest resolve mal sob o ambiente
// jsdom deste projeto (vira `/@fs/...` e falha ao criar o diretório).
function caminhoDourado(nome: string): string {
  return `../../../backend/tests/fixtures/serializados/${nome}.st`
}

describe('arquivos dourados (D-11) — ponte TS -> pytest', () => {
  it.each([
    ['io_espelho', IO_ESPELHO],
    ['minimal', MINIMAL],
    ['ramo_ou', RAMO_OU],
    ['set_reset', SET_RESET],
    ['selo', SELO],
  ] as const)('%s: o texto serializado bate com o arquivo dourado', async (nome, diagrama) => {
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    await expect(resultado.st).toMatchFileSnapshot(caminhoDourado(nome))
  })
})
