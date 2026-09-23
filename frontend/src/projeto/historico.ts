/** Pilha de desfazer/refazer para o estado do projeto (diagrama + variáveis). */

export interface Historico<T> {
  passado: T[]
  presente: T
  futuro: T[]
}

const LIMITE = 100

export function criarHistorico<T>(presente: T): Historico<T> {
  return { passado: [], presente, futuro: [] }
}

function mesmoValor<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function registrar<T>(historico: Historico<T>, novo: T): Historico<T> {
  if (mesmoValor(historico.presente, novo)) return historico
  const passado = [...historico.passado, historico.presente]
  if (passado.length > LIMITE) passado.shift()
  return { passado, presente: novo, futuro: [] }
}

export function desfazer<T>(historico: Historico<T>): Historico<T> | null {
  if (historico.passado.length === 0) return null
  const passado = [...historico.passado]
  const anterior = passado.pop() as T
  return {
    passado,
    presente: anterior,
    futuro: [historico.presente, ...historico.futuro],
  }
}

export function refazer<T>(historico: Historico<T>): Historico<T> | null {
  if (historico.futuro.length === 0) return null
  const futuro = [...historico.futuro]
  const proximo = futuro.shift() as T
  return {
    passado: [...historico.passado, historico.presente],
    presente: proximo,
    futuro,
  }
}

export function podeDesfazer(historico: Historico<unknown>): boolean {
  return historico.passado.length > 0
}

export function podeRefazer(historico: Historico<unknown>): boolean {
  return historico.futuro.length > 0
}
