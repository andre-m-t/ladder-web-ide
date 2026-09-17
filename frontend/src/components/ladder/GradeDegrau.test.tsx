import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO } from '../../ladder/fixtures'
import GradeDegrau, { type Previa } from './GradeDegrau'

describe('GradeDegrau', () => {
  it('renderiza as células do degrau com aria-label de conteúdo', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} />)

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
    render(<GradeDegrau rung={rung} indice={1} selecionado={null} aoAtivarCelula={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Degrau 2, coluna 3, contato NF sem variável' })).toBeInTheDocument()
  })

  it('chama aoAtivarCelula com a célula certa ao clicar', async () => {
    const usuario = userEvent.setup()
    const aoAtivarCelula = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={aoAtivarCelula} />)

    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' }))

    expect(aoAtivarCelula).toHaveBeenCalledTimes(1)
    expect(aoAtivarCelula).toHaveBeenCalledWith('r1', { linha: 0, coluna: 1 })
  })

  it('chama aoAtivarCelula ao ativar a célula por teclado (Enter)', async () => {
    const usuario = userEvent.setup()
    const aoAtivarCelula = vi.fn()
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={aoAtivarCelula} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })
    celula.focus()
    await usuario.keyboard('{Enter}')

    expect(aoAtivarCelula).toHaveBeenCalledWith('r1', { linha: 0, coluna: 0 })
  })

  it('marca a célula do elemento selecionado com aria-pressed', () => {
    const rung = IO_ESPELHO.rungs[0]
    render(<GradeDegrau rung={rung} indice={0} selecionado="e1" aoAtivarCelula={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA entrada' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('GradeDegrau — prévia (plano D-11)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('previa "inserir" marca a célula vazia com data-previa="inserir"', () => {
    const previa: Previa = { celula: { linha: 0, coluna: 1 }, tipo: 'inserir', elemento: 'contato_na' }
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} previa={previa} />)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })).toHaveAttribute('data-previa', 'inserir')
  })

  it('previa "remover" marca o elemento existente com data-previa="remover"', () => {
    const previa: Previa = { celula: { linha: 0, coluna: 0 }, tipo: 'remover' }
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} previa={previa} />)

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
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} previa={previa} />)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula).toHaveAttribute('data-previa', 'invalida')
    expect(celula.querySelector('title')).toHaveTextContent('posição inválida para bobina (linha=0, coluna=1)')
  })

  it('sem previa, nenhuma célula tem data-previa', () => {
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} />)

    for (const celula of screen.getAllByRole('button')) {
      expect(celula).not.toHaveAttribute('data-previa')
    }
  })
})

describe('GradeDegrau — recusa (plano D-11)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('recusa marca a célula com aria-invalid/aria-describedby e mostra o alerta abaixo da grade', () => {
    const recusa = { celula: { linha: 0, coluna: 1 }, motivo: 'célula (linha=0, coluna=1) já ocupada' }
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} recusa={recusa} />)

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(recusa.motivo)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    expect(celula).toHaveAttribute('aria-invalid', 'true')
    expect(celula).toHaveAttribute('aria-describedby', alerta.id)
  })

  it('sem recusa, não há alerta', () => {
    render(<GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('GradeDegrau — aoPassarCelula (hover e foco, plano D-11)', () => {
  const rung = IO_ESPELHO.rungs[0]

  it('chama aoPassarCelula ao passar o mouse e limpa ao sair', async () => {
    const usuario = userEvent.setup()
    const aoPassarCelula = vi.fn()
    render(
      <GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} aoPassarCelula={aoPassarCelula} />,
    )

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    await usuario.hover(celula)
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', { linha: 0, coluna: 1 })

    await usuario.unhover(celula)
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', null)
  })

  it('chama aoPassarCelula ao focar por teclado e limpa ao perder o foco', () => {
    const aoPassarCelula = vi.fn()
    render(
      <GradeDegrau rung={rung} indice={0} selecionado={null} aoAtivarCelula={vi.fn()} aoPassarCelula={aoPassarCelula} />,
    )

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })
    celula.focus()
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', { linha: 0, coluna: 1 })

    celula.blur()
    expect(aoPassarCelula).toHaveBeenLastCalledWith('r1', null)
  })
})
