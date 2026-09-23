/**
 * Serializador Ladder → Structured Text (spec 003, plano §4-§5).
 *
 * Função pura: recebe um `Diagrama` já validado pela IDE (Q-2, `validarDiagrama`
 * é responsabilidade de quem chama, não deste arquivo) e devolve o texto ST
 * equivalente, ou uma recusa com motivo em português. Não conhece React nem
 * rede — nasce vizinha do modelo e da validação da spec 002 (`modelo.ts`,
 * `validacao.ts`, `edicao.ts`), no mesmo estilo de código puro.
 *
 * Leitura do degrau como circuito (D-1): as fronteiras de coluna
 * `0..COLUNA_TERMINAL` são nós; o nó `k` fica à esquerda da coluna `k`, e o
 * nó `COLUNA_TERMINAL` é a entrada da bobina. Arestas do trilho ligam `k` a
 * `k+1`, com o contato de `(0,k)` ou `TRUE` se a célula estiver vazia — a
 * mesma regra de "célula vazia conduz" que `validacao.ts` já assume. Arestas
 * de ramo ligam `colunaInicio` a `colunaFim+1`, com a série (AND) das células
 * da linha do ramo nesse intervalo. Como `colunaFim >= colunaInicio` e as
 * arestas de trilho sempre avançam uma coluna, todo o grafo de um degrau é um
 * DAG em que toda aresta vai de um nó de índice menor para um de índice
 * maior — por isso a propagação por nó (fallback) nunca precisa de busca
 * topológica: percorrer os nós em ordem crescente já é a ordem certa.
 *
 * A expressão sai, preferencialmente, de uma redução série-paralelo
 * (`reduzirSerieParalelo`): arestas paralelas (mesmo par de nós) se fundem em
 * `OR`; um nó interno com grau de entrada 1 e grau de saída 1 se funde com as
 * duas arestas vizinhas em `AND` (série). Isso cobre o caso comum — inclusive
 * ramos aninhados, onde a redução em cascata escoa o aninhamento até uma
 * aresta só — e produz texto fatorado e legível (Q-1). Quando os ramos vêm de
 * linhas diferentes com intervalos que se cruzam (ex.: linha 1 colunas 0–2 e
 * linha 2 colunas 1–4), a redução trava sem chegar a uma aresta única
 * `0 → COLUNA_TERMINAL`: nesse caso, `propagarPorNo` calcula a mesma
 * expressão (correta, ainda que menos fatorada) por `E(0) = TRUE` e
 * `E(n) = OR` sobre as arestas `m → n` de `(E(m) AND termo)`.
 */

import {
  COLUNA_TERMINAL,
  ehBobina,
  ehContato,
  ehCtu,
  ehRamoDeSaida,
  ehTerminal,
  variavelDoElemento,
  type Diagrama,
  type Elemento,
  type ElementoCtu,
  type Rung,
  type TipoBobina,
} from './modelo'

// -- Contrato (plano §5) --------------------------------------------------

export interface TrechoDegrau {
  rungId: string
  /** 1-based, inclusivo. */
  linhaInicio: number
  /** 1-based, inclusivo. */
  linhaFim: number
}

export type ResultadoSerializacao =
  | { ok: true; st: string; mapaLinhas: TrechoDegrau[] }
  | { ok: false; motivo: string; vazio?: true; rungId?: string }

// -- Palavras reservadas e nomes fixos (D-5, revisão do RF-5) -----------

/** Palavras reservadas da IEC 61131-3 (comparação case-insensitive, D-5b). */
const PALAVRAS_RESERVADAS_IEC = new Set([
  'AND', 'OR', 'XOR', 'NOT', 'MOD', 'TRUE', 'FALSE',
  'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF', 'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE',
  'REPEAT', 'UNTIL', 'END_REPEAT', 'EXIT', 'RETURN',
  'PROGRAM', 'END_PROGRAM', 'FUNCTION', 'END_FUNCTION',
  'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
  'VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_GLOBAL',
  'VAR_EXTERNAL', 'VAR_TEMP', 'END_VAR', 'CONSTANT', 'RETAIN', 'AT',
  'CONFIGURATION', 'END_CONFIGURATION', 'RESOURCE', 'END_RESOURCE',
  'ON', 'TASK', 'WITH',
  'TYPE', 'END_TYPE', 'STRUCT', 'END_STRUCT', 'ARRAY',
  'BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD',
  'SINT', 'INT', 'DINT', 'LINT', 'USINT', 'UINT', 'UDINT', 'ULINT',
  'REAL', 'LREAL',
  'TIME', 'DATE', 'TIME_OF_DAY', 'TOD', 'DATE_AND_TIME', 'DT',
  'STRING', 'WSTRING',
  'R_EDGE', 'F_EDGE', 'EN', 'ENO',
  'TON', 'TOF', 'TP', 'CTU', 'CTD', 'CTUD', 'R_TRIG', 'F_TRIG', 'SR', 'RS',
])

/** Nomes fixos do programa e da configuração (D-4/Q-4), comparados
 * case-insensitive contra o nome da variável (D-5b). */
const NOMES_FIXOS = new Set(['prog0', 'config0', 'res0', 'task0', 'instance0'])

/**
 * Recusa por nome de variável que o compilador externo não aceita, embora o
 * editor aceite (revisão aditiva do RF-5): palavra reservada, nome fixo do
 * programa gerado, ou dois nomes que diferem só em maiúsculas/minúsculas.
 * Devolve o motivo em português, ou `null` se todos os nomes são aceitáveis.
 */
function validarNomesDeVariaveis(diagrama: Diagrama): string | null {
  for (const variavel of diagrama.variaveis) {
    if (PALAVRAS_RESERVADAS_IEC.has(variavel.nome.toUpperCase())) {
      return `nome de variável inválido para o texto gerado: '${variavel.nome}' é palavra reservada da IEC 61131-3`
    }
    if (NOMES_FIXOS.has(variavel.nome.toLowerCase())) {
      return `nome de variável inválido para o texto gerado: '${variavel.nome}' coincide com um nome fixo do programa gerado (prog0, Config0, Res0, task0 ou instance0)`
    }
  }

  const nomePorChave = new Map<string, string>()
  for (const variavel of diagrama.variaveis) {
    const chave = variavel.nome.toLowerCase()
    const existente = nomePorChave.get(chave)
    if (existente !== undefined && existente !== variavel.nome) {
      return `variáveis '${existente}' e '${variavel.nome}' diferem só em maiúsculas/minúsculas — identificadores IEC 61131-3 não fazem essa distinção`
    }
    nomePorChave.set(chave, variavel.nome)
  }

  return null
}

/**
 * Recusa por instância de CTU inválida para o texto gerado (revisão aditiva
 * do RF-5/D-5, contador crescente): nome reservado da IEC 61131-3, nome fixo
 * do programa gerado, colisão (case-insensitive) com o nome de uma variável
 * ou de outra instância, ou `pv` que não seja inteiro em 1..32767. Devolve o
 * motivo em português, ou `null` se todas as instâncias são aceitáveis. Não
 * valida `linhaReset` em si — a estrutura do diagrama (posição do CTU, forma
 * da linha de reset) é responsabilidade de `validarDiagrama` (D-6, Q-2), não
 * deste arquivo.
 */
function validarInstanciasCtu(diagrama: Diagrama): string | null {
  const nomesDeVariaveis = new Set(diagrama.variaveis.map((v) => v.nome.toLowerCase()))
  const instanciasVistas = new Map<string, string>()

  for (let indiceDegrau = 0; indiceDegrau < diagrama.rungs.length; indiceDegrau++) {
    const rung = diagrama.rungs[indiceDegrau]
    for (const elemento of rung.elementos) {
      if (!ehCtu(elemento)) continue
      const instancia = elemento.instancia
      const chave = instancia.toLowerCase()
      const localizacao = `degrau ${indiceDegrau + 1}, elemento '${elemento.id}'`

      if (PALAVRAS_RESERVADAS_IEC.has(instancia.toUpperCase())) {
        return `instância de CTU inválida para o texto gerado: '${instancia}' é palavra reservada da IEC 61131-3 (${localizacao})`
      }
      if (NOMES_FIXOS.has(chave)) {
        return `instância de CTU inválida para o texto gerado: '${instancia}' coincide com um nome fixo do programa gerado (prog0, Config0, Res0, task0 ou instance0) (${localizacao})`
      }
      if (nomesDeVariaveis.has(chave)) {
        return `instância de CTU '${instancia}' colide com o nome de uma variável — identificadores IEC 61131-3 não distinguem maiúsculas/minúsculas (${localizacao})`
      }
      const existente = instanciasVistas.get(chave)
      if (existente !== undefined) {
        return `instâncias de CTU '${existente}' e '${instancia}' colidem — identificadores IEC 61131-3 não distinguem maiúsculas/minúsculas (${localizacao})`
      }
      instanciasVistas.set(chave, instancia)

      if (!Number.isInteger(elemento.pv) || elemento.pv < 1 || elemento.pv > 32767) {
        return `valor programado (PV) do CTU '${instancia}' inválido: ${elemento.pv} — precisa ser um número inteiro entre 1 e 32767 (${localizacao})`
      }
    }
  }

  return null
}

/**
 * `tipo` é um dos tipos de elemento do subconjunto desta spec? O `switch` é
 * exaustivo por `never`: qualquer tipo futuro ou um valor forjado em tempo de
 * execução cai no `default` e é recusado explicitamente (D-5a, CA-6), em vez
 * de atravessar em silêncio.
 */
function motivoTipoDesconhecido(tipo: Elemento['tipo']): string | null {
  switch (tipo) {
    case 'contato_na':
    case 'contato_nf':
    case 'bobina':
    case 'bobina_set':
    case 'bobina_reset':
    case 'ctu':
      return null
    default: {
      const tipoForjado: never = tipo
      return `tipo de elemento fora do subconjunto suportado: '${String(tipoForjado)}'`
    }
  }
}

// -- Expressão booleana (D-1) ---------------------------------------------

/** AST mínima da expressão de um degrau, só o necessário para render com os
 * parênteses certos (D-1: só onde a precedência exige, OR dentro de AND) e
 * para eliminar o `TRUE` neutro nos pontos de construção (`criarE`/`criarOu`),
 * em vez de imprimir `TRUE AND x` ou recalcular depois. */
type Termo =
  | { tipo: 'true' }
  | { tipo: 'var'; nome: string; negado: boolean }
  | { tipo: 'and'; termos: Termo[] }
  | { tipo: 'or'; termos: Termo[] }

const TERMO_TRUE: Termo = { tipo: 'true' }

function criarVar(nome: string, negado: boolean): Termo {
  return { tipo: 'var', nome, negado }
}

/** `AND` de `operandos`, achatando ANDs internos, eliminando `TRUE` (neutro
 * de AND) e devolvendo o próprio termo quando resta só um operando. */
function criarE(operandos: Termo[]): Termo {
  const achatados: Termo[] = []
  for (const operando of operandos) {
    if (operando.tipo === 'and') achatados.push(...operando.termos)
    else achatados.push(operando)
  }
  const semNeutro = achatados.filter((termo) => termo.tipo !== 'true')
  if (semNeutro.length === 0) return TERMO_TRUE
  if (semNeutro.length === 1) return semNeutro[0]
  return { tipo: 'and', termos: semNeutro }
}

/** `OR` de `operandos`, achatando ORs internos; se algum operando for `TRUE`,
 * o `OR` inteiro vira `TRUE` (um caminho sempre conduz). */
function criarOu(operandos: Termo[]): Termo {
  const achatados: Termo[] = []
  for (const operando of operandos) {
    if (operando.tipo === 'or') achatados.push(...operando.termos)
    else achatados.push(operando)
  }
  if (achatados.some((termo) => termo.tipo === 'true')) return TERMO_TRUE
  if (achatados.length === 1) return achatados[0]
  return { tipo: 'or', termos: achatados }
}

/** Texto de `termo`. NA = identificador, NF = `NOT identificador` (NOT só se
 * aplica a identificador nesta gramática, então nunca precisa de parênteses).
 * Dentro de um AND, um operando OR precisa de parênteses; nos demais casos,
 * a precedência natural (AND mais forte que OR) já resolve. */
function renderizarTermo(termo: Termo): string {
  switch (termo.tipo) {
    case 'true':
      return 'TRUE'
    case 'var':
      return termo.negado ? `NOT ${termo.nome}` : termo.nome
    case 'and':
      return termo.termos.map((operando) => renderizarOperandoDeAnd(operando)).join(' AND ')
    case 'or':
      return termo.termos.map((operando) => renderizarTermo(operando)).join(' OR ')
  }
}

function renderizarOperandoDeAnd(termo: Termo): string {
  const texto = renderizarTermo(termo)
  return termo.tipo === 'or' ? `(${texto})` : texto
}

/** Uma aresta do grafo do degrau: de um nó a outro (sempre `de < para`, ver
 * cabeçalho do arquivo), com o termo booleano que ela representa. `chave` é
 * a posição de origem (coluna, depois linha) usada só para ordenar
 * deterministicamente os operandos de um `OR` quando duas arestas se fundem
 * em paralelo (§6 da spec) — sem ela, a ordem dependeria do caminho que a
 * redução série-paralelo percorreu para chegar até lá, não da posição da
 * célula na grade. Numa aresta de trilho, a chave é a própria coluna, linha
 * 0; numa aresta de ramo, é `colunaInicio` e a linha do ramo; numa aresta
 * fundida (série ou paralelo), é a menor chave das arestas de origem. */
interface Aresta {
  de: number
  para: number
  termo: Termo
  chave: { coluna: number; linha: number }
}

/** Ordena por coluna e, em empate, por linha — "coluna, depois linha" (§6). */
function compararChave(a: Aresta['chave'], b: Aresta['chave']): number {
  return a.coluna - b.coluna || a.linha - b.linha
}

function menorChave(a: Aresta['chave'], b: Aresta['chave']): Aresta['chave'] {
  return compararChave(a, b) <= 0 ? a : b
}

/** Termo da célula `(linha, coluna)`: `TRUE` se vazia (conduz, D-1) ou o
 * contato ali — NA sem negar, NF negado. Só considera elementos que são
 * contato: um elemento fora de posição (ex.: bobina fora da coluna terminal,
 * uma condição que `validarDiagrama` já marca como erro) não é lido como
 * contato aqui, porque a checagem de tipo/posição correta é feita antes de
 * chegar neste ponto (ver `serializar`). */
function termoDaCelula(rung: Rung, linha: number, coluna: number): Termo {
  const elemento = rung.elementos.find(
    (e) => e.celula.linha === linha && e.celula.coluna === coluna && ehContato(e.tipo),
  )
  if (elemento === undefined) return TERMO_TRUE
  return criarVar(variavelDoElemento(elemento) as string, elemento.tipo === 'contato_nf')
}

/** Arestas do grafo do degrau (D-1): trilho em ordem de coluna, depois ramos
 * ordenados por `colunaInicio` e, em empate, por `linha` — nunca pela ordem
 * de `rung.ramos` nem pelos ids, para que o determinismo (§6 da spec) não
 * dependa da ordem de inserção. */
function construirArestas(rung: Rung): Aresta[] {
  const arestas: Aresta[] = []

  for (let coluna = 0; coluna < COLUNA_TERMINAL; coluna++) {
    arestas.push({
      de: coluna,
      para: coluna + 1,
      termo: termoDaCelula(rung, 0, coluna),
      chave: { coluna, linha: 0 },
    })
  }

  const ramosOrdenados = [...rung.ramos].sort(
    (a, b) => a.colunaInicio - b.colunaInicio || a.linha - b.linha,
  )
  for (const ramo of ramosOrdenados) {
    if (ehRamoDeSaida(ramo)) continue
    const termosDaSerie: Termo[] = []
    for (let coluna = ramo.colunaInicio; coluna <= ramo.colunaFim; coluna++) {
      termosDaSerie.push(termoDaCelula(rung, ramo.linha, coluna))
    }
    arestas.push({
      de: ramo.colunaInicio,
      para: ramo.colunaFim + 1,
      termo: criarE(termosDaSerie),
      chave: { coluna: ramo.colunaInicio, linha: ramo.linha },
    })
  }

  return arestas
}

/** Funde arestas paralelas (mesmo par `de`/`para`) em `OR`, com os operandos
 * ordenados pela `chave` de origem (coluna, depois linha) — nunca pela ordem
 * em que a redução as visitou, que muda com o caminho percorrido e quebraria
 * o determinismo do §6 da spec. A chave da aresta fundida é a menor entre as
 * arestas do grupo, para que ela continue competindo corretamente em outra
 * fusão adiante. */
function normalizarParalelas(arestas: Aresta[]): Aresta[] {
  const chavesDosPares: string[] = []
  const arestasPorPar = new Map<string, Aresta[]>()

  for (const aresta of arestas) {
    const chavePar = `${aresta.de}->${aresta.para}`
    if (!arestasPorPar.has(chavePar)) {
      arestasPorPar.set(chavePar, [])
      chavesDosPares.push(chavePar)
    }
    arestasPorPar.get(chavePar)?.push(aresta)
  }

  return chavesDosPares.map((chavePar) => {
    const grupo = (arestasPorPar.get(chavePar) as Aresta[]).slice().sort((a, b) => compararChave(a.chave, b.chave))
    const chaveFundida = grupo.reduce((menor, aresta) => menorChave(menor, aresta.chave), grupo[0].chave)
    return {
      de: grupo[0].de,
      para: grupo[0].para,
      termo: grupo.length === 1 ? grupo[0].termo : criarOu(grupo.map((a) => a.termo)),
      chave: chaveFundida,
    }
  })
}

/**
 * Redução série-paralelo (D-1, caso comum): funde arestas paralelas em `OR` e
 * nós de grau 1+1 em `AND`, repetindo até não sobrar nada para reduzir.
 * Devolve o termo da aresta única `0 → numNos-1` se a redução chegou lá, ou
 * `null` se travou antes (ramos de linhas diferentes com intervalos
 * cruzados) — nesse caso, quem chama usa `propagarPorNo` com as arestas
 * originais, não com o resultado parcial daqui.
 */
function reduzirSerieParalelo(numNos: number, arestasIniciais: Aresta[]): Termo | null {
  let arestas = normalizarParalelas(arestasIniciais)
  let progrediu = true

  while (progrediu) {
    progrediu = false
    for (let no = 1; no < numNos - 1; no++) {
      const entrando = arestas.filter((a) => a.para === no)
      const saindo = arestas.filter((a) => a.de === no)
      if (entrando.length === 1 && saindo.length === 1) {
        const [ent] = entrando
        const [sai] = saindo
        const resto = arestas.filter((a) => a !== ent && a !== sai)
        resto.push({
          de: ent.de,
          para: sai.para,
          termo: criarE([ent.termo, sai.termo]),
          chave: menorChave(ent.chave, sai.chave),
        })
        arestas = normalizarParalelas(resto)
        progrediu = true
        break
      }
    }
  }

  if (arestas.length === 1 && arestas[0].de === 0 && arestas[0].para === numNos - 1) {
    return arestas[0].termo
  }
  return null
}

/**
 * Fallback por nó (D-1): `E(0) = TRUE`, `E(n) = OR` sobre as arestas
 * `m → n` de `(E(m) AND termo)`. Correto sempre, porque toda aresta do grafo
 * de um degrau vai de um nó menor para um maior (trilho e ramo, ver
 * cabeçalho) — percorrer `0..numNos-1` em ordem crescente já é ordem
 * topológica, sem precisar calculá-la.
 */
function propagarPorNo(numNos: number, arestas: Aresta[]): Termo {
  const energiaDoNo: Termo[] = [TERMO_TRUE]
  for (let no = 1; no < numNos; no++) {
    // Ordenado por chave (coluna, depois linha), não pela ordem de `arestas`
    // — mesma razão do determinismo em `normalizarParalelas`.
    const entrando = arestas.filter((a) => a.para === no).sort((a, b) => compararChave(a.chave, b.chave))
    const termosOr = entrando.map((a) => criarE([energiaDoNo[a.de], a.termo]))
    energiaDoNo.push(criarOu(termosOr))
  }
  return energiaDoNo[numNos - 1]
}

/** Expressão booleana do degrau (D-1): tenta a redução série-paralelo
 * primeiro (texto fatorado, legível) e cai no fallback por nó só quando ela
 * não fecha numa aresta única. */
function calcularExpressaoDoDegrau(rung: Rung): Termo {
  const numNos = COLUNA_TERMINAL + 1
  const arestas = construirArestas(rung)
  const reduzido = reduzirSerieParalelo(numNos, arestas)
  return reduzido ?? propagarPorNo(numNos, arestas)
}

// -- Bobinas (D-2) ---------------------------------------------------------

/** Linhas ST de uma bobina já com a expressão calculada (D-2): bobina simples
 * é atribuição direta; SET/RESET são escritas condicionais que não tocam a
 * variável quando a condição é falsa (Q-5 — a ordem entre SET e RESET de uma
 * mesma variável vem só da ordem dos degraus no diagrama, preservada por
 * quem chama esta função). */
function emitirBobina(tipo: TipoBobina, nome: string, expressao: string): string[] {
  switch (tipo) {
    case 'bobina':
      return [`  ${nome} := ${expressao};`]
    case 'bobina_set':
      return [`  IF ${expressao} THEN`, `    ${nome} := TRUE;`, `  END_IF;`]
    case 'bobina_reset':
      return [`  IF ${expressao} THEN`, `    ${nome} := FALSE;`, `  END_IF;`]
    default: {
      // Inalcançável: `TipoBobina` só tem estas três variantes.
      const tipoForjado: never = tipo
      throw new Error(`tipo de bobina desconhecido: ${String(tipoForjado)}`)
    }
  }
}

// -- CTU (revisão aditiva do D-2/D-7, contador crescente) ------------------

/**
 * Expressão de `R` (reinício) do CTU: série (AND, em ordem de coluna) dos
 * contatos de `linhaReset`, colunas `0..COLUNA_TERMINAL-1`, a partir do
 * trilho esquerdo — NA → nome, NF → `NOT` nome, célula vazia conduz (é
 * neutra no AND, como em qualquer série). Não usa `construirArestas`: essa
 * linha não é um ramo (não está em `rung.ramos`), então nunca entra no
 * circuito de `CU` — é lida à parte, só para montar `R`.
 *
 * Caso especial: linha de reset sem nenhum contato (todas as células vazias)
 * não vira "sempre conduz" como a série normal faria — a ausência completa
 * de fiação significa reset nunca acionado, `R := FALSE`. Diferente do
 * trilho principal (onde "sem contato" energiza a bobina, D-2): lá o autor
 * desenhou o degrau inteiro só com a bobina; aqui a linha de reset pode
 * simplesmente não ter sido usada.
 */
function calcularExpressaoDeReset(rung: Rung, linhaReset: number): string {
  const termos: Termo[] = []
  for (let coluna = 0; coluna < COLUNA_TERMINAL; coluna++) {
    const elemento = rung.elementos.find(
      (e) => e.celula.linha === linhaReset && e.celula.coluna === coluna && ehContato(e.tipo),
    )
    if (elemento === undefined) continue
    termos.push(criarVar(variavelDoElemento(elemento) as string, elemento.tipo === 'contato_nf'))
  }
  if (termos.length === 0) return 'FALSE'
  return renderizarTermo(criarE(termos))
}

/** Linhas ST de um CTU já com a expressão de `CU` calculada (revisão
 * aditiva do D-2): a chamada da instância, seguida da leitura de `Q` para a
 * variável de saída — mesmo par de linhas de `variante K` (spike
 * `spikes/modelo/preset25/`), na mesma ordem. */
function emitirCtu(rung: Rung, ctu: ElementoCtu, expressaoCU: string): string[] {
  const expressaoReset = calcularExpressaoDeReset(rung, ctu.linhaReset)
  return [
    `  ${ctu.instancia}(CU := ${expressaoCU}, R := ${expressaoReset}, PV := ${ctu.pv});`,
    `  ${ctu.saida} := ${ctu.instancia}.Q;`,
  ]
}

// -- Montagem do degrau (D-7, D-8) ----------------------------------------

/** Degrau sem nenhum elemento e sem nenhum ramo (D-7): não foi tocado pelo
 * autor, é omitido do texto sem gerar nem comentário. Mesma leitura de
 * "espaço em branco" que `rungAindaNaoComecado` usa em `validacao.ts`. */
function rungVazio(rung: Rung): boolean {
  return rung.elementos.length === 0 && rung.ramos.length === 0
}

interface DegrauEmitido {
  linhas: string[]
  rungId: string
}

/**
 * Linhas ST de um degrau não vazio, ou uma recusa. A recusa aqui cobre
 * diagramas que `validarDiagrama` já marca como erro e que `serializar` não
 * revalida por conta própria (ex.: degrau com ramo mas sem bobina, porque o
 * ramo ficou vazio) — decisão tomada para nunca gerar texto sem sentido a
 * partir de um diagrama estruturalmente incompleto, mesmo fora dos dois
 * casos (variável nula/inexistente) que o plano cita explicitamente.
 */
function bobinasNaColunaTerminal(rung: Rung): Elemento[] {
  return rung.elementos
    .filter((e) => e.celula.coluna === COLUNA_TERMINAL && ehBobina(e.tipo))
    .sort((a, b) => a.celula.linha - b.celula.linha)
}

function emitirDegrau(rung: Rung, indiceDegrau: number): { ok: true; valor: DegrauEmitido } | { ok: false; motivo: string } {
  const elementoPrincipal = rung.elementos.find(
    (e) => e.celula.linha === 0 && e.celula.coluna === COLUNA_TERMINAL && ehTerminal(e.tipo),
  )
  if (elementoPrincipal === undefined) {
    return {
      ok: false,
      motivo: `degrau ${indiceDegrau + 1} não termina num terminal (bobina ou CTU) — diagrama estruturalmente inválido para serialização`,
    }
  }

  const termo = calcularExpressaoDoDegrau(rung)
  const expressao = renderizarTermo(termo)
  let linhasDoTerminal: string[]
  if (ehCtu(elementoPrincipal)) {
    linhasDoTerminal = emitirCtu(rung, elementoPrincipal, expressao)
  } else {
    linhasDoTerminal = bobinasNaColunaTerminal(rung).flatMap((bobina) =>
      emitirBobina(bobina.tipo as TipoBobina, variavelDoElemento(bobina) as string, expressao),
    )
  }
  const linhas = [`  (* degrau ${indiceDegrau + 1} *)`, ...linhasDoTerminal]

  return { ok: true, valor: { linhas, rungId: rung.id } }
}

// -- Declarações (D-3) -----------------------------------------------------

/** Instâncias de CTU do diagrama, na ordem dos degraus (D-3, revisão
 * aditiva) — mesma ordem em que os degraus aparecem em `diagrama.rungs`,
 * não a ordem de inserção dos elementos dentro de cada um (só um terminal
 * CTU por degrau é uma invariante estrutural, não algo que este arquivo
 * precise impor). */
function instanciasDeCtu(diagrama: Diagrama): string[] {
  const instancias: string[] = []
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) {
      if (ehCtu(elemento)) instancias.push(elemento.instancia)
    }
  }
  return instancias
}

function linhasDeDeclaracao(diagrama: Diagrama): string[] {
  const localizadas = diagrama.variaveis.filter((v) => v.endereco !== undefined)
  const internas = diagrama.variaveis.filter((v) => v.endereco === undefined)
  const instancias = instanciasDeCtu(diagrama)
  const linhas: string[] = []

  if (localizadas.length > 0) {
    linhas.push('  VAR')
    for (const v of localizadas) linhas.push(`    ${v.nome} AT ${v.endereco} : BOOL;`)
    linhas.push('  END_VAR')
  }
  if (internas.length > 0 || instancias.length > 0) {
    linhas.push('  VAR')
    for (const v of internas) linhas.push(`    ${v.nome} : BOOL;`)
    for (const instancia of instancias) linhas.push(`    ${instancia} : CTU;`)
    linhas.push('  END_VAR')
  }

  return linhas
}

// -- serializar (contrato) -------------------------------------------------

/**
 * Traduz `diagrama` para Structured Text (RF-1 a RF-4), ou recusa com motivo
 * (RF-5, revisão do RF-5). Não chama `validarDiagrama`: o portão de erro
 * estrutural é da IDE (D-6, Q-2), não deste arquivo. As duas checagens que
 * fazemos aqui — variável nula e variável inexistente — cobrem só o que
 * usaríamos para gerar texto sem sentido; o resto do diagrama é assumido
 * validado por quem chama.
 */
export function serializar(diagrama: Diagrama): ResultadoSerializacao {
  for (let indiceDegrau = 0; indiceDegrau < diagrama.rungs.length; indiceDegrau++) {
    const rung = diagrama.rungs[indiceDegrau]
    for (const elemento of rung.elementos) {
      const motivoTipo = motivoTipoDesconhecido(elemento.tipo)
      if (motivoTipo !== null) {
        return {
          ok: false,
          motivo: `${motivoTipo} (degrau ${indiceDegrau + 1}, elemento '${elemento.id}')`,
          rungId: rung.id,
        }
      }
    }
  }

  const motivoNomes = validarNomesDeVariaveis(diagrama)
  if (motivoNomes !== null) return { ok: false, motivo: motivoNomes }

  const motivoCtus = validarInstanciasCtu(diagrama)
  if (motivoCtus !== null) return { ok: false, motivo: motivoCtus }

  for (let indiceDegrau = 0; indiceDegrau < diagrama.rungs.length; indiceDegrau++) {
    const rung = diagrama.rungs[indiceDegrau]
    for (const elemento of rung.elementos) {
      if (variavelDoElemento(elemento) === null) {
        return {
          ok: false,
          motivo: `elemento '${elemento.id}' em degrau ${indiceDegrau + 1} está sem variável atribuída`,
          rungId: rung.id,
        }
      }
      if (!diagrama.variaveis.some((v) => v.nome === variavelDoElemento(elemento))) {
        return {
          ok: false,
          motivo: `elemento '${elemento.id}' em degrau ${indiceDegrau + 1} referencia a variável '${variavelDoElemento(elemento)}', que não existe`,
          rungId: rung.id,
        }
      }
    }
  }

  const linhas: string[] = []
  linhas.push('(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)')
  linhas.push('PROGRAM prog0')
  linhas.push(...linhasDeDeclaracao(diagrama))
  linhas.push('')

  const mapaLinhas: TrechoDegrau[] = []
  for (let indiceDegrau = 0; indiceDegrau < diagrama.rungs.length; indiceDegrau++) {
    const rung = diagrama.rungs[indiceDegrau]
    if (rungVazio(rung)) continue

    const resultado = emitirDegrau(rung, indiceDegrau)
    if (!resultado.ok) {
      return { ok: false, motivo: resultado.motivo, rungId: rung.id }
    }

    const linhaInicio = linhas.length + 1
    linhas.push(...resultado.valor.linhas)
    const linhaFim = linhas.length
    mapaLinhas.push({ rungId: resultado.valor.rungId, linhaInicio, linhaFim })
  }

  if (mapaLinhas.length === 0) {
    return { ok: false, vazio: true, motivo: 'nada a compilar: o diagrama não tem elementos' }
  }

  linhas.push('END_PROGRAM')
  linhas.push('')
  linhas.push('CONFIGURATION Config0')
  linhas.push('  RESOURCE Res0 ON PLC')
  linhas.push('    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);')
  linhas.push('    PROGRAM instance0 WITH task0 : prog0;')
  linhas.push('  END_RESOURCE')
  linhas.push('END_CONFIGURATION')

  return { ok: true, st: linhas.join('\n') + '\n', mapaLinhas }
}

/**
 * Degrau (`rungId`) que gerou `linha` (1-based) do texto produzido por
 * `serializar`, ou `null` se `linha` não pertence a nenhum trecho de
 * `mapaLinhas` — declarações, cabeçalho e o esqueleto de `CONFIGURATION`
 * ficam fora de qualquer trecho. Antecipa a tarefa #6 (rastreio Q-3).
 */
export function degrauDaLinha(mapaLinhas: TrechoDegrau[], linha: number): string | null {
  const trecho = mapaLinhas.find((t) => linha >= t.linhaInicio && linha <= t.linhaFim)
  return trecho === undefined ? null : trecho.rungId
}
