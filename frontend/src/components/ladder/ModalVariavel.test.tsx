import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PONTOS_PORTAO } from '../../ambientes/portao'
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
    linhaControle: 1,
    instancia: 'ctu0',
    preset: 12,
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
    expect(document.getElementById(idTitulo as string)).toHaveTextContent(/propriedades do elemento/i)
  })

  it('sem variáveis declaradas, orienta a criar na tabela', () => {
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByText(/crie variáveis na tabela ao lado/i)).toBeInTheDocument()
  })
})

describe('ModalVariavel — escolher', () => {
  it('mudar o select chama aoEscolher com o nome', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={aoEscolher} aoFechar={vi.fn()} />)

    await usuario.selectOptions(screen.getByRole('combobox'), 'entrada')

    expect(aoEscolher).toHaveBeenCalledWith('entrada')
  })

  it('selecionar "Sem variável" chama aoEscolher(null)', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na', 'entrada')} variaveis={variaveis} aoEscolher={aoEscolher} aoFechar={vi.fn()} />)

    await usuario.selectOptions(screen.getByRole('combobox'), '__sem-variavel__')

    expect(aoEscolher).toHaveBeenCalledWith(null)
  })

  it('o select reflete o vínculo atual', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na', 'saida')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveValue('saida')
  })
})

describe('ModalVariavel — bobina não escreve entrada', () => {
  it('desabilita variáveis de classe entrada com o motivo, quando o elemento é bobina', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    render(<ModalVariavel elemento={elemento('bobina')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const botaoEntrada = screen.getByRole('option', { name: /entrada/i })
    expect(botaoEntrada).toBeDisabled()

    const botaoSaida = screen.getByRole('option', { name: /saida/i })
    expect(botaoSaida).not.toBeDisabled()
  })

  it('contato não desabilita variáveis de entrada', () => {
    const variaveis = [variavel('entrada', '%IX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('option', { name: /entrada/i })).not.toBeDisabled()
  })
})

describe('ModalVariavel — foco inicial', () => {
  it('foca o combobox ao montar', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0')]
    render(<ModalVariavel elemento={elemento('contato_na', 'saida')} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveFocus()
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

  it('botão Fechar fecha', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(<ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={aoFechar} />)

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }))

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

describe('ModalVariavel — tipo', () => {
  it('troca de contato NA para NF chama aoTrocarTipo', async () => {
    const usuario = userEvent.setup()
    const aoTrocarTipo = vi.fn()
    render(
      <ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoTrocarTipo={aoTrocarTipo} aoFechar={vi.fn()} />,
    )

    const radios = screen.getAllByRole('radio')
    await usuario.click(radios[1])

    expect(aoTrocarTipo).toHaveBeenCalledWith('contato_nf')
  })
})

describe('ModalVariavel — CTU: saída e limite (tarefa #18)', () => {
  it('CTU: entradas desabilitadas no select, sem seletor de tipo', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('atingiu')]
    render(<ModalVariavel elemento={elementoCtu()} variaveis={variaveis} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.getByRole('option', { name: /entrada/i })).toBeDisabled()
    expect(screen.getByRole('option', { name: /atingiu/i })).not.toBeDisabled()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('escolher uma variável no select vincula a saída', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const variaveis = [variavel('atingiu')]
    render(<ModalVariavel elemento={elementoCtu()} variaveis={variaveis} aoEscolher={aoEscolher} aoFechar={vi.fn()} />)

    await usuario.selectOptions(screen.getByRole('combobox'), 'atingiu')

    expect(aoEscolher).toHaveBeenCalledWith('atingiu')
  })

  it('mostra o campo "PV (contagens)" com o valor atual, min/max do núcleo', () => {
    render(<ModalVariavel elemento={elementoCtu({ preset: 7 })} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    const campo = screen.getByLabelText('PV (contagens)') as HTMLInputElement
    expect(campo).toHaveValue(7)
    expect(campo).toHaveAttribute('min', String(PV_MIN))
    expect(campo).toHaveAttribute('max', String(PV_MAX))
  })

  it('não mostra o campo "PV (contagens)" para um elemento que não é CTU', () => {
    render(<ModalVariavel elemento={elemento('bobina')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} />)

    expect(screen.queryByLabelText('PV (contagens)')).not.toBeInTheDocument()
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

    const campo = screen.getByLabelText('PV (contagens)')
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

    const campo = screen.getByLabelText('PV (contagens)')
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

    const campo = screen.getByLabelText('PV (contagens)')
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

describe('ModalVariavel — nova variável (revisão 2026-09-23)', () => {
  it('"Nova variável…" abre o modal de criação e repassa nome e pino escolhidos', async () => {
    const usuario = userEvent.setup()
    const aoCriarVariavel = vi.fn(() => null)
    render(
      <ModalVariavel
        elemento={elemento('contato_na')}
        variaveis={[variavel('ocupado', '%IX0.0')]}
        aoEscolher={vi.fn()}
        aoFechar={vi.fn()}
        aoCriarVariavel={aoCriarVariavel}
      />,
    )

    expect(screen.queryByText(/crie variáveis na tabela ao lado/i)).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))
    const criacao = screen.getByRole('dialog', { name: 'Nova variável' })
    const pino = within(criacao).getByLabelText('Pino')
    expect(pino).toHaveValue('%IX0.1')
    expect(within(pino).queryByRole('option', { name: /%IX0\.0/ })).not.toBeInTheDocument()

    await usuario.type(within(criacao).getByLabelText('Nome'), 'botao_liga')
    await usuario.click(within(criacao).getByRole('button', { name: 'Criar e vincular' }))

    expect(aoCriarVariavel).toHaveBeenCalledWith({ nome: 'botao_liga', endereco: '%IX0.1' })
    expect(screen.queryByRole('dialog', { name: 'Nova variável' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /propriedades do elemento/i })).toBeInTheDocument()
  })

  it('bobina não oferece entradas: começa na primeira saída livre e aceita Memória', async () => {
    const usuario = userEvent.setup()
    const aoCriarVariavel = vi.fn(() => null)
    render(
      <ModalVariavel elemento={elemento('bobina')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={vi.fn()} aoCriarVariavel={aoCriarVariavel} />,
    )

    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))
    const criacao = screen.getByRole('dialog', { name: 'Nova variável' })
    const pino = within(criacao).getByLabelText('Pino')
    expect(pino).toHaveValue('%QX0.0')
    expect(within(pino).queryByRole('option', { name: /%IX/ })).not.toBeInTheDocument()

    await usuario.selectOptions(pino, '')
    await usuario.type(within(criacao).getByLabelText('Nome'), 'memoria')
    await usuario.click(within(criacao).getByRole('button', { name: 'Criar e vincular' }))
    expect(aoCriarVariavel).toHaveBeenCalledWith({ nome: 'memoria' })
  })

  it('com ambiente aberto, o pino mostra o ponto da planta e o nome acompanha o pino até o usuário digitar', async () => {
    const usuario = userEvent.setup()
    render(
      <ModalVariavel
        elemento={elemento('contato_na')}
        variaveis={[]}
        aoEscolher={vi.fn()}
        aoFechar={vi.fn()}
        aoCriarVariavel={vi.fn(() => null)}
        pontosAmbiente={PONTOS_PORTAO}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))
    const criacao = screen.getByRole('dialog', { name: 'Nova variável' })
    const nome = within(criacao).getByLabelText('Nome')
    const pino = within(criacao).getByLabelText('Pino')
    expect(nome).toHaveValue('abrir')
    expect(within(pino).getByRole('option', { name: 'GPIO 0 · %IX0.0 — Abrir' })).toBeInTheDocument()

    await usuario.selectOptions(pino, '%IX0.2')
    expect(nome).toHaveValue('parar')

    await usuario.clear(nome)
    await usuario.type(nome, 'meu_nome')
    await usuario.selectOptions(pino, '%IX0.1')
    expect(nome).toHaveValue('meu_nome')
  })

  it('recusa do núcleo aparece no modal de criação, que continua aberto', async () => {
    const usuario = userEvent.setup()
    render(
      <ModalVariavel
        elemento={elemento('contato_na')}
        variaveis={[]}
        aoEscolher={vi.fn()}
        aoFechar={vi.fn()}
        aoCriarVariavel={vi.fn(() => "nome de variável inválido: '1x'")}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))
    const criacao = screen.getByRole('dialog', { name: 'Nova variável' })
    await usuario.type(within(criacao).getByLabelText('Nome'), '1x')
    await usuario.click(within(criacao).getByRole('button', { name: 'Criar e vincular' }))
    expect(within(criacao).getByText("nome de variável inválido: '1x'")).toBeInTheDocument()
  })

  it('Esc no modal de criação fecha só ele', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(
      <ModalVariavel elemento={elemento('contato_na')} variaveis={[]} aoEscolher={vi.fn()} aoFechar={aoFechar} aoCriarVariavel={vi.fn(() => null)} />,
    )

    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Nova variável' })).not.toBeInTheDocument()
    expect(aoFechar).not.toHaveBeenCalled()
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
