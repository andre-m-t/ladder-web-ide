import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL } from './modelo'
import type { Diagrama, Elemento } from './modelo'
import { IO_ESPELHO } from './fixtures'
import {
  declararVariavel,
  diagramaVazio,
  inserirElemento,
  removerElemento,
  vincularVariavel,
} from './edicao'

/** Congela `diagrama` recursivamente, para que qualquer mutação acidental
 * lance `TypeError` (o teste roda em módulos ES, que são sempre `strict`). */
function congelarProfundo<T>(valor: T): T {
  if (valor !== null && typeof valor === 'object') {
    Object.values(valor as object).forEach(congelarProfundo)
    Object.freeze(valor)
  }
  return valor
}

describe('diagramaVazio', () => {
  it('um degrau vazio, id r1, sem variáveis', () => {
    expect(diagramaVazio()).toEqual({
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [], ramos: [] }],
    })
  })
})

describe('inserirElemento', () => {
  it('caminho feliz: insere contato em posição válida, id e1, variavel null', () => {
    const original = congelarProfundo(diagramaVazio())
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = inserirElemento(original, 'r1', 'contato_na', { linha: 0, coluna: 0 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toEqual([
      { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: null },
    ])
    // entrada não foi mutada
    expect(original).toEqual(antes)
  })

  it('ids novos são o menor e<N> livre em todo o diagrama', () => {
    let diagrama = diagramaVazio()
    const r1 = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama

    const r2 = inserirElemento(diagrama, 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!r2.ok) throw new Error('esperava sucesso')
    diagrama = r2.diagrama

    // remove e1: o próximo elemento inserido deve reaproveitar 'e1'
    const semE1 = removerElemento(diagrama, 'e1')
    if (!semE1.ok) throw new Error('esperava sucesso')

    const r3 = inserirElemento(semE1.diagrama, 'r1', 'contato_nf', { linha: 0, coluna: 0 })
    if (!r3.ok) throw new Error('esperava sucesso')
    expect(r3.diagrama.rungs[0].elementos.map((e) => e.id).sort()).toEqual(['e1', 'e2'])
  })

  it('recusa: degrau inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirElemento(diagrama, 'r-fantasma', 'contato_na', { linha: 0, coluna: 0 })
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: posição inválida (bobina fora da última coluna)', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirElemento(diagrama, 'r1', 'bobina', { linha: 0, coluna: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
  })

  it('recusa: célula ocupada', () => {
    const base = diagramaVazio()
    const comContato = inserirElemento(base, 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = inserirElemento(diagrama, 'r1', 'contato_nf', { linha: 0, coluna: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('ocupada')
  })
})

describe('removerElemento', () => {
  it('caminho feliz: remove o elemento, sem mutar a entrada', () => {
    const base = diagramaVazio()
    const comElemento = inserirElemento(base, 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comElemento.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comElemento.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = removerElemento(original, 'e1')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toEqual([])
    expect(original).toEqual(antes)
  })

  it('não deixa vínculo pendente: elemento vinculado, depois removido, some por completo', () => {
    let diagrama = diagramaVazio()
    diagrama = (declararVariavel(diagrama, { nome: 'x' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (vincularVariavel(diagrama, 'e1', 'x') as { ok: true; diagrama: Diagrama }).diagrama

    const resultado = removerElemento(diagrama, 'e1')
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toEqual([])
    // a variável declarada continua existindo — só o vínculo (que morava no elemento) sumiu
    expect(resultado.diagrama.variaveis).toEqual([{ nome: 'x', tipo: 'BOOL' }])
  })

  it('recusa: elemento inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = removerElemento(diagrama, 'e-fantasma')
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })
})

describe('declararVariavel', () => {
  it('caminho feliz: variável interna, sem endereco', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = declararVariavel(diagrama, { nome: 'entrada' })
    expect(resultado).toEqual({
      ok: true,
      diagrama: { versao: 1, variaveis: [{ nome: 'entrada', tipo: 'BOOL' }], rungs: [{ id: 'r1', elementos: [], ramos: [] }] },
    })
  })

  it('caminho feliz: variável localizada, endereco válido', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = declararVariavel(diagrama, { nome: 'entrada', endereco: '%IX0.0' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.variaveis).toEqual([{ nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.0' }])
  })

  it('recusa: nome vazio', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = declararVariavel(diagrama, { nome: '' })
    expect(resultado.ok).toBe(false)
  })

  it('recusa: nome inválido para identificador IEC (começa com dígito)', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = declararVariavel(diagrama, { nome: '1entrada' })
    expect(resultado.ok).toBe(false)
  })

  it('recusa: nome duplicado', () => {
    const primeira = declararVariavel(diagramaVazio(), { nome: 'x' })
    if (!primeira.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(primeira.diagrama)

    const resultado = declararVariavel(diagrama, { nome: 'x' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('já existe uma variável')
  })

  it('recusa: endereço fora de ENDERECOS_LOCALIZADOS', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = declararVariavel(diagrama, { nome: 'x', endereco: '%QX9.9' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('controlador')
  })

  it('recusa: endereço já usado por outra variável', () => {
    const primeira = declararVariavel(diagramaVazio(), { nome: 'entrada', endereco: '%IX0.0' })
    if (!primeira.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(primeira.diagrama)

    const resultado = declararVariavel(diagrama, { nome: 'outra', endereco: '%IX0.0' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('em uso')
  })
})

describe('vincularVariavel', () => {
  it('caminho feliz: vincula elemento a variável declarada', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const comElemento = inserirElemento(comVariavel.diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comElemento.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comElemento.diagrama)

    const resultado = vincularVariavel(original, 'e1', 'x')
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos[0].variavel).toBe('x')
  })

  it('recusa: elemento inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = vincularVariavel(diagrama, 'e-fantasma', null)
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: variável inexistente', () => {
    const comElemento = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comElemento.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comElemento.diagrama)

    const resultado = vincularVariavel(diagrama, 'e1', 'fantasma')
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('inexistente')
  })
})

/** Normaliza ids de elemento para e1, e2, ... na ordem de varredura
 * (rung, depois linha, depois coluna), para comparar com a fixture sem
 * depender da ordem de inserção usada para construir o diagrama. */
function normalizarIds(diagrama: Diagrama): Diagrama {
  const elementosEmOrdem: Elemento[] = []
  for (const rung of diagrama.rungs) {
    const ordenados = [...rung.elementos].sort((a, b) =>
      a.celula.linha - b.celula.linha || a.celula.coluna - b.celula.coluna,
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

describe('IO_ESPELHO construído só com edicao.ts', () => {
  it('resulta no mesmo diagrama da fixture, ignorando ids', () => {
    let diagrama = diagramaVazio()

    diagrama = (declararVariavel(diagrama, { nome: 'entrada', endereco: '%IX0.1' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (declararVariavel(diagrama, { nome: 'saida', endereco: '%QX0.1' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL }) as { ok: true; diagrama: Diagrama }).diagrama

    const primeiroElemento = diagrama.rungs[0].elementos.find((e) => e.tipo === 'contato_na')
    diagrama = (vincularVariavel(diagrama, (primeiroElemento as Elemento).id, 'entrada') as { ok: true; diagrama: Diagrama }).diagrama
    const segundoElemento = diagrama.rungs[0].elementos.find((e) => e.tipo === 'bobina')
    diagrama = (vincularVariavel(diagrama, (segundoElemento as Elemento).id, 'saida') as { ok: true; diagrama: Diagrama }).diagrama

    expect(normalizarIds(diagrama)).toEqual(normalizarIds(IO_ESPELHO))
  })
})
