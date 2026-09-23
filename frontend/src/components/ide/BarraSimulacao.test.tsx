import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import BarraSimulacao, { type BarraSimulacaoProps } from './BarraSimulacao'

function propsBase(): BarraSimulacaoProps {
  return {
    simulando: false,
    simulacaoRodando: false,
    aoAlternarSimulacao: vi.fn(),
    aoAlternarExecucaoSimulacao: vi.fn(),
    aoPassoSimulacao: vi.fn(),
    aoReiniciarSimulacao: vi.fn(),
    marchas: [
      { id: 'tempo-real', rotulo: 'Tempo real (20 ms/ciclo)' },
      { id: 'lenta', rotulo: 'Marcha lenta (500 ms/ciclo)' },
    ],
    marchaAtual: 'tempo-real',
    aoEscolherMarcha: vi.fn(),
    painelAmbienteAberto: false,
    aoAlternarPainelAmbiente: vi.fn(),
  }
}

describe('BarraSimulacao', () => {
  it('fora da simulação, Executar/Pausar, Passo e Reiniciar ficam desabilitados', () => {
    render(<BarraSimulacao {...propsBase()} />)

    expect(screen.getByRole('button', { name: /executar simulação/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /avançar um ciclo/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /reiniciar simulação/i })).toBeDisabled()
    expect(screen.getByLabelText(/marcha da simulação/i)).toBeDisabled()
    expect(screen.getByText(/ciclo:\s*—/i)).toBeInTheDocument()
  })

  it('na simulação, controles secundários habilitados e ciclo visível', () => {
    render(<BarraSimulacao {...propsBase()} simulando simulacaoRodando ciclo={42} />)

    expect(screen.getByRole('button', { name: /pausar simulação/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /avançar um ciclo/i })).not.toBeDisabled()
    expect(screen.getByText(/ciclo:\s*42/i)).toBeInTheDocument()
  })

  it('Simular chama aoAlternarSimulacao; motivo bloqueia entrar mas não sair', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    const { rerender } = render(
      <BarraSimulacao {...props} motivoSimulacaoIndisponivel="Diagrama inválido" />,
    )

    const botao = screen.getByRole('button', { name: /^simular$/i })
    expect(botao).toBeDisabled()

    rerender(<BarraSimulacao {...props} simulando motivoSimulacaoIndisponivel="Diagrama inválido" />)
    const sair = screen.getByRole('button', { name: /sair da simulação/i })
    expect(sair).not.toBeDisabled()
    await usuario.click(sair)
    expect(props.aoAlternarSimulacao).toHaveBeenCalled()
    expect(sair).toHaveClass('border-ide-perigo')
    expect(sair).toHaveClass('text-ide-perigo')
  })

  it('botão Ambiente chama aoAlternarPainelAmbiente', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSimulacao {...props} />)

    await usuario.click(screen.getByRole('button', { name: /abrir ambiente de simulação/i }))
    expect(props.aoAlternarPainelAmbiente).toHaveBeenCalledTimes(1)
  })

  it('com o painel de ambiente aberto, o botão Ambiente some da faixa', () => {
    render(<BarraSimulacao {...propsBase()} painelAmbienteAberto />)

    expect(screen.queryByRole('button', { name: /ambiente de simulação/i })).not.toBeInTheDocument()
  })
})
