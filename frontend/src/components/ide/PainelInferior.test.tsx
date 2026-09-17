import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PainelInferior from './PainelInferior'

describe('PainelInferior', () => {
  it('aberto=false não renderiza conteúdo nem divisor', () => {
    render(
      <PainelInferior aberto={false} altura={200} alturaMin={96} alturaMax={480} aoRedimensionar={() => {}}>
        <p>conteúdo</p>
      </PainelInferior>,
    )

    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('aberto=true renderiza o conteúdo e o divisor horizontal', () => {
    render(
      <PainelInferior aberto={true} altura={200} alturaMin={96} alturaMax={480} aoRedimensionar={() => {}}>
        <p>conteúdo</p>
      </PainelInferior>,
    )

    expect(screen.getByText('conteúdo')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('divisor por teclado redimensiona dentro de mín/máx', () => {
    const aoRedimensionar = vi.fn()
    render(
      <PainelInferior aberto={true} altura={200} alturaMin={96} alturaMax={480} aoRedimensionar={aoRedimensionar}>
        <p>conteúdo</p>
      </PainelInferior>,
    )

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowUp' })
    expect(aoRedimensionar).toHaveBeenCalledWith(216)
  })
})
