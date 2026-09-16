/* Fina camada de abstracao entre o glue do PLC e o hardware.
 *
 * Existe para que o mesmo plc_glue.c compile em dois alvos: o ESP32, sobre
 * driver/gpio.h do ESP-IDF, e o host, sobre uma implementacao em memoria que
 * os testes controlam. Duas implementacoes atras desta mesma interface --
 * plc_hal_esp32.c e plc_hal_stub.c -- e a escolha e feita pelo sistema de
 * build: cada alvo compila exatamente um dos dois arquivos. Nao ha #ifdef na
 * logica do plc_glue.c, de proposito; codigo que so roda em um dos alvos nao
 * e codigo testado no outro.
 *
 * Esta camada e ELETRICA: trabalha com o nivel bruto do pino (0 ou 1). A
 * inversao de active_low e a leitura do mapa continuam em plc_glue.c, onde os
 * testes de host conseguem verifica-las -- se a HAL ja devolvesse o valor
 * logico, a inversao seria invisivel para o teste.
 *
 * A pinagem continua vindo de plc_io_map.h, fonte unica: a HAL recebe um
 * ponteiro para a entrada da tabela e nao guarda mapeamento proprio.
 */

#pragma once

#include <stdint.h>

#include "plc_io_map.h"

/* Inicializa a camada. Chamada uma vez, antes de qualquer plc_hal_pin_init. */
void plc_hal_init(void);

/* Configura um pino conforme a descricao do mapa (direcao e pull-up).
 *
 * Devolve 0 em sucesso e diferente de 0 se o pino nao pode ser configurado.
 * Devolver erro em vez de abortar e deliberado: substitui o ESP_ERROR_CHECK
 * que derrubava a placa por um aviso no log -- um pino mal descrito no mapa e
 * erro de configuracao, nao motivo para o dispositivo entrar em panic. */
int plc_hal_pin_init(const plc_io_pin_t *pin);

/* Nivel eletrico do pino, 0 ou 1. Sem inversao de active_low. */
int plc_hal_pin_read(const plc_io_pin_t *pin);

/* Escreve o nivel eletrico do pino, 0 ou 1. Sem inversao de active_low. */
void plc_hal_pin_write(const plc_io_pin_t *pin, int level);

/* Relogio monotonico em microssegundos. Alimenta __CURRENT_TIME. */
int64_t plc_hal_time_us(void);

/* Log do runtime: ESP_LOGI/ESP_LOGW no alvo, stderr no host. */
void plc_hal_log_info(const char *fmt, ...);
void plc_hal_log_warn(const char *fmt, ...);
