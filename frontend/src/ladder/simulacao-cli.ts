/**
 * Shim de linha de comando do simulador (spec 004, RF-19; plano §5.2 e D-10).
 *
 * **CONTRATO — Etapa 0 do plano 004.** Cabeçalho publicado pelo orquestrador;
 * implementação da frente N (tarefa #4).
 *
 * É o segundo executor do arcabouço diferencial (`backend/tests/diferencial/`)
 * visto de fora: um processo que fala **exatamente** o contrato já publicado em
 * `docs/validacao/contrato-runtime-host.md`, modo padrão (endereço IEC). Por
 * isso `runner.py`, `comparador.py` e as fixtures TOML não mudam uma linha — a
 * promessa que o README daquele diretório registrou em 2026-09-15.
 *
 * Empacotado sob demanda para um `.mjs` único (esbuild) e executado por `node`
 * dentro da imagem de teste do back-end. O pacote nunca é gravado dentro do
 * repositório: vai para diretório temporário do sistema, como o binário do
 * `plc_host_runner` (`diferencial/executores.py::_construir_sob_demanda`).
 *
 * ```
 * node simulador.mjs <diagrama.json>
 *
 * stdin  : %IX0.0=1 %IX0.1=0     (uma linha por ciclo; linha vazia = sem mudança)
 * stdout : ciclo=1 %QX0.0=0 %QX0.1=0
 *          ciclo=2 %QX0.0=1 %QX0.1=0
 * código : 0 se executou todos os ciclos pedidos;
 *          != 0 com a mensagem íntegra em stderr (diagrama ilegível, diagrama
 *          recusado por erro de validação, entrada malformada)
 * ```
 *
 * Regras do formato:
 * - as saídas listadas são **todas** as variáveis com endereço `%QX`, em ordem
 *   crescente de endereço, depois daquele ciclo;
 * - o número de linhas de stdin determina quantos ciclos são executados;
 * - o shim fala endereço IEC e **não conhece GPIO** (RF-9) — a correspondência
 *   com pino é do dispositivo e não atravessa esta fronteira.
 */

import type { Diagrama, Variavel } from './modelo'
import { classeDaVariavel } from './enderecos'
import { validarDiagrama } from './validacao'
import { acionarEntrada, criarEstado, executarCiclo } from './simulacao'

// `@types/node` não é dependência deste projeto de propósito (ver o
// comentário equivalente em `serializador.dourados.test.ts`) — o pacote todo
// só existiria para tipar `process` e `node:fs` neste único arquivo. Em vez
// disso, declaramos aqui o mínimo ambiente de que este shim precisa.
//
// `process` é global (não um módulo): um `declare const` de topo, só com os
// quatro membros usados, resolve sem precisar de nenhum pacote de tipos.
declare const process: {
  argv: string[]
  exit(codigo: number): never
  stdout: { write(texto: string): void }
  stderr: { write(texto: string): void }
}

// `node:fs` É um módulo, e aqui a saída mais simples (`declare module
// 'node:fs' { ... }`) não fecha: o TypeScript trata qualquer `declare module
// '<literal>'` dentro de um arquivo que já é um módulo ES (este arquivo
// importa de `./modelo` etc.) como uma AUGMENTATION de um módulo existente,
// não como uma declaração nova — e sem `@types/node` não há módulo
// `node:fs` para aumentar (erro TS2664 "Invalid module name in
// augmentation"). A saída sem instalar nada: importar `node:fs`
// dinamicamente com um especificador que **não é um literal de string**
// (`const nomeDoModulo: string = 'node:fs'`) — o TypeScript não tenta
// resolver o tipo de um `import()` dinâmico cujo argumento não é um literal,
// então a chamada nem passa pela checagem de módulo que falha acima. O
// `esbuild` (bundle ESM/node) resolve isso em tempo de build do mesmo jeito
// que resolveria um `import` estático de `node:fs` — plataforma `node`
// nunca empacota módulos nativos, só os mantém como import externo.
interface ModuloFs {
  readFileSync(caminho: string | number, codificacao: 'utf8'): string
}

async function obterFs(): Promise<ModuloFs> {
  const nomeDoModulo: string = 'node:fs'
  return (await import(nomeDoModulo)) as ModuloFs
}

// -- Utilidades ------------------------------------------------------------

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Compara dois endereços `%IX<byte>.<bit>`/`%QX<byte>.<bit>` numericamente
 * (byte, depois bit) — não por comparação de texto, para não depender de
 * `enderecos.ts` continuar com um único dígito em cada parte. */
function compararEnderecos(a: string, b: string): number {
  const partes = (endereco: string): [number, number] => {
    const [byte, bit] = endereco.slice(3).split('.').map(Number)
    return [byte, bit]
  }
  const [byteA, bitA] = partes(a)
  const [byteB, bitB] = partes(b)
  return byteA - byteB || bitA - bitB
}

/** Variáveis do diagrama com endereço `prefixo` (`%IX` ou `%QX`), em ordem
 * crescente de endereço (RF-19/§5.2: "todas as saídas... em ordem crescente
 * de endereço"). */
function variaveisLocalizadas(diagrama: Diagrama, prefixo: '%IX' | '%QX'): Array<Variavel & { endereco: string }> {
  return diagrama.variaveis
    .filter((v): v is Variavel & { endereco: string } => v.endereco !== undefined && v.endereco.startsWith(prefixo))
    .sort((a, b) => compararEnderecos(a.endereco, b.endereco))
}

// -- Leitura do diagrama e de stdin -----------------------------------------

async function lerDiagrama(fs: ModuloFs, caminho: string): Promise<Diagrama> {
  let texto: string
  try {
    texto = fs.readFileSync(caminho, 'utf8')
  } catch (erro) {
    throw new Error(`não foi possível ler o arquivo de diagrama '${caminho}': ${mensagemDeErro(erro)}`)
  }

  let dado: unknown
  try {
    dado = JSON.parse(texto)
  } catch (erro) {
    throw new Error(`diagrama ilegível (JSON inválido) em '${caminho}': ${mensagemDeErro(erro)}`)
  }

  return dado as Diagrama
}

/** Linhas de stdin, sem a quebra de linha final artificial de um arquivo/pipe
 * bem formado (a mesma leitura de "readlines" — uma quebra à direita não é
 * uma linha vazia extra; várias, sim). Linha vazia intencional = "sem
 * mudança" (contrato §5.2). */
function lerLinhasDeEntrada(fs: ModuloFs): string[] {
  let texto: string
  try {
    texto = fs.readFileSync(0, 'utf8')
  } catch (erro) {
    throw new Error(`não foi possível ler a entrada padrão (stdin): ${mensagemDeErro(erro)}`)
  }
  if (texto === '') return []
  const semQuebraFinal = texto.endsWith('\n') ? texto.slice(0, -1) : texto
  return semQuebraFinal.split('\n').map((linha) => linha.replace(/\r$/, ''))
}

const TOKEN_ENTRADA = /^(%IX\d+\.\d+)=([01])$/

/** Interpreta uma linha de stdin (`%IX0.0=1 %IX0.1=0`) contra `diagrama`:
 * devolve as atualizações de entrada daquele ciclo (nome da variável →
 * nível), ou lança com motivo em português se a linha for malformada —
 * token fora do formato, endereço que não existe no diagrama, ou endereço de
 * uma variável que não é entrada. Linha vazia (`''`) devolve `{}` ("sem
 * mudança", contrato §5.2). */
function interpretarLinha(linha: string, numeroDaLinha: number, diagrama: Diagrama): Record<string, boolean> {
  const texto = linha.trim()
  if (texto === '') return {}

  const atualizacoes: Record<string, boolean> = {}
  for (const token of texto.split(/\s+/)) {
    const casado = TOKEN_ENTRADA.exec(token)
    if (casado === null) {
      throw new Error(
        `entrada malformada na linha ${numeroDaLinha} da entrada padrão: '${token}' não está no formato '%IX<byte>.<bit>=0|1'`,
      )
    }
    const [, endereco, valorTexto] = casado
    const variavel = diagrama.variaveis.find((v) => v.endereco === endereco)
    if (variavel === undefined) {
      throw new Error(
        `entrada malformada na linha ${numeroDaLinha} da entrada padrão: endereço '${endereco}' não corresponde a nenhuma variável do diagrama`,
      )
    }
    if (classeDaVariavel(variavel) !== 'entrada') {
      throw new Error(
        `entrada malformada na linha ${numeroDaLinha} da entrada padrão: '${endereco}' (variável '${variavel.nome}') não é uma entrada`,
      )
    }
    atualizacoes[variavel.nome] = valorTexto === '1'
  }
  return atualizacoes
}

// -- Programa principal ------------------------------------------------------

async function executar(): Promise<void> {
  const caminhoDiagrama = process.argv[2]
  if (caminhoDiagrama === undefined) {
    throw new Error('uso: node simulador.mjs <diagrama.json>')
  }

  const fs = await obterFs()
  const diagrama = await lerDiagrama(fs, caminhoDiagrama)

  const erros = validarDiagrama(diagrama).filter((p) => p.severidade === 'erro')
  if (erros.length > 0) {
    const motivos = erros.map((problema) => `- ${problema.mensagem}`).join('\n')
    throw new Error(`diagrama '${caminhoDiagrama}' recusado pela validação (RF-18):\n${motivos}`)
  }

  const linhas = lerLinhasDeEntrada(fs)
  // Interpreta e valida TODAS as linhas antes de simular o primeiro ciclo —
  // uma entrada malformada em qualquer ciclo recusa a execução inteira, sem
  // stdout parcial (código != 0, mensagem íntegra em stderr).
  const atualizacoesPorCiclo = linhas.map((linha, indice) => interpretarLinha(linha, indice + 1, diagrama))
  const saidas = variaveisLocalizadas(diagrama, '%QX')

  let estado = criarEstado(diagrama)
  const linhasDeSaida: string[] = []
  for (const atualizacoes of atualizacoesPorCiclo) {
    for (const [nome, nivel] of Object.entries(atualizacoes)) {
      const resultado = acionarEntrada(diagrama, estado, nome, nivel)
      if (!resultado.ok) {
        // Inalcançável: `interpretarLinha` já garantiu que `nome` existe e é
        // de entrada. Mantido para nunca atravessar uma recusa em silêncio.
        throw new Error(`falha inesperada ao acionar '${nome}': ${resultado.motivo}`)
      }
      estado = resultado.estado
    }

    estado = executarCiclo(diagrama, estado)
    const campos = saidas.map((v) => `${v.endereco}=${estado.variaveis[v.nome] ? '1' : '0'}`)
    linhasDeSaida.push(`ciclo=${estado.ciclo} ${campos.join(' ')}`)
  }

  if (linhasDeSaida.length > 0) {
    process.stdout.write(linhasDeSaida.join('\n') + '\n')
  }
}

// `executar` é assíncrona (a leitura de arquivo/stdin passa por
// `obterFs`/`import()` dinâmico, ver comentário acima) — o `.catch` aqui é o
// mesmo `try/catch` de qualquer recusa (JSON ilegível, diagrama recusado por
// erro de validação, entrada malformada): mensagem íntegra em stderr, código
// de saída != 0 (contrato §5.2).
executar().catch((erro: unknown) => {
  process.stderr.write(`${mensagemDeErro(erro)}\n`)
  process.exit(1)
})
