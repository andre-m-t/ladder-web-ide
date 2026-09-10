/* Fronteira entre o codigo C gerado pelo MATIEC e o hardware do ESP32.
 *
 * O iec2c produz a logica (config_init__, config_run__) mas nao sabe nada de
 * GPIO nem de tempo real: ele apenas le e escreve variaveis localizadas por
 * ponteiro. Este modulo cria o armazenamento dessas variaveis, liga cada uma
 * a um pino segundo plc_io_map.h e executa o ciclo de varredura.
 */

#pragma once

#include <stdint.h>

/* Configura os pinos e roda a inicializacao da CONFIGURATION do IEC. */
void plc_glue_init(void);

/* Um ciclo de varredura: le entradas -> executa a logica -> escreve saidas. */
void plc_glue_scan(unsigned long tick);

/* Periodo do ciclo em microssegundos, derivado de common_ticktime__ (ns). */
uint64_t plc_glue_cycle_time_us(void);
