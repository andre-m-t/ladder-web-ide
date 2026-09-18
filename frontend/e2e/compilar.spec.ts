/**
 * Teste ponta a ponta do Compilar em projeto Ladder (spec 003, tarefa #9,
 * plano D-6/D-10; menu Baixar acrescentado na tarefa #11, D-12): monta o
 * cenário de referência "espelho direto" (IO_ESPELHO,
 * `frontend/src/ladder/fixtures.ts`) só pela UI — mesmo padrão de
 * `recarga.spec.ts` (arrasto real, painel lateral de variáveis) — e confere
 * duas coisas que dependem do mesmo serializador
 * (`frontend/src/ladder/serializador.ts`): o texto que Compilar envia a
 * `/compile/pacote`, e o arquivo `.st` que o menu Baixar entrega para
 * download — ambos comparados byte a byte contra o arquivo dourado
 * `backend/tests/fixtures/serializados/io_espelho.st` (spec 003, D-11), sem
 * reimplementar o serializador aqui. `rodar.sh` monta o repositório inteiro
 * em `/repo` (não só `frontend/`, ver o script), então o arquivo dourado
 * existe no contêiner no mesmo caminho relativo usado abaixo.
 *
 * A aba "ST gerado" saiu do painel inferior nesta mesma rodada de UX (D-12,
 * revisão da Q-1) — o texto ST só é visto, hoje, baixando o arquivo.
 *
 * O back-end fica fora do ar (mesma nota de `recarga.spec.ts`): `/compile/pacote`
 * é interceptado por `page.route` com um pacote fabricado no formato de
 * `Pacote` (`frontend/src/lib/api.ts`) — sem exercer o `iec2c` real, que já é
 * medido pelo teste diferencial do backend (spec 003, tarefa #4).
 *
 * Web Serial em Chromium headless: a API é padrão (não mais "experimental")
 * desde o Chrome 89, mas o *backend* de porta serial do Chromium (o diálogo
 * de escolha de porta do SO) pode não existir no ambiente do contêiner
 * `mcr.microsoft.com/playwright` — o teste checa `navigator.serial` em tempo
 * de execução e ajusta a expectativa de Gravar de acordo, relatando os dois
 * casos no `test.info()` em vez de assumir um dos dois.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Locator, type Page } from '@playwright/test'

const AQUI = dirname(fileURLToPath(import.meta.url))
/** `frontend/e2e` → raiz do repositório → `backend/tests/fixtures/serializados`
 * (spec 003, D-11) — o mesmo arquivo dourado que `serializador.dourados.test.ts`
 * grava e que `test_serializador_diferencial.py` executa no `plc_host_runner`. */
const CAMINHO_ST_DOURADO = join(AQUI, '..', '..', 'backend', 'tests', 'fixtures', 'serializados', 'io_espelho.st')
const ST_DOURADO_IO_ESPELHO = readFileSync(CAMINHO_ST_DOURADO, 'utf-8')

/** Pacote fabricado no formato de `Pacote` (`frontend/src/lib/api.ts`) — só o
 * suficiente para o `App` considerar a compilação um sucesso e habilitar
 * Gravar (`podeGravar`), sem exercer o `idf.py`/`iec2c` reais. */
const PACOTE_FABRICADO = {
  chip: 'esp32',
  flash: { mode: 'dio', freq: '40m', size: '4MB' },
  images: [
    { name: 'bootloader.bin', offset: 4096, size: 2048, sha256: 'a'.repeat(64), data_base64: '' },
    { name: 'partition-table.bin', offset: 32768, size: 1024, sha256: 'b'.repeat(64), data_base64: '' },
    { name: 'app.bin', offset: 65536, size: 4096, sha256: 'c'.repeat(64), data_base64: '' },
  ],
}

/** Arrasto real por `page.mouse` (mesma função de `recarga.spec.ts` — o app
 * usa Pointer Events próprios e `preventDefault` no `pointerdown`, então
 * precisa de um arrasto de verdade, com passos intermediários). */
async function arrastar(page: Page, origem: Locator, alvo: Locator): Promise<void> {
  const caixaOrigem = await origem.boundingBox()
  const caixaAlvo = await alvo.boundingBox()
  if (!caixaOrigem || !caixaAlvo) {
    throw new Error('elemento de origem ou alvo do arrasto sem bounding box (fora da tela?)')
  }
  const x0 = caixaOrigem.x + caixaOrigem.width / 2
  const y0 = caixaOrigem.y + caixaOrigem.height / 2
  const x1 = caixaAlvo.x + caixaAlvo.width / 2
  const y1 = caixaAlvo.y + caixaAlvo.height / 2

  await page.mouse.move(x0, y0)
  await page.mouse.down()
  const passos = 12
  for (let i = 1; i <= passos; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / passos, y0 + ((y1 - y0) * i) / passos)
  }
  await page.mouse.up()
}

/** Declara uma variável localizada pelo painel lateral (mesma função de
 * `recarga.spec.ts`). */
async function declararVariavelLocalizada(page: Page, nome: string, classe: 'Entrada' | 'Saída', endereco: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Nome da nova variável' }).fill(nome)
  await page.getByRole('radio', { name: classe, exact: true }).click()
  await page.getByRole('combobox', { name: 'Pino da nova variável' }).selectOption(endereco)
  await page.getByRole('button', { name: 'Adicionar' }).click()
}

/** Arrasta um item novo da paleta até uma célula vazia e vincula a variável
 * pelo `ModalVariavel` (mesma função de `recarga.spec.ts`). */
async function inserirEVincular(page: Page, rotuloItem: string, rotuloCelulaVazia: string, nomeVariavel: string): Promise<void> {
  await arrastar(page, page.getByRole('button', { name: rotuloItem, exact: true }), page.getByRole('button', { name: rotuloCelulaVazia }))

  const prefixo = rotuloCelulaVazia.replace(/, vazia$/, '')
  const celula = page.getByRole('button', { name: new RegExp(`^${prefixo}, `) })
  await expect(celula).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await celula.click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await dialogo.getByRole('button', { name: new RegExp(`^${nomeVariavel} `, 'i') }).click()
  await expect(dialogo).toHaveCount(0)
}

/** Monta o diagrama IO_ESPELHO (`frontend/src/ladder/fixtures.ts`) num
 * projeto Ladder "Sem título" recém-aberto: entrada em %IX0.1, saída em
 * %QX0.1, contato NA na coluna 1 e bobina na coluna terminal — igual ao
 * cenário que `recarga.spec.ts` já monta para CA-8 (RF-13). */
async function montarIoEspelho(page: Page): Promise<void> {
  await declararVariavelLocalizada(page, 'entrada', 'Entrada', '%IX0.1')
  await declararVariavelLocalizada(page, 'saida', 'Saída', '%QX0.1')
  await inserirEVincular(page, 'Contato NA', 'Degrau 1, coluna 1, vazia', 'entrada')
  await inserirEVincular(page, 'Bobina', 'Degrau 1, coluna 8, vazia', 'saida')

  await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()
}

test.describe('Compilar em projeto Ladder (spec 003, CA-5): IO_ESPELHO envia o ST serializado a /compile/pacote', () => {
  test('monta IO_ESPELHO pela UI, baixa o .st pelo menu Baixar, compila com /compile/pacote interceptado e confere o corpo e o Console', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()

    await expect(page.getByText('Sem título', { exact: true })).toBeVisible()
    await montarIoEspelho(page)

    // "Problemas 0" — diagrama igual ao IO_ESPELHO de referência, sem erro.
    await page.getByRole('tab', { name: /^Problemas/ }).click()
    await expect(page.getByRole('tab', { name: 'Problemas 0' })).toHaveAttribute('aria-selected', 'true')

    await page.screenshot({ path: 'test-results/compilar-01-ld-montado.png', fullPage: true })

    // Menu Baixar (D-12, tarefa #11): a opção "Structured Text (.st)" baixa
    // exatamente o texto que o serializador produz para este diagrama — o
    // mesmo arquivo dourado que `serializador.dourados.test.ts` grava e que
    // o pytest diferencial roda contra o `plc_host_runner`. A aba "ST
    // gerado" saiu do painel inferior nesta rodada (Q-1 revista); o único
    // jeito de ver o texto hoje é baixando o arquivo.
    await page.getByRole('button', { name: 'Baixar projeto' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Structured Text (.st)' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.st$/)
    const caminhoBaixado = await download.path()
    if (caminhoBaixado === null) throw new Error('download sem caminho local (falhou?)')
    const conteudoBaixado = readFileSync(caminhoBaixado, 'utf-8')
    expect(conteudoBaixado).toBe(ST_DOURADO_IO_ESPELHO)

    // Intercepta /compile/pacote (sem back-end no ar, D-10: mesmo caminho do ST).
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

    // Console: início e sucesso da compilação (mesmo log do fluxo ST — D-10).
    await page.getByRole('tab', { name: 'Console', exact: true }).click()
    const log = page.getByRole('log', { name: 'Console' })
    await expect(log).toContainText('Compilação iniciada')
    await expect(log).toContainText('Compilação concluída')

    // Corpo enviado: exatamente o texto do arquivo dourado (spec 003, D-11) —
    // é o mesmo texto que `serializador.dourados.test.ts` grava e que o
    // pytest diferencial roda contra o `plc_host_runner`.
    expect((corpoRecebido as { source: string }).source).toBe(ST_DOURADO_IO_ESPELHO)

    await page.screenshot({ path: 'test-results/compilar-02-ld-pos-compilacao.png', fullPage: true })

    // Gravar: deixou de estar desabilitado "por falta de pacote" — a
    // compilação teve sucesso. Se este Chromium não tiver Web Serial (a API
    // é padrão desde o Chrome 89, mas o backend de porta serial do SO pode
    // não existir no contêiner de teste), Gravar continua desabilitado, só
    // que pelo motivo certo (aviso de Web Serial visível), não pela falta de
    // pacote — os dois casos são verificados e relatados explicitamente.
    const temWebSerial = await page.evaluate(() => 'serial' in navigator && Boolean((navigator as { serial?: unknown }).serial))
    const botaoGravar = page.getByRole('button', { name: 'Gravar no ESP32' })
    test.info().annotations.push({ type: 'web-serial', description: `navigator.serial disponível neste Chromium: ${temWebSerial}` })

    if (temWebSerial) {
      await expect(botaoGravar).toBeEnabled()
    } else {
      await expect(page.getByText(/não tem suporte à Web Serial/i)).toBeVisible()
      await expect(botaoGravar).toBeDisabled()
      // Não é o motivo do portão D-6 (diagrama), e sim a falta de Web Serial:
      // o rótulo do botão continua "Gravar no ESP32", não uma mensagem de
      // "problema"/"nada a compilar" — confirma que o pacote existe.
      await expect(botaoGravar).toHaveAttribute('title', 'Gravar no ESP32')
    }
  })
})

test.describe('Recusa do editor vira toast (spec 002, D-18)', () => {
  test('soltar um contato na coluna terminal (reservada a bobinas) recusa e mostra um toast com "posição inválida"', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()

    await expect(page.getByText('Sem título', { exact: true })).toBeVisible()

    // A coluna terminal (8) é reservada a bobinas — soltar um contato ali é
    // recusado pelo núcleo (`ladder/validacao.ts`), e a recusa aparece como
    // um toast (não mais na aba Mensagens, que saiu do painel inferior).
    await arrastar(
      page,
      page.getByRole('button', { name: 'Contato NA', exact: true }),
      page.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }),
    )

    const toast = page.getByRole('status')
    await expect(toast).toBeVisible()
    await expect(toast).toContainText(/posição inválida/i)

    await page.screenshot({ path: 'test-results/compilar-03-recusa-toast.png', fullPage: true })
  })
})
