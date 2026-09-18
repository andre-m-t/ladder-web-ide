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

describe('TabelaVariaveis — tabela de largura inteira (tarefa #26)', () => {
  it('usa table-fixed com largura total', () => {
    renderizar([variavel('x')])

    const tabela = screen.getByRole('table', { name: 'Variáveis declaradas' })
    expect(tabela).toHaveClass('table-fixed')
    expect(tabela).toHaveClass('w-full')
  })

  it('mostra as colunas Nome, Tipo, Uso, Pino, Valor e uma coluna de ações (oculta) no cabeçalho', () => {
    renderizar([])

    const tabela = screen.getByRole('table', { name: 'Variáveis declaradas' })
    const cabecalhos = within(tabela).getAllByRole('columnheader').map((th) => th.textContent)

    expect(cabecalhos).toEqual(['Nome', 'Tipo', 'Uso', 'Pino', 'Valor', 'Ações'])
  })
})

describe('TabelaVariaveis — leitura', () => {
  it('renderiza uma linha por variável com pino (GPIO + endereço) em modo texto, tipo fixo, uso por classe e valor', () => {
    const enderecoEntrada = ENTRADAS_LOCALIZADAS[0]
    const enderecoSaida = SAIDAS_LOCALIZADAS[0]
    const variaveis = [variavel('entrada', enderecoEntrada), variavel('saida', enderecoSaida), variavel('memoria')]
    renderizar(variaveis)

    expect(screen.getByLabelText('Nome da variável entrada')).toHaveValue('entrada')

    // Em repouso, o pino é texto (botão de edição), não um select — o select
    // só aparece ao acionar "Alterar pino de ...".
    expect(screen.queryByLabelText('Pino da variável entrada')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar pino de entrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar pino de saida' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar pino de memoria' })).toBeInTheDocument()

    const linhaEntrada = screen.getByLabelText('Nome da variável entrada').closest('tr') as HTMLElement
    const linhaSaida = screen.getByLabelText('Nome da variável saida').closest('tr') as HTMLElement
    const linhaMemoria = screen.getByLabelText('Nome da variável memoria').closest('tr') as HTMLElement

    // Coluna "Uso": classe por linha (Entrada/Saída/Memória).
    expect(within(linhaEntrada).getByText('Entrada')).toBeInTheDocument()
    expect(within(linhaSaida).getByText('Saída')).toBeInTheDocument()
    expect(within(linhaMemoria).getByText('Memória')).toBeInTheDocument()

    // Coluna "Pino": só hardware — GPIO + endereço, ou "—" para Memória.
    expect(within(linhaEntrada).getByText(`GPIO ${GPIO_DO_ENDERECO[enderecoEntrada]}`)).toBeInTheDocument()
    expect(within(linhaEntrada).getByText(enderecoEntrada)).toBeInTheDocument()
    expect(within(linhaSaida).getByText(`GPIO ${GPIO_DO_ENDERECO[enderecoSaida]}`)).toBeInTheDocument()
    expect(within(linhaMemoria).getByRole('button', { name: 'Alterar pino de memoria' })).toHaveTextContent('—')

    expect(screen.getAllByText('BOOL')).toHaveLength(4) // 3 linhas existentes + a linha de adicionar
  })

  it('a coluna Uso usa uma cor diferente por classe', () => {
    const variaveis = [
      variavel('entrada', ENTRADAS_LOCALIZADAS[0]),
      variavel('saida', SAIDAS_LOCALIZADAS[0]),
      variavel('memoria'),
    ]
    renderizar(variaveis)

    const linhaEntrada = screen.getByLabelText('Nome da variável entrada').closest('tr') as HTMLElement
    const linhaSaida = screen.getByLabelText('Nome da variável saida').closest('tr') as HTMLElement
    const linhaMemoria = screen.getByLabelText('Nome da variável memoria').closest('tr') as HTMLElement

    const classes = [
      within(linhaEntrada).getByText('Entrada').className,
      within(linhaSaida).getByText('Saída').className,
      within(linhaMemoria).getByText('Memória').className,
    ]
    expect(new Set(classes).size).toBe(3)
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

describe('TabelaVariaveis — estado vazio (tarefa #26: a linha de adicionar continua visível)', () => {
  it('mostra um texto discreto quando não há variáveis, com a linha de adicionar logo abaixo', () => {
    renderizar([])
    expect(screen.getByText('Nenhuma variável declarada. Adicione abaixo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da nova variável')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument()
  })

  it('filtrando uma categoria sem variáveis, mostra texto específico e a linha de adicionar continua visível', async () => {
    const usuario = userEvent.setup()
    renderizar([variavel('e1', ENTRADAS_LOCALIZADAS[0])])

    await usuario.click(screen.getByRole('tab', { name: 'Saídas' }))

    expect(screen.getByText('Nenhuma variável nesta categoria. Adicione abaixo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da nova variável')).toBeInTheDocument()
  })
})

describe('TabelaVariaveis — abas de filtro', () => {
  it('começa em "Todas" e filtra por classe ao trocar de aba, com a aba Memórias no lugar de Internas', async () => {
    const usuario = userEvent.setup()
    const variaveis = [variavel('e1', ENTRADAS_LOCALIZADAS[0]), variavel('s1', SAIDAS_LOCALIZADAS[0]), variavel('m1')]
    renderizar(variaveis)

    const tablist = screen.getByRole('tablist', { name: 'Filtrar variáveis por classe' })
    expect(tablist).toBeInTheDocument()

    const abaTodas = screen.getByRole('tab', { name: 'Todas' })
    const abaEntradas = screen.getByRole('tab', { name: 'Entradas' })
    const abaSaidas = screen.getByRole('tab', { name: 'Saídas' })
    const abaMemorias = screen.getByRole('tab', { name: 'Memórias' })
    expect(screen.queryByRole('tab', { name: 'Internas' })).not.toBeInTheDocument()

    expect(abaTodas).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByLabelText(/^Nome da variável /)).toHaveLength(3)

    await usuario.click(abaEntradas)
    expect(abaEntradas).toHaveAttribute('aria-selected', 'true')
    expect(abaTodas).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByLabelText('Nome da variável e1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável s1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável m1')).not.toBeInTheDocument()

    await usuario.click(abaSaidas)
    expect(screen.getByLabelText('Nome da variável s1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável e1')).not.toBeInTheDocument()

    await usuario.click(abaMemorias)
    expect(screen.getByLabelText('Nome da variável m1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável e1')).not.toBeInTheDocument()
  })
})

describe('TabelaVariaveis — controle segmentado de classe', () => {
  it('começa em Entrada', () => {
    renderizar([])

    expect(screen.getByRole('radiogroup', { name: 'Classe da nova variável' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Entrada' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Saída' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Memória' })).toHaveAttribute('aria-checked', 'false')
  })

  it('navega com as setas do teclado', async () => {
    const usuario = userEvent.setup()
    renderizar([])

    const radioEntrada = screen.getByRole('radio', { name: 'Entrada' })
    const radioSaida = screen.getByRole('radio', { name: 'Saída' })
    const radioMemoria = screen.getByRole('radio', { name: 'Memória' })

    await usuario.click(radioEntrada)
    await usuario.keyboard('{ArrowRight}')
    expect(radioSaida).toHaveAttribute('aria-checked', 'true')
    expect(radioEntrada).toHaveAttribute('aria-checked', 'false')

    await usuario.keyboard('{ArrowRight}')
    expect(radioMemoria).toHaveAttribute('aria-checked', 'true')

    await usuario.keyboard('{ArrowLeft}')
    expect(radioSaida).toHaveAttribute('aria-checked', 'true')
  })
})

describe('TabelaVariaveis — adicionar', () => {
  it('com a classe Entrada (padrão), declara com o pino livre já pré-selecionado', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    const primeiraEntrada = ENTRADAS_LOCALIZADAS[0]
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    expect(screen.getByLabelText('Pino da nova variável')).toHaveValue(primeiraEntrada)
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'entrada', endereco: primeiraEntrada })
  })

  it('escolhendo outro pino livre no seletor, declara com o pino escolhido', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    const segundaEntrada = ENTRADAS_LOCALIZADAS[1]
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.selectOptions(screen.getByLabelText('Pino da nova variável'), segundaEntrada)
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'entrada', endereco: segundaEntrada })
  })

  it('trocando a classe para Saída, declara com um pino de saída', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    const primeiraSaida = SAIDAS_LOCALIZADAS[0]
    await usuario.click(screen.getByRole('radio', { name: 'Saída' }))
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'saida')
    expect(screen.getByLabelText('Pino da nova variável')).toHaveValue(primeiraSaida)
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'saida', endereco: primeiraSaida })
  })

  it('trocando a classe para Memória, declara sem endereço (aoDeclarar chamado sem `endereco`)', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    await usuario.click(screen.getByRole('radio', { name: 'Memória' }))
    expect(screen.getByText('Memória: variável sem pino físico, usada na lógica.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Pino da nova variável')).not.toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoDeclarar).toHaveBeenCalledWith({ nome: 'contador' })
    expect(aoDeclarar.mock.calls[0][0]).not.toHaveProperty('endereco')
  })

  it('o seletor de pino mostra "GPIO n · endereço" e só os livres da classe', () => {
    const variaveis = [variavel('e1', ENTRADAS_LOCALIZADAS[0])]
    renderizar(variaveis)

    const select = screen.getByLabelText('Pino da nova variável') as HTMLSelectElement
    const opcoes = Array.from(select.options).map((o) => ({ valor: o.value, texto: o.textContent }))

    expect(opcoes.map((o) => o.valor)).not.toContain(ENTRADAS_LOCALIZADAS[0])
    expect(opcoes.map((o) => o.valor)).toEqual(ENTRADAS_LOCALIZADAS.slice(1))
    expect(opcoes[0].texto).toBe(`GPIO ${GPIO_DO_ENDERECO[ENTRADAS_LOCALIZADAS[1]]} · ${ENTRADAS_LOCALIZADAS[1]}`)
  })

  it('sem pino livre da classe, desabilita Adicionar com o motivo', () => {
    const variaveis = ENTRADAS_LOCALIZADAS.map((endereco, indice) => variavel(`e${indice}`, endereco))
    renderizar(variaveis)

    const botao = screen.getByRole('button', { name: 'Adicionar' })
    expect(screen.getByLabelText('Pino da nova variável')).toBeDisabled()
    expect(screen.getByText('Nenhum pino de Entrada livre para declarar.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome da nova variável'), { target: { value: 'novaentrada' } })
    expect(botao).toBeDisabled()
  })

  it('não declara com o nome em branco', async () => {
    const usuario = userEvent.setup()
    const aoDeclarar = vi.fn()
    renderizar([], { aoDeclarar })

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
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

describe('TabelaVariaveis — trocar pino (edição in-place por botão)', () => {
  it('em repouso mostra só o texto do pino; o botão "Alterar pino" abre o select', async () => {
    const usuario = userEvent.setup()
    renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])])

    expect(screen.queryByLabelText('Pino da variável x')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))

    expect(screen.getByLabelText('Pino da variável x')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alterar pino de x' })).not.toBeInTheDocument()
  })

  it('escolher um pino livre aplica e volta ao modo texto', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x')], { aoAtualizar })

    const primeiraEntrada = ENTRADAS_LOCALIZADAS[0]
    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    await usuario.selectOptions(screen.getByLabelText('Pino da variável x'), primeiraEntrada)

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x', endereco: primeiraEntrada })
    expect(screen.queryByLabelText('Pino da variável x')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar pino de x' })).toBeInTheDocument()
  })

  it('escolher "Memória (sem pino)" torna a variável Memória', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])], { aoAtualizar })

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    await usuario.selectOptions(screen.getByLabelText('Pino da variável x'), '')

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x', endereco: undefined })
  })

  it('editar o pino de entrada para saída é permitido (o núcleo decide, não a UI)', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])], { aoAtualizar })

    const primeiraSaida = SAIDAS_LOCALIZADAS[0]
    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    await usuario.selectOptions(screen.getByLabelText('Pino da variável x'), primeiraSaida)

    expect(aoAtualizar).toHaveBeenCalledWith('x', { nome: 'x', endereco: primeiraSaida })
  })

  it('Esc cancela a edição sem chamar aoAtualizar e volta ao modo texto', async () => {
    const usuario = userEvent.setup()
    const aoAtualizar = vi.fn()
    renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])], { aoAtualizar })

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    expect(screen.getByLabelText('Pino da variável x')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')

    expect(aoAtualizar).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Pino da variável x')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar pino de x' })).toBeInTheDocument()
  })

  it('blur sem mudança cancela a edição sem chamar aoAtualizar', () => {
    const aoAtualizar = vi.fn()
    renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])], { aoAtualizar })

    fireEvent.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    const select = screen.getByLabelText('Pino da variável x')
    fireEvent.blur(select)

    expect(aoAtualizar).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Pino da variável x')).not.toBeInTheDocument()
  })

  it('o próprio pino da linha continua oferecido mesmo sendo o único livre da classe', async () => {
    const usuario = userEvent.setup()
    const variaveis = [variavel('e1', ENTRADAS_LOCALIZADAS[0]), variavel('e2', ENTRADAS_LOCALIZADAS[1])]
    renderizar(variaveis)

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de e1' }))
    const select = screen.getByLabelText('Pino da variável e1') as HTMLSelectElement
    const opcoes = Array.from(select.options).map((o) => o.value)
    expect(opcoes).toContain(ENTRADAS_LOCALIZADAS[0])
    expect(opcoes).not.toContain(ENTRADAS_LOCALIZADAS[1])
  })
})

describe('TabelaVariaveis — remover', () => {
  it('botão remover (com ícone e aria-label) chama aoRemover com o nome', async () => {
    const usuario = userEvent.setup()
    const aoRemover = vi.fn()
    renderizar([variavel('x')], { aoRemover })

    await usuario.click(screen.getByRole('button', { name: 'Remover variável x' }))

    expect(aoRemover).toHaveBeenCalledWith('x')
  })
})

describe('TabelaVariaveis — sem recusa em texto (tarefa #25)', () => {
  it('nunca mostra role="alert" (a recusa não é mais responsabilidade deste componente)', () => {
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

describe('TabelaVariaveis — área rolável única', () => {
  it('tabela (com a linha de adicionar) e mapa de pinos ficam dentro do mesmo contêiner rolável', () => {
    const { container } = renderizar([variavel('x', ENTRADAS_LOCALIZADAS[0])])

    const tabela = screen.getByRole('table', { name: 'Variáveis declaradas' })
    const linhaAdicionar = screen.getByLabelText('Nome da nova variável').closest('tr') as HTMLElement
    const detalhes = screen.getByText('Mapa de pinos ESP32').closest('details') as HTMLElement

    const rolavel = container.querySelector('.overflow-auto') as HTMLElement
    expect(rolavel).toBeInTheDocument()
    expect(rolavel).toContainElement(linhaAdicionar)
    expect(rolavel).toContainElement(tabela)
    expect(rolavel).toContainElement(detalhes)

    // O cabeçalho "Variáveis" e as abas ficam fora da área rolável (fixos).
    const cabecalho = screen.getByText('Variáveis').closest('header') as HTMLElement
    const abas = screen.getByRole('tablist', { name: 'Filtrar variáveis por classe' })
    expect(rolavel).not.toContainElement(cabecalho)
    expect(rolavel).not.toContainElement(abas)
  })
})

describe('TabelaVariaveis — linha de adicionar sempre visível (tarefa #26)', () => {
  it('continua na tabela depois de declarar várias variáveis (última linha do corpo)', async () => {
    const usuario = userEvent.setup()
    renderizar([variavel('a'), variavel('b'), variavel('c')])

    const tabela = screen.getByRole('table', { name: 'Variáveis declaradas' })
    const linhas = within(tabela).getAllByRole('row')
    // 1 de cabeçalho + 3 de variáveis + 1 de adicionar
    expect(linhas).toHaveLength(5)
    expect(within(linhas[linhas.length - 1]).getByLabelText('Nome da nova variável')).toBeInTheDocument()

    // Continua visível e utilizável após trocar de aba.
    await usuario.click(screen.getByRole('tab', { name: 'Entradas' }))
    expect(screen.getByLabelText('Nome da nova variável')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument()
  })
})

describe('TabelaVariaveis — mapa de pinos recolhível (tarefa #26)', () => {
  it('começa fechado e abre ao clicar no resumo, lado a lado (Entradas/Saídas) quando aberto', async () => {
    const usuario = userEvent.setup()
    renderizar([])

    const detalhes = screen.getByText('Mapa de pinos ESP32').closest('details') as HTMLDetailsElement
    expect(detalhes).not.toHaveAttribute('open')

    await usuario.click(screen.getByText('Mapa de pinos ESP32'))
    expect(detalhes).toHaveAttribute('open')

    const contentor = within(detalhes).getByText('Entradas').closest('div')?.parentElement as HTMLElement
    expect(contentor).toHaveClass('md:flex-row')
  })
})

describe('TabelaVariaveis — mapa de pinos', () => {
  it('mostra duas tabelas separadas, Entradas e Saídas, com 8 linhas cada e colunas Endereço/GPIO/Variável', () => {
    renderizar([])

    const detalhes = screen.getByText('Mapa de pinos ESP32').closest('details') as HTMLDetailsElement
    expect(detalhes).toBeInTheDocument()

    const tabelaEntradas = within(detalhes).getByText('Entradas').closest('div')?.querySelector('table') as HTMLTableElement
    const tabelaSaidas = within(detalhes).getByText('Saídas').closest('div')?.querySelector('table') as HTMLTableElement
    expect(tabelaEntradas).toBeInTheDocument()
    expect(tabelaSaidas).toBeInTheDocument()
    expect(tabelaEntradas).not.toBe(tabelaSaidas)

    expect(within(tabelaEntradas).getAllByRole('row')).toHaveLength(1 + ENTRADAS_LOCALIZADAS.length)
    expect(within(tabelaSaidas).getAllByRole('row')).toHaveLength(1 + SAIDAS_LOCALIZADAS.length)

    for (const cabecalho of ['Endereço', 'GPIO', 'Variável']) {
      expect(within(tabelaEntradas).getByText(cabecalho)).toBeInTheDocument()
      expect(within(tabelaSaidas).getByText(cabecalho)).toBeInTheDocument()
    }

    for (const endereco of ENTRADAS_LOCALIZADAS) {
      expect(within(tabelaEntradas).getByText(endereco)).toBeInTheDocument()
      expect(within(tabelaEntradas).getByText(`GPIO ${GPIO_DO_ENDERECO[endereco]}`)).toBeInTheDocument()
    }
    for (const endereco of SAIDAS_LOCALIZADAS) {
      expect(within(tabelaSaidas).getByText(endereco)).toBeInTheDocument()
      expect(within(tabelaSaidas).getByText(`GPIO ${GPIO_DO_ENDERECO[endereco]}`)).toBeInTheDocument()
    }
  })

  it('mostra o nome da variável em uso, e "livre" para pinos sem variável', () => {
    const usado = ENTRADAS_LOCALIZADAS[0]
    const livre = ENTRADAS_LOCALIZADAS[1]
    renderizar([variavel('sensorPartida', usado)])

    const detalhes = screen.getByText('Mapa de pinos ESP32').closest('details') as HTMLDetailsElement
    const linhaUsada = within(detalhes).getByText(usado).closest('tr') as HTMLElement
    const linhaLivre = within(detalhes).getByText(livre).closest('tr') as HTMLElement

    expect(within(linhaUsada).getByText('sensorPartida')).toBeInTheDocument()
    expect(within(linhaLivre).getByText('livre')).toBeInTheDocument()
  })
})

describe('TabelaVariaveis — sem "interna" na interface', () => {
  it('nenhum texto visível usa a palavra "interna" (usa "Memória")', () => {
    const variaveis = [variavel('entrada', ENTRADAS_LOCALIZADAS[0]), variavel('saida', SAIDAS_LOCALIZADAS[0]), variavel('memoria')]
    const { container } = renderizar(variaveis)

    expect(container.textContent?.toLowerCase()).not.toContain('interna')
  })
})

describe('TabelaVariaveis — tokens de tema', () => {
  it('não usa classes de cor fixas do Tailwind (slate/sky/red/emerald/amber)', () => {
    expect(codigoFonte).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})
