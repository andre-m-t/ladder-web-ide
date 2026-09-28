import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO, RAMO_OU } from '../../ladder/fixtures'
import type { Ramo } from '../../ladder/modelo'
import type { EnergizacaoDegrau } from '../../ladder/simulacao'
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

  it('desenha duas alças (início e fim) com aria-valuenow nas colunas do ramo (1-based)', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} />)

    expect(screen.getByRole('slider', { name: /início do ramo 1/i })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('slider', { name: /fim do ramo 1/i })).toHaveAttribute('aria-valuenow', '3')
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

describe('GradeDegrau — CTU (tarefa #18, D-19)', () => {
  const rungComCtu = {
    id: 'r1',
    elementos: [
      { id: 'e1', tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
      { id: 'e2', tipo: 'contato_na' as const, celula: { linha: 1, coluna: 0 }, variavel: 'reset_ctu' },
      {
        id: 'e3',
        tipo: 'ctu' as const,
        celula: { linha: 0, coluna: 7 },
        linhaControle: 1,
        instancia: 'ctu0',
        preset: 12,
        saida: 'atingiu',
      },
    ],
    ramos: [],
  }

  it('a célula terminal (linha 0, coluna 8) mostra a caixa do CTU: rótulo, instância, PV e saída', () => {
    render(<GradeDegrau rung={rungComCtu} indice={0} {...propsBase()} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 8, Contador crescente atingiu' })
    expect(celula.textContent).toContain('CTU')
    expect(celula.textContent).toContain('ctu0')
    expect(celula.textContent).toContain('PV=12')
    expect(celula.textContent).toContain('Q → atingiu')
  })

  it('a linha de reset tem células focáveis com o rótulo "reinício do contador", exceto na coluna terminal', () => {
    render(<GradeDegrau rung={rungComCtu} indice={0} {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, reinício do contador, coluna 1, contato NA reset_ctu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, reinício do contador, coluna 2, vazia' })).toBeInTheDocument()
    // coluna 8 (terminal) da linha de reset não existe como célula própria — é a caixa do CTU.
    expect(screen.queryByRole('button', { name: /reinício do contador, coluna 8/i })).not.toBeInTheDocument()
  })

  it('desenha um traço reto do trilho esquerdo até a caixa, na altura da linha de reset (sem conectores de ramo)', () => {
    const { container } = render(<GradeDegrau rung={rungComCtu} indice={0} {...propsBase()} />)

    // A linha de reset tem exatamente uma <line> própria (a trave reta) — bem diferente do
    // padrão de 3 linhas (2 conectores verticais + 1 horizontal) que um Ramo desenharia.
    const todasAsLinhas = Array.from(container.querySelectorAll('line'))
    const yReset = todasAsLinhas.find((l) => l.getAttribute('aria-hidden') === 'true' && l.getAttribute('y1') === l.getAttribute('y2'))
    expect(yReset).toBeDefined()
  })

  it('a altura do SVG cresce para caber a caixa até a linha de reset', () => {
    const semCtu = { id: 'r1', elementos: [], ramos: [] }
    const { container: c1 } = render(<GradeDegrau rung={semCtu} indice={0} {...propsBase()} />)
    const alturaSemCtu = Number(c1.querySelector('svg')?.getAttribute('height'))

    const { container: c2 } = render(<GradeDegrau rung={rungComCtu} indice={1} {...propsBase()} />)
    const alturaComCtu = Number(c2.querySelector('svg')?.getAttribute('height'))

    expect(alturaComCtu).toBeGreaterThan(alturaSemCtu)
  })

  it('prévia de inserir um CTU novo desenha a caixa fantasma na coluna terminal, usando a linhaControle informada', () => {
    const rungVazio = { id: 'r1', elementos: [], ramos: [] }
    const previa: Previa = { celula: { linha: 0, coluna: 7 }, tipo: 'inserir', elemento: 'ctu', linhaControle: 1 }
    render(<GradeDegrau rung={rungVazio} indice={0} {...propsBase()} previa={previa} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })
    expect(celula).toHaveAttribute('data-previa', 'inserir')
    expect(celula.textContent).toContain('CTU')
  })

  it('prévia inválida de CTU marca a célula terminal (sem caixa fantasma), como bobina', () => {
    const rungVazio = { id: 'r1', elementos: [], ramos: [] }
    const previa: Previa = { celula: { linha: 0, coluna: 7 }, tipo: 'invalida', motivo: 'sem linha livre para o reinício do contador' }
    render(<GradeDegrau rung={rungVazio} indice={0} {...propsBase()} previa={previa} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })
    expect(celula).toHaveAttribute('data-previa', 'invalida')
  })
})

describe('GradeDegrau — alça do ramo, geometria do arrasto por ponteiro (D-14)', () => {
  const rungComRamo = { id: 'r1', elementos: [], ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }] }

  it('pointermove sobre a alça reporta a coluna sob o ponteiro via aoArrastarAlca', () => {
    const aoArrastarAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoArrastarAlca={aoArrastarAlca} />)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 9, clientX: 200, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 9, clientX: 200, clientY: 0 })

    // getBoundingClientRect do <svg> é (0,0,0,0) no jsdom; coluna = floor((200-32)/64) = 2
    expect(aoArrastarAlca).toHaveBeenCalledWith('r1', 'b1', 2, 'fim')
  })

  it('pointerup sobre a alça reporta a coluna final via aoSoltarAlca', () => {
    const aoSoltarAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoSoltarAlca={aoSoltarAlca} />)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 9, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 9, clientX: 300, clientY: 0 })

    // coluna = floor((300-32)/64) = 4
    expect(aoSoltarAlca).toHaveBeenCalledWith('r1', 'b1', 4, 'fim')
  })

  it('pointercancel durante o arrasto da alça chama aoCancelarAlca', () => {
    const aoCancelarAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoCancelarAlca={aoCancelarAlca} />)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 9, clientX: 200, clientY: 0 })
    fireEvent.pointerCancel(window, { pointerId: 9 })

    expect(aoCancelarAlca).toHaveBeenCalledTimes(1)
  })

  it('encaminha o evento de tecla bruto na alça para aoTeclarNaAlca', async () => {
    const usuario = userEvent.setup()
    const aoTeclarNaAlca = vi.fn()
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} aoTeclarNaAlca={aoTeclarNaAlca} />)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    alca.focus()
    await usuario.keyboard(' ')

    expect(aoTeclarNaAlca).toHaveBeenCalledTimes(1)
    expect(aoTeclarNaAlca.mock.calls[0][1]).toBe('r1')
    expect(aoTeclarNaAlca.mock.calls[0][2]).toBe('b1')
    expect(aoTeclarNaAlca.mock.calls[0][3]).toBe('fim')
  })

  it('previaAlca inválida colore a alça com o token de perigo (sem cor fixa)', () => {
    const previaAlca: PreviaAlca = { ramoId: 'b1', colunaInicio: 0, colunaFim: 5, valido: false }
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

describe('GradeDegrau — energização (spec 004, tarefa #10, RF-6/RF-14/CA-4/CA-10)', () => {
  // IO_ESPELHO: e1 = contato NA "entrada" em (0,0); e2 = bobina "saida" em (0,7).
  const energizadoIoEspelho: EnergizacaoDegrau = {
    nos: { '0:0': true, '0:1': true, '0:2': true, '0:3': true, '0:4': true, '0:5': true, '0:6': true, '0:7': true },
    celulas: { '0:0': true, '0:1': true, '0:2': true, '0:3': true, '0:4': true, '0:5': true, '0:6': true },
    elementos: { e1: true, e2: true },
  }
  const desenergizadoIoEspelho: EnergizacaoDegrau = {
    nos: { '0:0': true, '0:1': false, '0:2': false, '0:3': false, '0:4': false, '0:5': false, '0:6': false, '0:7': false },
    celulas: { '0:0': false, '0:1': false, '0:2': false, '0:3': false, '0:4': false, '0:5': false, '0:6': false },
    elementos: { e1: false, e2: false },
  }

  it('prop ausente: o desenho é idêntico ao de hoje (sem energizacao vs. sem a prop nenhuma)', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container: semProp } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)
    const { container: comNull } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={null} />)

    expect(semProp.innerHTML).toBe(comNull.innerHTML)
    expect(semProp.innerHTML).not.toContain('stroke-ide-energizado')
    expect(screen.getAllByRole('button', { name: /^Degrau 1, coluna 1, contato NA entrada$/ })[0]).toBeInTheDocument()
  })

  it('prop ausente: aria-label não ganha sufixo de estado', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })
    expect(celula.getAttribute('aria-label')).not.toMatch(/energizado/)
  })

  it('célula energizada: aria-label ganha ", energizado" e o traço do contato usa o token de cor E fica mais espesso', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={energizadoIoEspelho} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada, energizado' })
    const linha = celula.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-energizado')
    expect(Number(linha?.getAttribute('stroke-width'))).toBeGreaterThan(2)
  })

  it('célula desenergizada: aria-label ganha ", desenergizado" e o traço mantém a cor/espessura de hoje', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={desenergizadoIoEspelho} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada, desenergizado' })
    const linha = celula.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-fio')
    expect(linha?.getAttribute('class')).not.toContain('stroke-ide-energizado')
    expect(linha?.getAttribute('stroke-width')).toBe('2')
  })

  it('energizado e desenergizado se distinguem por DOIS atributos (cor do token E espessura do traço) — não só cor', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container: energ } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={energizadoIoEspelho} />)
    const { container: desenerg } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={desenergizadoIoEspelho} />)

    const linhaEnerg = energ.querySelector('[data-celula="r1:0:0"] line')
    const linhaDesenerg = desenerg.querySelector('[data-celula="r1:0:0"] line')

    // atributo 1: classe de cor diferente.
    expect(linhaEnerg?.getAttribute('class')).not.toBe(linhaDesenerg?.getAttribute('class'))
    // atributo 2: espessura diferente (redundância exigida por RF-14/CA-10).
    expect(linhaEnerg?.getAttribute('stroke-width')).not.toBe(linhaDesenerg?.getAttribute('stroke-width'))
  })

  it('a bobina energizada mostra "a energia chega até ela" (elementos[id] da bobina), não o valor de outra célula', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={energizadoIoEspelho} />)

    const bobina = screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida, energizado' })
    expect(bobina.querySelector('path')?.getAttribute('class')).toContain('stroke-ide-energizado')
  })

  it('trecho de fio de uma célula vazia também reflete a energização (não só células com elemento)', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container: energ } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={energizadoIoEspelho} />)
    const { container: desenerg } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={desenergizadoIoEspelho} />)

    // coluna 2 (0-based coluna 1) é vazia (fio) no IO_ESPELHO: x1 = MARGEM_ESQUERDA (32) + 1 * larguraCelula (64) = 96.
    const segmentoEnerg = Array.from(energ.querySelectorAll('svg > line')).find((l) => l.getAttribute('x1') === '96' && l.getAttribute('y1') === l.getAttribute('y2'))
    const segmentoDesenerg = Array.from(desenerg.querySelectorAll('svg > line')).find((l) => l.getAttribute('x1') === '96' && l.getAttribute('y1') === l.getAttribute('y2'))

    expect(segmentoEnerg?.getAttribute('class')).toContain('stroke-ide-energizado')
    expect(segmentoDesenerg?.getAttribute('class')).not.toContain('stroke-ide-energizado')
  })

  it('célula terminal com bobina energizada: o fio da própria célula acompanha a bobina até o trilho direito (não usa `celulas`, que é sempre falso ali — bobina é carga, não conduz)', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={energizadoIoEspelho} />)

    // coluna 8 (0-based coluna 7, terminal): x1 = MARGEM_ESQUERDA (32) + 7 * larguraCelula (64) = 480.
    const fioTerminal = Array.from(container.querySelectorAll('svg > line')).find(
      (l) => l.getAttribute('x1') === '480' && l.getAttribute('y1') === l.getAttribute('y2'),
    )

    expect(fioTerminal).toBeDefined()
    expect(fioTerminal?.getAttribute('class')).toContain('stroke-ide-energizado')
    expect(Number(fioTerminal?.getAttribute('stroke-width'))).toBeGreaterThan(2)
  })

  it('célula terminal com bobina desenergizada: o fio da célula mantém o traço de hoje', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={desenergizadoIoEspelho} />)

    const fioTerminal = Array.from(container.querySelectorAll('svg > line')).find(
      (l) => l.getAttribute('x1') === '480' && l.getAttribute('y1') === l.getAttribute('y2'),
    )

    expect(fioTerminal?.getAttribute('class')).toContain('stroke-ide-fio')
    expect(fioTerminal?.getAttribute('class')).not.toContain('stroke-ide-energizado')
    expect(fioTerminal?.getAttribute('stroke-width')).toBe('2')
  })

  it('trilho esquerdo fica energizado (cor + espessura) sempre que há simulação — é o nó sempre vivo do contrato', () => {
    const rung = IO_ESPELHO.rungs[0]
    const { container: semSimulacao } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)
    const { container: comSimulacao } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={desenergizadoIoEspelho} />)

    const svgSem = semSimulacao.querySelector('svg') as SVGSVGElement
    const svgCom = comSimulacao.querySelector('svg') as SVGSVGElement
    const trilhoSem = svgSem.querySelectorAll('line')[0]
    const trilhoCom = svgCom.querySelectorAll('line')[0]

    expect(trilhoSem.getAttribute('class')).toContain('stroke-ide-trilho')
    expect(trilhoCom.getAttribute('class')).toContain('stroke-ide-energizado')
    expect(Number(trilhoCom.getAttribute('stroke-width'))).toBeGreaterThan(Number(trilhoSem.getAttribute('stroke-width')))
  })

  it('selo de problema convive com a energização na mesma célula: um no canto (selo), outro no traço — não disputam o mesmo atributo', () => {
    const rung = IO_ESPELHO.rungs[0]
    const problemas: Problema[] = [
      { codigo: 'variavel_nao_atribuida', severidade: 'erro', rungId: 'r1', elementoId: 'e1', mensagem: 'problema de exemplo' },
    ]
    render(
      <GradeDegrau rung={rung} indice={0} {...propsBase()} problemas={problemas} energizacao={energizadoIoEspelho} />,
    )

    const celula = screen.getByRole('button', { name: /Degrau 1, coluna 1, contato NA entrada, erro: problema de exemplo, energizado/ })
    // selo no canto (data-problema + o círculo vermelho do SeloProblema).
    expect(celula).toHaveAttribute('data-problema', 'erro')
    expect(celula.querySelector('circle[class*="fill-ide-perigo"]')).not.toBeNull()
    // energização no traço, intocada pelo problema.
    expect(celula.querySelector('line')?.getAttribute('class')).toContain('stroke-ide-energizado')
  })

  it('ramo paralelo: conectores verticais e cada segmento do traço horizontal refletem a energização por coluna', () => {
    // RAMO_OU: e1 = NA "a" em (0,0), trunk aberto; ramo b1 (linha 1, col 0) com
    // e2 = NA "b" fechado — energiza via ramo mesmo com o trunk direto aberto.
    const rung = RAMO_OU.rungs[0]
    const energizacao: EnergizacaoDegrau = {
      nos: { '0:0': true, '0:1': true, '0:2': true, '0:3': true, '0:4': true, '0:5': true, '0:6': true, '0:7': true, '1:0': true, '1:1': true },
      celulas: { '0:0': false, '0:1': true, '0:2': true, '0:3': true, '0:4': true, '0:5': true, '0:6': true, '1:0': true },
      elementos: { e1: false, e2: true, e3: true },
    }
    const { container } = render(<GradeDegrau rung={rung} indice={0} {...propsBase()} energizacao={energizacao} />)

    // contato "a" (trunk direto) não conduz — desenergizado.
    const contatoA = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA a, desenergizado' })
    expect(contatoA.querySelector('line')?.getAttribute('class')).not.toContain('stroke-ide-energizado')

    // contato "b" no ramo conduz — energizado.
    const contatoB = screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 1, contato NA b, energizado' })
    expect(contatoB.querySelector('line')?.getAttribute('class')).toContain('stroke-ide-energizado')

    // bobina "q" recebe energia pelo ramo, mesmo com o trunk direto aberto.
    const bobina = screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina q, energizado' })
    expect(bobina.querySelector('path')?.getAttribute('class')).toContain('stroke-ide-energizado')

    // os conectores verticais do ramo: linhas verticais (x1 === x2) dentro do
    // grupo aria-hidden do traço do ramo — pelo menos uma energizada.
    const grupoTraco = container.querySelector('g[aria-hidden="true"]')
    const conectores = Array.from(grupoTraco?.querySelectorAll('line') ?? []).filter((l) => l.getAttribute('x1') === l.getAttribute('x2'))
    expect(conectores.length).toBeGreaterThan(0)
    expect(conectores.some((l) => l.getAttribute('class')?.includes('stroke-ide-energizado'))).toBe(true)
  })

  it('CTU: CU energizado quando a energia chega à entrada de contagem — não pinta a caixa inteira', () => {
    const rungComCtu = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        { id: 'e2', tipo: 'contato_na' as const, celula: { linha: 1, coluna: 0 }, variavel: 'reset_ctu' },
        { id: 'e3', tipo: 'ctu' as const, celula: { linha: 0, coluna: 7 }, linhaControle: 1, instancia: 'ctu0', preset: 12, saida: 'atingiu' },
      ],
      ramos: [],
    }
    const cuEnergizado: EnergizacaoDegrau = {
      nos: { '0:0': true, '0:1': true, '0:2': true, '0:3': true, '0:4': true, '0:5': true, '0:6': true, '0:7': true, '1:0': true, '1:1': false },
      celulas: { '0:0': true, '0:1': true, '0:2': true, '0:3': true, '0:4': true, '0:5': true, '0:6': true, '1:0': false, '1:1': false, '1:2': false, '1:3': false, '1:4': false, '1:5': false, '1:6': false },
      elementos: { e1: true, e2: false, e3: true },
    }
    render(<GradeDegrau rung={rungComCtu} indice={0} {...propsBase()} energizacao={cuEnergizado} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 8, Contador crescente atingiu, energizado' })
    // o traço de CU (uma <line> extra dentro do símbolo do CTU) fica energizado...
    const linhaCu = celula.querySelector('line')
    expect(linhaCu?.getAttribute('class')).toContain('stroke-ide-energizado')
    // ...mas a caixa (rect) não muda de cor por causa disso — nunca a caixa inteira.
    expect(celula.querySelector('rect')?.getAttribute('class')).not.toContain('stroke-ide-energizado')
    // o resto da caixa (CTU/PV/Q) continua no lugar.
    expect(celula.textContent).toContain('PV=12')
  })

  it('CTU: CU desenergizado quando a energia não chega (reset_ctu não afeta o traço de CU)', () => {
    const rungComCtu = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        { id: 'e2', tipo: 'contato_na' as const, celula: { linha: 1, coluna: 0 }, variavel: 'reset_ctu' },
        { id: 'e3', tipo: 'ctu' as const, celula: { linha: 0, coluna: 7 }, linhaControle: 1, instancia: 'ctu0', preset: 12, saida: 'atingiu' },
      ],
      ramos: [],
    }
    const cuDesenergizado: EnergizacaoDegrau = {
      nos: { '0:0': true, '0:1': false, '0:2': false, '0:3': false, '0:4': false, '0:5': false, '0:6': false, '0:7': false, '1:0': true, '1:1': true },
      celulas: { '0:0': false, '0:1': false, '0:2': false, '0:3': false, '0:4': false, '0:5': false, '0:6': false, '1:0': true, '1:1': true, '1:2': true, '1:3': true, '1:4': true, '1:5': true, '1:6': true },
      elementos: { e1: false, e2: true, e3: false },
    }
    render(<GradeDegrau rung={rungComCtu} indice={0} {...propsBase()} energizacao={cuDesenergizado} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 8, Contador crescente atingiu, desenergizado' })
    const linhaCu = celula.querySelector('line')
    expect(linhaCu?.getAttribute('class')).not.toContain('stroke-ide-energizado')
  })
})

describe('GradeDegrau — congelado durante a simulação (spec 004, RF-15, D-20)', () => {
  const rungComRamo = { id: 'r1', elementos: [], ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }] }

  it('sem congelado, o cursor da célula segue a regra de hoje (cursor-pointer numa célula vazia)', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula.getAttribute('class')).toContain('cursor-pointer')
    expect(celula.getAttribute('class')).not.toContain('cursor-not-allowed')
  })

  it('congelado: a célula vira cursor-not-allowed mesmo com elemento (que seria cursor-grab)', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} congelado={true} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })
    expect(celula.getAttribute('class')).toContain('cursor-not-allowed')
    expect(celula.getAttribute('class')).not.toContain('cursor-grab')
  })

  it('sem congelado, a alça do ramo mantém cursor-ew-resize', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} />)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    expect(alca.getAttribute('class')).toContain('cursor-ew-resize')
  })

  it('congelado: a alça do ramo vira cursor-not-allowed', () => {
    render(<GradeDegrau rung={rungComRamo} indice={0} {...propsBase()} congelado={true} />)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    expect(alca.getAttribute('class')).toContain('cursor-not-allowed')
    expect(alca.getAttribute('class')).not.toContain('cursor-ew-resize')
  })

  it('congelado: pointerdown na célula ainda encaminha (EditorLadder decide a recusa)', () => {
    const aoIniciarArrastoPonteiro = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} congelado={true} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })
    fireEvent.pointerDown(celula, { pointerId: 1, clientX: 10, clientY: 10 })

    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledTimes(1)
  })
})
