/**
 * Teste ponta a ponta (spec 002, tarefa #14, CA-8 — RF-13) contra
 * `vite preview` (subido por `rodar.sh`), sem back-end no ar de propósito:
 * `/health` falha e isso é esperado — a persistência do diagrama não
 * depende do servidor (§6 da Constituição). Fora do pacote de depósito do
 * INPI (scripts/build-deposito.sh só empacota `frontend/src`).
 *
 * Constrói o cenário "espelho direto" (IO_ESPELHO, §2 da spec) só pela UI —
 * arrasto real de mouse (o app usa Pointer Events próprios e chama
 * `preventDefault` no `pointerdown`, então o gesto precisa ser um arrasto de
 * verdade, com passos intermediários, não um clique/drop sintético) — e
 * confirma que sobrevive a um `page.reload()`. Um segundo teste cobre o
 * caminho de descarte de `localStorage` corrompido.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

const CHAVE_DIAGRAMA = 'ladderflow:diagrama'

/**
 * Arrasto real por `page.mouse`: down na origem, vários `move` intermediários
 * até o alvo (ultrapassa o limiar de 4px do app e faz o navegador emitir
 * `pointerenter` de verdade ao passar sobre o alvo, o que decide o destino do
 * arrasto — GradeDegrau.tsx/EditorLadder.tsx), e `up` para soltar.
 */
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

/** Declara uma variável localizada pelo formulário do painel de variáveis
 * (`TabelaVariaveis.tsx`): nome, classe (radiogroup Entrada/Saída/Memória) e,
 * quando há pino, o endereço exato pelo `<select>` — o primeiro endereço
 * livre da classe nem sempre é o que o teste precisa (`%IX0.1`/`%QX0.1`, não
 * `%IX0.0`/`%QX0.0`). */
async function declararVariavelLocalizada(page: Page, nome: string, classe: 'Entrada' | 'Saída', endereco: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Nome da nova variável' }).fill(nome)
  await page.getByRole('radio', { name: classe, exact: true }).click()
  await page.getByRole('combobox', { name: 'Pino da nova variável' }).selectOption(endereco)
  await page.getByRole('button', { name: 'Adicionar' }).click()
}

/** Arrasta um item novo da paleta até uma célula vazia (marca, sem abrir o
 * modal — D-13), clica de novo na própria célula (segundo clique, já
 * marcada) para abrir o `ModalVariavel`, e escolhe a variável pelo nome. */
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

test.describe('CA-8 (RF-13) — o diagrama sobrevive à recarga da página', () => {
  test('IO_ESPELHO construído pela UI (arrasto real) persiste após reload; aba ST continua intacta', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()

    // Variáveis localizadas, pelo painel à direita (visível por padrão):
    // entrada em %IX0.1, saída em %QX0.1 — os mesmos endereços da fixture
    // IO_ESPELHO (frontend/src/ladder/fixtures.ts).
    await declararVariavelLocalizada(page, 'entrada', 'Entrada', '%IX0.1')
    await declararVariavelLocalizada(page, 'saida', 'Saída', '%QX0.1')

    // Contato NA na coluna 1, vinculado a "entrada".
    await inserirEVincular(page, 'Contato NA', 'Degrau 1, coluna 1, vazia', 'entrada')
    // Bobina na coluna 8 (terminal), vinculada a "saida".
    await inserirEVincular(page, 'Bobina', 'Degrau 1, coluna 8, vazia', 'saida')

    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    // "Problemas (N)" com N = 0 — diagrama igual à fixture, sem erro.
    await page.getByRole('tab', { name: /^Problemas/ }).click()
    await expect(page.getByRole('tab', { name: 'Problemas (0)' })).toHaveAttribute('aria-selected', 'true')

    await page.screenshot({ path: 'test-results/ca8-01-montado-sem-problemas.png', fullPage: true })

    // localStorage já guarda o envelope {versao:1, diagrama} antes mesmo do reload.
    const brutoAntes = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_DIAGRAMA)
    expect(brutoAntes).not.toBeNull()
    const envelopeAntes = JSON.parse(brutoAntes as string)
    expect(envelopeAntes.versao).toBe(1)
    expect(envelopeAntes.diagrama.rungs[0].elementos).toHaveLength(2)

    // Recarrega: os mesmos elementos, nas mesmas células (pelo aria-label).
    await page.reload()

    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    const brutoDepois = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_DIAGRAMA)
    const envelopeDepois = JSON.parse(brutoDepois as string)
    expect(envelopeDepois.versao).toBe(1)
    expect(envelopeDepois.diagrama).toEqual(envelopeAntes.diagrama)

    // Troca para a aba ST: a caixa de texto com o programa blink continua intacta
    // (a IDE convive com os dois modos — Q-2 da spec — e não mexe no texto ST).
    await page.getByRole('tab', { name: 'ST', exact: true }).click()
    const textoST = await page.locator('#editor-st').inputValue()
    expect(textoST).toContain('PROGRAM')
    expect(textoST.length).toBeGreaterThan(100)

    await page.screenshot({ path: 'test-results/ca8-02-depois-do-reload-aba-st.png', fullPage: true })
  })
})

test.describe('CA-8 — localStorage corrompido é descartado, sem quebrar a IDE', () => {
  test('diagrama corrompido volta a um degrau vazio, com aviso no console', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    // Grava um valor deliberadamente inválido antes de recarregar
    // (persistencia.ts: carregarDiagrama nunca lança — descarta com aviso).
    await page.evaluate((chave) => window.localStorage.setItem(chave, '{corrompido'), CHAVE_DIAGRAMA)

    await page.reload()

    // Abre com um degrau vazio, não com uma tela quebrada.
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeVisible()

    // O console (aba padrão do painel inferior) mostra o aviso de descarte.
    await page.getByRole('tab', { name: 'Console', exact: true }).click()
    await expect(page.getByRole('log')).toContainText(/diagrama salvo descartado/i)

    await page.screenshot({ path: 'test-results/ca8-03-descarte-localstorage-corrompido.png', fullPage: true })
  })
})
