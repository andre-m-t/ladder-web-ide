/**
 * Planta do portão (spec 005, plano D-2).
 * Reimplementação autoral do comportamento didático do simulador Java
 * (Trabalho-Final-CLP-2025); sem cópia de código ou imagem.
 */

import type { DefinicaoAmbiente, MapaEntradas, MapaSaidas, PontoAmbiente, ResultadoPassoPlanta } from './contrato'

/** Abertura normalizada: 0 = totalmente fechado, 100 = totalmente aberto. */
export const ABERTURA_MIN = 0
export const ABERTURA_MAX = 100

/** Incremento por ciclo de varredura (~2 px / 360 px de curso no original). */
export const PASSO_ABERTURA_POR_CICLO = 100 / 180

/** Margem normalizada nas extremidades do curso para fins de curso NA (D-5). */
export const MARGEM_FC = 8

export const ENDERECO_ABRIR = '%IX0.0'
export const ENDERECO_FECHAR = '%IX0.1'
export const ENDERECO_PARAR = '%IX0.2'
export const ENDERECO_FC_SUPERIOR = '%IX0.3'
export const ENDERECO_FC_INFERIOR = '%IX0.4'

export const ENDERECO_MOTOR_SOBE = '%QX0.0'
export const ENDERECO_MOTOR_DESCE = '%QX0.1'
export const ENDERECO_LAMP_ENTREABERTO = '%QX0.2'
export const ENDERECO_LAMP_ABERTO = '%QX0.3'
export const ENDERECO_LAMP_FECHADO = '%QX0.4'

export interface EstadoPortao {
  abertura: number
  motorDanificado: boolean
  botoes: { abrir: boolean; fechar: boolean; parar: boolean }
}

/** `nomeSugerido` segue os nomes da fixture `PORTAO`, para o programa montado
 * a partir do contrato ler igual ao de referência. */
export const PONTOS_PORTAO: readonly PontoAmbiente[] = [
  { endereco: ENDERECO_ABRIR, direcao: 'entrada', papel: 'entrada_usuario', rotulo: 'Abrir', nomeSugerido: 'abrir' },
  { endereco: ENDERECO_FECHAR, direcao: 'entrada', papel: 'entrada_usuario', rotulo: 'Fechar', nomeSugerido: 'fechar' },
  { endereco: ENDERECO_PARAR, direcao: 'entrada', papel: 'entrada_usuario', rotulo: 'Parar', nomeSugerido: 'parar' },
  {
    endereco: ENDERECO_FC_SUPERIOR,
    direcao: 'entrada',
    papel: 'sensor',
    rotulo: 'FC1 (fim de curso superior)',
    nomeSugerido: 'fc_superior',
  },
  {
    endereco: ENDERECO_FC_INFERIOR,
    direcao: 'entrada',
    papel: 'sensor',
    rotulo: 'FC2 (fim de curso inferior)',
    nomeSugerido: 'fc_inferior',
  },
  { endereco: ENDERECO_MOTOR_SOBE, direcao: 'saida', papel: 'atuador', rotulo: 'Motor sobe', nomeSugerido: 'motor_sobe' },
  { endereco: ENDERECO_MOTOR_DESCE, direcao: 'saida', papel: 'atuador', rotulo: 'Motor desce', nomeSugerido: 'motor_desce' },
  {
    endereco: ENDERECO_LAMP_ENTREABERTO,
    direcao: 'saida',
    papel: 'indicador',
    rotulo: 'Entreaberto',
    nomeSugerido: 'lamp_entreaberto',
  },
  { endereco: ENDERECO_LAMP_ABERTO, direcao: 'saida', papel: 'indicador', rotulo: 'Aberto', nomeSugerido: 'lamp_aberto' },
  { endereco: ENDERECO_LAMP_FECHADO, direcao: 'saida', papel: 'indicador', rotulo: 'Fechado', nomeSugerido: 'lamp_fechado' },
]

/**
 * FC superior (NA), revisão 2026-09-23: portão de enrolar com a folha
 * ancorada no topo e o tambor no topo (spec 005, §10). O sensor fica montado
 * junto ao tambor e detecta a **presença da lona** que passa por aquele
 * ponto fixo — não "a folha chegou ao topo". Fechado ou entreaberto: ainda
 * há lona pendente correndo por aquele ponto, contato fechado, `true`.
 * Só quando a folha está **quase toda** enrolada no tambor (perto de
 * `ABERTURA_MAX`) aquele ponto fica livre e o contato abre, `false`.
 *
 * É o inverso do que a primeira versão (2026-09-21) implementava — lá,
 * "NA" tinha sido lido como "ativa perto do extremo que o sensor guarda"
 * (simétrico ao FC inferior), o que corresponderia a um sensor que dispara
 * só quando a folha *chega* àquele ponto, e não ao inverso físico real de
 * um sensor de passagem de lona no enrolamento. Ver nota datada na spec 005.
 */
function nivelFcSuperior(abertura: number): boolean {
  return abertura < ABERTURA_MAX - MARGEM_FC
}

function nivelFcInferior(abertura: number): boolean {
  return abertura <= MARGEM_FC
}

export function montarEntradasPortao(estado: EstadoPortao): MapaEntradas {
  return {
    [ENDERECO_ABRIR]: estado.botoes.abrir,
    [ENDERECO_FECHAR]: estado.botoes.fechar,
    [ENDERECO_PARAR]: estado.botoes.parar,
    [ENDERECO_FC_SUPERIOR]: nivelFcSuperior(estado.abertura),
    [ENDERECO_FC_INFERIOR]: nivelFcInferior(estado.abertura),
  }
}

function detectarFalhaMotor(
  abertura: number,
  sobe: boolean,
  desce: boolean,
  jaDanificado: boolean,
): boolean {
  if (jaDanificado) return true
  if (sobe && desce) return true
  if (sobe && abertura >= ABERTURA_MAX) return true
  if (desce && abertura <= ABERTURA_MIN) return true
  return false
}

export function criarEstadoPortao(): EstadoPortao {
  return {
    abertura: ABERTURA_MIN,
    motorDanificado: false,
    botoes: { abrir: false, fechar: false, parar: false },
  }
}

export function avancarPortao(estado: EstadoPortao, saidas: MapaSaidas): ResultadoPassoPlanta<EstadoPortao> {
  if (estado.motorDanificado) {
    return { estado, entradas: montarEntradasPortao(estado), falha: 'Motor danificado' }
  }

  const sobe = saidas[ENDERECO_MOTOR_SOBE] === true
  const desce = saidas[ENDERECO_MOTOR_DESCE] === true

  let abertura = estado.abertura
  if (sobe && !desce) {
    abertura = Math.min(ABERTURA_MAX, abertura + PASSO_ABERTURA_POR_CICLO)
  } else if (desce && !sobe) {
    abertura = Math.max(ABERTURA_MIN, abertura - PASSO_ABERTURA_POR_CICLO)
  }

  const motorDanificado = detectarFalhaMotor(abertura, sobe, desce, false)
  const novo: EstadoPortao = { ...estado, abertura, motorDanificado }

  return {
    estado: novo,
    entradas: montarEntradasPortao(novo),
    falha: motorDanificado ? 'Motor danificado! Comando conflitante ou fim de curso com motor acionado.' : null,
  }
}

export function acionarComandoPortao(estado: EstadoPortao, comando: string, pressionado: boolean): EstadoPortao {
  switch (comando) {
    case 'abrir':
      return { ...estado, botoes: { ...estado.botoes, abrir: pressionado } }
    case 'parar':
      return { ...estado, botoes: { ...estado.botoes, parar: pressionado } }
    case 'fechar':
      return { ...estado, botoes: { ...estado.botoes, fechar: pressionado } }
    default:
      return estado
  }
}

export const AMBIENTE_PORTAO: DefinicaoAmbiente<EstadoPortao> = {
  id: 'portao',
  nome: 'Portão',
  descricao: 'Portão de enrolar com botões Abrir/Fechar/Parar, fins de curso e motor sobe/desce.',
  pontos: PONTOS_PORTAO,
  criarEstado: criarEstadoPortao,
  avancar: avancarPortao,
  acionarComando: acionarComandoPortao,
  enderecosEntradaComandados: () => [
    ENDERECO_ABRIR,
    ENDERECO_FECHAR,
    ENDERECO_PARAR,
    ENDERECO_FC_SUPERIOR,
    ENDERECO_FC_INFERIOR,
  ],
}
