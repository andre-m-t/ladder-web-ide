/**
 * Projeto de linguagem única (Ladder ou ST) — spec 002, tarefa #26.
 *
 * Até aqui a IDE mostrava Ladder e ST lado a lado, nas mesmas abas. A partir
 * desta tarefa a IDE trabalha com um **projeto**: o autor escolhe a linguagem
 * em "Novo projeto" e o projeto guarda só o conteúdo dessa linguagem — um
 * `Diagrama` para `ld`, uma `fonte` de texto para `st`. O isolamento existe
 * para as duas linguagens não conflitarem na compilação (o `iec2c` só existe
 * para ST; um diagrama Ladder é convertido para ST antes de chegar lá — spec
 * 002, plano) nem na tela: não há mais alternância de aba dentro de um mesmo
 * projeto, só troca de projeto.
 *
 * Persistência em `Storage` (injetado, como em `../ladder/persistencia.ts`,
 * para os testes usarem um `Storage` falso em memória sem depender de jsdom),
 * chave `ladderflow:projeto`, envelope na própria forma de `Projeto` (já leva
 * `versao`). `carregarProjeto` nunca lança exceção e nunca falha em
 * silêncio: formato desconhecido vira projeto Ladder vazio "Sem título" mais
 * um aviso em português explicando o descarte — mesma política de
 * `carregarDiagrama`. Quando não há `ladderflow:projeto` mas existe a chave
 * antiga `ladderflow:diagrama` (de antes desta tarefa, um só diagrama Ladder
 * sem conceito de projeto), o diagrama salvo é migrado para um projeto
 * Ladder "Sem título" automaticamente, e só então a chave antiga é removida.
 *
 * Código autoral do projeto.
 */

import { diagramaVazio } from '../ladder/edicao'
import type { Diagrama } from '../ladder/modelo'
import {
  CHAVE_DIAGRAMA,
  carregarDiagrama,
  diagramaEstruturalmenteValido,
  migrarDiagramaParaV2,
} from '../ladder/persistencia'

/** Linguagem única de um projeto. */
export type Linguagem = 'ld' | 'st'

/** Um projeto guarda o conteúdo de uma única linguagem — nunca as duas. */
export type Projeto =
  | { versao: 1; titulo: string; linguagem: 'ld'; diagrama: Diagrama }
  | { versao: 1; titulo: string; linguagem: 'st'; fonte: string }

/** Chave única do projeto em `Storage`. */
export const CHAVE_PROJETO = 'ladderflow:projeto'

/** Versão do envelope gravado — a única aceita na carga por enquanto. */
const VERSAO_PROJETO = 1

/** Título de todo projeto novo, até o autor renomear. */
export const TITULO_PADRAO = 'Sem título'

/**
 * Programa ST mínimo de um projeto novo em branco: `PROGRAM` com um bloco
 * `VAR` de exemplo (comentado, para o estudante substituir) e a
 * `CONFIGURATION`/`RESOURCE`/`TASK`/instância que o `iec2c` exige para
 * compilar, no mesmo formato estrutural de
 * `backend/tests/fixtures/minimal.st`. Verificado com o `iec2c` da imagem
 * `ladderflow-backend:dev` (`iec2c -f -I /usr/local/share/matiec/lib`):
 * compila com sucesso.
 */
export const ESQUELETO_ST = `(* Programa Structured Text (IEC 61131-3) de um projeto novo em branco.
   Declare aqui as variaveis do programa: localizadas, ligadas a um pino do
   controlador (ex.: "led AT %QX0.0 : BOOL;"), ou internas, sem pino (ex.:
   "contador : UINT;"). A logica do programa fica entre o END_VAR e o
   END_PROGRAM -- troque a linha de exemplo abaixo pelo seu codigo.
   Sem acentos: mantem o arquivo em ASCII puro para o compilador. *)

PROGRAM prog0
  VAR
    exemplo : BOOL;
  END_VAR

  exemplo := exemplo; (* linha de exemplo -- substitua pela logica do seu programa *)
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
`

/** Cria um projeto novo na `linguagem` dada, com `titulo` aparado (espaços
 * nas pontas removidos). LD começa com `diagramaVazio()`; ST começa com
 * `ESQUELETO_ST`. Não valida o título — use `validarTitulo` antes, se for
 * preciso recusar título inválido na UI. */
export function novoProjeto(titulo: string, linguagem: Linguagem): Projeto {
  const tituloAparado = titulo.trim()
  if (linguagem === 'ld') {
    return { versao: VERSAO_PROJETO, titulo: tituloAparado, linguagem: 'ld', diagrama: diagramaVazio() }
  }
  return { versao: VERSAO_PROJETO, titulo: tituloAparado, linguagem: 'st', fonte: ESQUELETO_ST }
}

/** Projeto Ladder vazio "Sem título" — o padrão de quando não há nada (ainda)
 * para carregar, e a base de todo descarte em `carregarProjeto`. */
function projetoVazioPadrao(): Projeto {
  return novoProjeto(TITULO_PADRAO, 'ld')
}

/** Valida um título de projeto: aparado, de 1 a 60 caracteres. Devolve o
 * motivo da recusa em português, ou `null` quando o título é válido. */
export function validarTitulo(titulo: string): string | null {
  const aparado = titulo.trim()
  if (aparado.length === 0) {
    return 'título não pode ficar em branco'
  }
  if (aparado.length > 60) {
    return `título muito longo (${aparado.length} caracteres) — no máximo 60`
  }
  return null
}

/** True se `projeto` já tem algum conteúdo além do que `novoProjeto` cria.
 * LD: algum degrau com elemento ou ramo, ou variável declarada, ou mais de um
 * degrau. ST: a fonte foi alterada em relação a `ESQUELETO_ST`. */
export function projetoTemConteudo(projeto: Projeto): boolean {
  if (projeto.linguagem === 'st') {
    return projeto.fonte.trim() !== ESQUELETO_ST.trim()
  }

  const { diagrama } = projeto
  if (diagrama.variaveis.length > 0) return true
  if (diagrama.rungs.length > 1) return true
  return diagrama.rungs.some((rung) => rung.elementos.length > 0 || rung.ramos.length > 0)
}

export type ResultadoCargaProjeto = { projeto: Projeto; aviso: string | null; veioDoArmazenamento: boolean }

/** Projeto Ladder vazio "Sem título" mais um aviso explicando o descarte —
 * o caminho comum de todo formato salvo que não dá para confiar. */
function descartado(motivo: string): ResultadoCargaProjeto {
  return { projeto: projetoVazioPadrao(), aviso: `projeto salvo descartado: ${motivo}`, veioDoArmazenamento: false }
}

/** Checa a forma de um valor recém-desserializado como `Projeto`: versão
 * conhecida, título string, e o conteúdo da linguagem declarada (`diagrama`
 * estruturalmente válido para `ld`, pela mesma regra de
 * `../ladder/persistencia.ts`; `fonte` string para `st`). Devolve o motivo da
 * recusa em português, ou `null` quando o valor é um `Projeto` confiável. */
function motivoProjetoInvalido(valor: unknown): string | null {
  if (typeof valor !== 'object' || valor === null) {
    return 'o conteúdo salvo não tem o formato esperado'
  }
  const p = valor as Record<string, unknown>

  if (p.versao !== VERSAO_PROJETO) {
    return `versão salva (${JSON.stringify(p.versao)}) não é a versão suportada (${VERSAO_PROJETO})`
  }
  if (typeof p.titulo !== 'string') {
    return 'título salvo não é um texto'
  }
  if (p.linguagem === 'ld') {
    if (!diagramaEstruturalmenteValido(p.diagrama)) {
      return 'a estrutura do diagrama salvo está incompleta ou corrompida'
    }
    return null
  }
  if (p.linguagem === 'st') {
    if (typeof p.fonte !== 'string') {
      return 'fonte ST salva não é um texto'
    }
    return null
  }
  return `linguagem salva (${JSON.stringify(p.linguagem)}) desconhecida`
}

/**
 * Carrega o projeto salvo em `armazenamento`. Nunca lança exceção:
 *   1. `ladderflow:projeto` presente e válido: `{ projeto, aviso: null,
 *      veioDoArmazenamento: true }`.
 *   2. Presente e inválido: projeto Ladder "Sem título" vazio, aviso
 *      "projeto salvo descartado: <motivo>", `veioDoArmazenamento: false`.
 *   3. Ausente, mas a chave antiga `ladderflow:diagrama` presente: migra —
 *      diagrama válido vira projeto Ladder "Sem título" com esse diagrama
 *      (`veioDoArmazenamento: true`, sem aviso), grava o projeto novo e só
 *      então remove a chave antiga (se a gravação falhar, a chave antiga
 *      permanece); diagrama descartado repassa o aviso de `carregarDiagrama`
 *      (projeto Ladder "Sem título" vazio, `veioDoArmazenamento: false`).
 *   4. Nada salvo: projeto Ladder "Sem título" vazio, sem aviso,
 *      `veioDoArmazenamento: false`.
 */
export function carregarProjeto(armazenamento: Storage): ResultadoCargaProjeto {
  let bruto: string | null
  try {
    bruto = armazenamento.getItem(CHAVE_PROJETO)
  } catch {
    return descartado('não foi possível ler o armazenamento local')
  }

  if (bruto !== null) {
    let valor: unknown
    try {
      valor = JSON.parse(bruto)
    } catch {
      return descartado('o conteúdo salvo não é um JSON válido')
    }

    const motivo = motivoProjetoInvalido(valor)
    if (motivo !== null) {
      return descartado(motivo)
    }
    const brutoProjeto = valor as Projeto
    if (brutoProjeto.linguagem === 'ld') {
      const diagrama = migrarDiagramaParaV2(brutoProjeto.diagrama)
      if (diagrama === null) {
        return descartado('a estrutura do diagrama salvo está incompleta ou corrompida')
      }
      return { projeto: { ...brutoProjeto, diagrama }, aviso: null, veioDoArmazenamento: true }
    }
    return { projeto: brutoProjeto, aviso: null, veioDoArmazenamento: true }
  }

  return migrarDiagramaAntigo(armazenamento)
}

/** Passo 3 de `carregarProjeto`: só chamado quando `ladderflow:projeto` não
 * está presente. Olha a chave antiga `ladderflow:diagrama` e migra. */
function migrarDiagramaAntigo(armazenamento: Storage): ResultadoCargaProjeto {
  let brutoAntigo: string | null
  try {
    brutoAntigo = armazenamento.getItem(CHAVE_DIAGRAMA)
  } catch {
    brutoAntigo = null
  }

  if (brutoAntigo === null) {
    return { projeto: projetoVazioPadrao(), aviso: null, veioDoArmazenamento: false }
  }

  const resultadoAntigo = carregarDiagrama(armazenamento)
  if (resultadoAntigo.aviso !== null) {
    // Diagrama antigo descartado: repassa o aviso, sem migrar nada.
    return { projeto: projetoVazioPadrao(), aviso: resultadoAntigo.aviso, veioDoArmazenamento: false }
  }

  const diagramaMigrado = migrarDiagramaParaV2(resultadoAntigo.diagrama)
  if (diagramaMigrado === null) {
    return { projeto: projetoVazioPadrao(), aviso: resultadoAntigo.aviso, veioDoArmazenamento: false }
  }

  const projetoMigrado: Projeto = {
    versao: VERSAO_PROJETO,
    titulo: TITULO_PADRAO,
    linguagem: 'ld',
    diagrama: diagramaMigrado,
  }
  try {
    armazenamento.setItem(CHAVE_PROJETO, JSON.stringify(projetoMigrado))
    try {
      armazenamento.removeItem(CHAVE_DIAGRAMA)
    } catch {
      // Não crítico: a chave antiga fica órfã, mas não é mais lida (o passo
      // 1 desta função já encontra `ladderflow:projeto` na próxima carga).
    }
  } catch {
    // Gravação falhou (cota, modo privado): não remove a chave antiga, para
    // não perder o único registro do diagrama. Esta carga, ainda assim,
    // devolve o projeto migrado em memória.
  }

  return { projeto: projetoMigrado, aviso: null, veioDoArmazenamento: true }
}

/**
 * Grava `projeto` em `armazenamento`. Devolve `null` quando a gravação deu
 * certo, ou um aviso em português quando o navegador recusou (cota
 * excedida, modo privado) — nunca lança exceção.
 */
export function salvarProjeto(armazenamento: Storage, projeto: Projeto): string | null {
  try {
    armazenamento.setItem(CHAVE_PROJETO, JSON.stringify(projeto))
    return null
  } catch {
    return 'não foi possível salvar o projeto no armazenamento local (cota excedida ou navegação privada)'
  }
}
