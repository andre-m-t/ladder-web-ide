import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AMBIENTE_PADRAO_ID } from '../../ambientes/catalogo'
import { criarEstadoPortao, PONTOS_PORTAO } from '../../ambientes/portao'
import { IO_ESPELHO, PORTAO } from '../../ladder/fixtures'
import type { Diagrama } from '../../ladder/modelo'
import PainelAmbiente, { type PainelAmbienteProps } from './PainelAmbiente'

function renderizar(props: Partial<PainelAmbienteProps> = {}) {
  const completas: PainelAmbienteProps = {
    aoFechar: vi.fn(),
    ambienteId: AMBIENTE_PADRAO_ID,
    diagrama: IO_ESPELHO,
    estadoPlanta: criarEstadoPortao(),
    saidasPorEndereco: {},
    simulacaoAtiva: false,
    aoComando: vi.fn(),
    aoDeclararVariavel: vi.fn(() => null),
    aoDeclararTodas: vi.fn(),
    ...props,
  }
  render(<PainelAmbiente {...completas} />)
  return completas
}

function linhaDoEndereco(endereco: string): HTMLElement {
  return screen.getByRole('cell', { name: endereco }).closest('tr') as HTMLElement
}

describe('PainelAmbiente — contrato de E/S (revisão 2026-09-23)', () => {
  it('mostra o nome da variável vinculada e a contagem de conectados', () => {
    renderizar()
    expect(within(linhaDoEndereco('%IX0.1')).getByText('entrada')).toBeInTheDocument()
    expect(within(linhaDoEndereco('%QX0.1')).getByText('saida')).toBeInTheDocument()
    expect(screen.getByText(`· 2 de ${PONTOS_PORTAO.length} conectados`)).toBeInTheDocument()
  })

  it('ponto sem variável oferece "Criar", que abre o modal com endereço fixo e nome do contrato', async () => {
    const usuario = userEvent.setup()
    const props = renderizar()

    await usuario.click(screen.getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nova variável' })
    expect(within(dialogo).getByText(/ponto «abrir» do ambiente portão/i)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Nome')).toHaveValue('abrir')
    expect(within(dialogo).getByText(/%IX0\.0/)).toBeInTheDocument()
    expect(within(dialogo).getByText('Entrada')).toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar variável' }))
    expect(props.aoDeclararVariavel).toHaveBeenCalledWith(PONTOS_PORTAO[0], 'abrir')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('recusa do núcleo fica no modal, junto do campo de nome', async () => {
    const usuario = userEvent.setup()
    renderizar({ aoDeclararVariavel: vi.fn(() => "já existe uma variável chamada 'abrir'") })

    await usuario.click(screen.getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nova variável' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar variável' }))

    expect(within(dialogo).getByText("já existe uma variável chamada 'abrir'")).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true')
  })

  it('"Criar todas" chama aoDeclararTodas e mostra quantas faltam', async () => {
    const usuario = userEvent.setup()
    const props = renderizar()
    await usuario.click(screen.getByRole('button', { name: `Criar todas (${PONTOS_PORTAO.length - 2})` }))
    expect(props.aoDeclararTodas).toHaveBeenCalledTimes(1)
  })

  it('durante a simulação, criar fica desabilitado com o motivo', () => {
    renderizar({ motivoCriacaoIndisponivel: 'Saia da simulação para criar variáveis' })
    const botao = screen.getByRole('button', { name: 'Criar variável para Abrir (%IX0.0)' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', 'Saia da simulação para criar variáveis')
    expect(screen.getByRole('button', { name: /criar todas/i })).toBeDisabled()
  })

  it('contrato completo não mostra botões de criação', () => {
    renderizar({ diagrama: PORTAO })
    expect(screen.queryByRole('button', { name: /criar/i })).not.toBeInTheDocument()
  })

  it('sem aoDeclararVariavel, o ponto aparece como "não conectado"', () => {
    const vazio: Diagrama = { versao: 1, variaveis: [], rungs: [{ id: 'r1', elementos: [], ramos: [] }] }
    renderizar({ diagrama: vazio, aoDeclararVariavel: undefined, aoDeclararTodas: undefined })
    expect(screen.getAllByText('— não conectado')).toHaveLength(PONTOS_PORTAO.length)
  })
})
