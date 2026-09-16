/**
 * Endereços localizados que o firmware mapeia para GPIO (plano D-9).
 *
 * Espelho de `plc_io_pins[]` em
 * `backend/firmware/esp32-template/main/plc_io_map.h`. O editor só oferece
 * estes endereços: oferecer um que o firmware não mapeia aceitaria um
 * diagrama que só falharia no dispositivo. A igualdade entre esta lista e o
 * header é travada por `backend/tests/test_plc_io_map.py` (ressalva R-3 do
 * plano) — acrescentar pino num lado sem o outro quebra a suíte.
 */

export const ENTRADAS_LOCALIZADAS = ['%IX0.0', '%IX0.1'] as const
export const SAIDAS_LOCALIZADAS = ['%QX0.0', '%QX0.1'] as const

export const ENDERECOS_LOCALIZADOS: readonly string[] = [...ENTRADAS_LOCALIZADAS, ...SAIDAS_LOCALIZADAS]

export function enderecoValido(endereco: string): boolean {
  return ENDERECOS_LOCALIZADOS.includes(endereco)
}

export function ehEntrada(endereco: string): boolean {
  return endereco.startsWith('%IX')
}
