import { describe, expect, it } from 'vitest'
import type { Diagrama, Rung } from './modelo'
import { posicaoValida, validarDiagrama } from './validacao'

/** Rung minimo de 2 colunas: contato em (0,0), bobina em (0,1). Ponto de
 * partida que os testes abaixo desmontam para forcar cada codigo de problema. */
function rungBase(): Rung {
  return {
    id: 'r1',
    colunas: 2,
    elementos: [
      { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
      { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
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
  const rung = rungBase()

  it('bobina so na ultima coluna, linha 0', () => {
    expect(posicaoValida(rung, 'bobina', { linha: 0, coluna: 1 })).toBe(false) // ja ocupada
    expect(posicaoValida({ ...rung, elementos: [] }, 'bobina', { linha: 0, coluna: 1 })).toBe(true)
    expect(posicaoValida({ ...rung, elementos: [] }, 'bobina', { linha: 0, coluna: 0 })).toBe(false)
    expect(posicaoValida({ ...rung, elementos: [] }, 'bobina', { linha: 1, coluna: 1 })).toBe(false)
  })

  it('contato antes da ultima coluna', () => {
    expect(posicaoValida({ ...rung, elementos: [] }, 'contato_na', { linha: 0, coluna: 0 })).toBe(true)
    expect(posicaoValida({ ...rung, elementos: [] }, 'contato_na', { linha: 0, coluna: 1 })).toBe(false)
  })

  it('linha>0 so dentro de um Ramo declarado', () => {
    const comRamo: Rung = {
      ...rung,
      elementos: [],
      colunas: 3,
      ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 0, colunaFim: 2 }],
    }
    expect(posicaoValida(comRamo, 'contato_na', { linha: 1, coluna: 0 })).toBe(true)
    expect(posicaoValida(comRamo, 'contato_na', { linha: 1, coluna: 2 })).toBe(false) // fora do [inicio,fim)
    expect(posicaoValida(comRamo, 'contato_na', { linha: 2, coluna: 0 })).toBe(false) // sem ramo nessa linha
  })

  it('ctu pode ocupar ate a ultima coluna, so na linha 0', () => {
    const r: Rung = { id: 'r', colunas: 2, elementos: [], ramos: [] }
    expect(posicaoValida(r, 'ctu', { linha: 0, coluna: 0 })).toBe(true)
    expect(posicaoValida(r, 'ctu', { linha: 0, coluna: 1 })).toBe(true)
    expect(posicaoValida(r, 'ctu', { linha: 1, coluna: 0 })).toBe(false)
  })

  it('celula fora do intervalo de colunas e invalida', () => {
    const r: Rung = { id: 'r', colunas: 2, elementos: [], ramos: [] }
    expect(posicaoValida(r, 'contato_na', { linha: 0, coluna: -1 })).toBe(false)
    expect(posicaoValida(r, 'contato_na', { linha: 0, coluna: 5 })).toBe(false)
  })
})

describe('validarDiagrama -- um codigo por vez', () => {
  it('rung_incompleto: sem bobina (nem ctu com saida) na ultima coluna', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 2,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'rung_incompleto', rungId: 'r1' }),
    )
  })

  it('rung_incompleto: buraco entre o trilho esquerdo e a bobina', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 3,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        // coluna 1 fica vazia -- buraco -- antes da bobina em 2.
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 2 }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'rung_incompleto', rungId: 'r1', elementoId: 'b1' }),
    )
  })

  it('rung_incompleto: um Ramo que cobre a coluna fecha o buraco', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 3,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'c2', tipo: 'contato_na', celula: { linha: 1, coluna: 1 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 2 }, variavel: 'saida' },
      ],
      ramos: [{ id: 'ramo1', linha: 1, colunaInicio: 1, colunaFim: 2 }],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas.filter((p) => p.codigo === 'rung_incompleto')).toEqual([])
  })

  it('variavel_nao_atribuida: bobina com variavel null', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 2,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: null },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'variavel_nao_atribuida', rungId: 'r1', elementoId: 'b1' }),
    )
  })

  it('variavel_inexistente: contato referencia variavel que nao esta na lista', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 2,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'fantasma' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'variavel_inexistente', rungId: 'r1', elementoId: 'c1' }),
    )
  })

  it('variavel_inexistente: ctu com saida referenciando variavel que nao existe', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 2,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        {
          id: 'ctu1',
          tipo: 'ctu',
          celula: { linha: 0, coluna: 1 },
          instancia: 'ctu0',
          pv: 5,
          saida: 'fantasma',
        },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'variavel_inexistente', rungId: 'r1', elementoId: 'ctu1' }),
    )
  })

  it('posicao_invalida: bobina fora da ultima coluna', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 3,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' }, // deveria ser coluna 2
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'posicao_invalida', rungId: 'r1', elementoId: 'b1' }),
    )
  })

  it('posicao_invalida: contato em linha>0 sem Ramo que a cubra', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 2,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'entrada' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
      ],
      ramos: [], // nenhum ramo declarado -- a linha 1 nao existe de verdade
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'posicao_invalida', rungId: 'r1', elementoId: 'c1' }),
    )
  })

  it('endereco_mal_formado: falta I/Q ou formato fora do padrao', () => {
    const diagrama = diagramaBase([rungBase()])
    diagrama.variaveis[0] = { nome: 'entrada', tipo: 'BOOL', endereco: '%X0.0' }
    const problemas = validarDiagrama(diagrama)
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'endereco_mal_formado' }),
    )
  })

  it('bobina_escreve_entrada: bobina escrevendo em variavel %I', () => {
    const rung: Rung = {
      id: 'r1',
      colunas: 2,
      elementos: [
        { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'saida' },
        { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'entrada' },
      ],
      ramos: [],
    }
    const problemas = validarDiagrama(diagramaBase([rung]))
    expect(problemas).toContainEqual(
      expect.objectContaining({ codigo: 'bobina_escreve_entrada', rungId: 'r1', elementoId: 'b1' }),
    )
  })
})
