import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Problema } from '../../ladder/validacao'
import PainelInferiorConteudo from './PainelInferiorConteudo'

const PROBLEMA: Problema = {
  codigo: 'rung_incompleto',
  severidade: 'erro',
  rungId: 'r1',
  elementoId: null,
  mensagem: 'degrau 1 sem nenhuma bobina',
}

describe('PainelInferiorConteudo', () => {
  it('mostra a contagem de problemas na aba e troca de conteúdo ao clicar', async () => {
    const usuario = userEvent.setup()
    const aoMudarAba = vi.fn()
    const { rerender } = render(
      <PainelInferiorConteudo
        aba="console"
        aoMudarAba={aoMudarAba}
        problemas={[PROBLEMA]}
        aoEscolherProblema={() => {}}
        entradasConsole={[]}
        aoLimparConsole={() => {}}
      />,
    )

    expect(screen.getByRole('tab', { name: /problemas \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /console/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('log')).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: /problemas/i }))
    expect(aoMudarAba).toHaveBeenCalledWith('problemas')

    rerender(
      <PainelInferiorConteudo
        aba="problemas"
        aoMudarAba={aoMudarAba}
        problemas={[PROBLEMA]}
        aoEscolherProblema={() => {}}
        entradasConsole={[]}
        aoLimparConsole={() => {}}
      />,
    )
    expect(screen.getByRole('tab', { name: /problemas/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/degrau 1 sem nenhuma bobina/)).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('clicar num problema chama aoEscolherProblema', async () => {
    const usuario = userEvent.setup()
    const aoEscolherProblema = vi.fn()
    render(
      <PainelInferiorConteudo
        aba="problemas"
        aoMudarAba={() => {}}
        problemas={[PROBLEMA]}
        aoEscolherProblema={aoEscolherProblema}
        entradasConsole={[]}
        aoLimparConsole={() => {}}
      />,
    )
    await usuario.click(screen.getByRole('button', { name: /degrau 1 sem nenhuma bobina/ }))
    expect(aoEscolherProblema).toHaveBeenCalledWith(PROBLEMA)
  })

  it('setas do teclado navegam entre as abas (role=tablist com aria-selected)', () => {
    const aoMudarAba = vi.fn()
    render(
      <PainelInferiorConteudo
        aba="console"
        aoMudarAba={aoMudarAba}
        problemas={[]}
        aoEscolherProblema={() => {}}
        entradasConsole={[]}
        aoLimparConsole={() => {}}
      />,
    )

    expect(screen.getByRole('tablist', { name: 'Painel inferior' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: /console/i }), { key: 'ArrowLeft' })
    expect(aoMudarAba).toHaveBeenCalledWith('problemas')

    aoMudarAba.mockClear()
    fireEvent.keyDown(screen.getByRole('tab', { name: /console/i }), { key: 'ArrowRight' })
    expect(aoMudarAba).toHaveBeenCalledWith('problemas')
  })
})
