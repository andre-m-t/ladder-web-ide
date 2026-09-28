import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { IO_ESPELHO, SET_RESET } from './ladder/fixtures'
import { COLUNA_TERMINAL, type Diagrama } from './ladder/modelo'
import { CHAVE_DIAGRAMA } from './ladder/persistencia'
import { serializar } from './ladder/serializador'
import { baixarPacoteFirmware, baixarTexto, conteudoProjetoJson } from './lib/download'
import { CHAVE_PROJETO, ESQUELETO_ST, type Projeto } from './projeto/projeto'

// `baixarTexto` toca o DOM (Blob/URL.createObjectURL) — mockado para os
// testes do menu Baixar (spec 003, D-12/tarefa #11) verificarem só o que
// `App` decide baixar, sem exercer o download real (já coberto por
// `lib/download.test.ts`). `nomeDeArquivo`/`conteudoProjetoJson` continuam
// reais (`importActual`), para os testes comporem o valor esperado do mesmo
// jeito que o `App` faz.
vi.mock('./lib/download', async (importActual) => {
  const real = await importActual<typeof import('./lib/download')>()
  return { ...real, baixarTexto: vi.fn(), baixarPacoteFirmware: vi.fn() }
})
const baixarTextoMock = vi.mocked(baixarTexto)
const baixarPacoteFirmwareMock = vi.mocked(baixarPacoteFirmware)

const { gravarMock } = vi.hoisted(() => ({
  gravarMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./lib/gravador', async (importActual) => {
  const real = await importActual<typeof import('./lib/gravador')>()
  return {
    ...real,
    gravar: gravarMock,
    webSerialDisponivel: () => true,
  }
})

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

/** Diagrama com um contato sem bobina — `rung_incompleto` (erro), herdado da
 * tarefa #13/#25. Reaproveitado pelo teste de contagem de problemas, pelo
 * teste da aba inicial do painel inferior e pelo teste de clique num problema. */
const DIAGRAMA_COM_ERRO: Diagrama = {
  versao: 2,
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
 * bobina, nenhuma posição inválida (herdado da tarefa #25). */
const DIAGRAMA_SO_COM_AVISO: Diagrama = {
  versao: 2,
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

function projetoLD(diagrama: Diagrama, titulo = 'Sem título'): Projeto {
  return { versao: 1, titulo, linguagem: 'ld', diagrama }
}

function urlDaRequisicao(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

/** Fluxo completo de "Novo projeto" → projeto ST, pela UI (sem tocar o
 * núcleo direto): abre o modal, digita o título por cima do pré-preenchido,
 * escolhe "Texto Estruturado (ST)" e confirma. Assume projeto atual vazio
 * (senão o modal de descarte aparece antes) — testes que chamam isto a partir
 * de um projeto com conteúdo devem confirmar o descarte primeiro. */
async function criarProjetoST(usuario: UserEvent, titulo = 'Programa ST') {
  await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
  const campoTitulo = await screen.findByLabelText('Título do projeto')
  await usuario.clear(campoTitulo)
  await usuario.type(campoTitulo, titulo)
  await usuario.click(screen.getByRole('radio', { name: /texto estruturado/i }))
  await usuario.click(screen.getByRole('button', { name: 'Criar projeto' }))
}

describe('App', () => {
  beforeEach(() => {
    baixarTextoMock.mockClear()
    baixarPacoteFirmwareMock.mockClear()
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
    vi.restoreAllMocks()
  })

  it('mostra a IDE com o projeto Ladder "Sem título" por padrão, paleta e console visíveis', async () => {
    render(<App />)

    expect(screen.getByTitle('Sem título')).toBeInTheDocument()
    expect(screen.getByText('ld')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^contato na$/i })).toBeInTheDocument()
    expect(await screen.findByLabelText(/Degrau 1, coluna 1/)).toBeInTheDocument()
    expect(screen.getByRole('log', { name: 'Console' })).toBeInTheDocument()
  })

  it('desabilita o botão Gravar e mostra o aviso quando o navegador não tem Web Serial', async () => {
    const gravador = await import('./lib/gravador')
    vi.spyOn(gravador, 'webSerialDisponivel').mockReturnValue(false)

    render(<App />)

    const botaoGravar = await screen.findByRole('button', { name: /gravar no esp32/i })
    expect(botaoGravar).toBeDisabled()
    expect(await screen.findByText(/Web Serial API/i)).toBeInTheDocument()
  })

  it('registra a carga inicial e uma linha por ferramenta (MATIEC, toolchain ESP32) a partir de /health, com versão', async () => {
    render(<App />)

    const log = screen.getByRole('log', { name: 'Console' })
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

    const log = screen.getByRole('log', { name: 'Console' })
    const linhas = await within(log).findAllByText(/Servidor de compilação indisponível/)
    expect(linhas).toHaveLength(1)
    expect(within(log).queryByText(/MATIEC/)).not.toBeInTheDocument()
    expect(within(log).queryByText(/Toolchain ESP32/)).not.toBeInTheDocument()
  })

  it('alternar o tema chama aplicarTema e atualiza o rótulo do botão', async () => {
    const usuario = userEvent.setup()
    render(<App />)

    const botao = screen.getByRole('button', { name: /usar tema claro/i })
    await usuario.click(botao)
    expect(screen.getByRole('button', { name: /usar tema escuro/i })).toBeInTheDocument()
  })

  // -- Compilação/gravação (só existem em projeto ST) ----------------------

  function stubSerialComPorta(porta: { getInfo: () => { usbVendorId: number; usbProductId: number } }) {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      serial: {
        getPorts: () => Promise.resolve([porta]),
        requestPort: () => Promise.resolve(porta),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
  }

  const PACOTE_MINIMO = {
    chip: 'esp32',
    flash: { mode: 'dio', freq: '40m', size: '4MB' },
    images: [{ name: 'bootloader.bin', offset: 4096, size: 2048, sha256: 'x', data_base64: '' }],
  }

  it('Gravar abre o modal de porta; cancelar não chama gravar', async () => {
    stubSerialComPorta({ getInfo: () => ({ usbVendorId: 0x10c4, usbProductId: 1 }) })
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      if (url.endsWith('/compile/pacote')) return Promise.resolve(respostaJson(PACOTE_MINIMO))
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario)
    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))
    await within(screen.getByRole('log', { name: 'Console' })).findByText(/Compilação concluída/)

    gravarMock.mockClear()
    await usuario.click(screen.getByRole('button', { name: /gravar no esp32/i }))
    expect(screen.getByRole('dialog', { name: 'Porta serial do ESP32' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(gravarMock).not.toHaveBeenCalled()
    expect(within(screen.getByRole('log', { name: 'Console' })).getByText(/Gravação cancelada/)).toBeInTheDocument()
  })

  it('confirmar porta no modal chama gravar com opcoes.porta', async () => {
    const porta = { getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }) }
    stubSerialComPorta(porta)
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      if (url.endsWith('/compile/pacote')) return Promise.resolve(respostaJson(PACOTE_MINIMO))
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario)
    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))
    await within(screen.getByRole('log', { name: 'Console' })).findByText(/Compilação concluída/)

    gravarMock.mockClear()
    await usuario.click(screen.getByRole('button', { name: /gravar no esp32/i }))
    await screen.findByText(/Espressif/)
    await usuario.click(screen.getByRole('button', { name: 'Gravar' }))

    await waitFor(() => {
      expect(gravarMock).toHaveBeenCalledTimes(1)
    })
    expect(gravarMock.mock.calls[0][1]).toMatchObject({ porta })
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
    await criarProjetoST(usuario)

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))

    const log = screen.getByRole('log', { name: 'Console' })
    expect(within(log).getByText(/Compilação iniciada/)).toBeInTheDocument()
    expect(await within(log).findByText(/Compilação concluída/)).toBeInTheDocument()
    expect(within(log).getByText(/bootloader\.bin: offset 0x1000, 2\.0 KB/)).toBeInTheDocument()
  })

  it('erro de compilação com diagnóstico aparece no console e no painel de erro', async () => {
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
    await criarProjetoST(usuario)

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))

    const log = screen.getByRole('log', { name: 'Console' })
    expect(await within(log).findByText(/12:5 — token inesperado/)).toBeInTheDocument()
    expect(within(log).getByText(/matiec/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).toBeDisabled()

    const painelErro = screen.getByRole('alert')
    expect(within(painelErro).getByText(/token inesperado/i)).toBeInTheDocument()
    expect(within(painelErro).getByText(/12:5/)).toBeInTheDocument()
  })

  it('em projeto LD com diagrama vazio, Compilar e Gravar ficam desabilitados com "Nada a compilar" (D-6/D-7, CA-8)', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const botaoCompilar = screen.getByRole('button', { name: /^compilar$/i })
    const botaoGravar = screen.getByRole('button', { name: /gravar no esp32/i })
    expect(botaoCompilar).toBeDisabled()
    expect(botaoGravar).toBeDisabled()
    expect(botaoCompilar.getAttribute('title')).toMatch(/nada a compilar/i)
    expect(botaoGravar.getAttribute('title')).toMatch(/nada a compilar/i)

    // O menu Baixar também mostra o motivo na opção .st (CA-8, D-12 na
    // revisão da Q-1): mesmo portão de D-6.
    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    const itemSt = screen.getByRole('menuitem', { name: /structured text/i })
    expect(itemSt).toHaveAttribute('aria-disabled', 'true')
    expect(itemSt.getAttribute('title')).toMatch(/nada a compilar/i)
  })

  // -- Compilação em projeto Ladder (spec 003, tarefa #8) -------------------

  it('CA-5: projeto LD com IO_ESPELHO habilita Compilar; ao clicar, compilarPacote recebe serializar(IO_ESPELHO).st', async () => {
    const pacote = {
      chip: 'esp32',
      flash: { mode: 'dio', freq: '40m', size: '4MB' },
      images: [{ name: 'bootloader.bin', offset: 4096, size: 2048, sha256: 'x', data_base64: '' }],
    }
    let corpoRecebido: unknown
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      if (url.endsWith('/compile/pacote')) {
        corpoRecebido = init?.body === undefined ? undefined : JSON.parse(init.body as string)
        return Promise.resolve(respostaJson(pacote))
      }
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))

    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const botaoCompilar = screen.getByRole('button', { name: /^compilar$/i })
    expect(botaoCompilar).not.toBeDisabled()

    await usuario.click(botaoCompilar)

    const log = screen.getByRole('log', { name: 'Console' })
    expect(await within(log).findByText(/Compilação concluída/)).toBeInTheDocument()

    const esperado = serializar(IO_ESPELHO)
    if (!esperado.ok) throw new Error('IO_ESPELHO deveria serializar com sucesso')
    expect((corpoRecebido as { source: string }).source).toBe(esperado.st)
  })

  it('CA-7: diagrama com erro desabilita Compilar com motivo mencionando "problema", sem chamar compilarPacote', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_COM_ERRO)))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const botaoCompilar = screen.getByRole('button', { name: /^compilar$/i })
    expect(botaoCompilar).toBeDisabled()
    expect(botaoCompilar.getAttribute('title')).toMatch(/problema/i)

    expect(fetchMock.mock.calls.some((chamada) => urlDaRequisicao(chamada[0]).endsWith('/compile/pacote'))).toBe(false)
  })

  it('CA-7: diagrama só com aviso (SET/RESET autodependente) mantém Compilar habilitado', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_SO_COM_AVISO)))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByRole('button', { name: /^compilar$/i })).not.toBeDisabled()
  })

  // -- Menu Baixar (spec 003, D-12, revisão da Q-1; tarefa #11) -------------

  it('Q-1 revista: em diagrama com erro, a opção .st do menu Baixar fica desabilitada com o motivo', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_COM_ERRO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    const itemSt = screen.getByRole('menuitem', { name: /structured text/i })
    expect(itemSt).toHaveAttribute('aria-disabled', 'true')
    expect(itemSt.getAttribute('title')).toMatch(/problema/i)
  })

  it('Q-1 revista: escolher "Structured Text (.st)" chama baixarTexto com serializar(IO_ESPELHO).st e o nome do título', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO, 'Esteira 1')))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    await usuario.click(screen.getByRole('menuitem', { name: /structured text/i }))

    const esperado = serializar(IO_ESPELHO)
    if (!esperado.ok) throw new Error('IO_ESPELHO deveria serializar com sucesso')
    expect(baixarTextoMock).toHaveBeenCalledWith('esteira-1.st', esperado.st, 'text/plain;charset=utf-8')
  })

  it('Q-1 revista: escolher "Ladder (.json)" chama baixarTexto com conteudoProjetoJson(projeto) e o nome do título', async () => {
    const projeto = projetoLD(IO_ESPELHO, 'Esteira 1')
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projeto))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    await usuario.click(screen.getByRole('menuitem', { name: /ladder \(\.json\)/i }))

    expect(baixarTextoMock).toHaveBeenCalledWith(
      'esteira-1.ladderflow.json',
      conteudoProjetoJson(projeto),
      'application/json',
    )
  })

  it('Q-1 revista: em projeto ST, o menu Baixar tem .st e firmware; .st baixa projeto.fonte', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario, 'Programa ST')

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
    const itemSt = within(menu).getByRole('menuitem', { name: /structured text/i })

    await usuario.click(itemSt)

    expect(baixarTextoMock).toHaveBeenCalledWith('programa-st.st', ESQUELETO_ST, 'text/plain;charset=utf-8')
  })

  it('firmware: sem compilação prévia, compila e chama baixarPacoteFirmware', async () => {
    const pacote = {
      chip: 'esp32',
      flash: { mode: 'dio', freq: '40m', size: '4MB' },
      images: [{ name: 'bootloader', offset: 4096, size: 3, sha256: 'x', data_base64: btoa('BOT') }],
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
    await criarProjetoST(usuario, 'Blink')

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    await usuario.click(screen.getByRole('menuitem', { name: /firmware esp32/i }))

    const log = screen.getByRole('log', { name: 'Console' })
    expect(await within(log).findByText(/será compilada antes do download/i)).toBeInTheDocument()
    expect(await within(log).findByText(/Compilação concluída/)).toBeInTheDocument()
    expect(baixarPacoteFirmwareMock).toHaveBeenCalledWith(pacote, 'Blink')
  })

  it('firmware: após compilar, baixa sem nova requisição de compilação', async () => {
    const pacote = {
      chip: 'esp32',
      flash: { mode: 'dio', freq: '40m', size: '4MB' },
      images: [{ name: 'app', offset: 65536, size: 3, sha256: 'x', data_base64: btoa('APP') }],
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
    await criarProjetoST(usuario, 'Blink')

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))
    await within(screen.getByRole('log', { name: 'Console' })).findByText(/Compilação concluída/)

    const chamadasPacoteAntes = fetchMock.mock.calls.filter((chamada) =>
      urlDaRequisicao(chamada[0]).endsWith('/compile/pacote'),
    ).length

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    await usuario.click(screen.getByRole('menuitem', { name: /firmware esp32/i }))

    const chamadasPacoteDepois = fetchMock.mock.calls.filter((chamada) =>
      urlDaRequisicao(chamada[0]).endsWith('/compile/pacote'),
    ).length
    expect(chamadasPacoteDepois).toBe(chamadasPacoteAntes)
    expect(baixarPacoteFirmwareMock).toHaveBeenCalledWith(pacote, 'Blink')
  })

  it('Q-3: diagnóstico do compilador na linha do degrau 2 aparece como problema desse degrau, e clicar nele foca o degrau', async () => {
    const resultado = serializar(SET_RESET)
    if (!resultado.ok) throw new Error('SET_RESET deveria serializar com sucesso')
    const trechoDegrau2 = resultado.mapaLinhas[1]

    const envelope = {
      stage: 'matiec',
      code: 'compile_error',
      message: 'ST inválido',
      diagnostics: [
        { file: 'plc.st', line: trechoDegrau2.linhaInicio, column: 1, severity: 'error', message: 'erro fabricado no degrau 2' },
      ],
      raw: { stdout: '', stderr: '' },
    }

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlDaRequisicao(input)
      if (url.endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
      if (url.endsWith('/compile/pacote')) return Promise.resolve(respostaJson(envelope, 422))
      return Promise.reject(new Error(`URL inesperada no teste: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(SET_RESET)))

    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: /^compilar$/i }))

    // A aba Problemas abre por conta própria (o problema aponta para um degrau real).
    const painelProblemas = await screen.findByRole('tabpanel', { name: /^problemas/i })
    const problema = within(painelProblemas).getByRole('button', { name: /degrau 2/i })
    expect(problema).toBeInTheDocument()

    await usuario.click(problema)

    await waitFor(() => {
      expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Degrau 2, coluna 1/)
    })
  })

  it('criar projeto ST remove o painel de variáveis, mostra o editor com o esqueleto e habilita Compilar', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario, 'Programa 1')

    expect(screen.getByTitle('Programa 1')).toBeInTheDocument()
    expect(screen.getByText('st')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /alternar painel de variáveis/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Variáveis declaradas' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/structured text/i)).toHaveValue(ESQUELETO_ST)
    expect(screen.getByRole('button', { name: /^compilar$/i })).not.toBeDisabled()
  })

  // -- Persistência (herdado da tarefa #12/#25, revisado na #26) -----------

  it('migração: só ladderflow:diagrama salvo abre em projeto Ladder "Sem título" com aquele diagrama', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 2, diagrama: IO_ESPELHO }))

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeInTheDocument()
    expect(screen.getByTitle('Sem título')).toBeInTheDocument()
    expect(screen.getByText('ld')).toBeInTheDocument()
  })

  it('um projeto salvo em localStorage é reaberto', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO, 'Esteira 1')))

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeInTheDocument()
    expect(screen.getByTitle('Esteira 1')).toBeInTheDocument()
  })

  it('projeto corrompido no localStorage abre vazio com aviso no Console', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, '{ isso não é json')

    render(<App />)

    const log = screen.getByRole('log', { name: 'Console' })
    expect(await within(log).findByText(/projeto salvo descartado/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('diagrama antigo corrompido (chave anterior à tarefa #26) também abre vazio com aviso', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, '{ isso não é json')

    render(<App />)

    const log = screen.getByRole('log', { name: 'Console' })
    expect(await within(log).findByText(/diagrama salvo descartado/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('uma mudança do projeto (declarar variável) grava no localStorage', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('radio', { name: 'Memória' }))
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => {
      const bruto = window.localStorage.getItem(CHAVE_PROJETO)
      expect(bruto).not.toBeNull()
      const salvo = JSON.parse(bruto as string) as Projeto
      expect(salvo.linguagem).toBe('ld')
      expect(salvo.linguagem === 'ld' && salvo.diagrama.variaveis.some((v) => v.nome === 'contador')).toBe(true)
    })
  })

  // -- Painel de variáveis (herdado das tarefas #22/#23, revisado na #26) --

  it('painel de variáveis mostra a tabela, visível por padrão ao lado do editor', async () => {
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByRole('table', { name: 'Variáveis declaradas' })).toBeInTheDocument()
  })

  it('alternar o painel de variáveis esconde e volta a mostrar a tabela', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const botao = screen.getByRole('button', { name: /alternar painel de variáveis/i })
    await usuario.click(botao)
    expect(screen.queryByRole('table', { name: 'Variáveis declaradas' })).not.toBeInTheDocument()

    await usuario.click(botao)
    expect(screen.getByRole('table', { name: 'Variáveis declaradas' })).toBeInTheDocument()
  })

  // -- Problemas (herdado da tarefa #13) ------------------------------------

  it('a contagem "Problemas N" reflete validarDiagrama (contato sem bobina)', async () => {
    const usuario = userEvent.setup()
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_COM_ERRO)))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const abaProblemas = screen.getByRole('tab', { name: /^problemas \d+/i })
    expect(abaProblemas).toHaveTextContent(/Problemas [1-9]\d*/)

    await usuario.click(abaProblemas)
    const grupoErros = screen.getByRole('alert')
    expect(grupoErros).toBeInTheDocument()
    expect(within(grupoErros).getByText(/sem nenhuma bobina/)).toBeInTheDocument()
  })

  // -- Aba inicial do painel inferior (herdado da tarefa #25) ---------------

  it('IDE limpa (localStorage vazio) abre com a aba Console selecionada e "Problemas 0"', async () => {
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // Diagrama vazio (sem elementos, sem ramos) não gera problema algum.
    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Problemas 0' })).toHaveAttribute('aria-selected', 'false')
  })

  it('projeto salvo com erro (um contato sem bobina) abre com a aba Problemas selecionada', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_COM_ERRO)))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByRole('tab', { name: /^problemas \d+/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'false')
  })

  it('projeto salvo só com aviso (SET/RESET autodependente) abre no Console', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_SO_COM_AVISO)))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^problemas \d+/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('projeto corrompido abre no Console, não em Problemas', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, '{ isso não é json')

    render(<App />)
    await screen.findByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
  })

  // -- Fluxo "Novo projeto" (tarefa #26) ------------------------------------

  it('"Novo projeto" com projeto vazio vai direto ao modal de título', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
    expect(screen.getByRole('dialog', { name: 'Novo projeto' })).toBeInTheDocument()
  })

  it('"Novo projeto" com conteúdo abre primeiro o modal de descarte, e confirmar leva ao de título', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
    expect(screen.getByRole('dialog', { name: /descartar projeto atual/i })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /descartar e continuar/i }))
    expect(screen.getByRole('dialog', { name: 'Novo projeto' })).toBeInTheDocument()
  })

  it('cancelar o modal de descarte não muda o projeto atual', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
    await usuario.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('entrada')).toBeInTheDocument()
  })

  it('criar um projeto novo registra a criação no Console', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario, 'Programa 2')

    const log = screen.getByRole('log', { name: 'Console' })
    expect(within(log).getByText(/Projeto «Programa 2» \(ST\) criado\./)).toBeInTheDocument()
  })

  // -- Toasts de recusa (spec 002, D-18, tarefa #27) ------------------------

  it('uma recusa (Remover degrau 1 com um degrau só) aparece como toast visível, e não vai ao Console', async () => {
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // único degrau do diagrama: `removerDegrau` recusa ("precisa de pelo
    // menos um degrau") — gesto realista pela UI, sem chamar o núcleo direto.
    // `fireEvent` (síncrono) em vez de `userEvent`: o teste seguinte precisa
    // de fake timers já ativos no momento do clique, e misturar os dois
    // exigiria configurar `userEvent` para avançá-los.
    fireEvent.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent(/pelo menos um degrau/i)

    const log = screen.getByRole('log', { name: 'Console' })
    expect(within(log).queryByText(/pelo menos um degrau/i)).not.toBeInTheDocument()
  })

  it('o toast de recusa some sozinho depois de 5 s', async () => {
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Remover degrau 1' }))
      expect(screen.getByRole('status')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('App — modo simulação (spec 004, tarefa #11)', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear()
    } catch {
      // ambiente sem localStorage — sem efeito nos testes.
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (urlDaRequisicao(input).endsWith('/health')) return Promise.resolve(respostaJson(HEALTH_OK))
        return Promise.reject(new Error(`URL inesperada no teste: ${urlDaRequisicao(input)}`))
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('CA-12: diagrama com erro de validação — "Simular" fica indisponível com o motivo visível e não entra em simulação', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_COM_ERRO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const botaoSimular = screen.getByRole('button', { name: 'Simular' })
    expect(botaoSimular).toBeDisabled()
    expect(botaoSimular.getAttribute('title')).toMatch(/problema/i)

    await usuario.click(botaoSimular)
    expect(screen.queryByRole('button', { name: 'Sair da simulação' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avançar um ciclo' })).toBeDisabled()
  })

  it('CA-7 (também via BarraSuperior): projeto ST — "Simular" some do lugar certo? Não: fica visível e desabilitado com o motivo, nunca escondido', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify({ versao: 1, titulo: 'Programa', linguagem: 'st', fonte: ESQUELETO_ST }))
    render(<App />)
    await screen.findByLabelText(/structured text/i)

    const botaoSimular = screen.getByRole('button', { name: 'Simular' })
    expect(botaoSimular).toBeDisabled()
    expect(botaoSimular.getAttribute('title')).toMatch(/ladder/i)
  })

  it('CA-6: entra em simulação, Passo avança exatamente um ciclo por clique, Reiniciar zera', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    expect(screen.getByRole('button', { name: 'Sair da simulação' })).toBeInTheDocument()

    // Pausa logo ao entrar: o relógio (RAF) roda por padrão (RF-11) e
    // avançaria ciclos sozinho durante o teste — Passo precisa ser
    // determinístico, isolado do laço de tempo real.
    await usuario.click(screen.getByRole('button', { name: 'Pausar simulação' }))

    expect(screen.getByText('Ciclo 0')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Avançar um ciclo' }))
    expect(screen.getByText('Ciclo 1')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Avançar um ciclo' }))
    expect(screen.getByText('Ciclo 2')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Reiniciar simulação' }))
    expect(screen.getByText('Ciclo 0')).toBeInTheDocument()
  })

  it('Passo em rajada avança um ciclo por clique — sem perder ciclo para a corrida com o laço (correção de 2026-09-22)', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    await usuario.click(screen.getByRole('button', { name: 'Pausar simulação' }))
    expect(screen.getByText('Ciclo 0')).toBeInTheDocument()

    const passo = screen.getByRole('button', { name: 'Avançar um ciclo' })
    act(() => {
      fireEvent.click(passo)
      fireEvent.click(passo)
      fireEvent.click(passo)
    })

    expect(screen.getByText('Ciclo 3')).toBeInTheDocument()
  })

  it('CA-8: simulação ativa congela a edição (Inserir degrau desabilitado) e deixa Compilar/Gravar indisponíveis com o motivo; sair devolve os três', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    await usuario.click(screen.getByRole('button', { name: 'Pausar simulação' }))

    const botaoCompilar = screen.getByRole('button', { name: /^compilar$/i })
    const botaoGravar = screen.getByRole('button', { name: /gravar no esp32/i })
    const botaoInserirDegrau = screen.getByRole('button', { name: 'Inserir degrau' })

    expect(botaoCompilar).toBeDisabled()
    expect(botaoCompilar.getAttribute('title')).toMatch(/simulação/i)
    expect(botaoGravar).toBeDisabled()
    expect(botaoInserirDegrau).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'Sair da simulação' }))

    expect(screen.getByRole('button', { name: /^compilar$/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Inserir degrau' })).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Sair da simulação' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular' })).toBeInTheDocument()
  })

  it('CA-9: valores ao vivo no painel — entrada é acionável (switch), saída não (só selo)', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    await usuario.click(screen.getByRole('button', { name: 'Pausar simulação' }))

    // `entrada`/`saida` são os nomes das variáveis de `IO_ESPELHO`.
    const switchEntrada = screen.getByRole('switch', { name: /acionar entrada/i })
    expect(switchEntrada).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('switch', { name: /acionar saida/i })).not.toBeInTheDocument()

    await usuario.click(switchEntrada)
    // O acionamento só vale a partir do ciclo seguinte (RF-1/RF-12, D-2): o
    // selo mostra a imagem de processo do último ciclo, não o pedido
    // pendente — continua "false" até um ciclo rodar.
    expect(switchEntrada).toHaveAttribute('aria-checked', 'false')

    await usuario.click(screen.getByRole('button', { name: 'Avançar um ciclo' }))
    expect(screen.getByText('Ciclo 1')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /acionar entrada/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('CA-13: recarregar a página (montar App de novo) volta ao modo edição, com o diagrama preservado — nada de simulação sobrevive', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO, 'Esteira 1')))
    const usuario = userEvent.setup()
    const primeiraMontagem = render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    await usuario.click(screen.getByRole('button', { name: 'Pausar simulação' }))
    await usuario.click(screen.getByRole('button', { name: 'Avançar um ciclo' }))
    expect(screen.getByText('Ciclo 1')).toBeInTheDocument()

    // "Recarregar a página": desmonta e monta uma instância nova de `App` —
    // o estado de simulação nunca foi para `localStorage` (RF-17), só o
    // `projeto` foi salvo pelo efeito de persistência de sempre.
    primeiraMontagem.unmount()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    expect(screen.getByTitle('Esteira 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair da simulação' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Ciclo /)).not.toBeInTheDocument()
  })

  it('o relógio da simulação (RAF, D-8) avança ciclos sozinho em Executar, e para em Pausar — sob controle de fake timers, sem depender de tempo real de parede', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    vi.useFakeTimers()
    try {
      // `userEvent` sem `advanceTimers` configurado não mistura bem com fake
      // timers já ativos — usa `fireEvent` (síncrono) daqui em diante, como o
      // teste do toast de recusa já faz.
      fireEvent.click(screen.getByRole('button', { name: 'Simular' }))
      expect(screen.getByText('Ciclo 0')).toBeInTheDocument()

      // Executar é o padrão ao entrar — alguns quadros a 20 ms/ciclo (tempo
      // real, o padrão) já devem render pelo menos um ciclo.
      act(() => {
        for (let i = 0; i < 5; i++) vi.advanceTimersToNextFrame()
      })
      const cicloTexto = screen.getByText(/^Ciclo \d+$/).textContent ?? 'Ciclo 0'
      const cicloAposExecutar = Number(cicloTexto.replace('Ciclo ', ''))
      expect(cicloAposExecutar).toBeGreaterThan(0)

      fireEvent.click(screen.getByRole('button', { name: 'Pausar simulação' }))
      act(() => {
        for (let i = 0; i < 5; i++) vi.advanceTimersToNextFrame()
      })
      expect(screen.getByText(`Ciclo ${cicloAposExecutar}`)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marcha lenta é oferecida no seletor e pode ser escolhida durante a simulação', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    const seletorMarcha = screen.getByLabelText('Marcha da simulação')
    expect(within(seletorMarcha).getByText(/tempo real/i)).toBeInTheDocument()
    expect(within(seletorMarcha).getByText(/marcha lenta/i)).toBeInTheDocument()

    await usuario.selectOptions(seletorMarcha, 'lenta')
    expect(seletorMarcha).toHaveValue('lenta')
  })

  it('fechar o ambiente encerra a simulação ativa e restaura o painel de variáveis', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('button', { name: /abrir ambiente de simulação/i }))
    const modal = screen.getByRole('dialog', { name: /^ambiente de simulação$/i })
    await usuario.click(within(modal).getByRole('button', { name: /^abrir ambiente$/i }))
    expect(screen.getByRole('complementary', { name: /painel de ambiente/i })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    expect(screen.getByRole('button', { name: 'Sair da simulação' })).toBeInTheDocument()

    const painelAmbiente = screen.getByRole('complementary', { name: /painel de ambiente/i })
    await usuario.click(within(painelAmbiente).getByRole('button', { name: /fechar ambiente/i }))
    expect(screen.queryByRole('complementary', { name: /painel de ambiente/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /painel de variáveis/i })).toBeInTheDocument()
  })

  async function abrirAmbiente(usuario: UserEvent) {
    await usuario.click(screen.getByRole('button', { name: /abrir ambiente de simulação/i }))
    const modal = screen.getByRole('dialog', { name: /^ambiente de simulação$/i })
    await usuario.click(within(modal).getByRole('button', { name: /^abrir ambiente$/i }))
    return screen.getByRole('complementary', { name: /painel de ambiente/i })
  }

  it('cria a variável de um ponto pelo contrato do ambiente, com Desfazer (revisão 2026-09-23)', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const painel = await abrirAmbiente(usuario)
    await usuario.click(within(painel).getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nova variável' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar variável' }))

    expect(within(painel).queryByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' })).not.toBeInTheDocument()
    expect(within(painel).getByText('abrir')).toBeInTheDocument()
    const salvo = JSON.parse(window.localStorage.getItem(CHAVE_PROJETO) as string) as Projeto
    expect(salvo.linguagem === 'ld' && salvo.diagrama.variaveis).toContainEqual({ nome: 'abrir', tipo: 'BOOL', endereco: '%IX0.0' })

    await usuario.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(within(painel).getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' })).toBeInTheDocument()
  })

  it('"Criar todas" completa o contrato numa única entrada do histórico', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const painel = await abrirAmbiente(usuario)
    await usuario.click(within(painel).getByRole('button', { name: /criar todas/i }))
    expect(within(painel).queryByRole('button', { name: /^criar variável para/i })).not.toBeInTheDocument()
    expect(within(painel).getByText('motor_sobe')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(within(painel).getAllByRole('button', { name: /^criar variável para/i }).length).toBeGreaterThan(1)
  })

  it('com a simulação ativa, criar variável pelo contrato fica desabilitado', async () => {
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(IO_ESPELHO)))
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const painel = await abrirAmbiente(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Simular' }))
    expect(within(painel).getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' })).toBeDisabled()
    expect(within(painel).getByRole('button', { name: /criar todas/i })).toBeDisabled()
  })
})
