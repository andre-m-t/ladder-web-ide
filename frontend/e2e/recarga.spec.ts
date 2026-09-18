/**
 * Teste ponta a ponta (spec 002, tarefa #26, frente E) contra `vite preview`
 * (subido por `rodar.sh`), sem back-end no ar de propósito: `/health` falha e
 * isso é esperado — a persistência do projeto não depende do servidor (§6 da
 * Constituição). Fora do pacote de depósito do INPI (scripts/build-deposito.sh
 * só empacota `frontend/src`).
 *
 * A partir da tarefa #26 a IDE trabalha com um **projeto** de linguagem única
 * (`ladderflow:projeto`, envelope `{ versao, titulo, linguagem, diagrama|fonte }`
 * — `frontend/src/projeto/projeto.ts`), não mais duas abas Ladder/ST lado a
 * lado. O painel de variáveis é lateral, ao lado do editor Ladder (voltou a
 * ser assim na revisão da própria tarefa #26 — a versão em aba de largura
 * inteira foi testada e descartada pelo autor). Este arquivo cobre:
 *
 *   1. CA-8 (RF-13), projeto Ladder: monta o cenário "espelho direto"
 *      (IO_ESPELHO, §2 da spec) só pela UI — declara as variáveis no painel
 *      lateral e arrasta contato NA e bobina no editor ao lado, com arrasto
 *      real de mouse (o app usa Pointer Events próprios e chama
 *      `preventDefault` no `pointerdown`, então precisa ser um arrasto de
 *      verdade, com passos intermediários, não um clique/drop sintético) —
 *      confirma "Problemas 0", recarrega e checa que o mesmo diagrama
 *      continua nas mesmas células, com o envelope `{ versao: 1, linguagem:
 *      'ld', diagrama }` em `localStorage['ladderflow:projeto']`.
 *   2. "Novo projeto", em seguida, a partir desse projeto com conteúdo:
 *      confirma o descarte, cria um projeto "Semáforo" em Texto Estruturado
 *      e confirma que o cabeçalho muda (título + chip "st"), o painel de
 *      variáveis desaparece (só existe em projeto Ladder), o editor de
 *      texto mostra o esqueleto ST e que o projeto novo também sobrevive a
 *      um `page.reload()`.
 *   3. `localStorage['ladderflow:projeto']` corrompido: a IDE descarta e abre
 *      um projeto Ladder vazio "Sem título", com o aviso de descarte na aba
 *      Console (não mais na barra de status, que saiu na tarefa #26).
 *   4. Migração: só a chave antiga `ladderflow:diagrama` (formato de antes da
 *      tarefa #26, um diagrama solto) presente vira, ao carregar, um projeto
 *      Ladder "Sem título" com aquele diagrama, e a chave antiga é removida.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

const CHAVE_PROJETO = 'ladderflow:projeto'
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

/** Declara uma variável localizada pelo formulário do painel lateral
 * (`TabelaVariaveis.tsx`, linha "Adicionar variável"): nome, classe
 * (radiogroup Entrada/Saída/Memória) e, quando há pino, o endereço exato pelo
 * `<select>` — o primeiro endereço livre da classe nem sempre é o que o
 * teste precisa (`%IX0.1`/`%QX0.1`, não `%IX0.0`/`%QX0.0`). */
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

test.describe('Projeto Ladder — CA-8 (RF-13): monta o espelho pela UI, sobrevive à recarga, depois "Novo projeto" troca para ST', () => {
  test('IO_ESPELHO construído via painel de variáveis + arrasto real persiste; "Novo projeto" cria um projeto ST que também persiste', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()

    // Projeto Ladder "Sem título" por padrão — só projeto Ladder mostra o
    // painel de variáveis (BarraSuperior.tsx/PainelLateral.tsx).
    await expect(page.getByText('Sem título', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Alternar painel de variáveis' })).toBeVisible()

    // Painel de variáveis, já visível ao lado do editor: entrada em %IX0.1,
    // saída em %QX0.1 — os mesmos endereços da fixture IO_ESPELHO
    // (frontend/src/ladder/fixtures.ts).
    await declararVariavelLocalizada(page, 'entrada', 'Entrada', '%IX0.1')
    await declararVariavelLocalizada(page, 'saida', 'Saída', '%QX0.1')

    // Editor Ladder, ao lado do painel: contato NA na coluna 1, vinculado a
    // "entrada"; bobina na coluna 8 (terminal), vinculada a "saida". Soltar
    // a bobina em qualquer célula a leva à coluna 8 (celulaDeSoltura, tarefa
    // #25) — aqui ela já é soltada diretamente na terminal.
    await inserirEVincular(page, 'Contato NA', 'Degrau 1, coluna 1, vazia', 'entrada')
    await inserirEVincular(page, 'Bobina', 'Degrau 1, coluna 8, vazia', 'saida')

    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    // "Problemas 0" (PainelInferiorConteudo.tsx: "Problemas " + contagem,
    // sem parênteses) — diagrama igual à fixture, sem erro.
    await page.getByRole('tab', { name: /^Problemas/ }).click()
    await expect(page.getByRole('tab', { name: 'Problemas 0' })).toHaveAttribute('aria-selected', 'true')

    await page.screenshot({ path: 'test-results/ca8-01-ld-montado-sem-problemas.png', fullPage: true })

    // localStorage já guarda o envelope do projeto antes mesmo do reload.
    const brutoAntes = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_PROJETO)
    expect(brutoAntes).not.toBeNull()
    const projetoAntes = JSON.parse(brutoAntes as string)
    expect(projetoAntes.versao).toBe(1)
    expect(projetoAntes.linguagem).toBe('ld')
    expect(projetoAntes.diagrama.rungs[0].elementos).toHaveLength(2)

    // Recarrega: os mesmos elementos, nas mesmas células (pelo aria-label).
    await page.reload()

    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    const brutoDepois = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_PROJETO)
    const projetoDepois = JSON.parse(brutoDepois as string)
    expect(projetoDepois).toEqual(projetoAntes)

    await page.screenshot({ path: 'test-results/ca8-02-ld-apos-reload.png', fullPage: true })

    // --- "Novo projeto" a partir de um projeto com conteúdo (tarefa #26) ---

    await page.getByRole('button', { name: 'Novo projeto' }).click()

    const dialogoDescarte = page.getByRole('dialog', { name: 'Descartar projeto atual?' })
    await expect(dialogoDescarte).toBeVisible()
    await dialogoDescarte.getByRole('button', { name: 'Descartar e continuar' }).click()
    await expect(dialogoDescarte).toHaveCount(0)

    const dialogoNovo = page.getByRole('dialog', { name: 'Novo projeto' })
    await expect(dialogoNovo).toBeVisible()
    await dialogoNovo.getByRole('textbox', { name: 'Título do projeto' }).fill('Semáforo')
    await dialogoNovo.getByRole('radio', { name: 'Texto Estruturado (ST)' }).click()
    await dialogoNovo.getByRole('button', { name: 'Criar projeto' }).click()
    await expect(dialogoNovo).toHaveCount(0)

    // Cabeçalho: título "Semáforo" e chip "st" (BarraSuperior.tsx — o texto
    // salvo é minúsculo, "uppercase" é só estilo visual via CSS).
    await expect(page.getByText('Semáforo', { exact: true })).toBeVisible()
    await expect(page.locator('header').getByText('st', { exact: true })).toBeVisible()

    // O painel de variáveis desaparece — só existe em projeto Ladder.
    await expect(page.getByRole('button', { name: 'Alternar painel de variáveis' })).toHaveCount(0)

    // Editor de texto com o esqueleto ST (projeto/projeto.ts, ESQUELETO_ST).
    const textoStCriado = await page.locator('#editor-st').inputValue()
    expect(textoStCriado).toContain('PROGRAM prog0')
    expect(textoStCriado.length).toBeGreaterThan(100)

    await page.screenshot({ path: 'test-results/ca8-03-projeto-st-criado.png', fullPage: true })

    // O projeto ST também sobrevive à recarga.
    await page.reload()

    await expect(page.getByText('Semáforo', { exact: true })).toBeVisible()
    await expect(page.locator('header').getByText('st', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Alternar painel de variáveis' })).toHaveCount(0)

    const textoStDepois = await page.locator('#editor-st').inputValue()
    expect(textoStDepois).toBe(textoStCriado)

    const projetoStSalvo = JSON.parse(
      (await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_PROJETO)) as string,
    )
    expect(projetoStSalvo.versao).toBe(1)
    expect(projetoStSalvo.linguagem).toBe('st')
    expect(projetoStSalvo.titulo).toBe('Semáforo')

    await page.screenshot({ path: 'test-results/ca8-04-projeto-st-apos-reload.png', fullPage: true })
  })
})

test.describe('Projeto salvo corrompido é descartado, sem quebrar a IDE', () => {
  test('ladderflow:projeto corrompido volta a um projeto Ladder vazio, com aviso na aba Console', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    // Grava um valor deliberadamente inválido antes de recarregar
    // (projeto/projeto.ts: carregarProjeto nunca lança — descarta com aviso).
    await page.evaluate((chave) => window.localStorage.setItem(chave, '{corrompido'), CHAVE_PROJETO)

    await page.reload()

    // Abre em um projeto Ladder "Sem título" vazio, não com uma tela quebrada.
    await expect(page.getByText('Sem título', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeVisible()

    // O console (aba padrão do painel inferior quando o projeto não veio do
    // armazenamento) mostra o aviso de descarte.
    await page.getByRole('tab', { name: 'Console', exact: true }).click()
    await expect(page.getByRole('log')).toContainText(/projeto salvo descartado/i)

    await page.screenshot({ path: 'test-results/ca8-05-projeto-corrompido-descartado.png', fullPage: true })
  })
})

test.describe('Migração de ladderflow:diagrama (formato anterior à tarefa #26) para ladderflow:projeto', () => {
  test('só a chave antiga presente migra para um projeto Ladder "Sem título", e a chave antiga é removida', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    // Diagrama simples, no formato de frontend/src/ladder/modelo.ts (mesma
    // forma da fixture IO_ESPELHO): contato NA em "entrada" (%IX0.1) na
    // coluna 1, bobina em "saida" (%QX0.1) na coluna terminal (índice 7 = coluna 8).
    const diagramaAntigo = {
      versao: 1,
      variaveis: [
        { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.1' },
        { nome: 'saida', tipo: 'BOOL', endereco: '%QX0.1' },
      ],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
            { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: 'saida' },
          ],
          ramos: [],
        },
      ],
    }

    await page.evaluate(
      ({ chave, diagrama }) => window.localStorage.setItem(chave, JSON.stringify({ versao: 1, diagrama })),
      { chave: CHAVE_DIAGRAMA, diagrama: diagramaAntigo },
    )

    await page.reload()

    // Projeto Ladder "Sem título" com o diagrama migrado, pela UI.
    await expect(page.getByText('Sem título', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeVisible()

    await page.screenshot({ path: 'test-results/ca8-06-migracao-diagrama-antigo.png', fullPage: true })

    // A chave antiga foi removida...
    const chaveAntigaDepois = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_DIAGRAMA)
    expect(chaveAntigaDepois).toBeNull()

    // ...e a nova guarda o envelope do projeto migrado, com o mesmo diagrama.
    const bruto = await page.evaluate((chave) => window.localStorage.getItem(chave), CHAVE_PROJETO)
    const projeto = JSON.parse(bruto as string)
    expect(projeto.versao).toBe(1)
    expect(projeto.linguagem).toBe('ld')
    expect(projeto.titulo).toBe('Sem título')
    expect(projeto.diagrama).toEqual(diagramaAntigo)
  })
})
