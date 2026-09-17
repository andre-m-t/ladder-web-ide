/**
 * Console de eventos do cliente (spec 002, plano D-13).
 *
 * Registro simples de mensagens que a IDE mostra sobre o que está
 * acontecendo — carga inicial e saúde do servidor, compilação, gravação. O
 * servidor de compilação continua síncrono (spec 001, Q-6): isto não é
 * streaming da saída do `iec2c`/`idf.py` (fica para uma spec futura), só os
 * eventos que o próprio cliente já observa (início, resultado, progresso).
 *
 * `registrar` é puro — devolve uma lista nova, nunca muta a recebida — para
 * caber direto num `setState` funcional em `App`.
 */

export interface EntradaConsole {
  id: number
  hora: string
  nivel: 'info' | 'sucesso' | 'aviso' | 'erro'
  mensagem: string
}

/** Entradas guardadas antes de `registrar` descartar as mais antigas. */
export const LIMITE_ENTRADAS = 500

function doisDigitos(numero: number): string {
  return numero.toString().padStart(2, '0')
}

/** Monta uma entrada nova, sem `id` (quem guarda a lista atribui, em ordem).
 * `agora` é injetável para testes determinísticos; por padrão é o instante atual. */
export function novaEntrada(
  nivel: EntradaConsole['nivel'],
  mensagem: string,
  agora: Date = new Date(),
): Omit<EntradaConsole, 'id'> {
  const hora = `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}:${doisDigitos(agora.getSeconds())}`
  return { hora, nivel, mensagem }
}

/** Acrescenta uma entrada a `entradas`, com o próximo id sequencial, e
 * descarta as mais antigas acima de `LIMITE_ENTRADAS`. */
export function registrar(
  entradas: EntradaConsole[],
  nivel: EntradaConsole['nivel'],
  mensagem: string,
  agora?: Date,
): EntradaConsole[] {
  const proximoId = (entradas.at(-1)?.id ?? 0) + 1
  const atualizado = [...entradas, { ...novaEntrada(nivel, mensagem, agora), id: proximoId }]
  return atualizado.length > LIMITE_ENTRADAS ? atualizado.slice(atualizado.length - LIMITE_ENTRADAS) : atualizado
}
