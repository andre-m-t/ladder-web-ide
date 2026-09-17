import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Variavel } from '../../ladder/modelo'
import TabelaVariaveis from './TabelaVariaveis'

function variavel(nome: string, endereco?: string): Variavel {
  return endereco === undefined ? { nome, tipo: 'BOOL' } : { nome, tipo: 'BOOL', endereco }
}

describe('TabelaVariaveis — layout compacto (coluna de 28rem do EditorLadder)', () => {
  it('usa table-fixed com largura total, para o select não espremer a coluna Nome', () => {
    render(<TabelaVariaveis variaveis={[]} aoDeclarar={vi.fn()} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    const tabela = screen.getByRole('table')
    expect(tabela).toHaveClass('table-fixed')
    expect(tabela).toHaveClass('w-full')
  })
})

describe('TabelaVariaveis — leitura', () => {
  it('renderiza uma linha por variável com tipo e valor corretos', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0'), variavel('interna')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    expect(screen.getByLabelText('Tipo de entrada')).toHaveValue('entrada')
    expect(screen.getByLabelText('Valor de entrada')).toHaveValue('%IX0.0')
    expect(screen.getByLabelText('Tipo de saida')).toHaveValue('saida')
    expect(screen.getByLabelText('Valor de saida')).toHaveValue('%QX0.0')
    expect(screen.getByLabelText('Tipo de interna')).toHaveValue('interna')
    expect(screen.getByLabelText('Valor de interna')).toBeDisabled()
  })
})

describe('TabelaVariaveis — declarar', () => {
  it('declara variável interna sem endereço', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    render(<TabelaVariaveis variaveis={[]} aoDeclarar={aoDeclarar} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'contador' })
  })

  it('declara variável de entrada com o primeiro endereço livre', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    render(<TabelaVariaveis variaveis={[]} aoDeclarar={aoDeclarar} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.selectOptions(screen.getByLabelText('Tipo da nova variável'), 'entrada')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'entrada', endereco: '%IX0.0' })
  })

  it('declara variável de saída com o primeiro endereço livre', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    render(<TabelaVariaveis variaveis={[]} aoDeclarar={aoDeclarar} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'saida')
    await usuario.selectOptions(screen.getByLabelText('Tipo da nova variável'), 'saida')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'saida', endereco: '%QX0.0' })
  })
})

describe('TabelaVariaveis — valor filtrado pela classe e por uso', () => {
  it('valor da nova variável só lista endereços de entrada não usados', async () => {
    const usuario = userEvent.setup()
    const variaveis = [variavel('entrada1', '%IX0.0')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    await usuario.selectOptions(screen.getByLabelText('Tipo da nova variável'), 'entrada')

    const select = screen.getByLabelText('Valor da nova variável') as HTMLSelectElement
    const opcoes = Array.from(select.options).map((o) => o.value)
    expect(opcoes).toEqual(['%IX0.1'])
  })

  it('valor da linha existente inclui o próprio endereço mesmo sendo o único livre', () => {
    const variaveis = [variavel('e1', '%IX0.0'), variavel('e2', '%IX0.1')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={vi.fn()} aoRemover={vi.fn()} />)

    const select = screen.getByLabelText('Valor de e1') as HTMLSelectElement
    const opcoes = Array.from(select.options).map((o) => o.value)
    expect(opcoes).toEqual(['%IX0.0'])
  })
})

describe('TabelaVariaveis — trocar tipo', () => {
  it('trocar para entrada escolhe o primeiro endereço livre e chama aoAtualizar', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    const variaveis = [variavel('x')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />)

    await usuario.selectOptions(screen.getByLabelText('Tipo de x'), 'entrada')

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x', endereco: '%IX0.0' })
  })

  it('sem endereço livre não chama aoAtualizar e mostra aviso local', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    const variaveis = [variavel('e1', '%IX0.0'), variavel('e2', '%IX0.1'), variavel('x')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />)

    await usuario.selectOptions(screen.getByLabelText('Tipo de x'), 'entrada')

    expect(aoAtualizar).not.toHaveBeenCalled()
    expect(screen.getByText(/sem endereço de entrada livre/i)).toBeInTheDocument()
  })

  it('trocar para interna chama aoAtualizar sem endereco', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    const variaveis = [variavel('x', '%IX0.0')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />)

    await usuario.selectOptions(screen.getByLabelText('Tipo de x'), 'interna')

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x' })
  })
})

describe('TabelaVariaveis — renomear', () => {
  it('confirma em Enter', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    const variaveis = [variavel('x')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />)

    const input = screen.getByLabelText('Nome da variável x')
    await usuario.clear(input)
    await usuario.type(input, 'y')
    await usuario.keyboard('{Enter}')

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'y' })
  })

  it('confirma em blur', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    const variaveis = [variavel('x')]
    render(
      <div>
        <TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />
        <button type="button">fora</button>
      </div>,
    )

    const input = screen.getByLabelText('Nome da variável x')
    await usuario.clear(input)
    await usuario.type(input, 'y')
    await usuario.click(screen.getByRole('button', { name: 'fora' }))

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'y' })
  })

  it('não chama aoAtualizar se o nome não mudou', () => {
    const aoAtualizar = vi.fn()
    const variaveis = [variavel('x')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />)

    const input = screen.getByLabelText('Nome da variável x')
    fireEvent.focus(input)
    fireEvent.blur(input)

    expect(aoAtualizar).not.toHaveBeenCalled()
  })
})

describe('TabelaVariaveis — remover', () => {
  it('botão remover chama aoRemover com o nome', async () => {
    const usuario = userEvent.setup()
    const aoRemover = vi.fn()
    const variaveis = [variavel('x')]
    render(<TabelaVariaveis variaveis={variaveis} aoDeclarar={vi.fn()} aoAtualizar={vi.fn()} aoRemover={aoRemover} />)

    await usuario.click(screen.getByRole('button', { name: 'Remover variável x' }))

    expect(aoRemover).toHaveBeenCalledWith('x')
  })
})

describe('TabelaVariaveis — erro', () => {
  it('mostra erro em role="alert"', () => {
    render(
      <TabelaVariaveis
        variaveis={[]}
        aoDeclarar={vi.fn()}
        aoAtualizar={vi.fn()}
        aoRemover={vi.fn()}
        erro="já existe uma variável chamada 'x'"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/já existe uma variável/i)
  })
})
