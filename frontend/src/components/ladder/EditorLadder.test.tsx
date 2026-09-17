import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { diagramaVazio } from '../../ladder/edicao'
import { IO_ESPELHO, MINIMAL } from '../../ladder/fixtures'
import type { Diagrama, Elemento, Variavel } from '../../ladder/modelo'
import { validarDiagrama, type Problema } from '../../ladder/validacao'
import EditorLadder from './EditorLadder'

/** Harness de teste (sugerido pelo plano da tarefa #23): `EditorLadder` é
 * controlado — este componente guarda o `diagrama` em `useState`, repassa
 * `aoMudar` e também avisa um espião, para os testes lerem o último
 * diagrama sem reimplementar a lógica de estado do editor. */
function Harness({ inicial, espiao }: { inicial: Diagrama; espiao: (d: Diagrama) => void }) {
  const [diagrama, setDiagrama] = useState(inicial)
  function aoMudar(novo: Diagrama) {
    setDiagrama(novo)
    espiao(novo)
  }
  return <EditorLadder diagrama={diagrama} aoMudar={aoMudar} />
}

function renderEditor(inicial: Diagrama = diagramaVazio()) {
  const aoMudar = vi.fn()
  render(<Harness inicial={inicial} espiao={aoMudar} />)
  return { aoMudar }
}

/** Diagrama de partida com variáveis já declaradas e nenhum elemento — a
 * criação de variável pela UI (tabela/painel) é responsabilidade da frente
 * que monta a IDE (`PainelVariaveis`), fora deste componente (plano §23). */
function diagramaComVariaveis(variaveis: Variavel[]): Diagrama {
  return { versao: 1, variaveis, rungs: [{ id: 'r1', elementos: [], ramos: [] }] }
}

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

/** Última chamada de um `vi.fn()` usado como espião de `aoMudar`. */
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

/** Prefixo comum de uma célula ("Degrau 1, coluna 1"), a partir do rótulo de
 * quando ela ainda estava vazia — usado para reencontrar a célula depois que
 * um elemento é inserido nela (o rótulo muda de "...vazia" para o tipo). */
function prefixoCelula(rotuloCelulaVazia: string): string {
  return rotuloCelulaVazia.replace(/, vazia$/, '')
}

function escapeRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function celulaPorPrefixo(prefixo: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${escapeRegExp(prefixo)},`) })
}

/**
 * Arrasta um item novo da paleta até uma célula vazia (D-13: fica marcado,
 * sem abrir o modal), clica de novo — segundo clique, no item já marcado —
 * para abrir `ModalVariavel`, e escolhe a variável.
 */
async function arrastarEEscolher(usuario: ReturnType<typeof userEvent.setup>, rotuloItem: RegExp, rotuloCelulaVazia: string, nomeVariavel: string | null) {
  arrastar(screen.getByRole('button', { name: rotuloItem }), screen.getByRole('button', { name: rotuloCelulaVazia }))

  const celula = celulaPorPrefixo(prefixoCelula(rotuloCelulaVazia))
  expect(celula).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await usuario.click(celula)
  const dialogo = screen.getByRole('dialog')
  const rotuloOpcao = nomeVariavel === null ? 'Sem variável' : new RegExp(nomeVariavel, 'i')
  await usuario.click(within(dialogo).getByRole('button', { name: rotuloOpcao }))
}

describe('EditorLadder — CA-1: espelho direto (IO_ESPELHO) construído só pela UI', () => {
  it('NA %IX0.1 -> bobina %QX0.1 resulta na fixture, sem problemas', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComVariaveis(IO_ESPELHO.variaveis))

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
    const { aoMudar } = renderEditor(diagramaComVariaveis(MINIMAL.variaveis))

    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 1, coluna 1, vazia', 'entrada')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 1, coluna 8, vazia', 'saida')

    const final = ultimoDiagrama(aoMudar)
    expect(normalizarIds(final)).toEqual(normalizarIds(MINIMAL))
    expect(validarDiagrama(final)).toEqual([])
  })
})

describe('EditorLadder — CA-5: recusa não altera o diagrama e mostra o motivo', () => {
  it('soltar bobina na coluna 1: alerta abaixo do degrau, célula aria-invalid, diagrama intacto, modal não abre', () => {
    const { aoMudar } = renderEditor()

    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), celula1)

    expect(screen.getByRole('alert')).toHaveTextContent(/posição inválida/i)
    expect(celula1).toHaveAttribute('aria-invalid', 'true')
    expect(aoMudar).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })
})

describe('EditorLadder — segundo clique (D-13)', () => {
  it('soltar item novo marca o elemento e NÃO abre o modal', () => {
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    expect(celula).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clique em item não marcado marca; clique de novo (já marcado) abre o modal', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    // desmarca (clicando fora) para testar o primeiro clique de marcação isoladamente
    fireEvent.pointerDown(document.body)
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    expect(celula).toHaveAttribute('aria-selected', 'false')

    await usuario.click(celula)
    expect(celula).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(celula)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Enter com foco no item marcado abre o modal', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    celula.focus()

    await usuario.keyboard('{Enter}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Enter num item ainda não marcado só marca (paridade com o clique)', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    fireEvent.pointerDown(document.body)
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    expect(celula).toHaveAttribute('aria-selected', 'false')
    celula.focus()

    await usuario.keyboard('{Enter}')

    expect(celula).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('duplo clique continua abrindo (é o segundo clique rápido)', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    fireEvent.pointerDown(document.body)
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })

    await usuario.dblClick(celula)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('EditorLadder — prévia durante o arrasto (plano D-11/D-12)', () => {
  it('arrastar NA da paleta sobre célula vazia mostra prévia de inserir, sem alterar o diagrama', () => {
    const { aoMudar } = renderEditor()

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
    renderEditor()

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
    renderEditor()

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const destino = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    arrastar(origem, destino)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 3, contato NA sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('mover para posição inválida recusa e mantém o elemento na origem', async () => {
    const usuario = userEvent.setup()
    renderEditor()

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
    renderEditor()

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    arrastar(origem, lixeira)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('marcar e acionar a lixeira remove o elemento', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    // arrastarEEscolher deixa o elemento marcado (a escolha no modal não desmarca)
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toHaveAttribute('aria-selected', 'true')

    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('marcar e pressionar Delete remove o elemento', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    // arrastarEEscolher deixa o elemento marcado e com foco (a escolha no modal devolve o foco à célula)
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    await usuario.keyboard('{Delete}')

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('arrastar item novo da paleta até a lixeira cancela, sem criar elemento', () => {
    renderEditor()

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), lixeira)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('EditorLadder — marcação por clique', () => {
  it('clique marca (aria-selected) e clique fora da grade desmarca', () => {
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    expect(celula).toHaveAttribute('aria-selected', 'true')

    fireEvent.pointerDown(document.body)
    expect(celula).toHaveAttribute('aria-selected', 'false')
  })

  it('clique em célula vazia não marca nada', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' }))

    for (const celula of screen.getAllByRole('button', { name: /^Degrau/ })) {
      expect(celula).toHaveAttribute('aria-selected', 'false')
    }
  })

  it('Esc desmarca', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    expect(celula).toHaveAttribute('aria-selected', 'true')

    // Esc é tratado pelo container (captura o evento a partir do foco dentro
    // dele) — o arrasto só move o foco por si; aqui focamos programaticamente
    // para isolar o comportamento de Esc do de clique (que abriria o modal,
    // já que o item está marcado pelo drop).
    celula.focus()
    await usuario.keyboard('{Escape}')
    expect(celula).toHaveAttribute('aria-selected', 'false')
  })
})

describe('EditorLadder — abrir o modal', () => {
  it('Esc fecha o modal e devolve o foco ao elemento', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)
    // reabre o modal com o segundo clique
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    await usuario.click(celula)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toHaveFocus()
  })
})

describe('EditorLadder — arrasto por teclado, de ponta a ponta (sem ponteiro)', () => {
  it('pega o item na paleta com Espaço, move com as setas e solta com Espaço: marca sem abrir modal; Enter abre e escolhe a variável', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComVariaveis([{ nome: 'entrada', tipo: 'BOOL' }]))

    const itemNA = screen.getByRole('button', { name: /^contato na$/i })
    itemNA.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowRight}{ArrowRight}')
    await usuario.keyboard(' ')

    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 3, contato NA sem variável' })
    expect(celula).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.keyboard('{Enter}')
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

describe('EditorLadder — controlado (D-13): reage a mudanças externas de diagrama', () => {
  it('exibe o diagrama recebido por prop, sem estado interno próprio', () => {
    renderEditor(MINIMAL)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NF entrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina saida' })).toBeInTheDocument()
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
    renderEditor()

    const item = screen.getByRole('button', { name: /^contato na$/i })
    const naoPrevenido = fireEvent.pointerDown(item, { pointerId: 1, clientX: 0, clientY: 0 })

    expect(naoPrevenido).toBe(false)
  })

  it('pointerdown num elemento existente na grade também chama preventDefault', () => {
    renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })

    const naoPrevenido = fireEvent.pointerDown(celula, { pointerId: 2, clientX: 0, clientY: 0 })

    expect(naoPrevenido).toBe(false)
  })

  it('pointerdown numa célula vazia não arma nada, então não precisa prevenir', () => {
    renderEditor()

    const celulaVazia = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    const naoPrevenido = fireEvent.pointerDown(celulaVazia, { pointerId: 3, clientX: 0, clientY: 0 })

    expect(naoPrevenido).toBe(true)
  })

  it('itens da paleta, células da grade e a lixeira desligam seleção de texto e touch-action (select-none/touch-none)', () => {
    renderEditor()

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
    renderEditor()

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
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('EditorLadder — cobertura adicional depois do ciclo modal', () => {
  it('depois de uma recusa, um novo arrasto (com pointerenter) funciona normalmente', () => {
    renderEditor()

    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), celula1)
    expect(screen.getByRole('alert')).toHaveTextContent(/posição inválida/i)

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), celula1)
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toHaveAttribute('aria-selected', 'true')
  })

  it('mover célula -> célula depois do modal continua funcionando', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const destino = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    arrastar(origem, destino)

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 3, contato NA sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('arrasto por teclado depois do modal continua funcionando', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 1, coluna 1, vazia', null)

    const itemBobina = screen.getByRole('button', { name: /^bobina$/i })
    itemBobina.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowRight}'.repeat(7))
    await usuario.keyboard(' ')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const celulaBobina = screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })
    expect(celulaBobina).toHaveAttribute('aria-selected', 'true')

    await usuario.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sem variável' }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
  })
})

describe('EditorLadder — sem cores fixas (D-13)', () => {
  it('nenhuma classe de cor fixa (só tokens ide-*) na árvore renderizada', () => {
    const { container } = render(<Harness inicial={IO_ESPELHO} espiao={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})

/** Diagrama de partida com um ramo já criado (linha 1, colunas 1–3,
 * 1-based) e sem elementos — usado pelos testes de D-14 que não precisam
 * repetir a criação do ramo por arrasto. */
function diagramaComRamo(): Diagrama {
  return {
    versao: 1,
    variaveis: [],
    rungs: [{ id: 'r1', elementos: [], ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }] }],
  }
}

describe('EditorLadder — criar ramo por arrasto (tarefa #24, D-14)', () => {
  it('arrastar "Ramo" até uma célula do trilho principal mostra a prévia do ramo fantasma e cria o ramo ao soltar', () => {
    const { aoMudar } = renderEditor()

    const itemRamo = screen.getByRole('button', { name: /^ramo$/i })
    const celulaAlvo = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    fireEvent.pointerDown(itemRamo, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerEnter(celulaAlvo, { pointerId: 1 })

    // prévia: o ramo fantasma nasceria na linha 1 (primeira livre), coluna 1
    expect(document.querySelector('[data-ramo-fantasma="1:0:0"]')).not.toBeNull()
    expect(aoMudar).not.toHaveBeenCalled()

    fireEvent.pointerUp(window, { pointerId: 1 })

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }])
    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('soltar "Ramo" na coluna terminal (reservada a bobinas) é recusado, com o motivo do núcleo', () => {
    const { aoMudar } = renderEditor()

    arrastar(screen.getByRole('button', { name: /^ramo$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/ramo só cobre colunas de contato/i)
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('arrastar "Ramo" até a lixeira cancela, sem criar ramo nenhum', () => {
    const { aoMudar } = renderEditor()

    arrastar(screen.getByRole('button', { name: /^ramo$/i }), screen.getByRole('button', { name: /lixeira/i }))

    expect(aoMudar).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /ramo 1/i })).not.toBeInTheDocument()
  })
})

describe('EditorLadder — contatos dentro do ramo (D-14)', () => {
  it('soltar um contato numa célula do ramo insere o elemento lá dentro', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComRamo())

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, ramo 1, coluna 2, vazia', null)

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toEqual([{ id: 'e1', tipo: 'contato_na', celula: { linha: 1, coluna: 1 }, variavel: null }])
  })
})

describe('EditorLadder — alça do ramo: esticar e encolher (D-14)', () => {
  it('arrasto por ponteiro: soltar numa coluna maior estica o ramo (redimensionarRamo aplicado)', () => {
    const { aoMudar } = renderEditor(diagramaComRamo())

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 330, clientY: 0 })

    const final = ultimoDiagrama(aoMudar)
    // coluna sob clientX=330: floor((330-32)/64) = 4
    expect(final.rungs[0].ramos[0]).toMatchObject({ colunaInicio: 0, colunaFim: 4 })
  })

  it('arrasto por ponteiro: soltar numa coluna menor encolhe o ramo', () => {
    const { aoMudar } = renderEditor(diagramaComRamo())

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 60, clientY: 0 })

    const final = ultimoDiagrama(aoMudar)
    // coluna sob clientX=60: floor((60-32)/64) = 0
    expect(final.rungs[0].ramos[0]).toMatchObject({ colunaInicio: 0, colunaFim: 0 })
  })

  it('encolher deixando um contato fora do novo intervalo é recusado, e o diagrama não muda', () => {
    const diagrama = diagramaComRamo()
    diagrama.rungs[0].elementos.push({ id: 'e9', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: null })
    const { aoMudar } = renderEditor(diagrama)

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 60, clientY: 0 }) // coluna 0; contato está na coluna 2

    expect(screen.getByRole('alert')).toHaveTextContent(/fora do novo intervalo/i)
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('teclado: Espaço pega a alça, setas esticam, Espaço aplica', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComRamo())

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    alca.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowRight}{ArrowRight}')
    await usuario.keyboard(' ')

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].ramos[0]).toMatchObject({ colunaInicio: 0, colunaFim: 4 })
  })

  it('teclado: Esc cancela o redimensionamento em curso sem alterar o diagrama', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComRamo())

    const alca = screen.getByRole('slider', { name: /estender ramo 1/i })
    alca.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowLeft}')
    await usuario.keyboard('{Escape}')

    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('EditorLadder — marcar e remover ramo (D-14)', () => {
  it('clique numa célula vazia do ramo marca o ramo (aria-selected)', () => {
    renderEditor(diagramaComRamo())

    const celula = screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' })
    fireEvent.click(celula)

    expect(celula).toHaveAttribute('aria-selected', 'true')
  })

  it('ramo marcado + Delete remove o ramo vazio', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComRamo())

    const celula = screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' })
    fireEvent.click(celula)
    celula.focus()
    await usuario.keyboard('{Delete}')

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].ramos).toEqual([])
  })

  it('ramo marcado + lixeira remove o ramo vazio', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComRamo())

    fireEvent.click(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' }))
    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].ramos).toEqual([])
  })

  it('remover um ramo com contato dentro é recusado, e o diagrama não muda', async () => {
    const usuario = userEvent.setup()
    const diagrama = diagramaComRamo()
    diagrama.rungs[0].elementos.push({ id: 'e9', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: null })
    const { aoMudar } = renderEditor(diagrama)

    fireEvent.click(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' }))
    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/remova os contatos do ramo antes/i)
    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('EditorLadder — contato de selo pela UI (tarefa #24)', () => {
  it('NA partida (col.1) + Ramo (col.1) com NA motor dentro + NF parada (col.2) + bobina motor (col.8) => ramo colunaFim=0, sem erro de validação', async () => {
    const usuario = userEvent.setup()
    const variaveis: Variavel[] = [
      { nome: 'partida', tipo: 'BOOL', endereco: '%IX0.0' },
      { nome: 'parada', tipo: 'BOOL', endereco: '%IX0.1' },
      { nome: 'motor', tipo: 'BOOL', endereco: '%QX0.0' },
    ]
    const { aoMudar } = renderEditor(diagramaComVariaveis(variaveis))

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', 'partida')

    arrastar(screen.getByRole('button', { name: /^ramo$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA partida' }))

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, ramo 1, coluna 1, vazia', 'motor')
    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 1, coluna 2, vazia', 'parada')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 1, coluna 8, vazia', 'motor')

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }])
    expect(validarDiagrama(final)).toEqual([])
  })
})

describe('EditorLadder — CA-6: vários degraus (tarefa #10)', () => {
  it('inserir um segundo degrau permite editar os dois independentemente; remover um preserva o outro', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Inserir degrau' }))
    expect(ultimoDiagrama(aoMudar).rungs).toHaveLength(2)

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toBeInTheDocument()

    arrastar(screen.getByRole('button', { name: /^bobina$/i }), screen.getByRole('button', { name: 'Degrau 2, coluna 8, vazia' }))
    expect(screen.getByRole('button', { name: 'Degrau 2, coluna 8, bobina sem variável' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs).toHaveLength(1)
    expect(final.rungs[0].elementos).toHaveLength(1)
    expect(final.rungs[0].elementos[0].tipo).toBe('bobina')
    // o degrau que restou (era o 2º) passa a ser o único, "Degrau 1"
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
  })

  it('"Inserir degrau abaixo" no cabeçalho insere logo depois daquele degrau', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Inserir degrau abaixo do degrau 1' }))

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Degrau 2, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('recusa remover o último degrau, sem alterar o diagrama, e mostra o motivo no alerta existente', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos um degrau/i)
    expect(aoMudar).not.toHaveBeenCalled()
    // o único degrau continua lá, intacto
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
  })

  it('remover o degrau com o elemento marcado limpa a marcação', async () => {
    const usuario = userEvent.setup()
    renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Inserir degrau' }))
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const elemento = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    expect(elemento).toHaveAttribute('aria-selected', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    // o elemento marcado foi embora junto com o degrau; nenhuma célula do que restou continua marcada
    const celulasRestantes = screen.getAllByRole('button', { name: /^Degrau 1,/ })
    for (const celula of celulasRestantes) {
      expect(celula).toHaveAttribute('aria-selected', 'false')
    }
  })
})

describe('EditorLadder — CA-7: mover elemento entre degraus pelo teclado (tarefa #10)', () => {
  it('ArrowDown durante o arrasto por teclado atravessa para o degrau vizinho, e soltar move o elemento para lá', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Inserir degrau' }))
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })

    origem.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowDown}')
    await usuario.keyboard(' ')

    expect(screen.getByRole('button', { name: 'Degrau 2, coluna 1, contato NA sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toHaveLength(0)
    expect(final.rungs[1].elementos).toHaveLength(1)
  })

  it('ArrowUp devolve o alvo ao degrau anterior', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Inserir degrau' }))
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), screen.getByRole('button', { name: 'Degrau 2, coluna 8, vazia' }))
    const origem = screen.getByRole('button', { name: 'Degrau 2, coluna 8, bobina sem variável' })

    origem.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowUp}')
    await usuario.keyboard(' ')

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 2, coluna 8, vazia' })).toBeInTheDocument()

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toHaveLength(1)
    expect(final.rungs[1].elementos).toHaveLength(0)
  })
})

describe('EditorLadder — problemas na grade, repassados por degrau (tarefa #13)', () => {
  it('CA-9: duas bobinas simples com a mesma variável mostram erro nas duas células', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [{ nome: 'x', tipo: 'BOOL' }],
      rungs: [
        { id: 'r1', elementos: [{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: 'x' }], ramos: [] },
        { id: 'r2', elementos: [{ id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: 'x' }], ramos: [] },
      ],
    }
    const problemas = validarDiagrama(diagrama)
    render(<EditorLadder diagrama={diagrama} aoMudar={() => {}} problemas={problemas} />)

    const celula1 = screen.getByRole('button', { name: /^Degrau 1, coluna 8, bobina x, erro:/ })
    const celula2 = screen.getByRole('button', { name: /^Degrau 2, coluna 8, bobina x, erro:/ })
    expect(celula1).toHaveAttribute('data-problema', 'erro')
    expect(celula2).toHaveAttribute('data-problema', 'erro')
  })

  it('um aviso passado à mão é visualmente distinto do erro (aria-label e ícone diferentes)', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [{ nome: 'x', tipo: 'BOOL' }],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'bobina_set', celula: { linha: 0, coluna: 7 }, variavel: 'x' }], ramos: [] }],
    }
    const problemas: Problema[] = [
      {
        codigo: 'set_reset_autodependente',
        severidade: 'aviso',
        rungId: 'r1',
        elementoId: 'e1',
        mensagem: "depende da própria variável 'x'",
      },
    ]
    render(<EditorLadder diagrama={diagrama} aoMudar={() => {}} problemas={problemas} />)

    const celula = screen.getByRole('button', { name: /aviso: depende da própria variável 'x'/i })
    expect(celula).toHaveAttribute('data-problema', 'aviso')
    expect(screen.queryByRole('button', { name: /erro:/i })).not.toBeInTheDocument()
  })

  it('rung_incompleto (contato sem bobina) marca o cabeçalho do degrau, visível e sem alterar a marcação de outras células', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: null }], ramos: [] }],
    }
    const problemas = validarDiagrama(diagrama)
    expect(problemas.some((p) => p.codigo === 'rung_incompleto')).toBe(true)

    render(<EditorLadder diagrama={diagrama} aoMudar={() => {}} problemas={problemas} />)

    expect(screen.getByText(/sem nenhuma bobina/i)).toBeInTheDocument()
  })
})

describe('EditorLadder — foco programático (contrato com quem monta a IDE)', () => {
  function HarnessFoco({ inicial }: { inicial: Diagrama }) {
    const [diagrama, setDiagrama] = useState(inicial)
    const [foco, setFoco] = useState<{ rungId: string; elementoId: string | null; token: number } | null>(null)
    return (
      <div>
        <button type="button" onClick={() => setFoco((atual) => ({ rungId: 'r1', elementoId: 'e1', token: (atual?.token ?? 0) + 1 }))}>
          focar elemento
        </button>
        <button type="button" onClick={() => setFoco((atual) => ({ rungId: 'r1', elementoId: null, token: (atual?.token ?? 0) + 1 }))}>
          focar degrau
        </button>
        <EditorLadder diagrama={diagrama} aoMudar={setDiagrama} foco={foco} />
      </div>
    )
  }

  it('mudar foco.token leva o foco à célula do elemento pedido', async () => {
    const usuario = userEvent.setup()
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 3 }, variavel: null }], ramos: [] }],
    }
    render(<HarnessFoco inicial={diagrama} />)

    await usuario.click(screen.getByRole('button', { name: 'focar elemento' }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Degrau 1, coluna 4, contato NA sem variável' }))
  })

  it('elementoId null leva o foco à primeira célula do degrau', async () => {
    const usuario = userEvent.setup()
    render(<HarnessFoco inicial={diagramaVazio()} />)

    await usuario.click(screen.getByRole('button', { name: 'focar degrau' }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
  })

  it('um segundo clique com token diferente refoca mesmo alvo (o efeito roda de novo)', async () => {
    const usuario = userEvent.setup()
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 3 }, variavel: null }], ramos: [] }],
    }
    render(<HarnessFoco inicial={diagrama} />)

    await usuario.click(screen.getByRole('button', { name: 'focar elemento' }))
    const celula = screen.getByRole('button', { name: 'Degrau 1, coluna 4, contato NA sem variável' })
    expect(document.activeElement).toBe(celula)

    // move o foco para outro lugar, então pede o mesmo elemento de novo (token muda)
    celula.blur()
    document.body.focus()
    await usuario.click(screen.getByRole('button', { name: 'focar elemento' }))

    expect(document.activeElement).toBe(celula)
  })
})
