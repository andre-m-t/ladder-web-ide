import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const HEALTH_OK = {
  status: 'ok',
  iec2c: { available: true, path: '/usr/local/bin/iec2c', version: null },
  esp_idf: { available: true, path: '/opt/esp-idf/idf.py', version: null },
}

function urlDaRequisicao(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (urlDaRequisicao(input).endsWith('/health')) {
          return Promise.resolve(respostaJson(HEALTH_OK))
        }
        return Promise.reject(new Error(`URL inesperada no teste: ${urlDaRequisicao(input)}`))
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('desabilita o botão Gravar e mostra o aviso quando o navegador não tem Web Serial', async () => {
    render(<App />)

    const botaoGravar = await screen.findByRole('button', { name: /gravar/i })
    expect(botaoGravar).toBeDisabled()
    expect(screen.getByText(/não tem suporte à Web Serial/i)).toBeInTheDocument()
  })

  it('mostra o painel de erro com os diagnósticos quando a compilação falha, e mantém Gravar indisponível', async () => {
    const envelope = {
      stage: 'matiec',
      code: 'compile_error',
      message: 'ST inválido',
      diagnostics: [{ file: 'plc.st', line: 12, column: 5, severity: 'error', message: 'token inesperado' }],
      raw: { stdout: '', stderr: 'erro bruto do iec2c' },
    }

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      if (url.endsWith('/compile/pacote')) return Promise.resolve(respostaJson(envelope, 422))
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const usuario = userEvent.setup()
    render(<App />)

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))

    expect(await screen.findByText(/token inesperado/i)).toBeInTheDocument()
    expect(screen.getByText(/12:5/)).toBeInTheDocument()
    expect(screen.getByText(/matiec/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gravar/i })).toBeDisabled()
  })

  it('mostra o editor Ladder acima do fluxo de ST, na mesma tela (tarefa #8)', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /^Editor Ladder$/ })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Degrau 1, coluna 1/ })).toBeInTheDocument()
  })
})
