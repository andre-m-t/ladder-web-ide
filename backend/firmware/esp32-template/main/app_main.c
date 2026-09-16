/* Ponto de entrada do firmware: um laco de varredura periodico sobre a logica
 * IEC 61131-3 compilada pelo MATIEC.
 *
 * O periodo vem do proprio programa do usuario (a INTERVAL da TASK, que o
 * iec2c materializa em common_ticktime__), nao de uma constante daqui. */

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_log.h"

#include "plc_glue.h"

static const char *TAG = "ladderflow";

/* Cada quantos ciclos de varredura o heartbeat de log e emitido: prova de
 * vida no monitor serial sem inundar o log a cada ciclo (que roda a cada
 * poucos milissegundos). Formato e tag sao CONTRATO com quem le o log fora
 * deste firmware (validacao de bancada sem editor de C): a linha final tem
 * de casar com a regex `ladderflow: scan ciclo=(\d+)` -- nao mude a tag, o
 * texto "scan ciclo=" nem o formato de `%lu` sem avisar quem depende disso. */
#define PLC_HEARTBEAT_CICLOS 50

/* O laco de varredura em si, separado de app_main para que a configuracao
 * (plc_glue_init, calculo do periodo) fique fora do que roda para sempre. */
static void scan_loop(TickType_t period_ticks)
{
    unsigned long tick = 0;
    TickType_t last_wake = xTaskGetTickCount();
    for (;;) {
        plc_glue_scan(tick++);
        if (tick % PLC_HEARTBEAT_CICLOS == 0) {
            ESP_LOGI(TAG, "scan ciclo=%lu", tick);
        }
        xTaskDelayUntil(&last_wake, period_ticks);
    }
}

void app_main(void)
{
    plc_glue_init();

    const uint64_t period_us = plc_glue_cycle_time_us();
    TickType_t period_ticks = pdMS_TO_TICKS(period_us / 1000ULL);
    if (period_ticks == 0) {
        period_ticks = 1; /* piso: um tick do FreeRTOS */
    }

    ESP_LOGI(TAG, "ciclo de varredura: %llu us (%u ticks)",
             (unsigned long long)period_us, (unsigned)period_ticks);

    scan_loop(period_ticks);
}
