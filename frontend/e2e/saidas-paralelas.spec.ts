/**
 * Monta um degrau com contato NA, ramo de saída na coluna terminal e duas bobinas
 * (série + paralelo) e confere o .st baixado contra o dourado saidas_paralelas.st.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Locator, type Page } from '@playwright/test'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ST_DOURADO = readFileSync(
  join(AQUI, '..', '..', 'backend', 'tests', 'fixtures', 'serializados', 'saidas_paralelas.st'),
  'utf-8',
)

async function arrastar(page: Page, origem: Locator, alvo: Locator): Promise<void> {
  const caixaOrigem = await origem.boundingBox()
  const caixaAlvo = await alvo.boundingBox()
  if (!caixaOrigem || !caixaAlvo) throw new Error('bounding box ausente')
  const x0 = caixaOrigem.x + caixaOrigem.width / 2
  const y0 = caixaOrigem.y + caixaOrigem.height / 2
  const x1 = caixaAlvo.x + caixaAlvo.width / 2
  const y1 = caixaAlvo.y + caixaAlvo.height / 2
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12)
  }
  await page.mouse.up()
}

async function declararVariavel(page: Page, nome: string, classe: 'Entrada' | 'Saída', endereco: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Nome da nova variável' }).fill(nome)
  await page.getByRole('radio', { name: classe, exact: true }).click()
  await page.getByRole('combobox', { name: 'Pino da nova variável' }).selectOption(endereco)
  await page.getByRole('button', { name: 'Adicionar' }).click()
}

async function inserirEVincular(page: Page, rotuloItem: string, rotuloCelulaVazia: string, nomeVariavel: string): Promise<void> {
  await arrastar(page, page.getByRole('button', { name: rotuloItem, exact: true }), page.getByRole('button', { name: rotuloCelulaVazia }))
  const prefixo = rotuloCelulaVazia.replace(/, vazia$/, '')
  const celula = page.getByRole('button', { name: new RegExp(`^${prefixo}, `) })
  await celula.click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('combobox').selectOption(nomeVariavel)
  await dialogo.getByRole('button', { name: 'Fechar' }).click()
}

test('duas bobinas no mesmo degrau geram o ST dourado saidas_paralelas', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  await declararVariavel(page, 'entrada', 'Entrada', '%IX0.0')
  await declararVariavel(page, 'saida_a', 'Saída', '%QX0.0')
  await declararVariavel(page, 'saida_b', 'Saída', '%QX0.1')

  await inserirEVincular(page, 'Contato NA', 'Degrau 1, coluna 1, vazia', 'entrada')
  await inserirEVincular(page, 'Bobina', 'Degrau 1, coluna 8, vazia', 'saida_a')
  await arrastar(page, page.getByRole('button', { name: 'Ramo', exact: true }), page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida_a' }))
  await inserirEVincular(page, 'Bobina', 'Degrau 1, ramo 1, coluna 8, vazia', 'saida_b')

  await expect(page.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida_a' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 8, bobina saida_b' })).toBeVisible()

  await page.getByRole('button', { name: 'Baixar projeto' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Structured Text (.st)' }).click(),
  ])
  const caminho = await download.path()
  if (caminho === null) throw new Error('download falhou')
  expect(readFileSync(caminho, 'utf-8')).toBe(ST_DOURADO)
})
