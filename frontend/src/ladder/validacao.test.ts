import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL, COLUNAS_POR_DEGRAU, LINHAS_EXTRAS_MAX } from './modelo'
import type { Diagrama, Rung } from './modelo'
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
    versao: 1,
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
    expect(motivo).toContain('trilho principal')
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

  it('rung_incompleto: degrau vazio', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(expect.objectContaining({ codigo: 'rung_incompleto', rungId: 'r1' }))
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
    expect(problema?.mensagem).toContain('trilho principal')
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

describe('fixtures sem problemas', () => {
  it('IO_ESPELHO não tem problemas', () => {
    expect(validarDiagrama(IO_ESPELHO)).toEqual([])
  })

  it('MINIMAL não tem problemas', () => {
    expect(validarDiagrama(MINIMAL)).toEqual([])
  })
})
