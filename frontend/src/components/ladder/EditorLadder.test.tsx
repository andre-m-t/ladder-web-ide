import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IO_ESPELHO, MINIMAL } from '../../ladder/fixtures'
import type { Diagrama, Elemento } from '../../ladder/modelo'
import { validarDiagrama } from '../../ladder/validacao'
import EditorLadder from './EditorLadder'

/** Normaliza ids de elemento para e1, e2, ... na ordem de varredura (rung,
 * depois linha, depois coluna), para comparar com a fixture sem depender de
 * qual id o núcleo atribuiu durante a construção pela UI. */
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

/** Simula um arrasto completo por Pointer Events (plano D-12): pointerdown na
 * origem, pointermove além do limiar (em `window`, onde o editor escuta),
 * pointerenter no alvo (é o que define o alvo do arrasto) e pointerup em
 * `window` (onde o editor decide o que soltar). */
function arrastar(origem: Element, alvo: Element) {
  fireEvent.pointerDown(origem, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
  fireEvent.pointerEnter(alvo, { pointerId: 1, clientX: 30, clientY: 30 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 30, clientY: 30 })
}

/** Declara uma variável interna pela tabela (classe "Interna" já é o padrão da linha nova). */
async function declararInterna(usuario: ReturnType<typeof userEvent.setup>, nome: string) {
  await usuario.type(screen.getByLabelText('Nome da nova variável'), nome)
  await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))
}

/** Declara uma variável localizada (entrada ou saída) pela tabela. */
async function declararLocalizada(usuario: ReturnType<typeof userEvent.setup>, nome: string, endereco: string) {
  const classe = endereco.startsWith('%IX') ? 'entrada' : 'saida'
  await usuario.type(screen.getByLabelText('Nome da nova variável'), nome)
  await usuario.selectOptions(screen.getByLabelText('Tipo da nova variável'), classe)
  await usuario.selectOptions(screen.getByLabelText('Valor da nova variável'), endereco)
  await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))
}

/** Arrasta um item novo da paleta até uma célula vazia e escolhe a variável no
 * modal que abre. A busca da opção é restrita ao diálogo: o nome da variável
 * também aparece no botão "Remover variável X" da tabela, ambíguo se a busca
 * não for restrita. */
async function arrastarEEscolher(usuario: ReturnType<typeof userEvent.setup>, rotuloItem: RegExp, rotuloCelulaVazia: string, nomeVariavel: string | null) {
  arrastar(screen.getByRole('button', { name: rotuloItem }), screen.getByRole('button', { name: rotuloCelulaVazia }))
  const dialogo = screen.getByRole('dialog')
  const rotuloOpcao = nomeVariavel === null ? 'Sem variável' : new RegExp(nomeVariavel, 'i')
  await usuario.click(within(dialogo).getByRole('button', { name: rotuloOpcao }))
}

describe('EditorLadder — CA-1: espelho direto (IO_ESPELHO) construído só pela UI', () => {
  it('NA %IX0.1 -> bobina %QX0.1 resulta na fixture, sem problemas', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    await declararLocalizada(usuario, 'entrada', '%IX0.1')
    await declararLocalizada(usuario, 'saida', '%QX0.1')

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', 'entrada')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 1, coluna 8, vazia', 'saida')

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

    await declararInterna(usuario, 'entrada')
    await declararInterna(usuario, 'saida')

    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 1, coluna 1, vazia', 'entrada')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 1, coluna 8, vazia', 'saida')

    const final = ultimoDiagrama(aoMudar)
    expect(normalizarIds(final)).toEqual(normalizarIds(MINIMAL))
    expect(validarDiagrama(final)).toEqual([])
  })
})

describe('EditorLadder — CA-5: recusa não altera o diagrama e mostra o motivo', () => {
  it('soltar bobina na coluna 1: alerta abaixo do degrau, célula aria-invalid, diagrama intacto, modal não abre', () => {
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), celula1)

    expect(screen.getByRole('alert')).toHaveTextContent(/posição inválida/i)
    expect(celula1).toHaveAttribute('aria-invalid', 'true')
    expect(aoMudar).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })
})

describe('EditorLadder — prévia durante o arrasto (plano D-11/D-12)', () => {
  it('arrastar NA da paleta sobre célula vazia mostra prévia de inserir, sem alterar o diagrama', () => {
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    const itemNA = screen.getByRole('button', { name: /^contato na$/i })
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    fireEvent.pointerDown(itemNA, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerEnter(celula, { pointerId: 1 })

    expect(celula).toHaveAttribute('data-previa', 'inserir')
    expect(aoMudar).not.toHaveBeenCalled()

    fireEvent.pointerUp(window, { pointerId: 1 })
  })

  it('arrastar bobina sobre a coluna 1 mostra prévia inválida com o motivo do núcleo', () => {
    render(<EditorLadder />)

    const itemBobina = screen.getByRole('button', { name: /^bobina$/i })
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    fireEvent.pointerDown(itemBobina, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerEnter(celula, { pointerId: 1 })

    expect(celula).toHaveAttribute('data-previa', 'invalida')
    expect(celula.querySelector('title')).toHaveTextContent(/posição inválida/i)

    fireEvent.pointerUp(window, { pointerId: 1 })
  })
})

describe('EditorLadder — mover elemento por arrasto', () => {
  it('move elemento de uma célula para outra, no mesmo degrau', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const destino = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    arrastar(origem, destino)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 3, contato NA sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('mover para posição inválida recusa e mantém o elemento na origem', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const destinoInvalido = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })
    arrastar(origem, destinoInvalido)

    expect(screen.getByRole('alert')).toHaveTextContent(/posição inválida/i)
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toBeInTheDocument()
  })
})

describe('EditorLadder — remover elemento', () => {
  it('arrastar até a lixeira remove o elemento', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    arrastar(origem, lixeira)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('marcar e acionar a lixeira remove o elemento', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }))
    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('marcar e pressionar Delete remove o elemento', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    await usuario.click(celula)
    await usuario.keyboard('{Delete}')

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('arrastar item novo da paleta até a lixeira cancela, sem criar elemento', () => {
    render(<EditorLadder />)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), lixeira)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('EditorLadder — marcação por clique', () => {
  it('clique marca (aria-selected) e clique fora da grade desmarca', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    await usuario.click(celula)
    expect(celula).toHaveAttribute('aria-selected', 'true')

    fireEvent.pointerDown(document.body)
    expect(celula).toHaveAttribute('aria-selected', 'false')
  })

  it('clique em célula vazia não marca nada', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' }))

    for (const celula of screen.getAllByRole('button', { name: /^Degrau/ })) {
      expect(celula).toHaveAttribute('aria-selected', 'false')
    }
  })

  it('Esc desmarca', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    await usuario.click(celula)
    expect(celula).toHaveAttribute('aria-selected', 'true')

    await usuario.keyboard('{Escape}')
    expect(celula).toHaveAttribute('aria-selected', 'false')
  })
})

describe('EditorLadder — abrir o modal', () => {
  it('duplo clique num elemento abre o modal', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    await usuario.dblClick(celula)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Enter com foco no elemento abre o modal', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    celula.focus()
    await usuario.keyboard('{Enter}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Esc fecha o modal e devolve o foco ao elemento', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    // o modal já abre sozinho ao soltar um item novo com sucesso
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toHaveFocus()
  })
})

describe('EditorLadder — arrasto por teclado, de ponta a ponta (sem ponteiro)', () => {
  it('pega o item na paleta com Espaço, move com as setas, solta com Espaço e escolhe a variável no modal', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<EditorLadder aoMudar={aoMudar} />)

    await declararInterna(usuario, 'entrada')

    const itemNA = screen.getByRole('button', { name: /^contato na$/i })
    itemNA.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowRight}{ArrowRight}')
    await usuario.keyboard(' ')

    const dialogo = screen.getByRole('dialog')
    await usuario.click(within(dialogo).getByRole('button', { name: /entrada/i }))

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toHaveLength(1)
    expect(final.rungs[0].elementos[0]).toMatchObject({
      tipo: 'contato_na',
      celula: { linha: 0, coluna: 2 },
      variavel: 'entrada',
    })
  })
})

describe('EditorLadder — recusa na tabela de variáveis', () => {
  it('declarar variável com nome já usado mostra o erro dentro da tabela', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await declararInterna(usuario, 'entrada')
    await declararInterna(usuario, 'entrada')

    const tabela = screen.getByRole('region', { name: 'Variáveis' })
    expect(within(tabela).getByRole('alert')).toHaveTextContent(/já existe uma variável/i)
  })
})



/**
 * Bug real encontrado pelo orquestrador em Chromium (Playwright, `vite
 * preview`), fora do alcance do jsdom. A hipótese inicial ("perde-se o
 * pointerenter no alvo") estava ERRADA — descartada pelo próprio orquestrador
 * com log de eventos no navegador. Causa real, isolada pela sequência de
 * eventos observada (`pointerdown, pointermove, pointermove, pointercancel`):
 * sem `preventDefault` no `pointerdown` das origens, a página acumula
 * seleção de texto entre interações; no gesto seguinte, mover o mouse com o
 * botão pressionado sobre essa seleção faz o Chromium iniciar um drag nativo
 * de conteúdo, e o navegador cancela o ponteiro (`pointercancel`) para ceder
 * o gesto a esse drag nativo — o app nunca chega a ver um arrasto de verdade.
 *
 * jsdom não simula "o usuário selecionou texto, então o Chromium decide
 * iniciar um drag nativo" — não há hit-testing nem heurística de seleção
 * disparando eventos por conta própria. Por isso os testes abaixo não
 * reproduzem o bug ponta a ponta; verificam, de forma fiel e diretamente
 * testável, os dois lados da correção: (1) `armarPonteiro` chama
 * `preventDefault` no `pointerdown` das origens (o que impede o Chromium de
 * sequer começar a formar a seleção/drag nativo), e (2) `pointercancel` —
 * que continua podendo acontecer por outros motivos — zera o estado do
 * arrasto de forma limpa, sem deixar o próximo gesto inutilizável.
 */
describe('EditorLadder — bug real (Chromium): drag nativo de conteúdo cancelava o ponteiro', () => {
  it('pointerdown num item da paleta chama preventDefault (dispatchEvent devolve false)', () => {
    render(<EditorLadder />)

    const item = screen.getByRole('button', { name: /^contato na$/i })
    const naoPrevenido = fireEvent.pointerDown(item, { pointerId: 1, clientX: 0, clientY: 0 })

    expect(naoPrevenido).toBe(false)
  })

  it('pointerdown num elemento existente na grade também chama preventDefault', () => {
    render(<EditorLadder />)

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })

    const naoPrevenido = fireEvent.pointerDown(celula, { pointerId: 2, clientX: 0, clientY: 0 })

    expect(naoPrevenido).toBe(false)
  })

  it('pointerdown numa célula vazia não arma nada, então não precisa prevenir', () => {
    render(<EditorLadder />)

    const celulaVazia = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    const naoPrevenido = fireEvent.pointerDown(celulaVazia, { pointerId: 3, clientX: 0, clientY: 0 })

    expect(naoPrevenido).toBe(true)
  })

  it('itens da paleta, células da grade e a lixeira desligam seleção de texto e touch-action (select-none/touch-none)', () => {
    render(<EditorLadder />)

    const item = screen.getByRole('button', { name: /^contato na$/i })
    expect(item.className).toMatch(/\bselect-none\b/)
    expect(item.className).toMatch(/\btouch-none\b/)

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    expect(celula.getAttribute('class') ?? '').toMatch(/\bselect-none\b/)
    expect(celula.getAttribute('class') ?? '').toMatch(/\btouch-none\b/)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    expect(lixeira.className).toMatch(/\bselect-none\b/)
    expect(lixeira.className).toMatch(/\btouch-none\b/)
  })

  it('pointercancel no meio do arrasto zera o estado (sem prévia, sem alerta, sem modal), e o próximo arrasto funciona', () => {
    render(<EditorLadder />)

    const itemNA = screen.getByRole('button', { name: /^contato na$/i })
    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    fireEvent.pointerDown(itemNA, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerEnter(celula1, { pointerId: 1 })
    expect(celula1).toHaveAttribute('data-previa', 'inserir')

    fireEvent.pointerCancel(window, { pointerId: 1 })

    expect(celula1).not.toHaveAttribute('data-previa')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // um arrasto novo, do zero (mesmo pointerId reaproveitado, como um mouse real faria), funciona normalmente.
    arrastar(itemNA, celula1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('EditorLadder — cobertura adicional depois do ciclo modal', () => {
  it('depois de uma recusa, um novo arrasto (com pointerenter) funciona normalmente', () => {
    render(<EditorLadder />)

    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), celula1)
    expect(screen.getByRole('alert')).toHaveTextContent(/posição inválida/i)

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), celula1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('mover célula -> célula depois do modal continua funcionando', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const destino = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    arrastar(origem, destino)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 3, contato NA sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('arrasto por teclado depois do modal continua funcionando', async () => {
    const usuario = userEvent.setup()
    render(<EditorLadder />)

    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 1, coluna 1, vazia', null)

    const itemBobina = screen.getByRole('button', { name: /^bobina$/i })
    itemBobina.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowRight}'.repeat(7))
    await usuario.keyboard(' ')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sem variável' }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
  })
})
