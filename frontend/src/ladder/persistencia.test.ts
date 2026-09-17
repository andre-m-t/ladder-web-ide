import { describe, expect, it } from 'vitest'

import { diagramaVazio } from './edicao'
import { COLUNA_TERMINAL } from './modelo'
import type { Diagrama } from './modelo'
import { CHAVE_DIAGRAMA, carregarDiagrama, salvarDiagrama } from './persistencia'

/** `Storage` falso em memória — implementa a interface inteira, sem depender
 * de jsdom/localStorage real, para isolar os testes de persistência. */
class ArmazenamentoFalso implements Storage {
  private dados = new Map<string, string>()

  get length(): number {
    return this.dados.size
  }

  getItem(chave: string): string | null {
    return this.dados.has(chave) ? (this.dados.get(chave) as string) : null
  }

  setItem(chave: string, valor: string): void {
    this.dados.set(chave, valor)
  }

  removeItem(chave: string): void {
    this.dados.delete(chave)
  }

  clear(): void {
    this.dados.clear()
  }

  key(indice: number): string | null {
    return Array.from(this.dados.keys())[indice] ?? null
  }
}

function diagramaDeExemplo(): Diagrama {
  return {
    versao: 1,
    variaveis: [
      { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.0' },
      { nome: 'saida', tipo: 'BOOL', endereco: '%QX0.0' },
    ],
    rungs: [
      {
        id: 'r1',
        elementos: [
          { id: 'c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
          { id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
        ],
        ramos: [],
      },
    ],
  }
}

describe('salvarDiagrama / carregarDiagrama — ida e volta', () => {
  it('salva e recarrega o mesmo diagrama, sem aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    const diagrama = diagramaDeExemplo()

    expect(salvarDiagrama(armazenamento, diagrama)).toBeNull()

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagrama)
    expect(resultado.aviso).toBeNull()
  })

  it('grava o envelope { versao: 1, diagrama } exatamente, na chave CHAVE_DIAGRAMA', () => {
    const armazenamento = new ArmazenamentoFalso()
    const diagrama = diagramaDeExemplo()
    salvarDiagrama(armazenamento, diagrama)

    const bruto = armazenamento.getItem(CHAVE_DIAGRAMA)
    expect(bruto).not.toBeNull()
    expect(JSON.parse(bruto as string)).toEqual({ versao: 1, diagrama })
  })
})

describe('carregarDiagrama — casos de descarte (RF-12: nunca em silêncio, nunca lança)', () => {
  it('sem chave gravada: diagramaVazio(), sem aviso — é o estado inicial normal', () => {
    const armazenamento = new ArmazenamentoFalso()
    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).toBeNull()
  })

  it('JSON inválido: diagramaVazio() + aviso explicando o descarte', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_DIAGRAMA, '{ isso não é json')

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/json/i)
  })

  it('versão desconhecida (2): diagramaVazio() + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 2, diagrama: diagramaDeExemplo() }))

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/vers[ãa]o/i)
  })

  it('formato estruturalmente inválido: rungs vazio', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_DIAGRAMA, JSON.stringify({ versao: 1, diagrama: { versao: 1, variaveis: [], rungs: [] } }))

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
  })

  it('formato estruturalmente inválido: rung sem elementos/ramos', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(
      CHAVE_DIAGRAMA,
      JSON.stringify({ versao: 1, diagrama: { versao: 1, variaveis: [], rungs: [{ id: 'r1' }] } }),
    )

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
  })

  it('formato estruturalmente inválido: variaveis não é array', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(
      CHAVE_DIAGRAMA,
      JSON.stringify({ versao: 1, diagrama: { versao: 1, variaveis: 'nao-array', rungs: [{ id: 'r1', elementos: [], ramos: [] }] } }),
    )

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
  })

  it('envelope que não é objeto (ex.: array): diagramaVazio() + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_DIAGRAMA, JSON.stringify([1, 2, 3]))

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
  })

  it('getItem lançando exceção: diagramaVazio() + aviso, sem propagar', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.getItem = () => {
      throw new Error('acesso ao armazenamento bloqueado')
    }

    const resultado = carregarDiagrama(armazenamento)
    expect(resultado.diagrama).toEqual(diagramaVazio())
    expect(resultado.aviso).not.toBeNull()
  })
})

describe('salvarDiagrama — falha de gravação (cota, modo privado)', () => {
  it('setItem lançando exceção (cota excedida): devolve aviso, não lança', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem = () => {
      throw new DOMException('cota excedida', 'QuotaExceededError')
    }

    let aviso: string | null = null
    expect(() => {
      aviso = salvarDiagrama(armazenamento, diagramaDeExemplo())
    }).not.toThrow()
    expect(aviso).not.toBeNull()
  })
})
