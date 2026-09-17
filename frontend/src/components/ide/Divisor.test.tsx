import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Divisor from './Divisor'

describe('Divisor', () => {
  it('expõe role="separator" com orientação e valores aria', () => {
    render(<Divisor orientacao="vertical" valor={300} min={200} max={500} aoMudar={() => {}} rotulo="Redimensionar" />)

    const separador = screen.getByRole('separator', { name: 'Redimensionar' })
    expect(separador).toHaveAttribute('aria-orientation', 'vertical')
    expect(separador).toHaveAttribute('aria-valuenow', '300')
    expect(separador).toHaveAttribute('aria-valuemin', '200')
    expect(separador).toHaveAttribute('aria-valuemax', '500')
  })

  it('teclado (vertical): ArrowLeft aumenta e ArrowRight diminui', () => {
    const aoMudar = vi.fn()
    render(<Divisor orientacao="vertical" valor={300} min={200} max={500} aoMudar={aoMudar} rotulo="Redimensionar" />)
    const separador = screen.getByRole('separator')

    fireEvent.keyDown(separador, { key: 'ArrowLeft' })
    expect(aoMudar).toHaveBeenLastCalledWith(316)

    fireEvent.keyDown(separador, { key: 'ArrowRight' })
    expect(aoMudar).toHaveBeenLastCalledWith(284)
  })

  it('teclado (vertical): não ultrapassa o máximo', () => {
    const aoMudar = vi.fn()
    render(
      <Divisor orientacao="vertical" valor={495} min={200} max={500} aoMudar={aoMudar} rotulo="Redimensionar" passo={16} />,
    )
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' })
    expect(aoMudar).toHaveBeenLastCalledWith(500)
  })

  it('teclado (vertical): não ultrapassa o mínimo', () => {
    const aoMudar = vi.fn()
    render(
      <Divisor orientacao="vertical" valor={205} min={200} max={500} aoMudar={aoMudar} rotulo="Redimensionar" passo={16} />,
    )
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' })
    expect(aoMudar).toHaveBeenLastCalledWith(200)
  })

  it('teclado (horizontal): ArrowUp aumenta e ArrowDown diminui', () => {
    const aoMudar = vi.fn()
    render(
      <Divisor orientacao="horizontal" valor={150} min={96} max={400} aoMudar={aoMudar} rotulo="Redimensionar console" />,
    )
    const separador = screen.getByRole('separator')

    fireEvent.keyDown(separador, { key: 'ArrowUp' })
    expect(aoMudar).toHaveBeenLastCalledWith(166)

    fireEvent.keyDown(separador, { key: 'ArrowDown' })
    expect(aoMudar).toHaveBeenLastCalledWith(134)
  })

  it('pointerdown chama preventDefault (evita seleção de texto/drag nativo)', () => {
    render(<Divisor orientacao="vertical" valor={300} min={200} max={500} aoMudar={() => {}} rotulo="Redimensionar" />)
    const naoPrevenido = fireEvent.pointerDown(screen.getByRole('separator'), { pointerId: 1, clientX: 100, clientY: 0 })
    expect(naoPrevenido).toBe(false)
  })

  it('arrastar por ponteiro (vertical): mover para a esquerda aumenta o valor', () => {
    const aoMudar = vi.fn()
    render(<Divisor orientacao="vertical" valor={300} min={200} max={500} aoMudar={aoMudar} rotulo="Redimensionar" />)
    const separador = screen.getByRole('separator')

    fireEvent.pointerDown(separador, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(separador, { pointerId: 1, clientX: 70, clientY: 0 })

    expect(aoMudar).toHaveBeenLastCalledWith(330)
  })

  it('select-none e touch-none na classe (lição da #22)', () => {
    render(<Divisor orientacao="vertical" valor={300} min={200} max={500} aoMudar={() => {}} rotulo="Redimensionar" />)
    const separador = screen.getByRole('separator')
    expect(separador.className).toMatch(/\bselect-none\b/)
    expect(separador.className).toMatch(/\btouch-none\b/)
  })
})
