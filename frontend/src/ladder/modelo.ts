/**
 * Modelo de dados da grade Ladder (spec 002, plano D-2 e §5; spec 006 — blocos FB).
 *
 * Independente de renderização: nada aqui conhece React ou SVG. É o contrato
 * que o editor desenha e que o serializador (F8) e o simulador (F9) vão
 * consumir. Nasceu do spike S4 (`spikes/modelo/`), reescrito com os ajustes
 * do plano. Código autoral do projeto.
 *
 * A grade de um degrau é endereçada por (linha, coluna): a linha 0 é o trilho
 * principal; linhas > 0 só existem dentro de um ramo paralelo ou numa linha de
 * controle de bloco (R/LD). Terminais (bobinas e blocos FB) ocupam a última
 * coluna da linha 0; contatos, as anteriores.
 */

/** Colunas de todo degrau (Q-3 da spec 002). A última é a dos terminais. */
export const COLUNAS_POR_DEGRAU = 8

/** Linhas além do trilho principal que um degrau pode usar (Q-3). */
export const LINHAS_EXTRAS_MAX = 2

export interface Variavel {
  nome: string
  tipo: 'BOOL'
  /** Endereço localizado (`%IX0.0`...); ausente em variável interna. */
  endereco?: string
}

export interface Celula {
  linha: number
  coluna: number
}

export type TipoContato = 'contato_na' | 'contato_nf'
export type TipoBobina = 'bobina' | 'bobina_set' | 'bobina_reset'

/** Contato ou bobina: lê ou escreve uma única variável booleana. */
export type ElementoSimples = {
  id: string
  tipo: TipoContato | TipoBobina
  celula: Celula
  variavel: string | null
}

/** Blocos de função IEC na coluna terminal (spec 006). */
export type TipoBloco = 'ctu' | 'ctd' | 'ton' | 'tof'

/**
 * Bloco de função na grade (CTU, CTD, TON, TOF — spec 006).
 * A entrada principal (CU/CD/IN) vem do caminho de contatos na linha 0.
 * `linhaControle`: linha extra para R (CTU) ou LD (CTD); `null` nos temporizadores.
 * `preset`: PV em contagens (contadores) ou PT em ms (temporizadores).
 */
export interface ElementoBloco {
  id: string
  tipo: TipoBloco
  celula: Celula
  linhaControle: number | null
  instancia: string
  preset: number
  saida: string | null
}

/** @deprecated Use `ElementoBloco` com `tipo: 'ctu'`. Mantido só para leitura de tipos legados em testes. */
export type ElementoCtu = ElementoBloco & { tipo: 'ctu' }

export type Elemento = ElementoSimples | ElementoBloco

/** Ramo paralelo à linha 0, que sai dela em `colunaInicio` e volta em `colunaFim`. */
export interface Ramo {
  id: string
  linha: number
  colunaInicio: number
  colunaFim: number
}

export interface Rung {
  id: string
  elementos: Elemento[]
  ramos: Ramo[]
}

export interface Diagrama {
  versao: 2
  variaveis: Variavel[]
  rungs: Rung[]
}

export function ehContato(tipo: Elemento['tipo']): tipo is TipoContato {
  return tipo === 'contato_na' || tipo === 'contato_nf'
}

export function ehBobina(tipo: Elemento['tipo']): tipo is TipoBobina {
  return tipo === 'bobina' || tipo === 'bobina_set' || tipo === 'bobina_reset'
}

export function ehTipoBloco(tipo: Elemento['tipo']): tipo is TipoBloco {
  return tipo === 'ctu' || tipo === 'ctd' || tipo === 'ton' || tipo === 'tof'
}

/** Terminal = bobina ou bloco FB na última coluna do trilho principal. */
export function ehTerminal(tipo: Elemento['tipo']): tipo is TipoBobina | TipoBloco {
  return ehBobina(tipo) || ehTipoBloco(tipo)
}

export function ehBloco(elemento: Elemento): elemento is ElementoBloco {
  return ehTipoBloco(elemento.tipo)
}

/** @deprecated Preferir `ehBloco`. */
export function ehCtu(elemento: Elemento): elemento is ElementoBloco & { tipo: 'ctu' } {
  return elemento.tipo === 'ctu'
}

/** Variável que o elemento lê ou escreve: `variavel` do contato/bobina ou `saida` do bloco. */
export function variavelDoElemento(elemento: Elemento): string | null {
  return ehBloco(elemento) ? elemento.saida : elemento.variavel
}

/** Coluna reservada aos terminais. */
export const COLUNA_TERMINAL = COLUNAS_POR_DEGRAU - 1

/** Ramo de saída: só na coluna terminal — reserva a linha para uma bobina paralela. */
export function ehRamoDeSaida(ramo: Ramo): boolean {
  return ramo.colunaInicio === COLUNA_TERMINAL && ramo.colunaFim === COLUNA_TERMINAL
}
