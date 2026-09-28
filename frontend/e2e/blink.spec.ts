/**
 * Teste ponta a ponta do contador CTU em projeto Ladder (spec 003, revisão
 * aditiva da tarefa #12, plano D-13; frente T): a fixture BLINK
 * (`frontend/src/ladder/fixtures.ts`) tem 8 degraus, incluindo o contador
 * `CTU` (Q-5/Q-7 da spec 002) — pesado demais para montar por arrasto real
 * como `compilar.spec.ts`/`recarga.spec.ts` fazem com IO_ESPELHO (2
 * elementos). Em vez disso, este teste semeia o projeto direto em
 * `localStorage['ladderflow:projeto']` (mesmo formato que `recarga.spec.ts`
 * usa para testar a migração de `ladderflow:diagrama`) e confere que a IDE
 * carrega, valida e serializa esse diagrama corretamente depois de um
 * `page.reload()` — o mesmo caminho de carga que qualquer projeto salvo usa,
 * sem depender de arrasto para o contador em si.
 *
 * A fixture é importada direto de `../src/ladder/fixtures` (não copiada em
 * JSON): o objeto `BLINK` é dado de teste puro (sem React/DOM), então
 * importável em Node pelo próprio Playwright, e qualquer mudança futura na
 * fixture chega aqui sem precisar duplicar o diagrama.
 *
 * O que é conferido:
 *   - os 8 degraus aparecem (`role="group"`, "Degrau N, grade") e a aba
 *     Problemas mostra "Problemas 0" — BLINK é o mesmo diagrama de
 *     referência que `serializador.dourados.test.ts` já valida como
 *     serializável sem erro;
 *   - Compilar fica habilitado (D-6: nenhum erro de validação, serialização
 *     ok);
 *   - o menu Baixar → "Structured Text (.st)" entrega, byte a byte, o mesmo
 *     arquivo dourado `backend/tests/fixtures/serializados/blink.st` (spec
 *     003, D-11) que `serializador.dourados.test.ts` grava e que
 *     `test_serializador_diferencial.py` roda contra o `plc_host_runner`;
 *   - o corpo enviado a `/compile/pacote` (interceptado, back-end fora do ar
 *     de propósito — mesma nota de `compilar.spec.ts`) é exatamente esse
 *     mesmo texto.
 *
 * `rodar.sh` monta o repositório inteiro em `/repo` (não só `frontend/`),
 * então o arquivo dourado existe no contêiner no mesmo caminho relativo
 * usado abaixo.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { BLINK } from '../src/ladder/fixtures'

const AQUI = dirname(fileURLToPath(import.meta.url))
/** `frontend/e2e` → raiz do repositório → `backend/tests/fixtures/serializados`
 * (spec 003, D-11) — o mesmo arquivo dourado que `serializador.dourados.test.ts`
 * grava e que `test_serializador_diferencial.py` executa no `plc_host_runner`. */
const CAMINHO_ST_DOURADO = join(AQUI, '..', '..', 'backend', 'tests', 'fixtures', 'serializados', 'blink.st')
const ST_DOURADO_BLINK = readFileSync(CAMINHO_ST_DOURADO, 'utf-8')

const CHAVE_PROJETO = 'ladderflow:projeto'

/** Envelope de projeto (`frontend/src/projeto/projeto.ts`) em torno da
 * fixture BLINK — a mesma forma `{ versao, titulo, linguagem, diagrama }`
 * que `salvarProjeto`/`carregarProjeto` leem e gravam. */
const PROJETO_BLINK = {
  versao: 2 as const,
  titulo: 'Blink',
  linguagem: 'ld' as const,
  diagrama: BLINK,
}

/** Pacote fabricado no formato de `Pacote` (`frontend/src/lib/api.ts`) — só o
 * suficiente para o `App` considerar a compilação um sucesso, sem exercer o
 * `idf.py`/`iec2c` reais (mesmo pacote de `compilar.spec.ts`). */
const PACOTE_FABRICADO = {
  chip: 'esp32',
  flash: { mode: 'dio', freq: '40m', size: '4MB' },
  images: [
    { name: 'bootloader.bin', offset: 4096, size: 2048, sha256: 'a'.repeat(64), data_base64: '' },
    { name: 'partition-table.bin', offset: 32768, size: 1024, sha256: 'b'.repeat(64), data_base64: '' },
    { name: 'app.bin', offset: 65536, size: 4096, sha256: 'c'.repeat(64), data_base64: '' },
  ],
}

const TOTAL_DEGRAUS_BLINK = 8

test.describe('Projeto Ladder com contador CTU (spec 003, tarefa #12/D-13): BLINK carregado do armazenamento', () => {
  test('os 8 degraus carregam sem problemas, Compilar fica habilitado e o .st baixado bate byte a byte com o dourado', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.evaluate(
      ({ chave, projeto }) => window.localStorage.setItem(chave, JSON.stringify(projeto)),
      { chave: CHAVE_PROJETO, projeto: PROJETO_BLINK },
    )
    await page.reload()

    // Cabeçalho: título do projeto carregado (BarraSuperior.tsx).
    await expect(page.getByText('Blink', { exact: true })).toBeVisible()

    // Os 8 degraus da fixture aparecem (GradeDegrau.tsx: `role="group"`,
    // "Degrau N, grade" — um por rung do diagrama).
    for (let i = 1; i <= TOTAL_DEGRAUS_BLINK; i++) {
      await expect(page.getByRole('group', { name: `Degrau ${i}, grade` })).toBeVisible()
    }

    // Degrau 1: contato NA "pulso" (CU do contador), o contador CTU na coluna
    // terminal com a saída "atingiu" e, na linha de reset (`linhaControle`), o
    // contato "reset_ctu" que alimenta a entrada R.
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA pulso' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, contador CTU atingiu' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Degrau 1, reset do contador, coluna 1, contato NA reset_ctu' }),
    ).toBeVisible()

    // "Problemas 0" — BLINK é o diagrama de referência do serializador
    // diferencial, sem erro nem aviso de validação.
    await page.getByRole('tab', { name: /^Problemas/ }).click()
    await expect(page.getByRole('tab', { name: 'Problemas 0' })).toHaveAttribute('aria-selected', 'true')

    await page.screenshot({ path: 'test-results/blink-01-ld-carregado.png', fullPage: true })

    // Menu Baixar → "Structured Text (.st)": exatamente o texto que o
    // serializador produz para BLINK — o mesmo arquivo dourado que
    // `serializador.dourados.test.ts` grava e que o pytest diferencial roda
    // contra o `plc_host_runner`.
    await page.getByRole('button', { name: 'Baixar projeto' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Structured Text (.st)' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.st$/)
    const caminhoBaixado = await download.path()
    if (caminhoBaixado === null) throw new Error('download sem caminho local (falhou?)')
    const conteudoBaixado = readFileSync(caminhoBaixado, 'utf-8')
    expect(conteudoBaixado).toBe(ST_DOURADO_BLINK)

    // Intercepta /compile/pacote (sem back-end no ar, mesma nota de
    // `compilar.spec.ts`) e confere que Compilar está habilitado e envia o
    // mesmo texto dourado.
    let corpoRecebido: unknown
    await page.route('**/compile/pacote', async (route) => {
      corpoRecebido = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PACOTE_FABRICADO),
      })
    })

    const botaoCompilar = page.getByRole('button', { name: 'Compilar' })
    await expect(botaoCompilar).toBeEnabled()
    await botaoCompilar.click()

    await page.getByRole('tab', { name: 'Console', exact: true }).click()
    const log = page.getByRole('log', { name: 'Console' })
    await expect(log).toContainText('Compilação iniciada')
    await expect(log).toContainText('Compilação concluída')

    expect((corpoRecebido as { source: string }).source).toBe(ST_DOURADO_BLINK)

    await page.screenshot({ path: 'test-results/blink-02-ld-pos-compilacao.png', fullPage: true })
  })
})
