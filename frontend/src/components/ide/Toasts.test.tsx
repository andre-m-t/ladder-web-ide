import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Toast } from '../../lib/toasts'
import Toasts from './Toasts'

function toast(parcial: Partial<Toast> & Pick<Toast, 'id'>): Toast {
  return { nivel: 'aviso', mensagem: 'mensagem', versao: 1, ...parcial }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Toasts', () => {
  it('renderiza a mensagem de cada toast', () => {
    const toasts = [
      toast({ id: 1, nivel: 'aviso', mensagem: 'coluna ocupada' }),
      toast({ id: 2, nivel: 'erro', mensagem: 'falha ao compilar' }),
    ]
    render(<Toasts toasts={toasts} aoFechar={vi.fn()} />)

    expect(screen.getByText('coluna ocupada')).toBeInTheDocument()
    expect(screen.getByText('falha ao compilar')).toBeInTheDocument()
  })

  it('toast de erro tem role="alert"; os demais níveis têm role="status"', () => {
    const toasts = [
      toast({ id: 1, nivel: 'info', mensagem: 'info' }),
      toast({ id: 2, nivel: 'sucesso', mensagem: 'sucesso' }),
      toast({ id: 3, nivel: 'aviso', mensagem: 'aviso' }),
      toast({ id: 4, nivel: 'erro', mensagem: 'erro' }),
    ]
    render(<Toasts toasts={toasts} aoFechar={vi.fn()} />)

    expect(screen.getAllByRole('status')).toHaveLength(3)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('a região tem aria-live="polite" e aria-relevant="additions"', () => {
    const { container } = render(<Toasts toasts={[toast({ id: 1 })]} aoFechar={vi.fn()} />)
    const regiao = container.firstElementChild as HTMLElement

    expect(regiao).toHaveAttribute('aria-live', 'polite')
    expect(regiao).toHaveAttribute('aria-relevant', 'additions')
  })

  it('fecha pelo botão "Fechar notificação"', () => {
    const aoFechar = vi.fn()
    render(<Toasts toasts={[toast({ id: 7, mensagem: 'x' })]} aoFechar={aoFechar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }))

    expect(aoFechar).toHaveBeenCalledWith(7)
  })

  it('toast de aviso expira sozinho em 5000 ms, chamando aoFechar', () => {
    const aoFechar = vi.fn()
    render(<Toasts toasts={[toast({ id: 1, nivel: 'aviso' })]} aoFechar={aoFechar} />)

    vi.advanceTimersByTime(4999)
    expect(aoFechar).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(aoFechar).toHaveBeenCalledWith(1)
  })

  it('toast de erro não expira sozinho', () => {
    const aoFechar = vi.fn()
    render(<Toasts toasts={[toast({ id: 1, nivel: 'erro' })]} aoFechar={aoFechar} />)

    vi.advanceTimersByTime(60_000)

    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('uma nova versao da mesma mensagem reinicia o tempo do zero', () => {
    const aoFechar = vi.fn()
    const { rerender } = render(<Toasts toasts={[toast({ id: 1, versao: 1 })]} aoFechar={aoFechar} />)

    vi.advanceTimersByTime(3000)
    rerender(<Toasts toasts={[toast({ id: 1, versao: 2 })]} aoFechar={aoFechar} />)

    // Se não tivesse reiniciado, já teria expirado aos 5000 ms desde o início (faltariam 2000 ms).
    vi.advanceTimersByTime(4999)
    expect(aoFechar).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(aoFechar).toHaveBeenCalledWith(1)
  })

  it('passar o ponteiro sobre o toast pausa o temporizador; ao sair, volta a contar o tempo que faltava', () => {
    const aoFechar = vi.fn()
    render(<Toasts toasts={[toast({ id: 1, nivel: 'aviso' })]} aoFechar={aoFechar} />)
    const item = screen.getByRole('status')

    vi.advanceTimersByTime(3000) // faltam 2000 ms
    fireEvent.mouseEnter(item)
    vi.advanceTimersByTime(10_000) // bem além dos 2000 ms restantes, mas pausado
    expect(aoFechar).not.toHaveBeenCalled()

    fireEvent.mouseLeave(item)
    vi.advanceTimersByTime(1999)
    expect(aoFechar).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(aoFechar).toHaveBeenCalledWith(1)
  })
})
