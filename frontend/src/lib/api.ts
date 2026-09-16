/** Cliente HTTP do serviço de compilação. */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Estado de uma das duas etapas externas de compilação. */
export interface ToolInfo {
  available: boolean
  path: string
  version: string | null
}

export interface Health {
  status: string
  /** MATIEC: Structured Text → C ANSI. */
  iec2c: ToolInfo
  /** ESP-IDF: C ANSI → firmware do ESP32. */
  esp_idf: ToolInfo
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch(`${BASE_URL}/health`)
  if (!response.ok) {
    throw new Error(`A API respondeu ${response.status}`)
  }
  return (await response.json()) as Health
}

// --- Contrato de POST /compile e POST /compile/pacote (spec 001, Q-3) -----

/** Um item de `diagnostics` no envelope de erro. `line`/`column` podem ser `null`. */
export interface Diagnostico {
  file: string
  line: number | null
  column: number | null
  severity: string
  message: string
}

/** Saída bruta e íntegra da etapa que falhou — nunca é recortada. */
export interface Raw {
  stdout: string
  stderr: string
}

/** `stage` diz em qual camada o processo parou (revisão de Q-3: inclui `"request"`). */
export type Estagio = 'request' | 'matiec' | 'esp32'

export type CodigoErro = 'compile_error' | 'toolchain_error' | 'timeout' | 'payload_too_large'

/** Envelope de erro estável da spec 001 (Q-3). */
export interface Envelope {
  stage: Estagio
  code: CodigoErro
  message: string
  diagnostics: Diagnostico[]
  raw: Raw
}

/** Uma das três imagens do pacote (`bootloader`, `partition-table`, `app`). */
export interface ImagemPacote {
  name: string
  /** Offset absoluto na flash, vindo do `flasher_args.json` — nunca de constante. */
  offset: number
  size: number
  sha256: string
  /** Conteúdo binário da imagem, em base64. */
  data_base64: string
}

export interface ConfiguracaoFlash {
  mode: string
  freq: string
  size: string
}

/** Corpo de sucesso de `POST /compile/pacote`. `images` vem em ordem crescente de offset. */
export interface Pacote {
  chip: string
  flash: ConfiguracaoFlash
  images: ImagemPacote[]
}

/**
 * Erro de compilação com o envelope estruturado (Q-3): a API respondeu um
 * status não-2xx *com* o corpo no formato esperado.
 */
export class ErroCompilacao extends Error {
  readonly envelope: Envelope
  readonly status: number

  constructor(envelope: Envelope, status: number) {
    super(envelope.message)
    this.name = 'ErroCompilacao'
    this.envelope = envelope
    this.status = status
  }
}

/**
 * A API respondeu um status não-2xx, mas o corpo não é o envelope Q-3 — por
 * exemplo o `{"detail": [...]}` padrão do FastAPI para um JSON malformado
 * (422 genérico, fora do contrato do serviço de compilação).
 */
export class ErroHttpCompilacao extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ErroHttpCompilacao'
    this.status = status
  }
}

/** Falha de rede: a requisição nem chegou a obter uma resposta da API. */
export class ErroRedeCompilacao extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroRedeCompilacao'
  }
}

function ehDiagnostico(valor: unknown): valor is Diagnostico {
  if (typeof valor !== 'object' || valor === null) return false
  const d = valor as Record<string, unknown>
  return (
    typeof d.file === 'string' &&
    (typeof d.line === 'number' || d.line === null) &&
    (typeof d.column === 'number' || d.column === null) &&
    typeof d.severity === 'string' &&
    typeof d.message === 'string'
  )
}

/** Confere em tempo de execução se `corpo` tem o formato do envelope Q-3. */
function ehEnvelope(corpo: unknown): corpo is Envelope {
  if (typeof corpo !== 'object' || corpo === null) return false
  const e = corpo as Record<string, unknown>
  if (typeof e.stage !== 'string' || typeof e.code !== 'string' || typeof e.message !== 'string') {
    return false
  }
  if (!Array.isArray(e.diagnostics) || !e.diagnostics.every(ehDiagnostico)) return false
  const raw = e.raw as Record<string, unknown> | undefined
  return typeof raw === 'object' && raw !== null && typeof raw.stdout === 'string' && typeof raw.stderr === 'string'
}

/**
 * Executa `POST <caminho>` com `{"source": ...}` e devolve a `Response` em
 * caso de sucesso (2xx). Nos demais casos, lança:
 * - `ErroCompilacao`, quando o corpo da resposta é o envelope Q-3;
 * - `ErroHttpCompilacao`, quando a resposta não é 2xx mas não traz o envelope;
 * - `ErroRedeCompilacao`, quando a requisição falha antes de obter resposta.
 */
async function compilar(caminho: string, source: string): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
  } catch (erro) {
    throw new ErroRedeCompilacao(
      `Não foi possível contatar o serviço de compilação: ${erro instanceof Error ? erro.message : String(erro)}`,
    )
  }

  if (response.ok) return response

  let corpo: unknown
  try {
    corpo = await response.json()
  } catch {
    corpo = undefined
  }

  if (ehEnvelope(corpo)) {
    throw new ErroCompilacao(corpo, response.status)
  }

  throw new ErroHttpCompilacao(response.status, `A API respondeu ${response.status} sem o envelope de erro esperado.`)
}

/** `POST /compile`: devolve o `.bin` da aplicação como `Blob`. */
export async function compilarBinario(source: string): Promise<Blob> {
  const response = await compilar('/compile', source)
  return await response.blob()
}

/** `POST /compile/pacote`: devolve as três imagens da flash com seus offsets. */
export async function compilarPacote(source: string): Promise<Pacote> {
  const response = await compilar('/compile/pacote', source)
  return (await response.json()) as Pacote
}
