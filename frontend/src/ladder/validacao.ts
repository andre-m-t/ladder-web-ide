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
 * entre os dois.
 *
 * Regras da Q-6 (D-10, tarefa #11): `bobina_duplicada` (erro) e
 * `set_reset_autodependente` (aviso) — ver JSDoc de cada função abaixo para a
 * definição exata. A checagem de ramo aberto (CTU) entra na tarefa #15; a
 * união abaixo fica pronta para crescer.
 *
 * Degrau vazio não é erro (tarefa #25): um degrau com zero elementos e zero
 * ramos ainda não foi tocado pelo autor, então `rung_incompleto` não se
 * aplica a ele — ver `rungAindaNaoComecado`. Assim que o degrau ganha algum
 * conteúdo (um elemento, ou um ramo mesmo vazio), a exigência de bobina volta
 * a valer, como sempre valeu.
 */

import {
  COLUNA_TERMINAL,
  COLUNAS_POR_DEGRAU,
  LINHAS_EXTRAS_MAX,
  ehBobina,
  ehContato,
  ehBloco,
  ehTerminal,
  variavelDoElemento,
} from './modelo'
import type { Celula, Diagrama, Elemento, Ramo, Rung } from './modelo'
import { ehEntrada, enderecoValido } from './enderecos'
import { blocoDoRung, motivoPosicaoBloco, problemasDoBloco } from './blocos'

// -- Códigos de problema -----------------------------------------------

export type CodigoProblema =
  | 'rung_incompleto'
  | 'variavel_nao_atribuida'
  | 'variavel_inexistente'
  | 'posicao_invalida'
  | 'endereco_invalido'
  | 'bobina_escreve_entrada'
  | 'bobina_duplicada'
  | 'set_reset_autodependente'
  /** Bloco FB (spec 006): `preset` fora da faixa do descritor. */
  | 'bloco_preset_invalido'
  /** @deprecated Alias histórico — use `bloco_preset_invalido`. */
  | 'bloco_preset_invalido'
  /** Diagnóstico do `iec2c` sobre o ST serializado, levado ao degrau que gerou
   * a linha (spec 003, D-8/Q-3). Produzido pela IDE a partir de uma falha de
   * compilação — nunca por `validarDiagrama`. */
  | 'erro_compilacao'

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

  // Ponto de extensão (D-7): o CTU decide sozinho a própria posição, e abre
  // uma exceção de contato na sua linha de reset — ver `motivoPosicaoCtu`.
  // `undefined` = nenhuma regra do CTU se aplica; segue a checagem genérica.
  const motivoBloco = motivoPosicaoBloco(rung, tipo, celula, onde)
  if (motivoBloco !== undefined) return motivoBloco

  if (ehBobina(tipo)) {
    if (coluna !== COLUNA_TERMINAL) {
      return `posição inválida: bobina só pode ficar na última coluna (coluna ${colunaTerminal1Based})`
    }
    const bloco = blocoDoRung(rung)
    if (bloco !== undefined && bloco.linhaControle !== null && linha === bloco.linhaControle) {
      return `posição inválida: ${onde} é a linha de controle do bloco '${bloco.instancia}' — só aceita contatos`
    }
    if (linha > 0) {
      const principal = rung.elementos.some(
        (e) => e.celula.linha === 0 && e.celula.coluna === COLUNA_TERMINAL && ehTerminal(e.tipo),
      )
      if (!principal) {
        return `posição inválida: saída paralela em ${onde} exige um terminal na linha principal (coluna ${colunaTerminal1Based})`
      }
      const ramoSaida = rung.ramos.some((ramo) => ramo.linha === linha && ramo.colunaInicio === COLUNA_TERMINAL && ramo.colunaFim === COLUNA_TERMINAL)
      if (!ramoSaida) {
        return `posição inválida: saída paralela em ${onde} exige um ramo de saída na coluna terminal`
      }
    }
    return null
  }

  if (linha > 0) {
    const dentroDeRamo = rung.ramos.some(
      (ramo) => ramo.linha === linha && coluna >= ramo.colunaInicio && coluna <= ramo.colunaFim,
    )
    if (!dentroDeRamo) {
      return `posição inválida: ${onde} não tem ramo declarado nessa coluna`
    }
  }
  if (ehContato(tipo)) {
    if (coluna < COLUNA_TERMINAL) return null
    return `posição inválida: a coluna ${colunaTerminal1Based} é reservada a bobinas; contatos vão nas colunas 1 a ${COLUNA_TERMINAL}`
  }
  return `posição inválida em ${onde}`
}

// -- validarDiagrama ------------------------------------------------------

/** Terminal principal do degrau: bobina ou CTU na coluna terminal da linha 0. */
function temTerminalNoTrilho(rung: Rung): boolean {
  return rung.elementos.some(
    (elemento) =>
      elemento.celula.linha === 0 && elemento.celula.coluna === COLUNA_TERMINAL && ehTerminal(elemento.tipo),
  )
}

/**
 * Degrau que ainda não foi tocado pelo autor: zero elementos e zero ramos
 * (tarefa #25). Um diagrama recém-criado (`diagramaVazio()`, `inserirDegrau`)
 * tem um ou mais desses degraus, e eles não são erro — "sem nenhuma bobina"
 * só vira `rung_incompleto` a partir do momento em que o degrau ganha algum
 * conteúdo (um elemento, ou um ramo, mesmo vazio) e ainda assim não termina
 * numa bobina. Ramo vazio continua sendo `rung_incompleto` por si só, via
 * `ramoVazio` abaixo — essa checagem não muda.
 */
function rungAindaNaoComecado(rung: Rung): boolean {
  return rung.elementos.length === 0 && rung.ramos.length === 0
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

  const nomeVinculado = variavelDoElemento(elemento)
  if (nomeVinculado === null) {
    problemas.push({
      codigo: 'variavel_nao_atribuida',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `elemento '${elemento.id}' (${elemento.tipo}) em ${onde} está sem variável atribuída — vincule uma variável a esse elemento`,
    })
    return problemas
  }

  const variavel = diagrama.variaveis.find((v) => v.nome === nomeVinculado)
  if (variavel === undefined) {
    problemas.push({
      codigo: 'variavel_inexistente',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `elemento '${elemento.id}' (${elemento.tipo}) em ${onde} referencia a variável '${nomeVinculado}', que não existe`,
    })
    return problemas
  }

  // ehTerminal (não só ehBobina) para que o CTU também caia nesta regra: sua
  // `saida` é escrita por ele como uma bobina escreve a própria variável (D-7).
  if (ehTerminal(elemento.tipo) && variavel.endereco !== undefined && ehEntrada(variavel.endereco)) {
    const rotulo = ehBloco(elemento) ? 'bloco' : 'bobina'
    const rotuloPlural = ehBloco(elemento) ? 'blocos' : 'bobinas'
    problemas.push({
      codigo: 'bobina_escreve_entrada',
      severidade: 'erro',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `${rotulo} '${elemento.id}' em ${onde} escreve em '${variavel.nome}' (${variavel.endereco}), que é uma entrada — ${rotuloPlural} não podem escrever em entradas`,
    })
  }

  return problemas
}

// -- Q-6 (D-10): bobina_duplicada e set_reset_autodependente -------------

/** Todo elemento do diagrama, junto do índice do degrau (1-based nas
 * mensagens) e do `Rung` a que pertence — usado pelas duas checagens da Q-6,
 * que precisam olhar o diagrama inteiro, não um rung por vez. */
function todosElementos(diagrama: Diagrama): Array<{ indiceDegrau: number; rung: Rung; elemento: Elemento }> {
  const resultado: Array<{ indiceDegrau: number; rung: Rung; elemento: Elemento }> = []
  diagrama.rungs.forEach((rung, indiceDegrau) => {
    for (const elemento of rung.elementos) {
      resultado.push({ indiceDegrau, rung, elemento })
    }
  })
  return resultado
}

/**
 * `bobina_duplicada` (erro, D-10/Q-6): duas ou mais **escritas simples** —
 * bobina simples (`tipo: 'bobina'`) ou `saida` de CTU (D-7: o CTU escreve a
 * própria variável de saída da mesma forma incondicional que uma bobina
 * simples, então conta como a mesma categoria) — vinculadas à mesma
 * variável, em qualquer degrau do diagrama. A decisão de Q-6 trata isso como
 * erro estrutural (a última escrita do ciclo prevalece, e a spec recusa a
 * ambiguidade por objetivo didático): dois CTUs com a mesma `saida`, ou um
 * CTU e uma bobina simples na mesma variável, caem aqui. SET e RESET não
 * contam como duplicata: são o idioma normal de trava e é esperado que
 * apareçam repetidos para a mesma variável.
 *
 * Gera um `Problema` para **cada** elemento do grupo (não um só para o grupo
 * inteiro), com a mensagem apontando as demais posições envolvidas.
 */
function validarBobinasDuplicadas(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  const escritasSimples = todosElementos(diagrama).filter(
    ({ elemento }) => (elemento.tipo === 'bobina' || ehBloco(elemento)) && variavelDoElemento(elemento) !== null,
  )

  const porVariavel = new Map<string, typeof escritasSimples>()
  for (const item of escritasSimples) {
    const nome = variavelDoElemento(item.elemento) as string
    const grupo = porVariavel.get(nome)
    if (grupo) grupo.push(item)
    else porVariavel.set(nome, [item])
  }

  for (const [nome, grupo] of porVariavel) {
    if (grupo.length < 2) continue
    for (const item of grupo) {
      const outras = grupo
        .filter((outro) => outro.elemento.id !== item.elemento.id)
        .map((outro) => descreverCelula(outro.indiceDegrau, outro.elemento.celula))
        .join('; ')
      const rotulo = ehBloco(item.elemento) ? 'bloco' : 'bobina'
      problemas.push({
        codigo: 'bobina_duplicada',
        severidade: 'erro',
        rungId: item.rung.id,
        elementoId: item.elemento.id,
        mensagem: `${rotulo} '${item.elemento.id}' em ${descreverCelula(item.indiceDegrau, item.elemento.celula)} escreve em '${nome}', já escrita por outra bobina/contador em ${outras} — escritas simples duplicadas na mesma variável são erro estrutural (Q-6)`,
      })
    }
  }

  return problemas
}

/**
 * `set_reset_autodependente` (aviso, D-10/Q-6): existe um SET e um RESET da
 * mesma variável no diagrama, e pelo menos um dos dois tem, no seu próprio
 * caminho até a bobina, um contato (NA ou NF) vinculado a essa mesma
 * variável.
 *
 * **Leitura adotada para "caminho"** (D-10 não define o termo — a leitura
 * abaixo é a mais abrangente que não exige simular o circuito, fora do escopo
 * deste arquivo, ver cabeçalho): como todo degrau tem no máximo uma bobina, e
 * ela só existe em (linha 0, `COLUNA_TERMINAL` — `posicaoValida`), qualquer
 * elemento do degrau (trilho principal ou ramo) faz parte da mesma rede que
 * decide aquela bobina. "Caminho até a bobina" é, portanto, **o degrau
 * inteiro** que contém o SET ou o RESET: um contato da própria variável em
 * qualquer posição desse degrau já conta como autodependência — sem
 * distinguir, dentro do degrau, se esse contato está de fato em série com a
 * bobina ou isolado num ramo sem ligação nenhuma. É deliberadamente mais
 * abrangente do que uma análise exata de circuito, para não deixar passar um
 * caso real por falta de simulação.
 *
 * Caso negativo obrigatório (exigido pela tarefa #11): um par SET/RESET cuja
 * condição não cita a própria variável (ex.: acionados por um botão) não gera
 * aviso nenhum.
 */
function validarSetResetAutodependente(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  const todos = todosElementos(diagrama)

  const nomesComSet = new Set(
    todos
      .filter(({ elemento }) => elemento.tipo === 'bobina_set' && variavelDoElemento(elemento) !== null)
      .map(({ elemento }) => variavelDoElemento(elemento) as string),
  )
  const nomesComReset = new Set(
    todos
      .filter(({ elemento }) => elemento.tipo === 'bobina_reset' && variavelDoElemento(elemento) !== null)
      .map(({ elemento }) => variavelDoElemento(elemento) as string),
  )

  for (const { indiceDegrau, rung, elemento } of todos) {
    if (elemento.tipo !== 'bobina_set' && elemento.tipo !== 'bobina_reset') continue
    const nome = variavelDoElemento(elemento)
    if (nome === null) continue
    if (!nomesComSet.has(nome) || !nomesComReset.has(nome)) continue

    const contatoDaVariavel = rung.elementos.find((outro) => ehContato(outro.tipo) && variavelDoElemento(outro) === nome)
    if (contatoDaVariavel === undefined) continue

    const rotulo = elemento.tipo === 'bobina_set' ? 'SET' : 'RESET'
    problemas.push({
      codigo: 'set_reset_autodependente',
      severidade: 'aviso',
      rungId: rung.id,
      elementoId: elemento.id,
      mensagem: `bobina ${rotulo} '${elemento.id}' em ${descreverCelula(indiceDegrau, elemento.celula)} depende da própria variável '${nome}': há um contato de '${nome}' no mesmo degrau, em ${descreverCelula(indiceDegrau, contatoDaVariavel.celula)} — SET/RESET que leem a variável que eles mesmos escrevem podem se anular no mesmo ciclo`,
    })
  }

  return problemas
}

/**
 * Varre um `Diagrama` montado e devolve todos os problemas encontrados. Não
 * para no primeiro: um diagrama em edição costuma ter vários ao mesmo tempo.
 */
export function validarDiagrama(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = [
    ...validarEnderecosDasVariaveis(diagrama),
    ...validarBobinasDuplicadas(diagrama),
    ...validarSetResetAutodependente(diagrama),
    ...problemasDoBloco(diagrama),
  ]

  diagrama.rungs.forEach((rung, indiceDegrau) => {
    for (const elemento of rung.elementos) {
      problemas.push(...validarElemento(indiceDegrau, rung, elemento, diagrama))
    }

    if (!rungAindaNaoComecado(rung) && !temTerminalNoTrilho(rung)) {
      problemas.push({
        codigo: 'rung_incompleto',
        severidade: 'erro',
        rungId: rung.id,
        elementoId: null,
        mensagem: `degrau ${indiceDegrau + 1} sem nenhuma bobina (nem bloco de função) — todo degrau precisa terminar numa bobina ou num bloco, na coluna ${COLUNA_TERMINAL + 1}`,
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
