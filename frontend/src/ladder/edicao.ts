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
import { descreverCelula, motivoPosicaoInvalida } from './validacao'
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

/** Posição (0-based) do degrau `rungId` em `diagrama.rungs` — é o índice que
 * as mensagens voltadas ao usuário mostram como "degrau N" (1-based). */
function indiceDoRung(diagrama: Diagrama, rungId: string): number {
  return diagrama.rungs.findIndex((rung) => rung.id === rungId)
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
  const indiceDegrau = indiceDoRung(diagrama, rungId)

  const motivoPosicao = motivoPosicaoInvalida(indiceDegrau, rungOriginal, tipo, celula)
  if (motivoPosicao !== null) {
    return recusa(motivoPosicao)
  }
  if (celulaOcupada(rungOriginal, celula)) {
    return recusa(`célula ocupada: já existe um elemento em ${descreverCelula(indiceDegrau, celula)}`)
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

/** Regra de nome/endereço comum a `declararVariavel` e `atualizarVariavel`:
 * nome IEC válido, sem duplicar outra variável, endereço (se houver) entre os
 * do controlador e não usado por outra variável. `ignorarNome`, quando dado,
 * exclui essa variável das checagens de duplicidade — é a própria variável
 * sendo atualizada, não uma colisão com ela mesma. Única implementação da
 * regra: as duas funções recusam pelo mesmo motivo, no mesmo texto. */
function motivoNomeOuEnderecoInvalido(
  diagrama: Diagrama,
  nome: string,
  endereco: string | undefined,
  ignorarNome?: string,
): string | null {
  if (nome.length === 0 || !REGEX_IDENTIFICADOR.test(nome)) {
    return `nome de variável inválido: '${nome}' — use letra ou '_' no início, seguido de letras, dígitos ou '_'`
  }
  if (diagrama.variaveis.some((v) => v.nome === nome && v.nome !== ignorarNome)) {
    return `já existe uma variável chamada '${nome}'`
  }
  if (endereco !== undefined) {
    if (!enderecoValido(endereco)) {
      return `endereço '${endereco}' não está entre os endereços do controlador`
    }
    const outra = diagrama.variaveis.find((v) => v.endereco === endereco && v.nome !== ignorarNome)
    if (outra !== undefined) {
      return `endereço '${endereco}' já está em uso pela variável '${outra.nome}'`
    }
  }
  return null
}

/** Move um elemento existente para outra célula, no mesmo degrau ou em outro
 * (arrasto célula → célula, plano D-12). Mesma célula e mesmo degrau é um
 * no-op bem-sucedido (o diagrama devolvido é igual ao original — só não é a
 * mesma referência). Preserva `id` e `variavel` do elemento. */
export function moverElemento(
  diagrama: Diagrama,
  elementoId: string,
  rungIdDestino: string,
  celula: Celula,
): ResultadoEdicao {
  const encontrado = encontrarElemento(diagrama, elementoId)
  if (encontrado === undefined) return recusa(`elemento '${elementoId}' inexistente`)

  const rungDestino = encontrarRung(diagrama, rungIdDestino)
  if (rungDestino === undefined) return recusa(`degrau '${rungIdDestino}' inexistente`)

  const { rung: rungOrigem, elemento } = encontrado
  const paraMesmaCelula =
    rungOrigem.id === rungIdDestino &&
    elemento.celula.linha === celula.linha &&
    elemento.celula.coluna === celula.coluna
  if (paraMesmaCelula) return sucesso(structuredClone(diagrama))

  const indiceDegrauDestino = indiceDoRung(diagrama, rungIdDestino)
  const motivoPosicao = motivoPosicaoInvalida(indiceDegrauDestino, rungDestino, elemento.tipo, celula)
  if (motivoPosicao !== null) return recusa(motivoPosicao)

  const ocupante = rungDestino.elementos.find(
    (e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna,
  )
  if (ocupante !== undefined && ocupante.id !== elementoId) {
    return recusa(`célula ocupada: já existe um elemento em ${descreverCelula(indiceDegrauDestino, celula)}`)
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRungOrigem = encontrarRung(novoDiagrama, rungOrigem.id) as Rung
  const elementoAMover = novoRungOrigem.elementos.find((e) => e.id === elementoId) as Elemento
  novoRungOrigem.elementos = novoRungOrigem.elementos.filter((e) => e.id !== elementoId)

  const novoRungDestino =
    rungOrigem.id === rungIdDestino ? novoRungOrigem : (encontrarRung(novoDiagrama, rungIdDestino) as Rung)
  elementoAMover.celula = celula
  novoRungDestino.elementos.push(elementoAMover)

  return sucesso(novoDiagrama)
}

/** Declara uma variável nova (interna, sem `endereco`, ou localizada, com um
 * dos endereços de `enderecos.ts`). */
export function declararVariavel(diagrama: Diagrama, variavel: { nome: string; endereco?: string }): ResultadoEdicao {
  const { nome, endereco } = variavel

  const motivo = motivoNomeOuEnderecoInvalido(diagrama, nome, endereco)
  if (motivo !== null) return recusa(motivo)

  const novoDiagrama = structuredClone(diagrama)
  const nova: Variavel = endereco === undefined ? { nome, tipo: 'BOOL' } : { nome, tipo: 'BOOL', endereco }
  novoDiagrama.variaveis.push(nova)

  return sucesso(novoDiagrama)
}

/** Atualiza nome e/ou endereço de uma variável já declarada — mesmas regras
 * de `declararVariavel`, ignorando a própria variável nas checagens de
 * duplicidade. `endereco` ausente torna a variável interna. Renomear
 * propaga para todo elemento vinculado (`elemento.variavel === nomeAtual`). */
export function atualizarVariavel(
  diagrama: Diagrama,
  nomeAtual: string,
  nova: { nome: string; endereco?: string },
): ResultadoEdicao {
  const existente = diagrama.variaveis.find((v) => v.nome === nomeAtual)
  if (existente === undefined) return recusa(`variável '${nomeAtual}' inexistente`)

  const motivo = motivoNomeOuEnderecoInvalido(diagrama, nova.nome, nova.endereco, nomeAtual)
  if (motivo !== null) return recusa(motivo)

  const novoDiagrama = structuredClone(diagrama)
  const alvo = novoDiagrama.variaveis.find((v) => v.nome === nomeAtual) as Variavel
  alvo.nome = nova.nome
  if (nova.endereco === undefined) {
    delete alvo.endereco
  } else {
    alvo.endereco = nova.endereco
  }

  if (nova.nome !== nomeAtual) {
    for (const rung of novoDiagrama.rungs) {
      for (const elemento of rung.elementos) {
        if (elemento.variavel === nomeAtual) elemento.variavel = nova.nome
      }
    }
  }

  return sucesso(novoDiagrama)
}

/** Remove uma variável declarada. Recusa se ainda estiver vinculada a algum
 * elemento — remover a variável sob o elemento deixaria um vínculo pendente
 * (o inverso de `removerElemento`, que pode remover mesmo vinculado porque o
 * vínculo mora no elemento, não na variável). */
export function removerVariavel(diagrama: Diagrama, nome: string): ResultadoEdicao {
  const existente = diagrama.variaveis.find((v) => v.nome === nome)
  if (existente === undefined) return recusa(`variável '${nome}' inexistente`)

  const vinculados = diagrama.rungs.reduce(
    (soma, rung) => soma + rung.elementos.filter((e) => e.variavel === nome).length,
    0,
  )
  if (vinculados > 0) {
    return recusa(`variável '${nome}' está vinculada a ${vinculados} elemento(s); desvincule antes de remover`)
  }

  const novoDiagrama = structuredClone(diagrama)
  novoDiagrama.variaveis = novoDiagrama.variaveis.filter((v) => v.nome !== nome)

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
