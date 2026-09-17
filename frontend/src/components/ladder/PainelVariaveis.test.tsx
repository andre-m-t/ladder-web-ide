import { useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ENTRADAS_LOCALIZADAS } from '../../ladder/enderecos'
import { diagramaVazio } from '../../ladder/edicao'
import type { Diagrama } from '../../ladder/modelo'
import codigoFonte from './PainelVariaveis.tsx?raw'
import PainelVariaveis from './PainelVariaveis'

/** Diagrama com uma variável Memória (sem endereço) vinculada a um contato —
 * só para testar a recusa de `removerVariavel` (núcleo) quando a variável
 * está em uso. */
const DIAGRAMA_COM_VINCULO: Diagrama = {
  versao: 1,
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
  versao: 1,
  variaveis: [{ nome: 'x', tipo: 'BOOL' }],
  rungs: [{ id: 'r1', elementos: [], ramos: [] }],
}

/** Sobe o estado do diagrama, como a IDE faz de verdade: `PainelVariaveis` é
 * controlado, então o teste precisa aplicar `aoMudar` para observar o efeito
 * de uma operação bem-sucedida (variável nova na lista, recusa some...). */
function Wrapper({ inicial }: { inicial: Diagrama }) {
  const [diagrama, setDiagrama] = useState(inicial)
  return <PainelVariaveis diagrama={diagrama} aoMudar={setDiagrama} />
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
      versao: 1,
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

describe('PainelVariaveis — recusa do núcleo', () => {
  it('nome duplicado: recusa aparece em role="alert" e some no próximo sucesso', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={DIAGRAMA_COM_X} />)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'x')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/já existe uma variável/i)

    await usuario.type(screen.getByLabelText('Nome da nova variável'), 'novaVar')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome da variável novaVar')).toBeInTheDocument()
  })

  it('remover variável em uso: recusa aparece e some no próximo sucesso', async () => {
    const usuario = userEvent.setup()
    render(<Wrapper inicial={DIAGRAMA_COM_VINCULO} />)

    await usuario.click(screen.getByRole('button', { name: 'Remover variável entrada' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/vinculada a 1 elemento/i)
    expect(screen.getByLabelText('Nome da variável entrada')).toBeInTheDocument()

    const input = screen.getByLabelText('Nome da variável entrada')
    await usuario.clear(input)
    await usuario.type(input, 'renomeada')
    await usuario.keyboard('{Enter}')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome da variável renomeada')).toBeInTheDocument()
  })
})

describe('PainelVariaveis — tokens de tema', () => {
  it('não usa classes de cor fixas do Tailwind (slate/sky/red/emerald/amber)', () => {
    expect(codigoFonte).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})
