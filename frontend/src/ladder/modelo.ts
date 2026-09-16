/**
 * Modelo de dados da grade Ladder (spec 002, plano D-2 e §5).
 *
 * Independente de renderização: nada aqui conhece React ou SVG. É o contrato
 * que o editor desenha e que o serializador (F8) e o simulador (F9) vão
 * consumir. Nasceu do spike S4 (`spikes/modelo/`), reescrito com os ajustes
 * do plano. Código autoral do projeto.
 *
 * A grade de um degrau é endereçada por (linha, coluna): a linha 0 é o trilho
 * principal; linhas > 0 só existem dentro de um ramo paralelo. Terminais
 * (bobinas) ocupam a última coluna da linha 0; contatos, as anteriores.
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

export type Elemento = {
  id: string
  tipo: TipoContato | TipoBobina
  celula: Celula
  variavel: string | null
}

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
  versao: 1
  variaveis: Variavel[]
  rungs: Rung[]
}

export function ehContato(tipo: Elemento['tipo']): tipo is TipoContato {
  return tipo === 'contato_na' || tipo === 'contato_nf'
}

export function ehBobina(tipo: Elemento['tipo']): tipo is TipoBobina {
  return tipo === 'bobina' || tipo === 'bobina_set' || tipo === 'bobina_reset'
}

/** Coluna reservada aos terminais. */
export const COLUNA_TERMINAL = COLUNAS_POR_DEGRAU - 1
