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
