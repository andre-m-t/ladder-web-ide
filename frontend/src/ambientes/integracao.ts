/**
 * Integração planta ↔ ciclo de varredura (spec 005, plano D-6).
 */

import type { Diagrama } from '../ladder/modelo'
import { executarCiclo, type EstadoSimulacao } from '../ladder/simulacao'
import { classeDaVariavel } from '../ladder/enderecos'
import type { DefinicaoAmbiente } from './contrato'
import type { EstadoPortao } from './portao'
import { montarEntradasPortao } from './portao'
import { aplicarEntradasPlanta, saidasPorEndereco } from './vinculo'

export function zerarSaidasNoEstado(diagrama: Diagrama, estado: EstadoSimulacao): EstadoSimulacao {
  const variaveis = { ...estado.variaveis }
  for (const v of diagrama.variaveis) {
    if (classeDaVariavel(v) === 'saida') variaveis[v.nome] = false
  }
  return { ...estado, variaveis }
}

export function executarCicloComAmbiente(
  diagrama: Diagrama,
  estado: EstadoSimulacao,
  planta: EstadoPortao,
  ambiente: DefinicaoAmbiente<EstadoPortao>,
  ambienteAtivo: boolean,
): { estado: EstadoSimulacao; planta: EstadoPortao; falha: string | null } {
  let estadoAtual = estado
  if (ambienteAtivo) {
    estadoAtual = aplicarEntradasPlanta(diagrama, estadoAtual, montarEntradasPortao(planta))
  }
  estadoAtual = executarCiclo(diagrama, estadoAtual)
  if (!ambienteAtivo) {
    return { estado: estadoAtual, planta, falha: null }
  }

  const passo = ambiente.avancar(planta, saidasPorEndereco(diagrama, estadoAtual.variaveis))
  estadoAtual = aplicarEntradasPlanta(diagrama, estadoAtual, passo.entradas)

  if (passo.falha) {
    estadoAtual = zerarSaidasNoEstado(diagrama, estadoAtual)
  }

  return { estado: estadoAtual, planta: passo.estado, falha: passo.falha }
}
