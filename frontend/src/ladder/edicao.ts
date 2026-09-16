/**
 * Operações de edição do diagrama Ladder (spec 002, plano D-3).
 *
 * Cada operação é uma função pura `Diagrama → ResultadoEdicao`: nunca muta a
 * entrada, ou devolve o novo diagrama, ou recusa com um motivo em português.
 * Estrutura inválida por posição, ocupação ou referência nunca entra no
 * estado — quem chama decide o que fazer com a recusa (ex.: mostrar em
 * `role="alert"`, sem alterar o diagrama em edição).
 */

import type { Celula, Diagrama, Elemento, Rung, Variavel } from './modelo'
import { posicaoValida } from './validacao'
import { enderecoValido } from './enderecos'

export type ResultadoEdicao = { ok: true; diagrama: Diagrama } | { ok: false; motivo: string }

/** Identificador IEC 61131-3: letra ou `_`, seguido de letras, dígitos ou `_`. */
const REGEX_IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]*$/

function recusa(motivo: string): ResultadoEdicao {
  return { ok: false, motivo }
}

function sucesso(diagrama: Diagrama): ResultadoEdicao {
  return { ok: true, diagrama }
}

/** Diagrama inicial: um degrau vazio (`r1`), sem variáveis declaradas. */
export function diagramaVazio(): Diagrama {
  return {
    versao: 1,
    variaveis: [],
    rungs: [{ id: 'r1', elementos: [], ramos: [] }],
  }
}

/** Menor `e<N>` (N inteiro positivo) ainda não usado como id de elemento em `diagrama`. */
function proximoIdElemento(diagrama: Diagrama): string {
  const usados = new Set<string>()
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) usados.add(elemento.id)
  }
  let n = 1
  while (usados.has(`e${n}`)) n++
  return `e${n}`
}

function encontrarRung(diagrama: Diagrama, rungId: string): Rung | undefined {
  return diagrama.rungs.find((rung) => rung.id === rungId)
}

function encontrarElemento(diagrama: Diagrama, elementoId: string): { rung: Rung; elemento: Elemento } | undefined {
  for (const rung of diagrama.rungs) {
    const elemento = rung.elementos.find((e) => e.id === elementoId)
    if (elemento !== undefined) return { rung, elemento }
  }
  return undefined
}

function celulaOcupada(rung: Rung, celula: Celula): boolean {
  return rung.elementos.some((e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna)
}

/** Insere um novo elemento (contato ou bobina) em `rungId`, na `celula` dada. */
export function inserirElemento(
  diagrama: Diagrama,
  rungId: string,
  tipo: Elemento['tipo'],
  celula: Celula,
): ResultadoEdicao {
  const rungOriginal = encontrarRung(diagrama, rungId)
  if (rungOriginal === undefined) return recusa(`degrau '${rungId}' inexistente`)

  if (!posicaoValida(rungOriginal, tipo, celula)) {
    return recusa(`posição inválida para ${tipo} (linha=${celula.linha}, coluna=${celula.coluna})`)
  }
  if (celulaOcupada(rungOriginal, celula)) {
    return recusa(`célula (linha=${celula.linha}, coluna=${celula.coluna}) já ocupada`)
  }

  const novoDiagrama = structuredClone(diagrama)
  const rung = encontrarRung(novoDiagrama, rungId) as Rung
  const novoElemento: Elemento = { id: proximoIdElemento(diagrama), tipo, celula, variavel: null }
  rung.elementos.push(novoElemento)

  return sucesso(novoDiagrama)
}

/** Remove um elemento existente. O vínculo com variável mora no próprio
 * elemento, então removê-lo já elimina qualquer vínculo pendente. */
export function removerElemento(diagrama: Diagrama, elementoId: string): ResultadoEdicao {
  const encontrado = encontrarElemento(diagrama, elementoId)
  if (encontrado === undefined) return recusa(`elemento '${elementoId}' inexistente`)

  const novoDiagrama = structuredClone(diagrama)
  const rung = encontrarRung(novoDiagrama, encontrado.rung.id) as Rung
  rung.elementos = rung.elementos.filter((e) => e.id !== elementoId)

  return sucesso(novoDiagrama)
}

/** Declara uma variável nova (interna, sem `endereco`, ou localizada, com um
 * dos endereços de `enderecos.ts`). */
export function declararVariavel(diagrama: Diagrama, variavel: { nome: string; endereco?: string }): ResultadoEdicao {
  const { nome, endereco } = variavel

  if (nome.length === 0 || !REGEX_IDENTIFICADOR.test(nome)) {
    return recusa(`nome de variável inválido: '${nome}'`)
  }
  if (diagrama.variaveis.some((v) => v.nome === nome)) {
    return recusa(`já existe uma variável chamada '${nome}'`)
  }
  if (endereco !== undefined) {
    if (!enderecoValido(endereco)) {
      return recusa(`endereço '${endereco}' não está entre os endereços do controlador`)
    }
    const outra = diagrama.variaveis.find((v) => v.endereco === endereco)
    if (outra !== undefined) {
      return recusa(`endereço '${endereco}' já está em uso pela variável '${outra.nome}'`)
    }
  }

  const novoDiagrama = structuredClone(diagrama)
  const nova: Variavel = endereco === undefined ? { nome, tipo: 'BOOL' } : { nome, tipo: 'BOOL', endereco }
  novoDiagrama.variaveis.push(nova)

  return sucesso(novoDiagrama)
}

/** Vincula (ou desvincula, com `nome: null`) um elemento a uma variável já declarada. */
export function vincularVariavel(diagrama: Diagrama, elementoId: string, nome: string | null): ResultadoEdicao {
  const encontrado = encontrarElemento(diagrama, elementoId)
  if (encontrado === undefined) return recusa(`elemento '${elementoId}' inexistente`)

  if (nome !== null && !diagrama.variaveis.some((v) => v.nome === nome)) {
    return recusa(`variável '${nome}' inexistente`)
  }

  const novoDiagrama = structuredClone(diagrama)
  const rung = encontrarRung(novoDiagrama, encontrado.rung.id) as Rung
  const elemento = rung.elementos.find((e) => e.id === elementoId) as Elemento
  elemento.variavel = nome

  return sucesso(novoDiagrama)
}
