// Validacao estrutural do modelo de grade (spikes/modelo/modelo.ts).
//
// Duas camadas, deliberadamente separadas:
//
//   - `posicaoValida` responde "essa celula aceita esse tipo de elemento
//     AGORA?" -- e a pergunta que uma UI de edicao faz a cada clique, antes
//     de inserir o elemento. Nao sabe nada sobre o diagrama inteiro.
//   - `validarDiagrama` varre um Diagrama JA MONTADO e devolve todos os
//     problemas encontrados, com codigo, rung e elemento -- e a pergunta que
//     um "salvar" ou um teste faz sobre o resultado final.
//
// O que este arquivo NAO faz: simular o circuito (isso e F9, o simulador de
// ciclo de varredura). Um rung "estruturalmente completo" aqui (sem buraco
// de coluna) pode ainda assim ter uma combinacao logica de contatos que
// nunca energiza a bobina -- essa e uma pergunta semantica, nao estrutural,
// e fica fora do escopo deste spike (ver NOTAS.md, "O que a validacao NAO
// cobre").

import type { Celula, Diagrama, Elemento, Ramo, Rung, TipoBobina, TipoContato, Variavel } from './modelo'

// -- Codigos de problema ----------------------------------------------------

export type CodigoProblema =
  | 'rung_incompleto'
  | 'variavel_nao_atribuida'
  | 'variavel_inexistente'
  | 'posicao_invalida'
  | 'endereco_mal_formado'
  | 'bobina_escreve_entrada'

export interface Problema {
  codigo: CodigoProblema
  rungId: string
  elementoId: string | null
  mensagem: string
}

// -- posicaoValida ------------------------------------------------------

const TIPOS_BOBINA: readonly TipoBobina[] = ['bobina', 'bobina_set', 'bobina_reset']
const TIPOS_CONTATO: readonly TipoContato[] = ['contato_na', 'contato_nf']

function ehBobina(tipo: string): tipo is TipoBobina {
  return (TIPOS_BOBINA as readonly string[]).includes(tipo)
}

function ehContato(tipo: string): tipo is TipoContato {
  return (TIPOS_CONTATO as readonly string[]).includes(tipo)
}

/** True se `celula` cai dentro do intervalo `[colunaInicio, colunaFim)` de algum ramo na mesma linha. */
function dentroDeAlgumRamo(ramos: readonly Ramo[], celula: Celula): boolean {
  return ramos.some(
    (ramo) =>
      ramo.linha === celula.linha &&
      celula.coluna >= ramo.colunaInicio &&
      celula.coluna < ramo.colunaFim,
  )
}

/** True se nenhum elemento de `rung` ja ocupa `celula`. */
function celulaLivre(rung: Rung, celula: Celula): boolean {
  return !rung.elementos.some(
    (elemento) => elemento.celula.linha === celula.linha && elemento.celula.coluna === celula.coluna,
  )
}

/**
 * Uma celula aceita `tipo` em `rung` agora?
 *
 * Regras (decisoes de modelagem, justificadas em NOTAS.md):
 *   - bobinas (`bobina`, `bobina_set`, `bobina_reset`) so na ULTIMA coluna,
 *     na linha 0 (trilho principal) -- nunca em ramo.
 *   - contatos (`contato_na`, `contato_nf`) em qualquer coluna ANTES da
 *     ultima, na linha 0 ou dentro do intervalo de um Ramo declarado.
 *   - `ctu` fica na linha 0, em qualquer coluna ATE a ultima (inclusive):
 *     pode ser um elemento "antes da bobina" (alimenta contatos seguintes,
 *     via a variavel de `saida`) ou pode ele mesmo ocupar a ultima coluna,
 *     fechando o rung -- e o unico elemento, alem da bobina, que sabe
 *     escrever uma variavel (`saida`), entao pode terminar um rung sozinho.
 *   - fora desses casos (linha > 0 sem Ramo que a cubra, coluna fora de
 *     `[0, colunas)`, celula ja ocupada): invalido.
 */
export function posicaoValida(
  rung: Rung,
  tipo: TipoContato | TipoBobina | 'ctu',
  celula: Celula,
): boolean {
  if (celula.linha < 0 || celula.coluna < 0 || celula.coluna >= rung.colunas) return false
  if (!celulaLivre(rung, celula)) return false
  if (celula.linha > 0 && !dentroDeAlgumRamo(rung.ramos, celula)) return false

  if (ehBobina(tipo)) {
    return celula.linha === 0 && celula.coluna === rung.colunas - 1
  }
  if (tipo === 'ctu') {
    return celula.linha === 0
  }
  if (ehContato(tipo)) {
    return celula.coluna < rung.colunas - 1
  }
  return false
}

// -- validarDiagrama ---------------------------------------------------

const REGEX_ENDERECO_BOOL = /^%[IQ]X\d+\.\d+$/
const REGEX_ENDERECO_UINT = /^%[IQ][WD]\d+$/

/** Formato aceito para `endereco`: depende do `tipo` da variavel (ver README/NOTAS). */
function enderecoBemFormado(variavel: Variavel): boolean {
  if (variavel.endereco === undefined) return true
  return variavel.tipo === 'BOOL'
    ? REGEX_ENDERECO_BOOL.test(variavel.endereco)
    : REGEX_ENDERECO_UINT.test(variavel.endereco)
}

function escreveEmEntrada(variavel: Variavel): boolean {
  return variavel.endereco !== undefined && /^%I/.test(variavel.endereco)
}

/** `rung` sem `elemento` -- usado para reavaliar a posicao de um elemento ja
 * colocado sem que ele conflite com a propria celula em `celulaLivre`. */
function rungSemElemento(rung: Rung, elementoId: string): Rung {
  return { ...rung, elementos: rung.elementos.filter((e) => e.id !== elementoId) }
}

function tipoDePosicionamento(elemento: Elemento): TipoContato | TipoBobina | 'ctu' {
  return elemento.tipo
}

/**
 * Varre um Diagrama montado e devolve todos os problemas encontrados.
 *
 * Nao para no primeiro erro: um diagrama pode (e costuma, enquanto o autor
 * ainda esta editando) ter varios problemas ao mesmo tempo. Cada `Problema`
 * aponta `rungId` e, quando aplicavel, `elementoId` -- suficiente para uma UI
 * destacar o ponto exato, sem o chamador precisar re-varrer o diagrama.
 */
export function validarDiagrama(diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  const variaveisPorNome = new Map(diagrama.variaveis.map((v) => [v.nome, v]))

  for (const variavel of diagrama.variaveis) {
    if (!enderecoBemFormado(variavel)) {
      problemas.push({
        codigo: 'endereco_mal_formado',
        rungId: '',
        elementoId: null,
        mensagem: `variavel '${variavel.nome}': endereco mal formado: '${variavel.endereco}'`,
      })
    }
  }

  for (const rung of diagrama.rungs) {
    for (const elemento of rung.elementos) {
      // posicao_invalida: reavalia contra o rung SEM o proprio elemento, senao
      // `celulaLivre` sempre reprovaria (a celula esta ocupada por ele mesmo).
      const semEste = rungSemElemento(rung, elemento.id)
      if (!posicaoValida(semEste, tipoDePosicionamento(elemento), elemento.celula)) {
        problemas.push({
          codigo: 'posicao_invalida',
          rungId: rung.id,
          elementoId: elemento.id,
          mensagem: `elemento '${elemento.id}' (${elemento.tipo}) em posicao invalida ` +
            `(linha=${elemento.celula.linha}, coluna=${elemento.celula.coluna})`,
        })
      }

      if (elemento.tipo === 'ctu') {
        if (elemento.saida !== null && !variaveisPorNome.has(elemento.saida)) {
          problemas.push({
            codigo: 'variavel_inexistente',
            rungId: rung.id,
            elementoId: elemento.id,
            mensagem: `ctu '${elemento.id}': saida referencia variavel inexistente '${elemento.saida}'`,
          })
        }
        continue
      }

      // contato ou bobina: usam `variavel`.
      if (elemento.variavel === null) {
        if (ehBobina(elemento.tipo)) {
          problemas.push({
            codigo: 'variavel_nao_atribuida',
            rungId: rung.id,
            elementoId: elemento.id,
            mensagem: `bobina '${elemento.id}' sem variavel atribuida`,
          })
        }
        continue
      }

      const variavel = variaveisPorNome.get(elemento.variavel)
      if (variavel === undefined) {
        problemas.push({
          codigo: 'variavel_inexistente',
          rungId: rung.id,
          elementoId: elemento.id,
          mensagem: `elemento '${elemento.id}' referencia variavel inexistente '${elemento.variavel}'`,
        })
        continue
      }

      if (ehBobina(elemento.tipo) && escreveEmEntrada(variavel)) {
        problemas.push({
          codigo: 'bobina_escreve_entrada',
          rungId: rung.id,
          elementoId: elemento.id,
          mensagem: `bobina '${elemento.id}' escreve em '${variavel.nome}' (${variavel.endereco}), que e uma entrada (%I)`,
        })
      }
    }

    problemas.push(...problemasDeCompletudeDoRung(rung))
  }

  return problemas
}

/** Elemento que "termina" um rung: uma bobina, ou um `ctu` com `saida` definida. */
function ehTerminal(elemento: Elemento): boolean {
  if (ehBobina(elemento.tipo)) return true
  return elemento.tipo === 'ctu' && elemento.saida !== null
}

/**
 * `rung_incompleto`: dois casos.
 *
 *   1. Sem bobina (nem `ctu` com saida) na ultima coluna, linha 0 -- o rung
 *      nao escreve nada, nao faz nada observavel.
 *   2. "Buraco": mesmo com um terminal na ultima coluna, alguma coluna entre
 *      o trilho esquerdo (0) e o terminal nao tem elemento na linha 0 nem
 *      esta coberta por um Ramo -- o caminho eletrico nao esta fechado.
 *
 * Simplificacao deliberada (ver NOTAS.md, "O que a validacao NAO cobre"):
 * isto e uma checagem ESTRUTURAL de cobertura de coluna, nao uma avaliacao
 * booleana do circuito. Um Ramo "cobre" a coluna que ocupa mesmo que a
 * combinacao logica resultante nunca feche o caminho de verdade.
 */
function problemasDeCompletudeDoRung(rung: Rung): Problema[] {
  const ultimaColuna = rung.colunas - 1
  const terminal = rung.elementos.find(
    (e) => e.celula.linha === 0 && e.celula.coluna === ultimaColuna && ehTerminal(e),
  )

  if (terminal === undefined) {
    return [
      {
        codigo: 'rung_incompleto',
        rungId: rung.id,
        elementoId: null,
        mensagem: `rung '${rung.id}' sem bobina (nem ctu com saida) na ultima coluna (${ultimaColuna})`,
      },
    ]
  }

  const colunasNaLinhaZero = new Set(
    rung.elementos.filter((e) => e.celula.linha === 0).map((e) => e.celula.coluna),
  )
  // Uma coluna tambem conta como "coberta" se um Ramo (em qualquer linha>0)
  // a abrange -- o branch oferece um caminho paralelo aquele trecho do
  // trilho principal, independente de haver elemento na linha 0 ali.
  const colunaCobertaPorRamo = (coluna: number): boolean =>
    rung.ramos.some((ramo) => coluna >= ramo.colunaInicio && coluna < ramo.colunaFim)

  const buracos: number[] = []
  for (let coluna = 0; coluna < ultimaColuna; coluna++) {
    const coberta = colunasNaLinhaZero.has(coluna) || colunaCobertaPorRamo(coluna)
    if (!coberta) buracos.push(coluna)
  }

  if (buracos.length > 0) {
    return [
      {
        codigo: 'rung_incompleto',
        rungId: rung.id,
        elementoId: terminal.id,
        mensagem: `rung '${rung.id}': buraco no caminho entre o trilho esquerdo e a bobina, coluna(s) ${buracos.join(', ')}`,
      },
    ]
  }

  return []
}
