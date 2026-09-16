/* Fronteira entre o codigo C gerado pelo MATIEC e o hardware do ESP32.
 *
 * O iec2c produz a logica (config_init__, config_run__) mas nao sabe nada de
 * GPIO nem de tempo real: ele apenas le e escreve variaveis localizadas por
 * ponteiro. Este modulo cria o armazenamento dessas variaveis, liga cada uma
 * a um pino segundo plc_io_map.h e executa o ciclo de varredura.
 */

#pragma once

#include <stddef.h>
#include <stdint.h>

/* Configura os pinos e roda a inicializacao da CONFIGURATION do IEC. */
void plc_glue_init(void);

/* Um ciclo de varredura completo: le entradas -> executa a logica -> escreve
 * saidas. Passa pela HAL (plc_hal.h) -- e o que app_main.c chama no alvo
 * ESP32 e o que o modo `--eletrico` de plc_host_runner chama no host. */
void plc_glue_scan(unsigned long tick);

/* So a logica: atualiza o relogio e roda a CONFIGURATION do IEC, sem tocar a
 * HAL nem o mapa de pinos. Usado pelo modo padrao (endereco IEC) de
 * plc_host_runner, que le/escreve variaveis localizadas diretamente por
 * plc_glue_var_get/plc_glue_var_set -- o mesmo motivo pelo qual o contrato
 * nao fala em GPIO (ver docs/validacao/contrato-runtime-host.md). */
void plc_glue_step_logic(unsigned long tick);

/* Periodo do ciclo em microssegundos, derivado de common_ticktime__ (ns). */
uint64_t plc_glue_cycle_time_us(void);

/* ------------------------------------------------------------------------ */
/* Acesso por endereco IEC as variaveis localizadas (so BOOL)                */
/* ------------------------------------------------------------------------ */

/* Quantas variaveis localizadas o programa carregado declara. */
size_t plc_glue_var_count(void);

/* Endereco IEC da variavel de indice `index` (ex.: "%IX0.0"), em `buf`.
 * String vazia se o indice for invalido. */
void plc_glue_var_address(size_t index, char *buf, size_t buf_len);

/* Valor logico atual (0 ou 1) da variavel de indice `index`. */
int plc_glue_var_get(size_t index);

/* Escreve o valor logico (0 ou 1) da variavel de indice `index`. */
void plc_glue_var_set(size_t index, int value);
