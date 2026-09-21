import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL, LINHAS_EXTRAS_MAX } from './modelo'
import type { Diagrama, ElementoCtu, Rung } from './modelo'
import { criarRamo, declararVariavel, diagramaVazio, inserirElemento } from './edicao'
import {
  PV_MAX,
  PV_MIN,
  PV_PADRAO,
  atualizarCtu,
  criarCtu,
  linhaResetLivre,
  motivoPosicaoCtu,
  planoDeRamoComCtu,
  problemasDoCtu,
} from './ctu'

/** Congela `valor` recursivamente — mesmo padrão de `edicao.test.ts`, para
 * provar que nenhuma função de `ctu.ts` muta o diagrama recebido. */
function congelarProfundo<T>(valor: T): T {
  if (valor !== null && typeof valor === 'object') {
    Object.values(valor as object).forEach(congelarProfundo)
    Object.freeze(valor)
  }
  return valor
}

describe('linhaResetLivre', () => {
  it('degrau vazio: linha 1 (a primeira)', () => {
    expect(linhaResetLivre(diagramaVazio().rungs[0])).toBe(1)
  })

  it('linha 1 ocupada por ramo: devolve a 2', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 0)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    expect(linhaResetLivre(comRamo.diagrama.rungs[0])).toBe(2)
  })

  it('linha 1 ocupada por um elemento (sem ramo): também conta como ocupada', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [{ id: 'c1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: null }],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
    }
    expect(linhaResetLivre(rung)).toBe(2)
  })

  it('todas as linhas extras ocupadas: null', () => {
    let diagrama = diagramaVazio()
    for (let i = 0; i < LINHAS_EXTRAS_MAX; i++) {
      const r = criarRamo(diagrama, 'r1', 0)
      if (!r.ok) throw new Error('esperava sucesso')
      diagrama = r.diagrama
    }
    expect(linhaResetLivre(diagrama.rungs[0])).toBe(null)
  })

  it('preferência (D-7, correção pós-Chromium): busca abaixo do ramo mais baixo já usado, não a menor linha livre qualquer', () => {
    // ramo só na linha 1: o reset deve ficar abaixo dele (linha 2), não acima
    const comRamo = criarRamo(diagramaVazio(), 'r1', 0)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    expect(linhaResetLivre(comRamo.diagrama.rungs[0])).toBe(2)
  })

  it('impossível respeitar a preferência (ramo já na linha mais baixa disponível): cai para a menor linha livre — aceita como hoje', () => {
    // ramo só na linha 2 (linha 1 livre): não há linha abaixo da 2 dentro de
    // LINHAS_EXTRAS_MAX, então cai para a busca simples de sempre — a 1
    const rung: Rung = {
      id: 'r1',
      elementos: [],
      ramos: [{ id: 'b1', linha: 2, colunaInicio: 5, colunaFim: 5 }],
    }
    expect(linhaResetLivre(rung)).toBe(1)
  })
})

describe('planoDeRamoComCtu', () => {
  function ctuComReset(linhaReset: number): ElementoCtu {
    return {
      id: 'ctu1',
      tipo: 'ctu',
      celula: { linha: 0, coluna: COLUNA_TERMINAL },
      linhaReset,
      instancia: 'ctu0',
      pv: PV_PADRAO,
      saida: null,
    }
  }

  it('linha candidata na própria linha de reset ou acima dela: sem troca', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    expect(planoDeRamoComCtu(rung, ctuComReset(1), 1)).toEqual({ linhaRamo: 1, novaLinhaReset: null })
  })

  it('linha candidata abaixo do reset e totalmente livre: troca — ramo herda a linha do reset, reset desce', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    expect(planoDeRamoComCtu(rung, ctuComReset(1), 2)).toEqual({ linhaRamo: 1, novaLinhaReset: 2 })
  })

  it('linha candidata abaixo do reset mas já tem ramo (em outra coluna): sem troca — não dá para virar linha de reset', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [{ id: 'b1', linha: 2, colunaInicio: 5, colunaFim: 5 }] }
    expect(planoDeRamoComCtu(rung, ctuComReset(1), 2)).toEqual({ linhaRamo: 2, novaLinhaReset: null })
  })

  it('linha candidata abaixo do reset mas já tem elemento: sem troca', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [{ id: 'c1', tipo: 'contato_na', celula: { linha: 2, coluna: 0 }, variavel: null }],
      ramos: [],
    }
    expect(planoDeRamoComCtu(rung, ctuComReset(1), 2)).toEqual({ linhaRamo: 2, novaLinhaReset: null })
  })

  it('não muta o rung recebido', () => {
    const rung = congelarProfundo({ id: 'r1', elementos: [], ramos: [] } as Rung)
    planoDeRamoComCtu(rung, ctuComReset(1), 2)
    expect(rung).toEqual({ id: 'r1', elementos: [], ramos: [] })
  })
})

describe('criarCtu', () => {
  it('caminho feliz: elemento e1, terminal, linhaReset 1, instancia ctu0, pv padrão, saida null', () => {
    const original = congelarProfundo(diagramaVazio())
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = criarCtu(original, 'r1')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toEqual([
      {
        id: 'e1',
        tipo: 'ctu',
        celula: { linha: 0, coluna: COLUNA_TERMINAL },
        linhaReset: 1,
        instancia: 'ctu0',
        pv: PV_PADRAO,
        saida: null,
      },
    ])
    expect(original).toEqual(antes) // não mutou a entrada
  })

  it('linha 1 ocupada por ramo: o CTU novo usa a linha 2 para o reinício', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 0)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comRamo.diagrama)

    const resultado = criarCtu(diagrama, 'r1')
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    const ctu = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu.linhaReset).toBe(2)
  })

  it('instancia: segundo CTU do diagrama (em outro degrau) ganha ctu1', () => {
    let diagrama = diagramaVazio()
    const comDegrau2 = { ...diagrama, rungs: [...diagrama.rungs, { id: 'r2', elementos: [], ramos: [] }] }
    const r1 = criarCtu(comDegrau2, 'r1')
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama

    const r2 = criarCtu(diagrama, 'r2')
    if (!r2.ok) throw new Error('esperava sucesso')
    const ctu2 = r2.diagrama.rungs[1].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu2.instancia).toBe('ctu1')
  })

  it('instancia: não colide (sem diferenciar caixa) com nome de variável já declarada', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'CTU0' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comVariavel.diagrama)

    const resultado = criarCtu(diagrama, 'r1')
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    const ctu = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu.instancia).toBe('ctu1')
  })

  it('recusa: degrau inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = criarCtu(diagrama, 'r-fantasma')
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: coluna terminal já ocupada', () => {
    const comBobina = inserirElemento(diagramaVazio(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comBobina.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comBobina.diagrama)

    const resultado = criarCtu(diagrama, 'r1')
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('ocupada')
  })

  it('recusa: sem linha livre para o reinício (todas as linhas extras já em uso) — motivo cita Q-3', () => {
    let diagrama = diagramaVazio()
    for (let i = 0; i < LINHAS_EXTRAS_MAX; i++) {
      const r = criarRamo(diagrama, 'r1', 0)
      if (!r.ok) throw new Error('esperava sucesso')
      diagrama = r.diagrama
    }
    const congelado = congelarProfundo(diagrama)

    const resultado = criarCtu(congelado, 'r1')
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('linha livre')
    expect(resultado.motivo).toContain('Q-3')
  })
})

describe('atualizarCtu', () => {
  function diagramaComCtu(): Diagrama {
    const resultado = criarCtu(diagramaVazio(), 'r1')
    if (!resultado.ok) throw new Error('esperava sucesso')
    return resultado.diagrama
  }

  it('caminho feliz: atualiza pv, sem mutar a entrada', () => {
    const original = congelarProfundo(diagramaComCtu())
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = atualizarCtu(original, 'e1', { pv: 25 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    const ctu = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu.pv).toBe(25)
    expect(original).toEqual(antes)
  })

  it('caminho feliz: sem alterações (objeto vazio) mantém pv', () => {
    const diagrama = congelarProfundo(diagramaComCtu())
    const resultado = atualizarCtu(diagrama, 'e1', {})
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    const ctu = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu.pv).toBe(PV_PADRAO)
  })

  it('recusa: pv abaixo de PV_MIN', () => {
    const diagrama = congelarProfundo(diagramaComCtu())
    const resultado = atualizarCtu(diagrama, 'e1', { pv: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain(`${PV_MIN}`)
    expect(resultado.motivo).toContain(`${PV_MAX}`)
  })

  it('recusa: pv acima de PV_MAX', () => {
    const diagrama = congelarProfundo(diagramaComCtu())
    const resultado = atualizarCtu(diagrama, 'e1', { pv: PV_MAX + 1 })
    expect(resultado.ok).toBe(false)
  })

  it('recusa: pv não inteiro', () => {
    const diagrama = congelarProfundo(diagramaComCtu())
    const resultado = atualizarCtu(diagrama, 'e1', { pv: 2.5 })
    expect(resultado.ok).toBe(false)
  })

  it('recusa: elemento inexistente', () => {
    const diagrama = congelarProfundo(diagramaComCtu())
    const resultado = atualizarCtu(diagrama, 'e-fantasma', { pv: 5 })
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: elemento existe mas não é CTU', () => {
    const comContato = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = atualizarCtu(diagrama, 'e1', { pv: 5 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('não é um contador CTU')
  })
})

describe('motivoPosicaoCtu', () => {
  function rungComCtu(linhaReset: number): Rung {
    return {
      id: 'r1',
      elementos: [
        {
          id: 'ctu1',
          tipo: 'ctu',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaReset,
          instancia: 'ctu0',
          pv: PV_PADRAO,
          saida: null,
        },
      ],
      ramos: [],
    }
  }

  it('tipo ctu: válido só em (linha 0, COLUNA_TERMINAL) — decide sozinho (null)', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    expect(motivoPosicaoCtu(rung, 'ctu', { linha: 0, coluna: COLUNA_TERMINAL }, 'degrau 1, coluna 8')).toBe(null)
  })

  it('tipo ctu: fora da coluna terminal — recusa (string), nunca undefined', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    const motivo = motivoPosicaoCtu(rung, 'ctu', { linha: 0, coluna: 2 }, 'degrau 1, coluna 3')
    expect(typeof motivo).toBe('string')
    expect(motivo).toContain('posição inválida')
  })

  it('contato na linha de reset, antes da coluna terminal: válido (null)', () => {
    const rung = rungComCtu(1)
    expect(motivoPosicaoCtu(rung, 'contato_na', { linha: 1, coluna: 3 }, 'degrau 1, ramo 1, coluna 4')).toBe(null)
  })

  it('bobina na linha de reset: inválida (string) — terminal não entra na linha de reset', () => {
    const rung = rungComCtu(1)
    const motivo = motivoPosicaoCtu(rung, 'bobina', { linha: 1, coluna: COLUNA_TERMINAL }, 'degrau 1, ramo 1, coluna 8')
    expect(typeof motivo).toBe('string')
    expect(motivo).toContain('reinício')
  })

  it('contato na coluna terminal da linha de reset: inválido — coluna reservada mesmo ali', () => {
    const rung = rungComCtu(1)
    const motivo = motivoPosicaoCtu(
      rung,
      'contato_na',
      { linha: 1, coluna: COLUNA_TERMINAL },
      'degrau 1, ramo 1, coluna 8',
    )
    expect(typeof motivo).toBe('string')
  })

  it('linha > 0 sem CTU no degrau: undefined — não é regra do CTU, segue o genérico', () => {
    const rung: Rung = { id: 'r1', elementos: [], ramos: [] }
    expect(motivoPosicaoCtu(rung, 'contato_na', { linha: 1, coluna: 0 }, 'degrau 1, ramo 1, coluna 1')).toBeUndefined()
  })

  it('linha > 0 com CTU, mas linha diferente da linha de reset: undefined — segue o genérico (é linha de ramo comum)', () => {
    const rung = rungComCtu(1)
    expect(motivoPosicaoCtu(rung, 'contato_na', { linha: 2, coluna: 0 }, 'degrau 1, ramo 2, coluna 1')).toBeUndefined()
  })

  it('linha 0, sem ser ctu: undefined — decisão de bobina/contato é do genérico', () => {
    const rung = rungComCtu(1)
    expect(motivoPosicaoCtu(rung, 'contato_na', { linha: 0, coluna: 0 }, 'degrau 1, coluna 1')).toBeUndefined()
  })
})

describe('problemasDoCtu', () => {
  function diagramaComCtu(pv: number): Diagrama {
    return {
      versao: 1,
      variaveis: [],
      rungs: [
        {
          id: 'r1',
          elementos: [
            {
              id: 'e1',
              tipo: 'ctu',
              celula: { linha: 0, coluna: COLUNA_TERMINAL },
              linhaReset: 1,
              instancia: 'ctu0',
              pv,
              saida: null,
            },
          ],
          ramos: [],
        },
      ],
    }
  }

  it('pv dentro do intervalo: sem problema', () => {
    expect(problemasDoCtu(diagramaComCtu(PV_PADRAO))).toEqual([])
  })

  it('pv fora do intervalo (só alcançável fora da edição normal): ctu_limite_invalido', () => {
    const problemas = problemasDoCtu(diagramaComCtu(0))
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toEqual(
      expect.objectContaining({ codigo: 'ctu_limite_invalido', severidade: 'erro', rungId: 'r1', elementoId: 'e1' }),
    )
    expect(problemas[0].mensagem).toContain('ctu0')
  })

  it('pv não inteiro: também ctu_limite_invalido', () => {
    const problemas = problemasDoCtu(diagramaComCtu(2.5))
    expect(problemas.map((p) => p.codigo)).toEqual(['ctu_limite_invalido'])
  })

  it('degrau sem CTU: sem problema', () => {
    expect(problemasDoCtu(diagramaVazio())).toEqual([])
  })
})
