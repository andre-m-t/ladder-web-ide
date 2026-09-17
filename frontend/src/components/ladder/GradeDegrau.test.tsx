import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO } from '../../ladder/fixtures'
import type { Ramo } from '../../ladder/modelo'
import type { Problema } from '../../ladder/validacao'
import GradeDegrau, { type Previa, type PreviaAlca } from './GradeDegrau'

/** Props obrigatórias que a maioria dos testes não usa — mantém as chamadas
 * de `render` curtas. */
function propsBase() {
  return {
    variaveis: [],
    marcado: null,
    aoClicarCelula: vi.fn(),
    aoDuploClicarCelula: vi.fn(),
    aoTeclarNaCelula: vi.fn(),
    aoIniciarArrastoPonteiro: vi.fn(),
  }
}

describe('GradeDegrau', () => {
  it('renderiza as células do degrau com aria-label de conteúdo', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    // coluna 1 (1-based): contato NA "entrada"
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toBeInTheDocument()
    // coluna 8: bobina "saida" (terminal)
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeInTheDocument()
    // colunas intermediárias vazias
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 7, vazia' })).toBeInTheDocument()
  })

  it('rotula elemento sem variável vinculada', () => {
    const rung = {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'contato_nf' as const, celula: { linha: 0, coluna: 2 }, variavel: null }],
      ramos: [],
    }
    render(<GradeDegrau rung={rung} indice={1} {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Degrau 2, coluna 3, contato NF sem variável' })).toBeInTheDocument()
  })

  it('marca a célula com data-celula (rungId:linha:coluna), para foco programático', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toHaveAttribute(
      'data-celula',
      'r1:0:0',
    )
  })

  it('chama aoClicarCelula com a célula certa ao clicar', async () => {
    const usuario = userEvent.setup()
    const aoClicarCelula = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoClicarCelula={aoClicarCelula} />)

    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' }))

    expect(aoClicarCelula).toHaveBeenCalledTimes(1)
    expect(aoClicarCelula).toHaveBeenCalledWith('r1', { linha: 0, coluna: 1 })
  })

  it('chama aoDuploClicarCelula ao dar duplo clique', async () => {
    const usuario = userEvent.setup()
    const aoDuploClicarCelula = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoDuploClicarCelula={aoDuploClicarCelula} />)

    await usuario.dblClick(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' }))

    expect(aoDuploClicarCelula).toHaveBeenCalledWith('r1', { linha: 0, coluna: 0 })
  })

  it('encaminha o evento de tecla bruto para aoTeclarNaCelula', async () => {
    const usuario = userEvent.setup()
    const aoTeclarNaCelula = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoTeclarNaCelula={aoTeclarNaCelula} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })
    celula.focus()
    await usuario.keyboard(' ')

    expect(aoTeclarNaCelula).toHaveBeenCalledTimes(1)
    expect(aoTeclarNaCelula.mock.calls[0][1]).toBe('r1')
    expect(aoTeclarNaCelula.mock.calls[0][2]).toEqual({ linha: 0, coluna: 0 })
  })

  it('chama aoIniciarArrastoPonteiro no pointerdown de uma célula', () => {
    const aoIniciarArrastoPonteiro = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })
    fireEvent.pointerDown(celula, { pointerId: 1, clientX: 10, clientY: 10 })

    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledTimes(1)
    expect(aoIniciarArrastoPonteiro.mock.calls[0][1]).toBe('r1')
    expect(aoIniciarArrastoPonteiro.mock.calls[0][2]).toEqual({ linha: 0, coluna: 0 })
  })

  it('marca a célula do elemento marcado com aria-selected', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} marcado="e1" />)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })
})

describe('GradeDegrau — prévia (plano D-11/D-12)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('previa "inserir" marca a célula vazia com data-previa="inserir"', () => {
    const previa: Previa = { celula: { linha: 0, coluna: 1 }, tipo: 'inserir', elemento: 'contato_na' }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} previa={previa} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })).toHaveAttribute('data-previa', 'inserir')
  })

  it('previa "remover" marca o elemento existente com data-previa="remover"', () => {
    const previa: Previa = { celula: { linha: 0, coluna: 0 }, tipo: 'remover' }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} previa={previa} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toHaveAttribute(
      'data-previa',
      'remover',
    )
  })

  it('previa "invalida" marca a célula com data-previa="invalida", sem <title> nem texto do motivo (tarefa #25)', () => {
    const previa: Previa = {
      celula: { linha: 0, coluna: 1 },
      tipo: 'invalida',
      motivo: 'posição inválida para bobina (linha=0, coluna=1)',
    }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} previa={previa} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula).toHaveAttribute('data-previa', 'invalida')
    expect(celula.querySelector('title')).toBeNull()
    expect(screen.queryByText(previa.motivo as string)).not.toBeInTheDocument()
  })

  it('sem previa, nenhuma célula tem data-previa', () => {
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    for (const celula of screen.getAllByRole('button')) {
      expect(celula).not.toHaveAttribute('data-previa')
    }
  })
})

describe('GradeDegrau — recusa (plano D-11, sem texto desde a tarefa #25)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('recusa marca a célula com aria-invalid, sem aria-describedby, role="alert" nem o texto do motivo no DOM', () => {
    const recusa = { celula: { linha: 0, coluna: 1 }, motivo: 'célula (linha=0, coluna=1) já ocupada' }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} recusa={recusa} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(recusa.motivo)).not.toBeInTheDocument()

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula).toHaveAttribute('aria-invalid', 'true')
    expect(celula).not.toHaveAttribute('aria-describedby')
  })

  it('sem recusa, não há alerta', () => {
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('GradeDegrau — aoPassarCelula (ponteiro e foco)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('chama aoPassarCelula ao passar o ponteiro e limpa ao sair', async () => {
    const usuario = userEvent.setup()
    const aoPassarCelula = vi.fn()
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoPassarCelula={aoPassarCelula} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    await usuario.hover(celula)
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', { linha: 0, coluna: 1 })

    await usuario.unhover(celula)
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', null)
  })

  it('chama aoPassarCelula ao focar por teclado e limpa ao perder o foco', () => {
    const aoPassarCelula = vi.fn()
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoPassarCelula={aoPassarCelula} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    celula.focus()
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', { linha: 0, coluna: 1 })

    celula.blur()
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', null)
  })
})

describe('GradeDegrau — cabeçalho "Degrau NNN" (D-13)', () => {
  it('mostra o número do degrau com três dígitos', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    expect(screen.getByText('Degrau 001')).toBeInTheDocument()
  })

  it('preenche com zeros também a partir do décimo degrau', () => {
    const rung = { id: 'r1', elementos: [], ramos: [] }
    render(<GradeDegrau rung={rung} indice={9} {...propsBase()} />)

    expect(screen.getByText('Degrau 010')).toBeInTheDocument()
  })
})

describe('GradeDegrau — endereço e nome no símbolo (D-13)', () => {
  it('mostra o endereço da variável vinculada, quando ela tem um', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} variaveis={IO_ESPELHO.variaveis} />)

    expect(screen.getByText('%IX0.1')).toBeInTheDocument()
    expect(screen.getByText('%QX0.1')).toBeInTheDocument()
  })

  it('sem variáveis informadas, não mostra endereço nenhum', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} variaveis={[]} />)

    expect(screen.queryByText('%IX0.1')).not.toBeInTheDocument()
  })

  it('elemento sem variável mostra "?"', () => {
    const rung = {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: null }],
      ramos: [],
    }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })
})

describe('GradeDegrau — sem cores fixas (D-13)', () => {
  it('nenhuma classe de cor fixa (só tokens ide-*), em marcado/prévia/recusa', () => {
    const rung = IO_ESPELHO.rungs[0]
    const previa: Previa = { celula: { linha: 0, coluna: 1 }, tipo: 'invalida', motivo: 'posição inválida' }
    const recusa = { celula: { linha: 0, coluna: 2 }, motivo: 'célula ocupada' }
    const { container } = render(
      <GradeDegrau
        rung={rung}
        indice={0}
        {...propsBase()}
        variaveis={IO_ESPELHO.variaveis}
        marcado="e1"
        previa={previa}
        recusa={recusa}
      />,
    )

    expect(container.innerHTML).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})

/** `ResizeObserver` mínimo para os testes de largura responsiva (D-14):
 * guarda a instância mais recente para o teste disparar manualmente o
 * `callback`, como o navegador faria ao medir o wrapper de verdade. */
class ResizeObserverFalso {
  static instancias: ResizeObserverFalso[] = []
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverFalso.instancias.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  disparar(width: number) {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

describe('GradeDegrau — largura responsiva (D-14)', () => {
  afterEach(() => {
    delete (window as { ResizeObserver?: unknown }).ResizeObserver
    ResizeObserverFalso.instancias.length = 0
  })

  it('sem ResizeObserver no ambiente (jsdom padrão), usa a largura padrão fixa (célula de 64px)', () => {
    const rung = { id: 'r1', elementos: [], ramos: [] }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    expect(celula.querySelector('rect')).toHaveAttribute('width', '64')
  })

  it('larguraCelula muda com a largura medida pelo ResizeObserver (e respeita o mínimo de 56px)', () => {
    window.ResizeObserver = ResizeObserverFalso as unknown as typeof ResizeObserver

    const rung = { id: 'r1', elementos: [], ramos: [] }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    const instancia = ResizeObserverFalso.instancias[ResizeObserverFalso.instancias.length - 1]

    act(() => instancia.disparar(400))
    // (400 - 64) / 8 = 42 < 56 (mínimo) -> a célula fica no mínimo
    expect(celula.querySelector('rect')).toHaveAttribute('width', '56')

    act(() => instancia.disparar(960))
    // (960 - 64) / 8 = 112, acima do mínimo -> usa o valor calculado
    expect(celula.querySelector('rect')).toHaveAttribute('width', '112')
  })
})

describe('GradeDegrau — ramo paralelo, desenho (D-14)', () => {
  const ramo: Ramo = { id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }
  const rungComRamo = {
    id: 'r1',
    elementos: [{ id: 'e1', tipo: 'contato_na' as const, celula: { linha: 1, coluna: 0 }, variavel: 'x' }],
    ramos: [ramo],
  }

  it('cada coluna do intervalo do ramo é uma célula com rótulo "ramo L"', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 1, contato NA x' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 3, vazia' })).toBeInTheDocument()
    // fora do intervalo do ramo, na mesma linha: nenhuma célula
    expect(screen.queryByRole('button', { name: /ramo 1, coluna 4/i })).not.toBeInTheDocument()
  })

  it('desenha uma alça (role slider) na ponta direita do ramo, com aria-valuenow = colunaFim (1-based)', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} />)

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    expect(alca).toHaveAttribute('aria-valuenow', '3')
  })

  it('ramoMarcado destaca todas as células do ramo com aria-selected, mesmo vazias', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} ramoMarcado="b1" />)

    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 1, contato NA x' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('sem ramoMarcado, as células vazias do ramo não ficam marcadas', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' })).toHaveAttribute('aria-selected', 'false')
  })

  it('prévia de criação de ramo (ramo-criar) desenha um ramo fantasma com data-ramo-fantasma', () => {
    const rung = { id: 'r1', elementos: [], ramos: [] }
    const previa: Previa = { tipo: 'ramo-criar', ramo: { linha: 1, colunaInicio: 0, colunaFim: 0 } }
    const { container } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} previa={previa} />)

    expect(container.querySelector('[data-ramo-fantasma="1:0:0"]')).not.toBeNull()
  })

  it('sem prévia de ramo, nenhum ramo fantasma é desenhado', () => {
    const rung = { id: 'r1', elementos: [], ramos: [] }
    const { container } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    expect(container.querySelector('[data-ramo-fantasma]')).toBeNull()
  })

  it('altura do SVG cresce quando há ramo em linha mais alta', () => {
    const semRamo = { id: 'r1', elementos: [], ramos: [] }
    const { container: c1 } = render(<GradeDegrau rung={semRamo} indice={0} {...propsBase()} />)
    const alturaSemRamo = Number(c1.querySelector('svg')?.getAttribute('height'))

    const { container: c2 } = render(<GradeDegrau rung={rungComRamo} indice={1} {...propsBase()} />)
    const alturaComRamo = Number(c2.querySelector('svg')?.getAttribute('height'))

    expect(alturaComRamo).toBeGreaterThan(alturaSemRamo)
  })
})

describe('GradeDegrau — alça do ramo, geometria do arrasto por ponteiro (D-14)', () => {
  const rungComRamo = { id: 'r1', elementos: [], ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }] }

  it('pointermove sobre a alça reporta a coluna sob o ponteiro via aoArrastarAlca', () => {
    const aoArrastarAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoArrastarAlca={aoArrastarAlca} />)

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 9, clientX: 200, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 9, clientX: 200, clientY: 0 })

    // getBoundingClientRect do <svg> é (0,0,0,0) no jsdom; coluna = floor((200-32)/64) = 2
    expect(aoArrastarAlca).toHaveBeenCalledWith('r1', 'b1', 2)
  })

  it('pointerup sobre a alça reporta a coluna final via aoSoltarAlca', () => {
    const aoSoltarAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoSoltarAlca={aoSoltarAlca} />)

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 9, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 9, clientX: 300, clientY: 0 })

    // coluna = floor((300-32)/64) = 4
    expect(aoSoltarAlca).toHaveBeenCalledWith('r1', 'b1', 4)
  })

  it('pointercancel durante o arrasto da alça chama aoCancelarAlca', () => {
    const aoCancelarAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoCancelarAlca={aoCancelarAlca} />)

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 9, clientX: 200, clientY: 0 })
    fireEvent.pointerCancel(window, { pointerId: 9 })

    expect(aoCancelarAlca).toHaveBeenCalledTimes(1)
  })

  it('encaminha o evento de tecla bruto na alça para aoTeclarNaAlca', async () => {
    const usuario = userEvent.setup()
    const aoTeclarNaAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoTeclarNaAlca={aoTeclarNaAlca} />)

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    alca.focus()
    await usuario.keyboard(' ')

    expect(aoTeclarNaAlca).toHaveBeenCalledTimes(1)
    expect(aoTeclarNaAlca.mock.calls[0][1]).toBe('r1')
    expect(aoTeclarNaAlca.mock.calls[0][2]).toBe('b1')
  })

  it('previaAlca inválida colore a alça com o token de perigo (sem cor fixa)', () => {
    const previaAlca: PreviaAlca = { ramoId: 'b1', colunaFim: 5, valido: false }
    const { container } = render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} previaAlca={previaAlca} />)

    expect(container.innerHTML).toMatch(/stroke-ide-perigo/)
    expect(container.innerHTML).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})

describe('GradeDegrau — problemas na grade (tarefa #13, CA-4/CA-9)', () => {
  it('problema de erro na célula: aria-label "erro: <mensagem>" e um círculo (não triângulo) no canto', () => {
    const rung = {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'bobina' as const, celula: { linha: 0, coluna: 7 }, variavel: 'saida' }],
      ramos: [],
    }
    const problemas: Problema[] = [
      {
        codigo: 'bobina_duplicada',
        severidade: 'erro',
        rungId: 'r1',
        elementoId: 'e1',
        mensagem: "bobina 'e1' escreve em 'saida', já escrita por outra bobina",
      },
    ]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} problemas={problemas} />)

    const celula = screen.getByRole('button', { name: /erro: bobina 'e1' escreve em 'saida'/i })
    expect(celula).toHaveAttribute('data-problema', 'erro')
    expect(celula.querySelector('circle[class*="fill-ide-perigo"]')).not.toBeNull()
    expect(celula.querySelector('polygon[class*="fill-ide-aviso"]')).toBeNull()
  })

  it('problema de aviso na célula é visualmente distinto do erro: triângulo, aria-label "aviso: <mensagem>"', () => {
    const rung = {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'bobina_set' as const, celula: { linha: 0, coluna: 7 }, variavel: 'x' }],
      ramos: [],
    }
    const problemas: Problema[] = [
      {
        codigo: 'set_reset_autodependente',
        severidade: 'aviso',
        rungId: 'r1',
        elementoId: 'e1',
        mensagem: "bobina SET 'e1' depende da própria variável 'x'",
      },
    ]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} problemas={problemas} />)

    const celula = screen.getByRole('button', { name: /aviso: bobina SET 'e1' depende da própria variável 'x'/i })
    expect(celula).toHaveAttribute('data-problema', 'aviso')
    expect(celula.querySelector('polygon[class*="fill-ide-aviso"]')).not.toBeNull()
    expect(celula.querySelector('circle[class*="fill-ide-perigo"]')).toBeNull()
  })

  it('problema com elementoId null (ex.: rung_incompleto) marca a calha do degrau com um ícone, sem texto visível, mas com aria-label com a mensagem', () => {
    const rung = { id: 'r1', elementos: [], ramos: [] }
    const problemas: Problema[] = [
      {
        codigo: 'rung_incompleto',
        severidade: 'erro',
        rungId: 'r1',
        elementoId: null,
        mensagem: 'degrau 1 sem nenhuma bobina — todo degrau precisa terminar numa bobina',
      },
    ]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} problemas={problemas} />)

    expect(screen.getByRole('img', { name: /degrau 1 sem nenhuma bobina/i })).toBeInTheDocument()
    expect(screen.queryByText(/degrau 1 sem nenhuma bobina/i)).not.toBeInTheDocument()
  })

  it('problema de aviso com elementoId null é visualmente distinto do erro na calha (token de cor diferente)', () => {
    const rung = { id: 'r1', elementos: [], ramos: [] }
    const problemas: Problema[] = [
      { codigo: 'rung_incompleto', severidade: 'aviso', rungId: 'r1', elementoId: null, mensagem: 'aviso de exemplo no degrau' },
    ]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} problemas={problemas} />)

    const selo = screen.getByRole('img', { name: /aviso de exemplo no degrau/i })
    expect(selo).toHaveClass('text-ide-aviso')
    expect(selo).not.toHaveClass('text-ide-perigo')
    expect(screen.queryByText(/aviso de exemplo no degrau/i)).not.toBeInTheDocument()
  })

  it('não apaga a marcação de recusa nem a seleção já existentes na célula (precedência preservada)', () => {
    const rung = {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: null }],
      ramos: [],
    }
    const problemas: Problema[] = [
      { codigo: 'variavel_nao_atribuida', severidade: 'erro', rungId: 'r1', elementoId: 'e1', mensagem: 'sem variável vinculada' },
    ]
    render(
      <GradeDegrau
        rung={rung}
        indice={0}
        {...propsBase()}
        marcado="e1"
        recusa={{ celula: { linha: 0, coluna: 0 }, motivo: 'motivo qualquer de outra jogada' }}
        problemas={problemas}
      />,
    )

    const celula = screen.getByRole('button', { name: /erro: sem variável vinculada/i })
    expect(celula).toHaveAttribute('aria-selected', 'true')
    expect(celula).toHaveAttribute('aria-invalid', 'true')
    expect(celula).toHaveAttribute('data-problema', 'erro')
  })

  it('sem problemas, nenhuma célula ganha data-problema nem o cabeçalho ganha selo', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    expect(container.querySelector('[data-problema]')).toBeNull()
  })
})

describe('GradeDegrau — ações de degrau no cabeçalho (tarefa #10, CA-6)', () => {
  it('botão "Inserir degrau abaixo" tem aria-label com o número do degrau (1-based) e chama o callback', async () => {
    const usuario = userEvent.setup()
    const aoInserirDegrauAbaixo = vi.fn()
    const rung = { id: 'r1', elementos: [], ramos: [] }
    render(<GradeDegrau rung={rung} indice={2} {...propsBase()} aoInserirDegrauAbaixo={aoInserirDegrauAbaixo} />)

    await usuario.click(screen.getByRole('button', { name: 'Inserir degrau abaixo do degrau 3' }))

    expect(aoInserirDegrauAbaixo).toHaveBeenCalledTimes(1)
  })

  it('botão "Remover degrau" tem aria-label com o número do degrau (1-based) e chama o callback', async () => {
    const usuario = userEvent.setup()
    const aoRemoverDegrau = vi.fn()
    const rung = { id: 'r1', elementos: [], ramos: [] }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} aoRemoverDegrau={aoRemoverDegrau} />)

    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    expect(aoRemoverDegrau).toHaveBeenCalledTimes(1)
  })
})
