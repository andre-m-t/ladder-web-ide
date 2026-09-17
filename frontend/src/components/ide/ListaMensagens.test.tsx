import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EntradaConsole } from '../../lib/console'
import ListaMensagens from './ListaMensagens'

function entrada(parcial: Partial<EntradaConsole> & Pick<EntradaConsole, 'id'>): EntradaConsole {
  return { hora: '10:00:00', nivel: 'info', mensagem: 'mensagem', ...parcial }
}

describe('ListaMensagens', () => {
  it('tem role="log" com nome acessível "Mensagens", distinto do Console', () => {
    render(<ListaMensagens entradas={[]} />)
    const log = screen.getByRole('log', { name: 'Mensagens' })
    expect(log).toHaveAttribute('aria-live', 'polite')
  })

  it('sem entradas, mostra o estado vazio centralizado', () => {
    render(<ListaMensagens entradas={[]} />)
    expect(screen.getByText('Nenhuma mensagem.')).toBeInTheDocument()
  })

  it('lista as entradas com hora, ícone por nível e texto', () => {
    const entradas = [
      entrada({ id: 1, hora: '10:00:00', nivel: 'aviso', mensagem: 'recusado: célula ocupada' }),
      entrada({ id: 2, hora: '10:00:05', nivel: 'erro', mensagem: 'falha na compilação' }),
    ]
    render(<ListaMensagens entradas={entradas} />)

    const linhas = screen.getByRole('log').querySelectorAll('p')
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toHaveTextContent('[10:00:00]')
    expect(linhas[0]).toHaveTextContent('recusado: célula ocupada')
    expect(linhas[0].querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(linhas[1]).toHaveTextContent('[10:00:05]')
    expect(linhas[1]).toHaveTextContent('falha na compilação')
    expect(screen.queryByText('Nenhuma mensagem.')).not.toBeInTheDocument()
  })
})
