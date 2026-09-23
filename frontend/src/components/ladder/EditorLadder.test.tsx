import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { diagramaVazio } from '../../ladder/edicao'
import { BLINK, IO_ESPELHO, MINIMAL } from '../../ladder/fixtures'
import type { Diagrama, Elemento, Variavel } from '../../ladder/modelo'
import type { EnergizacaoDegrau } from '../../ladder/simulacao'
import { validarDiagrama, type Problema } from '../../ladder/validacao'
import EditorLadder from './EditorLadder'

/** Harness de teste (sugerido pelo plano da tarefa #23): `EditorLadder` é
 * controlado — este componente guarda o `diagrama` em `useState`, repassa
 * `aoMudar` e também avisa um espião, para os testes lerem o último
 * diagrama sem reimplementar a lógica de estado do editor. */
function Harness({
  inicial,
  espiao,
  aoRecusar,
}: {
  inicial: Diagrama
  espiao: (d: Diagrama) => void
  aoRecusar?: (motivo: string) => void
}) {
  const [diagrama, setDiagrama] = useState(inicial)
  function aoMudar(novo: Diagrama) {
    setDiagrama(novo)
    espiao(novo)
  }
  return <EditorLadder diagrama={diagrama} aoMudar={aoMudar} aoRecusar={aoRecusar} />
}

function renderEditor(inicial: Diagrama = diagramaVazio()) {
  const aoMudar = vi.fn()
  const aoRecusar = vi.fn()
  render(<Harness inicial={inicial} espiao={aoMudar} aoRecusar={aoRecusar} />)
  return { aoMudar, aoRecusar }
}

async function confirmarRemocaoDegrau(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: /^remover$/i }))
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
  // `\b` nos dois lados: sem isso, escolher "led" também bateria com a opção
  // "led_estava_aceso" (usada pelo BLINK, CA-3) — as duas começam com "led",
  // mas só a primeira tem fronteira de palavra depois do "d".
  const valor = nomeVariavel === null ? '__sem-variavel__' : nomeVariavel
  await usuario.selectOptions(within(dialogo).getByRole('combobox'), valor)
  await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
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

describe('EditorLadder — CA-5 (refeita, tarefa #25): recusa não altera o diagrama, chama aoRecusar, sem texto no DOM', () => {
  it('soltar contato na coluna 8 (reservada a bobinas): aoRecusar com o motivo, célula aria-invalid, diagrama intacto, modal não abre, sem role="alert" nem o texto do motivo', () => {
    const { aoMudar, aoRecusar } = renderEditor()

    const celula8 = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), celula8)

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/posição inválida/i))
    expect(celula8).toHaveAttribute('aria-invalid', 'true')
    expect(aoMudar).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const [[motivo]] = aoRecusar.mock.calls
    expect(screen.queryByText(motivo)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })).toBeInTheDocument()
  })

  it('segunda bobina sem ramo de saída: recusa (célula terminal da linha 0 ocupada)', () => {
    const diagramaComBobina: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }], ramos: [] }],
    }
    const { aoMudar, aoRecusar } = renderEditor(diagramaComBobina)

    const alvo = screen.getByRole('button', { name: 'Degrau 1, coluna 4, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), alvo)

    expect(aoRecusar).toHaveBeenCalled()
    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('EditorLadder — nova variável pelo elemento (revisão 2026-09-23)', () => {
  it('declara e vincula numa única mudança do diagrama', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const chamadasAntes = aoMudar.mock.calls.length
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }))
    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))

    const criacao = screen.getByRole('dialog', { name: 'Nova variável' })
    await usuario.type(within(criacao).getByLabelText('Nome'), 'liga')
    await usuario.click(within(criacao).getByRole('button', { name: 'Criar e vincular' }))

    expect(aoMudar.mock.calls.length).toBe(chamadasAntes + 1)
    const final = ultimoDiagrama(aoMudar)
    expect(final.variaveis).toEqual([{ nome: 'liga', tipo: 'BOOL', endereco: '%IX0.0' }])
    expect(final.rungs[0].elementos[0]).toMatchObject({ tipo: 'contato_na', variavel: 'liga' })
    expect(within(screen.getByRole('dialog', { name: /propriedades do elemento/i })).getByRole('combobox')).toHaveValue('liga')
  })

  it('nome repetido: recusa no modal de criação e o diagrama não muda', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComVariaveis([{ nome: 'liga', tipo: 'BOOL' }]))

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const chamadasAntes = aoMudar.mock.calls.length
    await usuario.click(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' }))
    await usuario.click(screen.getByRole('button', { name: /nova variável/i }))

    const criacao = screen.getByRole('dialog', { name: 'Nova variável' })
    await usuario.type(within(criacao).getByLabelText('Nome'), 'liga')
    await usuario.click(within(criacao).getByRole('button', { name: 'Criar e vincular' }))

    expect(within(criacao).getByText("já existe uma variável chamada 'liga'")).toBeInTheDocument()
    expect(aoMudar.mock.calls.length).toBe(chamadasAntes)
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

  it('arrastar bobina sobre a coluna 1 (célula qualquer) mostra a prévia na coluna 8, não na coluna sob o cursor (tarefa #25)', () => {
    renderEditor()

    const itemBobina = screen.getByRole('button', { name: /^bobina$/i })
    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    const celula8 = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })

    fireEvent.pointerDown(itemBobina, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerEnter(celula1, { pointerId: 1 })

    expect(celula1).not.toHaveAttribute('data-previa')
    expect(celula8).toHaveAttribute('data-previa', 'inserir')

    fireEvent.pointerUp(window, { pointerId: 1 })
  })

  it('arrastar bobina sobre coluna 1 com a coluna 8 já ocupada mostra prévia inválida na coluna 8', () => {
    const diagramaComBobina: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }], ramos: [] }],
    }
    renderEditor(diagramaComBobina)

    const itemBobina = screen.getByRole('button', { name: /^bobina$/i })
    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    const celula8 = screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })

    fireEvent.pointerDown(itemBobina, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerEnter(celula1, { pointerId: 1 })

    expect(celula8).toHaveAttribute('data-previa', 'invalida')

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

  it('mover para posição inválida recusa (aoRecusar) e mantém o elemento na origem', async () => {
    const usuario = userEvent.setup()
    const { aoRecusar } = renderEditor()

    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', null)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })
    const destinoInvalido = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })
    arrastar(origem, destinoInvalido)

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/posição inválida/i))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    await usuario.selectOptions(within(dialogo).getByRole('combobox'), 'entrada')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))

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
    const { aoRecusar } = renderEditor()

    const celula1 = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })
    const celula8 = screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' })
    // contato na coluna terminal (reservada a bobinas) é sempre recusa, mesmo com o redirecionamento da #25 (que só vale para bobina)
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), celula8)
    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/posição inválida/i))

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
    await usuario.selectOptions(within(screen.getByRole('dialog')).getByRole('combobox'), '__sem-variavel__')
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))

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

  it('soltar "Ramo" na coluna terminal cria ramo de saída na primeira linha livre', () => {
    const { aoMudar, aoRecusar } = renderEditor()

    arrastar(screen.getByRole('button', { name: /^ramo$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))

    expect(aoRecusar).not.toHaveBeenCalled()
    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 7, colunaFim: 7 }])
    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 8, vazia' })).toBeInTheDocument()
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

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 330, clientY: 0 })

    const final = ultimoDiagrama(aoMudar)
    // coluna sob clientX=330: floor((330-32)/64) = 4
    expect(final.rungs[0].ramos[0]).toMatchObject({ colunaInicio: 0, colunaFim: 4 })
  })

  it('arrasto por ponteiro: soltar numa coluna menor encolhe o ramo', () => {
    const { aoMudar } = renderEditor(diagramaComRamo())

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 60, clientY: 0 })

    const final = ultimoDiagrama(aoMudar)
    // coluna sob clientX=60: floor((60-32)/64) = 0
    expect(final.rungs[0].ramos[0]).toMatchObject({ colunaInicio: 0, colunaFim: 0 })
  })

  it('encolher deixando um contato fora do novo intervalo é recusado (aoRecusar), e o diagrama não muda', () => {
    const diagrama = diagramaComRamo()
    diagrama.rungs[0].elementos.push({ id: 'e9', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: null })
    const { aoMudar, aoRecusar } = renderEditor(diagrama)

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
    fireEvent.pointerDown(alca, { pointerId: 7, clientX: 200, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 60, clientY: 0 }) // coluna 0; contato está na coluna 2

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/fora do novo intervalo/i))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('teclado: Espaço pega a alça, setas esticam, Espaço aplica', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComRamo())

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
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

    const alca = screen.getByRole('slider', { name: /fim do ramo 1/i })
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

  it('remover um ramo com contato dentro é recusado (aoRecusar), e o diagrama não muda', async () => {
    const usuario = userEvent.setup()
    const diagrama = diagramaComRamo()
    diagrama.rungs[0].elementos.push({ id: 'e9', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: null })
    const { aoMudar, aoRecusar } = renderEditor(diagrama)

    fireEvent.click(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' }))
    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/remova os contatos do ramo antes/i))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    await confirmarRemocaoDegrau(usuario)

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

  it('recusa remover o último degrau, sem alterar o diagrama, e repassa o motivo a aoRecusar', async () => {
    const usuario = userEvent.setup()
    const { aoMudar, aoRecusar } = renderEditor()

    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/pelo menos um degrau/i))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    await confirmarRemocaoDegrau(usuario)

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

  it('rung_incompleto (contato sem bobina) marca a calha do degrau com um ícone (role="img", aria-label com a mensagem), sem texto visível', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: null }], ramos: [] }],
    }
    const problemas = validarDiagrama(diagrama)
    expect(problemas.some((p) => p.codigo === 'rung_incompleto')).toBe(true)

    render(<EditorLadder diagrama={diagrama} aoMudar={() => {}} problemas={problemas} />)

    expect(screen.getByRole('img', { name: /sem nenhuma bobina/i })).toBeInTheDocument()
    expect(screen.queryByText(/sem nenhuma bobina/i)).not.toBeInTheDocument()
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

describe('EditorLadder — bobina sempre na coluna 8 (tarefa #25, celulaDeSoltura)', () => {
  it('bobina solta na coluna 2 (ponteiro) fica na coluna 8, não na coluna 2', () => {
    const { aoMudar } = renderEditor()

    arrastar(screen.getByRole('button', { name: /^bobina$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 2, vazia' })).toBeInTheDocument()
    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toEqual([{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }])
  })

  it('bobina solta numa célula de ramo vai para a coluna 8 da linha 0 (trilho principal), não para o ramo', () => {
    const { aoMudar } = renderEditor(diagramaComRamo())

    arrastar(
      screen.getByRole('button', { name: /^bobina$/i }),
      screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' }),
    )

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, ramo 1, coluna 2, vazia' })).toBeInTheDocument()
    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toEqual([{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }])
  })

  it('por teclado, bobina pega na paleta e solta em qualquer coluna também fica na coluna 8', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    const itemBobina = screen.getByRole('button', { name: /^bobina$/i })
    itemBobina.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{ArrowRight}{ArrowRight}') // vai para a coluna 3 — deveria terminar na coluna 8 mesmo assim
    await usuario.keyboard(' ')

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toHaveAttribute('aria-selected', 'true')
    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos).toEqual([{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }])
  })

  it('mover uma bobina já na coluna 8 para outra célula do mesmo degrau não muda nada: não é recusa, a posição continua igual', () => {
    const diagramaComBobina: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }], ramos: [] }],
    }
    const { aoMudar, aoRecusar } = renderEditor(diagramaComBobina)

    const origem = screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })
    const destino = screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })
    arrastar(origem, destino)

    expect(aoRecusar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 8, bobina sem variável' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 3, vazia' })).toBeInTheDocument()
    // moverElemento é um no-op bem-sucedido nesse caso (mesma célula final) — aoMudar pode ser chamado com um
    // diagrama clonado, mas equivalente ao original.
    if (aoMudar.mock.calls.length > 0) {
      const final = ultimoDiagrama(aoMudar)
      expect(final.rungs[0].elementos).toEqual([{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }])
    }
  })

  it('bobina com a coluna 8 já ocupada: soltar uma nova bobina em qualquer célula é recusado (aoRecusar), sem alterar o diagrama', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null }], ramos: [] }],
    }
    const { aoMudar, aoRecusar } = renderEditor(diagrama)

    const alvo = screen.getByRole('button', { name: 'Degrau 1, coluna 4, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), alvo)

    expect(aoRecusar).toHaveBeenCalled()
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('coluna terminal cheia nas três linhas com ramos de saída: nova bobina é recusada', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: 7 }, variavel: null },
            { id: 'e2', tipo: 'bobina', celula: { linha: 1, coluna: 7 }, variavel: null },
            { id: 'e3', tipo: 'bobina', celula: { linha: 2, coluna: 7 }, variavel: null },
          ],
          ramos: [
            { id: 'rs1', linha: 1, colunaInicio: 7, colunaFim: 7 },
            { id: 'rs2', linha: 2, colunaInicio: 7, colunaFim: 7 },
          ],
        },
      ],
    }
    const { aoMudar, aoRecusar } = renderEditor(diagrama)

    const alvo = screen.getByRole('button', { name: 'Degrau 1, coluna 4, vazia' })
    arrastar(screen.getByRole('button', { name: /^bobina$/i }), alvo)

    expect(aoRecusar).toHaveBeenCalled()
    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('EditorLadder — confirmação ao remover degrau com conteúdo', () => {
  it('degrau com elemento abre modal; Cancelar não altera o diagrama', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor()

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    const chamadasAposInserir = aoMudar.mock.calls.length
    await usuario.click(screen.getByRole('button', { name: 'Remover degrau 1' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoMudar.mock.calls.length).toBe(chamadasAposInserir)
    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, contato NA sem variável' })).toBeInTheDocument()
  })
})

describe('EditorLadder — botões da calha continuam acessíveis por nome (tarefa #25)', () => {
  it('"Inserir degrau abaixo do degrau N" e "Remover degrau N" continuam localizáveis por getByRole, mesmo antes do hover/foco', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: 'Inserir degrau abaixo do degrau 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover degrau 1' })).toBeInTheDocument()
  })
})

/** Diagrama com dois ramos, um em cada linha extra (`LINHAS_EXTRAS_MAX = 2`),
 * usado para provar que um CTU não tem mais linha disponível para o reinício
 * (CA-10, tarefa #18). */
function diagramaComDoisRamos(): Diagrama {
  return {
    versao: 1,
    variaveis: [],
    rungs: [
      {
        id: 'r1',
        elementos: [],
        ramos: [
          { id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 },
          { id: 'b2', linha: 2, colunaInicio: 0, colunaFim: 0 },
        ],
      },
    ],
  }
}

/** Diagrama com um CTU já ocupando uma das duas linhas extras (`linhaReset:
 * 1`) — usado para provar que um segundo ramo na mesma coluna da outra linha
 * já usada é recusado (CA-10, tarefa #18). */
function diagramaComCtu(): Diagrama {
  return {
    versao: 1,
    variaveis: [],
    rungs: [
      {
        id: 'r1',
        elementos: [{ id: 'e1', tipo: 'ctu', celula: { linha: 0, coluna: 7 }, linhaReset: 1, instancia: 'ctu0', pv: 10, saida: null }],
        ramos: [],
      },
    ],
  }
}

describe('EditorLadder — CA-10: recusa no limite de linhas extras, ramos + reset do CTU (tarefa #18)', () => {
  it('arrastar o Contador quando as duas linhas extras já têm ramo é recusado, com o motivo do limite de linhas', () => {
    const { aoMudar, aoRecusar } = renderEditor(diagramaComDoisRamos())

    arrastar(screen.getByRole('button', { name: /^contador$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/sem linha livre para o rein[ií]cio do contador/i))
    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/2 linha/i))
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('criar um segundo ramo na mesma coluna, com um CTU já usando a outra linha extra, é recusado mencionando o contador e o limite', () => {
    const { aoMudar, aoRecusar } = renderEditor(diagramaComCtu())
    const alvo = screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })

    arrastar(screen.getByRole('button', { name: /^ramo$/i }), alvo)
    expect(aoMudar).toHaveBeenCalledTimes(1)

    arrastar(screen.getByRole('button', { name: /^ramo$/i }), alvo)

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/linha de rein[ií]cio do contador/i))
    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/2 linha/i))
  })
})

describe('EditorLadder — bobina SET, bobina RESET e Contador (CTU) pela UI (tarefa #18)', () => {
  it('arrastar Bobina SET e Bobina RESET cria elementos com o tipo certo', async () => {
    const { aoMudar } = renderEditor()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Inserir degrau' }))

    arrastar(screen.getByRole('button', { name: 'Bobina SET' }), screen.getByRole('button', { name: 'Degrau 1, coluna 8, vazia' }))
    arrastar(screen.getByRole('button', { name: 'Bobina RESET' }), screen.getByRole('button', { name: 'Degrau 2, coluna 8, vazia' }))

    const final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos[0].tipo).toBe('bobina_set')
    expect(final.rungs[1].elementos[0].tipo).toBe('bobina_reset')
  })

  it('Contador (CTU) pela paleta: escolher a saída pelo modal e depois ajustar o limite (PV) sem fechar o modal', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComVariaveis([{ nome: 'atingiu', tipo: 'BOOL' }]))

    await arrastarEEscolher(usuario, /^contador$/i, 'Degrau 1, coluna 8, vazia', 'atingiu')

    let final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos[0]).toMatchObject({ tipo: 'ctu', saida: 'atingiu', pv: 10, linhaReset: 1 })

    // segundo clique no CTU (já marcado pelo drop) reabre o modal
    const celulaCtu = screen.getByRole('button', { name: /^Degrau 1, coluna 8, contador CTU atingiu$/ })
    await usuario.click(celulaCtu)
    const dialogo = screen.getByRole('dialog')
    const campoLimite = within(dialogo).getByLabelText('Limite (PV)')
    await usuario.clear(campoLimite)
    await usuario.type(campoLimite, '20')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar limite' }))

    // "Aplicar limite" não fecha o modal
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    final = ultimoDiagrama(aoMudar)
    expect(final.rungs[0].elementos[0]).toMatchObject({ tipo: 'ctu', pv: 20 })

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('um limite fora do intervalo é recusado (aoRecusar) e o PV anterior é mantido', async () => {
    const usuario = userEvent.setup()
    const { aoMudar, aoRecusar } = renderEditor(diagramaComVariaveis([{ nome: 'atingiu', tipo: 'BOOL' }]))

    await arrastarEEscolher(usuario, /^contador$/i, 'Degrau 1, coluna 8, vazia', 'atingiu')
    aoMudar.mockClear()

    const celulaCtu = screen.getByRole('button', { name: /^Degrau 1, coluna 8, contador CTU atingiu$/ })
    await usuario.click(celulaCtu)
    const dialogo = screen.getByRole('dialog')
    const campoLimite = within(dialogo).getByLabelText('Limite (PV)')
    await usuario.clear(campoLimite)
    await usuario.type(campoLimite, '0')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar limite' }))

    expect(aoRecusar).toHaveBeenCalledWith(expect.stringMatching(/limite do contador deve ser inteiro/i))
    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('EditorLadder — CA-3: construir o BLINK inteiro pela UI (spec 003, ctu.ts)', () => {
  // 8 degraus, ~22 arrastos reais via userEvent + o modal do CTU duas vezes:
  // passa dos 5s padrão do vitest com folga (medido isolado: ~3,8s em
  // container node:22-bookworm-slim) — daí o timeout de 20s abaixo.
  // 2026-09-23: no host o teste já levava 18–19 s isolado; o botão "Nova
  // variável…" no modal (um papel `button` a mais por `getByRole`) passou dos
  // 20 s — timeout elevado para 40 s.
  it('8 degraus com contatos, bobinas SET/RESET e o contador CTU resultam na fixture BLINK, sem problemas', async () => {
    const usuario = userEvent.setup()
    const { aoMudar } = renderEditor(diagramaComVariaveis(BLINK.variaveis))

    for (let i = 0; i < 7; i++) {
      await usuario.click(screen.getByRole('button', { name: 'Inserir degrau' }))
    }

    // R1: o CTU primeiro (cria a linha de reset), depois o contato de
    // contagem (trilho principal) e o de reinício (linha de reset).
    await arrastarEEscolher(usuario, /^contador$/i, 'Degrau 1, coluna 8, vazia', 'atingiu')
    {
      const celulaCtu = screen.getByRole('button', { name: /^Degrau 1, coluna 8, contador CTU atingiu$/ })
      await usuario.click(celulaCtu)
      const dialogo = screen.getByRole('dialog')
      const campoLimite = within(dialogo).getByLabelText('Limite (PV)')
      await usuario.clear(campoLimite)
      await usuario.type(campoLimite, '12')
      await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar limite' }))
      await usuario.keyboard('{Escape}')
    }
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, coluna 1, vazia', 'pulso')
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 1, reset do contador, coluna 1, vazia', 'reset_ctu')

    // R2: atingiu -> RESET pulso.
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 2, coluna 1, vazia', 'atingiu')
    await arrastarEEscolher(usuario, /^bobina reset$/i, 'Degrau 2, coluna 8, vazia', 'pulso')

    // R3: NOT pulso -> pulso.
    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 3, coluna 1, vazia', 'pulso')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 3, coluna 8, vazia', 'pulso')

    // R4: led -> led_estava_aceso.
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 4, coluna 1, vazia', 'led')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 4, coluna 8, vazia', 'led_estava_aceso')

    // R5: reset_ctu AND NOT led_estava_aceso -> SET led.
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 5, coluna 1, vazia', 'reset_ctu')
    await arrastarEEscolher(usuario, /^contato nf$/i, 'Degrau 5, coluna 2, vazia', 'led_estava_aceso')
    await arrastarEEscolher(usuario, /^bobina set$/i, 'Degrau 5, coluna 8, vazia', 'led')

    // R6: reset_ctu AND led_estava_aceso -> RESET led.
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 6, coluna 1, vazia', 'reset_ctu')
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 6, coluna 2, vazia', 'led_estava_aceso')
    await arrastarEEscolher(usuario, /^bobina reset$/i, 'Degrau 6, coluna 8, vazia', 'led')

    // R7: atingiu -> reset_ctu.
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 7, coluna 1, vazia', 'atingiu')
    await arrastarEEscolher(usuario, /^bobina$/i, 'Degrau 7, coluna 8, vazia', 'reset_ctu')

    // R8: botao -> SET led.
    await arrastarEEscolher(usuario, /^contato na$/i, 'Degrau 8, coluna 1, vazia', 'botao')
    await arrastarEEscolher(usuario, /^bobina set$/i, 'Degrau 8, coluna 8, vazia', 'led')

    const final = ultimoDiagrama(aoMudar)
    expect(normalizarIds(final)).toEqual(normalizarIds(BLINK))
    expect(validarDiagrama(final)).toEqual([])
  }, 40000)
})

describe('EditorLadder — desempenho com 50 degraus preenchidos (plano §6, RNF)', () => {
  it('renderiza 50 degraus (contato + bobina cada) dentro de um teto folgado de 5s', () => {
    const rungs = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i + 1}`,
      elementos: [
        { id: `e${i * 2 + 1}`, tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: null },
        { id: `e${i * 2 + 2}`, tipo: 'bobina' as const, celula: { linha: 0, coluna: 7 }, variavel: null },
      ],
      ramos: [],
    }))
    const diagramaGrande: Diagrama = { versao: 1, variaveis: [], rungs }

    const inicio = performance.now()
    render(<Harness inicial={diagramaGrande} espiao={vi.fn()} />)
    const duracaoMs = performance.now() - inicio

    // Medido nesta rodada (jsdom, máquina do orquestrador): ~150-400 ms para
    // 50 degraus — bem abaixo do teto. O teto de 5 s é folgado de propósito
    // (plano §6): o alvo é acusar regressão grave, não otimizar prematuramente
    // por variação normal de máquina/CI.
    expect(duracaoMs).toBeLessThan(5000)
  })
})

describe('EditorLadder — congelado (spec 004, tarefa #11, RF-15/CA-8)', () => {
  function renderCongelado(inicial: Diagrama) {
    const aoMudar = vi.fn()
    render(<EditorLadder diagrama={inicial} aoMudar={aoMudar} congelado />)
    return { aoMudar }
  }

  it('arrastar da paleta para uma célula vazia não insere nada e não chama aoMudar', () => {
    const { aoMudar } = renderCongelado(diagramaVazio())

    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))

    expect(screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' })).toBeInTheDocument()
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('clicar num elemento existente não marca (aria-selected continua false) e duplo clique não abre o modal', () => {
    renderCongelado(MINIMAL)
    const celula = screen.getByRole('button', { name: /Degrau 1, coluna 1, contato NF/ })

    fireEvent.click(celula)
    expect(celula).toHaveAttribute('aria-selected', 'false')

    fireEvent.doubleClick(celula)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Delete/Backspace na célula não remove nada, mesmo tentando marcar antes', () => {
    const { aoMudar } = renderCongelado(MINIMAL)
    const celula = screen.getByRole('button', { name: /Degrau 1, coluna 1, contato NF/ })

    fireEvent.click(celula)
    fireEvent.keyDown(celula, { key: 'Delete' })

    expect(aoMudar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Degrau 1, coluna 1, contato NF/ })).toBeInTheDocument()
  })

  it('pegar um item da paleta por teclado (Espaço) não arma arrasto nenhum', () => {
    renderCongelado(diagramaVazio())
    const item = screen.getByRole('button', { name: /^contato na$/i })

    fireEvent.keyDown(item, { key: ' ' })

    // Sem arrasto em curso, nenhuma célula ganha o destaque de alvo/prévia —
    // a lixeira continua desabilitada (só habilita com arrasto ou marcação).
    expect(screen.getByRole('button', { name: /lixeira/i })).toBeDisabled()
  })

  it('"Inserir degrau" fica desabilitado e o clique não insere', () => {
    const { aoMudar } = renderCongelado(diagramaVazio())
    const botao = screen.getByRole('button', { name: 'Inserir degrau' })

    expect(botao).toBeDisabled()
    fireEvent.click(botao)
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('sem congelado (padrão), a edição continua liberada — não regrediu', () => {
    const { aoMudar } = renderEditor()
    arrastar(screen.getByRole('button', { name: /^contato na$/i }), screen.getByRole('button', { name: 'Degrau 1, coluna 1, vazia' }))
    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('a prop `simulacao` não quebra a renderização (energização repassada crua ao GradeDegrau)', () => {
    const energizacao: Record<string, EnergizacaoDegrau> = {
      r1: { nos: { '0:0': true }, celulas: { '0:0': true }, elementos: { e1: true } },
    }
    expect(() =>
      render(<EditorLadder diagrama={MINIMAL} aoMudar={vi.fn()} simulacao={{ energizacao }} />),
    ).not.toThrow()
  })
})
