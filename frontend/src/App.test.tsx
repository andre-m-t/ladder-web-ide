import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { IO_ESPELHO } from './ladder/fixtures'
import { COLUNA_TERMINAL, type Diagrama } from './ladder/modelo'
import { CHAVE_DIAGRAMA } from './ladder/persistencia'

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const HEALTH_OK = {
  status: 'ok',
  iec2c: { available: true, path: '/usr/local/bin/iec2c', version: 'v1.0.0' },
  esp_idf: { available: true, path: '/opt/esp-idf/idf.py', version: 'v5.1.2' },
}

/** Diagrama com um contato sem bobina — `rung_incompleto` (erro), tarefa #13
 * e #25. Reaproveitado pelo teste de contagem de problemas e pelo teste da
 * aba inicial do painel inferior. */
const DIAGRAMA_COM_ERRO: Diagrama = {
  versao: 1,
  variaveis: [{ nome: 'entrada', tipo: 'BOOL' }],
  rungs: [
    {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' }],
      ramos: [],
    },
  ],
}

/** Diagrama só com `set_reset_autodependente` (aviso, Q-6/D-10) — SET de `x`
 * num degrau com um contato de `x`, e RESET de `x` em outro, também com
 * contato de `x`. Sem erros: variáveis declaradas, cada degrau termina numa
 * bobina, nenhuma posição inválida (tarefa #25). */
const DIAGRAMA_SO_COM_AVISO: Diagrama = {
  versao: 1,
  variaveis: [{ nome: 'x', tipo: 'BOOL' }],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'x' },
        { id: 'e2', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [],
    },
    {
      id: 'r2',
      elementos: [
        { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'x' },
        { id: 'e4', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [],
    },
  ],
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

  it('registra a carga inicial e uma linha por ferramenta (MATIEC, toolchain ESP32) a partir de /health, com versão', async () => {
    render(<App />)

    const log = screen.getByRole('log')
    expect(within(log).getByText(/LadderFlow iniciado/)).toBeInTheDocument()

    await within(log).findByText(/MATIEC/)
    const linhasMatiec = within(log).getAllByText(/MATIEC \(iec2c\)/)
    expect(linhasMatiec).toHaveLength(1)
    expect(linhasMatiec[0]).toHaveTextContent(/disponível — v1\.0\.0/)

    const linhasToolchain = within(log).getAllByText(/Toolchain ESP32/)
    expect(linhasToolchain).toHaveLength(1)
    expect(linhasToolchain[0]).toHaveTextContent(/disponível — v5\.1\.2/)
  })

  it('quando /health falha, registra exatamente uma linha de erro no console', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (urlDaRequisicao(input).endsWith('/health')) {
          return Promise.reject(new Error('falha de rede'))
        }
        return Promise.reject(new Error(`URL inesperada no teste: ${urlDaRequisicao(input)}`))
      }),
    )

    render(<App />)

    const log = screen.getByRole('log')
    const linhas = await within(log).findAllByText(/Servidor de compilação indisponível/)
    expect(linhas).toHaveLength(1)
    expect(within(log).queryByText(/MATIEC/)).not.toBeInTheDocument()
    expect(within(log).queryByText(/Toolchain ESP32/)).not.toBeInTheDocument()
  })

  it('CA-1 ponta a ponta: variáveis pelo painel, elementos pela grade, vínculo pelo modal (segundo clique)', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // painel de variáveis (aberto por padrão): declara entrada %IX0.1 (classe Entrada é o padrão) e saída %QX0.1
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.selectOptions(screen.getByLabelText('Pino da nova variável'), '%IX0.1')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'saida')
    await usuario.click(screen.getByRole('radio', { name: 'Saída' }))
    await usuario.selectOptions(screen.getByLabelText('Pino da nova variável'), '%QX0.1')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    // arrasta o NA para a coluna 1: soltar marca, não abre o modal (D-13)
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // a IDE integra a lista de problemas ao vivo (tarefa #13): um elemento
    // sem variável já tem `variavel_nao_atribuida` (erro), então o rótulo
    // acessível da célula ganha o motivo como sufixo — daí o match parcial.
    const celulaNA = screen.getByRole('button', { name: /^Degrau 1, coluna 1, contato NA sem variável/ })
    await usuario.click(celulaNA)
    const dialogoNA = screen.getByRole('dialog')
    await usuario.click(within(dialogoNA).getByRole('button', { name: /^entrada/i }))

    // arrasta a bobina para a coluna 8
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))
    const celulaBobina = screen.getByRole('button', { name: /^Degrau 1, coluna 8, bobina sem variável/ })
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

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))

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

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))

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

  // -- Persistência (tarefa #12, CA-8) ------------------------------------

  it('CA-8: um diagrama salvo em localStorage é carregado na montagem', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 1, diagrama: IO_ESPELHO }))

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeInTheDocument()
  })

  it('CA-8: uma mudança do diagrama grava no localStorage', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('radio', { name: 'Memória' }))
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => {
      const bruto = window.localStorage.getItem(CHAVE_DIAGRAMA)
      expect(bruto).not.toBeNull()
      const envelope = JSON.parse(bruto as string) as { versao: number; diagrama: Diagrama }
      expect(envelope.versao).toBe(1)
      expect(envelope.diagrama.variaveis.some((v) => v.nome === 'contador')).toBe(true)
    })
  })

  it('CA-8: JSON corrompido no localStorage gera um aviso no console e abre com editor vazio', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, '{ isso não é json')

    render(<App />)

    const log = screen.getByRole('log')
    expect(await within(log).findByText(/diagrama salvo descartado/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  // -- Problemas (tarefa #13) ----------------------------------------------

  it('a contagem "Problemas (N)" reflete validarDiagrama (contato sem bobina)', async () => {
    const usuario = userEvent.setup()
    window.localStorage.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 1, diagrama: DIAGRAMA_COM_ERRO }))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const abaProblemas = screen.getByRole('tab', { name: /problemas \(\d+\)/i })
    expect(abaProblemas).toHaveTextContent(/Problemas \([1-9]\d*\)/)

    await usuario.click(abaProblemas)
    // A grade também marca a célula com problema (tarefa #13, frente D) — a
    // mesma mensagem pode aparecer ali também; escopada em `ListaProblemas`
    // (seu grupo de erros é o `role="alert"`) para não colidir com isso.
    const grupoErros = screen.getByRole('alert')
    expect(grupoErros).toBeInTheDocument()
    expect(within(grupoErros).getByText(/sem nenhuma bobina/)).toBeInTheDocument()
  })

  // -- Aba inicial do painel inferior (tarefa #25) -------------------------

  it('IDE limpa (localStorage vazio) abre com a aba Console selecionada e "Problemas (0)"', async () => {
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // Diagrama vazio (sem elementos, sem ramos) não gera problema algum —
    // regra da frente N (validação): um degrau em branco não é "incompleto".
    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Problemas (0)' })).toHaveAttribute('aria-selected', 'false')
  })

  it('diagrama salvo com erro (um contato sem bobina) abre com a aba Problemas selecionada', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 1, diagrama: DIAGRAMA_COM_ERRO }))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByRole('tab', { name: /problemas \(\d+\)/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'false')
  })

  it('diagrama salvo só com aviso (SET/RESET autodependente) abre no Console', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 1, diagrama: DIAGRAMA_SO_COM_AVISO }))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /problemas \(\d+\)/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('CA-8 (JSON corrompido): diagrama descartado com aviso abre no Console, não em Problemas', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, '{ isso não é json')

    render(<App />)
    await screen.findByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
  })

  // -- Recusas do editor na BarraStatus (tarefa #25) -----------------------

  it('uma recusa vinda do editor (remover o único degrau) aparece na barra de status e no Console', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // único degrau do diagrama: `removerDegrau` recusa ("precisa de pelo
    // menos um degrau") — gesto realista pela UI, sem chamar o núcleo direto.
    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    const barra = screen.getByRole('status')
    expect(within(barra).getByText(/pelo menos um degrau/i)).toBeInTheDocument()

    const log = screen.getByRole('log')
    expect(within(log).getByText(/pelo menos um degrau/i)).toBeInTheDocument()
  })
})
