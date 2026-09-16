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
import type { Celula, Diagrama, Elemento, Rung } from './modelo'
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
  const { linha, coluna } = celula

  if (linha < 0 || linha > LINHAS_EXTRAS_MAX) return false
  if (coluna < 0 || coluna >= COLUNAS_POR_DEGRAU) return false

  if (linha > 0) {
    const dentroDeRamo = rung.ramos.some(
      (ramo) => ramo.linha === linha && coluna >= ramo.colunaInicio && coluna <= ramo.colunaFim,
    )
    if (!dentroDeRamo) return false
  }

  if (ehBobina(tipo)) return linha === 0 && coluna === COLUNA_TERMINAL
  if (ehContato(tipo)) return coluna < COLUNA_TERMINAL
  return false
}

// -- validarDiagrama ------------------------------------------------------

/** True se algum elemento do rung é uma bobina (em qualquer posição). */
function temBobina(rung: Rung): boolean {
  return rung.elementos.some((elemento) => ehBobina(elemento.tipo))
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

function validarElemento(rung: Rung, elemento: Elemento, diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  const { linha, coluna } = elemento.celula

  if (!posicaoValida(rung, elemento.tipo, elemento.celula)) {
    problemas.push({
      codigo: 'posicao_invalida',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `elemento '${elemento.id}' (${elemento.tipo}) em posição inválida (linha=${linha}, coluna=${coluna})`,
    })
  }

  if (elemento.variavel === null) {
    problemas.push({
      codigo: 'variavel_nao_atribuida',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `elemento '${elemento.id}' (${elemento.tipo}, coluna ${coluna}) sem variável atribuída`,
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
      mensagem: `elemento '${elemento.id}' referencia variável inexistente '${elemento.variavel}'`,
    })
    return problemas
  }

  if (ehBobina(elemento.tipo) && variavel.endereco !== undefined && ehEntrada(variavel.endereco)) {
    problemas.push({
      codigo: 'bobina_escreve_entrada',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `bobina '${elemento.id}' escreve em '${variavel.nome}' (${variavel.endereco}), que é uma entrada`,
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

  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) {
      problemas.push(...validarElemento(rung, elemento, diagrama))
    }

    if (!temBobina(rung)) {
      problemas.push({
        codigo: 'rung_incompleto',
        severidade: 'erro',
        rungId: rung.id,
        elementoId: null,
        mensagem: `degrau '${rung.id}' sem nenhuma bobina`,
      })
    }
  }

  return problemas
}
