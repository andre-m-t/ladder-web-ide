#include "plc_glue.h"

#include <string.h>

#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_timer.h"

/* Cabecalhos do MATIEC (LGPL-2.1+), vindos da imagem do container. */
#include "iec_std_lib.h"

#include "plc_io_map.h"

static const char *TAG = "plc";

/* ------------------------------------------------------------------------ */
/* Simbolos que o codigo gerado espera encontrar no runtime                  */
/* ------------------------------------------------------------------------ */

/* Relogio consultado pelas funcoes de tempo do IEC (TIME(), NOW()...). */
TIME __CURRENT_TIME;

/* Definidos em Config0.c, gerado pelo iec2c a partir do ST do usuario. */
extern unsigned long long common_ticktime__;
void config_init__(void);
void config_run__(unsigned long tick);

/* Armazenamento das variaveis localizadas.
 *
 * O codigo gerado declara `extern TIPO *__QX0_0;` e enxerga a variavel apenas
 * pelo ponteiro. Quem cria a memoria apontada e este modulo: expandimos
 * LOCATED_VARIABLES.h (gerado) duas vezes, uma para declarar o par
 * armazenamento+ponteiro e outra para montar a tabela percorrida no scan. */
#define __LOCATED_VAR(type, name, ...) \
    type plc_storage_##name = 0;       \
    type *name = &plc_storage_##name;
#include "LOCATED_VARIABLES.h"
#undef __LOCATED_VAR

typedef struct {
    const char *name;
    uint8_t *value;
    size_t size;
} plc_located_var_t;

/* A sentinela final garante que a tabela nao fique vazia: um programa sem
 * nenhuma variavel localizada gera um LOCATED_VARIABLES.h vazio, e array de
 * tamanho zero nao e C valido. */
static const plc_located_var_t plc_located_vars[] = {
#define __LOCATED_VAR(type, name, ...) {#name, (uint8_t *)&plc_storage_##name, sizeof(type)},
#include "LOCATED_VARIABLES.h"
#undef __LOCATED_VAR
    {NULL, NULL, 0},
};

#define PLC_LOCATED_VAR_COUNT ((sizeof(plc_located_vars) / sizeof(plc_located_vars[0])) - 1)

/* ------------------------------------------------------------------------ */
/* Ligacao variavel localizada <-> pino                                      */
/* ------------------------------------------------------------------------ */

/* Uma entrada por pino efetivamente usado pelo programa do usuario. */
typedef struct {
    const plc_io_pin_t *pin;
    uint8_t *value;
} plc_binding_t;

static plc_binding_t plc_bindings[PLC_IO_PIN_COUNT];
static size_t plc_binding_count;

static const plc_located_var_t *find_located_var(const char *name)
{
    for (size_t i = 0; i < PLC_LOCATED_VAR_COUNT; i++) {
        if (strcmp(plc_located_vars[i].name, name) == 0) {
            return &plc_located_vars[i];
        }
    }
    return NULL;
}

static bool pin_is_mapped(const char *variable)
{
    for (size_t i = 0; i < PLC_IO_PIN_COUNT; i++) {
        if (strcmp(plc_io_pins[i].variable, variable) == 0) {
            return true;
        }
    }
    return false;
}

/* Liga cada pino do mapa a variavel correspondente, quando o programa a usa.
 * Um programa que so acende um LED nao declara as demais: a ausencia e normal
 * e o pino simplesmente nao e configurado. O contrario -- uma variavel
 * localizada sem pino no mapa -- e erro do usuario e vira aviso no log. */
static void bind_io(void)
{
    plc_binding_count = 0;

    for (size_t i = 0; i < PLC_IO_PIN_COUNT; i++) {
        const plc_io_pin_t *pin = &plc_io_pins[i];
        const plc_located_var_t *var = find_located_var(pin->variable);
        if (var == NULL) {
            continue;
        }
        if (var->size != sizeof(uint8_t)) {
            ESP_LOGW(TAG, "%s nao e booleano (%u bytes); pino GPIO%d ignorado",
                     pin->variable, (unsigned)var->size, pin->gpio);
            continue;
        }

        gpio_config_t cfg = {
            .pin_bit_mask = 1ULL << pin->gpio,
            .mode = (pin->direction == PLC_IO_OUTPUT) ? GPIO_MODE_OUTPUT : GPIO_MODE_INPUT,
            .pull_up_en = pin->pull_up ? GPIO_PULLUP_ENABLE : GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_DISABLE,
        };
        ESP_ERROR_CHECK(gpio_config(&cfg));

        plc_bindings[plc_binding_count].pin = pin;
        plc_bindings[plc_binding_count].value = var->value;
        plc_binding_count++;

        ESP_LOGI(TAG, "%s <-> GPIO%d (%s%s)", pin->variable, pin->gpio,
                 pin->direction == PLC_IO_OUTPUT ? "saida" : "entrada",
                 pin->active_low ? ", ativo em nivel baixo" : "");
    }

    for (size_t i = 0; i < PLC_LOCATED_VAR_COUNT; i++) {
        if (!pin_is_mapped(plc_located_vars[i].name)) {
            ESP_LOGW(TAG, "%s nao tem pino no mapa desta placa; sera ignorado",
                     plc_located_vars[i].name);
        }
    }
}

/* ------------------------------------------------------------------------ */
/* Ciclo de varredura                                                        */
/* ------------------------------------------------------------------------ */

static void update_current_time(void)
{
    int64_t now_us = esp_timer_get_time();
    __CURRENT_TIME.tv_sec = now_us / 1000000;
    __CURRENT_TIME.tv_nsec = (now_us % 1000000) * 1000;
}

static void read_inputs(void)
{
    for (size_t i = 0; i < plc_binding_count; i++) {
        const plc_io_pin_t *pin = plc_bindings[i].pin;
        if (pin->direction != PLC_IO_INPUT) {
            continue;
        }
        int level = gpio_get_level(pin->gpio);
        *plc_bindings[i].value = (pin->active_low ? (level == 0) : (level != 0)) ? 1 : 0;
    }
}

static void write_outputs(void)
{
    for (size_t i = 0; i < plc_binding_count; i++) {
        const plc_io_pin_t *pin = plc_bindings[i].pin;
        if (pin->direction != PLC_IO_OUTPUT) {
            continue;
        }
        bool on = (*plc_bindings[i].value != 0);
        gpio_set_level(pin->gpio, (pin->active_low ? !on : on) ? 1 : 0);
    }
}

void plc_glue_init(void)
{
    update_current_time();
    bind_io();
    config_init__();
    write_outputs();
}

void plc_glue_scan(unsigned long tick)
{
    update_current_time();
    read_inputs();
    config_run__(tick);
    write_outputs();
}

uint64_t plc_glue_cycle_time_us(void)
{
    uint64_t period_us = common_ticktime__ / 1000ULL;
    return period_us > 0 ? period_us : 1000ULL;
}
