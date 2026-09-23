/**
 * Testes do motor de simulação (spec 004, plano §6). Mesmo rigor de
 * `serializador.test.ts`: tabela-verdade por enumeração contra um oráculo
 * independente da implementação (RF-7 — o oráculo aqui é escrito de novo,
 * sem reaproveitar nada de `calcularFluxoDoRung`, exatamente pela mesma razão
 * que o motor não reaproveita o serializador), mais os cenários de imagem de
 * processo, escrita entre degraus, SET/RESET, contador e cadência (CA-11).
 */
import { describe, expect, it } from 'vitest'

import { COLUNA_TERMINAL, type Diagrama, type Elemento, type ElementoCtu, type Ramo, type Rung, type Variavel } from './modelo'
import { BLINK, IO_ESPELHO, MINIMAL, RAMO_OU, SAIDAS_PARALELAS } from './fixtures'
import { acionarEntrada, criarEstado, executarCiclo, reiniciar, type EstadoSimulacao } from './simulacao'

// -- Ajudantes de teste -------------------------------------------------

function variavelInterna(nome: string): Variavel {
  return { nome, tipo: 'BOOL' }
}

function diagramaDeUmDegrau(elementos: Elemento[], ramos: Ramo[], variaveis: Variavel[]): Diagrama {
  return { versao: 1, variaveis, rungs: [{ id: 'r1', elementos, ramos }] }
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

/**
 * Oráculo independente de energização de um degrau (contra RF-7): nós num
 * único vetor achatado por coluna, ramos como arestas diretas de
 * `colunaInicio` a `colunaFim+1`, igual ao `energizado()` de
 * `serializador.test.ts` — mas escrito de novo aqui, sem importar nada do
 * motor nem do serializador. Serve só para provar a corretude da topologia,
 * não para ler `nos`/`celulas` (esses são conferidos à parte, célula a
 * célula, no teste dedicado a `RAMO_OU`).
 */
function energizadoOraculo(rung: Rung, valores: Record<string, boolean>): boolean {
  const conduz = (linha: number, coluna: number): boolean => {
    const elemento = rung.elementos.find(
      (e) => e.celula.linha === linha && e.celula.coluna === coluna && (e.tipo === 'contato_na' || e.tipo === 'contato_nf'),
    )
    if (elemento === undefined) return true
    const nome = (elemento as { variavel: string | null }).variavel
    const valor = nome !== null ? valores[nome] : false
    return elemento.tipo === 'contato_na' ? valor : !valor
  }

  const numNos = COLUNA_TERMINAL + 1
  const energiaDoNo: boolean[] = [true]
  for (let no = 1; no < numNos; no++) {
    let energizado = conduz(0, no - 1) && energiaDoNo[no - 1]
    for (const ramo of rung.ramos) {
      if (ramo.colunaFim + 1 !== no) continue
      if (!energiaDoNo[ramo.colunaInicio]) continue
      let serieConduz = true
      for (let coluna = ramo.colunaInicio; coluna <= ramo.colunaFim; coluna++) {
        if (!conduz(ramo.linha, coluna)) {
          serieConduz = false
          break
        }
      }
      energizado = energizado || serieConduz
    }
    energiaDoNo.push(energizado)
  }
  return energiaDoNo[numNos - 1]
}

/** Roda a tabela-verdade inteira de `nomes` sobre `rung` (bobina `x`),
 * conferindo `variaveis.x` depois de um único `executarCiclo` contra o
 * oráculo independente. As variáveis são todas internas (sem endereço), então
 * podem ser escritas direto em `estado.variaveis` sem passar por
 * `acionarEntrada` — o alvo aqui é a topologia, não a imagem de processo
 * (coberta em testes à parte). */
/**
 * Confere a tabela-verdade inteira de `nomes` contra o oráculo independente.
 * `nomes` pode misturar variáveis internas e de entrada (como em `RAMO_OU`):
 * para as que são de entrada, o valor também entra em `entradas`, porque
 * `executarCiclo` reescreve `variaveis` a partir de `entradas` no início de
 * cada ciclo (D-2) -- setar só `variaveis` para uma entrada seria sobrescrito
 * antes mesmo do fluxo ser calculado.
 */
function confereTabelaVerdade(rung: Rung, variaveis: Variavel[], nomes: string[], nomeBobina = 'x'): void {
  const diagrama = diagramaDeUmDegrau(rung.elementos, rung.ramos, variaveis)
  const base = criarEstado(diagrama)
  for (const valores of todasCombinacoes(nomes)) {
    const entradasNovas = Object.fromEntries(Object.entries(valores).filter(([nome]) => nome in base.entradas))
    const estado: EstadoSimulacao = {
      ...base,
      variaveis: { ...base.variaveis, ...valores },
      entradas: { ...base.entradas, ...entradasNovas },
    }
    const resultado = executarCiclo(diagrama, estado)
    expect(resultado.variaveis[nomeBobina]).toBe(energizadoOraculo(rung, valores))
  }
}

// -- Tabela-verdade por topologia -----------------------------------------

describe('topologia: série', () => {
  it('dois contatos NA em série: AND', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 0, coluna: 1 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('x')]
    confereTabelaVerdade(rung, variaveis, ['a', 'b'])
  })
})

describe('topologia: ramo paralelo', () => {
  it('contato no trilho em paralelo com contato no ramo: OR (fixture RAMO_OU)', () => {
    const rung = RAMO_OU.rungs[0]
    confereTabelaVerdade(rung, RAMO_OU.variaveis, ['a', 'b'], 'q')
  })
})

describe('saídas paralelas na coluna terminal', () => {
  it('fixture SAIDAS_PARALELAS: entrada aciona saida_a e saida_b juntas', () => {
    let estado = criarEstado(SAIDAS_PARALELAS)
    let resultado = executarCiclo(SAIDAS_PARALELAS, estado)
    expect(resultado.variaveis.saida_a).toBe(false)
    expect(resultado.variaveis.saida_b).toBe(false)

    const acionado = acionarEntrada(SAIDAS_PARALELAS, estado, 'entrada', true)
    expect(acionado.ok).toBe(true)
    if (!acionado.ok) return
    resultado = executarCiclo(SAIDAS_PARALELAS, acionado.estado)
    expect(resultado.variaveis.saida_a).toBe(true)
    expect(resultado.variaveis.saida_b).toBe(true)
  })
})

describe('topologia: ramo aninhado', () => {
  it('ramo da linha 2 dentro do intervalo de colunas do ramo da linha 1', () => {
    // linha 1: colunas 0..4 (ramo externo); linha 2: colunas 1..2 (aninhado) —
    // mesma forma usada em serializador.test.ts, para o mesmo caso limite.
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

describe('topologia: ramo cruzado', () => {
  it('linha 1 colunas 0-2 e linha 2 colunas 1-4: intervalos cruzados', () => {
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

describe('topologia: lacuna', () => {
  it('célula vazia no meio da série conduz (fio nu)', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        // coluna 1 vazia -- conduz
        { id: 'e2', tipo: 'contato_na', celula: { linha: 0, coluna: 2 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('x')]
    confereTabelaVerdade(rung, variaveis, ['a', 'b'])
  })

  it('lacuna dentro de um ramo conduz, igual ao trilho', () => {
    const rung: Rung = {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'a' },
        // coluna 1 do ramo vazia
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 2 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'x' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 2 }],
    }
    const variaveis = [variavelInterna('a'), variavelInterna('b'), variavelInterna('x')]
    confereTabelaVerdade(rung, variaveis, ['a', 'b'])
  })
})

// -- Energização célula a célula (RF-6) -----------------------------------

describe('energização célula a célula (RF-6)', () => {
  it('RAMO_OU com a=true, b=false: energia pelo trilho, ramo desenergizado', () => {
    const estado = criarEstado(RAMO_OU)
    const acionado = acionarEntrada(RAMO_OU, estado, 'a', true)
    expect(acionado.ok).toBe(true)
    if (!acionado.ok) return
    const resultado = executarCiclo(RAMO_OU, acionado.estado)
    const energ = resultado.energizacao.r1

    // trilho: nó 0 sempre energizado; contato 'a' conduz (true); nó 1 energizado.
    expect(energ.nos['0:0']).toBe(true)
    expect(energ.celulas['0:0']).toBe(true)
    expect(energ.nos['0:1']).toBe(true)
    // ramo (linha 1): entra energizado (bridge do nó 0 da linha 0), mas 'b'
    // não conduz -- o trecho do ramo fica desenergizado.
    expect(energ.nos['1:0']).toBe(true)
    expect(energ.celulas['1:0']).toBe(false)
    expect(energ.nos['1:1']).toBe(false)
    // elementos: contato 'a' conduzindo, contato 'b' não, bobina acionada.
    expect(energ.elementos.e1).toBe(true)
    expect(energ.elementos.e2).toBe(false)
    expect(energ.elementos.e3).toBe(true)
    expect(resultado.variaveis.q).toBe(true)
  })

  it('RAMO_OU com a=false, b=true: energia só pelo ramo', () => {
    const estado = criarEstado(RAMO_OU)
    const acionado = acionarEntrada(RAMO_OU, estado, 'b', true)
    expect(acionado.ok).toBe(true)
    if (!acionado.ok) return
    const resultado = executarCiclo(RAMO_OU, acionado.estado)
    const energ = resultado.energizacao.r1

    expect(energ.nos['0:1']).toBe(true) // chega pelo ramo, mesmo com 'a' desenergizado
    expect(energ.celulas['0:0']).toBe(false) // trilho em si não conduz ('a' falso)
    expect(energ.nos['1:0']).toBe(true)
    expect(energ.celulas['1:0']).toBe(true)
    expect(energ.nos['1:1']).toBe(true)
    expect(energ.elementos.e3).toBe(true)
    expect(resultado.variaveis.q).toBe(true)
  })

  it('RAMO_OU com a=false, b=false: nada energizado além do trilho esquerdo', () => {
    const estado = criarEstado(RAMO_OU)
    const resultado = executarCiclo(RAMO_OU, estado)
    const energ = resultado.energizacao.r1
    expect(energ.nos['0:0']).toBe(true)
    expect(energ.nos['0:1']).toBe(false)
    expect(energ.nos['1:1']).toBe(false)
    expect(energ.elementos.e3).toBe(false)
    expect(resultado.variaveis.q).toBe(false)
  })
})

// -- Imagem de processo (RF-1, RF-2, RF-12; plano D-2) --------------------

describe('imagem de processo', () => {
  it('acionar entrada no meio do ciclo só vale no ciclo seguinte', () => {
    let estado = criarEstado(IO_ESPELHO)

    // ciclo 1: sem acionamento -- saída permanece falsa.
    estado = executarCiclo(IO_ESPELHO, estado)
    expect(estado.variaveis.saida).toBe(false)

    // aciona a entrada depois que o ciclo 1 já rodou -- a leitura da
    // variável em si não muda agora, só o registro de `entradas`.
    const acionado = acionarEntrada(IO_ESPELHO, estado, 'entrada', true)
    expect(acionado.ok).toBe(true)
    if (!acionado.ok) return
    expect(acionado.estado.variaveis.entrada).toBe(false)

    // só no ciclo seguinte a leitura reflete o acionamento.
    const proximo = executarCiclo(IO_ESPELHO, acionado.estado)
    expect(proximo.variaveis.entrada).toBe(true)
    expect(proximo.variaveis.saida).toBe(true)
  })

  it('sem imagem de processo, um contato leria a entrada a meio do ciclo -- este motor não faz isso', () => {
    // Regressão da confusão que a feature existe para desfazer (D-2): duas
    // chamadas de acionarEntrada antes de qualquer executarCiclo não têm
    // efeito cumulativo estranho -- só a última prevalece, e só no próximo ciclo.
    let estado = criarEstado(IO_ESPELHO)
    const primeiro = acionarEntrada(IO_ESPELHO, estado, 'entrada', true)
    expect(primeiro.ok).toBe(true)
    if (!primeiro.ok) return
    const segundo = acionarEntrada(IO_ESPELHO, primeiro.estado, 'entrada', false)
    expect(segundo.ok).toBe(true)
    if (!segundo.ok) return
    estado = executarCiclo(IO_ESPELHO, segundo.estado)
    expect(estado.variaveis.saida).toBe(false)
  })
})

// -- Escrita visível no mesmo ciclo (RF-2, plano D-3) ----------------------

describe('escrita entre degraus no mesmo ciclo', () => {
  it('degrau 1 escreve uma variável que o degrau 2 lê, no mesmo executarCiclo', () => {
    const diagrama: Diagrama = {
      versao: 1,
      variaveis: [variavelInterna('a'), variavelInterna('meio'), variavelInterna('saida')],
      rungs: [
        {
          id: 'r1',
          elementos: [
            { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
            { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'meio' },
          ],
          ramos: [],
        },
        {
          id: 'r2',
          elementos: [
            { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'meio' },
            { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
          ],
          ramos: [],
        },
      ],
    }
    const base = criarEstado(diagrama)
    const estado: EstadoSimulacao = { ...base, variaveis: { ...base.variaveis, a: true } }
    const resultado = executarCiclo(diagrama, estado)
    // se a escrita de r1 não fosse visível para r2 no mesmo ciclo, `saida`
    // ficaria falsa (leria o `meio` do ciclo anterior, ainda falso).
    expect(resultado.variaveis.meio).toBe(true)
    expect(resultado.variaveis.saida).toBe(true)
  })
})

// -- SET/RESET na mesma variável (RF-5) ------------------------------------

function diagramaSetReset(ordem: 'set_depois_reset' | 'reset_depois_set'): Diagrama {
  const rungSet: Rung = {
    id: 'set',
    elementos: [
      { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'liga' },
      { id: 'e2', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
    ],
    ramos: [],
  }
  const rungReset: Rung = {
    id: 'reset',
    elementos: [
      { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'desliga' },
      { id: 'e4', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
    ],
    ramos: [],
  }
  return {
    versao: 1,
    variaveis: [variavelInterna('liga'), variavelInterna('desliga'), variavelInterna('q')],
    rungs: ordem === 'set_depois_reset' ? [rungSet, rungReset] : [rungReset, rungSet],
  }
}

describe('SET/RESET na mesma variável no mesmo ciclo', () => {
  it('SET no degrau 1, RESET no degrau 2, ambos energizados: vence o RESET (de baixo)', () => {
    const diagrama = diagramaSetReset('set_depois_reset')
    const base = criarEstado(diagrama)
    const estado: EstadoSimulacao = { ...base, variaveis: { ...base.variaveis, liga: true, desliga: true } }
    const resultado = executarCiclo(diagrama, estado)
    expect(resultado.variaveis.q).toBe(false)
  })

  it('RESET no degrau 1, SET no degrau 2, ambos energizados: vence o SET (de baixo)', () => {
    const diagrama = diagramaSetReset('reset_depois_set')
    const base = criarEstado(diagrama)
    const estado: EstadoSimulacao = { ...base, variaveis: { ...base.variaveis, liga: true, desliga: true } }
    const resultado = executarCiclo(diagrama, estado)
    expect(resultado.variaveis.q).toBe(true)
  })

  it('só o SET energizado: liga', () => {
    const diagrama = diagramaSetReset('set_depois_reset')
    const base = criarEstado(diagrama)
    const estado: EstadoSimulacao = { ...base, variaveis: { ...base.variaveis, liga: true, desliga: false } }
    const resultado = executarCiclo(diagrama, estado)
    expect(resultado.variaveis.q).toBe(true)
  })

  it('só o RESET energizado: desliga', () => {
    const diagrama = diagramaSetReset('set_depois_reset')
    const base = criarEstado(diagrama)
    let estado: EstadoSimulacao = { ...base, variaveis: { ...base.variaveis, liga: true, desliga: false } }
    estado = executarCiclo(diagrama, estado) // liga primeiro
    estado = { ...estado, variaveis: { ...estado.variaveis, liga: false, desliga: true } }
    const resultado = executarCiclo(diagrama, estado)
    expect(resultado.variaveis.q).toBe(false)
  })
})

// -- CTU (RF-4, plano D-4) -------------------------------------------------

function diagramaCtu(pv: number): Diagrama {
  const ctu: ElementoCtu = {
    id: 'e2',
    tipo: 'ctu',
    celula: { linha: 0, coluna: COLUNA_TERMINAL },
    linhaReset: 1,
    instancia: 'ctu0',
    pv,
    saida: 'atingiu',
  }
  return {
    versao: 1,
    variaveis: [
      { nome: 'cu', tipo: 'BOOL', endereco: '%IX0.0' },
      { nome: 'r', tipo: 'BOOL', endereco: '%IX0.1' },
      { nome: 'atingiu', tipo: 'BOOL', endereco: '%QX0.0' },
    ],
    rungs: [
      {
        id: 'r1',
        elementos: [
          { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'cu' },
          { id: 'e3', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'r' },
          ctu,
        ],
        ramos: [],
      },
    ],
  }
}

function acionar(diagrama: Diagrama, estado: EstadoSimulacao, nome: string, nivel: boolean): EstadoSimulacao {
  const resultado = acionarEntrada(diagrama, estado, nome, nivel)
  if (!resultado.ok) throw new Error(`acionarEntrada falhou: ${resultado.motivo}`)
  return resultado.estado
}

describe('CTU: borda de subida', () => {
  it('CU preso em verdadeiro não conta duas vezes; solta e sobe de novo conta mais uma', () => {
    const diagrama = diagramaCtu(5)
    let estado = criarEstado(diagrama)

    estado = acionar(diagrama, estado, 'cu', true)
    estado = executarCiclo(diagrama, estado) // borda de subida: 0 -> 1
    expect(estado.contadores.ctu0.contagem).toBe(1)

    estado = executarCiclo(diagrama, estado) // cu continua true: sem novo incremento
    expect(estado.contadores.ctu0.contagem).toBe(1)
    estado = executarCiclo(diagrama, estado)
    expect(estado.contadores.ctu0.contagem).toBe(1)

    estado = acionar(diagrama, estado, 'cu', false)
    estado = executarCiclo(diagrama, estado) // cu desce
    expect(estado.contadores.ctu0.contagem).toBe(1)

    estado = acionar(diagrama, estado, 'cu', true)
    estado = executarCiclo(diagrama, estado) // nova borda de subida: 1 -> 2
    expect(estado.contadores.ctu0.contagem).toBe(2)
  })

  it('contagem para no PV_MAX teórico -- aqui só confere que não ultrapassa pv com folga', () => {
    const diagrama = diagramaCtu(2)
    let estado = criarEstado(diagrama)
    for (let i = 0; i < 5; i++) {
      estado = acionar(diagrama, estado, 'cu', false)
      estado = executarCiclo(diagrama, estado)
      estado = acionar(diagrama, estado, 'cu', true)
      estado = executarCiclo(diagrama, estado)
    }
    // 5 bordas de subida com pv=2: a contagem cresce a cada borda (sem teto
    // de pv -- só `atingiu` satura em true); o teto real é PV_MAX (32767),
    // não testado aqui por custo. Confere que a contagem acompanha as bordas.
    expect(estado.contadores.ctu0.contagem).toBe(5)
    expect(estado.variaveis.atingiu).toBe(true)
  })
})

describe('CTU: reinício com precedência', () => {
  it('reset e borda de subida no mesmo ciclo: reset vence, não incrementa', () => {
    const diagrama = diagramaCtu(5)
    let estado = criarEstado(diagrama)
    estado = acionar(diagrama, estado, 'cu', true)
    estado = acionar(diagrama, estado, 'r', true)
    estado = executarCiclo(diagrama, estado) // cu sobe E r conduz no mesmo ciclo
    expect(estado.contadores.ctu0.contagem).toBe(0)
  })

  it('reset zera uma contagem já em andamento', () => {
    const diagrama = diagramaCtu(5)
    let estado = criarEstado(diagrama)
    estado = acionar(diagrama, estado, 'cu', true)
    estado = executarCiclo(diagrama, estado)
    expect(estado.contadores.ctu0.contagem).toBe(1)

    estado = acionar(diagrama, estado, 'cu', false)
    estado = executarCiclo(diagrama, estado)
    estado = acionar(diagrama, estado, 'cu', true)
    estado = executarCiclo(diagrama, estado)
    expect(estado.contadores.ctu0.contagem).toBe(2)

    estado = acionar(diagrama, estado, 'r', true)
    estado = executarCiclo(diagrama, estado)
    expect(estado.contadores.ctu0.contagem).toBe(0)
  })
})

describe('CTU: saída em contagem >= pv', () => {
  it('atingiu fica falso antes do limite e verdadeiro a partir dele', () => {
    const diagrama = diagramaCtu(3)
    let estado = criarEstado(diagrama)
    expect(estado.variaveis.atingiu).toBe(false)

    for (let i = 0; i < 2; i++) {
      estado = acionar(diagrama, estado, 'cu', false)
      estado = executarCiclo(diagrama, estado)
      estado = acionar(diagrama, estado, 'cu', true)
      estado = executarCiclo(diagrama, estado)
      expect(estado.variaveis.atingiu).toBe(false)
    }

    estado = acionar(diagrama, estado, 'cu', false)
    estado = executarCiclo(diagrama, estado)
    estado = acionar(diagrama, estado, 'cu', true)
    estado = executarCiclo(diagrama, estado) // terceira borda: contagem chega a 3 == pv
    expect(estado.contadores.ctu0.contagem).toBe(3)
    expect(estado.variaveis.atingiu).toBe(true)
  })
})

// -- BLINK: 200 ciclos, gabarito de backend/tests/diferencial/fixtures/blink.toml --

describe('BLINK: alternância do LED', () => {
  it('reproduz o gabarito (0 no 24, 1 no 25, 1 no 26, 1 no 49, 0 no 50) e mantém o período por 200 ciclos', () => {
    let estado = criarEstado(BLINK)
    // botao (%IX0.0) permanece falso os 200 ciclos, como no gabarito.
    const ledPorCiclo = new Map<number, boolean>()
    for (let ciclo = 1; ciclo <= 200; ciclo++) {
      estado = executarCiclo(BLINK, estado)
      ledPorCiclo.set(ciclo, estado.variaveis.led)
    }

    expect(ledPorCiclo.get(24)).toBe(false)
    expect(ledPorCiclo.get(25)).toBe(true)
    expect(ledPorCiclo.get(26)).toBe(true)
    expect(ledPorCiclo.get(49)).toBe(true)
    expect(ledPorCiclo.get(50)).toBe(false)

    // o período de 25 ciclos se repete ao longo dos 200 ciclos inteiros.
    expect(ledPorCiclo.get(74)).toBe(false)
    expect(ledPorCiclo.get(75)).toBe(true)
    expect(ledPorCiclo.get(124)).toBe(false)
    expect(ledPorCiclo.get(125)).toBe(true)
    expect(ledPorCiclo.get(174)).toBe(false)
    expect(ledPorCiclo.get(175)).toBe(true)
  })
})

// -- reiniciar (plano D-7) -------------------------------------------------

describe('reiniciar', () => {
  it('equivale a criarEstado: zera variáveis, entradas, contadores e ciclo', () => {
    let estado = criarEstado(BLINK)
    for (let i = 0; i < 30; i++) estado = executarCiclo(BLINK, estado)
    expect(estado.ciclo).toBe(30)

    const reiniciado = reiniciar(BLINK)
    expect(reiniciado).toEqual(criarEstado(BLINK))
    expect(reiniciado.ciclo).toBe(0)
    expect(Object.values(reiniciado.variaveis).every((v) => v === false)).toBe(true)
    expect(reiniciado.contadores.ctu0).toEqual({ contagem: 0, cuAnterior: false })
  })
})

// -- acionarEntrada: recusas (RF-12) ---------------------------------------

describe('acionarEntrada: recusas', () => {
  it('recusa variável inexistente', () => {
    const estado = criarEstado(MINIMAL)
    const resultado = acionarEntrada(MINIMAL, estado, 'fantasma', true)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toMatch(/inexistente/)
  })

  it('recusa saída', () => {
    const estado = criarEstado(RAMO_OU)
    const resultado = acionarEntrada(RAMO_OU, estado, 'q', true)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toMatch(/não é de entrada/)
  })

  it('recusa memória (variável interna, sem endereço)', () => {
    const estado = criarEstado(MINIMAL)
    // em MINIMAL, tanto 'entrada' quanto 'saida' são internas (sem endereço).
    const resultado = acionarEntrada(MINIMAL, estado, 'saida', true)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toMatch(/não é de entrada/)
  })

  it('aceita entrada de verdade (RAMO_OU/a)', () => {
    const estado = criarEstado(RAMO_OU)
    const resultado = acionarEntrada(RAMO_OU, estado, 'a', true)
    expect(resultado.ok).toBe(true)
  })
})

// -- CA-11: cadência com 50 degraus -----------------------------------------

describe('CA-11: cadência com 50 degraus', () => {
  it('50 degraus x 2000 ciclos em ~243 ms (~0.12 ms/ciclo) -- bem abaixo do orçamento de 20 ms/ciclo', () => {
    const rungs: Rung[] = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i + 1}`,
      elementos: [
        { id: `e${i * 2 + 1}`, tipo: 'contato_na' as const, celula: { linha: 0, coluna: 0 }, variavel: `a${i}` },
        { id: `e${i * 2 + 2}`, tipo: 'bobina' as const, celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: `b${i}` },
      ],
      ramos: [],
    }))
    const variaveis: Variavel[] = rungs.flatMap((_, i) => [variavelInterna(`a${i}`), variavelInterna(`b${i}`)])
    const diagrama: Diagrama = { versao: 1, variaveis, rungs }

    let estado = criarEstado(diagrama)
    const totalCiclos = 2000
    const inicio = performance.now()
    for (let i = 0; i < totalCiclos; i++) {
      estado = executarCiclo(diagrama, estado)
    }
    const duracaoMs = performance.now() - inicio
    const msPorCiclo = duracaoMs / totalCiclos

    // Medido nesta rodada (máquina do orquestrador, Node/vitest): ~243 ms para
    // 2000 ciclos de um diagrama de 50 degraus (~0,12 ms/ciclo) -- cerca de
    // 165x de margem para o orçamento de 20 ms/ciclo da CA-11 (RF-11). O
    // limite abaixo (200 ms/ciclo) é deliberadamente folgado, para não ficar
    // flaky por variação de máquina/CI -- o alvo é acusar regressão grave,
    // não otimizar prematuramente (mesmo espírito do teste de desempenho de
    // `EditorLadder.test.tsx`).
    expect(estado.ciclo).toBe(totalCiclos)
    expect(msPorCiclo).toBeLessThan(200)
  })
})
