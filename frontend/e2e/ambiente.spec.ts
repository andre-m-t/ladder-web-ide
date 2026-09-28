/**
 * Ambiente de simulação — portão (spec 005, CA-1/CA-2/CA-3).
 */
import { expect, test } from '@playwright/test'

import { PORTAO } from '../src/ladder/fixtures'

const CHAVE_PROJETO = 'ladderflow:projeto'

test('ambiente: modal, janela, simulação e fechar pelo x', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    ([chave, diagrama]) => {
      localStorage.setItem(
        chave,
        JSON.stringify({
          versao: 2,
          titulo: 'Portão e2e',
          linguagem: 'ld',
          diagrama,
        }),
      )
    },
    [CHAVE_PROJETO, PORTAO] as const,
  )
  await page.reload()

  await page.getByRole('button', { name: /abrir ambiente de simulação/i }).click()
  const modalAmbiente = page.getByRole('dialog', { name: /^ambiente de simulação$/i })
  await expect(modalAmbiente).toBeVisible()
  await modalAmbiente.getByRole('button', { name: /abrir ambiente/i }).click()

  await expect(page.getByRole('complementary', { name: /painel de ambiente/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /ambiente — portão/i })).toBeVisible()
  await expect(page.getByText(/entre em simulação/i)).toBeVisible()

  const textoAbertura = page.getByText(/abertura:/i)
  const valorInicial = await textoAbertura.textContent()

  await page.getByRole('button', { name: /^abrir$/i }).click({ force: true })
  await expect(textoAbertura).toHaveText(valorInicial ?? '')

  await page.getByRole('button', { name: /^simular$/i }).click()
  await page.getByRole('button', { name: /^abrir$/i }).dispatchEvent('pointerdown')
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /avançar um ciclo/i }).click()
  }
  await page.getByRole('button', { name: /^abrir$/i }).dispatchEvent('pointerup')

  const depois = await textoAbertura.textContent()
  expect(depois).not.toBe(valorInicial)

  const painel = page.getByRole('complementary', { name: /painel de ambiente/i })
  await painel.getByRole('button', { name: /^fechar ambiente$/i }).click()
  await expect(painel).not.toBeVisible()
})

test('ambiente: criar variáveis pelo contrato de E/S (revisão 2026-09-23)', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((chave) => localStorage.removeItem(chave), CHAVE_PROJETO)
  await page.reload()

  await page.getByRole('button', { name: /abrir ambiente de simulação/i }).click()
  await page.getByRole('dialog', { name: /^ambiente de simulação$/i }).getByRole('button', { name: /abrir ambiente/i }).click()
  const painel = page.getByRole('complementary', { name: /painel de ambiente/i })
  await expect(painel.getByText(/0 de 10 conectados/)).toBeVisible()

  await painel.getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' }).click()
  const criacao = page.getByRole('dialog', { name: 'Nova variável' })
  await expect(criacao.getByLabel('Nome')).toHaveValue('abrir')
  await criacao.getByRole('button', { name: 'Criar variável' }).click()
  await expect(criacao).not.toBeVisible()
  await expect(painel.getByText(/1 de 10 conectados/)).toBeVisible()

  await painel.getByRole('button', { name: /criar todas/i }).click()
  await expect(painel.getByText(/10 de 10 conectados/)).toBeVisible()
  await expect(painel.getByText('motor_sobe', { exact: true })).toBeVisible()

  const projeto = await page.evaluate((chave) => JSON.parse(localStorage.getItem(chave) ?? 'null'), CHAVE_PROJETO)
  expect(projeto.diagrama.variaveis).toEqual(PORTAO.variaveis)
})
