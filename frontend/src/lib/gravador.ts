/// <reference types="w3c-web-serial" />
/**
 * Gravação do firmware no ESP32 direto do navegador, via Web Serial API.
 *
 * Wrapper fino sobre `esptool-js`: monta o `fileArray` a partir das imagens e
 * dos offsets do pacote (contrato de `POST /compile/pacote`, spec 001) e
 * traduz as falhas do protocolo esptool para uma união discriminada em
 * português. Não fala com a API de compilação — isso é `lib/api.ts`.
 */
import { ESPLoader, Transport } from 'esptool-js'
import type { FlashModeValues, FlashFreqValues, FlashSizeValues, IEspLoaderTerminal } from 'esptool-js'

import type { Pacote } from './api'

/** Taxa de transmissão usada na conexão serial com o ESP32. */
const BAUD_RATE = 115200

// --- Dependências injetáveis (testabilidade) -------------------------------

/** Só o que `gravar` precisa da porta serial, para dar de exemplo em testes sem um `SerialPort` real. */
export interface PortaLike {
  addEventListener?(type: 'disconnect', listener: (ev: Event) => void): void
  removeEventListener?(type: 'disconnect', listener: (ev: Event) => void): void
}

/** Só o que `gravar` precisa de `navigator.serial`. */
export interface SerialLike {
  requestPort(): Promise<PortaLike>
}

/** Só o que `gravar` precisa de um `ESPLoader` — permite injetar um carregador falso nos testes. */
export interface LoaderLike {
  main(): Promise<string>
  writeFlash(options: {
    fileArray: { data: Uint8Array; address: number }[]
    flashMode: FlashModeValues
    flashFreq: FlashFreqValues
    flashSize: FlashSizeValues
    eraseAll: boolean
    compress: boolean
    reportProgress?: (fileIndex: number, written: number, total: number) => void
  }): Promise<void>
  after(mode?: 'hard_reset'): Promise<void>
  transport: { disconnect(): Promise<void> }
}

export interface OpcoesGravacao {
  /** Progresso agregado entre as imagens, de 0 a 100. */
  onProgresso?: (percentual: number) => void
  /** Linhas de log do próprio esptool-js (opcional). */
  onLog?: (linha: string) => void
  /** Substitui `navigator.serial` — usado nos testes. */
  serial?: SerialLike
  /** Substitui a construção do `ESPLoader` real — usado nos testes. */
  criarLoader?: (transport: Transport, terminal: IEspLoaderTerminal) => LoaderLike
}

// --- Erros -------------------------------------------------------------

export type TipoErroGravacao =
  | 'sem_web_serial'
  | 'porta_nao_selecionada'
  | 'falha_conexao'
  | 'porta_desconectada'
  | 'falha_gravacao'

const MENSAGENS: Record<TipoErroGravacao, string> = {
  sem_web_serial:
    'Este navegador não tem suporte à Web Serial API. Use Chrome ou Edge 89+ em localhost ou por HTTPS para gravar pelo navegador.',
  porta_nao_selecionada: 'Nenhuma porta serial foi selecionada. Escolha o ESP32 no diálogo do navegador para gravar.',
  falha_conexao:
    'Não foi possível conectar ao ESP32. Verifique o cabo USB e, se persistir, segure o botão BOOT da placa durante a gravação.',
  porta_desconectada: 'A porta serial foi desconectada durante a gravação. Reconecte o ESP32 e tente novamente.',
  falha_gravacao: 'Falha ao gravar o firmware no ESP32. Veja os detalhes técnicos abaixo e tente novamente.',
}

/** Erro de `gravar`, classificado por `tipo` (união discriminada). */
export class ErroGravacao extends Error {
  readonly tipo: TipoErroGravacao
  readonly causa?: unknown

  constructor(tipo: TipoErroGravacao, causa?: unknown) {
    super(MENSAGENS[tipo])
    this.name = 'ErroGravacao'
    this.tipo = tipo
    this.causa = causa
  }
}

// --- API pública ---------------------------------------------------------

/** `true` se o navegador expõe `navigator.serial` (Chrome/Edge 89+, contexto seguro). */
export function webSerialDisponivel(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && Boolean((navigator as Navigator).serial)
}

function ehErroDeDesconexao(erro: unknown): boolean {
  if (erro instanceof DOMException && erro.name === 'NetworkError') return true
  if (erro instanceof Error) {
    return /disconnect|desconnect|device has been lost/i.test(erro.message)
  }
  return false
}

function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i)
  }
  return bytes
}

/**
 * Grava `pacote` no ESP32 selecionado pelo usuário.
 *
 * Fluxo: `requestPort` → `Transport` → `ESPLoader.main()` → `writeFlash` (com
 * `fileArray` montado dos offsets do pacote) → `after('hard_reset')` →
 * `transport.disconnect()` no `finally`, mesmo em caso de erro.
 */
export async function gravar(pacote: Pacote, opcoes: OpcoesGravacao = {}): Promise<void> {
  const serial: SerialLike | undefined = opcoes.serial ?? (webSerialDisponivel() ? navigator.serial : undefined)
  if (!serial) {
    throw new ErroGravacao('sem_web_serial')
  }

  let porta: PortaLike
  try {
    porta = await serial.requestPort()
  } catch (erro) {
    // Cobre tanto "nenhuma porta disponível" quanto o cancelamento do
    // usuário no diálogo nativo, que a Web Serial API relata como
    // `DOMException` com `name === 'NotFoundError'`.
    throw new ErroGravacao('porta_nao_selecionada', erro)
  }

  let desconectadaDuranteGravacao = false
  const aoDesconectar = () => {
    desconectadaDuranteGravacao = true
  }
  porta.addEventListener?.('disconnect', aoDesconectar)

  const terminal: IEspLoaderTerminal = {
    clean: () => {},
    write: (linha) => opcoes.onLog?.(linha),
    writeLine: (linha) => opcoes.onLog?.(linha),
  }

  // A porta injetável (`PortaLike`) não precisa satisfazer o `SerialPort`
  // completo do DOM — só o que `gravar` de fato usa (o evento `disconnect`).
  // O `Transport`/`ESPLoader` reais só são exercitados fora dos testes.
  const transport = new Transport(porta as unknown as SerialPort)
  const loader: LoaderLike = opcoes.criarLoader
    ? opcoes.criarLoader(transport, terminal)
    : new ESPLoader({ transport, baudrate: BAUD_RATE, terminal })

  try {
    try {
      await loader.main()
    } catch (erro) {
      throw new ErroGravacao('falha_conexao', erro)
    }

    const imagensOrdenadas = [...pacote.images].sort((a, b) => a.offset - b.offset)
    const fileArray = imagensOrdenadas.map((imagem) => ({
      data: base64ParaBytes(imagem.data_base64),
      address: imagem.offset,
    }))

    const pesos = fileArray.map((arquivo) => arquivo.data.length || 1)
    const pesoTotal = pesos.reduce((soma, peso) => soma + peso, 0) || 1
    const fracaoPorArquivo = new Array<number>(fileArray.length).fill(0)

    try {
      await loader.writeFlash({
        fileArray,
        flashMode: pacote.flash.mode as FlashModeValues,
        flashFreq: pacote.flash.freq as FlashFreqValues,
        flashSize: pacote.flash.size as FlashSizeValues,
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          fracaoPorArquivo[fileIndex] = total > 0 ? written / total : 1
          const progresso = fracaoPorArquivo.reduce((soma, fracao, i) => soma + fracao * pesos[i], 0) / pesoTotal
          opcoes.onProgresso?.(Math.max(0, Math.min(100, Math.round(progresso * 100))))
        },
      })
    } catch (erro) {
      if (desconectadaDuranteGravacao || ehErroDeDesconexao(erro)) {
        throw new ErroGravacao('porta_desconectada', erro)
      }
      throw new ErroGravacao('falha_gravacao', erro)
    }

    opcoes.onProgresso?.(100)

    try {
      await loader.after('hard_reset')
    } catch {
      // Reset pós-gravação é best-effort: o firmware já foi escrito na flash,
      // então uma falha aqui não desfaz a gravação — só o auto-reboot.
    }
  } finally {
    porta.removeEventListener?.('disconnect', aoDesconectar)
    try {
      await loader.transport.disconnect()
    } catch {
      // Desconectar é limpeza best-effort no finally: se a porta já caiu
      // sozinha, `disconnect()` pode falhar e isso não deve mascarar o erro
      // original lançado acima.
    }
  }
}
