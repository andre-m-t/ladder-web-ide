/**
 * Motor de simulação do ciclo de varredura (spec 004, plano §5.1).
 *
 * **CONTRATO — Etapa 0 do plano 004.** Este arquivo é publicado pelo
 * orquestrador *antes* de qualquer frente começar, como `plc_hal.h` e
 * `ElementoCtu` foram: tipos e assinaturas fixos, implementação da frente N
 * (tarefa #1). As funções abaixo ainda lançam; quem consome (desenho e tela)
 * programa contra estas assinaturas sem esperar o núcleo ficar pronto.
 *
 * Núcleo puro: nada aqui conhece React, SVG, `localStorage`, relógio ou
 * pinagem. Quem decide *quando* chamar `executarCiclo` é a interface (que tem
 * relógio) ou o executor de teste (que chama em laço). Código autoral.
 *
 * **RF-7 — proibição deliberada:** a energização é calculada por propagação de
 * fluxo da esquerda para a direita sobre um grafo de nós (plano D-1). É
 * **proibido** importar `serializador.ts` ou reaproveitar a redução
 * série-paralelo dele. A razão não é estilo: o runtime em C executa o texto que
 * o serializador produz, e a medição que dá valor a esta feature compara os
 * dois. Se as duas leituras da topologia fossem a mesma, um erro apareceria
 * idêntico nos dois lados, a comparação mediria zero divergências e o
 * instrumento diria "de acordo" sem ter medido nada. A duplicação é o
 * instrumento. Ver o §9 do plano 004 e a tensão registrada no §10 da spec.
 */

import {
  COLUNA_TERMINAL,
  ehBobina,
  ehContato,
  ehBloco,
  ehRamoDeSaida,
  ehTerminal,
  variavelDoElemento,
  type Diagrama,
  type Elemento,
  type ElementoBloco,
  type Ramo,
  type Rung,
} from './modelo'
import { DESCRITORES, PERIODO_VARREDURA_MS } from './blocos'
import { classeDaVariavel } from './enderecos'

/** Chave de nó: `${linha}:${no}`, com `no` de 0 a `COLUNAS_POR_DEGRAU`.
 * O nó `k` é a fronteira à esquerda da coluna `k`; o nó 0 da linha 0 é o
 * trilho esquerdo, sempre energizado. */
export type ChaveNo = string

/** Chave de célula: `${linha}:${coluna}`. */
export type ChaveCelula = string

/** Estado energizado de um degrau, no detalhe que o desenho precisa (RF-6):
 * não só o resultado, mas **por onde** a energia passa. */
export interface EnergizacaoDegrau {
  /** Nó energizado — a energia chega àquela fronteira de coluna. */
  nos: Record<ChaveNo, boolean>
  /** O trecho de fio da célula está energizado: entra energizado **e** conduz. */
  celulas: Record<ChaveCelula, boolean>
  /** Estado próprio do elemento: contato conduzindo, bobina ou contador acionado. */
  elementos: Record<string, boolean>
}

/** Estado interno de contador (CTU/CTD). */
export interface EstadoContadorSim {
  familia: 'contador'
  contagem: number
  entradaAnterior: boolean
}

/** Estado interno de temporizador (TON/TOF) — semântica MATIEC. */
export interface EstadoTemporizadorSim {
  familia: 'temporizador'
  fase: 0 | 1 | 2
  inAnterior: boolean
  inicioMs: number
  etMs: number
}

export type EstadoBlocoSim = EstadoContadorSim | EstadoTemporizadorSim

/** @deprecated Use `EstadoBlocoSim`. */
export type EstadoContador = EstadoContadorSim

/** Estado completo de uma simulação. Imutável: toda função devolve estado
 * novo (plano D-6). */
export interface EstadoSimulacao {
  /** Ciclos já executados; 0 no estado inicial. */
  ciclo: number
  /** Nível de cada variável declarada, depois do último ciclo. */
  variaveis: Record<string, boolean>
  /** Entradas acionadas pelo usuário. Só entram na imagem de processo no
   * início do próximo ciclo (RF-1/RF-12, plano D-2). */
  entradas: Record<string, boolean>
  /** Estado interno por instância de bloco FB. */
  blocos: Record<string, EstadoBlocoSim>
  /** @deprecated Use `blocos`. */
  contadores: Record<string, EstadoContadorSim>
  /** Energização por id de degrau, resultado do último ciclo. */
  energizacao: Record<string, EnergizacaoDegrau>
}

/** Recusa de acionamento, no mesmo formato das operações de `edicao.ts`. */
export type ResultadoAcionamento =
  | { ok: true; estado: EstadoSimulacao }
  | { ok: false; motivo: string }

/** Intervalo de ciclo do laço de varredura do firmware (`T#20ms`), em
 * milissegundos. É a marcha "tempo real" da interface (RF-11). */
export const INTERVALO_TEMPO_REAL_MS = PERIODO_VARREDURA_MS

export { PERIODO_VARREDURA_MS }

// ---------------------------------------------------------------------------
// Leitura de topologia própria e independente (RF-7). Nada aqui importa ou
// consulta `serializador.ts`: a energização é recalculada do zero por
// propagação de fluxo sobre um grafo de nós (plano D-1), nó por linha, célula
// por célula — ver o cabeçalho deste arquivo para a razão de a duplicação
// contra o serializador ser deliberada.
// ---------------------------------------------------------------------------

/** Tipos de elemento que este motor conhece (RF-3). Um `switch` exaustivo por
 * `never`, no mesmo espírito do `motivoTipoDesconhecido` do serializador:
 * qualquer tipo fora do subconjunto — inalcançável pelo sistema de tipos, mas
 * alcançável por um diagrama vindo de fora dele (`localStorage`, um JSON
 * carregado à mão) — lança em vez de atravessar em silêncio. Como
 * `executarCiclo`/`criarEstado` não têm um canal de recusa (`ResultadoX`) no
 * contrato publicado, a recusa aqui só pode ser um `throw`: é a decisão de
 * semântica registrada no relatório da tarefa #1. */
function verificarTipoConhecido(tipo: Elemento['tipo']): void {
  switch (tipo) {
    case 'contato_na':
    case 'contato_nf':
    case 'bobina':
    case 'bobina_set':
    case 'bobina_reset':
    case 'ctu':
    case 'ctd':
    case 'ton':
    case 'tof':
      return
    default: {
      const tipoForjado: never = tipo
      throw new Error(`simulacao: elemento fora do subconjunto suportado: '${String(tipoForjado)}'`)
    }
  }
}

function chaveNo(linha: number, no: number): ChaveNo {
  return `${linha}:${no}`
}

function chaveCelula(linha: number, coluna: number): ChaveCelula {
  return `${linha}:${coluna}`
}

/**
 * O contato de `(linha, coluna)` conduz, dado o estado atual de `variaveis`?
 * Célula vazia é fio nu — conduz sempre. NA conduz se a variável é
 * verdadeira; NF, se é falsa.
 *
 * **Decisão de semântica (elemento sem variável vinculada):** um contato cuja
 * `variavel` é `null` **não conduz**, seja NA ou NF. Um diagrama nesse estado
 * já é recusado por `validarDiagrama` (`variavel_nao_atribuida`) antes de
 * chegar à simulação (RF-18); esta regra só importa para quem chama o núcleo
 * diretamente (ex.: um teste), e "não conduz" é a leitura mais segura — nunca
 * fecha um caminho que o autor não terminou de desenhar.
 */
function contatoConduz(rung: Rung, linha: number, coluna: number, variaveis: Record<string, boolean>): boolean {
  const elemento = rung.elementos.find(
    (e) => e.celula.linha === linha && e.celula.coluna === coluna && ehContato(e.tipo),
  )
  if (elemento === undefined) return true
  const nome = variavelDoElemento(elemento)
  if (nome === null) return false
  const valor = variaveis[nome] ?? false
  return elemento.tipo === 'contato_na' ? valor : !valor
}

/** Resultado da leitura de fluxo de um degrau — puro, função só de `rung` e
 * `variaveis`: nenhuma escrita, nenhum estado de contador envolvido (a
 * energização de um degrau nunca depende do resultado do próprio ciclo de
 * escrita, só da leitura corrente das variáveis). */
interface FluxoDegrau {
  nos: Record<ChaveNo, boolean>
  celulas: Record<ChaveCelula, boolean>
  elementos: Record<string, boolean>
  /** Energia alcança a coluna do terminal (bobina ou CTU) deste degrau. */
  energizadoTerminal: boolean
  /** Caminho de controle (R/LD) do bloco do degrau, se houver. */
  controleConduz: boolean
}

/**
 * Propagação de fluxo da esquerda para a direita sobre o grafo de nós do
 * degrau (plano D-1, RF-6, RF-7). Um ramo liga o nó `colunaInicio` da linha 0
 * à sua própria linha, e essa linha de volta ao nó `colunaFim+1` da linha 0 —
 * por isso um ramo nunca precisa da leitura de outro ramo para se resolver: a
 * varredura da linha 0 em ordem crescente de coluna já garante que o nó de
 * entrada de qualquer ramo (`colunaInicio <= colunaFim < colunaFim+1`) está
 * calculado antes de a linha 0 precisar dele. Isso vale também para ramos
 * aninhados (uma linha "dentro" do intervalo de colunas de outra): a linha
 * aninhada liga de volta à linha 0 diretamente, nunca à linha que a contém —
 * ver o relatório da tarefa #1 para a prova contra o oráculo independente de
 * `serializador.test.ts`.
 *
 * A linha de reinício de um CTU (`linhaControle`) não é um `Ramo` (`ctu.ts`): é
 * resolvida à parte, como se estivesse ligada diretamente ao trilho esquerdo
 * (sempre energizada em `coluna 0`), porque ela nunca alimenta o fluxo
 * principal do degrau — só o parâmetro `R` do contador.
 */
function calcularFluxoDoRung(rung: Rung, variaveis: Record<string, boolean>): FluxoDegrau {
  for (const elemento of rung.elementos) verificarTipoConhecido(elemento.tipo)

  const nos: Record<ChaveNo, boolean> = {}
  const celulas: Record<ChaveCelula, boolean> = {}
  const elementos: Record<string, boolean> = {}

  nos[chaveNo(0, 0)] = true

  function resolverRamo(ramo: Ramo): boolean {
    const entrada = nos[chaveNo(0, ramo.colunaInicio)] ?? false
    nos[chaveNo(ramo.linha, ramo.colunaInicio)] = entrada
    let atual = entrada
    for (let coluna = ramo.colunaInicio; coluna <= ramo.colunaFim; coluna++) {
      const conduz = contatoConduz(rung, ramo.linha, coluna, variaveis)
      celulas[chaveCelula(ramo.linha, coluna)] = atual && conduz
      atual = atual && conduz
      nos[chaveNo(ramo.linha, coluna + 1)] = atual
    }
    return atual
  }

  for (let coluna = 1; coluna <= COLUNA_TERMINAL; coluna++) {
    const anterior = nos[chaveNo(0, coluna - 1)] ?? false
    const conduzTrilho = contatoConduz(rung, 0, coluna - 1, variaveis)
    celulas[chaveCelula(0, coluna - 1)] = anterior && conduzTrilho
    let energizado = anterior && conduzTrilho

    for (const ramo of rung.ramos) {
      if (ehRamoDeSaida(ramo)) continue
      if (ramo.colunaFim + 1 !== coluna) continue
      if (resolverRamo(ramo)) energizado = true
    }

    nos[chaveNo(0, coluna)] = energizado
  }

  const energizadoTerminal = nos[chaveNo(0, COLUNA_TERMINAL)] ?? false

  // Contatos: `elementos[id]` é a condução própria do elemento (RF-6),
  // independente de estar ou não no caminho até o terminal — inclusive os da
  // linha de reinício do CTU, que nunca alimentam o fluxo principal.
  for (const elemento of rung.elementos) {
    if (ehContato(elemento.tipo)) {
      elementos[elemento.id] = contatoConduz(rung, elemento.celula.linha, elemento.celula.coluna, variaveis)
    }
  }

  let controleConduz = false
  const bloco = rung.elementos.find(ehBloco)
  if (bloco !== undefined && bloco.linhaControle !== null) {
    nos[chaveNo(bloco.linhaControle, 0)] = true
    let atual = true
    for (let coluna = 0; coluna < COLUNA_TERMINAL; coluna++) {
      const conduz = contatoConduz(rung, bloco.linhaControle, coluna, variaveis)
      celulas[chaveCelula(bloco.linhaControle, coluna)] = atual && conduz
      atual = atual && conduz
      nos[chaveNo(bloco.linhaControle, coluna + 1)] = atual
    }
    controleConduz = atual
  }

  // Terminal (bobina ou CTU): "acionado" é a mesma leitura para os dois — a
  // energia alcança a coluna do terminal. Para o CTU isso é o parâmetro `CU`;
  // ver a nota de semântica no relatório da tarefa #1 sobre por que não é o
  // resultado `Q` (que já aparece no desenho como o contato de quem lê a
  // variável de saída em outro degrau).
  const principal = rung.elementos.find(
    (e) => e.celula.linha === 0 && e.celula.coluna === COLUNA_TERMINAL && ehTerminal(e.tipo),
  )
  if (principal !== undefined) {
    if (ehBloco(principal)) {
      elementos[principal.id] = energizadoTerminal
    } else {
      for (const bobina of rung.elementos.filter(
        (e) => e.celula.coluna === COLUNA_TERMINAL && ehBobina(e.tipo),
      )) {
        elementos[bobina.id] = energizadoTerminal
      }
    }
  }

  return { nos, celulas, elementos, energizadoTerminal, controleConduz }
}

/**
 * Aplica a escrita do terminal de um degrau (RF-2, RF-4, RF-5; plano D-3,
 * D-4): bobina simples escreve incondicionalmente; SET/RESET só escrevem
 * quando energizadas; o CTU decide reinício antes de contagem — na ordem
 * exata do FB padrão da IEC 61131-3 e do `blink.st` dourado (`ctu0(CU :=
 * pulso, R := reset_ctu, PV := 12)`): reinício tem precedência; senão, borda
 * de subida de `CU` incrementa a contagem (com teto `PV_MAX`); `cuAnterior`
 * é sempre atualizado por último; `Q` (e a variável de saída) sai de
 * `contagem >= pv`. Muta `variaveis` e `contadores` — os dois já são cópias
 * de trabalho do ciclo corrente (D-3: a escrita de um degrau precisa ficar
 * visível para os degraus seguintes do mesmo ciclo).
 */
function estadoInicialBloco(bloco: ElementoBloco): EstadoBlocoSim {
  const familia = DESCRITORES[bloco.tipo].familiaSimulacao
  if (familia === 'contador') {
    return { familia: 'contador', contagem: 0, entradaAnterior: false }
  }
  return { familia: 'temporizador', fase: 0, inAnterior: false, inicioMs: 0, etMs: 0 }
}

function agoraMs(ciclo: number): number {
  return ciclo * PERIODO_VARREDURA_MS
}

function aplicarContadorCtu(
  bloco: ElementoBloco,
  fluxo: FluxoDegrau,
  anterior: EstadoContadorSim,
): { estado: EstadoContadorSim; q: boolean } {
  let contagem = anterior.contagem
  const inAtual = fluxo.energizadoTerminal
  if (fluxo.controleConduz) {
    contagem = 0
  } else if (inAtual && !anterior.entradaAnterior && contagem < bloco.preset) {
    contagem += 1
  }
  const estado: EstadoContadorSim = { familia: 'contador', contagem, entradaAnterior: inAtual }
  return { estado, q: contagem >= bloco.preset }
}

function aplicarContadorCtd(
  bloco: ElementoBloco,
  fluxo: FluxoDegrau,
  anterior: EstadoContadorSim,
): { estado: EstadoContadorSim; q: boolean } {
  let contagem = anterior.contagem
  const inAtual = fluxo.energizadoTerminal
  if (fluxo.controleConduz) {
    contagem = bloco.preset
  } else if (inAtual && !anterior.entradaAnterior && contagem > 0) {
    contagem -= 1
  }
  const estado: EstadoContadorSim = { familia: 'contador', contagem, entradaAnterior: inAtual }
  return { estado, q: contagem <= 0 }
}

function aplicarTemporizadorTon(
  bloco: ElementoBloco,
  fluxo: FluxoDegrau,
  anterior: EstadoTemporizadorSim,
  tMs: number,
): { estado: EstadoTemporizadorSim; q: boolean } {
  const inAtual = fluxo.energizadoTerminal
  let { fase, inicioMs, etMs } = anterior

  if (fase === 0 && !anterior.inAnterior && inAtual) {
    fase = 1
    inicioMs = tMs
    etMs = 0
  } else if (!inAtual) {
    fase = 0
    etMs = 0
  } else if (fase === 1) {
    if (inicioMs + bloco.preset <= tMs) {
      fase = 2
      etMs = bloco.preset
    } else {
      etMs = tMs - inicioMs
    }
  }

  const estado: EstadoTemporizadorSim = { familia: 'temporizador', fase, inAnterior: inAtual, inicioMs, etMs }
  return { estado, q: fase === 2 }
}

function aplicarTemporizadorTof(
  bloco: ElementoBloco,
  fluxo: FluxoDegrau,
  anterior: EstadoTemporizadorSim,
  tMs: number,
): { estado: EstadoTemporizadorSim; q: boolean } {
  const inAtual = fluxo.energizadoTerminal
  let { fase, inicioMs, etMs } = anterior

  if (fase === 0 && anterior.inAnterior && !inAtual) {
    fase = 1
    inicioMs = tMs
  } else if (inAtual) {
    fase = 0
    etMs = 0
  } else if (fase === 1) {
    if (inicioMs + bloco.preset <= tMs) {
      fase = 2
      etMs = bloco.preset
    } else {
      etMs = tMs - inicioMs
    }
  }

  const q = inAtual || fase === 1
  const estado: EstadoTemporizadorSim = { familia: 'temporizador', fase, inAnterior: inAtual, inicioMs, etMs }
  return { estado, q }
}

function aplicarEscritaDoTerminal(
  terminal: Elemento,
  fluxo: FluxoDegrau,
  variaveis: Record<string, boolean>,
  blocos: Record<string, EstadoBlocoSim>,
  cicloAtual: number,
): void {
  if (ehBloco(terminal)) {
    const anterior = blocos[terminal.instancia] ?? estadoInicialBloco(terminal)
    const tMs = agoraMs(cicloAtual)
    let resultado: { estado: EstadoBlocoSim; q: boolean }

    const tipoBloco = terminal.tipo
    switch (tipoBloco) {
      case 'ctu':
        resultado = aplicarContadorCtu(terminal, fluxo, anterior as EstadoContadorSim)
        break
      case 'ctd':
        resultado = aplicarContadorCtd(terminal, fluxo, anterior as EstadoContadorSim)
        break
      case 'ton':
        resultado = aplicarTemporizadorTon(terminal, fluxo, anterior as EstadoTemporizadorSim, tMs)
        break
      case 'tof':
        resultado = aplicarTemporizadorTof(terminal, fluxo, anterior as EstadoTemporizadorSim, tMs)
        break
      default: {
        const _: never = tipoBloco
        throw new Error(`simulacao: bloco desconhecido: ${String(_)}`)
      }
    }

    blocos[terminal.instancia] = resultado.estado
    if (terminal.saida !== null) variaveis[terminal.saida] = resultado.q
    return
  }

  const nome = terminal.variavel
  if (nome === null) return
  switch (terminal.tipo) {
    case 'bobina':
      variaveis[nome] = fluxo.energizadoTerminal
      return
    case 'bobina_set':
      if (fluxo.energizadoTerminal) variaveis[nome] = true
      return
    case 'bobina_reset':
      if (fluxo.energizadoTerminal) variaveis[nome] = false
      return
    default:
      // Inalcançável: `verificarTipoConhecido` já filtrou `elemento.tipo` em
      // `calcularFluxoDoRung`, e o terminal só chega aqui se não for CTU —
      // sobram as três variantes de `TipoBobina` acima.
      return
  }
}

function energizacaoDoFluxo(fluxo: FluxoDegrau): EnergizacaoDegrau {
  return { nos: fluxo.nos, celulas: fluxo.celulas, elementos: fluxo.elementos }
}

/**
 * Estado inicial: todas as variáveis e entradas em falso, contadores zerados,
 * ciclo 0 e a energização já calculada para esse estado (um diagrama sem
 * contato nenhum energiza o fio até a bobina mesmo antes do primeiro ciclo).
 *
 * A energização é uma **leitura** do estado inicial (fluxo sobre variáveis
 * todas falsas) — não aplica nenhuma escrita: se aplicasse, uma bobina
 * alimentada por um degrau sem contato nenhum ficaria verdadeira antes do
 * primeiro ciclo, contradizendo "todas as variáveis em falso".
 */
export function criarEstado(diagrama: Diagrama): EstadoSimulacao {
  const variaveis: Record<string, boolean> = {}
  const entradas: Record<string, boolean> = {}
  for (const variavel of diagrama.variaveis) {
    variaveis[variavel.nome] = false
    if (classeDaVariavel(variavel) === 'entrada') entradas[variavel.nome] = false
  }

  const blocos: Record<string, EstadoBlocoSim> = {}
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) {
      if (ehBloco(elemento)) blocos[elemento.instancia] = estadoInicialBloco(elemento)
    }
  }

  const energizacao: Record<string, EnergizacaoDegrau> = {}
  for (const rung of diagrama.rungs) {
    energizacao[rung.id] = energizacaoDoFluxo(calcularFluxoDoRung(rung, variaveis))
  }

  const contadoresLegado: Record<string, EstadoContadorSim> = {}
  for (const [k, v] of Object.entries(blocos)) {
    if (v.familia === 'contador') contadoresLegado[k] = v
  }

  return { ciclo: 0, variaveis, entradas, blocos, contadores: contadoresLegado, energizacao }
}

/**
 * Um ciclo de varredura (RF-1 a RF-5; plano D-2, D-3, D-4):
 * 1. copia `estado.entradas` para os valores das variáveis — **uma vez**;
 * 2. resolve os degraus na ordem, sobre essa mesma leitura, escrevendo em
 *    `variaveis` conforme resolve (a escrita de um degrau é visível para os
 *    seguintes, no mesmo ciclo);
 * 3. devolve o estado novo, com `ciclo` incrementado e a energização de cada
 *    degrau.
 */
export function executarCiclo(diagrama: Diagrama, estado: EstadoSimulacao): EstadoSimulacao {
  const variaveis: Record<string, boolean> = { ...estado.variaveis }
  for (const nome of Object.keys(estado.entradas)) {
    variaveis[nome] = estado.entradas[nome]
  }

  const blocos: Record<string, EstadoBlocoSim> = {}
  const origem =
    estado.blocos ??
    Object.fromEntries(
      Object.entries(estado.contadores ?? {}).map(([k, v]) => [
        k,
        {
          familia: 'contador' as const,
          contagem: v.contagem,
          entradaAnterior: v.entradaAnterior ?? (v as { cuAnterior?: boolean }).cuAnterior ?? false,
        },
      ]),
    )
  for (const instancia of Object.keys(origem)) {
    const b = origem[instancia]
    blocos[instancia] = b.familia === 'contador' ? { ...b } : { ...b }
  }

  const energizacao: Record<string, EnergizacaoDegrau> = {}
  for (const rung of diagrama.rungs) {
    const fluxo = calcularFluxoDoRung(rung, variaveis)
    const principal = rung.elementos.find(
      (e) => e.celula.linha === 0 && e.celula.coluna === COLUNA_TERMINAL && ehTerminal(e.tipo),
    )
    if (principal !== undefined) {
      if (ehBloco(principal)) {
        aplicarEscritaDoTerminal(principal, fluxo, variaveis, blocos, estado.ciclo)
      } else {
        for (const bobina of rung.elementos.filter(
          (e) => e.celula.coluna === COLUNA_TERMINAL && ehBobina(e.tipo),
        )) {
          aplicarEscritaDoTerminal(bobina, fluxo, variaveis, blocos, estado.ciclo)
        }
      }
    }
    energizacao[rung.id] = energizacaoDoFluxo(fluxo)
  }

  const contadoresLegado: Record<string, EstadoContadorSim> = {}
  for (const [k, v] of Object.entries(blocos)) {
    if (v.familia === 'contador') contadoresLegado[k] = v
  }

  return {
    ciclo: estado.ciclo + 1,
    variaveis,
    entradas: { ...estado.entradas },
    blocos,
    contadores: contadoresLegado,
    energizacao,
  }
}

/**
 * Aciona uma variável de **entrada** (RF-12). O valor passa a valer a partir do
 * próximo ciclo, nunca no que está em curso. Recusa, com motivo em português,
 * variável inexistente ou que não seja de entrada — saída e memória são
 * escritas pela lógica, não pelo usuário.
 */
export function acionarEntrada(
  diagrama: Diagrama,
  estado: EstadoSimulacao,
  nome: string,
  nivel: boolean,
): ResultadoAcionamento {
  const variavel = diagrama.variaveis.find((v) => v.nome === nome)
  if (variavel === undefined) {
    return { ok: false, motivo: `variável '${nome}' inexistente` }
  }
  if (classeDaVariavel(variavel) !== 'entrada') {
    return {
      ok: false,
      motivo: `variável '${nome}' não é de entrada — apenas entradas podem ser acionadas manualmente`,
    }
  }

  return {
    ok: true,
    estado: { ...estado, entradas: { ...estado.entradas, [nome]: nivel } },
  }
}

/**
 * Volta ao estado inicial completo (plano D-7): zera variáveis, entradas
 * acionadas, contadores e a contagem de ciclos. Equivalente a `criarEstado`.
 */
export function reiniciar(diagrama: Diagrama): EstadoSimulacao {
  return criarEstado(diagrama)
}
