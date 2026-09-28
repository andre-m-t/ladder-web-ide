/**
 * Regras dos blocos de função na grade (CTU, CTD, TON, TOF) — spec 002/006.
 *
 * Isolamento deliberado (D-7, Q-7): tudo o que só faz sentido para blocos FB
 * vive aqui. `edicao.ts` e `validacao.ts` chamam este arquivo em pontos de
 * extensão — nunca duplicam a regra.
 *
 * `ResultadoEdicao` e `Problema` entram só como tipo, para evitar ciclo de módulos.
 */

import { COLUNA_TERMINAL, LINHAS_EXTRAS_MAX, ehBloco, ehContato, ehTipoBloco } from './modelo'
import type { Celula, Diagrama, Elemento, ElementoBloco, Rung, TipoBloco } from './modelo'
import type { ResultadoEdicao } from './edicao'
import type { Problema } from './validacao'

/** Período do laço de varredura (`T#20ms`), em ms — base lógica do simulador e do host stub. */
export const PERIODO_VARREDURA_MS = 20

/** Contadores: limite programado (PV). */
export const PV_PADRAO = 10
export const PV_MIN = 1
export const PV_MAX = 32767

/** Temporizadores: preset de tempo (PT) em ms, quantizado ao período de varredura. */
export const PT_PADRAO = 1000
export const PT_MIN = 0
export const PT_MAX = 3_600_000
export const PT_PASSO = PERIODO_VARREDURA_MS

export interface DescritorPreset {
  formal: 'PV' | 'PT'
  unidade: 'contagens' | 'ms'
  min: number
  max: number
  passo: number
  padrao: number
}

export interface DescritorControle {
  formal: 'R' | 'LD'
  rotulo: string
  rotuloLinha: string
}

export interface DescritorBloco {
  tipo: TipoBloco
  tipoST: 'CTU' | 'CTD' | 'TON' | 'TOF'
  rotulo: string
  rotuloCurto: string
  prefixoInstancia: string
  entradaPrincipal: string
  controle: DescritorControle | null
  preset: DescritorPreset
  familiaSimulacao: 'contador' | 'temporizador'
}

export const DESCRITORES: Record<TipoBloco, DescritorBloco> = {
  ctu: {
    tipo: 'ctu',
    tipoST: 'CTU',
    rotulo: 'Contador crescente',
    rotuloCurto: 'CTU',
    prefixoInstancia: 'ctu',
    entradaPrincipal: 'CU',
    controle: { formal: 'R', rotulo: 'R', rotuloLinha: 'reinício do contador' },
    preset: { formal: 'PV', unidade: 'contagens', min: PV_MIN, max: PV_MAX, passo: 1, padrao: PV_PADRAO },
    familiaSimulacao: 'contador',
  },
  ctd: {
    tipo: 'ctd',
    tipoST: 'CTD',
    rotulo: 'Contador decrescente',
    rotuloCurto: 'CTD',
    prefixoInstancia: 'ctd',
    entradaPrincipal: 'CD',
    controle: { formal: 'LD', rotulo: 'LD', rotuloLinha: 'carga do contador' },
    preset: { formal: 'PV', unidade: 'contagens', min: PV_MIN, max: PV_MAX, passo: 1, padrao: PV_PADRAO },
    familiaSimulacao: 'contador',
  },
  ton: {
    tipo: 'ton',
    tipoST: 'TON',
    rotulo: 'Temporizador na energização',
    rotuloCurto: 'TON',
    prefixoInstancia: 'ton',
    entradaPrincipal: 'IN',
    controle: null,
    preset: { formal: 'PT', unidade: 'ms', min: PT_MIN, max: PT_MAX, passo: PT_PASSO, padrao: PT_PADRAO },
    familiaSimulacao: 'temporizador',
  },
  tof: {
    tipo: 'tof',
    tipoST: 'TOF',
    rotulo: 'Temporizador na desenergização',
    rotuloCurto: 'TOF',
    prefixoInstancia: 'tof',
    entradaPrincipal: 'IN',
    controle: null,
    preset: { formal: 'PT', unidade: 'ms', min: PT_MIN, max: PT_MAX, passo: PT_PASSO, padrao: PT_PADRAO },
    familiaSimulacao: 'temporizador',
  },
}

export function descritorDe(tipo: TipoBloco): DescritorBloco {
  return DESCRITORES[tipo]
}

export function blocoDoRung(rung: Rung): ElementoBloco | undefined {
  return rung.elementos.find(ehBloco)
}

export function linhaControleLivre(rung: Rung): number | null {
  const primeiraLivreDesde = (desde: number): number | null => {
    for (let linha = desde; linha <= LINHAS_EXTRAS_MAX; linha++) {
      const temRamo = rung.ramos.some((ramo) => ramo.linha === linha)
      const temElemento = rung.elementos.some((elemento) => elemento.celula.linha === linha)
      if (!temRamo && !temElemento) return linha
    }
    return null
  }

  const maiorLinhaDeRamo = rung.ramos.reduce((maior, ramo) => Math.max(maior, ramo.linha), 0)
  const abaixoDosRamos = primeiraLivreDesde(maiorLinhaDeRamo + 1)
  if (abaixoDosRamos !== null) return abaixoDosRamos

  return primeiraLivreDesde(1)
}

export function planoDeRamoComBloco(
  rung: Rung,
  bloco: ElementoBloco,
  linhaCandidata: number,
): { linhaRamo: number; novaLinhaControle: number | null } {
  const linhaCtrl = bloco.linhaControle
  if (linhaCtrl === null || linhaCandidata <= linhaCtrl) {
    return { linhaRamo: linhaCandidata, novaLinhaControle: null }
  }

  const linhaTotalmenteLivre =
    !rung.ramos.some((ramo) => ramo.linha === linhaCandidata) &&
    !rung.elementos.some((elemento) => elemento.celula.linha === linhaCandidata)
  if (!linhaTotalmenteLivre) {
    return { linhaRamo: linhaCandidata, novaLinhaControle: null }
  }

  return { linhaRamo: linhaCtrl, novaLinhaControle: linhaCandidata }
}

/** @deprecated Use `linhaControleLivre`. */
export const linhaResetLivre = linhaControleLivre

/** @deprecated Use `planoDeRamoComBloco`. */
export function planoDeRamoComCtu(
  rung: Rung,
  bloco: ElementoBloco,
  linhaCandidata: number,
): { linhaRamo: number; novaLinhaReset: number | null } {
  const plano = planoDeRamoComBloco(rung, bloco, linhaCandidata)
  return { linhaRamo: plano.linhaRamo, novaLinhaReset: plano.novaLinhaControle }
}

function proximoIdElemento(diagrama: Diagrama): string {
  const usados = new Set<string>()
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) usados.add(elemento.id)
  }
  let n = 1
  while (usados.has(`e${n}`)) n++
  return `e${n}`
}

function proximaInstancia(diagrama: Diagrama, prefixo: string): string {
  const usados = new Set<string>()
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) {
      if (ehBloco(elemento)) usados.add(elemento.instancia.toLowerCase())
    }
  }
  for (const variavel of diagrama.variaveis) usados.add(variavel.nome.toLowerCase())

  let n = 0
  while (usados.has(`${prefixo}${n}`)) n++
  return `${prefixo}${n}`
}

function presetValido(tipo: TipoBloco, preset: number): boolean {
  const { min, max, passo } = DESCRITORES[tipo].preset
  if (!Number.isInteger(preset) || preset < min || preset > max) return false
  if (passo > 1 && preset % passo !== 0) return false
  return true
}

export function criarBloco(diagrama: Diagrama, rungId: string, tipo: TipoBloco): ResultadoEdicao {
  const desc = DESCRITORES[tipo]
  const rung = diagrama.rungs.find((r) => r.id === rungId)
  if (rung === undefined) return { ok: false, motivo: `degrau '${rungId}' inexistente` }
  const indiceDegrau = diagrama.rungs.findIndex((r) => r.id === rungId)

  const ocupado = rung.elementos.some(
    (elemento) => elemento.celula.linha === 0 && elemento.celula.coluna === COLUNA_TERMINAL,
  )
  if (ocupado) {
    return {
      ok: false,
      motivo: `célula ocupada: já existe um elemento em degrau ${indiceDegrau + 1}, coluna ${COLUNA_TERMINAL + 1}`,
    }
  }

  let linhaControle: number | null = null
  if (desc.controle !== null) {
    linhaControle = linhaControleLivre(rung)
    if (linhaControle === null) {
      return {
        ok: false,
        motivo:
          `sem linha livre para ${desc.controle.rotuloLinha} no degrau ${indiceDegrau + 1}: o bloco precisa de uma linha ` +
          `própria para o caminho de ${desc.controle.formal}, e ramos e essa linha dividem o mesmo limite de ` +
          `${LINHAS_EXTRAS_MAX} linha(s) além do trilho principal (Q-3)`,
      }
    }
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung = novoDiagrama.rungs.find((r) => r.id === rungId) as Rung
  const novoBloco: ElementoBloco = {
    id: proximoIdElemento(diagrama),
    tipo,
    celula: { linha: 0, coluna: COLUNA_TERMINAL },
    linhaControle,
    instancia: proximaInstancia(diagrama, desc.prefixoInstancia),
    preset: desc.preset.padrao,
    saida: null,
  }
  novoRung.elementos.push(novoBloco)

  return { ok: true, diagrama: novoDiagrama }
}

/** @deprecated Use `criarBloco(..., 'ctu')`. */
export const criarCtu = (diagrama: Diagrama, rungId: string) => criarBloco(diagrama, rungId, 'ctu')

export function atualizarBloco(
  diagrama: Diagrama,
  elementoId: string,
  alteracoes: { preset?: number },
): ResultadoEdicao {
  const rung = diagrama.rungs.find((r) => r.elementos.some((e) => e.id === elementoId))
  if (rung === undefined) return { ok: false, motivo: `elemento '${elementoId}' inexistente` }
  const elemento = rung.elementos.find((e) => e.id === elementoId) as Elemento
  if (!ehBloco(elemento)) return { ok: false, motivo: `elemento '${elementoId}' não é um bloco de função` }

  if (alteracoes.preset !== undefined && !presetValido(elemento.tipo, alteracoes.preset)) {
    const { min, max, passo } = DESCRITORES[elemento.tipo].preset
    const passoTxt = passo > 1 ? `, múltiplo de ${passo}` : ''
    return { ok: false, motivo: `${DESCRITORES[elemento.tipo].preset.formal} deve ser inteiro de ${min} a ${max}${passoTxt}` }
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung = novoDiagrama.rungs.find((r) => r.id === rung.id) as Rung
  const novoElemento = novoRung.elementos.find((e) => e.id === elementoId) as ElementoBloco
  if (alteracoes.preset !== undefined) novoElemento.preset = alteracoes.preset

  return { ok: true, diagrama: novoDiagrama }
}

/** @deprecated Use `atualizarBloco`. */
export function atualizarCtu(
  diagrama: Diagrama,
  elementoId: string,
  alteracoes: { preset?: number; pv?: number },
): ResultadoEdicao {
  const preset = alteracoes.preset ?? alteracoes.pv
  return atualizarBloco(diagrama, elementoId, preset !== undefined ? { preset } : {})
}

export function motivoPosicaoBloco(
  rung: Rung,
  tipo: Elemento['tipo'],
  celula: Celula,
  onde: string,
): string | null | undefined {
  if (ehTipoBloco(tipo)) {
    if (celula.linha === 0 && celula.coluna === COLUNA_TERMINAL) return null
    const d = DESCRITORES[tipo]
    return `posição inválida: bloco ${d.rotuloCurto} só pode ficar na última coluna (coluna ${COLUNA_TERMINAL + 1}) do trilho principal, como uma bobina`
  }

  const bloco = blocoDoRung(rung)
  if (bloco !== undefined && bloco.linhaControle !== null && celula.linha > 0) {
    if (celula.linha === bloco.linhaControle) {
      const ctrl = DESCRITORES[bloco.tipo].controle
      if (ehContato(tipo) && celula.coluna < COLUNA_TERMINAL) return null
      return (
        `posição inválida: ${onde} é a linha de ${ctrl?.rotuloLinha ?? 'controle'} do bloco '${bloco.instancia}' — só aceita contatos, ` +
        `nas colunas 1 a ${COLUNA_TERMINAL}`
      )
    }
  }

  return undefined
}

/** @deprecated Use `motivoPosicaoBloco`. */
export const motivoPosicaoCtu = motivoPosicaoBloco

export function problemasDoBloco(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  diagrama.rungs.forEach((rung, indiceDegrau) => {
    for (const elemento of rung.elementos) {
      if (!ehBloco(elemento)) continue
      if (!presetValido(elemento.tipo, elemento.preset)) {
        const { min, max } = DESCRITORES[elemento.tipo].preset
        problemas.push({
          codigo: 'bloco_preset_invalido',
          severidade: 'erro',
          rungId: rung.id,
          elementoId: elemento.id,
          mensagem:
            `bloco '${elemento.instancia}' (${DESCRITORES[elemento.tipo].rotuloCurto}, elemento '${elemento.id}') no degrau ${indiceDegrau + 1} tem ` +
            `${DESCRITORES[elemento.tipo].preset.formal} ${elemento.preset} fora do intervalo permitido (${min} a ${max})`,
        })
      }
    }
  })
  return problemas
}

/** @deprecated Use `problemasDoBloco`. */
export const problemasDoCtu = problemasDoBloco
