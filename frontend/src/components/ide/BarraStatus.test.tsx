import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BarraStatus, { DURACAO_MENSAGEM_STATUS_MS } from './BarraStatus'

describe('BarraStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sem mensagem, mostra o texto neutro "Pronto" na barra (role="status")', () => {
    render(<BarraStatus mensagem={null} />)

    const barra = screen.getByRole('status')
    expect(barra).toHaveTextContent('Pronto')
  })

  it('mostra a mensagem de aviso, com ícone e texto', () => {
    render(<BarraStatus mensagem={{ texto: 'recusado: célula ocupada', nivel: 'aviso', token: 1 }} />)

    const barra = screen.getByRole('status')
    expect(barra).toHaveTextContent('recusado: célula ocupada')
  })

  it('some sozinha depois de 6s', () => {
    render(<BarraStatus mensagem={{ texto: 'recusado: célula ocupada', nivel: 'aviso', token: 1 }} />)

    expect(screen.getByRole('status')).toHaveTextContent('recusado: célula ocupada')

    act(() => {
      vi.advanceTimersByTime(DURACAO_MENSAGEM_STATUS_MS)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Pronto')
  })

  it('reinicia o temporizador quando o token muda, mesmo com o mesmo texto', () => {
    const { rerender } = render(<BarraStatus mensagem={{ texto: 'recusado: x', nivel: 'aviso', token: 1 }} />)

    act(() => {
      vi.advanceTimersByTime(DURACAO_MENSAGEM_STATUS_MS - 1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('recusado: x')

    // token novo, texto repetido: reinicia os 6s a partir daqui.
    rerender(<BarraStatus mensagem={{ texto: 'recusado: x', nivel: 'aviso', token: 2 }} />)

    act(() => {
      vi.advanceTimersByTime(DURACAO_MENSAGEM_STATUS_MS - 1000)
    })
    // se o temporizador não tivesse reiniciado, já teriam se passado 6s+ desde o token 1.
    expect(screen.getByRole('status')).toHaveTextContent('recusado: x')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Pronto')
  })

  it('usa um ícone distinto por nível (aviso vs. erro)', () => {
    const { rerender } = render(<BarraStatus mensagem={{ texto: 'algo', nivel: 'aviso', token: 1 }} />)
    const barraAviso = screen.getByRole('status')
    const svgAviso = barraAviso.querySelector('svg')
    expect(svgAviso).not.toBeNull()
    const classeAviso = svgAviso?.getAttribute('class') ?? ''

    rerender(<BarraStatus mensagem={{ texto: 'algo', nivel: 'erro', token: 2 }} />)
    const barraErro = screen.getByRole('status')
    const svgErro = barraErro.querySelector('svg')
    expect(svgErro).not.toBeNull()
    const classeErro = svgErro?.getAttribute('class') ?? ''

    expect(classeAviso).not.toBe(classeErro)
  })
})
