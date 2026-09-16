import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO } from '../../ladder/fixtures'
import GradeDegrau from './GradeDegrau'

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
