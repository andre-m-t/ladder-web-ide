import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO } from '../../ladder/fixtures'
import GradeDegrau, { type Previa } from './GradeDegrau'

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

  it('previa "invalida" marca a célula com data-previa="invalida" e expõe o motivo em <title>', () => {
    const previa: Previa = {
      celula: { linha: 0, coluna: 1 },
      tipo: 'invalida',
      motivo: 'posição inválida para bobina (linha=0, coluna=1)',
    }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} previa={previa} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula).toHaveAttribute('data-previa', 'invalida')
    expect(celula.querySelector('title')).toHaveTextContent('posição inválida para bobina (linha=0, coluna=1)')
  })

  it('sem previa, nenhuma célula tem data-previa', () => {
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} />)

    for (const celula of screen.getAllByRole('button')) {
      expect(celula).not.toHaveAttribute('data-previa')
    }
  })
})

describe('GradeDegrau — recusa (plano D-11)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('recusa marca a célula com aria-invalid/aria-describedby e mostra o alerta abaixo da grade', () => {
    const recusa = { celula: { linha: 0, coluna: 1 }, motivo: 'célula (linha=0, coluna=1) já ocupada' }
    render(<GradeDegrau rung={rung} indice={0} {...propsBase()} recusa={recusa} />)

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(recusa.motivo)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula).toHaveAttribute('aria-invalid', 'true')
    expect(celula).toHaveAttribute('aria-describedby', alerta.id)
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
