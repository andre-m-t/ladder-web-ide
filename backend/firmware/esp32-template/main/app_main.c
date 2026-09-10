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

    unsigned long tick = 0;
    TickType_t last_wake = xTaskGetTickCount();
    for (;;) {
        plc_glue_scan(tick++);
        xTaskDelayUntil(&last_wake, period_ticks);
    }
}
