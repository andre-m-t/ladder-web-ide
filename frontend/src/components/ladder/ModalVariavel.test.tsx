import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PV_MAX, PV_MIN } from '../../ladder/ctu'
import type { Elemento, ElementoCtu, ElementoSimples, Variavel } from '../../ladder/modelo'
import ModalVariavel from './ModalVariavel'

function elemento(tipo: ElementoSimples['tipo'], variavel: string | null = null): Elemento {
  return { id: 'e1', tipo, celula: { linha: 0, coluna: 0 }, variavel }
}

function elementoCtu(overrides: Partial<ElementoCtu> = {}): ElementoCtu {
  return {
    id: 'e1',
    tipo: 'ctu',
    celula: { linha: 0, coluna: 7 },
    linhaReset: 1,
    instancia: 'ctu0',
    pv: 12,
    saida: null,
    ...overrides,
  }
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

describe('ModalVariavel — CTU: saída e limite (tarefa #18)', () => {
  it('título "contador CTU", saída na lista (entradas desabilitadas, como bobina), com o motivo específico do contador', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('atingiu')]
    render(<ModalVariavel elemento={elementoCtu()} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog')
    expect(document.getElementById(dialogo.getAttribute('aria-labelledby') as string)).toHaveTextContent(/contador ctu/i)
    const botaoEntrada = screen.getByRole('button', { name: /^entrada/i })
    expect(botaoEntrada).toBeDisabled()
    expect(botaoEntrada).toHaveTextContent(/entradas não podem ser escritas pelo contador/i)
    expect(screen.getByRole('button', { name: /^atingiu/i })).not.toBeDisabled()
  })

  it('escolher uma variável na lista vincula a saída (mesmo caminho de aoEscolher)', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const variaveis = [variavel('atingiu')]
    render(<ModalVariavel elemento={elementoCtu()} variaveis={variaveis} aoEscolher={aoEscolher} aoFechar={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /^atingiu/i }))

    expect(aoEscolher).toHaveBeenCalledWith('atingiu')
  })

  it('mostra o campo "Limite (PV)" com o valor atual, min/max do núcleo', () => {
    render(<ModalVariavel elemento={elementoCtu({ pv: 7 })} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const campo = screen.getByLabelText('Limite (PV)') as HTMLInputElement
    expect(campo).toHaveValue(7)
    expect(campo).toHaveAttribute('min', String(PV_MIN))
    expect(campo).toHaveAttribute('max', String(PV_MAX))
  })

  it('não mostra o campo "Limite (PV)" para um elemento que não é CTU', () => {
    render(<ModalVariavel elemento={elemento('bobina')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.queryByLabelText('Limite (PV)')).not.toBeInTheDocument()
  })

  it('"Aplicar limite" chama aoAlterarLimite com o número digitado, sem fechar o modal', async () => {
    const usuario = userEvent.setup()
    const aoAlterarLimite = vi.fn()
    const aoFechar = vi.fn()
    render(
      <ModalVariavel
        elemento={elementoCtu()}
        variaveis={[]}
        aoEscolher={vi.fn()}
        aoFechar={aoFechar}
        aoAlterarLimite={aoAlterarLimite}
      />,
    )

    const campo = screen.getByLabelText('Limite (PV)')
    await usuario.clear(campo)
    await usuario.type(campo, '20')
    await usuario.click(screen.getByRole('button', { name: 'Aplicar limite' }))

    expect(aoAlterarLimite).toHaveBeenCalledWith(20)
    expect(aoFechar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Enter no campo do limite também confirma', async () => {
    const usuario = userEvent.setup()
    const aoAlterarLimite = vi.fn()
    render(
      <ModalVariavel elemento={elementoCtu()} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} aoAlterarLimite={aoAlterarLimite} />,
    )

    const campo = screen.getByLabelText('Limite (PV)')
    await usuario.clear(campo)
    await usuario.type(campo, '5{Enter}')

    expect(aoAlterarLimite).toHaveBeenCalledWith(5)
  })

  it('um valor fora do intervalo ainda é repassado ao callback — quem recusa é o núcleo, não o modal', async () => {
    const usuario = userEvent.setup()
    const aoAlterarLimite = vi.fn()
    render(
      <ModalVariavel elemento={elementoCtu()} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} aoAlterarLimite={aoAlterarLimite} />,
    )

    const campo = screen.getByLabelText('Limite (PV)')
    await usuario.clear(campo)
    await usuario.type(campo, String(PV_MAX + 1))
    await usuario.click(screen.getByRole('button', { name: 'Aplicar limite' }))

    expect(aoAlterarLimite).toHaveBeenCalledWith(PV_MAX + 1)
  })

  it('sem aoAlterarLimite, "Aplicar limite" não quebra (no-op)', async () => {
    const usuario = userEvent.setup()
    render(<ModalVariavel elemento={elementoCtu()} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: 'Aplicar limite' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('ModalVariavel — sem cores fixas (D-13)', () => {
  it('nenhuma classe de cor fixa (só tokens ide-*), inclusive com opção desabilitada', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    const { container } = render(
      <ModalVariavel elemento={elemento('bobina', 'saida')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />,
    )

    expect(container.innerHTML).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})
