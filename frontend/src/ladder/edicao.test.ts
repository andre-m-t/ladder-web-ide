import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL, COLUNAS_POR_DEGRAU, LINHAS_EXTRAS_MAX, variavelDoElemento } from './modelo'
import type { Diagrama, Elemento, ElementoCtu, Rung } from './modelo'
import { IO_ESPELHO } from './fixtures'
import { validarDiagrama } from './validacao'
import { PV_PADRAO } from './ctu'
import {
  atualizarVariavel,
  celulaDeSoltura,
  criarRamo,
  declararVariavel,
  diagramaVazio,
  inserirDegrau,
  inserirElemento,
  moverElemento,
  redimensionarRamo,
  removerDegrau,
  removerElemento,
  removerRamo,
  removerVariavel,
  trocarTipoElemento,
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

describe('celulaDeSoltura', () => {
  it('bobina solta na coluna 2 (índice 1) vai para a coluna terminal (índice 7)', () => {
    expect(celulaDeSoltura('bobina', { linha: 0, coluna: 1 })).toEqual({ linha: 0, coluna: COLUNA_TERMINAL })
    expect(COLUNA_TERMINAL).toBe(7)
  })

  it('bobina solta numa linha de ramo de contato ainda vai para a coluna terminal da linha 0', () => {
    const rungVazio = { id: 'r1', elementos: [], ramos: [] }
    expect(celulaDeSoltura('bobina_set', { linha: 1, coluna: 3 }, rungVazio)).toEqual({ linha: 0, coluna: COLUNA_TERMINAL })
  })

  it('bobina solta numa linha com ramo de saída vai para a coluna terminal dessa linha', () => {
    const rung = {
      id: 'r1',
      elementos: [{ id: 'b1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'a' }],
      ramos: [{ id: 'rs1', linha: 1, colunaInicio: COLUNA_TERMINAL, colunaFim: COLUNA_TERMINAL }],
    }
    expect(celulaDeSoltura('bobina', { linha: 1, coluna: COLUNA_TERMINAL }, rung)).toEqual({ linha: 1, coluna: COLUNA_TERMINAL })
    expect(celulaDeSoltura('bobina', { linha: 0, coluna: 3 }, rung)).toEqual({ linha: 0, coluna: COLUNA_TERMINAL })
  })

  it('contato: devolve a mesma célula, sem alterar', () => {
    const celula = { linha: 1, coluna: 3 }
    expect(celulaDeSoltura('contato_na', celula)).toEqual(celula)
    expect(celulaDeSoltura('contato_na', celula)).toBe(celula) // mesma referência, não cópia
  })

  it('composição com inserirElemento: segunda bobina paralela exige ramo de saída', () => {
    const comBobina = inserirElemento(diagramaVazio(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comBobina.ok) throw new Error('esperava sucesso')
    let diagrama = congelarProfundo(comBobina.diagrama)

    const rung = diagrama.rungs[0]
    const destinoSemRamo = celulaDeSoltura('bobina_set', { linha: 0, coluna: 3 }, rung)
    expect(destinoSemRamo).toEqual({ linha: 0, coluna: COLUNA_TERMINAL })
    expect(inserirElemento(diagrama, 'r1', 'bobina_set', destinoSemRamo).ok).toBe(false)

    const comRamo = criarRamo(diagrama, 'r1', COLUNA_TERMINAL)
    if (!comRamo.ok) throw new Error('esperava ramo de saída')
    diagrama = comRamo.diagrama
    const destinoParalelo = celulaDeSoltura('bobina_set', { linha: 1, coluna: COLUNA_TERMINAL }, diagrama.rungs[0])
    const resultado = inserirElemento(diagrama, 'r1', 'bobina_set', destinoParalelo)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toHaveLength(2)
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

  it('recusa: posição inválida (bobina fora da última coluna) — motivo 1-based explica a regra', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirElemento(diagrama, 'r1', 'bobina', { linha: 0, coluna: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
    // explica a regra (bobina só na última coluna do trilho principal), com
    // a coluna terminal em 1-based (a interface rotula a partir de 1)
    expect(resultado.motivo).toContain(`coluna ${COLUNA_TERMINAL + 1}`)
    expect(resultado.motivo).toContain('última coluna')
    // nunca no formato interno linha=/coluna= (0-based)
    expect(resultado.motivo).not.toMatch(/linha=|coluna=/)
  })

  it('recusa: contato na coluna terminal — motivo diz que é reservada a bobinas e onde vão os contatos', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: COLUNA_TERMINAL })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
    expect(resultado.motivo).toContain(`coluna ${COLUNA_TERMINAL + 1}`)
    expect(resultado.motivo).toContain('reservada a bobinas')
    expect(resultado.motivo).toContain(`1 a ${COLUNA_TERMINAL}`)
    expect(resultado.motivo).not.toMatch(/linha=|coluna=/)
  })

  it('recusa: célula ocupada — motivo localiza a célula em degrau/coluna 1-based', () => {
    const base = diagramaVazio()
    const comContato = inserirElemento(base, 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = inserirElemento(diagrama, 'r1', 'contato_nf', { linha: 0, coluna: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('ocupada')
    expect(resultado.motivo).toContain('degrau 1, coluna 1')
    expect(resultado.motivo).not.toMatch(/linha=|coluna=/)
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

describe('inserirDegrau', () => {
  it('caminho feliz: insere no fim de um diagrama de um degrau — id r2', () => {
    const original = congelarProfundo(diagramaVazio())
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = inserirDegrau(original, 1)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs).toEqual([
      { id: 'r1', elementos: [], ramos: [] },
      { id: 'r2', elementos: [], ramos: [] },
    ])
    // entrada não foi mutada
    expect(original).toEqual(antes)
  })

  it('caminho feliz: insere no início — o degrau novo fica na posição 0', () => {
    const primeira = inserirDegrau(diagramaVazio(), 1)
    if (!primeira.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(primeira.diagrama) // r1, r2

    const resultado = inserirDegrau(diagrama, 0)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs.map((r) => r.id)).toEqual(['r3', 'r1', 'r2'])
  })

  it('caminho feliz: insere no meio — os degraus vizinhos mantêm posição relativa', () => {
    const primeira = inserirDegrau(diagramaVazio(), 1)
    if (!primeira.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(primeira.diagrama) // r1, r2

    const resultado = inserirDegrau(diagrama, 1)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })

  it('id novo é o menor r<N> livre em todo o diagrama — preenche a lacuna', () => {
    const comSegundo = inserirDegrau(diagramaVazio(), 1)
    if (!comSegundo.ok) throw new Error('esperava sucesso') // r1, r2

    const semR1 = removerDegrau(comSegundo.diagrama, 'r1')
    if (!semR1.ok) throw new Error('esperava sucesso') // só r2

    const resultado = inserirDegrau(semR1.diagrama, 1)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs.map((r) => r.id)).toEqual(['r2', 'r1'])
  })

  it('recusa: posição negativa', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirDegrau(diagrama, -1)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição de degrau inválida')
  })

  it('recusa: posição além do fim (rungs.length + 1)', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirDegrau(diagrama, 2)
    expect(resultado.ok).toBe(false)
  })

  it('recusa: posição não inteira', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirDegrau(diagrama, 0.5)
    expect(resultado.ok).toBe(false)
  })
})

describe('removerDegrau', () => {
  it('caminho feliz: remove o degrau indicado, sem mutar a entrada', () => {
    const comSegundo = inserirDegrau(diagramaVazio(), 1)
    if (!comSegundo.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comSegundo.diagrama) // r1, r2
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = removerDegrau(original, 'r2')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs).toEqual([{ id: 'r1', elementos: [], ramos: [] }])
    expect(original).toEqual(antes)
  })

  it('CA-6: dois degraus, remover um — o outro continua idêntico', () => {
    const primeira = inserirElemento(diagramaVazio(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!primeira.ok) throw new Error('esperava sucesso')
    const comSegundo = inserirDegrau(primeira.diagrama, 1)
    if (!comSegundo.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comSegundo.diagrama) // r1 com bobina, r2 vazio
    const r1Antes = JSON.parse(JSON.stringify(diagrama.rungs[0]))

    const resultado = removerDegrau(diagrama, 'r2')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs).toEqual([r1Antes])
  })

  it('recusa: degrau inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = removerDegrau(diagrama, 'r-fantasma')
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: último degrau — o diagrama precisa de pelo menos um', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = removerDegrau(diagrama, 'r1')
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('pelo menos um degrau')
  })

  it('variáveis declaradas permanecem após remover o degrau que as usava', () => {
    let diagrama = diagramaVazio()
    diagrama = (declararVariavel(diagrama, { nome: 'x' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirDegrau(diagrama, 1) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r2', 'contato_na', { linha: 0, coluna: 0 }) as { ok: true; diagrama: Diagrama })
      .diagrama
    diagrama = (vincularVariavel(diagrama, 'e1', 'x') as { ok: true; diagrama: Diagrama }).diagrama
    const congelado = congelarProfundo(diagrama)

    const resultado = removerDegrau(congelado, 'r2')
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.variaveis).toEqual([{ nome: 'x', tipo: 'BOOL' }])
  })

  it('CA-7: mover elemento para outro degrau e depois remover a origem não deixa ramo órfão nem id duplicado', () => {
    // ramo em r1, coluna 0; contato de trilho movido para dentro do ramo
    const comRamo = criarRamo(diagramaVazio(), 'r1', 0)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const comContato = inserirElemento(comRamo.diagrama, 'r1', 'contato_na', { linha: 0, coluna: 1 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const comSegundoDegrau = inserirDegrau(comContato.diagrama, 1)
    if (!comSegundoDegrau.ok) throw new Error('esperava sucesso') // r1 (com ramo b1 e elemento e1), r2 vazio

    const movido = moverElemento(comSegundoDegrau.diagrama, 'e1', 'r2', { linha: 0, coluna: 1 })
    if (!movido.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(movido.diagrama)

    const resultado = removerDegrau(diagrama, 'r1')
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    // r1 (e seu ramo b1) sumiu por completo; só resta r2, com o elemento movido
    expect(resultado.diagrama.rungs).toEqual([
      { id: 'r2', elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 1 }, variavel: null }], ramos: [] },
    ])
    // nenhum ramo órfão remanescente e nenhum id de elemento duplicado
    const todosElementos = resultado.diagrama.rungs.flatMap((r) => r.elementos.map((e) => e.id))
    expect(new Set(todosElementos).size).toBe(todosElementos.length)
    expect(resultado.diagrama.rungs.some((r) => r.ramos.some((ramo) => ramo.id === 'b1'))).toBe(false)
  })
})

describe('limite de colunas (CA-10): 9ª coluna (índice 8) além de COLUNAS_POR_DEGRAU', () => {
  it('inserirElemento recusa citando o limite de 8 colunas', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: COLUNAS_POR_DEGRAU })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
    expect(resultado.motivo).toContain(`${COLUNAS_POR_DEGRAU}`)
  })

  it('moverElemento recusa citando o limite de 8 colunas', () => {
    const comContato = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = moverElemento(diagrama, 'e1', 'r1', { linha: 0, coluna: COLUNAS_POR_DEGRAU })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
    expect(resultado.motivo).toContain(`${COLUNAS_POR_DEGRAU}`)
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

describe('trocarTipoElemento', () => {
  it('troca contato NA por NF preservando id, célula e variável', () => {
    const comElemento = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 1 })
    if (!comElemento.ok) throw new Error('esperava sucesso')
    const comVar = vincularVariavel(comElemento.diagrama, 'e1', null)
    if (!comVar.ok) throw new Error('esperava sucesso')

    const resultado = trocarTipoElemento(comVar.diagrama, 'e1', 'contato_nf')
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error(resultado.motivo)
    expect(resultado.diagrama.rungs[0].elementos[0]).toMatchObject({
      id: 'e1',
      tipo: 'contato_nf',
      celula: { linha: 0, coluna: 1 },
      variavel: null,
    })
  })

  it('recusa troca entre famílias contato e bobina', () => {
    const comElemento = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comElemento.ok) throw new Error('esperava sucesso')
    const resultado = trocarTipoElemento(comElemento.diagrama, 'e1', 'bobina')
    expect(resultado.ok).toBe(false)
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
    expect(variavelDoElemento(resultado.diagrama.rungs[0].elementos[0])).toBe('x')
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

describe('moverElemento', () => {
  it('caminho feliz: move para outra célula válida e livre no mesmo degrau, sem mutar a entrada', () => {
    const comContato = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comContato.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = moverElemento(original, 'e1', 'r1', { linha: 0, coluna: 2 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toEqual([
      { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 2 }, variavel: null },
    ])
    expect(original).toEqual(antes)
  })

  it('mesma célula e mesmo degrau: ok, diagrama igual ao original', () => {
    const comContato = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comContato.diagrama)

    const resultado = moverElemento(original, 'e1', 'r1', { linha: 0, coluna: 0 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama).toEqual(original)
  })

  it('recusa: elemento inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = moverElemento(diagrama, 'e-fantasma', 'r1', { linha: 0, coluna: 0 })
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: degrau destino inexistente', () => {
    const comContato = inserirElemento(diagramaVazio(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = moverElemento(diagrama, 'e1', 'r-fantasma', { linha: 0, coluna: 1 })
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: célula destino ocupada por outro elemento', () => {
    let diagrama = diagramaVazio()
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_nf', { linha: 0, coluna: 1 }) as { ok: true; diagrama: Diagrama }).diagrama
    const congelado = congelarProfundo(diagrama)

    const resultado = moverElemento(congelado, 'e1', 'r1', { linha: 0, coluna: 1 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('ocupada')
    expect(resultado.motivo).toContain('degrau 1, coluna 2')
  })

  it('recusa: posição inválida para o tipo — motivo 1-based com o degrau destino', () => {
    const comBobina = inserirElemento(diagramaVazio(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comBobina.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comBobina.diagrama)

    // bobina só pode ficar na coluna terminal
    const resultado = moverElemento(diagrama, 'e1', 'r1', { linha: 0, coluna: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
    expect(resultado.motivo).toContain('última coluna')
    expect(resultado.motivo).not.toMatch(/linha=|coluna=/)
  })

  it('move entre degraus: remove da origem, insere no destino, mantém id e vínculo', () => {
    const doisRungs: Diagrama = {
      versao: 1,
      variaveis: [{ nome: 'x', tipo: 'BOOL' }],
      rungs: [
        {
          id: 'r1',
          elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'x' }],
          ramos: [],
        },
        { id: 'r2', elementos: [], ramos: [] },
      ],
    }
    const original = congelarProfundo(doisRungs)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = moverElemento(original, 'e1', 'r2', { linha: 0, coluna: 3 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos).toEqual([])
    expect(resultado.diagrama.rungs[1].elementos).toEqual([
      { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 3 }, variavel: 'x' },
    ])
    expect(original).toEqual(antes)
  })

  it('recusa de posição inválida ao mover entre degraus cita o índice do degrau destino', () => {
    const doisRungs: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [
        {
          id: 'r1',
          elementos: [{ id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: null }],
          ramos: [],
        },
        { id: 'r2', elementos: [], ramos: [] },
      ],
    }
    const diagrama = congelarProfundo(doisRungs)

    // fora da grade: mensagem passa por descreverCelula, que rotula o degrau
    // pelo índice do DESTINO (r2, índice 1), não pelo de origem (r1)
    const resultado = moverElemento(diagrama, 'e1', 'r2', { linha: 0, coluna: 99 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('degrau 2')
    expect(resultado.motivo).toContain('fora da grade')
  })
})

describe('contatos e ramos: inserirElemento/moverElemento respeitam o intervalo do ramo', () => {
  function diagramaComRamo(): Diagrama {
    const base: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [{ id: 'r1', elementos: [], ramos: [{ id: 'b1', linha: 1, colunaInicio: 1, colunaFim: 3 }] }],
    }
    return base
  }

  it('inserirElemento aceita contato dentro do intervalo do ramo', () => {
    const diagrama = congelarProfundo(diagramaComRamo())
    const resultado = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 1, coluna: 2 })
    expect(resultado.ok).toBe(true)
  })

  it('inserirElemento recusa contato fora do intervalo do ramo (mesma linha, coluna fora)', () => {
    const diagrama = congelarProfundo(diagramaComRamo())
    const resultado = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 1, coluna: 4 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('não tem ramo declarado')
  })

  it('inserirElemento recusa bobina dentro do ramo (bobina só no trilho principal)', () => {
    const diagrama = congelarProfundo(diagramaComRamo())
    const resultado = inserirElemento(diagrama, 'r1', 'bobina', { linha: 1, coluna: 2 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('última coluna')
  })

  it('moverElemento aceita mover contato do trilho para dentro do ramo', () => {
    const comContato = inserirElemento(diagramaComRamo(), 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = moverElemento(diagrama, 'e1', 'r1', { linha: 1, coluna: 1 })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].elementos[0].celula).toEqual({ linha: 1, coluna: 1 })
  })

  it('moverElemento recusa mover contato para fora do intervalo do ramo', () => {
    const comContato = inserirElemento(diagramaComRamo(), 'r1', 'contato_na', { linha: 1, coluna: 1 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)

    const resultado = moverElemento(diagrama, 'e1', 'r1', { linha: 1, coluna: 5 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('não tem ramo declarado')
  })

  it('moverElemento recusa mover bobina para dentro do ramo', () => {
    const comBobina = inserirElemento(diagramaComRamo(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comBobina.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comBobina.diagrama)

    const resultado = moverElemento(diagrama, 'e1', 'r1', { linha: 1, coluna: 1 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('última coluna')
  })
})

describe('criarRamo', () => {
  it('caminho feliz: cria na linha 1, colunaInicio === colunaFim === coluna, id b1', () => {
    const original = congelarProfundo(diagramaVazio())
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = criarRamo(original, 'r1', 2)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 2, colunaFim: 2 }])
    // entrada não foi mutada
    expect(original).toEqual(antes)
  })

  it('ids novos são o menor b<N> livre em todo o diagrama', () => {
    let diagrama = diagramaVazio()
    const r1 = criarRamo(diagrama, 'r1', 0)
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama

    const r2 = criarRamo(diagrama, 'r1', 1)
    if (!r2.ok) throw new Error('esperava sucesso')
    diagrama = r2.diagrama

    const semB1 = removerRamo(diagrama, 'b1')
    if (!semB1.ok) throw new Error('esperava sucesso')

    const r3 = criarRamo(semB1.diagrama, 'r1', 3)
    if (!r3.ok) throw new Error('esperava sucesso')
    expect(r3.diagrama.rungs[0].ramos.map((r) => r.id).sort()).toEqual(['b1', 'b2'])
  })

  it('recusa: degrau inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = criarRamo(diagrama, 'r-fantasma', 0)
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('aceita coluna terminal: cria ramo de saída (colunaInicio === colunaFim === terminal)', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = criarRamo(diagrama, 'r1', COLUNA_TERMINAL)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error(resultado.motivo)
    expect(resultado.diagrama.rungs[0].ramos).toEqual([
      { id: 'b1', linha: 1, colunaInicio: COLUNA_TERMINAL, colunaFim: COLUNA_TERMINAL },
    ])
  })

  it('recusa: coluna acima do terminal', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = criarRamo(diagrama, 'r1', COLUNA_TERMINAL + 1)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toBe(
      `ramo só cobre colunas de contato, 1 a ${COLUNA_TERMINAL}, ou a coluna terminal para ramo de saída`,
    )
  })

  it('recusa: coluna negativa', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = criarRamo(diagrama, 'r1', -1)
    expect(resultado.ok).toBe(false)
  })

  it('duas colunas diferentes na mesma linha 1: cada ramo na sua própria linha só se sobrepuserem', () => {
    // colunas diferentes não se sobrepõem — o segundo ramo pode ficar na
    // mesma linha 1 do primeiro
    let diagrama = diagramaVazio()
    const r1 = criarRamo(diagrama, 'r1', 0)
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama

    const r2 = criarRamo(diagrama, 'r1', 5)
    if (!r2.ok) throw new Error('esperava sucesso')
    expect(r2.diagrama.rungs[0].ramos).toEqual([
      { id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 },
      { id: 'b2', linha: 1, colunaInicio: 5, colunaFim: 5 },
    ])
  })

  it('mesma coluna: o segundo ramo vai para a linha 2 (a 1 já está ocupada nessa coluna)', () => {
    let diagrama = diagramaVazio()
    const r1 = criarRamo(diagrama, 'r1', 3)
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama

    const r2 = criarRamo(diagrama, 'r1', 3)
    if (!r2.ok) throw new Error('esperava sucesso')
    expect(r2.diagrama.rungs[0].ramos).toEqual([
      { id: 'b1', linha: 1, colunaInicio: 3, colunaFim: 3 },
      { id: 'b2', linha: 2, colunaInicio: 3, colunaFim: 3 },
    ])
  })

  it('recusa: sem linha livre além do limite (Q-3) quando todas as linhas extras já cobrem a coluna', () => {
    let diagrama = diagramaVazio()
    for (let linha = 1; linha <= LINHAS_EXTRAS_MAX; linha++) {
      const r = criarRamo(diagrama, 'r1', 3)
      if (!r.ok) throw new Error('esperava sucesso')
      diagrama = r.diagrama
    }
    const congelado = congelarProfundo(diagrama)

    const resultado = criarRamo(congelado, 'r1', 3)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain(`${LINHAS_EXTRAS_MAX}`)
    expect(resultado.motivo).toContain('linha livre')
  })
})

describe('redimensionarRamo', () => {
  it('caminho feliz: estica colunaFim, colunaInicio inalterado, sem mutar a entrada', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 1)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comRamo.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = redimensionarRamo(original, 'b1', { colunaInicio: 1, colunaFim: 4 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 1, colunaFim: 4 }])
    expect(original).toEqual(antes)
  })

  it('igual ao atual: ok, sem mudança de conteúdo', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 1)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comRamo.diagrama)

    const resultado = redimensionarRamo(diagrama, 'b1', { colunaInicio: 1, colunaFim: 1 })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].ramos).toEqual(diagrama.rungs[0].ramos)
  })

  it('recusa: ramo inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = redimensionarRamo(diagrama, 'b-fantasma', { colunaInicio: 0, colunaFim: 2 })
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: colunaFim < colunaInicio', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 3)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comRamo.diagrama)

    const resultado = redimensionarRamo(diagrama, 'b1', { colunaInicio: 3, colunaFim: 1 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toMatch(/coluna final.*antes da coluna inicial/i)
  })

  it('encolhe pela colunaInicio quando a ponta esquerda é puxada', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 1)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    let diagrama = comRamo.diagrama
    const esticado = redimensionarRamo(diagrama, 'b1', { colunaInicio: 1, colunaFim: 4 })
    if (!esticado.ok) throw new Error('esperava sucesso')
    diagrama = esticado.diagrama
    const resultado = redimensionarRamo(diagrama, 'b1', { colunaInicio: 2, colunaFim: 4 })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].ramos[0]).toMatchObject({ colunaInicio: 2, colunaFim: 4 })
  })

  it('recusa: colunaFim >= COLUNA_TERMINAL', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 3)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comRamo.diagrama)

    const resultado = redimensionarRamo(diagrama, 'b1', { colunaInicio: 3, colunaFim: COLUNA_TERMINAL })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toBe(`ramo só cobre colunas de contato, 1 a ${COLUNA_TERMINAL}`)
  })

  it('recusa: sobreposição com outro ramo da mesma linha no mesmo degrau ao esticar', () => {
    let diagrama = diagramaVazio()
    const r1 = criarRamo(diagrama, 'r1', 0) // b1, linha 1, [0,0]
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama
    const r2 = criarRamo(diagrama, 'r1', 5) // b2, linha 1, [5,5] (0 e 5 não se sobrepõem)
    if (!r2.ok) throw new Error('esperava sucesso')
    diagrama = r2.diagrama
    const congelado = congelarProfundo(diagrama)

    // esticar b1 até 5 invadiria b2
    const resultado = redimensionarRamo(congelado, 'b1', { colunaInicio: 0, colunaFim: 5 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('sobrep')
  })

  it('recusa: encolher deixando um contato de fora do novo intervalo', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 1)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    let diagrama = comRamo.diagrama
    const r2 = redimensionarRamo(diagrama, 'b1', { colunaInicio: 1, colunaFim: 4 })
    if (!r2.ok) throw new Error('esperava sucesso')
    diagrama = r2.diagrama
    const comContato = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 1, coluna: 4 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const congelado = congelarProfundo(comContato.diagrama)

    const resultado = redimensionarRamo(congelado, 'b1', { colunaInicio: 1, colunaFim: 2 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('degrau 1, ramo 1, coluna 5')
    expect(resultado.motivo).toContain('fora do novo intervalo')
  })
})

describe('removerRamo', () => {
  it('caminho feliz: remove ramo sem elementos dentro, sem mutar a entrada', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 1)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comRamo.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = removerRamo(original, 'b1')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].ramos).toEqual([])
    expect(original).toEqual(antes)
  })

  it('recusa: ramo inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = removerRamo(diagrama, 'b-fantasma')
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: há elemento dentro do intervalo do ramo', () => {
    const comRamo = criarRamo(diagramaVazio(), 'r1', 1)
    if (!comRamo.ok) throw new Error('esperava sucesso')
    const comContato = inserirElemento(comRamo.diagrama, 'r1', 'contato_na', { linha: 1, coluna: 1 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const congelado = congelarProfundo(comContato.diagrama)

    const resultado = removerRamo(congelado, 'b1')
    expect(resultado).toEqual({ ok: false, motivo: 'remova os contatos do ramo antes' })
  })
})

describe('cenário: contato de selo (partida NA + motor NA em ramo + parada NF + bobina motor)', () => {
  it('monta o diagrama pelas operações de edicao.ts e valida sem problemas', () => {
    let diagrama = diagramaVazio()

    diagrama = (declararVariavel(diagrama, { nome: 'partida', endereco: '%IX0.0' }) as { ok: true; diagrama: Diagrama })
      .diagrama
    diagrama = (declararVariavel(diagrama, { nome: 'parada', endereco: '%IX0.1' }) as { ok: true; diagrama: Diagrama })
      .diagrama
    diagrama = (declararVariavel(diagrama, { nome: 'motor', endereco: '%QX0.0' }) as { ok: true; diagrama: Diagrama })
      .diagrama

    // NA partida em (0,0)
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 }) as {
      ok: true
      diagrama: Diagrama
    }).diagrama
    // ramo saindo da coluna 0 (a mesma coluna de 'partida', como um selo)
    const comRamo = criarRamo(diagrama, 'r1', 0)
    if (!comRamo.ok) throw new Error('esperava sucesso ao criar ramo')
    expect(comRamo.diagrama.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }])
    diagrama = comRamo.diagrama

    // NA motor em (1,0), dentro do ramo
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 1, coluna: 0 }) as {
      ok: true
      diagrama: Diagrama
    }).diagrama
    // NF parada em (0,1)
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_nf', { linha: 0, coluna: 1 }) as {
      ok: true
      diagrama: Diagrama
    }).diagrama
    // bobina motor em (0, COLUNA_TERMINAL)
    diagrama = (inserirElemento(diagrama, 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL }) as {
      ok: true
      diagrama: Diagrama
    }).diagrama

    // vincula cada elemento à sua variável
    const partidaEl = diagrama.rungs[0].elementos.find((e) => e.celula.linha === 0 && e.celula.coluna === 0) as Elemento
    diagrama = (vincularVariavel(diagrama, partidaEl.id, 'partida') as { ok: true; diagrama: Diagrama }).diagrama
    const motorContatoEl = diagrama.rungs[0].elementos.find(
      (e) => e.celula.linha === 1 && e.celula.coluna === 0,
    ) as Elemento
    diagrama = (vincularVariavel(diagrama, motorContatoEl.id, 'motor') as { ok: true; diagrama: Diagrama }).diagrama
    const paradaEl = diagrama.rungs[0].elementos.find((e) => e.celula.linha === 0 && e.celula.coluna === 1) as Elemento
    diagrama = (vincularVariavel(diagrama, paradaEl.id, 'parada') as { ok: true; diagrama: Diagrama }).diagrama
    const bobinaEl = diagrama.rungs[0].elementos.find((e) => e.tipo === 'bobina') as Elemento
    diagrama = (vincularVariavel(diagrama, bobinaEl.id, 'motor') as { ok: true; diagrama: Diagrama }).diagrama

    expect(validarDiagrama(diagrama)).toEqual([])
  })
})

describe('atualizarVariavel', () => {
  it('caminho feliz: renomeia e propaga para o elemento vinculado, sem mutar a entrada', () => {
    let diagrama = diagramaVazio()
    diagrama = (declararVariavel(diagrama, { nome: 'x' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (vincularVariavel(diagrama, 'e1', 'x') as { ok: true; diagrama: Diagrama }).diagrama
    const original = congelarProfundo(diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = atualizarVariavel(original, 'x', { nome: 'y' })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.variaveis).toEqual([{ nome: 'y', tipo: 'BOOL' }])
    expect(variavelDoElemento(resultado.diagrama.rungs[0].elementos[0])).toBe('y')
    expect(original).toEqual(antes)
  })

  it('caminho feliz: adiciona endereço a variável interna', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comVariavel.diagrama)

    const resultado = atualizarVariavel(diagrama, 'x', { nome: 'x', endereco: '%IX0.0' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.variaveis).toEqual([{ nome: 'x', tipo: 'BOOL', endereco: '%IX0.0' }])
  })

  it('caminho feliz: endereço ausente torna a variável interna', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x', endereco: '%IX0.0' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comVariavel.diagrama)

    const resultado = atualizarVariavel(diagrama, 'x', { nome: 'x' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.variaveis).toEqual([{ nome: 'x', tipo: 'BOOL' }])
  })

  it('caminho feliz: manter o mesmo nome e o mesmo endereço não colide consigo mesma', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x', endereco: '%IX0.0' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comVariavel.diagrama)

    const resultado = atualizarVariavel(diagrama, 'x', { nome: 'x', endereco: '%IX0.0' })
    expect(resultado.ok).toBe(true)
  })

  it('recusa: variável inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = atualizarVariavel(diagrama, 'fantasma', { nome: 'y' })
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: nome inválido para identificador IEC', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comVariavel.diagrama)

    const resultado = atualizarVariavel(diagrama, 'x', { nome: '1invalido' })
    expect(resultado.ok).toBe(false)
  })

  it('recusa: nome duplicado com outra variável', () => {
    let diagrama = diagramaVazio()
    diagrama = (declararVariavel(diagrama, { nome: 'x' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (declararVariavel(diagrama, { nome: 'y' }) as { ok: true; diagrama: Diagrama }).diagrama
    const congelado = congelarProfundo(diagrama)

    const resultado = atualizarVariavel(congelado, 'x', { nome: 'y' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('já existe uma variável')
  })

  it('recusa: endereço fora de ENDERECOS_LOCALIZADOS', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comVariavel.diagrama)

    const resultado = atualizarVariavel(diagrama, 'x', { nome: 'x', endereco: '%QX9.9' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('controlador')
  })

  it('recusa: endereço já usado por outra variável', () => {
    let diagrama = diagramaVazio()
    diagrama = (declararVariavel(diagrama, { nome: 'a', endereco: '%IX0.0' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (declararVariavel(diagrama, { nome: 'b' }) as { ok: true; diagrama: Diagrama }).diagrama
    const congelado = congelarProfundo(diagrama)

    const resultado = atualizarVariavel(congelado, 'b', { nome: 'b', endereco: '%IX0.0' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('em uso')
  })
})

describe('removerVariavel', () => {
  it('caminho feliz: remove variável sem vínculo, sem mutar a entrada', () => {
    const comVariavel = declararVariavel(diagramaVazio(), { nome: 'x' })
    if (!comVariavel.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comVariavel.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = removerVariavel(original, 'x')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.variaveis).toEqual([])
    expect(original).toEqual(antes)
  })

  it('recusa: variável inexistente', () => {
    const diagrama = congelarProfundo(diagramaVazio())
    const resultado = removerVariavel(diagrama, 'fantasma')
    expect(resultado).toEqual({ ok: false, motivo: expect.stringContaining('inexistente') })
  })

  it('recusa: variável vinculada a elementos — motivo conta os vínculos', () => {
    let diagrama = diagramaVazio()
    diagrama = (declararVariavel(diagrama, { nome: 'x' }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (inserirElemento(diagrama, 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL }) as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (vincularVariavel(diagrama, 'e1', 'x') as { ok: true; diagrama: Diagrama }).diagrama
    diagrama = (vincularVariavel(diagrama, 'e2', 'x') as { ok: true; diagrama: Diagrama }).diagrama
    const congelado = congelarProfundo(diagrama)

    const resultado = removerVariavel(congelado, 'x')
    expect(resultado).toEqual({
      ok: false,
      motivo: "variável 'x' está vinculada a 2 elemento(s); desvincule antes de remover",
    })
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

describe('celulaDeSoltura — CTU (tarefa #16, D-7)', () => {
  it('ctu solto em qualquer célula vai para (0, COLUNA_TERMINAL), como bobina (ehTerminal)', () => {
    expect(celulaDeSoltura('ctu', { linha: 1, coluna: 3 })).toEqual({ linha: 0, coluna: COLUNA_TERMINAL })
  })
})

describe('inserirElemento — CTU (tarefa #16, D-7): delega a criarCtu', () => {
  it('caminho feliz: mesma posição/ocupação genéricas de qualquer elemento, resto é de ctu.ts', () => {
    const resultado = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
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
  })

  it('recusa: fora da coluna terminal — mesmo motivo genérico de posição inválida', () => {
    const resultado = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: 2 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
  })

  it('recusa: coluna terminal já ocupada por outro elemento', () => {
    const comBobina = inserirElemento(diagramaVazio(), 'r1', 'bobina', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comBobina.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comBobina.diagrama)

    const resultado = inserirElemento(diagrama, 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('ocupada')
  })
})

describe('inserirElemento — SET/RESET como terminal (tarefa #15)', () => {
  it('bobina_set na coluna terminal: ok', () => {
    const resultado = inserirElemento(diagramaVazio(), 'r1', 'bobina_set', { linha: 0, coluna: COLUNA_TERMINAL })
    expect(resultado.ok).toBe(true)
  })

  it('bobina_reset na coluna terminal: ok', () => {
    const resultado = inserirElemento(diagramaVazio(), 'r1', 'bobina_reset', { linha: 0, coluna: COLUNA_TERMINAL })
    expect(resultado.ok).toBe(true)
  })

  it('bobina_set fora da coluna terminal: recusa citando o trilho principal', () => {
    const resultado = inserirElemento(diagramaVazio(), 'r1', 'bobina_set', { linha: 0, coluna: 0 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('última coluna')
  })

  it('bobina_reset fora da coluna terminal: recusa', () => {
    const resultado = inserirElemento(diagramaVazio(), 'r1', 'bobina_reset', { linha: 0, coluna: 3 })
    expect(resultado.ok).toBe(false)
  })
})

describe('removerElemento — CTU leva os contatos da linha de reset junto (CA-7, D-7)', () => {
  it('remove o CTU e todo elemento na sua linha de reset, preservando o resto do degrau', () => {
    const comCtu = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    const comContatoReset = inserirElemento(comCtu.diagrama, 'r1', 'contato_na', { linha: 1, coluna: 0 })
    if (!comContatoReset.ok) throw new Error('esperava sucesso')
    const comContatoNormal = inserirElemento(comContatoReset.diagrama, 'r1', 'contato_nf', { linha: 0, coluna: 0 })
    if (!comContatoNormal.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContatoNormal.diagrama)
    const ctuId = diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu')?.id as string

    const resultado = removerElemento(diagrama, ctuId)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    // o CTU (e1) e o contato da linha de reset (e2) somem juntos; só sobra o
    // contato fora da linha de reset (e3)
    expect(resultado.diagrama.rungs[0].elementos).toEqual([
      { id: 'e3', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: null },
    ])
  })
})

describe('criarRamo — CTU: troca de lugar com a linha de reset em vez de cair abaixo dela (D-7, correção pós-Chromium)', () => {
  it('CTU com linhaReset 1 e nada mais no degrau: o ramo pega a linha 1 (a do reset), e o reset desce para a 2 — sem mutar a entrada', () => {
    const comCtu = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comCtu.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = criarRamo(original, 'r1', 0)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    // o ramo fica na linha 1 (não cruza mais a linha de reset, que agora é a 2)
    expect(resultado.diagrama.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }])
    const ctu = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu.linhaReset).toBe(2)
    expect(original).toEqual(antes) // entrada intacta
  })

  it('troca leva junto os contatos que já estavam na linha de reset', () => {
    const comCtu = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    const comContatoReset = inserirElemento(comCtu.diagrama, 'r1', 'contato_na', { linha: 1, coluna: 3 })
    if (!comContatoReset.ok) throw new Error('esperava sucesso')
    const original = congelarProfundo(comContatoReset.diagrama)
    const antes = JSON.parse(JSON.stringify(original))

    const resultado = criarRamo(original, 'r1', 0)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    expect(resultado.diagrama.rungs[0].ramos).toEqual([{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }])
    const ctu = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctu.linhaReset).toBe(2)
    // o contato que estava em (1,3) — na linha de reset antiga — segue com o
    // reset para a linha 2, na mesma coluna
    const contato = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'contato_na')
    expect(contato?.celula).toEqual({ linha: 2, coluna: 3 })
    expect(original).toEqual(antes)
  })

  it('sem troca possível (a linha candidata já tem outro ramo, só que em outra coluna): mantém o comportamento de hoje', () => {
    // duas colunas diferentes forçam um ramo em cada linha; remover o da
    // linha 1 e só então criar o CTU faz o reset nascer na linha 1 mesmo com
    // um ramo (b2) já na linha 2 — o caso "impossível de resolver" (a linha 2
    // já não está totalmente livre para virar a nova linha de reset)
    let diagrama = diagramaVazio()
    const r1 = criarRamo(diagrama, 'r1', 5)
    if (!r1.ok) throw new Error('esperava sucesso')
    diagrama = r1.diagrama // b1, linha 1, coluna 5
    const r2 = criarRamo(diagrama, 'r1', 5)
    if (!r2.ok) throw new Error('esperava sucesso')
    diagrama = r2.diagrama // b2, linha 2, coluna 5 (linha 1 já ocupada nessa coluna)
    const semB1 = removerRamo(diagrama, 'b1')
    if (!semB1.ok) throw new Error('esperava sucesso')
    diagrama = semB1.diagrama // só b2 (linha 2) sobra; linha 1 livre de novo

    const comCtu = inserirElemento(diagrama, 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    diagrama = comCtu.diagrama

    const original = congelarProfundo(diagrama)
    const antes = JSON.parse(JSON.stringify(original))
    const ctuAntes = original.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctuAntes.linhaReset).toBe(1) // não dava para reservar a linha 2 (já tinha ramo)

    const resultado = criarRamo(original, 'r1', 0) // coluna 0 não colide com b2 (coluna 5)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    // o novo ramo cai na linha 2, junto com b2 (colunas diferentes) — o
    // reset continua na 1, porque não havia como resolver sem mexer no ramo
    // já existente
    const ramos = resultado.diagrama.rungs[0].ramos
    expect(ramos.find((r) => r.id === 'b2')).toEqual({ id: 'b2', linha: 2, colunaInicio: 5, colunaFim: 5 })
    expect(ramos.some((r) => r.linha === 2 && r.colunaInicio === 0)).toBe(true)
    const ctuDepois = resultado.diagrama.rungs[0].elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctuDepois.linhaReset).toBe(1) // sem troca
    expect(original).toEqual(antes)
  })

  it('CTU consome uma linha extra: depois de preencher as demais com ramos, o próximo ramo recusa (Q-3)', () => {
    let diagrama = diagramaVazio()
    const comCtu = inserirElemento(diagrama, 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    diagrama = comCtu.diagrama // linhaReset = 1

    for (let i = 0; i < LINHAS_EXTRAS_MAX - 1; i++) {
      const r = criarRamo(diagrama, 'r1', 0)
      if (!r.ok) throw new Error('esperava sucesso ao criar ramo')
      diagrama = r.diagrama
    }
    const congelado = congelarProfundo(diagrama)

    const resultado = criarRamo(congelado, 'r1', 0)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('linha livre')
  })
})

describe('moverElemento — CTU (D-7)', () => {
  it('dentro do mesmo degrau, para outra célula: recusa (só há uma posição válida, como bobina)', () => {
    const comCtu = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comCtu.diagrama)
    const ctuId = diagrama.rungs[0].elementos[0].id

    const resultado = moverElemento(diagrama, ctuId, 'r1', { linha: 0, coluna: 2 })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('posição inválida')
  })

  it('para outro degrau: recalcula linhaReset pela linha livre do destino e leva os contatos de reset junto', () => {
    let diagrama = diagramaVazio()
    const comDegrau2 = inserirDegrau(diagrama, 1)
    if (!comDegrau2.ok) throw new Error('esperava sucesso')
    diagrama = comDegrau2.diagrama // r1, r2

    const comCtu = inserirElemento(diagrama, 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    diagrama = comCtu.diagrama // ctu em r1, linhaReset 1

    const comContatoReset = inserirElemento(diagrama, 'r1', 'contato_na', { linha: 1, coluna: 3 })
    if (!comContatoReset.ok) throw new Error('esperava sucesso')
    diagrama = comContatoReset.diagrama

    // ocupa a linha 1 do degrau destino com um ramo, para forçar o recálculo
    // da linha de reset do CTU para a linha 2
    const comRamoDestino = criarRamo(diagrama, 'r2', 5)
    if (!comRamoDestino.ok) throw new Error('esperava sucesso')
    diagrama = comRamoDestino.diagrama

    const congelado = congelarProfundo(diagrama)
    const ctuId = congelado.rungs[0].elementos.find((e) => e.tipo === 'ctu')?.id as string

    const resultado = moverElemento(congelado, ctuId, 'r2', { linha: 0, coluna: COLUNA_TERMINAL })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    const rungDestino = resultado.diagrama.rungs.find((r) => r.id === 'r2') as Rung
    const ctuMovido = rungDestino.elementos.find((e) => e.tipo === 'ctu') as ElementoCtu
    expect(ctuMovido.linhaReset).toBe(2) // linha 1 do destino já tinha o ramo b1
    const contatoMovido = rungDestino.elementos.find((e) => e.tipo === 'contato_na')
    expect(contatoMovido?.celula).toEqual({ linha: 2, coluna: 3 })

    const rungOrigem = resultado.diagrama.rungs.find((r) => r.id === 'r1') as Rung
    expect(rungOrigem.elementos).toEqual([]) // nada ficou órfão na origem
  })

  it('para outro degrau sem linha livre no destino: recusa', () => {
    let diagrama = diagramaVazio()
    const comDegrau2 = inserirDegrau(diagrama, 1)
    if (!comDegrau2.ok) throw new Error('esperava sucesso')
    diagrama = comDegrau2.diagrama

    const comCtu = inserirElemento(diagrama, 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    diagrama = comCtu.diagrama

    for (let i = 0; i < LINHAS_EXTRAS_MAX; i++) {
      const r = criarRamo(diagrama, 'r2', 0)
      if (!r.ok) throw new Error('esperava sucesso ao criar ramo')
      diagrama = r.diagrama
    }
    const congelado = congelarProfundo(diagrama)
    const ctuId = congelado.rungs[0].elementos.find((e) => e.tipo === 'ctu')?.id as string

    const resultado = moverElemento(congelado, ctuId, 'r2', { linha: 0, coluna: COLUNA_TERMINAL })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.motivo).toContain('linha livre')
  })

  it('mover um contato para a linha de reset de um CTU do mesmo degrau: permitido', () => {
    const comCtu = inserirElemento(diagramaVazio(), 'r1', 'ctu', { linha: 0, coluna: COLUNA_TERMINAL })
    if (!comCtu.ok) throw new Error('esperava sucesso')
    const comContato = inserirElemento(comCtu.diagrama, 'r1', 'contato_na', { linha: 0, coluna: 0 })
    if (!comContato.ok) throw new Error('esperava sucesso')
    const diagrama = congelarProfundo(comContato.diagrama)
    const contatoId = diagrama.rungs[0].elementos.find((e) => e.tipo === 'contato_na')?.id as string

    const resultado = moverElemento(diagrama, contatoId, 'r1', { linha: 1, coluna: 0 })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error('esperava sucesso')
    const contatoMovido = resultado.diagrama.rungs[0].elementos.find((e) => e.id === contatoId)
    expect(contatoMovido?.celula).toEqual({ linha: 1, coluna: 0 })
  })
})
