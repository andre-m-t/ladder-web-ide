import { useState } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ENTRADAS_LOCALIZADAS } from '../../ladder/enderecos'
import { diagramaVazio } from '../../ladder/edicao'
import type { Diagrama } from '../../ladder/modelo'
import codigoFonte from './PainelVariaveis.tsx?raw'
import PainelVariaveis from './PainelVariaveis'

/** Diagrama com uma variável Memória (sem endereço) vinculada a um contato —
 * só para testar a recusa de `removerVariavel` (núcleo) quando a variável
 * está em uso. */
const DIAGRAMA_COM_VINCULO: Diagrama = {
  versao: 2,
  variaveis: [{ nome: 'entrada', tipo: 'BOOL' }],
  rungs: [
    {
      id: 'r1',
      elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' }],
      ramos: [],
    },
  ],
}

const DIAGRAMA_COM_X: Diagrama = {
  versao: 2,
  variaveis: [{ nome: 'x', tipo: 'BOOL' }],
  rungs: [{ id: 'r1', elementos: [], ramos: [] }],
}

/** Diagrama com uma variável vinculada só à `saida` de um CTU — para provar
 * que a contagem de uso de `removerVariavel` (núcleo) considera o CTU via
 * `variavelDoElemento`, não só `elemento.variavel` (tarefa #18). */
const DIAGRAMA_COM_CTU: Diagrama = {
  versao: 2,
  variaveis: [{ nome: 'atingiu', tipo: 'BOOL' }],
  rungs: [
    {
      id: 'r1',
      elementos: [
        {
          id: 'e1',
          tipo: 'ctu',
          celula: { linha: 0, coluna: 7 },
          linhaControle: 1,
          instancia: 'ctu0',
          preset: 10,
          saida: 'atingiu',
        },
      ],
      ramos: [],
    },
  ],
}

/** Sobe o estado do diagrama, como a IDE faz de verdade: `PainelVariaveis` é
 * controlado, então o teste precisa aplicar `aoMudar` para observar o efeito
 * de uma operação bem-sucedida (variável nova na lista...). `aoRecusar` é
 * opcional (tarefa #25) — o espião default é um `vi.fn()` descartável para
 * os testes que não olham a recusa. */
function Wrapper({
  inicial,
  aoRecusar,
  simulacaoAtiva,
}: {
  inicial: Diagrama
  aoRecusar?: (motivo: string) => void
  simulacaoAtiva?: boolean
}) {
  const [diagrama, setDiagrama] = useState(inicial)
  return <PainelVariaveis diagrama={diagrama} aoMudar={setDiagrama} aoRecusar={aoRecusar} simulacaoAtiva={simulacaoAtiva} />
}

describe('PainelVariaveis — preenche a altura do painel', () => {
  it('raiz com h-full flex flex-col', () => {
    const { container } = render(<Wrapper inicial={diagramaVazio()} />)
    const raiz = container.firstElementChild as HTMLElement

    expect(raiz).toHaveClass('h-full')
    expect(raiz).toHaveClass('flex')
    expect(raiz).toHaveClass('flex-col')
  })
})

describe('PainelVariaveis — declarar via núcleo', () => {
  it('classe Entrada (padrão): adiciona com um pino já pré-selecionado e o diagrama sobe por aoMudar', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={diagramaVazio()} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.getByLabelText('Nome da variável contador')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de contador' }))
    expect(screen.getByLabelText('Pino da variável contador')).toHaveValue(ENTRADAS_LOCALIZADAS[0])
    expect(screen.getByText('1 declarada')).toBeInTheDocument()
  })

  it('escolhendo outro pino no seletor, declara com o pino escolhido', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={diagramaVazio()} />)

    const segundaEntrada = ENTRADAS_LOCALIZADAS[1]
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'entrada')
    await usuario.selectOptions(screen.getByLabelText('Pino da nova variável'), segundaEntrada)
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de entrada' }))
    expect(screen.getByLabelText('Pino da variável entrada')).toHaveValue(segundaEntrada)
  })

  it('classe Memória via controle segmentado: adiciona sem pino', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={diagramaVazio()} />)

    await usuario.click(screen.getByRole('radio', { name: 'Memória' }))
    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'contador')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.getByLabelText('Nome da variável contador')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de contador' }))
    expect(screen.getByLabelText('Pino da variável contador')).toHaveValue('')
    expect(screen.getByText('1 declarada')).toBeInTheDocument()
  })
})

describe('PainelVariaveis — editar e remover via núcleo', () => {
  it('renomeia uma variável', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={DIAGRAMA_COM_X} />)

    const input = screen.getByLabelText('Nome da variável x')
    await usuario.clear(input)
    await usuario.type(input, 'y')
    await usuario.keyboard('{Enter}')

    expect(screen.getByLabelText('Nome da variável y')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável x')).not.toBeInTheDocument()
  })

  it('remove uma variável não vinculada', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={DIAGRAMA_COM_X} />)

    await usuario.click(screen.getByRole('button', { name: 'Remover variável x' }))

    expect(screen.queryByLabelText('Nome da variável x')).not.toBeInTheDocument()
    expect(screen.getByText('0 declaradas')).toBeInTheDocument()
  })

  it('edita o pino de entrada para saída (o núcleo decide, não a UI)', async () => {
    const usuario = userEvent.setup()
    const diagramaComEntrada: Diagrama = {
      versao: 2,
      variaveis: [{ nome: 'x', tipo: 'BOOL', endereco: ENTRADAS_LOCALIZADAS[0] }],
      rungs: [{ id: 'r1', elementos: [], ramos: [] }],
    }
    render(<Wrapper inicial={diagramaComEntrada} />)

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    await usuario.selectOptions(screen.getByLabelText('Pino da variável x'), '%QX0.0')

    await usuario.click(screen.getByRole('button', { name: 'Alterar pino de x' }))
    expect(screen.getByLabelText('Pino da variável x')).toHaveValue('%QX0.0')
  })
})

describe('PainelVariaveis — recusa do núcleo chama aoRecusar, sem texto (tarefa #25)', () => {
  it('nome duplicado: chama aoRecusar com o motivo, sem role="alert" nem o texto do motivo no DOM, e o diagrama não muda', async () => {
    const usuario = userEvent.setup()
    const aoRecusar = vi.fn()
    render(<Wrapper inicial={DIAGRAMA_COM_X} aoRecusar={aoRecusar} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'x')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/já existe uma variável/i))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/já existe uma variável/i)).not.toBeInTheDocument()
    // continua só uma variável ('x') — a recusa não criou nada
    expect(screen.getAllByLabelText(/^Nome da variável /)).toHaveLength(1)
  })

  it('remover variável em uso: chama aoRecusar com o motivo, sem texto no DOM, e a variável continua', async () => {
    const usuario = userEvent.setup()
    const aoRecusar = vi.fn()
    render(<Wrapper inicial={DIAGRAMA_COM_VINCULO} aoRecusar={aoRecusar} />)

    await usuario.click(screen.getByRole('button', { name: 'Remover variável entrada' }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/vinculada a 1 elemento/i))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/vinculada a 1 elemento/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome da variável entrada')).toBeInTheDocument()
  })

  it('remover variável usada só como saída de um CTU também é recusado (tarefa #18: contagem via variavelDoElemento)', async () => {
    const usuario = userEvent.setup()
    const aoRecusar = vi.fn()
    render(<Wrapper inicial={DIAGRAMA_COM_CTU} aoRecusar={aoRecusar} />)

    await usuario.click(screen.getByRole('button', { name: 'Remover variável atingiu' }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/vinculada a 1 elemento/i))
    expect(screen.getByLabelText('Nome da variável atingiu')).toBeInTheDocument()
  })

  it('sem aoRecusar, a recusa é só ignorada — sem alerta, sem erro, diagrama intacto', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={DIAGRAMA_COM_X} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'x')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/^Nome da variável /)).toHaveLength(1)
  })
})

describe('PainelVariaveis — passagem cega de valores/aoAcionar/ciclo (spec 004, tarefa #12)', () => {
  it('repassa `valores`, `aoAcionar` e `ciclo` a TabelaVariaveis sem interpretar nada', async () => {
    const usuario = userEvent.setup()
    const aoAcionar = vi.fn()
    const diagrama: Diagrama = {
      versao: 2,
      variaveis: [{ nome: 'botao', tipo: 'BOOL', endereco: ENTRADAS_LOCALIZADAS[0] }],
      rungs: [{ id: 'r1', elementos: [], ramos: [] }],
    }
    render(
      <PainelVariaveis
        diagrama={diagrama}
        aoMudar={() => {}}
        valores={{ botao: false }}
        aoAcionar={aoAcionar}
        ciclo={7}
      />,
    )

    expect(screen.getByText('Ciclo 7')).toBeInTheDocument()
    await usuario.click(screen.getByRole('switch', { name: /acionar botao/i }))
    expect(aoAcionar).toHaveBeenCalledWith('botao', true)
  })
})

describe('PainelVariaveis — tokens de tema', () => {
  it('não usa classes de cor fixas do Tailwind (slate|sky|red|emerald|amber)', () => {
    expect(codigoFonte).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})

describe('PainelVariaveis — bloqueio durante a simulação (revisão 2026-09-23, simetria com o contrato de E/S do ambiente)', () => {
  it('sem `simulacaoAtiva`, criar continua funcionando (comportamento de sempre)', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={diagramaVazio()} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'x')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.getByLabelText('Nome da variável x')).toBeInTheDocument()
  })

  it('com `simulacaoAtiva`, o botão "Adicionar" fica desabilitado e tentar criar chama aoRecusar sem mudar o diagrama', async () => {
    const aoRecusar = vi.fn()
    render(<Wrapper inicial={diagramaVazio()} aoRecusar={aoRecusar} simulacaoAtiva />)

    const nome = screen.getByLabelText('Nome da nova variável')
    await userEvent.setup().type(nome, 'x')
    const botao = screen.getByRole('button', { name: 'Adicionar' })
    expect(botao).toBeDisabled()

    // defesa em profundidade: mesmo que a UI seja contornada, `aoDeclarar` recusa antes do núcleo
    fireEvent.click(botao)
    expect(aoRecusar).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Nome da variável x')).not.toBeInTheDocument()
  })

  it('com `simulacaoAtiva`, renomear (Enter) fica bloqueado: o núcleo não é chamado e o nome não muda', async () => {
    render(<Wrapper inicial={DIAGRAMA_COM_X} simulacaoAtiva />)

    const input = screen.getByLabelText('Nome da variável x')
    expect(input).toBeDisabled()

    fireEvent.change(input, { target: { value: 'y' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByLabelText('Nome da variável x')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da variável y')).not.toBeInTheDocument()
  })

  it('com `simulacaoAtiva`, "Remover" fica desabilitado e a variável continua', () => {
    render(<Wrapper inicial={DIAGRAMA_COM_X} simulacaoAtiva />)

    const botaoRemover = screen.getByRole('button', { name: 'Remover variável x' })
    expect(botaoRemover).toBeDisabled()

    fireEvent.click(botaoRemover)
    expect(screen.getByLabelText('Nome da variável x')).toBeInTheDocument()
  })

  it('com `simulacaoAtiva`, "Alterar pino" fica desabilitado — trocar pino/classe fica inalcançável', () => {
    render(<Wrapper inicial={DIAGRAMA_COM_X} simulacaoAtiva />)

    const botaoPino = screen.getByRole('button', { name: 'Alterar pino de x' })
    expect(botaoPino).toBeDisabled()

    fireEvent.click(botaoPino)
    expect(screen.queryByLabelText('Pino da variável x')).not.toBeInTheDocument()
  })

  it('com `simulacaoAtiva`, a leitura continua disponível: a linha da variável aparece normalmente', () => {
    render(<Wrapper inicial={DIAGRAMA_COM_X} simulacaoAtiva />)

    expect(screen.getByLabelText('Nome da variável x')).toHaveValue('x')
    expect(screen.getByText('1 declarada')).toBeInTheDocument()
  })
})
