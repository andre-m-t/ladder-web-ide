/**
 * Teste ponta a ponta da simulação de ciclo de varredura no navegador (spec
 * 004, frente E) contra `vite preview` (subido por `rodar.sh`), sem back-end
 * no ar de propósito — a simulação não depende do servidor (§6 RNF da spec
 * 004: "sem instalação e sem servidor").
 *
 * Cobre os quatro critérios de aceitação atribuídos a esta frente pelo plano
 * (§8, Fatia 2 — "Frente E... ao fim"):
 *
 *   - **CA-4** (o coração da feature, RF-6/RF-12/RF-14): um degrau com um
 *     contato NA e uma bobina — a fixture `IO_ESPELHO` de
 *     `frontend/src/ladder/fixtures.ts`, a mesma que `compilar.spec.ts` e
 *     `recarga.spec.ts` montam pela UI. Aciona a entrada pelo painel de
 *     variáveis, avança um ciclo com **Passo** (o acionamento só vale a
 *     partir do ciclo seguinte — RF-1/RF-12/D-2) e confirma que o contato e a
 *     bobina energizam **por cor e por espessura de traço** (`stroke-ide-
 *     energizado` + `stroke-width="3"`, contra `stroke-ide-fio` +
 *     `stroke-width="2"` desenergizado — RF-14/D-12), e que a variável de
 *     saída vira verdadeira; desaciona e confirma que os três voltam.
 *   - **CA-5** (RF-1/RF-4/RF-11): a fixture `BLINK` (8 degraus, contador CTU
 *     — o mesmo cenário de `blink.spec.ts`) alternando a saída `led` com o
 *     período de 25 ciclos que `simulacao.test.ts` já mede contra o gabarito
 *     do arcabouço diferencial (`ledPorCiclo.get(25) === true`,
 *     `ledPorCiclo.get(50) === false`). **Sem tempo de parede**: em vez de
 *     esperar um número de milissegundos, o teste lê a contagem "Ciclo N" do
 *     cabeçalho do painel de variáveis e clica **Passo** exatamente o número
 *     de vezes que falta para alcançar o ciclo alvo — determinístico
 *     independente de quantos ciclos o laço de `requestAnimationFrame` (D-8)
 *     já tiver executado sozinho antes do primeiro `Pausar`.
 *   - **CA-8** (RF-15), na redação **revista em 2026-09-21**: com a simulação
 *     ativa, Compilar e Gravar ficam desabilitados com o motivo (no `title` do
 *     botão) e o congelamento **se anuncia**, em vez de ser silencioso — chip
 *     de simulação no cabeçalho, paleta esmaecida e `aria-disabled`, e o
 *     cadastro de variáveis inerte (Q-7, revisão de 2026-09-22), com a coluna
 *     Valor ainda acionável. Um arrasto real de mouse (paleta → célula vazia)
 *     não altera o diagrama e, por decisão do autor, **não** gera toast: a
 *     paleta é inerte, e o toast nasce em cima dela (cobria o item de que
 *     falava). Quem anuncia a recusa é uma tentativa de editar **pela grade**.
 *     Ao sair da simulação, Compilar volta e o mesmo arrasto volta a inserir.
 *
 *     O critério anterior — "nenhuma realimentação visual nenhuma, sem toast"
 *     — está **revogado** pela revisão aditiva de 2026-09-21 no `spec.md`, e
 *     com ele a asserção `getByRole('status')).toHaveCount(0)` que este bloco
 *     mantinha.
 *   - **CA-13** (RF-17): recarregar a página com a simulação ativa volta ao
 *     modo de edição — diagrama preservado em `localStorage`, sem "Ciclo N"
 *     no painel e sem o estado ao vivo das variáveis.
 *
 * Os diagramas são semeados direto em `localStorage['ladderflow:projeto']`
 * (mesmo padrão de `blink.spec.ts`/`recarga.spec.ts`, envelope de
 * `frontend/src/projeto/projeto.ts`) — as fixtures já são o gabarito medido
 * pelo motor (`simulacao.test.ts`) e pelo diferencial
 * (`backend/tests/test_simulacao_diferencial.py`); montar de novo pela UI só
 * duplicaria a cobertura que `recarga.spec.ts`/`compilar.spec.ts` já dão ao
 * arrasto em si. O arrasto real de mouse (Pointer Events, não sintético)
 * entra onde o CA-8 pede — testar exatamente que ele **não** tem efeito
 * durante a simulação, e volta a ter ao sair.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

import { BLINK, IO_ESPELHO } from '../src/ladder/fixtures'

const CHAVE_PROJETO = 'ladderflow:projeto'

/** Arrasto real por `page.mouse` (mesma função de `recarga.spec.ts`/
 * `compilar.spec.ts` — o app usa Pointer Events próprios e `preventDefault`
 * no `pointerdown`, então precisa de um arrasto de verdade, com passos
 * intermediários). */
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

/** Semeia um projeto Ladder direto em `localStorage` (envelope de
 * `frontend/src/projeto/projeto.ts`, mesmo formato de `blink.spec.ts`) e
 * recarrega — mais direto que montar pela UI para diagramas que já são
 * fixture de referência, sem duplicar a cobertura de arrasto que
 * `recarga.spec.ts`/`compilar.spec.ts` já dão. */
async function abrirProjetoSemeado(page: Page, titulo: string, diagrama: typeof IO_ESPELHO): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.evaluate(
    ({ chave, projeto }) => window.localStorage.setItem(chave, JSON.stringify(projeto)),
    { chave: CHAVE_PROJETO, projeto: { versao: 1 as const, titulo, linguagem: 'ld' as const, diagrama } },
  )
  await page.reload()
}

/** Lê "Ciclo N" do cabeçalho do painel de variáveis (`TabelaVariaveis.tsx`) —
 * só existe com a simulação ativa (RF-13). */
async function cicloAtual(page: Page): Promise<number> {
  const texto = await page.getByText(/^Ciclo \d+$/).textContent()
  const encontrado = texto ? /Ciclo (\d+)/.exec(texto) : null
  if (!encontrado) throw new Error('cabeçalho "Ciclo N" não encontrado — a simulação está ativa?')
  return Number(encontrado[1])
}

/** Avança clicando **Passo** exatamente o número de vezes que falta para o
 * ciclo `alvo` — nunca `sleep`/tempo de parede (CA-5). Parte de onde a
 * simulação estiver (o laço de `requestAnimationFrame`, D-8, pode já ter
 * avançado alguns ciclos sozinho antes do primeiro `Pausar` — a contagem lida
 * do próprio cabeçalho absorve essa variação, sem depender de nenhum ciclo
 * "zero" garantido). */
async function avancarAteCiclo(page: Page, alvo: number): Promise<void> {
  const botaoPasso = page.getByRole('button', { name: 'Avançar um ciclo' })
  let atual = await cicloAtual(page)
  if (atual > alvo) throw new Error(`simulação já passou do ciclo ${alvo} (está em ${atual}) — alvo tarde demais`)
  while (atual < alvo) {
    await botaoPasso.click()
    atual = await cicloAtual(page)
  }
  expect(atual).toBe(alvo)
}

/** O primeiro traço com `stroke-width` dentro de uma célula que não é o
 * retângulo de fundo (`classeRetangulo`, sempre `stroke-width="1"`, sem
 * relação com energização) — é a `<line>` do contato ou o `<path>` do arco da
 * bobina (`Simbolos.tsx`), onde `corTraco`/`larguraTraco` desenham a
 * codificação redundante cor+espessura da energização (RF-14, D-12). */
function tracoDaCelula(page: Page, rotulo: RegExp): Locator {
  return page.getByRole('button', { name: rotulo }).locator('line[stroke-width], path[stroke-width]').first()
}

test.describe('CA-4 (RF-6, RF-12, RF-14) — o coração da feature: acionar a entrada energiza contato e bobina no desenho', () => {
  test('IO_ESPELHO: acionar "entrada" energiza (cor e espessura) o contato e a bobina e vira "saida" verdadeira; desacionar volta tudo', async ({
    page,
  }) => {
    await abrirProjetoSemeado(page, 'IO espelho', IO_ESPELHO)

    await expect(page.getByText('IO espelho', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    // Estado desenergizado de hoje (fora de simulação): sem sufixo ",
    // energizado"/"desenergizado" no rótulo, traço normal.
    const contato = tracoDaCelula(page, /Degrau 1, coluna 1, contato NA entrada/)
    const bobina = tracoDaCelula(page, /Degrau 1, coluna 8, bobina saida/)
    await expect(contato).toHaveAttribute('stroke-width', '2')
    await expect(contato).toHaveClass(/stroke-ide-fio/)

    // Entra em simulação (RF-15/D-9: começa rodando) e pausa imediatamente —
    // o resto do teste avança por **Passo**, determinístico (mesmo espírito
    // de `avancarAteCiclo`, mas aqui a contagem exata de ciclo não importa,
    // só que o acionamento e cada Passo aconteçam numa ordem sem corrida com
    // o laço de `requestAnimationFrame`, D-8).
    const botaoSimular = page.getByRole('button', { name: 'Simular' })
    await expect(botaoSimular).toBeEnabled()
    await botaoSimular.click()
    await expect(page.getByRole('button', { name: 'Sair da simulação' })).toBeVisible()
    await page.getByRole('button', { name: 'Pausar simulação' }).click()
    await expect(page.getByRole('button', { name: 'Executar simulação' })).toBeVisible()

    await page.screenshot({ path: 'test-results/simular-01-entrada-pausado.png', fullPage: true })

    // Painel de variáveis: "entrada" é acionável (role="switch"), "saida" é
    // só leitura — RF-12/CA-9.
    const interruptorEntrada = page.getByRole('switch', { name: /^Acionar entrada/ })
    await expect(interruptorEntrada).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('[aria-label="Valor de saida: falso"]')).toBeVisible()

    const botaoPasso = page.getByRole('button', { name: 'Avançar um ciclo' })

    // Aciona a entrada: só tem efeito no ciclo seguinte (RF-1/D-2) — o
    // interruptor continua mostrando "falso" até o próximo Passo.
    await interruptorEntrada.click()
    await expect(interruptorEntrada).toHaveAttribute('aria-checked', 'false')
    await botaoPasso.click()

    // Ciclo seguinte: contato e bobina energizados — cor **e** espessura
    // (RF-14) — e "saida" vira verdadeira.
    await expect(interruptorEntrada).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[aria-label="Valor de saida: verdadeiro"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Degrau 1, coluna 1, contato NA entrada, energizado/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Degrau 1, coluna 8, bobina saida, energizado/ })).toBeVisible()
    await expect(contato).toHaveAttribute('stroke-width', '3')
    await expect(contato).toHaveClass(/stroke-ide-energizado/)
    await expect(bobina).toHaveAttribute('stroke-width', '3')
    await expect(bobina).toHaveClass(/stroke-ide-energizado/)

    await page.screenshot({ path: 'test-results/simular-02-entrada-energizado.png', fullPage: true })

    // Desaciona: de novo, só no próximo ciclo.
    await interruptorEntrada.click()
    await expect(interruptorEntrada).toHaveAttribute('aria-checked', 'true')
    await botaoPasso.click()

    await expect(interruptorEntrada).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('[aria-label="Valor de saida: falso"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Degrau 1, coluna 1, contato NA entrada, desenergizado/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Degrau 1, coluna 8, bobina saida, desenergizado/ })).toBeVisible()
    await expect(contato).toHaveAttribute('stroke-width', '2')
    await expect(contato).toHaveClass(/stroke-ide-fio/)
    await expect(bobina).toHaveAttribute('stroke-width', '2')
    await expect(bobina).toHaveClass(/stroke-ide-fio/)

    await page.screenshot({ path: 'test-results/simular-03-entrada-desenergizado.png', fullPage: true })
  })
})

test.describe('CA-5 (RF-1, RF-4, RF-11) — BLINK: a saída alterna com o mesmo período em ciclos que o gabarito', () => {
  test('led fica verdadeiro no ciclo 25 e falso no ciclo 50 (período de 25, o mesmo de simulacao.test.ts)', async ({ page }) => {
    await abrirProjetoSemeado(page, 'Blink', BLINK)

    await expect(page.getByText('Blink', { exact: true })).toBeVisible()
    // "Problemas 0" antes de simular — BLINK é o diagrama de referência do
    // simulador (`simulacao.dourados.test.ts`), sem erro de validação.
    await page.getByRole('tab', { name: /^Problemas/ }).click()
    await expect(page.getByRole('tab', { name: 'Problemas 0' })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('button', { name: 'Simular' }).click()
    await expect(page.getByRole('button', { name: 'Sair da simulação' })).toBeVisible()
    await page.getByRole('button', { name: 'Pausar simulação' }).click()
    await expect(page.getByRole('button', { name: 'Executar simulação' })).toBeVisible()

    // `botao` (%IX0.0) nunca é acionado — fica falso os 200 ciclos, igual ao
    // gabarito de `simulacao.test.ts`/`backend/tests/diferencial/fixtures/blink.toml`.
    await avancarAteCiclo(page, 25)
    await expect(page.locator('[aria-label="Valor de led: verdadeiro"]')).toBeVisible()

    await page.screenshot({ path: 'test-results/simular-04-blink-ciclo-25-led-aceso.png', fullPage: true })

    await avancarAteCiclo(page, 50)
    await expect(page.locator('[aria-label="Valor de led: falso"]')).toBeVisible()

    await page.screenshot({ path: 'test-results/simular-05-blink-ciclo-50-led-apagado.png', fullPage: true })
  })
})

test.describe('CA-8 (RF-15) — simulação ativa congela a edição e desabilita Compilar/Gravar; volta tudo ao sair', () => {
  test('Compilar/Gravar desabilitados com motivo; arrasto real da paleta não altera o diagrama; sair devolve os dois', async ({
    page,
  }) => {
    await abrirProjetoSemeado(page, 'IO espelho', IO_ESPELHO)
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()

    const botaoCompilar = page.getByRole('button', { name: 'Compilar' })
    const botaoGravar = page.getByRole('button', { name: 'Gravar no ESP32' })
    await expect(botaoCompilar).toBeEnabled()

    await page.getByRole('button', { name: 'Simular' }).click()
    await expect(page.getByRole('button', { name: 'Sair da simulação' })).toBeVisible()

    const motivo = 'Indisponível durante a simulação — saia da simulação para compilar ou gravar'
    await expect(botaoCompilar).toBeDisabled()
    await expect(botaoCompilar).toHaveAttribute('title', motivo)
    await expect(botaoGravar).toBeDisabled()
    await expect(botaoGravar).toHaveAttribute('title', motivo)

    // Preventivo (revisão de 2026-09-21, ajuste 2026-09-23): o congelamento se
    // anuncia — estado de simulação visível na faixa `BarraSimulacao` (destaque
    // visual), não num chip na barra superior; paleta inerte antes de qualquer gesto.
    const faixaSimulacao = page.getByRole('toolbar', { name: 'Simulação' })
    await expect(faixaSimulacao).toHaveClass(/bg-ide-destaque/)
    const itemPaleta = page.getByRole('button', { name: 'Contato NA', exact: true })
    await expect(itemPaleta).toHaveAttribute('aria-disabled', 'true')

    // Cadastro de variáveis inerte (Q-7, revisão de 2026-09-22) — mas a coluna
    // Valor segue acionável, que é o laço central da feature (RF-12).
    await expect(page.getByRole('button', { name: /remover variável entrada/i })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: /nome da variável entrada/i })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: /nome da variável entrada/i })).toHaveAttribute(
      'title',
      'Saia da simulação para editar variáveis',
    )
    await expect(page.getByRole('switch', { name: /acionar entrada/i })).toBeEnabled()

    // Arrasto real de mouse, paleta -> célula vazia (coluna 2, livre entre o
    // contato na coluna 1 e a bobina na coluna terminal): `EditorLadder`
    // (dono do congelamento, D-9) sai sem armar o arrasto quando `congelado`
    // — nenhuma realimentação visual nenhuma, nem prévia fantasma nem toast
    // (ver o relatório desta frente para a descrição do que se vê na tela).
    // Captura no meio do gesto (ponteiro pressionado, já sobre o alvo, antes
    // de soltar) documenta exatamente isso.
    const origemPaleta = page.getByRole('button', { name: 'Contato NA', exact: true })
    const celulaVazia = page.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    const caixaOrigem = await origemPaleta.boundingBox()
    const caixaAlvo = await celulaVazia.boundingBox()
    if (!caixaOrigem || !caixaAlvo) throw new Error('origem/alvo do arrasto sem bounding box')
    await page.mouse.move(caixaOrigem.x + caixaOrigem.width / 2, caixaOrigem.y + caixaOrigem.height / 2)
    await page.mouse.down()
    const x1 = caixaAlvo.x + caixaAlvo.width / 2
    const y1 = caixaAlvo.y + caixaAlvo.height / 2
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(
        caixaOrigem.x + caixaOrigem.width / 2 + ((x1 - (caixaOrigem.x + caixaOrigem.width / 2)) * i) / 12,
        caixaOrigem.y + caixaOrigem.height / 2 + ((y1 - (caixaOrigem.y + caixaOrigem.height / 2)) * i) / 12,
      )
    }
    await page.screenshot({ path: 'test-results/simular-06-congelado-arrasto-em-curso.png', fullPage: true })
    await page.mouse.up()

    // Nada mudou: a célula continua vazia, sem seleção, sem diálogo. E **sem
    // toast**, agora por decisão explícita e não por omissão: a paleta é
    // inerte, e o toast nasce no canto superior esquerdo, exatamente sobre os
    // primeiros itens dela — anunciaria a recusa cobrindo o item de que fala.
    // Quem anuncia é a grade, conferido logo abaixo.
    await expect(celulaVazia).toBeVisible()
    await expect(celulaVazia).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveCount(0)

    await page.screenshot({ path: 'test-results/simular-07-congelado-apos-soltar.png', fullPage: true })

    // Clicar/duplo-clicar num elemento já existente também não faz nada
    // (D-9: toda mutação passa por `congelado`, checado no início de cada
    // manipulador de `EditorLadder`).
    const celulaContato = page.getByRole('button', { name: /Degrau 1, coluna 1, contato NA entrada/ })
    await celulaContato.click()
    await expect(celulaContato).toHaveAttribute('aria-selected', 'false')

    // ...mas, diferente da paleta, a grade ANUNCIA a recusa (revisão de
    // 2026-09-21): é onde a pessoa ainda consegue tentar, e onde o toast não
    // cobre o alvo do gesto.
    await expect(page.getByRole('status')).toContainText('Edição congelada durante a simulação')
    // Fecha logo: o toast dura 5 s e este teste demora — se esperar até sair
    // da simulação, ele some antes do clique em "Fechar notificação".
    await page.getByRole('button', { name: 'Fechar notificação' }).click()
    await expect(page.getByRole('status')).toHaveCount(0)

    await celulaContato.dblclick()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Sai da simulação: os três voltam (RF-15).
    await page.getByRole('button', { name: 'Sair da simulação' }).click()
    await expect(page.getByRole('button', { name: 'Simular' })).toBeVisible()
    await expect(botaoCompilar).toBeEnabled()
    await expect(botaoCompilar).toHaveAttribute('title', 'Compilar')

    // O mesmo arrasto agora insere de verdade.
    await arrastar(page, origemPaleta, celulaVazia)
    const celulaInserida = page.getByRole('button', { name: /^Degrau 1, coluna 2, contato NA/ })
    await expect(celulaInserida).toBeVisible()
    await expect(celulaInserida).toHaveAttribute('aria-selected', 'true')

    await page.screenshot({ path: 'test-results/simular-08-fora-da-simulacao-arrasto-funciona.png', fullPage: true })
  })
})

test.describe('CA-13 (RF-17) — recarregar com a simulação ativa volta ao modo de edição', () => {
  test('reload durante a simulação preserva o diagrama e descarta todo estado de simulação', async ({ page }) => {
    await abrirProjetoSemeado(page, 'IO espelho', IO_ESPELHO)

    const brutoAntes = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_PROJETO)
    expect(brutoAntes).not.toBeNull()
    const projetoAntes = JSON.parse(brutoAntes as string)

    await page.getByRole('button', { name: 'Simular' }).click()
    await expect(page.getByRole('button', { name: 'Sair da simulação' })).toBeVisible()
    await expect(page.getByText(/^Ciclo \d+$/)).toBeVisible()
    await expect(page.getByRole('switch', { name: /^Acionar entrada/ })).toBeVisible()

    await page.screenshot({ path: 'test-results/simular-09-antes-do-reload.png', fullPage: true })

    await page.reload()

    // Volta ao modo de edição: "Simular" (não "Sair da simulação"), sem
    // "Ciclo N" e sem o interruptor de entrada — o estado ao vivo some
    // (RF-17), a variável volta a mostrar "—" (`ValorCelula`, valor
    // `undefined`).
    await expect(page.getByRole('button', { name: 'Simular' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sair da simulação' })).toHaveCount(0)
    await expect(page.getByText(/^Ciclo \d+$/)).toHaveCount(0)
    await expect(page.getByRole('switch', { name: /^Acionar entrada/ })).toHaveCount(0)
    await expect(page.locator('[aria-label="Valor de entrada: estado ao vivo disponível com a simulação (F9)"]')).toBeVisible()

    // O diagrama continua intacto, nas mesmas células.
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    const brutoDepois = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_PROJETO)
    const projetoDepois = JSON.parse(brutoDepois as string)
    expect(projetoDepois).toEqual(projetoAntes)

    await page.screenshot({ path: 'test-results/simular-10-apos-reload.png', fullPage: true })
  })
})
