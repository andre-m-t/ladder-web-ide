/**
 * Operações de edição do diagrama Ladder (spec 002, plano D-3).
 *
 * Cada operação é uma função pura `Diagrama → ResultadoEdicao`: nunca muta a
 * entrada, ou devolve o novo diagrama, ou recusa com um motivo em português.
 * Estrutura inválida por posição, ocupação ou referência nunca entra no
 * estado — quem chama decide o que fazer com a recusa (ex.: mostrar em
 * `role="alert"`, sem alterar o diagrama em edição).
 */

import { COLUNA_TERMINAL, LINHAS_EXTRAS_MAX, ehBobina } from './modelo'
import type { Celula, Diagrama, Elemento, Ramo, Rung, Variavel } from './modelo'
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

/** Menor `r<N>` (N inteiro positivo) ainda não usado como id de degrau em
 * `diagrama` (mesmo esquema de `proximoIdElemento`, com prefixo `r`). */
function proximoIdRung(diagrama: Diagrama): string {
  const usados = new Set(diagrama.rungs.map((rung) => rung.id))
  let n = 1
  while (usados.has(`r${n}`)) n++
  return `r${n}`
}

/** Insere um degrau vazio em `posicao` (0-based, índice entre os degraus
 * existentes — `rungs.length` insere ao final). Recusa se `posicao` não for
 * um inteiro em `0..rungs.length` (CA-6, CA-10 parte de #9). */
export function inserirDegrau(diagrama: Diagrama, posicao: number): ResultadoEdicao {
  if (!Number.isInteger(posicao) || posicao < 0 || posicao > diagrama.rungs.length) {
    return recusa(
      `posição de degrau inválida: '${posicao}' — use um número inteiro entre 0 e ${diagrama.rungs.length}`,
    )
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung: Rung = { id: proximoIdRung(diagrama), elementos: [], ramos: [] }
  novoDiagrama.rungs.splice(posicao, 0, novoRung)

  return sucesso(novoDiagrama)
}

/** Remove um degrau inteiro (com seus elementos e ramos), sem alterar os
 * demais. Recusa se o degrau não existir ou se for o último — o diagrama
 * sempre precisa de pelo menos um degrau editável (CA-6). Variáveis
 * declaradas permanecem intactas: o vínculo mora no elemento removido, não
 * na variável. */
export function removerDegrau(diagrama: Diagrama, rungId: string): ResultadoEdicao {
  const rung = encontrarRung(diagrama, rungId)
  if (rung === undefined) return recusa(`degrau '${rungId}' inexistente`)
  if (diagrama.rungs.length <= 1) {
    return recusa('o diagrama precisa de pelo menos um degrau')
  }

  const novoDiagrama = structuredClone(diagrama)
  novoDiagrama.rungs = novoDiagrama.rungs.filter((r) => r.id !== rungId)

  return sucesso(novoDiagrama)
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

/**
 * Célula de destino que a UI deve usar ao soltar `tipo` sobre `celula`, antes
 * de chamar `inserirElemento`/`moverElemento`. Decisão do autor (2026-09-17):
 * soltar uma bobina em qualquer célula do degrau — trilho principal ou linha
 * de ramo — a leva direto para a coluna terminal (`COLUNA_TERMINAL`, linha
 * 0), em vez de a UI recusar o drop por a célula não ser a terminal. Para
 * todo outro tipo (contato), a célula não muda: é devolvida como veio, sem
 * cópia nem alteração.
 *
 * Esta função só decide PARA ONDE a UI deve tentar o drop — não valida nada.
 * O núcleo continua estrito: `inserirElemento` e `moverElemento` não mudam e
 * seguem recusando bobina fora da coluna terminal (célula ocupada, posição
 * inválida etc. continuam recusa de `inserirElemento`/`moverElemento`, não
 * desta função).
 */
export function celulaDeSoltura(tipo: Elemento['tipo'], celula: Celula): Celula {
  if (ehBobina(tipo)) {
    return { linha: 0, coluna: COLUNA_TERMINAL }
  }
  return celula
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

/** Menor `b<N>` (N inteiro positivo) ainda não usado como id de ramo em
 * `diagrama`, contando os ramos de todos os degraus (mesmo esquema de
 * `proximoIdElemento`, com prefixo `b`). */
function proximoIdRamo(diagrama: Diagrama): string {
  const usados = new Set<string>()
  for (const rung of diagrama.rungs) {
    for (const ramo of rung.ramos) usados.add(ramo.id)
  }
  let n = 1
  while (usados.has(`b${n}`)) n++
  return `b${n}`
}

function encontrarRamo(diagrama: Diagrama, ramoId: string): { rung: Rung; ramo: Ramo } | undefined {
  for (const rung of diagrama.rungs) {
    const ramo = rung.ramos.find((r) => r.id === ramoId)
    if (ramo !== undefined) return { rung, ramo }
  }
  return undefined
}

/** True se algum elemento do rung está na `linha` dada, dentro do intervalo
 * fechado `[colunaInicio, colunaFim]` — a mesma regra de pertencimento a um
 * ramo usada por `motivoPosicaoInvalida`. */
function temElementoNoIntervalo(rung: Rung, linha: number, colunaInicio: number, colunaFim: number): boolean {
  return rung.elementos.some(
    (elemento) =>
      elemento.celula.linha === linha && elemento.celula.coluna >= colunaInicio && elemento.celula.coluna <= colunaFim,
  )
}

/** Cria um ramo paralelo ao trilho principal na coluna dada (célula única,
 * `colunaInicio === colunaFim === coluna`), na primeira linha 1..`LINHAS_EXTRAS_MAX`
 * sem outro ramo do mesmo degrau ocupando essa coluna (plano D-14, Q-3). */
export function criarRamo(diagrama: Diagrama, rungId: string, coluna: number): ResultadoEdicao {
  const rungOriginal = encontrarRung(diagrama, rungId)
  if (rungOriginal === undefined) return recusa(`degrau '${rungId}' inexistente`)
  const indiceDegrau = indiceDoRung(diagrama, rungId)

  if (coluna < 0 || coluna >= COLUNA_TERMINAL) {
    return recusa(`ramo só cobre colunas de contato, 1 a ${COLUNA_TERMINAL}`)
  }

  const sobrepoeNaLinha = (linha: number) =>
    rungOriginal.ramos.some((ramo) => ramo.linha === linha && coluna >= ramo.colunaInicio && coluna <= ramo.colunaFim)

  let linhaLivre: number | undefined
  for (let linha = 1; linha <= LINHAS_EXTRAS_MAX; linha++) {
    if (!sobrepoeNaLinha(linha)) {
      linhaLivre = linha
      break
    }
  }
  if (linhaLivre === undefined) {
    return recusa(
      `sem linha livre para o ramo em ${descreverCelula(indiceDegrau, { linha: 0, coluna })}: o degrau já usa ` +
        `${LINHAS_EXTRAS_MAX} linha(s) além do trilho principal nessa coluna (no máximo ${LINHAS_EXTRAS_MAX} linha(s), Q-3)`,
    )
  }

  const novoDiagrama = structuredClone(diagrama)
  const rung = encontrarRung(novoDiagrama, rungId) as Rung
  const novoRamo: Ramo = { id: proximoIdRamo(diagrama), linha: linhaLivre, colunaInicio: coluna, colunaFim: coluna }
  rung.ramos.push(novoRamo)

  return sucesso(novoDiagrama)
}

/** Estica ou encolhe um ramo já existente até `colunaFim` (a alça arrastável
 * do plano D-14). `colunaInicio` nunca muda. */
export function redimensionarRamo(diagrama: Diagrama, ramoId: string, colunaFim: number): ResultadoEdicao {
  const encontrado = encontrarRamo(diagrama, ramoId)
  if (encontrado === undefined) return recusa(`ramo '${ramoId}' inexistente`)
  const { rung, ramo } = encontrado
  const indiceDegrau = indiceDoRung(diagrama, rung.id)

  if (colunaFim < ramo.colunaInicio) {
    return recusa(`coluna final do ramo '${ramoId}' não pode ficar antes da coluna inicial`)
  }
  if (colunaFim >= COLUNA_TERMINAL) {
    return recusa(`ramo só cobre colunas de contato, 1 a ${COLUNA_TERMINAL}`)
  }

  const sobrepoeOutroRamo = rung.ramos.some(
    (outro) =>
      outro.id !== ramoId &&
      outro.linha === ramo.linha &&
      outro.colunaInicio <= colunaFim &&
      ramo.colunaInicio <= outro.colunaFim,
  )
  if (sobrepoeOutroRamo) {
    return recusa(`ramo '${ramoId}' se sobreporia a outro ramo na mesma linha do degrau ${indiceDegrau + 1}`)
  }

  const elementoFora = rung.elementos.find(
    (elemento) =>
      elemento.celula.linha === ramo.linha &&
      (elemento.celula.coluna < ramo.colunaInicio || elemento.celula.coluna > colunaFim),
  )
  if (elementoFora !== undefined) {
    return recusa(`há contato em ${descreverCelula(indiceDegrau, elementoFora.celula)} fora do novo intervalo`)
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung = encontrarRung(novoDiagrama, rung.id) as Rung
  const novoRamo = novoRung.ramos.find((r) => r.id === ramoId) as Ramo
  novoRamo.colunaFim = colunaFim

  return sucesso(novoDiagrama)
}

/** Remove um ramo. Recusa se ainda houver algum elemento na linha do ramo,
 * dentro do intervalo `[colunaInicio, colunaFim]` — remover o ramo sob um
 * contato deixaria esse contato numa posição inválida. */
export function removerRamo(diagrama: Diagrama, ramoId: string): ResultadoEdicao {
  const encontrado = encontrarRamo(diagrama, ramoId)
  if (encontrado === undefined) return recusa(`ramo '${ramoId}' inexistente`)
  const { rung, ramo } = encontrado

  if (temElementoNoIntervalo(rung, ramo.linha, ramo.colunaInicio, ramo.colunaFim)) {
    return recusa('remova os contatos do ramo antes')
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung = encontrarRung(novoDiagrama, rung.id) as Rung
  novoRung.ramos = novoRung.ramos.filter((r) => r.id !== ramoId)

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
