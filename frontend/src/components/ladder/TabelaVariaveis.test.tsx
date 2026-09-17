import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ENTRADAS_LOCALIZADAS, GPIO_DO_ENDERECO, SAIDAS_LOCALIZADAS } from '../../ladder/enderecos'
import type { Variavel } from '../../ladder/modelo'
import codigoFonte from './TabelaVariaveis.tsx?raw'
import TabelaVariaveis from './TabelaVariaveis'

function variavel(nome: string, endereco?: string): Variavel {
  return endereco === undefined ? { nome, tipo: 'BOOL' } : { nome, tipo: 'BOOL', endereco }
}

function renderizar(variaveis: Variavel[], extra: Partial<Parameters<typeof TabelaVariaveis>[0]> = {}) {
  return render(
    <TabelaVariaveis
      variaveis={variaveis}
      aoDeclarar={vi.fn()}
      aoAtualizar={vi.fn()}
      aoRemover={vi.fn()}
      {...extra}
    />,
  )
}

describe('TabelaVariaveis — layout compacto (painel lateral entre 18 e 32rem)', () => {
  it('usa table-fixed com largura total, para o select não espremer a coluna Nome', () => {
    renderizar([variavel('x')])

    const tabela = screen.getByRole('table')
    expect(tabela).toHaveClass('table-fixed')
    expect(tabela).toHaveClass('w-full')
  })
})

describe('TabelaVariaveis — leitura', () => {
  it('renderiza uma linha por variável com endereço, tipo fixo e valor', () => {
    const variaveis = [variavel('entrada', '%IX0.0'), variavel('saida', '%QX0.0'), variavel('interna')]
    renderizar(variaveis)

    expect(screen.getByLabelText('Nome da variável entrada')).toHaveValue('entrada')
    expect(screen.getByLabelText('Endereço da variável entrada')).toHaveValue('%IX0.0')
    expect(screen.getByLabelText('Endereço da variável saida')).toHaveValue('%QX0.0')
    expect(screen.getByLabelText('Endereço da variável interna')).toHaveValue('')

    expect(screen.getAllByText('BOOL')).toHaveLength(3)
  })
})

describe('TabelaVariaveis — contador', () => {
  it('mostra "0 declaradas" sem variáveis', () => {
    renderizar([])
    expect(screen.getByText('0 declaradas')).toBeInTheDocument()
  })

  it('mostra singular com uma variável', () => {
    renderizar([variavel('x')])
    expect(screen.getByText('1 declarada')).toBeInTheDocument()
  })

  it('mostra plural com várias variáveis', () => {
    renderizar([variavel('x'), variavel('y')])
    expect(screen.getByText('2 declaradas')).toBeInTheDocument()
  })
})

describe('TabelaVariaveis — estado vazio', () => {
  it('mostra a mensagem quando não há variáveis', () => {
    renderizar([])
    expect(screen.getByText('Nenhuma variável. Adicione acima.')).toBeInTheDocument()
  })
})

describe('TabelaVariaveis — abas de filtro', () => {
  it('começa em "Todas" e filtra por classe ao trocar de aba', async () => {
    const usuario = userEvent.setup()
    const variaveis = [variavel('e1', '%IX0.0'), variavel('s1', '%QX0.0'), variavel('i1')]
    renderizar(variaveis)

    const tablist = screen.getByRole('tablist', { name: 'Filtrar variáveis por classe' })
    expect(tablist).toBeInTheDocument()

    const abaTodas = screen.getByRole('tab', { name: 'Todas' })
    const abaEntradas = screen.getByRole('tab', { name: 'Entradas' })
    const abaSaidas = screen.getByRole('tab', { name: 'Saídas' })
    const abaInternas = screen.getByRole('tab', { name: 'Internas' })

    expect(abaTodas).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByLabelText(/^Nome da variável /)).toHaveLength(3)

    await usuario.click(abaEntradas)
    expect(abaEntradas).toHaveAttribute('aria-selected', 'true')
    expect(abaTodas).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByLabelText('Nome da variável e1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável s1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável i1')).not.toBeInTheDocument()

    await usuario.click(abaSaidas)
    expect(screen.getByLabelText('Nome da variável s1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável e1')).not.toBeInTheDocument()

    await usuario.click(abaInternas)
    expect(screen.getByLabelText('Nome da variável i1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável e1')).not.toBeInTheDocument()
  })
})

describe('TabelaVariaveis — adicionar', () => {
  it('declara variável interna quando o endereço não é escolhido', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'contador' })
  })

  it('declara variável de entrada com o endereço escolhido no optgroup Entradas', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    const primeiraEntrada = ENTRADAS_LOCALIZADAS[0]
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.selectOptions(screen.getByLabelText('Endereço da nova variável'), primeiraEntrada)
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'entrada', endereco: primeiraEntrada })
  })

  it('declara variável de saída com o endereço escolhido no optgroup Saídas', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    const primeiraSaida = SAIDAS_LOCALIZADAS[0]
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'saida')
    await usuario.selectOptions(screen.getByLabelText('Endereço da nova variável'), primeiraSaida)
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'saida', endereco: primeiraSaida })
  })

  it('o select de endereço só oferece os livres, agrupados por classe', () => {
    const variaveis = [variavel('e1', ENTRADAS_LOCALIZADAS[0])]
    renderizar(variaveis)

    const select = screen.getByLabelText('Endereço da nova variável') as HTMLSelectElement
    const grupoEntradas = Array.from(select.querySelectorAll('optgroup[label="Entradas"] option')).map(
      (o) => (o as HTMLOptionElement).value,
    )
    const grupoSaidas = Array.from(select.querySelectorAll('optgroup[label="Saídas"] option')).map(
      (o) => (o as HTMLOptionElement).value,
    )

    expect(grupoEntradas).not.toContain(ENTRADAS_LOCALIZADAS[0])
    expect(grupoEntradas).toEqual(ENTRADAS_LOCALIZADAS.slice(1))
    expect(grupoSaidas).toEqual([...SAIDAS_LOCALIZADAS])
  })

  it('não declara com o nome em branco', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).not.toHaveBeenCalled()
  })
})

describe('TabelaVariaveis — renomear', () => {
  it('confirma em Enter', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x')], { aoAtualizar })

    const input = screen.getByLabelText('Nome da variável x')
    await usuario.clear(input)
    await usuario.type(input, 'y')
    await usuario.keyboard('{Enter}')

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'y', endereco: undefined })
  })

  it('confirma em blur', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    render(
      <div>
        <TabelaVariaveis variaveis={[variavel('x')]} aoDeclarar={vi.fn()} aoAtualizar={aoAtualizar} aoRemover={vi.fn()} />
        <button type="button">fora</button>
      </div>,
    )

    const input = screen.getByLabelText('Nome da variável x')
    await usuario.clear(input)
    await usuario.type(input, 'y')
    await usuario.click(screen.getByRole('button', { name: 'fora' }))

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'y', endereco: undefined })
  })

  it('Esc desfaz a edição sem chamar aoAtualizar', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x')], { aoAtualizar })

    const input = screen.getByLabelText('Nome da variável x') as HTMLInputElement
    await usuario.clear(input)
    await usuario.type(input, 'ytemp')
    await usuario.keyboard('{Escape}')

    expect(aoAtualizar).not.toHaveBeenCalled()
    expect(input).toHaveValue('x')
  })

  it('não chama aoAtualizar se o nome não mudou', () => {
    const aoAtualizar = vi.fn()
    renderizar([variavel('x')], { aoAtualizar })

    const input = screen.getByLabelText('Nome da variável x')
    fireEvent.focus(input)
    fireEvent.blur(input)

    expect(aoAtualizar).not.toHaveBeenCalled()
  })
})

describe('TabelaVariaveis — trocar endereço', () => {
  it('escolher um endereço livre chama aoAtualizar com o novo endereço', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x')], { aoAtualizar })

    const primeiraEntrada = ENTRADAS_LOCALIZADAS[0]
    await usuario.selectOptions(screen.getByLabelText('Endereço da variável x'), primeiraEntrada)

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x', endereco: primeiraEntrada })
  })

  it('escolher "Sem endereço (interna)" torna a variável interna', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])], { aoAtualizar })

    await usuario.selectOptions(screen.getByLabelText('Endereço da variável x'), '')

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x', endereco: undefined })
  })

  it('o próprio endereço da linha continua oferecido mesmo sendo o único livre da classe', () => {
    const variaveis = [variavel('e1', ENTRADAS_LOCALIZADAS[0]), variavel('e2', ENTRADAS_LOCALIZADAS[1])]
    renderizar(variaveis)

    const select = screen.getByLabelText('Endereço da variável e1') as HTMLSelectElement
    const opcoes = Array.from(select.options).map((o) => o.value)
    expect(opcoes).toContain(ENTRADAS_LOCALIZADAS[0])
    expect(opcoes).not.toContain(ENTRADAS_LOCALIZADAS[1])
  })
})

describe('TabelaVariaveis — remover', () => {
  it('botão remover chama aoRemover com o nome', async () => {
    const usuario = userEvent.setup()
    const aoRemover = vi.fn()
    renderizar([variavel('x')], { aoRemover })

    await usuario.click(screen.getByRole('button', { name: 'Remover variável x' }))

    expect(aoRemover).toHaveBeenCalledWith('x')
  })
})

describe('TabelaVariaveis — erro', () => {
  it('mostra a recusa em role="alert"', () => {
    renderizar([], { erro: "já existe uma variável chamada 'x'" })
    expect(screen.getByRole('alert')).toHaveTextContent(/já existe uma variável/i)
  })

  it('não mostra alerta quando não há erro', () => {
    renderizar([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('TabelaVariaveis — valor', () => {
  it('sem `valores`, mostra "—" com dica sobre a simulação', () => {
    renderizar([variavel('x')])
    expect(screen.getByLabelText(/Valor de x: estado ao vivo disponível com a simulação \(F9\)/)).toHaveTextContent('—')
  })

  it('com `valores`, mostra TRUE/FALSE', () => {
    renderizar([variavel('x'), variavel('y')], { valores: { x: true, y: false } })
    expect(screen.getByText('TRUE')).toBeInTheDocument()
    expect(screen.getByText('FALSE')).toBeInTheDocument()
  })

  it('variável ausente de `valores` continua mostrando "—"', () => {
    renderizar([variavel('x'), variavel('z')], { valores: { x: true } })
    expect(screen.getByText('TRUE')).toBeInTheDocument()
    expect(screen.getByLabelText(/Valor de z: estado ao vivo/)).toHaveTextContent('—')
  })
})

describe('TabelaVariaveis — mapa de pinos', () => {
  it('lista todos os endereços localizados (`GPIO_DO_ENDERECO`) com o GPIO correspondente', () => {
    renderizar([])

    const detalhes = screen.getByText('Mapa de pinos ESP32').closest('details') as HTMLDetailsElement
    expect(detalhes).toBeInTheDocument()

    for (const endereco of Object.keys(GPIO_DO_ENDERECO)) {
      expect(detalhes).toHaveTextContent(endereco)
      expect(detalhes).toHaveTextContent(`GPIO ${GPIO_DO_ENDERECO[endereco]}`)
    }
    expect([...ENTRADAS_LOCALIZADAS, ...SAIDAS_LOCALIZADAS].sort()).toEqual(Object.keys(GPIO_DO_ENDERECO).sort())
  })

  it('marca como "em uso" os endereços já usados por uma variável', () => {
    const usado = ENTRADAS_LOCALIZADAS[0]
    const livre = ENTRADAS_LOCALIZADAS[1]
    renderizar([variavel('x', usado)])

    const detalhes = screen.getByText('Mapa de pinos ESP32').closest('details') as HTMLDetailsElement
    const linhaUsada = within(detalhes).getByText(usado).closest('div') as HTMLElement
    const linhaLivre = within(detalhes).getByText(livre).closest('div') as HTMLElement

    expect(linhaUsada).toHaveTextContent('em uso')
    expect(linhaLivre).not.toHaveTextContent('em uso')
    expect(detalhes).toContainElement(linhaUsada)
  })
})

describe('TabelaVariaveis — tokens de tema', () => {
  it('não usa classes de cor fixas do Tailwind (slate/sky/red/emerald/amber)', () => {
    expect(codigoFonte).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})
