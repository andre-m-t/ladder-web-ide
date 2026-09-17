import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { EntradaConsole } from '../../lib/console'
import Console from './Console'

function entrada(parcial: Partial<EntradaConsole> & Pick<EntradaConsole, 'id'>): EntradaConsole {
  return { hora: '10:00:00', nivel: 'info', mensagem: 'mensagem', ...parcial }
}

describe('Console', () => {
  it('mostra o cabeçalho "Console"', () => {
    render(<Console entradas={[]} aoLimpar={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Console' })).toBeInTheDocument()
  })

  it('tem role="log" com aria-live="polite"', () => {
    render(<Console entradas={[]} aoLimpar={() => {}} />)
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite')
  })

  it('lista as entradas na ordem recebida, com hora e nível no formato [hh:mm:ss] NÍVEL: mensagem', () => {
    const entradas = [
      entrada({ id: 1, hora: '10:00:00', nivel: 'info', mensagem: 'primeira' }),
      entrada({ id: 2, hora: '10:00:05', nivel: 'erro', mensagem: 'segunda' }),
    ]
    render(<Console entradas={entradas} aoLimpar={() => {}} />)

    const linhas = screen.getByRole('log').querySelectorAll('p')
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toHaveTextContent('[10:00:00] INFO: primeira')
    expect(linhas[1]).toHaveTextContent('[10:00:05] ERRO: segunda')
  })

  it('botão Limpar chama aoLimpar', async () => {
    const usuario = userEvent.setup()
    const aoLimpar = vi.fn()
    render(<Console entradas={[entrada({ id: 1 })]} aoLimpar={aoLimpar} />)

    await usuario.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(aoLimpar).toHaveBeenCalledTimes(1)
  })
})
