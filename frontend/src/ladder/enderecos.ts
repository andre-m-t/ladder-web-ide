/**
 * Endereços localizados que o firmware mapeia para GPIO (plano D-9; 8+8
 * fixado na revisão 2026-09-17 da Q-5 da spec 001, a pedido da spec 002).
 *
 * Espelho de `plc_io_pins[]` em
 * `backend/firmware/esp32-template/main/plc_io_map.h`. O editor só oferece
 * estes endereços: oferecer um que o firmware não mapeia aceitaria um
 * diagrama que só falharia no dispositivo. A igualdade entre estas listas
 * (e de `GPIO_DO_ENDERECO` abaixo) e o header é travada por
 * `backend/tests/test_plc_io_map.py` (ressalva R-3 do plano) — acrescentar
 * pino num lado sem o outro, ou divergir o número do GPIO, quebra a suíte.
 *
 * Os doze GPIOs acrescentados nesta revisão (tudo além de `%IX0.0`,
 * `%IX0.1`, `%QX0.0`, `%QX0.1`) nunca foram gravados nem medidos em hardware
 * físico — ver `docs/validacao/limites-da-validacao-sem-hardware.md`.
 */

export const ENTRADAS_LOCALIZADAS = [
  '%IX0.0',
  '%IX0.1',
  '%IX0.2',
  '%IX0.3',
  '%IX0.4',
  '%IX0.5',
  '%IX0.6',
  '%IX0.7',
] as const

export const SAIDAS_LOCALIZADAS = [
  '%QX0.0',
  '%QX0.1',
  '%QX0.2',
  '%QX0.3',
  '%QX0.4',
  '%QX0.5',
  '%QX0.6',
  '%QX0.7',
] as const

export const ENDERECOS_LOCALIZADOS: readonly string[] = [...ENTRADAS_LOCALIZADAS, ...SAIDAS_LOCALIZADAS]

/**
 * Mapa endereço → GPIO, para o rodapé do `PainelVariaveis` (plano D-13) e
 * para qualquer lugar do editor que precise mostrar o pino físico sem
 * duplicar a tabela do firmware. Mesma fonte de verdade de
 * `ENTRADAS_LOCALIZADAS`/`SAIDAS_LOCALIZADAS`: espelha `plc_io_pins[]`.
 */
export const GPIO_DO_ENDERECO: Readonly<Record<string, number>> = {
  '%IX0.0': 0,
  '%IX0.1': 18,
  '%IX0.2': 19,
  '%IX0.3': 21,
  '%IX0.4': 22,
  '%IX0.5': 23,
  '%IX0.6': 32,
  '%IX0.7': 33,
  '%QX0.0': 2,
  '%QX0.1': 4,
  '%QX0.2': 16,
  '%QX0.3': 17,
  '%QX0.4': 25,
  '%QX0.5': 26,
  '%QX0.6': 27,
  '%QX0.7': 13,
}

export function enderecoValido(endereco: string): boolean {
  return ENDERECOS_LOCALIZADOS.includes(endereco)
}

export function ehEntrada(endereco: string): boolean {
  return endereco.startsWith('%IX')
}

/**
 * Classe de uma variável, derivada do endereço (plano D-12): sem `endereco` é
 * interna; `%IX...` é entrada; `%QX...` é saída. O tipo de dado continua
 * único (`BOOL`, Q-5/D-2) — a classe só existe para a tabela de variáveis e
 * para filtrar os endereços oferecidos por classe.
 */
export type ClasseVariavel = 'entrada' | 'saida' | 'interna'

export function classeDaVariavel(v: { endereco?: string }): ClasseVariavel {
  if (v.endereco === undefined) return 'interna'
  return ehEntrada(v.endereco) ? 'entrada' : 'saida'
}

/** Endereços localizados de uma classe. Interna não tem endereço: `[]`. */
export function enderecosDaClasse(c: ClasseVariavel): readonly string[] {
  if (c === 'entrada') return ENTRADAS_LOCALIZADAS
  if (c === 'saida') return SAIDAS_LOCALIZADAS
  return []
}
