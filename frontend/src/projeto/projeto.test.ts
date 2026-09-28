/**
 * Testes de `projeto.ts` (spec 002, tarefa #26). `Storage` falso em memória,
 * como em `../ladder/persistencia.test.ts` — sem depender de jsdom.
 */
import { describe, expect, it } from 'vitest'

import { diagramaVazio, inserirElemento } from '../ladder/edicao'
import { COLUNA_TERMINAL } from '../ladder/modelo'
import type { Diagrama } from '../ladder/modelo'
import { CHAVE_DIAGRAMA, salvarDiagrama } from '../ladder/persistencia'
import {
  CHAVE_PROJETO,
  ESQUELETO_ST,
  TITULO_PADRAO,
  carregarProjeto,
  novoProjeto,
  projetoTemConteudo,
  salvarProjeto,
  validarTitulo,
} from './projeto'
import type { Projeto } from './projeto'

/** `Storage` falso em memória — implementa a interface inteira. */
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
  const resultado = inserirElemento(diagramaVazio(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
  if (!resultado.ok) throw new Error('fixture inválida')
  return resultado.diagrama
}

describe('novoProjeto', () => {
  it('LD começa com diagramaVazio() e título aparado', () => {
    const projeto = novoProjeto('  Meu projeto  ', 'ld')
    expect(projeto).toEqual({ versao: 1, titulo: 'Meu projeto', linguagem: 'ld', diagrama: diagramaVazio() })
  })

  it('ST começa com ESQUELETO_ST e título aparado', () => {
    const projeto = novoProjeto('  Meu projeto  ', 'st')
    expect(projeto).toEqual({ versao: 1, titulo: 'Meu projeto', linguagem: 'st', fonte: ESQUELETO_ST })
  })
})

describe('validarTitulo', () => {
  it('aceita título de 1 a 60 caracteres, aparado', () => {
    expect(validarTitulo('a')).toBeNull()
    expect(validarTitulo('  Projeto válido  ')).toBeNull()
    expect(validarTitulo('a'.repeat(60))).toBeNull()
  })

  it('recusa título em branco (só espaços)', () => {
    expect(validarTitulo('   ')).not.toBeNull()
    expect(validarTitulo('')).not.toBeNull()
  })

  it('recusa título com mais de 60 caracteres (após aparar)', () => {
    const motivo = validarTitulo('a'.repeat(61))
    expect(motivo).not.toBeNull()
    expect(motivo).toMatch(/60/)
  })
})

describe('projetoTemConteudo', () => {
  it('LD vazio (um degrau sem elemento nem ramo, sem variável): false', () => {
    const projeto = novoProjeto('t', 'ld')
    expect(projetoTemConteudo(projeto)).toBe(false)
  })

  it('LD com elemento em algum degrau: true', () => {
    const projeto: Projeto = { versao: 1, titulo: 't', linguagem: 'ld', diagrama: diagramaDeExemplo() }
    expect(projetoTemConteudo(projeto)).toBe(true)
  })

  it('LD com variável declarada, mesmo sem elemento: true', () => {
    const diagrama: Diagrama = { ...diagramaVazio(), variaveis: [{ nome: 'x', tipo: 'BOOL' }] }
    const projeto: Projeto = { versao: 1, titulo: 't', linguagem: 'ld', diagrama }
    expect(projetoTemConteudo(projeto)).toBe(true)
  })

  it('LD com mais de um degrau, mesmo vazios: true', () => {
    const vazio = diagramaVazio()
    const diagrama: Diagrama = { ...vazio, rungs: [...vazio.rungs, { id: 'r2', elementos: [], ramos: [] }] }
    const projeto: Projeto = { versao: 1, titulo: 't', linguagem: 'ld', diagrama }
    expect(projetoTemConteudo(projeto)).toBe(true)
  })

  it('ST igual a ESQUELETO_ST: false', () => {
    const projeto = novoProjeto('t', 'st')
    expect(projetoTemConteudo(projeto)).toBe(false)
  })

  it('ST alterado: true', () => {
    const projeto: Projeto = { versao: 1, titulo: 't', linguagem: 'st', fonte: ESQUELETO_ST + '\n(* mudou *)' }
    expect(projetoTemConteudo(projeto)).toBe(true)
  })
})

describe('ESQUELETO_ST', () => {
  it('tem PROGRAM e CONFIGURATION, no formato que o iec2c espera', () => {
    expect(ESQUELETO_ST).toContain('PROGRAM')
    expect(ESQUELETO_ST).toContain('CONFIGURATION')
    expect(ESQUELETO_ST).toContain('END_PROGRAM')
    expect(ESQUELETO_ST).toContain('END_CONFIGURATION')
  })
})

describe('salvarProjeto / carregarProjeto — ida e volta', () => {
  it('LD: salva e recarrega o mesmo projeto, sem aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    const projeto: Projeto = { versao: 1, titulo: 'Meu LD', linguagem: 'ld', diagrama: diagramaDeExemplo() }

    expect(salvarProjeto(armazenamento, projeto)).toBeNull()

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(projeto)
    expect(resultado.aviso).toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(true)
  })

  it('ST: salva e recarrega o mesmo projeto, sem aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    const projeto: Projeto = { versao: 1, titulo: 'Meu ST', linguagem: 'st', fonte: 'PROGRAM p VAR x : BOOL; END_VAR END_PROGRAM' }

    expect(salvarProjeto(armazenamento, projeto)).toBeNull()

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(projeto)
    expect(resultado.aviso).toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(true)
  })
})

describe('carregarProjeto — nada salvo', () => {
  it('sem nenhuma chave: projeto LD "Sem título" vazio, sem aviso, veioDoArmazenamento false', () => {
    const armazenamento = new ArmazenamentoFalso()
    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(false)
  })
})

describe('carregarProjeto — migração da chave antiga ladderflow:diagrama', () => {
  it('diagrama antigo válido vira projeto LD "Sem título", grava a nova chave e remove a antiga', () => {
    const armazenamento = new ArmazenamentoFalso()
    const diagrama = diagramaDeExemplo()
    salvarDiagrama(armazenamento, diagrama)

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual({ versao: 1, titulo: TITULO_PADRAO, linguagem: 'ld', diagrama })
    expect(resultado.aviso).toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(true)

    expect(armazenamento.getItem(CHAVE_DIAGRAMA)).toBeNull()
    expect(armazenamento.getItem(CHAVE_PROJETO)).not.toBeNull()
    expect(JSON.parse(armazenamento.getItem(CHAVE_PROJETO) as string)).toEqual(resultado.projeto)
  })

  it('diagrama antigo inválido: repassa o aviso, projeto LD "Sem título" vazio, veioDoArmazenamento false', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_DIAGRAMA, '{ isso não é json')

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/diagrama salvo descartado/)
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('setItem falhando na migração: mantém a chave antiga, mas ainda devolve o projeto migrado', () => {
    const armazenamento = new ArmazenamentoFalso()
    const diagrama = diagramaDeExemplo()
    salvarDiagrama(armazenamento, diagrama)

    const setItemOriginal = armazenamento.setItem.bind(armazenamento)
    armazenamento.setItem = (chave: string, valor: string) => {
      if (chave === CHAVE_PROJETO) {
        throw new DOMException('cota excedida', 'QuotaExceededError')
      }
      setItemOriginal(chave, valor)
    }

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual({ versao: 1, titulo: TITULO_PADRAO, linguagem: 'ld', diagrama })
    expect(resultado.aviso).toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(true)

    // A gravação falhou: a chave antiga permanece, e a nova não foi criada.
    expect(armazenamento.getItem(CHAVE_DIAGRAMA)).not.toBeNull()
    expect(armazenamento.getItem(CHAVE_PROJETO)).toBeNull()
  })
})

describe('carregarProjeto — casos de descarte (ladderflow:projeto presente e inválido)', () => {
  it('JSON corrompido: projeto LD "Sem título" vazio + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_PROJETO, '{ isso não é json')

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/json/i)
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('versão desconhecida (99): projeto LD "Sem título" vazio + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(
      CHAVE_PROJETO,
      JSON.stringify({ versao: 99, titulo: 'x', linguagem: 'ld', diagrama: diagramaVazio() }),
    )

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/vers[ãa]o/i)
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('linguagem desconhecida: projeto LD "Sem título" vazio + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_PROJETO, JSON.stringify({ versao: 1, titulo: 'x', linguagem: 'py', fonte: 'print()' }))

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/linguagem/i)
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('título salvo não é um texto: projeto LD "Sem título" vazio + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_PROJETO, JSON.stringify({ versao: 1, titulo: 42, linguagem: 'ld', diagrama: diagramaVazio() }))

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.aviso).toMatch(/t[íi]tulo/i)
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('diagrama LD estruturalmente inválido: projeto LD "Sem título" vazio + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(
      CHAVE_PROJETO,
      JSON.stringify({ versao: 1, titulo: 'x', linguagem: 'ld', diagrama: { versao: 2, variaveis: [], rungs: [] } }),
    )

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('fonte ST salva não é um texto: projeto LD "Sem título" vazio + aviso', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem(CHAVE_PROJETO, JSON.stringify({ versao: 1, titulo: 'x', linguagem: 'st', fonte: 123 }))

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(false)
  })

  it('getItem lançando exceção: projeto LD "Sem título" vazio + aviso, sem propagar', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.getItem = () => {
      throw new Error('acesso ao armazenamento bloqueado')
    }

    const resultado = carregarProjeto(armazenamento)
    expect(resultado.projeto).toEqual(novoProjeto(TITULO_PADRAO, 'ld'))
    expect(resultado.aviso).not.toBeNull()
    expect(resultado.veioDoArmazenamento).toBe(false)
  })
})

describe('salvarProjeto — falha de gravação (cota, modo privado)', () => {
  it('setItem lançando exceção: devolve aviso, não lança', () => {
    const armazenamento = new ArmazenamentoFalso()
    armazenamento.setItem = () => {
      throw new DOMException('cota excedida', 'QuotaExceededError')
    }

    let aviso: string | null = null
    expect(() => {
      aviso = salvarProjeto(armazenamento, novoProjeto('t', 'ld'))
    }).not.toThrow()
    expect(aviso).not.toBeNull()
  })
})
