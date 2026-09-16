/* API exclusiva da implementacao de host (plc_hal_stub.c).
 *
 * Nao existe no alvo ESP32 e nao deve ser incluida por plc_glue.c nem por
 * app_main.c: quem inclui este cabecalho e o teste, para injetar entradas,
 * ler as saidas escritas e controlar o relogio.
 *
 * O relogio controlado e o que torna o teste deterministico. Sem ele,
 * __CURRENT_TIME seguiria o relogio real da maquina e qualquer asserçao sobre
 * tempo dependeria da carga do container.
 */

#pragma once

#include <stdint.h>

/* Zera a configuracao de todos os pinos, os niveis e o relogio. */
void plc_hal_stub_reset(void);

/* Injeta o nivel eletrico lido por plc_hal_pin_read (entradas). */
void plc_hal_stub_set_level(int gpio, int level);

/* Le o nivel eletrico que plc_hal_pin_write deixou no pino (saidas). */
int plc_hal_stub_get_level(int gpio);

/* 1 se plc_hal_pin_init passou por este pino com sucesso, 0 caso contrario. */
int plc_hal_stub_is_configured(int gpio);

/* Avanca o relogio monotonico devolvido por plc_hal_time_us. */
void plc_hal_stub_advance_us(int64_t delta);

/* Numero de leituras feitas neste pino desde o ultimo reset.
 *
 * Existe para o teste da imagem de entrada: e o gancho que permite alterar o
 * nivel DURANTE o ciclo e provar que a saida corresponde ao valor latcheado no
 * inicio, e nao ao valor alterado no meio. Sem isso, o teste passaria por
 * vacuidade -- read_inputs() roda no inicio do scan e a propriedade seria
 * verdadeira por construcao, independentemente de o codigo estar certo. */
unsigned plc_hal_stub_read_count(int gpio);

/* Agenda uma troca de nivel na n-esima leitura do pino (1 = proxima leitura).
 * Passar 0 em `na_leitura` cancela o agendamento. */
void plc_hal_stub_flip_on_read(int gpio, unsigned na_leitura, int novo_nivel);
