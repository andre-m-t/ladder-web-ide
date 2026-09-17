/**
 * Validação estrutural do modelo de grade (spec 002, plano §5).
 *
 * Duas perguntas, deliberadamente separadas:
 *
 *   - `posicaoValida` responde "essa célula aceita esse tipo de elemento
 *     AGORA?" — é a pergunta que a edição faz antes de inserir um elemento.
 *     Não sabe nada sobre ocupação de célula (isso é responsabilidade de
 *     `edicao.ts`) nem sobre o diagrama inteiro.
 *   - `validarDiagrama` varre um `Diagrama` já montado e devolve todos os
 *     problemas encontrados, com código, severidade, rung e elemento.
 *
 * O que este arquivo não faz: simular o circuito. Uma célula vazia na linha 0
 * é fio — conduz — então um degrau com contato na coluna 0 e bobina na coluna
 * `COLUNA_TERMINAL` está estruturalmente completo, mesmo com colunas vazias
 * entre os dois. Os códigos da Q-6 (`bobina_duplicada`,
 * `set_reset_autodependente`) e a checagem de ramo aberto entram na tarefa
 * #11/#15; a união abaixo fica pronta para crescer.
 */

import { COLUNA_TERMINAL, COLUNAS_POR_DEGRAU, LINHAS_EXTRAS_MAX, ehBobina, ehContato } from './modelo'
import type { Celula, Diagrama, Elemento, Ramo, Rung } from './modelo'
import { ehEntrada, enderecoValido } from './enderecos'

// -- Códigos de problema -----------------------------------------------

export type CodigoProblema =
  | 'rung_incompleto'
  | 'variavel_nao_atribuida'
  | 'variavel_inexistente'
  | 'posicao_invalida'
  | 'endereco_invalido'
  | 'bobina_escreve_entrada'

export interface Problema {
  codigo: CodigoProblema
  severidade: 'erro' | 'aviso'
  /** '' quando o problema não pertence a um rung específico (ex.: endereço de variável). */
  rungId: string
  elementoId: string | null
  mensagem: string
}

// -- posicaoValida -------------------------------------------------------

/**
 * Uma célula aceita `tipo` em `rung` agora, ignorando ocupação?
 *
 * Regras (semântica fixada pelo plano/orquestrador da spec 002):
 *   - dentro de `0..COLUNAS_POR_DEGRAU-1` em coluna, e `0..LINHAS_EXTRAS_MAX`
 *     em linha — fora disso, nunca válida.
 *   - bobinas só em (linha 0, `COLUNA_TERMINAL`).
 *   - contatos em qualquer coluna antes de `COLUNA_TERMINAL`.
 *   - linha > 0 só é válida se existir um `Ramo` do rung com essa linha e a
 *     coluna dentro de `[colunaInicio, colunaFim]` (intervalo fechado).
 *   - não checa se a célula já está ocupada — isso é de `edicao.ts`.
 */
export function posicaoValida(rung: Rung, tipo: Elemento['tipo'], celula: Celula): boolean {
  // Fonte única da regra: `motivoPosicaoInvalida`. O índice do degrau só
  // entra no texto da mensagem, não na decisão.
  return motivoPosicaoInvalida(0, rung, tipo, celula) === null
}

// -- mensagens voltadas ao usuário ---------------------------------------

/**
 * Descreve uma célula do jeito que a interface rotula (1-based): "degrau N,
 * coluna M" no trilho principal (linha 0), "degrau N, ramo L, coluna M" num
 * ramo (linha L > 0). Nunca expõe `linha=`/`coluna=` internos (0-based) —
 * toda mensagem voltada ao usuário passa por aqui. Usado por `edicao.ts` e
 * por `validarDiagrama`, para que as duas frentes descrevam posição do
 * mesmo jeito.
 */
export function descreverCelula(indiceDegrau: number, celula: Celula): string {
  const degrau = `degrau ${indiceDegrau + 1}`
  const coluna = `coluna ${celula.coluna + 1}`
  return celula.linha === 0 ? `${degrau}, ${coluna}` : `${degrau}, ramo ${celula.linha}, ${coluna}`
}

/**
 * Regra de posição, com o motivo: devolve `null` se `celula` aceita `tipo` em
 * `rung`, ou a mensagem em português, 1-based, explicando a primeira regra
 * violada (não só constatando a recusa). É a **única** implementação da
 * regra — `posicaoValida` deriva daqui, para que a decisão e o motivo
 * relatado nunca divirjam.
 */
export function motivoPosicaoInvalida(
  indiceDegrau: number,
  rung: Rung,
  tipo: Elemento['tipo'],
  celula: Celula,
): string | null {
  const { linha, coluna } = celula
  const onde = descreverCelula(indiceDegrau, celula)
  const colunaTerminal1Based = COLUNA_TERMINAL + 1

  if (linha < 0) {
    return `posição inválida: ${onde} está fora da grade (linha negativa)`
  }
  if (coluna < 0 || coluna >= COLUNAS_POR_DEGRAU) {
    return `posição inválida: ${onde} está fora da grade (o degrau tem colunas 1 a ${COLUNAS_POR_DEGRAU})`
  }
  if (linha > LINHAS_EXTRAS_MAX) {
    return `posição inválida: ${onde} passa do limite de ramos do degrau (no máximo ${LINHAS_EXTRAS_MAX} linha(s) além do trilho principal)`
  }
  if (linha > 0) {
    const dentroDeRamo = rung.ramos.some(
      (ramo) => ramo.linha === linha && coluna >= ramo.colunaInicio && coluna <= ramo.colunaFim,
    )
    if (!dentroDeRamo) {
      return `posição inválida: ${onde} não tem ramo declarado nessa coluna`
    }
  }
  if (ehBobina(tipo)) {
    if (linha === 0 && coluna === COLUNA_TERMINAL) return null
    return `posição inválida: bobina só pode ficar na última coluna (coluna ${colunaTerminal1Based}) do trilho principal`
  }
  if (ehContato(tipo)) {
    if (coluna < COLUNA_TERMINAL) return null
    return `posição inválida: a coluna ${colunaTerminal1Based} é reservada a bobinas; contatos vão nas colunas 1 a ${COLUNA_TERMINAL}`
  }
  return `posição inválida em ${onde}`
}

// -- validarDiagrama ------------------------------------------------------

/** True se algum elemento do rung é uma bobina (em qualquer posição). */
function temBobina(rung: Rung): boolean {
  return rung.elementos.some((elemento) => ehBobina(elemento.tipo))
}

/** True se algum elemento do rung está na linha do ramo, dentro do intervalo
 * fechado `[colunaInicio, colunaFim]` — um ramo sem nenhum elemento aí dentro
 * é fio nu ligando as duas pontas: curto-circuita o trecho (plano D-14). */
function ramoVazio(rung: Rung, ramo: Ramo): boolean {
  return !rung.elementos.some(
    (elemento) =>
      elemento.celula.linha === ramo.linha &&
      elemento.celula.coluna >= ramo.colunaInicio &&
      elemento.celula.coluna <= ramo.colunaFim,
  )
}

function validarEnderecosDasVariaveis(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  for (const variavel of diagrama.variaveis) {
    if (variavel.endereco !== undefined && !enderecoValido(variavel.endereco)) {
      problemas.push({
        codigo: 'endereco_invalido',
        severidade: 'erro',
        rungId: '',
        elementoId: null,
        mensagem: `variável '${variavel.nome}': endereço '${variavel.endereco}' não está entre os endereços do controlador`,
      })
    }
  }
  return problemas
}

function validarElemento(indiceDegrau: number, rung: Rung, elemento: Elemento, diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  const onde = descreverCelula(indiceDegrau, elemento.celula)

  if (!posicaoValida(rung, elemento.tipo, elemento.celula)) {
    problemas.push({
      codigo: 'posicao_invalida',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `${motivoPosicaoInvalida(indiceDegrau, rung, elemento.tipo, elemento.celula)} (elemento '${elemento.id}', ${elemento.tipo})`,
    })
  }

  if (elemento.variavel === null) {
    problemas.push({
      codigo: 'variavel_nao_atribuida',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `elemento '${elemento.id}' (${elemento.tipo}) em ${onde} está sem variável atribuída — vincule uma variável a esse elemento`,
    })
    return problemas
  }

  const variavel = diagrama.variaveis.find((v) => v.nome === elemento.variavel)
  if (variavel === undefined) {
    problemas.push({
      codigo: 'variavel_inexistente',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `elemento '${elemento.id}' (${elemento.tipo}) em ${onde} referencia a variável '${elemento.variavel}', que não existe`,
    })
    return problemas
  }

  if (ehBobina(elemento.tipo) && variavel.endereco !== undefined && ehEntrada(variavel.endereco)) {
    problemas.push({
      codigo: 'bobina_escreve_entrada',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `bobina '${elemento.id}' em ${onde} escreve em '${variavel.nome}' (${variavel.endereco}), que é uma entrada — bobinas não podem escrever em entradas`,
    })
  }

  return problemas
}

/**
 * Varre um `Diagrama` montado e devolve todos os problemas encontrados. Não
 * para no primeiro: um diagrama em edição costuma ter vários ao mesmo tempo.
 */
export function validarDiagrama(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = [...validarEnderecosDasVariaveis(diagrama)]

  diagrama.rungs.forEach((rung, indiceDegrau) => {
    for (const elemento of rung.elementos) {
      problemas.push(...validarElemento(indiceDegrau, rung, elemento, diagrama))
    }

    if (!temBobina(rung)) {
      problemas.push({
        codigo: 'rung_incompleto',
        severidade: 'erro',
        rungId: rung.id,
        elementoId: null,
        mensagem: `degrau ${indiceDegrau + 1} sem nenhuma bobina — todo degrau precisa terminar numa bobina na coluna ${COLUNA_TERMINAL + 1}`,
      })
    }

    for (const ramo of rung.ramos) {
      if (ramoVazio(rung, ramo)) {
        problemas.push({
          codigo: 'rung_incompleto',
          severidade: 'erro',
          rungId: rung.id,
          elementoId: null,
          mensagem: `ramo vazio em degrau ${indiceDegrau + 1}, colunas ${ramo.colunaInicio + 1}–${ramo.colunaFim + 1}: um ramo sem contato curto-circuita o trecho`,
        })
      }
    }
  })

  return problemas
}
