import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ENDERECOS_LOCALIZADOS } from '../../ladder/enderecos'
import type { Elemento, Variavel } from '../../ladder/modelo'
import PainelVariaveis from './PainelVariaveis'

const VARIAVEIS: Variavel[] = [
  { nome: 'entrada', tipo: 'BOOL' },
  { nome: 'saida', tipo: 'BOOL' },
]

const ELEMENTO_SELECIONADO: Elemento = {
  id: 'e1',
  tipo: 'contato_na',
  celula: { linha: 0, coluna: 0 },
  variavel: null,
}

describe('PainelVariaveis', () => {
  it('declara variável interna sem endereço', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    render(
      <PainelVariaveis variaveis={[]} elementoSelecionado={null} aoDeclarar={aoDeclarar} aoVincular={vi.fn()} />,
    )

    await usuario.type(screen.getByLabelText('Nome'), 'contador')
    await usuario.click(screen.getByRole('button', { name: /declarar/i }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'contador' })
  })

  it('declara variável localizada com o endereço escolhido', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    render(
      <PainelVariaveis variaveis={[]} elementoSelecionado={null} aoDeclarar={aoDeclarar} aoVincular={vi.fn()} />,
    )

    await usuario.type(screen.getByLabelText('Nome'), 'saida')
    await usuario.click(screen.getByLabelText('endereço localizado'))
    await usuario.selectOptions(screen.getByLabelText('Endereço'), '%QX0.0')
    await usuario.click(screen.getByRole('button', { name: /declarar/i }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'saida', endereco: '%QX0.0' })
  })

  it('o seletor de endereço só oferece os quatro endereços localizados', async () => {
    const usuario = userEvent.setup()
    render(
      <PainelVariaveis variaveis={[]} elementoSelecionado={null} aoDeclarar={vi.fn()} aoVincular={vi.fn()} />,
    )

    await usuario.click(screen.getByLabelText('endereço localizado'))
    const select = screen.getByLabelText('Endereço')
    const opcoes = within(select).getAllByRole('option').map((opcao) => opcao.textContent)

    expect(opcoes).toEqual([...ENDERECOS_LOCALIZADOS])
  })

  it('vincula a variável escolhida ao elemento selecionado', async () => {
    const usuario = userEvent.setup()
    const aoVincular = vi.fn()
    render(
      <PainelVariaveis
        variaveis={VARIAVEIS}
        elementoSelecionado={ELEMENTO_SELECIONADO}
        aoDeclarar={vi.fn()}
        aoVincular={aoVincular}
      />,
    )

    const selectVincular = screen.getByLabelText('Vincular variável ao elemento selecionado')
    await usuario.selectOptions(selectVincular, 'entrada')
    expect(aoVincular).toHaveBeenCalledWith('e1', 'entrada')

    await usuario.selectOptions(selectVincular, 'sem variável')
    expect(aoVincular).toHaveBeenCalledWith('e1', null)
  })

  it('não mostra o seletor de vínculo quando nenhum elemento está selecionado', () => {
    render(
      <PainelVariaveis variaveis={VARIAVEIS} elementoSelecionado={null} aoDeclarar={vi.fn()} aoVincular={vi.fn()} />,
    )

    expect(screen.queryByLabelText('Vincular variável ao elemento selecionado')).not.toBeInTheDocument()
  })

  it('mostra o motivo da recusa em role="alert"', () => {
    render(
      <PainelVariaveis
        variaveis={[]}
        elementoSelecionado={null}
        aoDeclarar={vi.fn()}
        aoVincular={vi.fn()}
        erro="variável já declarada"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('variável já declarada')
  })
})
