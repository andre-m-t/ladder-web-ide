import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { EntradaConsole } from '../../lib/console'
import type { ResultadoSerializacao } from '../../ladder/serializador'
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
    mensagens: [],
    naoLidasMensagens: 0,
    aoLimparMensagens: vi.fn(),
    entradasConsole: [],
    aoLimparConsole: vi.fn(),
  }
}

describe('PainelInferiorConteudo', () => {
  it('mostra as três abas, acessíveis por nome iniciando em Problemas/Mensagens/Console', () => {
    render(<PainelInferiorConteudo {...propsBase()} problemas={[PROBLEMA]} />)

    expect(screen.getByRole('tab', { name: /^Problemas/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Mensagens/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Console/ })).toBeInTheDocument()
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

    rerender(<PainelInferiorConteudo {...propsBase()} aba="mensagens" aoMudarAba={aoMudarAba} />)
    expect(screen.getByRole('log', { name: 'Mensagens' })).toBeInTheDocument()
  })

  it('clicar num problema chama aoEscolherProblema', async () => {
    const usuario = userEvent.setup()
    const aoEscolherProblema = vi.fn()
    render(<PainelInferiorConteudo {...propsBase()} aba="problemas" problemas={[PROBLEMA]} aoEscolherProblema={aoEscolherProblema} />)

    await usuario.click(screen.getByRole('button', { name: /degrau 1 sem nenhuma bobina/ }))
    expect(aoEscolherProblema).toHaveBeenCalledWith(PROBLEMA)
  })

  it('setas do teclado navegam entre as três abas, com volta ao início/fim', () => {
    const aoMudarAba = vi.fn()
    render(<PainelInferiorConteudo {...propsBase()} aba="mensagens" aoMudarAba={aoMudarAba} />)

    expect(screen.getByRole('tablist', { name: 'Painel inferior' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: /^Mensagens/ }), { key: 'ArrowRight' })
    expect(aoMudarAba).toHaveBeenCalledWith('console')

    aoMudarAba.mockClear()
    fireEvent.keyDown(screen.getByRole('tab', { name: /^Mensagens/ }), { key: 'ArrowLeft' })
    expect(aoMudarAba).toHaveBeenCalledWith('problemas')
  })

  it('a contagem de não lidas em Mensagens aparece quando > 0 e some quando 0', () => {
    const { rerender } = render(<PainelInferiorConteudo {...propsBase()} naoLidasMensagens={0} />)
    expect(screen.getByRole('tab', { name: 'Mensagens' })).toBeInTheDocument()

    rerender(<PainelInferiorConteudo {...propsBase()} naoLidasMensagens={3} />)
    expect(screen.getByRole('tab', { name: 'Mensagens 3' })).toBeInTheDocument()
  })

  it('lixeira Limpar some na aba Problemas e limpa a aba certa em Mensagens/Console', async () => {
    const usuario = userEvent.setup()
    const aoLimparMensagens = vi.fn()
    const aoLimparConsole = vi.fn()

    const { rerender } = render(<PainelInferiorConteudo {...propsBase()} aba="problemas" />)
    expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument()

    rerender(
      <PainelInferiorConteudo {...propsBase()} aba="mensagens" aoLimparMensagens={aoLimparMensagens} aoLimparConsole={aoLimparConsole} />,
    )
    await usuario.click(screen.getByRole('button', { name: /limpar/i }))
    expect(aoLimparMensagens).toHaveBeenCalledTimes(1)
    expect(aoLimparConsole).not.toHaveBeenCalled()

    rerender(
      <PainelInferiorConteudo {...propsBase()} aba="console" aoLimparMensagens={aoLimparMensagens} aoLimparConsole={aoLimparConsole} />,
    )
    await usuario.click(screen.getByRole('button', { name: /limpar/i }))
    expect(aoLimparConsole).toHaveBeenCalledTimes(1)
  })

  it('estados vazios centralizados em Mensagens e Console', () => {
    const { rerender } = render(<PainelInferiorConteudo {...propsBase()} aba="mensagens" mensagens={[]} />)
    expect(screen.getByText('Nenhuma mensagem.')).toBeInTheDocument()

    rerender(<PainelInferiorConteudo {...propsBase()} aba="console" entradasConsole={[]} />)
    expect(screen.getByText('Nenhum registro.')).toBeInTheDocument()
  })

  it('mostra as entradas de mensagens quando presentes', () => {
    render(
      <PainelInferiorConteudo
        {...propsBase()}
        aba="mensagens"
        mensagens={[entrada({ id: 1, mensagem: 'recusado: célula ocupada' })]}
      />,
    )
    expect(screen.getByText(/recusado: célula ocupada/)).toBeInTheDocument()
  })

  describe('aba "ST gerado" (spec 003, tarefa #7)', () => {
    const ST_OK: ResultadoSerializacao = {
      ok: true,
      st: '(* degrau 1 *)\nsaida := entrada;',
      mapaLinhas: [{ rungId: 'r1', linhaInicio: 1, linhaFim: 2 }],
    }
    const ST_RECUSA: ResultadoSerializacao = {
      ok: false,
      motivo: 'nada a compilar: o diagrama não tem elementos',
      vazio: true,
    }

    it('não aparece quando stGerado é undefined (projeto ST)', () => {
      render(<PainelInferiorConteudo {...propsBase()} stGerado={undefined} />)
      expect(screen.queryByRole('tab', { name: /^ST gerado/ })).not.toBeInTheDocument()
    })

    it('aparece quando stGerado é passado (projeto Ladder) e mostra o texto ao ser selecionada', async () => {
      const usuario = userEvent.setup()
      const aoMudarAba = vi.fn()
      const { rerender } = render(
        <PainelInferiorConteudo {...propsBase()} aoMudarAba={aoMudarAba} stGerado={ST_OK} />,
      )

      const aba = screen.getByRole('tab', { name: /^ST gerado/ })
      expect(aba).toBeInTheDocument()

      await usuario.click(aba)
      expect(aoMudarAba).toHaveBeenCalledWith('st')

      rerender(<PainelInferiorConteudo {...propsBase()} aba="st" aoMudarAba={aoMudarAba} stGerado={ST_OK} />)
      expect(screen.getByRole('tab', { name: /^ST gerado/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText(/saida := entrada;/)).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('mostra o motivo no lugar do texto quando a serialização recusa ou o diagrama está vazio', () => {
      render(<PainelInferiorConteudo {...propsBase()} aba="st" stGerado={ST_RECUSA} />)
      expect(screen.getByText(/nada a compilar/)).toBeInTheDocument()
    })

    it('a navegação por setas inclui a aba "ST gerado" quando presente', () => {
      const aoMudarAba = vi.fn()
      render(<PainelInferiorConteudo {...propsBase()} aba="problemas" aoMudarAba={aoMudarAba} stGerado={ST_OK} />)

      fireEvent.keyDown(screen.getByRole('tab', { name: /^Problemas/ }), { key: 'ArrowRight' })
      expect(aoMudarAba).toHaveBeenCalledWith('st')

      aoMudarAba.mockClear()
      fireEvent.keyDown(screen.getByRole('tab', { name: /^Problemas/ }), { key: 'ArrowLeft' })
      expect(aoMudarAba).toHaveBeenCalledWith('console')
    })

    it('a lixeira "Limpar" não aparece na aba "ST gerado"', () => {
      render(<PainelInferiorConteudo {...propsBase()} aba="st" stGerado={ST_OK} />)
      expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument()
    })

    it('fallback defensivo: aba "st" sem stGerado se comporta como Console', () => {
      render(<PainelInferiorConteudo {...propsBase()} aba="st" stGerado={undefined} entradasConsole={[]} />)

      expect(screen.queryByRole('tab', { name: /^ST gerado/ })).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /^Console/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('log', { name: 'Console' })).toBeInTheDocument()
    })
  })
})
