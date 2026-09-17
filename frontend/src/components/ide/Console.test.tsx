import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EntradaConsole } from '../../lib/console'
import Console from './Console'

function entrada(parcial: Partial<EntradaConsole> & Pick<EntradaConsole, 'id'>): EntradaConsole {
  return { hora: '10:00:00', nivel: 'info', mensagem: 'mensagem', ...parcial }
}

describe('Console', () => {
  it('tem role="log" com aria-live="polite" e nome acessível "Console"', () => {
    render(<Console entradas={[]} />)
    const log = screen.getByRole('log', { name: 'Console' })
    expect(log).toHaveAttribute('aria-live', 'polite')
  })

  it('sem entradas, mostra o estado vazio centralizado', () => {
    render(<Console entradas={[]} />)
    expect(screen.getByText('Nenhum registro.')).toBeInTheDocument()
  })

  it('lista as entradas na ordem recebida, com hora e nível no formato [hh:mm:ss] NÍVEL: mensagem', () => {
    const entradas = [
      entrada({ id: 1, hora: '10:00:00', nivel: 'info', mensagem: 'primeira' }),
      entrada({ id: 2, hora: '10:00:05', nivel: 'erro', mensagem: 'segunda' }),
    ]
    render(<Console entradas={entradas} />)

    const linhas = screen.getByRole('log').querySelectorAll('p')
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toHaveTextContent('[10:00:00] INFO: primeira')
    expect(linhas[1]).toHaveTextContent('[10:00:05] ERRO: segunda')
    expect(screen.queryByText('Nenhum registro.')).not.toBeInTheDocument()
  })
})
