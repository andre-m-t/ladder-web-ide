/**
 * Contrato de ambientes de simulação (spec 005, plano D-1).
 * Núcleo puro — sem React, sem relógio. Código autoral.
 */

/** Papel do ponto no contrato da planta. */
export type PapelPonto = 'entrada_usuario' | 'sensor' | 'atuador' | 'indicador'

/** Direção elétrica do ponto em relação ao programa Ladder. */
export type DirecaoPonto = 'entrada' | 'saida'

export interface PontoAmbiente {
  endereco: string
  direcao: DirecaoPonto
  papel: PapelPonto
  rotulo: string
  /** Nome de variável proposto ao criar a variável a partir do contrato
   * (revisão 2026-09-23); ausente, o nome sai do `rotulo`. */
  nomeSugerido?: string
}

/** Mapa de endereço → nível lógico lido das saídas do ciclo de varredura. */
export type MapaSaidas = Readonly<Record<string, boolean>>

/** Mapa de endereço → nível que a planta devolve para entradas do próximo ciclo. */
export type MapaEntradas = Readonly<Record<string, boolean>>

export interface ResultadoPassoPlanta<EstadoPlanta> {
  estado: EstadoPlanta
  entradas: MapaEntradas
  /** Falha grave da planta (ex.: motor danificado) — a IDE pausa a simulação. */
  falha: string | null
}

export type ComandoUsuario = string

export interface DefinicaoAmbiente<EstadoPlanta> {
  id: string
  nome: string
  descricao: string
  pontos: readonly PontoAmbiente[]
  criarEstado: () => EstadoPlanta
  avancar: (estado: EstadoPlanta, saidas: MapaSaidas) => ResultadoPassoPlanta<EstadoPlanta>
  acionarComando: (estado: EstadoPlanta, comando: ComandoUsuario, pressionado: boolean) => EstadoPlanta
  /** Endereços de entrada que a planta escreve a cada passo (bloqueio na tabela). */
  enderecosEntradaComandados: () => readonly string[]
}
