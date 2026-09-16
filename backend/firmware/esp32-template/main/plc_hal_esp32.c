/* Implementacao da HAL (plc_hal.h) sobre o ESP-IDF real: driver/gpio.h e
 * esp_timer.h. So compila para o alvo Xtensa -- e o unico arquivo deste
 * componente que inclui esses cabecalhos (ver main/CMakeLists.txt, que lista
 * este .c nas fontes do firmware; plc_hal_stub.c cobre o mesmo papel no
 * alvo host e nunca e compilado aqui).
 */

#include "plc_hal.h"

#include <stdarg.h>
#include <stdio.h>

#include "driver/gpio.h"
#include "esp_timer.h"
#include "esp_log.h"

static const char *TAG = "plc_hal";

void plc_hal_init(void)
{
    /* Nada a inicializar globalmente: o ESP-IDF ja deixa o driver de GPIO e
     * o esp_timer prontos antes de app_main rodar, e cada pino e configurado
     * individualmente em plc_hal_pin_init. */
}

int plc_hal_pin_init(const plc_io_pin_t *pin)
{
    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << pin->gpio,
        .mode = (pin->direction == PLC_IO_OUTPUT) ? GPIO_MODE_OUTPUT : GPIO_MODE_INPUT,
        .pull_up_en = pin->pull_up ? GPIO_PULLUP_ENABLE : GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    /* Deliberadamente SEM ESP_ERROR_CHECK: um pino mal descrito no mapa e
     * erro de configuracao, nao motivo para o dispositivo entrar em panic
     * (ver o comentario de plc_hal_pin_init em plc_hal.h). Quem chama decide
     * o que fazer com o erro -- hoje, plc_glue.c registra um aviso e ignora
     * o pino. */
    esp_err_t err = gpio_config(&cfg);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "GPIO%d: gpio_config falhou (%s)", pin->gpio, esp_err_to_name(err));
        return (int)err;
    }
    return 0;
}

int plc_hal_pin_read(const plc_io_pin_t *pin)
{
    return gpio_get_level(pin->gpio) != 0 ? 1 : 0;
}

void plc_hal_pin_write(const plc_io_pin_t *pin, int level)
{
    gpio_set_level(pin->gpio, level != 0 ? 1 : 0);
}

int64_t plc_hal_time_us(void)
{
    return esp_timer_get_time();
}

/* ESP_LOGI/ESP_LOGW sao macros que esperam o formato como literal em tempo
 * de compilacao (concatenam PRIu32 etc.); nao ha como repassar `fmt` e
 * `va_list` diretamente a elas. Formata em um buffer local e loga o
 * resultado como string -- mais portavel entre versoes do ESP-IDF do que
 * depender de uma funcao interna como esp_log_writev. */
void plc_hal_log_info(const char *fmt, ...)
{
    char buf[160];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    ESP_LOGI(TAG, "%s", buf);
}

void plc_hal_log_warn(const char *fmt, ...)
{
    char buf[160];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    ESP_LOGW(TAG, "%s", buf);
}
