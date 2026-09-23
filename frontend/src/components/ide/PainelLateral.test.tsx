import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PainelLateral from './PainelLateral'

describe('PainelLateral', () => {
  it('aberto=false não renderiza conteúdo nem divisor', () => {
    render(
      <PainelLateral aberto={false} rotulo="Painel de variáveis" largura={320} larguraMin={288} larguraMax={640} aoRedimensionar={() => {}}>
        <p>conteúdo</p>
      </PainelLateral>,
    )

    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('usa o rotulo no aria-label do painel', () => {
    render(
      <PainelLateral aberto={true} rotulo="Painel de ambiente" largura={320} larguraMin={288} larguraMax={640} aoRedimensionar={() => {}}>
        <p>conteúdo</p>
      </PainelLateral>,
    )

    expect(screen.getByRole('complementary', { name: 'Painel de ambiente' })).toBeInTheDocument()
  })

  it('aberto=true renderiza o conteúdo e o divisor', () => {
    render(
      <PainelLateral aberto={true} rotulo="Painel de variáveis" largura={320} larguraMin={288} larguraMax={640} aoRedimensionar={() => {}}>
        <p>conteúdo</p>
      </PainelLateral>,
    )

    expect(screen.getByText('conteúdo')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('divisor por teclado redimensiona dentro de mín/máx', () => {
    const aoRedimensionar = vi.fn()
    render(
      <PainelLateral aberto={true} rotulo="Painel de ambiente" largura={300} larguraMin={288} larguraMax={640} aoRedimensionar={aoRedimensionar}>
        <p>conteúdo</p>
      </PainelLateral>,
    )

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' })
    expect(aoRedimensionar).toHaveBeenCalledWith(316)
  })
})
