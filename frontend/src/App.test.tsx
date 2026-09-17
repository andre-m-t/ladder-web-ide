import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { IO_ESPELHO } from './ladder/fixtures'
import { COLUNA_TERMINAL, type Diagrama } from './ladder/modelo'
import { CHAVE_DIAGRAMA } from './ladder/persistencia'
import { CHAVE_PROJETO, ESQUELETO_ST, type Projeto } from './projeto/projeto'

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
 * bobina, nenhuma posição inválida (herdado da tarefa #25). */
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

  it('mostra a IDE com o projeto Ladder "Sem título" por padrão, paleta e console visíveis', async () => {
    render(<App />)

    expect(screen.getByTitle('Sem título')).toBeInTheDocument()
    expect(screen.getByText('ld')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /lógica/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /^contato na$/i })).toBeInTheDocument()
    expect(await screen.findByLabelText(/Degrau 1, coluna 1/)).toBeInTheDocument()
    expect(screen.getByRole('log', { name: 'Console' })).toBeInTheDocument()
  })

  it('desabilita o botão Gravar e mostra o aviso quando o navegador não tem Web Serial', async () => {
    render(<App />)

    const botaoGravar = await screen.findByRole('button', { name: /gravar no esp32/i })
    expect(botaoGravar).toBeDisabled()
    expect(screen.getByText(/não tem suporte à Web Serial/i)).toBeInTheDocument()
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

  it('em projeto LD, Compilar e Gravar ficam desabilitados com o motivo', async () => {
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    const botaoCompilar = screen.getByRole('button', { name: /^compilar$/i })
    const botaoGravar = screen.getByRole('button', { name: /gravar no esp32/i })
    expect(botaoCompilar).toBeDisabled()
    expect(botaoGravar).toBeDisabled()
    expect(botaoCompilar.getAttribute('title')).toMatch(/convertido em ST/i)
    expect(botaoGravar.getAttribute('title')).toMatch(/convertido em ST/i)
  })

  it('criar projeto ST remove a aba Variáveis, mostra o editor com o esqueleto e habilita Compilar', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario, 'Programa 1')

    expect(screen.getByTitle('Programa 1')).toBeInTheDocument()
    expect(screen.getByText('st')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /variáveis/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/structured text/i)).toHaveValue(ESQUELETO_ST)
    expect(screen.getByRole('button', { name: /^compilar$/i })).not.toBeDisabled()
  })

  // -- Persistência (herdado da tarefa #12/#25, revisado na #26) -----------

  it('migração: só ladderflow:diagrama salvo abre em projeto Ladder "Sem título" com aquele diagrama', async () => {
    window.localStorage.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 1, diagrama: IO_ESPELHO }))

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

    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
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

  // -- Aba Variáveis (herdado das tarefas #22/#23, revisado na #26) --------

  it('aba Variáveis mostra a tabela de variáveis', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
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

  it('um problema clicado troca a sub-aba de volta para Lógica', async () => {
    const usuario = userEvent.setup()
    window.localStorage.setItem(CHAVE_PROJETO, JSON.stringify(projetoLD(DIAGRAMA_COM_ERRO)))

    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // o diagrama já veio do armazenamento com erro: a aba Problemas já nasce
    // selecionada (regra herdada da tarefa #25) — troca para Variáveis antes,
    // para provar que o clique no problema é quem volta para Lógica.
    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
    expect(screen.getByRole('tab', { name: /lógica/i })).toHaveAttribute('aria-selected', 'false')

    await usuario.click(screen.getByRole('tab', { name: /^problemas \d+/i }))
    await usuario.click(screen.getByRole('button', { name: /sem nenhuma bobina/i }))

    expect(screen.getByRole('tab', { name: /lógica/i })).toHaveAttribute('aria-selected', 'true')
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

    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
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

    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
    await usuario.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
    expect(screen.getByText('entrada')).toBeInTheDocument()
  })

  it('criar um projeto novo registra a criação no Console', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await criarProjetoST(usuario, 'Programa 2')

    const log = screen.getByRole('log', { name: 'Console' })
    expect(within(log).getByText(/Projeto «Programa 2» \(ST\) criado\./)).toBeInTheDocument()
  })

  // -- Mensagens (recusas do editor, tarefa #26) ----------------------------

  it('uma recusa (Remover degrau 1 com um degrau só) aparece na aba Mensagens com contador, que zera ao abrir a aba', async () => {
    const usuario = userEvent.setup()
    render(<App />)
    await screen.findByLabelText(/Degrau 1, coluna 1/)

    // único degrau do diagrama: `removerDegrau` recusa ("precisa de pelo
    // menos um degrau") — gesto realista pela UI, sem chamar o núcleo direto.
    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    const abaMensagens = screen.getByRole('tab', { name: /mensagens/i })
    expect(abaMensagens).toHaveTextContent('Mensagens 1')

    await usuario.click(abaMensagens)
    const log = screen.getByRole('log', { name: 'Mensagens' })
    expect(within(log).getByText(/pelo menos um degrau/i)).toBeInTheDocument()
    expect(abaMensagens).not.toHaveTextContent('Mensagens 1')
  })
})
