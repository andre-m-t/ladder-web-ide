import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Elemento, Variavel } from '../../ladder/modelo'
import ModalVariavel from './ModalVariavel'

function elemento(tipo: Elemento['tipo'], variavel: string | null = null): Elemento {
  return { id: 'e1', tipo, celula: { linha: 0, coluna: 0 }, variavel }
}

function variavel(nome: string, endereco?: string): Variavel {
  return endereco === undefined ? { nome, tipo: 'BOOL' } : { nome, tipo: 'BOOL', endereco }
}

describe('ModalVariavel — estrutura acessível', () => {
  it('renderiza role dialog com aria-modal e título ligado por aria-labelledby', () => {
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    const idTitulo = dialogo.getAttribute('aria-labelledby')
    expect(idTitulo).toBeTruthy()
    expect(document.getElementById(idTitulo as string)).toHaveTextContent(/variável do contato na/i)
  })

  it('sem variáveis declaradas, orienta a criar na tabela', () => {
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByText(/crie variáveis na tabela ao lado/i)).toBeInTheDocument()
  })
})

describe('ModalVariavel — escolher', () => {
  it('clicar numa variável chama aoEscolher com o nome', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={aoEscolher} aoFechar={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /^entrada/i }))

    expect(aoEscolher).toHaveBeenCalledWith('entrada')
  })

  it('clicar em "Sem variável" chama aoEscolher(null)', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na', 'entrada')} variaveis={variaveis} aoEscolher={aoEscolher} aoFechar={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: 'Sem variável' }))

    expect(aoEscolher).toHaveBeenCalledWith(null)
  })

  it('marca a opção vinculada com aria-current', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na', 'saida')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^saida/i })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Sem variável' })).not.toHaveAttribute('aria-current')
  })
})

describe('ModalVariavel — bobina não escreve entrada', () => {
  it('desabilita variáveis de classe entrada com o motivo, quando o elemento é bobina', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    render(<ModalVariavel elemento={elemento('bobina')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const botaoEntrada = screen.getByRole('button', { name: /^entrada/i })
    expect(botaoEntrada).toBeDisabled()
    expect(botaoEntrada).toHaveTextContent(/entradas não podem ser escritas por bobina/i)

    const botaoSaida = screen.getByRole('button', { name: /^saida/i })
    expect(botaoSaida).not.toBeDisabled()
  })

  it('contato não desabilita variáveis de entrada', () => {
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^entrada/i })).not.toBeDisabled()
  })
})

describe('ModalVariavel — foco inicial', () => {
  it('foca a opção vinculada ao montar', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na', 'saida')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^saida/i })).toHaveFocus()
  })

  it('sem vínculo, foca a primeira opção habilitada ("Sem variável")', () => {
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Sem variável' })).toHaveFocus()
  })

  it('vínculo desabilitado (bobina + entrada) foca a primeira opção habilitada', () => {
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('bobina', 'entrada')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Sem variável' })).toHaveFocus()
  })
})

describe('ModalVariavel — fechar', () => {
  it('Esc fecha', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={aoFechar} />)

    await usuario.keyboard('{Escape}')

    expect(aoFechar).toHaveBeenCalled()
  })

  it('botão Cancelar fecha', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={aoFechar} />)

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(aoFechar).toHaveBeenCalled()
  })

  it('clique no overlay fecha, clique dentro do diálogo não fecha', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={aoFechar} />)

    await usuario.click(screen.getByRole('dialog'))
    expect(aoFechar).not.toHaveBeenCalled()

    const overlay = screen.getByRole('dialog').parentElement as HTMLElement
    await usuario.click(overlay)
    expect(aoFechar).toHaveBeenCalled()
  })
})

describe('ModalVariavel — Tab preso no diálogo', () => {
  it('Tab a partir do último botão volta ao primeiro', async () => {
    const usuario = userEvent.setup()
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    cancelar.focus()
    await usuario.tab()

    expect(screen.getByRole('button', { name: 'Sem variável' })).toHaveFocus()
  })

  it('Shift+Tab a partir do primeiro botão vai para o último', async () => {
    const usuario = userEvent.setup()
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const semVariavel = screen.getByRole('button', { name: 'Sem variável' })
    semVariavel.focus()
    await usuario.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })
})
