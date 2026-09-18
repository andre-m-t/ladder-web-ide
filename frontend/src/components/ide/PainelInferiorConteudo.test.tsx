import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { EntradaConsole } from '../../lib/console'
import type { Problema } from '../../ladder/validacao'
import PainelInferiorConteudo, { type PainelInferiorConteudoProps } from './PainelInferiorConteudo'

const PROBLEMA: Problema = {
  codigo: 'rung_incompleto',
  severidade: 'erro',
  rungId: 'r1',
  elementoId: null,
  mensagem: 'degrau 1 sem nenhuma bobina',
}

function entrada(parcial: Partial<EntradaConsole> & Pick<EntradaConsole, 'id'>): EntradaConsole {
  return { hora: '10:00:00', nivel: 'info', mensagem: 'mensagem', ...parcial }
}

function propsBase(): PainelInferiorConteudoProps {
  return {
    aba: 'problemas',
    aoMudarAba: vi.fn(),
    problemas: [],
    aoEscolherProblema: vi.fn(),
    entradasConsole: [],
    aoLimparConsole: vi.fn(),
  }
}

describe('PainelInferiorConteudo', () => {
  it('mostra as duas abas, acessíveis por nome iniciando em Problemas/Console', () => {
    render(<PainelInferiorConteudo {...propsBase()} problemas={[PROBLEMA]} />)

    expect(screen.getByRole('tab', { name: /^Problemas/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Console/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /mensagens/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /st gerado/i })).not.toBeInTheDocument()
  })

  it('troca de conteúdo ao clicar em cada aba', async () => {
    const usuario = userEvent.setup()
    const aoMudarAba = vi.fn()
    const { rerender } = render(
      <PainelInferiorConteudo {...propsBase()} aba="console" aoMudarAba={aoMudarAba} problemas={[PROBLEMA]} />,
    )

    expect(screen.getByRole('tab', { name: /^Console/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('log', { name: 'Console' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: /^Problemas/ }))
    expect(aoMudarAba).toHaveBeenCalledWith('problemas')

    rerender(<PainelInferiorConteudo {...propsBase()} aba="problemas" aoMudarAba={aoMudarAba} problemas={[PROBLEMA]} />)
    expect(screen.getByRole('tab', { name: /^Problemas/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/degrau 1 sem nenhuma bobina/)).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('clicar num problema chama aoEscolherProblema', async () => {
    const usuario = userEvent.setup()
    const aoEscolherProblema = vi.fn()
    render(<PainelInferiorConteudo {...propsBase()} aba="problemas" problemas={[PROBLEMA]} aoEscolherProblema={aoEscolherProblema} />)

    await usuario.click(screen.getByRole('button', { name: /degrau 1 sem nenhuma bobina/ }))
    expect(aoEscolherProblema).toHaveBeenCalledWith(PROBLEMA)
  })

  it('setas do teclado navegam entre as duas abas, com volta ao início/fim', () => {
    const aoMudarAba = vi.fn()
    render(<PainelInferiorConteudo {...propsBase()} aba="problemas" aoMudarAba={aoMudarAba} />)

    expect(screen.getByRole('tablist', { name: 'Painel inferior' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: /^Problemas/ }), { key: 'ArrowRight' })
    expect(aoMudarAba).toHaveBeenCalledWith('console')

    aoMudarAba.mockClear()
    fireEvent.keyDown(screen.getByRole('tab', { name: /^Problemas/ }), { key: 'ArrowLeft' })
    expect(aoMudarAba).toHaveBeenCalledWith('console')
  })

  it('lixeira "Limpar" some na aba Problemas e limpa o Console quando ativo', async () => {
    const usuario = userEvent.setup()
    const aoLimparConsole = vi.fn()

    const { rerender } = render(<PainelInferiorConteudo {...propsBase()} aba="problemas" />)
    expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument()

    rerender(<PainelInferiorConteudo {...propsBase()} aba="console" aoLimparConsole={aoLimparConsole} />)
    await usuario.click(screen.getByRole('button', { name: /limpar/i }))
    expect(aoLimparConsole).toHaveBeenCalledTimes(1)
  })

  it('estado vazio centralizado no Console', () => {
    render(<PainelInferiorConteudo {...propsBase()} aba="console" entradasConsole={[]} />)
    expect(screen.getByText('Nenhum registro.')).toBeInTheDocument()
  })

  it('mostra as entradas do console quando presentes', () => {
    render(
      <PainelInferiorConteudo
        {...propsBase()}
        aba="console"
        entradasConsole={[entrada({ id: 1, mensagem: 'recusado: célula ocupada' })]}
      />,
    )
    expect(screen.getByText(/recusado: célula ocupada/)).toBeInTheDocument()
  })
})
