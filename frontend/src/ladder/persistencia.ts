/**
 * Persistência do diagrama em `Storage` (spec 002, plano D-5).
 *
 * Chave `ladderflow:diagrama`, envelope `{ versao: 1, diagrama }`. O
 * armazenamento é injetado (`Storage`, não `window.localStorage` direto) para
 * que os testes usem um `Storage` falso em memória, sem depender de jsdom.
 *
 * `carregarDiagrama` nunca lança exceção e nunca falha em silêncio (RF-12):
 * qualquer coisa que não seja um envelope válido na versão conhecida —
 * chave ausente à parte, que é o estado inicial normal e não é falha — vira
 * `diagramaVazio()` mais um aviso em português explicando o descarte. Uma
 * exceção do próprio `getItem` (ex.: acesso a `Storage` bloqueado) é tratada
 * do mesmo jeito. `salvarDiagrama` faz o caminho inverso: tenta gravar e,
 * se o navegador recusar (cota, modo privado), devolve um aviso em vez de
 * lançar — quem chama decide o que fazer com ele (mostrar, logar).
 */

import { diagramaVazio } from './edicao'
import type { Diagrama, Rung } from './modelo'

/** Chave única do diagrama em `Storage` (D-5). */
export const CHAVE_DIAGRAMA = 'ladderflow:diagrama'

/** Versão do envelope gravado — a única aceita na carga por enquanto. */
const VERSAO_ENVELOPE = 1

interface Envelope {
  versao: number
  diagrama: Diagrama
}

export type ResultadoCarga = { diagrama: Diagrama; aviso: string | null }

/** Diagrama vazio com um aviso explicando por que o salvo foi descartado. */
function descartado(motivo: string): ResultadoCarga {
  return { diagrama: diagramaVazio(), aviso: `diagrama salvo descartado: ${motivo}` }
}

/** Checa a forma mínima de um `Rung`: `id` string, `elementos` e `ramos` arrays. */
function rungEstruturalmenteValido(rung: unknown): rung is Rung {
  if (typeof rung !== 'object' || rung === null) return false
  const r = rung as Record<string, unknown>
  return typeof r.id === 'string' && Array.isArray(r.elementos) && Array.isArray(r.ramos)
}

/** Checa a forma mínima de um `Diagrama` recém-desserializado: `rungs` é um
 * array não vazio de rungs estruturalmente válidos, e `variaveis` é um array.
 * Não valida conteúdo (endereços, vínculos) — isso é papel de
 * `validarDiagrama`; aqui só se decide se dá para confiar na forma dos dados.
 * Exportada para que `projeto/projeto.ts` valide o campo `diagrama` de um
 * projeto `ld` com a mesma regra, sem duplicá-la (spec 002, tarefa #26). */
export function diagramaEstruturalmenteValido(diagrama: unknown): diagrama is Diagrama {
  if (typeof diagrama !== 'object' || diagrama === null) return false
  const d = diagrama as Record<string, unknown>
  if (!Array.isArray(d.variaveis)) return false
  if (!Array.isArray(d.rungs) || d.rungs.length === 0) return false
  return d.rungs.every(rungEstruturalmenteValido)
}

/**
 * Carrega o diagrama salvo em `armazenamento`. Nunca lança exceção:
 *   - sem chave gravada: `diagramaVazio()`, sem aviso (é o estado inicial);
 *   - `getItem` lança, JSON inválido, versão desconhecida ou formato
 *     estruturalmente inválido: `diagramaVazio()` mais um aviso explicando
 *     o motivo do descarte.
 */
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

  if (versao !== VERSAO_ENVELOPE) {
    return descartado(`versão salva (${JSON.stringify(versao)}) não é a versão suportada (${VERSAO_ENVELOPE})`)
  }
  if (!diagramaEstruturalmenteValido(diagrama)) {
    return descartado('a estrutura do diagrama salvo está incompleta ou corrompida')
  }

  return { diagrama, aviso: null }
}

/**
 * Grava `diagrama` em `armazenamento`, no envelope `{ versao: 1, diagrama }`.
 * Devolve `null` quando a gravação deu certo, ou um aviso em português quando
 * o navegador recusou (cota excedida, modo privado) — nunca lança exceção.
 */
export function salvarDiagrama(armazenamento: Storage, diagrama: Diagrama): string | null {
  const envelope: Envelope = { versao: VERSAO_ENVELOPE, diagrama }
  try {
    armazenamento.setItem(CHAVE_DIAGRAMA, JSON.stringify(envelope))
    return null
  } catch {
    return 'não foi possível salvar o diagrama no armazenamento local (cota excedida ou navegação privada)'
  }
}
