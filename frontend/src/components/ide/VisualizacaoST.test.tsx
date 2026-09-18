import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ResultadoSerializacao } from '../../ladder/serializador'
import VisualizacaoST from './VisualizacaoST'

describe('VisualizacaoST', () => {
  it('mostra o texto e a numeração de linha quando ok', () => {
    const resultado: ResultadoSerializacao = {
      ok: true,
      st: 'PROGRAM prog0\n  saida := entrada;\nEND_PROGRAM',
      mapaLinhas: [{ rungId: 'r1', linhaInicio: 1, linhaFim: 3 }],
    }

    render(<VisualizacaoST resultado={resultado} />)

    expect(screen.getByLabelText('Structured Text gerado a partir do diagrama (somente leitura)')).toBeInTheDocument()
    expect(screen.getByText(/saida := entrada;/)).toBeInTheDocument()
    // três linhas de texto → três números, em coluna separada e não selecionável
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('numeração fica fora da seleção do texto (aria-hidden / select-none)', () => {
    const resultado: ResultadoSerializacao = {
      ok: true,
      st: 'linha unica',
      mapaLinhas: [],
    }

    const { container } = render(<VisualizacaoST resultado={resultado} />)
    const coluna = container.querySelector('[aria-hidden="true"]')

    expect(coluna).not.toBeNull()
    expect(coluna).toHaveClass('select-none')
    expect(coluna?.textContent).toBe('1')
  })

  it('mostra o motivo no lugar do texto quando a serialização recusa', () => {
    const resultado: ResultadoSerializacao = {
      ok: false,
      motivo: 'variável "AND" usa palavra reservada da IEC 61131-3',
    }

    render(<VisualizacaoST resultado={resultado} />)

    expect(screen.getByText(/palavra reservada da IEC 61131-3/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mostra o motivo de "nada a compilar" quando o diagrama está vazio', () => {
    const resultado: ResultadoSerializacao = {
      ok: false,
      motivo: 'nada a compilar: o diagrama não tem elementos',
      vazio: true,
    }

    render(<VisualizacaoST resultado={resultado} />)

    expect(screen.getByText(/nada a compilar/)).toBeInTheDocument()
  })
})
