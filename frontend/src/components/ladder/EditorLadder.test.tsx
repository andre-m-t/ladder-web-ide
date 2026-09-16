import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO, MINIMAL } from '../../ladder/fixtures'
import type { Diagrama, Elemento } from '../../ladder/modelo'
import { validarDiagrama } from '../../ladder/validacao'
import EditorLadder from './EditorLadder'

/** Normaliza ids de elemento para e1, e2, ... na ordem de varredura (rung,
 * depois linha, depois coluna), para comparar com a fixture sem depender de
 * qual id o núcleo atribuiu durante a construção pela UI. Helper reescrito
 * (não importado de `ladder/edicao.test.ts`, que é de outra frente). */
function normalizarIds(diagrama: Diagrama): Diagrama {
  const elementosEmOrdem: Elemento[] = []
  for (const rung of diagrama.rungs) {
    const ordenados = [...rung.elementos].sort(
      (a, b) => a.celula.linha - b.celula.linha || a.celula.coluna - b.celula.coluna,
    )
    elementosEmOrdem.push(...ordenados)
  }
  const mapa = new Map(elementosEmOrdem.map((e, indice) => [e.id, `e${indice + 1}`]))

  return {
    ...diagrama,
    rungs: diagrama.rungs.map((rung) => ({
      ...rung,
      elementos: [...rung.elementos]
        .sort((a, b) => a.celula.linha - b.celula.linha || a.celula.coluna - b.celula.coluna)
        .map((e) => ({ ...e, id: mapa.get(e.id) as string })),
    })),
  }
}

/** Última chamada de um `vi.fn()` usado como `aoMudar`. */
function ultimoDiagrama(aoMudar: ReturnType<typeof vi.fn>): Diagrama {
  const chamadas = aoMudar.mock.calls
  expect(chamadas.length).toBeGreaterThan(0)
  return chamadas[chamadas.length - 1][0] as Diagrama
}

describe('EditorLadder — CA-1: espelho direto (IO_ESPELHO) construído só pela UI', () => {
  it('NA %IX0.1 -> bobina %QX0.1 resulta na fixture, sem problemas', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    await usuario.type(screen.getByLabelText('Nome'), 'entrada')
    await usuario.click(screen.getByLabelText('endereço localizado'))
    await usuario.selectOptions(screen.getByLabelText('Endereço'), '%IX0.1')
    await usuario.click(screen.getByRole('button', { name: /declarar/i }))

    await usuario.type(screen.getByLabelText('Nome'), 'saida')
    await usuario.click(screen.getByLabelText('endereço localizado'))
    await usuario.selectOptions(screen.getByLabelText('Endereço'), '%QX0.1')
    await usuario.click(screen.getByRole('button', { name: /declarar/i }))

    await usuario.click(screen.getByRole('button', { name: /contato na/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    await usuario.selectOptions(screen.getByLabelText('Vincular variável ao elemento selecionado'), 'entrada')

    await usuario.click(screen.getByRole('button', { name: /^bobina$/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))
    await usuario.selectOptions(screen.getByLabelText('Vincular variável ao elemento selecionado'), 'saida')

    const final = ultimoDiagrama(aoMudar)
    expect(normalizarIds(final)).toEqual(normalizarIds(IO_ESPELHO))
    expect(validarDiagrama(final)).toEqual([])
  })
})

describe('EditorLadder — CA-2: programa mínimo com variáveis internas (MINIMAL)', () => {
  it('NF entrada -> bobina saida, ambas internas, resulta na fixture, sem problemas', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    await usuario.type(screen.getByLabelText('Nome'), 'entrada')
    await usuario.click(screen.getByRole('button', { name: /declarar/i }))

    await usuario.type(screen.getByLabelText('Nome'), 'saida')
    await usuario.click(screen.getByRole('button', { name: /declarar/i }))

    await usuario.click(screen.getByRole('button', { name: /contato nf/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    await usuario.selectOptions(screen.getByLabelText('Vincular variável ao elemento selecionado'), 'entrada')

    await usuario.click(screen.getByRole('button', { name: /^bobina$/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))
    await usuario.selectOptions(screen.getByLabelText('Vincular variável ao elemento selecionado'), 'saida')

    const final = ultimoDiagrama(aoMudar)
    expect(normalizarIds(final)).toEqual(normalizarIds(MINIMAL))
    expect(validarDiagrama(final)).toEqual([])
  })
})

describe('EditorLadder — CA-5: recusa não altera o diagrama e mostra o motivo', () => {
  it('bobina fora da última coluna: role="alert" com motivo, aoMudar não chamado', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    await usuario.click(screen.getByRole('button', { name: /^bobina$/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/posição inválida/i)
    expect(aoMudar).not.toHaveBeenCalled()
    // a célula continua vazia
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('célula já ocupada: role="alert" com motivo, diagrama não muda de novo', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    await usuario.click(screen.getByRole('button', { name: /contato na/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(aoMudar).toHaveBeenCalledTimes(1)
    const diagramaAposPrimeiraInsercao = ultimoDiagrama(aoMudar)

    // mesma ferramenta continua ativa; tenta inserir de novo na mesma célula
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/ocupada/i)
    expect(aoMudar).toHaveBeenCalledTimes(1)
    expect(ultimoDiagrama(aoMudar)).toEqual(diagramaAposPrimeiraInsercao)
  })
})

describe('EditorLadder — teclado', () => {
  it('insere elemento com foco na célula e Enter (sem clique do mouse na grade)', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    const botaoNA = screen.getByRole('button', { name: /contato na/i })
    botaoNA.focus()
    await usuario.keyboard('{Enter}')
    expect(botaoNA).toHaveAttribute('aria-pressed', 'true')

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    celula.focus()
    await usuario.keyboard('{Enter}')

    expect(
      screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('Esc desativa a ferramenta ativa e limpa o motivo', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    const botaoBobina = screen.getByRole('button', { name: /^bobina$/i })
    await usuario.click(botaoBobina)
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    botaoBobina.focus()
    await usuario.keyboard('{Escape}')

    expect(botaoBobina).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('EditorLadder — remover elemento selecionado limpa a seleção', () => {
  it('depois de remover, nenhuma célula fica com aria-pressed="true"', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await usuario.click(screen.getByRole('button', { name: /contato na/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(
      screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(screen.getByRole('button', { name: /remover/i }))
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
    const celulas = screen.getAllByRole('button', { name: /^Degrau/ })
    for (const celula of celulas) {
      expect(celula).toHaveAttribute('aria-pressed', 'false')
    }
  })
})
