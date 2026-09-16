/* Implementacao da HAL (plc_hal.h) em memoria, para o alvo host: nenhum
 * hardware real, so um array indexado por numero de GPIO que os testes (via
 * plc_hal_stub.h) e o plc_host_runner controlam.
 *
 * So compila para o alvo host: plc_hal_esp32.c cobre o mesmo papel no ESP32
 * e nunca e compilado junto (cada alvo liga exatamente uma implementacao da
 * HAL -- ver o comentario no topo de plc_hal.h).
 */

#include "plc_hal.h"
#include "plc_hal_stub.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/* GPIO0..39: faixa do ESP32 classico (a mesma que test_plc_io_map.py valida
 * em plc_io_map.h). Um indice fora daqui e erro de mapa, nao situacao a
 * tratar em silencio -- as funcoes abaixo ignoram a chamada e devolvem um
 * valor neutro, o suficiente para o teste que provocou o erro falhar por
 * uma asserção incorreta, nao por um crash do stub. */
#define PLC_HAL_STUB_GPIO_COUNT 40

typedef struct {
    int level;
    int configured;
    unsigned read_count;
    /* leitura absoluta (read_count) em que a troca agendada ocorre; 0 = nenhuma */
    unsigned flip_at;
    int flip_level;
} plc_hal_stub_pin_t;

static plc_hal_stub_pin_t pins[PLC_HAL_STUB_GPIO_COUNT];
static int64_t clock_us;

static int gpio_valido(int gpio)
{
    return gpio >= 0 && gpio < PLC_HAL_STUB_GPIO_COUNT;
}

void plc_hal_stub_reset(void)
{
    memset(pins, 0, sizeof(pins));
    clock_us = 0;
}

/* Ao contrario do alvo ESP32, aqui plc_hal_init nao zera nada: o reset e
 * responsabilidade explicita de quem controla o teste (plc_hal_stub_reset),
 * para que o estado entre cenarios nunca dependa da ordem de chamadas. */
void plc_hal_init(void)
{
}

int plc_hal_pin_init(const plc_io_pin_t *pin)
{
    if (!gpio_valido(pin->gpio)) {
        return -1;
    }
    pins[pin->gpio].configured = 1;
    return 0;
}

int plc_hal_pin_read(const plc_io_pin_t *pin)
{
    if (!gpio_valido(pin->gpio)) {
        return 0;
    }
    plc_hal_stub_pin_t *p = &pins[pin->gpio];
    p->read_count++;
    /* A troca agendada por plc_hal_stub_flip_on_read acontece NESTA leitura,
     * e o novo valor ja e o que ela devolve -- simula um sinal que muda no
     * exato instante em que o codigo olha para o pino, o cenario mais dificil
     * para provar que o resto do ciclo usa a amostra unica capturada aqui, e
     * nao volta a consultar a HAL. */
    if (p->flip_at != 0 && p->read_count == p->flip_at) {
        p->level = p->flip_level;
        p->flip_at = 0;
    }
    return p->level;
}

void plc_hal_pin_write(const plc_io_pin_t *pin, int level)
{
    if (!gpio_valido(pin->gpio)) {
        return;
    }
    pins[pin->gpio].level = level != 0 ? 1 : 0;
}

int64_t plc_hal_time_us(void)
{
    return clock_us;
}

void plc_hal_log_info(const char *fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    fprintf(stderr, "plc_hal I: ");
    vfprintf(stderr, fmt, args);
    fprintf(stderr, "\n");
    va_end(args);
}

void plc_hal_log_warn(const char *fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    fprintf(stderr, "plc_hal W: ");
    vfprintf(stderr, fmt, args);
    fprintf(stderr, "\n");
    va_end(args);
}

/* ------------------------------------------------------------------------ */
/* API exclusiva do host (plc_hal_stub.h)                                    */
/* ------------------------------------------------------------------------ */

void plc_hal_stub_set_level(int gpio, int level)
{
    if (!gpio_valido(gpio)) {
        return;
    }
    pins[gpio].level = level != 0 ? 1 : 0;
}

int plc_hal_stub_get_level(int gpio)
{
    if (!gpio_valido(gpio)) {
        return 0;
    }
    return pins[gpio].level;
}

int plc_hal_stub_is_configured(int gpio)
{
    if (!gpio_valido(gpio)) {
        return 0;
    }
    return pins[gpio].configured;
}

void plc_hal_stub_advance_us(int64_t delta)
{
    clock_us += delta;
}

unsigned plc_hal_stub_read_count(int gpio)
{
    if (!gpio_valido(gpio)) {
        return 0;
    }
    return pins[gpio].read_count;
}

void plc_hal_stub_flip_on_read(int gpio, unsigned na_leitura, int novo_nivel)
{
    if (!gpio_valido(gpio)) {
        return;
    }
    if (na_leitura == 0) {
        pins[gpio].flip_at = 0;
        return;
    }
    pins[gpio].flip_at = pins[gpio].read_count + na_leitura;
    pins[gpio].flip_level = novo_nivel != 0 ? 1 : 0;
}
