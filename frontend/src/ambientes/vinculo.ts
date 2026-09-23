/**
 * Vínculo endereço ↔ variável do diagrama (spec 005, plano D-4).
 */

import { declararVariavel, type ResultadoEdicao } from '../ladder/edicao'
import { classeDaVariavel } from '../ladder/enderecos'
import type { Diagrama, Variavel } from '../ladder/modelo'
import type { EstadoSimulacao } from '../ladder/simulacao'
import type { MapaEntradas, MapaSaidas, PontoAmbiente } from './contrato'

export function saidasPorEndereco(diagrama: Diagrama, variaveis: Record<string, boolean>): MapaSaidas {
  const mapa: Record<string, boolean> = {}
  for (const v of diagrama.variaveis) {
    if (v.endereco === undefined) continue
    if (classeDaVariavel(v) !== 'saida') continue
    mapa[v.endereco] = variaveis[v.nome] ?? false
  }
  return mapa
}

/** Aplica entradas da planta ao `EstadoSimulacao` (próximo ciclo). */
export function aplicarEntradasPlanta(
  diagrama: Diagrama,
  estado: EstadoSimulacao,
  entradas: MapaEntradas,
): EstadoSimulacao {
  const entradasNovas = { ...estado.entradas }
  for (const v of diagrama.variaveis) {
    if (v.endereco === undefined) continue
    if (classeDaVariavel(v) !== 'entrada') continue
    const nivel = entradas[v.endereco]
    if (nivel !== undefined) entradasNovas[v.nome] = nivel
  }
  return { ...estado, entradas: entradasNovas }
}

export function nomeVariavelPorEndereco(diagrama: Diagrama, endereco: string): string | null {
  const v = diagrama.variaveis.find((x) => x.endereco === endereco)
  return v?.nome ?? null
}

/** Pontos do contrato sem variável declarada no endereço (revisão
 * 2026-09-23) — os que aparecem como "não conectado" no painel. */
export function pontosSemVariavel(diagrama: Diagrama, pontos: readonly PontoAmbiente[]): PontoAmbiente[] {
  return pontos.filter((p) => nomeVariavelPorEndereco(diagrama, p.endereco) === null)
}

/** Identificador IEC a partir de texto livre: sem acento, minúsculo, `_` no
 * lugar de qualquer outro caractere; o que vem entre parênteses é descartado
 * ("FC1 (fim de curso superior)" → `fc1`). */
function identificadorDoRotulo(rotulo: string): string {
  const base = rotulo
    .replace(/\(.*?\)/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (base.length === 0) return 'ponto'
  return /^[0-9]/.test(base) ? `_${base}` : base
}

/**
 * Nome proposto para a variável de um ponto do contrato: `nomeSugerido` do
 * ponto, ou o identificador derivado do rótulo. Se já houver variável com o
 * mesmo nome — comparando **sem** diferenciar maiúsculas, porque o
 * serializador recusa nomes que só diferem na caixa (spec 003, D-5) —,
 * acrescenta `_2`, `_3`... É só a proposta: quem decide é
 * `declararVariavel`.
 */
export function sugerirNomeVariavel(ponto: PontoAmbiente, variaveis: readonly Variavel[]): string {
  const base = ponto.nomeSugerido ?? identificadorDoRotulo(ponto.rotulo)
  const usados = new Set(variaveis.map((v) => v.nome.toLowerCase()))
  if (!usados.has(base.toLowerCase())) return base
  let n = 2
  while (usados.has(`${base}_${n}`.toLowerCase())) n++
  return `${base}_${n}`
}

/** Declara, de uma vez, uma variável para cada ponto do contrato ainda não
 * conectado, com o nome de `sugerirNomeVariavel`. Tudo ou nada: a primeira
 * recusa de `declararVariavel` devolve a recusa e nada é aplicado — assim a
 * IDE registra uma única entrada no histórico de Desfazer. */
export function declararVariaveisDoContrato(diagrama: Diagrama, pontos: readonly PontoAmbiente[]): ResultadoEdicao {
  let atual = diagrama
  for (const ponto of pontosSemVariavel(diagrama, pontos)) {
    const resultado = declararVariavel(atual, { nome: sugerirNomeVariavel(ponto, atual.variaveis), endereco: ponto.endereco })
    if (!resultado.ok) return resultado
    atual = resultado.diagrama
  }
  return { ok: true, diagrama: atual }
}

export function enderecosEntradaComandadosPelaPlanta(enderecos: readonly string[]): readonly string[] {
  return enderecos
}
