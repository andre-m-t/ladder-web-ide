import { fireEvent, render, screen, within } from '@testing-library/react'
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

/** Simula um arrasto completo por Pointer Events (mesmos helpers de
 * `EditorLadder.test.tsx`, tarefa #22/#23): pointerdown na origem,
 * pointermove além do limiar (em `window`, onde o editor escuta),
 * pointerenter no alvo e pointerup em `window`. */
function arrastar(origem: Element, alvo: Element) {
  fireEvent.pointerDown(origem, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
  fireEvent.pointerEnter(alvo, { pointerId: 1, clientX: 30, clientY: 30 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 30, clientY: 30 })
}

describe('App', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear()
    } catch {
      // ambiente sem localStorage — sem efeito nos testes, a IDE usa os padrões.
    }

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

  it('mostra a IDE com a aba Ladder ativa por padrão, paleta e console visíveis', async () => {
    render(<App />)

    expect(screen.getByRole('tab', { name: 'Ladder' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /^contato na$/i })).toBeInTheDocument()
    expect(await screen.findByLabelText(/Degrau 1, coluna 1/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Console' })).toBeInTheDocument()
    expect(screen.getByRole('log')).toBeInTheDocument()
  })

  it('desabilita o botão Gravar e mostra o aviso quando o navegador não tem Web Serial', async () => {
    render(<App />)

    const botaoGravar = await screen.findByRole('button', { name: /gravar no esp32/i })
    expect(botaoGravar).toBeDisabled()
    expect(screen.getByText(/não tem suporte à Web Serial/i)).toBeInTheDocument()
  })

  it('registra a carga inicial e o resultado de /health no console', async () => {
    render(<App />)

    const log = screen.getByRole('log')
    expect(within(log).getByText(/LadderFlow iniciado/)).toBeInTheDocument()
    expect(await within(log).findByText(/Servidor de compilação disponível/)).toBeInTheDocument()
  })

  it('CA-1 ponta a ponta: variáveis pelo painel, elementos pela grade, vínculo pelo modal (segundo clique)', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // painel de variáveis (aberto por padrão): declara entrada %IX0.1 e saída %QX0.1
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.selectOptions(screen.getByLabelText('Endereço da nova variável'), '%IX0.1')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'saida')
    await usuario.selectOptions(screen.getByLabelText('Endereço da nova variável'), '%QX0.1')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    // arrasta o NA para a coluna 1: soltar marca, não abre o modal (D-13)
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const celulaNA = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    await usuario.click(celulaNA)
    const dialogoNA = screen.getByRole('dialog')
    await usuario.click(within(dialogoNA).getByRole('button', { name: /^entrada/i }))

    // arrasta a bobina para a coluna 8
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))
    const celulaBobina = screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })
    await usuario.click(celulaBobina)
    const dialogoBobina = screen.getByRole('dialog')
    await usuario.click(within(dialogoBobina).getByRole('button', { name: /^saida/i }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeInTheDocument()
  })

  it('compilar com sucesso registra início e sucesso (com as imagens) no console', async () => {
    const pacote = {
      chip: 'esp32',
      flash: { mode: 'dio', freq: '40m', size: '4MB' },
      images: [{ name: 'bootloader.bin', offset: 4096, size: 2048, sha256: 'x', data_base64: '' }],
    }
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      if (url.endsWith('/compile/pacote')) return Promise.resolve(respostaJson(pacote))
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const usuario = userEvent.setup()
    render(<App />)

    await usuario.click(screen.getByRole('button', { name: /^compilar st$/i }))

    const log = screen.getByRole('log')
    expect(within(log).getByText(/Compilação iniciada/)).toBeInTheDocument()
    expect(await within(log).findByText(/Compilação concluída/)).toBeInTheDocument()
    expect(within(log).getByText(/bootloader\.bin: offset 0x1000, 2\.0 KB/)).toBeInTheDocument()
  })

  it('erro de compilação com diagnóstico aparece no console e no PainelErro da aba ST', async () => {
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

    await usuario.click(screen.getByRole('button', { name: /^compilar st$/i }))

    const log = screen.getByRole('log')
    expect(await within(log).findByText(/12:5 — token inesperado/)).toBeInTheDocument()
    expect(within(log).getByText(/matiec/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).toBeDisabled()

    // o diagnóstico também aparece no PainelErro, dentro da aba ST — escopado
    // por role="alert" porque o mesmo texto já está no console (log, acima).
    await usuario.click(screen.getByRole('tab', { name: 'ST' }))
    const painelErro = screen.getByRole('alert')
    expect(within(painelErro).getByText(/token inesperado/i)).toBeInTheDocument()
    expect(within(painelErro).getByText(/12:5/)).toBeInTheDocument()
  })

  it('alternar para a aba ST mostra o editor de texto, sem perder o diagrama Ladder', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('tab', { name: 'ST' }))
    expect(screen.getByLabelText(/structured text/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Ladder' }))
    expect(screen.getByLabelText(/Degrau 1, coluna 1/)).toBeInTheDocument()
  })
})
