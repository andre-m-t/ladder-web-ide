import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL, COLUNAS_POR_DEGRAU, LINHAS_EXTRAS_MAX } from './modelo'
import type { Diagrama, ElementoBloco, Rung } from './modelo'
import { diagramaVazio } from './edicao'
import { IO_ESPELHO, MINIMAL } from './fixtures'
import { descreverCelula, motivoPosicaoInvalida, posicaoValida, validarDiagrama } from './validacao'

/** Rung mínimo e válido: contato em (0,0), bobina no terminal. Ponto de
 * partida que os testes de `validarDiagrama` desmontam para forçar cada código. */
function rungBase(): Rung {
  return {
    id: 'r1',
    elementos: [
      { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
      { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
    ],
    ramos: [],
  }
}

function diagramaBase(rungs: Rung[]): Diagrama {
  return {
    versao: 2,
    variaveis: [
      { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.0' },
      { nome: 'saida', tipo: 'BOOL', endereco: '%QX0.0' },
    ],
    rungs,
  }
}

describe('posicaoValida', () => {
  it('bobina só em (linha 0, COLUNA_TERMINAL)', () => {
    const rung = rungBase()
    expect(posicaoValida(rung, 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })).toBe(true)
    expect(posicaoValida(rung, 'bobina', { linha: 0, coluna: 0 })).toBe(false)
    expect(posicaoValida(rung, 'bobina', { linha: 1, coluna: COLUNA_TERMINAL })).toBe(false)
    expect(posicaoValida(rung, 'bobina', { linha: LINHAS_EXTRAS_MAX + 1, coluna: COLUNA_TERMINAL })).toBe(false)

    const comRamoSaida = {
      ...rung,
      ramos: [{ id: 'rs1', linha: 1, colunaInicio: COLUNA_TERMINAL, colunaFim: COLUNA_TERMINAL }],
    }
    expect(posicaoValida(comRamoSaida, 'bobina', { linha: 1, coluna: COLUNA_TERMINAL })).toBe(true)

    const semTerminal = { id: 'r0', elementos: [], ramos: [] }
    expect(posicaoValida(semTerminal, 'bobina', { linha: 1, coluna: COLUNA_TERMINAL })).toBe(false)
  })

  it('contato em qualquer coluna antes de COLUNA_TERMINAL', () => {
    const rung = rungBase()
    expect(posicaoValida(rung, 'contato_na', { linha: 0, coluna: 0 })).toBe(true)
    expect(posicaoValida(rung, 'contato_nf', { linha: 0, coluna: COLUNA_TERMINAL - 1 })).toBe(true)
    expect(posicaoValida(rung, 'contato_na', { linha: 0, coluna: COLUNA_TERMINAL })).toBe(false)
  })

  it('coluna fora de 0..COLUNAS_POR_DEGRAU-1 é inválida', () => {
    const rung = rungBase()
    expect(posicaoValida(rung, 'contato_na', { linha: 0, coluna: -1 })).toBe(false)
    expect(posicaoValida(rung, 'contato_na', { linha: 0, coluna: COLUNAS_POR_DEGRAU })).toBe(false)
  })

  it('linha > 0 só é válida dentro do intervalo fechado de um Ramo declarado', () => {
    const comRamo: Rung = {
      ...rungBase(),
      ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 0, colunaFim: 2 }],
    }
    expect(posicaoValida(comRamo, 'contato_na', { linha: 1, coluna: 0 })).toBe(true)
    expect(posicaoValida(comRamo, 'contato_na', { linha: 1, coluna: 2 })).toBe(true) // intervalo fechado
    expect(posicaoValida(comRamo, 'contato_na', { linha: 1, coluna: 3 })).toBe(false)
    expect(posicaoValida(comRamo, 'contato_na', { linha: 2, coluna: 0 })).toBe(false) // sem ramo nessa linha
  })

  it('linha > LINHAS_EXTRAS_MAX nunca é válida, mesmo com ramo', () => {
    const rung: Rung = {
      ...rungBase(),
      ramos: [{ id: 'ramo1', linha: LINHAS_EXTRAS_MAX + 1, colunaInicio: 0, colunaFim: 2 }],
    }
    expect(posicaoValida(rung, 'contato_na', { linha: LINHAS_EXTRAS_MAX + 1, coluna: 0 })).toBe(false)
    expect(posicaoValida(rung, 'contato_na', { linha: LINHAS_EXTRAS_MAX, coluna: 0 })).toBe(false) // sem ramo declarado nessa linha
  })

  it('não checa ocupação: célula já ocupada por outro elemento ainda é "válida"', () => {
    const rung = rungBase()
    // (0,0) já tem c1, mas posicaoValida não sabe disso — é papel de edicao.ts
    expect(posicaoValida(rung, 'contato_nf', { linha: 0, coluna: 0 })).toBe(true)
  })
})

describe('descreverCelula — rotulagem 1-based, igual à interface (rotuloCelula de GradeDegrau)', () => {
  it('linha 0 (trilho principal): "degrau N, coluna M"', () => {
    expect(descreverCelula(0, { linha: 0, coluna: 0 })).toBe('degrau 1, coluna 1')
    expect(descreverCelula(2, { linha: 0, coluna: COLUNA_TERMINAL })).toBe(`degrau 3, coluna ${COLUNA_TERMINAL + 1}`)
  })

  it('linha > 0 (ramo): "degrau N, ramo L, coluna M"', () => {
    expect(descreverCelula(0, { linha: 1, coluna: 0 })).toBe('degrau 1, ramo 1, coluna 1')
    expect(descreverCelula(1, { linha: 2, coluna: 3 })).toBe('degrau 2, ramo 2, coluna 4')
  })
})

describe('motivoPosicaoInvalida — explica a regra, sempre 1-based, nunca linha=/coluna=', () => {
  it('bobina fora da última coluna: cita a coluna terminal e o trilho principal', () => {
    const rung = rungBase()
    const motivo = motivoPosicaoInvalida(0, rung, 'bobina', { linha: 0, coluna: 0 })
    expect(motivo).toMatch(/posição inválida/i)
    expect(motivo).toContain(`coluna ${COLUNA_TERMINAL + 1}`)
    expect(motivo).toContain('última coluna')
    expect(motivo).not.toMatch(/linha=|coluna=/)
  })

  it('contato na coluna terminal: diz que a coluna é reservada a bobinas e onde vão os contatos', () => {
    const rung = rungBase()
    const motivo = motivoPosicaoInvalida(0, rung, 'contato_na', { linha: 0, coluna: COLUNA_TERMINAL })
    expect(motivo).toMatch(/posição inválida/i)
    expect(motivo).toContain(`coluna ${COLUNA_TERMINAL + 1}`)
    expect(motivo).toContain('reservada a bobinas')
    expect(motivo).toContain(`1 a ${COLUNA_TERMINAL}`)
  })

  it('linha sem ramo declarado: motivo específico, não confunde com fora da grade', () => {
    const rung = rungBase()
    const motivo = motivoPosicaoInvalida(0, rung, 'contato_na', { linha: 1, coluna: 0 })
    expect(motivo).toContain('degrau 1, ramo 1, coluna 1')
    expect(motivo).toContain('não tem ramo declarado')
  })

  it('linha além de LINHAS_EXTRAS_MAX: motivo de limite, não de "sem ramo"', () => {
    const rung = rungBase()
    const motivo = motivoPosicaoInvalida(0, rung, 'contato_na', { linha: LINHAS_EXTRAS_MAX + 1, coluna: 0 })
    expect(motivo).toContain('limite de ramos')
  })

  it('coluna fora da grade: motivo de fora da grade, com o total de colunas', () => {
    const rung = rungBase()
    const motivo = motivoPosicaoInvalida(0, rung, 'contato_na', { linha: 0, coluna: COLUNAS_POR_DEGRAU })
    expect(motivo).toContain('fora da grade')
    expect(motivo).toContain(`${COLUNAS_POR_DEGRAU}`)
  })

  it('degrau 3: o número do degrau aparece 1-based na mensagem', () => {
    const rung = rungBase()
    const motivo = motivoPosicaoInvalida(2, rung, 'bobina', { linha: 0, coluna: 0 })
    // a mensagem de bobina não cita a célula de destino, só a regra — mas
    // não deve vazar índice interno em nenhum formato linha=/coluna=
    expect(motivo).not.toMatch(/linha=|coluna=/)
  })
})

describe('validarDiagrama — um código por vez', () => {
  it('rung_incompleto: degrau sem nenhuma bobina', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [{ id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' }],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const problema = problemas.find((p) => p.codigo === 'rung_incompleto')
    expect(problema).toEqual(expect.objectContaining({ codigo: 'rung_incompleto', severidade: 'erro', rungId: 'r1' }))
    // único rung do diagrama: "degrau 1" (1-based), não o id interno 'r1'
    expect(problema?.mensagem).toContain('degrau 1')
    expect(problema?.mensagem).toContain('bobina')
  })

  it('degrau vazio (zero elementos, zero ramos) não é erro (tarefa #25)', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto')).toEqual([])
  })

  it('diagrama com 3 degraus vazios: sem problemas (tarefa #25)', () => {
    const diagrama: Diagrama = {
      versao: 2,
      variaveis: [],
      rungs: [
        { id: 'r1', elementos: [], ramos: [] },
        { id: 'r2', elementos: [], ramos: [] },
        { id: 'r3', elementos: [], ramos: [] },
      ],
    }
    expect(validarDiagrama(diagrama)).toEqual([])
  })

  it('degrau com só um ramo vazio (sem elementos, sem bobina): ainda é rung_incompleto (tarefa #25)', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 0, colunaFim: 2 }] }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto').length).toBeGreaterThan(0)
  })

  it('degrau com contato na coluna 0 e bobina em COLUNA_TERMINAL é completo, mesmo com colunas vazias entre eles', () => {
    const problemas = validarDiagrama(diagramaBase([rungBase()]))
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto')).toEqual([])
  })

  it('variavel_nao_atribuida: elemento com variavel null', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: null },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const problema = problemas.find((p) => p.codigo === 'variavel_nao_atribuida')
    expect(problema).toEqual(
      expect.objectContaining({ codigo: 'variavel_nao_atribuida', severidade: 'erro', rungId: 'r1', elementoId: 'c1' }),
    )
    expect(problema?.mensagem).toContain('degrau 1, coluna 1')
    expect(problema?.mensagem).not.toMatch(/linha=|coluna=/)
  })

  it('variavel_inexistente: elemento referencia nome não declarado em diagrama.variaveis', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'fantasma' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const problema = problemas.find((p) => p.codigo === 'variavel_inexistente')
    expect(problema).toEqual(
      expect.objectContaining({ codigo: 'variavel_inexistente', severidade: 'erro', rungId: 'r1', elementoId: 'c1' }),
    )
    expect(problema?.mensagem).toContain('degrau 1, coluna 1')
    expect(problema?.mensagem).toContain("'fantasma'")
  })

  it('posicao_invalida: bobina fora de COLUNA_TERMINAL', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const problema = problemas.find((p) => p.codigo === 'posicao_invalida')
    expect(problema).toEqual(
      expect.objectContaining({ codigo: 'posicao_invalida', severidade: 'erro', rungId: 'r1', elementoId: 'b1' }),
    )
    // mensagem explica a regra (bobina só no trilho principal), 1-based, sem linha=/coluna=
    expect(problema?.mensagem).toMatch(/posição inválida/i)
    expect(problema?.mensagem).toContain('última coluna')
    expect(problema?.mensagem).not.toMatch(/linha=|coluna=/)
  })

  it('endereco_invalido: endereço de variável fora de ENDERECOS_LOCALIZADOS', () => {
    const diagrama = diagramaBase([rungBase()])
    diagrama.variaveis[0] = { nome: 'entrada', tipo: 'BOOL', endereco: '%IX9.9' }
    const problemas = validarDiagrama(diagrama)
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'endereco_invalido', severidade: 'erro', rungId: '', elementoId: null }),
    )
  })

  it('rung_incompleto: ramo declarado sem nenhum contato dentro (curto-circuita o trecho)', () => {
    const rung: Rung = {
      ...rungBase(),
      ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 2, colunaFim: 4 }],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const problema = problemas.find((p) => p.mensagem.includes('ramo vazio'))
    expect(problema).toEqual(
      expect.objectContaining({ codigo: 'rung_incompleto', severidade: 'erro', rungId: 'r1', elementoId: null }),
    )
    expect(problema?.mensagem).toBe('ramo vazio em degrau 1, colunas 3–5: um ramo sem contato curto-circuita o trecho')
    // não é confundido com a falta de bobina — o rung já tem bobina
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto')).toHaveLength(1)
  })

  it('ramo com contato dentro do intervalo: sem rung_incompleto por causa do ramo', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'c2', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 1, colunaFim: 3 }],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto')).toEqual([])
  })

  it('bobina_escreve_entrada: bobina vinculada a variável com endereço %IX', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'saida' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'entrada' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'bobina_escreve_entrada', severidade: 'erro', rungId: 'r1', elementoId: 'b1' }),
    )
  })
})

describe('validarDiagrama — Q-6 (D-10): bobina_duplicada', () => {
  it('duas bobinas simples na mesma variável, em degraus diferentes: erro nas duas, cada uma apontando a outra', () => {
    const rung1: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const rung2: Rung = {
      id: 'r2',
      elementos: [
        { id: 'c2', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung1, rung2]))
    const duplicadas = problemas.filter((p) => p.codigo === 'bobina_duplicada')
    expect(duplicadas).toHaveLength(2)
    expect(duplicadas).toContainEqual(
      expect.objectContaining({ codigo: 'bobina_duplicada', severidade: 'erro', rungId: 'r1', elementoId: 'b1' }),
    )
    expect(duplicadas).toContainEqual(
      expect.objectContaining({ codigo: 'bobina_duplicada', severidade: 'erro', rungId: 'r2', elementoId: 'b2' }),
    )
    const problemaB1 = duplicadas.find((p) => p.elementoId === 'b1')
    // aponta a outra posição (1-based), degrau 2
    expect(problemaB1?.mensagem).toContain('degrau 2')
    expect(problemaB1?.mensagem).toContain("'saida'")
    const problemaB2 = duplicadas.find((p) => p.elementoId === 'b2')
    expect(problemaB2?.mensagem).toContain('degrau 1')
  })

  it('bobina única por variável: sem bobina_duplicada', () => {
    const problemas = validarDiagrama(diagramaBase([rungBase()]))
    expect(problemas.filter((p) => p.codigo === 'bobina_duplicada')).toEqual([])
  })

  it('duas bobinas simples na mesma variável, no mesmo degrau (linha 0 e um ramo): ainda é erro', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
        // segunda bobina simples da mesma variável: posição inválida por si
        // só (bobina fora do terminal), mas ainda deve acusar duplicidade
        { id: 'b2', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const duplicadas = problemas.filter((p) => p.codigo === 'bobina_duplicada')
    expect(duplicadas.map((p) => p.elementoId).sort()).toEqual(['b1', 'b2'])
  })

  it('SET e RESET da mesma variável não contam como bobina_duplicada', () => {
    const rung1: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 's1', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const rung2: Rung = {
      id: 'r2',
      elementos: [
        { id: 'c2', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 'r1elem', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const diagrama = diagramaBase([rung1, rung2])
    diagrama.variaveis.push({ nome: 'botao', tipo: 'BOOL' })
    const problemas = validarDiagrama(diagrama)
    expect(problemas.filter((p) => p.codigo === 'bobina_duplicada')).toEqual([])
  })
})

describe('validarDiagrama — Q-6 (D-10): set_reset_autodependente', () => {
  it('SET e RESET da mesma variável, condição do SET depende da própria variável: aviso no SET', () => {
    const rungSet: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'saida' },
        { id: 's1', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const rungReset: Rung = {
      id: 'r2',
      elementos: [
        { id: 'c2', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 'rs1', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const diagrama = diagramaBase([rungSet, rungReset])
    diagrama.variaveis.push({ nome: 'botao', tipo: 'BOOL' })
    const problemas = validarDiagrama(diagrama)
    const avisos = problemas.filter((p) => p.codigo === 'set_reset_autodependente')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toEqual(
      expect.objectContaining({
        codigo: 'set_reset_autodependente',
        severidade: 'aviso',
        rungId: 'r1',
        elementoId: 's1',
      }),
    )
    expect(avisos[0].mensagem).toContain("'saida'")
  })

  it('SET e RESET, condição do RESET depende da própria variável (via ramo): aviso no RESET', () => {
    const rungSet: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 's1', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const rungReset: Rung = {
      id: 'r2',
      elementos: [
        { id: 'c2', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 'c3', tipo: 'contato_nf', celula: { linha: 1, coluna: 0 }, variavel: 'saida' },
        { id: 'rs1', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
    }
    const diagrama = diagramaBase([rungSet, rungReset])
    diagrama.variaveis.push({ nome: 'botao', tipo: 'BOOL' })
    const problemas = validarDiagrama(diagrama)
    const avisos = problemas.filter((p) => p.codigo === 'set_reset_autodependente')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toEqual(
      expect.objectContaining({
        codigo: 'set_reset_autodependente',
        severidade: 'aviso',
        rungId: 'r2',
        elementoId: 'rs1',
      }),
    )
  })

  it('caso negativo obrigatório: par SET/RESET normal, condições que não citam a própria variável, não gera aviso', () => {
    const rungSet: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao_liga' },
        { id: 's1', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const rungReset: Rung = {
      id: 'r2',
      elementos: [
        { id: 'c2', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao_desliga' },
        { id: 'rs1', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const diagrama = diagramaBase([rungSet, rungReset])
    diagrama.variaveis.push({ nome: 'botao_liga', tipo: 'BOOL' }, { nome: 'botao_desliga', tipo: 'BOOL' })
    const problemas = validarDiagrama(diagrama)
    expect(problemas.filter((p) => p.codigo === 'set_reset_autodependente')).toEqual([])
  })

  it('só SET (sem RESET correspondente) com contato da própria variável: sem aviso — precisa do par', () => {
    const rungSet: Rung = {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'saida' },
        { id: 's1', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rungSet]))
    expect(problemas.filter((p) => p.codigo === 'set_reset_autodependente')).toEqual([])
  })
})

describe('validarDiagrama — CTU (tarefa #16, D-7): terminal, escrita simples e limite', () => {
  function rungComCtu(preset = 10): Rung {
    return {
      id: 'r1',
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        {
          id: 'ctu1',
          tipo: 'ctu',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaControle: 1,
          instancia: 'ctu0',
          preset,
          saida: 'saida',
        },
      ],
      ramos: [],
    }
  }

  it('CTU conta como terminal: sem rung_incompleto mesmo sem nenhuma bobina', () => {
    const problemas = validarDiagrama(diagramaBase([rungComCtu()]))
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto')).toEqual([])
  })

  it('CTU com saida nula: variavel_nao_atribuida (mesma regra de bobina/contato)', () => {
    const rung = rungComCtu()
    rung.elementos[1] = { ...(rung.elementos[1] as ElementoBloco), saida: null }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'variavel_nao_atribuida', elementoId: 'ctu1', severidade: 'erro' }),
    )
  })

  it('CTU com saida inexistente: variavel_inexistente', () => {
    const rung = rungComCtu()
    rung.elementos[1] = { ...(rung.elementos[1] as ElementoBloco), saida: 'fantasma' }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'variavel_inexistente', elementoId: 'ctu1', severidade: 'erro' }),
    )
  })

  it('CTU com saida numa entrada (%IX): bobina_escreve_entrada, mensagem fala em "contador"', () => {
    const rung = rungComCtu()
    rung.elementos[1] = { ...(rung.elementos[1] as ElementoBloco), saida: 'entrada' }
    const problemas = validarDiagrama(diagramaBase([rung]))
    const problema = problemas.find((p) => p.codigo === 'bobina_escreve_entrada')
    expect(problema).toEqual(
      expect.objectContaining({ codigo: 'bobina_escreve_entrada', elementoId: 'ctu1', severidade: 'erro' }),
    )
    expect(problema?.mensagem).toContain('bloco')
  })

  it('bobina_duplicada: CTU e bobina simples na mesma variável', () => {
    const rungCtu = rungComCtu() // saida: 'saida'
    const rungBobina: Rung = {
      id: 'r2',
      elementos: [
        { id: 'c2', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rungCtu, rungBobina]))
    const duplicadas = problemas.filter((p) => p.codigo === 'bobina_duplicada')
    expect(duplicadas.map((p) => p.elementoId).sort()).toEqual(['b2', 'ctu1'])
  })

  it('bobina_duplicada: dois CTUs com a mesma saida', () => {
    const rung1 = rungComCtu()
    const rung2: Rung = {
      id: 'r2',
      elementos: [
        {
          id: 'ctu2',
          tipo: 'ctu',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaControle: 1,
          instancia: 'ctu1',
          preset: 10,
          saida: 'saida',
        },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung1, rung2]))
    const duplicadas = problemas.filter((p) => p.codigo === 'bobina_duplicada')
    expect(duplicadas.map((p) => p.elementoId).sort()).toEqual(['ctu1', 'ctu2'])
  })

  it('SET/RESET não duplicam com a saida de um CTU', () => {
    const rungCtu = rungComCtu()
    const rungSet: Rung = {
      id: 'r2',
      elementos: [{ id: 's1', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' }],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rungCtu, rungSet]))
    expect(problemas.filter((p) => p.codigo === 'bobina_duplicada')).toEqual([])
  })

  it('contato na linha de reset do CTU: sem posicao_invalida', () => {
    const rung = rungComCtu()
    rung.elementos.push({ id: 'r1c', tipo: 'contato_nf', celula: { linha: 1, coluna: 0 }, variavel: 'entrada' })
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas.filter((p) => p.codigo === 'posicao_invalida')).toEqual([])
  })

  it('linha de reset sem nenhum contato: não é problema (R := FALSE)', () => {
    const problemas = validarDiagrama(diagramaBase([rungComCtu()]))
    expect(problemas.filter((p) => p.mensagem.includes('ramo vazio'))).toEqual([])
  })

  it('bloco_preset_invalido: pv fora de [PV_MIN, PV_MAX] num diagrama já montado', () => {
    const problemas = validarDiagrama(diagramaBase([rungComCtu(0)]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'bloco_preset_invalido', elementoId: 'ctu1', severidade: 'erro' }),
    )
  })
})

describe('fixtures sem problemas', () => {
  it('diagramaVazio() não tem problemas (tarefa #25)', () => {
    expect(validarDiagrama(diagramaVazio())).toEqual([])
  })

  it('IO_ESPELHO não tem problemas', () => {
    expect(validarDiagrama(IO_ESPELHO)).toEqual([])
  })

  it('MINIMAL não tem problemas', () => {
    expect(validarDiagrama(MINIMAL)).toEqual([])
  })
})
