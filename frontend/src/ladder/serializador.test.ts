import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL, type Diagrama, type Ramo, type Rung, type Variavel } from './modelo'
import { validarDiagrama } from './validacao'
import { degrauDaLinha, serializar } from './serializador'
import type { Elemento } from './modelo'

// -- Ajudantes de teste -----------------------------------------------------

/** Diagrama com um único degrau, a partir de elementos e ramos crus — a
 * forma mais direta de exercitar a topologia sem passar pela UI. */
function diagramaDeUmDegrau(elementos: Elemento[], ramos: Ramo[], variaveis: Variavel[]): Diagrama {
  return { versao: 1, variaveis, rungs: [{ id: 'r1', elementos, ramos }] }
}

function variavelInterna(nome: string): Variavel {
  return { nome, tipo: 'BOOL' }
}

/** Todas as combinações booleanas de `nomes`, uma por linha de tabela-verdade. */
function todasCombinacoes(nomes: string[]): Array<Record<string, boolean>> {
  const total = 2 ** nomes.length
  const combinacoes: Array<Record<string, boolean>> = []
  for (let mascara = 0; mascara < total; mascara++) {
    const valores: Record<string, boolean> = {}
    nomes.forEach((nome, indice) => {
      valores[nome] = ((mascara >> indice) & 1) === 1
    })
    combinacoes.push(valores)
  }
  return combinacoes
}

/** Uma célula conduz, dado `valores`? Vazia conduz (D-1); NA = valor da
 * variável; NF = negação. Independente do algoritmo do serializador — é o
 * oráculo usado para provar a topologia, não uma cópia dela. */
function celulaConduz(rung: Rung, linha: number, coluna: number, valores: Record<string, boolean>): boolean {
  const elemento = rung.elementos.find(
    (e) => e.celula.linha === linha && e.celula.coluna === coluna && (e.tipo === 'contato_na' || e.tipo === 'contato_nf'),
  )
  if (elemento === undefined) return true
  const valor = valores[elemento.variavel as string]
  return elemento.tipo === 'contato_na' ? valor : !valor
}

/** O nó `COLUNA_TERMINAL` está energizado, dado `valores`? Simulação direta
 * por alcançabilidade sobre o mesmo grafo (trilho + ramos) que a spec define
 * em D-1, calculada nó a nó em ordem crescente (sempre topológica, ver
 * cabeçalho de `serializador.ts`) — a prova de corretude da topologia,
 * independente da álgebra série-paralelo/propagação do serializador. */
function energizado(rung: Rung, valores: Record<string, boolean>): boolean {
  const numNos = COLUNA_TERMINAL + 1
  const energiaDoNo: boolean[] = [true]
  for (let no = 1; no < numNos; no++) {
    let algumaAresta = celulaConduz(rung, 0, no - 1, valores) && energiaDoNo[no - 1]
    for (const ramo of rung.ramos) {
      if (ramo.colunaFim + 1 !== no) continue
      if (!energiaDoNo[ramo.colunaInicio]) continue
      let serieConduz = true
      for (let coluna = ramo.colunaInicio; coluna <= ramo.colunaFim; coluna++) {
        if (!celulaConduz(rung, ramo.linha, coluna, valores)) {
          serieConduz = false
          break
        }
      }
      algumaAresta = algumaAresta || serieConduz
    }
    energiaDoNo.push(algumaAresta)
  }
  return energiaDoNo[numNos - 1]
}

/** Avaliador mínimo da gramática de expressão que o serializador gera:
 * identificadores, `NOT`, `AND`, `OR`, `TRUE` e parênteses — AND mais forte
 * que OR (D-1). Usado para conferir o texto produzido contra `energizado`,
 * sem se apoiar na implementação interna do serializador. */
function avaliarExpressao(expressao: string, valores: Record<string, boolean>): boolean {
  const tokens = expressao.match(/\(|\)|[A-Za-z_][A-Za-z0-9_]*/g) ?? []
  let posicao = 0
  const veja = () => tokens[posicao]
  const tome = () => tokens[posicao++]

  function ou(): boolean {
    let valor = e()
    while (veja() === 'OR') {
      tome()
      // Nunca usar `||` aqui: precisa SEMPRE consumir o operando da direita
      // (efeito colateral de avançar `posicao`), mesmo quando `valor` já é
      // `true` — `||` faria curto-circuito e desalinharia os tokens.
      const direita = e()
      valor = valor || direita
    }
    return valor
  }
  function e(): boolean {
    let valor = unario()
    while (veja() === 'AND') {
      tome()
      const direita = unario()
      valor = valor && direita
    }
    return valor
  }
  function unario(): boolean {
    if (veja() === 'NOT') {
      tome()
      return !unario()
    }
    return primario()
  }
  function primario(): boolean {
    const tok = tome()
    if (tok === '(') {
      const valor = ou()
      tome() // ')'
      return valor
    }
    if (tok === 'TRUE') return true
    return valores[tok]
  }

  return ou()
}

/** Serializa `diagrama` e extrai a expressão à direita de `:=` (ou de
 * `IF ... THEN`) do único degrau — utilitário só para os testes de
 * topologia, que olham a expressão isolada da bobina que a usa. */
function expressaoDoUnicoDegrau(diagrama: Diagrama): string {
  const resultado = serializar(diagrama)
  if (!resultado.ok) throw new Error(`esperava sucesso, recusou: ${resultado.motivo}`)
  const linhaAtribuicao = resultado.st.split('\n').find((l) => l.includes(':=') || l.includes('THEN'))
  if (linhaAtribuicao === undefined) throw new Error('nenhuma linha de atribuição encontrada')
  const semPontoVirgula = linhaAtribuicao.replace(';', '').trim()
  if (semPontoVirgula.startsWith('IF ')) {
    return semPontoVirgula.slice('IF '.length, semPontoVirgula.length - ' THEN'.length)
  }
  const [, expressao] = semPontoVirgula.split(':=')
  return expressao.trim()
}

/** Confere, para toda combinação de `nomes`, que a expressão gerada e a
 * simulação direta (`energizado`) concordam — é a prova de corretude exigida
 * para os casos simples, aninhado e cruzado. */
function confereTabelaVerdade(rung: Rung, variaveis: Variavel[], nomes: string[]): void {
  const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
  const expressao = expressaoDoUnicoDegrau(diagrama)
  for (const valores of todasCombinacoes(nomes)) {
    expect(avaliarExpressao(expressao, valores)).toBe(energizado(rung, valores))
  }
}

// -- Contatos NA/NF -----------------------------------------------------

describe('contato NA e NF', () => {
  it('NA gera o identificador puro', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('a')
  })

  it('NF gera "NOT identificador"', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('NOT a')
  })
})

// -- Série com lacunas ----------------------------------------------------

describe('série com lacunas', () => {
  it('colunas vazias conduzem (TRUE) e são eliminadas da expressão final', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        // coluna 1 vazia
        { id: 'e2', tipo: 'contato_na', celula: { linha: 0, coluna: 2 }, variavel: 'b' },
        // colunas 3..5 vazias
        { id: 'e3', tipo: 'contato_nf', celula: { linha: 0, coluna: 6 }, variavel: 'c' },
        { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('c'), variavelInterna('x')]
    const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('a AND b AND NOT c')
    confereTabelaVerdade(rung, variaveis, ['a', 'b', 'c'])
  })
})

// -- Ramos ------------------------------------------------------------------

describe('ramo simples', () => {
  it('um contato no trilho em paralelo com um contato no ramo: OR', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('x')]
    const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('a OR b')
    confereTabelaVerdade(rung, variaveis, ['a', 'b'])
  })
})

describe('dois ramos disjuntos na mesma linha', () => {
  it('cada ramo em paralelo com um trecho diferente do trilho', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
        { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 2 }, variavel: 'c' },
        { id: 'e4', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: 'd' },
        { id: 'e5', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [
        { id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 },
        { id: 'b2', linha: 1, colunaInicio: 2, colunaFim: 2 },
      ],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('c'), variavelInterna('d'), variavelInterna('x')]
    const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('(a OR b) AND (c OR d)')
    confereTabelaVerdade(rung, variaveis, ['a', 'b', 'c', 'd'])
  })
})

describe('ramo aninhado', () => {
  it('ramo da linha 2 dentro do intervalo de colunas do ramo da linha 1', () => {
    // linha 1: colunas 0..4 (ramo externo); linha 2: colunas 1..2 (aninhado)
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e0', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'c0' },
        { id: 'e1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'r1c0' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 2, coluna: 1 }, variavel: 'r2c1' },
        { id: 'e3', tipo: 'contato_na', celula: { linha: 2, coluna: 2 }, variavel: 'r2c2' },
        { id: 'e4', tipo: 'contato_na', celula: { linha: 1, coluna: 3 }, variavel: 'r1c3' },
        { id: 'e5', tipo: 'contato_na', celula: { linha: 0, coluna: 5 }, variavel: 'c5' },
        { id: 'e6', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [
        { id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 4 },
        { id: 'b2', linha: 2, colunaInicio: 1, colunaFim: 2 },
      ],
    }
    const nomes = ['c0', 'r1c0', 'r2c1', 'r2c2', 'r1c3', 'c5']
    const variaveis = nomes.map(variavelInterna).concat(variavelInterna('x'))
    confereTabelaVerdade(rung, variaveis, nomes)
  })
})

describe('ramos cruzados (fallback por nó)', () => {
  it('linha 1 colunas 0-2 e linha 2 colunas 1-4: a redução série-paralelo não fecha, propagação por nó assume', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'r1c0' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 1 }, variavel: 'r1c1' },
        { id: 'e3', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: 'r1c2' },
        { id: 'e4', tipo: 'contato_na', celula: { linha: 2, coluna: 1 }, variavel: 'r2c1' },
        { id: 'e5', tipo: 'contato_na', celula: { linha: 2, coluna: 2 }, variavel: 'r2c2' },
        { id: 'e6', tipo: 'contato_na', celula: { linha: 2, coluna: 3 }, variavel: 'r2c3' },
        { id: 'e7', tipo: 'contato_na', celula: { linha: 2, coluna: 4 }, variavel: 'r2c4' },
        { id: 'e8', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [
        { id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 },
        { id: 'b2', linha: 2, colunaInicio: 1, colunaFim: 4 },
      ],
    }
    const nomes = ['r1c0', 'r1c1', 'r1c2', 'r2c1', 'r2c2', 'r2c3', 'r2c4']
    const variaveis = nomes.map(variavelInterna).concat(variavelInterna('x'))
    confereTabelaVerdade(rung, variaveis, nomes)
  })
})

describe('lacuna dentro de ramo', () => {
  it('célula vazia dentro do intervalo do ramo conduz, igual ao trilho', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'a' },
        // coluna 1 do ramo fica vazia — conduz
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('x')]
    const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
    // trilho inteiro vazio (TRUE) em paralelo com o ramo -> o OR inteiro é TRUE
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('TRUE')
    confereTabelaVerdade(rung, variaveis, ['a', 'b'])
  })

  it('lacuna dentro do ramo, sem short-circuit pelo trilho: só reduz para os contatos presentes', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'g' }, // impede o trilho de curto-circuitar o ramo
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'a' },
        // coluna 1 do ramo vazia
        { id: 'e3', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: 'b' },
        { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }],
    }
    const variaveis = [variavelInterna('g'), variavelInterna('a'), variavelInterna('b'), variavelInterna('x')]
    const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
    // AND dentro de OR não precisa de parênteses (AND é mais forte que OR, D-1)
    expect(expressaoDoUnicoDegrau(diagrama)).toBe('g OR a AND b')
    confereTabelaVerdade(rung, variaveis, ['g', 'a', 'b'])
  })
})

// -- Bobinas (D-2) -----------------------------------------------------

describe('bobinas', () => {
  it('degrau só com bobina (nenhum contato): "x := TRUE;"', () => {
    const diagrama = diagramaDeUmDegrau(
      [{ id: 'e1', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' }],
      [],
      [variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.st).toContain('  x := TRUE;')
  })

  it('bobina simples: "x := expr;"', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.st).toContain('  x := a;')
  })

  it('bobina_set: "IF expr THEN\\n    x := TRUE;\\n  END_IF;"', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.st).toContain('  IF a THEN\n    x := TRUE;\n  END_IF;')
    }
  })

  it('bobina_reset: "IF expr THEN\\n    x := FALSE;\\n  END_IF;"', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.st).toContain('  IF a THEN\n    x := FALSE;\n  END_IF;')
    }
  })
})

describe('ordem dos degraus preservada', () => {
  it('SET no degrau 1 e RESET no degrau 2 aparecem nessa ordem no texto', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [variavelInterna('liga'), variavelInterna('desliga'), variavelInterna('q')],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'liga' },
            { id: 'e2', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
          ],
          ramos: [],
        },
        {
          id: 'r2',
          elementos: [
            { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'desliga' },
            { id: 'e4', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
          ],
          ramos: [],
        },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    const indiceSet = resultado.st.indexOf('q := TRUE')
    const indiceReset = resultado.st.indexOf('q := FALSE')
    expect(indiceSet).toBeGreaterThan(-1)
    expect(indiceReset).toBeGreaterThan(indiceSet)
    expect(resultado.mapaLinhas).toHaveLength(2)
    expect(resultado.mapaLinhas[0].rungId).toBe('r1')
    expect(resultado.mapaLinhas[1].rungId).toBe('r2')
  })
})

// -- Declarações (D-3) ---------------------------------------------------

describe('declarações', () => {
  it('VAR de localizadas e VAR de internas em blocos separados', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [
        { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.0' },
        { nome: 'interna', tipo: 'BOOL' },
      ],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
            { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'interna' },
          ],
          ramos: [],
        },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.st).toContain('    entrada AT %IX0.0 : BOOL;')
    expect(resultado.st).toContain('    interna : BOOL;')
    // dois blocos VAR distintos: dois END_VAR
    expect(resultado.st.match(/END_VAR/g)).toHaveLength(2)
  })

  it('bloco vazio (sem variável localizada, ou sem variável interna) é omitido', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [variavelInterna('a'), variavelInterna('x')],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
          ],
          ramos: [],
        },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.st.match(/END_VAR/g)).toHaveLength(1)
    expect(resultado.st).not.toContain('AT %')
  })
})

// -- Recusas D-5 ------------------------------------------------------------

describe('recusas (D-5, revisão do RF-5)', () => {
  it('D-5a: elemento com tipo fora do subconjunto (forjado via cast) é recusado sem st', () => {
    const elementoForjado = {
      id: 'e1',
      tipo: 'contador_crescente',
      celula: { linha: 0, coluna: 0 },
      variavel: 'a',
    } as unknown as Elemento
    const diagrama = diagramaDeUmDegrau(
      [elementoForjado, { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' }],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toContain('contador_crescente')
    expect(resultado.motivo).toContain('degrau 1')
    expect(resultado).not.toHaveProperty('st')
  })

  it.each(['AND', 'and', 'prog0'])('D-5b: nome de variável reservado/fixo "%s" é recusado', (nomeInvalido) => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: nomeInvalido },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna(nomeInvalido), variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toContain(nomeInvalido)
    expect(resultado).not.toHaveProperty('st')
  })

  it('D-5c: "Motor" e "motor" diferem só em maiúsculas/minúsculas — recusado', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [variavelInterna('Motor'), variavelInterna('motor')],
      rungs: [{ id: 'r1', elementos: [], ramos: [] }],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toContain('Motor')
    expect(resultado.motivo).toContain('motor')
  })
})

// -- Vazios D-7 --------------------------------------------------------

describe('vazios (D-7)', () => {
  it('diagrama sem nenhum degrau: vazio, sem st', () => {
    const diagrama: Diagrama = { versao: 1, variaveis: [], rungs: [] }
    const resultado = serializar(diagrama)
    expect(resultado).toEqual({ ok: false, vazio: true, motivo: 'nada a compilar: o diagrama não tem elementos' })
  })

  it('diagrama só com degraus vazios: vazio, sem st', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [],
      rungs: [
        { id: 'r1', elementos: [], ramos: [] },
        { id: 'r2', elementos: [], ramos: [] },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.vazio).toBe(true)
  })

  it('degrau vazio entre dois degraus com conteúdo: omitido do texto, sem aparecer no mapaLinhas', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [variavelInterna('a'), variavelInterna('x')],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
          ],
          ramos: [],
        },
        { id: 'r2', elementos: [], ramos: [] },
        {
          id: 'r3',
          elementos: [
            { id: 'e3', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
          ],
          ramos: [],
        },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.mapaLinhas.map((t) => t.rungId)).toEqual(['r1', 'r3'])
    // "degrau 2" nunca aparece: é o degrau vazio, omitido (mas "degrau 1" e "degrau 3" sim, pelo índice no diagrama)
    expect(resultado.st).not.toContain('degrau 2 *')
    expect(resultado.st).toContain('degrau 1 *')
    expect(resultado.st).toContain('degrau 3 *')
  })
})

// -- mapaLinhas / degrauDaLinha -----------------------------------------

describe('mapaLinhas', () => {
  it('linhaInicio/linhaFim batem com as linhas reais do texto (1-based)', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [variavelInterna('a'), variavelInterna('x')],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
          ],
          ramos: [],
        },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    const linhas = resultado.st.split('\n')
    const trecho = resultado.mapaLinhas[0]
    expect(linhas[trecho.linhaInicio - 1]).toContain('degrau 1')
    expect(linhas[trecho.linhaFim - 1]).toBe('  END_IF;')
  })
})

describe('degrauDaLinha', () => {
  const mapa = [
    { rungId: 'r1', linhaInicio: 5, linhaFim: 6 },
    { rungId: 'r2', linhaInicio: 7, linhaFim: 9 },
  ]

  it('linha dentro de um trecho devolve o rungId', () => {
    expect(degrauDaLinha(mapa, 5)).toBe('r1')
    expect(degrauDaLinha(mapa, 6)).toBe('r1')
    expect(degrauDaLinha(mapa, 8)).toBe('r2')
  })

  it('bordas exatas de cada trecho', () => {
    expect(degrauDaLinha(mapa, 7)).toBe('r2')
    expect(degrauDaLinha(mapa, 9)).toBe('r2')
  })

  it('linha fora de qualquer trecho devolve null', () => {
    expect(degrauDaLinha(mapa, 1)).toBeNull()
    expect(degrauDaLinha(mapa, 4)).toBeNull()
    expect(degrauDaLinha(mapa, 10)).toBeNull()
  })
})

// -- Determinismo ---------------------------------------------------------

describe('determinismo', () => {
  it('duas chamadas com o mesmo diagrama produzem o mesmo texto', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [
        { nome: 'a', tipo: 'BOOL', endereco: '%IX0.0' },
        { nome: 'b', tipo: 'BOOL', endereco: '%IX0.1' },
        { nome: 'q', tipo: 'BOOL', endereco: '%QX0.0' },
      ],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
            { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
          ],
          ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
        },
      ],
    }
    const r1 = serializar(diagrama)
    const r2 = serializar(diagrama)
    expect(r1).toEqual(r2)
  })

  it('mesma grade, ids e ordem de arrays diferentes: mesmo texto', () => {
    const variantA: Diagrama = {
      versao: 1,
      variaveis: [
        { nome: 'a', tipo: 'BOOL', endereco: '%IX0.0' },
        { nome: 'b', tipo: 'BOOL', endereco: '%IX0.1' },
        { nome: 'q', tipo: 'BOOL', endereco: '%QX0.0' },
      ],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
            { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
          ],
          ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
        },
      ],
    }
    const variantB: Diagrama = {
      versao: 1,
      variaveis: [
        { nome: 'a', tipo: 'BOOL', endereco: '%IX0.0' },
        { nome: 'b', tipo: 'BOOL', endereco: '%IX0.1' },
        { nome: 'q', tipo: 'BOOL', endereco: '%QX0.0' },
      ],
      rungs: [
        {
          id: 'degrauZ',
          // ordem invertida dos elementos e ids diferentes: mesma grade
          elementos: [
            { id: 'zz3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
            { id: 'zz1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
            { id: 'zz2', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
          ],
          ramos: [{ id: 'ramoZ', linha: 1, colunaInicio: 0, colunaFim: 0 }],
        },
      ],
    }
    const rA = serializar(variantA)
    const rB = serializar(variantB)
    expect(rA.ok).toBe(true)
    expect(rB.ok).toBe(true)
    if (!rA.ok || !rB.ok) return
    expect(rA.st).toBe(rB.st)
  })
})

// -- ASCII ------------------------------------------------------------------

describe('ASCII', () => {
  it('o texto produzido é 100% ASCII, mesmo com nomes puramente ASCII de entrada', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [],
      [variavelInterna('a'), variavelInterna('x')],
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.st).toMatch(/^[\x00-\x7F]*$/)
  })
})

// -- CA-9: endereços --------------------------------------------------------

describe('CA-9: endereços no texto == endereços do diagrama', () => {
  it('o conjunto de %[IQ]X\\d+\\.\\d+ do texto é igual ao conjunto de endereços das variáveis', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [
        { nome: 'a', tipo: 'BOOL', endereco: '%IX0.0' },
        { nome: 'b', tipo: 'BOOL', endereco: '%IX0.7' },
        { nome: 'q', tipo: 'BOOL', endereco: '%QX0.3' },
        { nome: 'interna', tipo: 'BOOL' },
      ],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
            { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
          ],
          ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
        },
      ],
    }
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    const enderecosNoTexto = new Set(resultado.st.match(/%[IQ]X\d+\.\d+/g) ?? [])
    const enderecosNoDiagrama = new Set(
      diagrama.variaveis.filter((v) => v.endereco !== undefined).map((v) => v.endereco as string),
    )
    expect(enderecosNoTexto).toEqual(enderecosNoDiagrama)
  })
})

// -- Pior caso ---------------------------------------------------------

describe('pior caso', () => {
  it('8 colunas de trilho cheias + 2 linhas de ramo cruzadas: tamanho do texto sob controle', () => {
    const elementos: Elemento[] = []
    const variaveis: Variavel[] = []
    for (let coluna = 0; coluna < COLUNA_TERMINAL; coluna++) {
      const nome = `c${coluna}`
      elementos.push({ id: `t${coluna}`, tipo: 'contato_na', celula: { linha: 0, coluna }, variavel: nome })
      variaveis.push(variavelInterna(nome))
    }
    for (let coluna = 1; coluna <= 4; coluna++) {
      const nome = `r1c${coluna}`
      elementos.push({ id: `r1_${coluna}`, tipo: 'contato_na', celula: { linha: 1, coluna }, variavel: nome })
      variaveis.push(variavelInterna(nome))
    }
    for (let coluna = 3; coluna <= 6; coluna++) {
      const nome = `r2c${coluna}`
      elementos.push({ id: `r2_${coluna}`, tipo: 'contato_na', celula: { linha: 2, coluna }, variavel: nome })
      variaveis.push(variavelInterna(nome))
    }
    elementos.push({ id: 'bobina', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' })
    variaveis.push(variavelInterna('x'))

    const diagrama = diagramaDeUmDegrau(
      elementos,
      [
        { id: 'b1', linha: 1, colunaInicio: 1, colunaFim: 4 },
        { id: 'b2', linha: 2, colunaInicio: 3, colunaFim: 6 },
      ],
      variaveis,
    )
    const resultado = serializar(diagrama)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    // Tamanho medido numa rodada de referência: ~700 caracteres. Limite
    // generoso (5x) para não quebrar por uma mudança inofensiva de formatação.
    expect(resultado.st.length).toBeLessThan(3500)
  })
})

// -- tsc: switch exaustivo de tipo de contato é coberto pelos testes acima --

describe('sanidade das fixtures de teste', () => {
  it('rungs manuais usadas nos testes de topologia não disparam validarDiagrama', () => {
    const diagrama = diagramaDeUmDegrau(
      [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
      [variavelInterna('a'), variavelInterna('b'), variavelInterna('x')],
    )
    expect(validarDiagrama(diagrama)).toEqual([])
  })
})
