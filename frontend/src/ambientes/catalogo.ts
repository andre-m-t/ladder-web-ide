/**
 * Catálogo de ambientes (spec 005, plano D-3).
 */

import type { DefinicaoAmbiente } from './contrato'
import { AMBIENTE_PORTAO, type EstadoPortao } from './portao'

export type AmbienteRegistrado = DefinicaoAmbiente<EstadoPortao>

export const CATALOGO_AMBIENTES: readonly AmbienteRegistrado[] = [AMBIENTE_PORTAO]

export function ambientePorId(id: string): AmbienteRegistrado | undefined {
  return CATALOGO_AMBIENTES.find((a) => a.id === id)
}

export const AMBIENTE_PADRAO_ID = AMBIENTE_PORTAO.id
