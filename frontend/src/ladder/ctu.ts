/**
 * Regras específicas do contador crescente (CTU) — spec 002, plano D-2/D-7,
 * spec.md Q-5/Q-7.
 *
 * Isolamento deliberado (D-7, requisito destacável Q-7): tudo o que só faz
 * sentido para o CTU vive aqui — criação, posição (inclusive a exceção da
 * linha de reset), limite (`pv`) e o único problema de validação que é
 * específico dele. `edicao.ts` e `validacao.ts` chamam este arquivo em
 * pontos de extensão só quando o tipo do elemento é `'ctu'`, ou (para a
 * linha de reset) quando o degrau TEM um CTU — nunca duplicam a regra.
 *
 * Retirar o CTU (Q-7): apagar este arquivo e `ctu.test.ts`, remover o membro
 * `'ctu'` da união `Elemento` em `modelo.ts` e as chamadas que o compilador
 * passa a apontar em `edicao.ts`/`validacao.ts` (listadas no relatório da
 * tarefa #16).
 *
 * `ResultadoEdicao` (de `edicao.ts`) e `Problema` (de `validacao.ts`) entram
 * só como tipo (`import type`), de propósito: `edicao.ts` e `validacao.ts`
 * importam este arquivo em tempo de execução (para `criarCtu`/`atualizarCtu`
 * e para `motivoPosicaoCtu`/`problemasDoCtu`), e um import de valor nos dois
 * sentidos fecharia um ciclo de módulos. Por isso as funções abaixo também
 * não chamam `descreverCelula` de `validacao.ts` — quem precisa de uma célula
 * já descrita (`motivoPosicaoCtu`) recebe o texto pronto por parâmetro.
 */

import { COLUNA_TERMINAL, LINHAS_EXTRAS_MAX, ehContato, ehCtu } from './modelo'
import type { Celula, Diagrama, Elemento, ElementoCtu, Rung } from './modelo'
import type { ResultadoEdicao } from './edicao'
import type { Problema } from './validacao'

/** Valor padrão do limite do contador ao ser criado. */
export const PV_PADRAO = 10

/** Menor limite aceito — contador crescente não conta valor negativo (Q-5). */
export const PV_MIN = 1

/** Maior limite aceito — cabe num inteiro de 16 bits com sinal (IEC 61131-3). */
export const PV_MAX = 32767

/**
 * Primeira linha em `1..LINHAS_EXTRAS_MAX` sem ramo e sem elemento no degrau
 * — a linha que um CTU novo (ou movido de outro degrau) usaria para o
 * caminho de reinício. `null` se todas as linhas extras já estão ocupadas:
 * ramos e a linha de reset dividem o mesmo limite (Q-3, D-2).
 *
 * Preferência (D-7, correção pós-verificação no Chromium): dado que existe
 * ramo, a busca começa **abaixo do mais baixo já usado** — o invariante
 * desejado é que a linha de reset fique sempre na linha extra mais baixa do
 * degrau, para o conector vertical de nenhum ramo cruzar a linha de reset
 * (ver `planoDeRamoComCtu`, para o caminho inverso: ramo criado depois do
 * CTU). Um degrau vazio (sem ramo) não muda: a busca começa em 1, como
 * sempre — é o caso do `BLINK`, que espera `linhaReset` 1. Se não houver
 * linha livre abaixo dos ramos (falta de espaço para satisfazer o
 * invariante), cai para a busca simples de sempre — a menor linha livre,
 * aceitando o degrau como está hoje.
 */
export function linhaResetLivre(rung: Rung): number | null {
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

/**
 * Decide se um ramo que iria para `linhaCandidata` deveria trocar de lugar
 * com a linha de reset do CTU do degrau (D-7, correção pós-verificação no
 * Chromium): sem a troca, um ramo criado depois do CTU pode cair numa linha
 * abaixo da linha de reset, e o conector vertical do ramo cruzaria essa
 * linha — lê-se como uma junção nela. Invariante desejado, quando possível:
 * a linha de reset é a linha extra mais baixa do degrau, e nenhum ramo fica
 * abaixo dela.
 *
 * `rung` é o `Rung` ORIGINAL (não clonado), só para decidir — não muta nada;
 * quem chama (`criarRamo`, em `edicao.ts`) aplica a troca, porque isso
 * envolve mexer nos elementos da linha de reset, fora do escopo de uma
 * função de decisão.
 *
 * Sem troca (`linhaCandidata` já está na linha de reset ou acima dela, ou a
 * troca não é possível porque `linhaCandidata` não está totalmente livre —
 * tem outro ramo ou elemento, ainda que em outra coluna): devolve
 * `{ linhaRamo: linhaCandidata, novaLinhaReset: null }`. Com troca: devolve
 * `{ linhaRamo: <linha atual do reset>, novaLinhaReset: linhaCandidata }` —
 * o CTU libera a própria linha para o ramo e desce para a que estava livre.
 */
export function planoDeRamoComCtu(
  rung: Rung,
  ctu: ElementoCtu,
  linhaCandidata: number,
): { linhaRamo: number; novaLinhaReset: number | null } {
  if (linhaCandidata <= ctu.linhaReset) {
    return { linhaRamo: linhaCandidata, novaLinhaReset: null }
  }

  const linhaTotalmenteLivre =
    !rung.ramos.some((ramo) => ramo.linha === linhaCandidata) &&
    !rung.elementos.some((elemento) => elemento.celula.linha === linhaCandidata)
  if (!linhaTotalmenteLivre) {
    return { linhaRamo: linhaCandidata, novaLinhaReset: null }
  }

  return { linhaRamo: ctu.linhaReset, novaLinhaReset: linhaCandidata }
}

/** Mesmo esquema de `e<N>` de `proximoIdElemento` em `edicao.ts`, duplicado
 * aqui de propósito: importar a função de `edicao.ts` em tempo de execução
 * fecharia o ciclo de módulos descrito no cabeçalho. As duas leem o mesmo
 * formato de id no mesmo diagrama e por isso nunca divergem — coberto por
 * `edicao.test.ts` (ids intercalados entre elementos simples e CTU). */
function proximoIdElemento(diagrama: Diagrama): string {
  const usados = new Set<string>()
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) usados.add(elemento.id)
  }
  let n = 1
  while (usados.has(`e${n}`)) n++
  return `e${n}`
}

/** Primeiro `ctu<N>` (N a partir de 0) livre, sem colidir — sem diferenciar
 * maiúsculas/minúsculas — com outra instância de CTU nem com nome de
 * variável já declarada no diagrama. */
function proximaInstanciaCtu(diagrama: Diagrama): string {
  const usados = new Set<string>()
  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) {
      if (ehCtu(elemento)) usados.add(elemento.instancia.toLowerCase())
    }
  }
  for (const variavel of diagrama.variaveis) usados.add(variavel.nome.toLowerCase())

  let n = 0
  while (usados.has(`ctu${n}`)) n++
  return `ctu${n}`
}

/**
 * Cria um CTU novo em `rungId`, na coluna terminal (linha 0, `COLUNA_TERMINAL`
 * — como uma bobina, D-2). Recusa se essa célula já estiver ocupada, ou se o
 * degrau não tiver linha livre para o caminho de reinício: ramos e a linha
 * de reset dividem o mesmo limite `LINHAS_EXTRAS_MAX` (Q-3). `instancia` sai
 * de `proximaInstanciaCtu`, `pv` começa em `PV_PADRAO`, `saida` começa nula —
 * a mesma regra de "insere e ainda não vincula variável" de qualquer outro
 * elemento novo.
 *
 * Chamada por `inserirElemento` (`edicao.ts`) depois que posição e ocupação
 * já foram validadas ali pela via genérica (`motivoPosicaoInvalida` +
 * checagem de célula ocupada) — as checagens abaixo são a garantia de que
 * `criarCtu` também é segura chamada sozinha (ex.: direto de um teste).
 */
export function criarCtu(diagrama: Diagrama, rungId: string): ResultadoEdicao {
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

  const linhaReset = linhaResetLivre(rung)
  if (linhaReset === null) {
    return {
      ok: false,
      motivo:
        `sem linha livre para o reinício do contador no degrau ${indiceDegrau + 1}: o CTU precisa de uma linha ` +
        `própria para o caminho de reinício, e ramos e a linha de reset dividem o mesmo limite de ` +
        `${LINHAS_EXTRAS_MAX} linha(s) além do trilho principal (Q-3)`,
    }
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung = novoDiagrama.rungs.find((r) => r.id === rungId) as Rung
  const novoCtu: ElementoCtu = {
    id: proximoIdElemento(diagrama),
    tipo: 'ctu',
    celula: { linha: 0, coluna: COLUNA_TERMINAL },
    linhaReset,
    instancia: proximaInstanciaCtu(diagrama),
    pv: PV_PADRAO,
    saida: null,
  }
  novoRung.elementos.push(novoCtu)

  return { ok: true, diagrama: novoDiagrama }
}

/**
 * Atualiza o limite (`pv`) de um CTU já existente — único campo editável
 * depois da criação (`instancia` nasce fixa, D-2; `linhaReset` só muda ao
 * mover o CTU de degrau, ver `moverElemento` em `edicao.ts`; `saida` é
 * vinculada por `vincularVariavel`, não por aqui). Recusa se `pv` não for um
 * inteiro em `[PV_MIN, PV_MAX]`, ou se o elemento não existir ou não for CTU.
 */
export function atualizarCtu(diagrama: Diagrama, elementoId: string, alteracoes: { pv?: number }): ResultadoEdicao {
  const rung = diagrama.rungs.find((r) => r.elementos.some((e) => e.id === elementoId))
  if (rung === undefined) return { ok: false, motivo: `elemento '${elementoId}' inexistente` }
  const elemento = rung.elementos.find((e) => e.id === elementoId) as Elemento
  if (!ehCtu(elemento)) return { ok: false, motivo: `elemento '${elementoId}' não é um contador CTU` }

  if (
    alteracoes.pv !== undefined &&
    (!Number.isInteger(alteracoes.pv) || alteracoes.pv < PV_MIN || alteracoes.pv > PV_MAX)
  ) {
    return { ok: false, motivo: `limite do contador deve ser inteiro de ${PV_MIN} a ${PV_MAX}` }
  }

  const novoDiagrama = structuredClone(diagrama)
  const novoRung = novoDiagrama.rungs.find((r) => r.id === rung.id) as Rung
  const novoElemento = novoRung.elementos.find((e) => e.id === elementoId) as ElementoCtu
  if (alteracoes.pv !== undefined) novoElemento.pv = alteracoes.pv

  return { ok: true, diagrama: novoDiagrama }
}

/**
 * Regra de posição do CTU e da exceção que ele abre para a sua linha de
 * reset (D-2, D-7). Chamada por `motivoPosicaoInvalida` (`validacao.ts`) num
 * único ponto, depois dos limites genéricos de grade (linha/coluna fora do
 * degrau) e antes da checagem genérica de ramo. Devolve:
 *
 *   - `string`: uma regra do CTU decide esta posição, e ela é inválida — o
 *     motivo em português, 1-based, pronto para virar recusa.
 *   - `null`: uma regra do CTU decide esta posição, e ela é válida.
 *   - `undefined`: nenhuma regra do CTU se aplica aqui — `motivoPosicaoInvalida`
 *     segue com a checagem genérica (ramo, bobina, contato), sem mudança.
 *
 * Duas regras: (1) o próprio elemento `'ctu'` só é válido em (linha 0,
 * `COLUNA_TERMINAL`), como uma bobina — decide sozinho, nunca cai no
 * genérico. (2) se o degrau tem um CTU, a linha `linhaReset` dele aceita
 * contato em qualquer coluna antes de `COLUNA_TERMINAL` (o caminho de
 * reinício), mas nunca um terminal — essa linha nunca tem `Ramo` (D-2), então
 * sem esta regra o genérico recusaria por "sem ramo declarado", motivo que
 * não faz sentido para quem está editando a linha de reset.
 */
export function motivoPosicaoCtu(
  rung: Rung,
  tipo: Elemento['tipo'],
  celula: Celula,
  onde: string,
): string | null | undefined {
  if (tipo === 'ctu') {
    if (celula.linha === 0 && celula.coluna === COLUNA_TERMINAL) return null
    return `posição inválida: contador CTU só pode ficar na última coluna (coluna ${COLUNA_TERMINAL + 1}) do trilho principal, como uma bobina`
  }

  if (celula.linha > 0) {
    const ctu = rung.elementos.find(ehCtu)
    if (ctu !== undefined && ctu.linhaReset === celula.linha) {
      if (ehContato(tipo) && celula.coluna < COLUNA_TERMINAL) return null
      return (
        `posição inválida: ${onde} é a linha de reinício do contador '${ctu.instancia}' — só aceita contatos, ` +
        `nas colunas 1 a ${COLUNA_TERMINAL}`
      )
    }
  }

  return undefined
}

/**
 * Único problema de validação específico do CTU (D-7): `pv` fora de
 * `[PV_MIN, PV_MAX]` num diagrama já montado. Não alcançável pela edição
 * normal — `atualizarCtu` já recusa antes de gravar — mas alcançável por um
 * diagrama vindo de fora dela (ex.: `localStorage` editado à mão, ou uma
 * versão futura de importação). Chamado por `validarDiagrama`
 * (`validacao.ts`) num único ponto; código `ctu_limite_invalido` (ver
 * `CodigoProblema`).
 */
export function problemasDoCtu(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  diagrama.rungs.forEach((rung, indiceDegrau) => {
    for (const elemento of rung.elementos) {
      if (!ehCtu(elemento)) continue
      if (!Number.isInteger(elemento.pv) || elemento.pv < PV_MIN || elemento.pv > PV_MAX) {
        problemas.push({
          codigo: 'ctu_limite_invalido',
          severidade: 'erro',
          rungId: rung.id,
          elementoId: elemento.id,
          mensagem:
            `contador '${elemento.instancia}' (elemento '${elemento.id}') no degrau ${indiceDegrau + 1} tem ` +
            `limite ${elemento.pv} fora do intervalo permitido (${PV_MIN} a ${PV_MAX})`,
        })
      }
    }
  })
  return problemas
}
