/**
 * Persistência do diagrama em `Storage` (spec 002, plano D-5; spec 006 — versão 2).
 *
 * Chave `ladderflow:diagrama`, envelope `{ versao: 2, diagrama }`. Aceita envelope
 * versão 1 e migra elementos CTU legados (`linhaControle`/`pv`) para `ElementoBloco`.
 */

import { diagramaVazio } from './edicao'
import type { Diagrama, Elemento, Rung } from './modelo'

/** Chave única do diagrama em `Storage` (D-5). */
export const CHAVE_DIAGRAMA = 'ladderflow:diagrama'

/** Versão do envelope gravado. */
const VERSAO_ENVELOPE = 2

interface Envelope {
  versao: number
  diagrama: Diagrama
}

export type ResultadoCarga = { diagrama: Diagrama; aviso: string | null }

function descartado(motivo: string): ResultadoCarga {
  return { diagrama: diagramaVazio(), aviso: `diagrama salvo descartado: ${motivo}` }
}

function rungEstruturalmenteValido(rung: unknown): rung is Rung {
  if (typeof rung !== 'object' || rung === null) return false
  const r = rung as Record<string, unknown>
  return typeof r.id === 'string' && Array.isArray(r.elementos) && Array.isArray(r.ramos)
}

function elementoMigrado(raw: Record<string, unknown>): Elemento | null {
  const tipo = raw.tipo
  if (tipo === 'contato_na' || tipo === 'contato_nf' || tipo === 'bobina' || tipo === 'bobina_set' || tipo === 'bobina_reset') {
    return {
      id: String(raw.id),
      tipo,
      celula: raw.celula as Elemento['celula'],
      variavel: (raw.variavel as string | null) ?? null,
    }
  }
  if (tipo === 'ctu' || tipo === 'ctd' || tipo === 'ton' || tipo === 'tof') {
    if (raw.linhaControle !== undefined && raw.preset !== undefined) {
      return {
        id: String(raw.id),
        tipo,
        celula: raw.celula as Elemento['celula'],
        linhaControle: raw.linhaControle as number | null,
        instancia: String(raw.instancia),
        preset: Number(raw.preset),
        saida: (raw.saida as string | null) ?? null,
      }
    }
    if (tipo === 'ctu' && raw.linhaControle !== undefined && raw.pv !== undefined) {
      return {
        id: String(raw.id),
        tipo: 'ctu',
        celula: raw.celula as Elemento['celula'],
        linhaControle: Number(raw.linhaControle),
        instancia: String(raw.instancia),
        preset: Number(raw.pv),
        saida: (raw.saida as string | null) ?? null,
      }
    }
    return null
  }
  return null
}

/** Migra diagrama v1 (CTU com `linhaControle`/`pv`) para v2 (`ElementoBloco`). */
export function migrarDiagramaParaV2(diagrama: unknown): Diagrama | null {
  if (typeof diagrama !== 'object' || diagrama === null) return null
  const d = diagrama as Record<string, unknown>
  if (!Array.isArray(d.variaveis) || !Array.isArray(d.rungs) || d.rungs.length === 0) return null

  const rungs: Rung[] = []
  for (const rungRaw of d.rungs) {
    if (!rungEstruturalmenteValido(rungRaw)) return null
    const elementos: Elemento[] = []
    for (const el of rungRaw.elementos) {
      if (typeof el !== 'object' || el === null) return null
      const migrado = elementoMigrado(el as Record<string, unknown>)
      if (migrado === null) return null
      elementos.push(migrado)
    }
    rungs.push({ id: rungRaw.id, elementos, ramos: rungRaw.ramos })
  }

  return {
    versao: 2,
    variaveis: d.variaveis as Diagrama['variaveis'],
    rungs,
  }
}

export function diagramaEstruturalmenteValido(diagrama: unknown): diagrama is Diagrama {
  const migrado = migrarDiagramaParaV2(diagrama)
  return migrado !== null && migrado.versao === 2
}

export function carregarDiagrama(armazenamento: Storage): ResultadoCarga {
  let bruto: string | null
  try {
    bruto = armazenamento.getItem(CHAVE_DIAGRAMA)
  } catch {
    return descartado('não foi possível ler o armazenamento local')
  }

  if (bruto === null) {
    return { diagrama: diagramaVazio(), aviso: null }
  }

  let envelope: unknown
  try {
    envelope = JSON.parse(bruto)
  } catch {
    return descartado('o conteúdo salvo não é um JSON válido')
  }

  if (typeof envelope !== 'object' || envelope === null) {
    return descartado('o conteúdo salvo não tem o formato esperado')
  }
  const { versao, diagrama } = envelope as Partial<Envelope>

  if (versao === 1) {
    const migrado = migrarDiagramaParaV2(diagrama)
    if (migrado === null) return descartado('a estrutura do diagrama salvo (versão 1) está incompleta ou corrompida')
    return { diagrama: migrado, aviso: 'diagrama migrado da versão 1 para a versão 2' }
  }

  if (versao !== VERSAO_ENVELOPE) {
    return descartado(`versão salva (${JSON.stringify(versao)}) não é a versão suportada (${VERSAO_ENVELOPE})`)
  }
  if (!diagramaEstruturalmenteValido(diagrama)) {
    return descartado('a estrutura do diagrama salvo está incompleta ou corrompida')
  }

  return { diagrama, aviso: null }
}

export function salvarDiagrama(armazenamento: Storage, diagrama: Diagrama): string | null {
  const envelope: Envelope = { versao: VERSAO_ENVELOPE, diagrama }
  try {
    armazenamento.setItem(CHAVE_DIAGRAMA, JSON.stringify(envelope))
    return null
  } catch {
    return 'não foi possível salvar o diagrama no armazenamento local (cota excedida ou navegação privada)'
  }
}
