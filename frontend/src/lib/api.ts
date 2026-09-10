/** Cliente HTTP do serviço de compilação. */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface Iec2cInfo {
  available: boolean
  path: string
  version: string | null
}

export interface Health {
  status: string
  iec2c: Iec2cInfo
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch(`${BASE_URL}/health`)
  if (!response.ok) {
    throw new Error(`A API respondeu ${response.status}`)
  }
  return (await response.json()) as Health
}
