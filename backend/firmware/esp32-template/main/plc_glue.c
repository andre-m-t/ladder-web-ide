#include "plc_glue.h"

#include <stdio.h>
#include <string.h>

/* Cabecalhos do MATIEC (LGPL; ver THIRD_PARTY.md), vindos da imagem do container. */
#include "iec_std_lib.h"

#include "plc_hal.h"
#include "plc_io_map.h"

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
            plc_hal_log_warn("%s nao e booleano (%u bytes); pino GPIO%d ignorado",
                              pin->variable, (unsigned)var->size, pin->gpio);
            continue;
        }

        /* plc_hal_pin_init devolve erro em vez de abortar (ver o comentario
         * dela em plc_hal.h) -- o antigo ESP_ERROR_CHECK direto no gpio_config
         * derrubava a placa por um pino mal descrito no mapa; agora e um
         * aviso e o pino simplesmente fica de fora do scan. */
        if (plc_hal_pin_init(pin) != 0) {
            plc_hal_log_warn("%s: GPIO%d nao pode ser configurado; pino ignorado",
                              pin->variable, pin->gpio);
            continue;
        }

        plc_bindings[plc_binding_count].pin = pin;
        plc_bindings[plc_binding_count].value = var->value;
        plc_binding_count++;

        plc_hal_log_info("%s <-> GPIO%d (%s%s)", pin->variable, pin->gpio,
                          pin->direction == PLC_IO_OUTPUT ? "saida" : "entrada",
                          pin->active_low ? ", ativo em nivel baixo" : "");
    }

    for (size_t i = 0; i < PLC_LOCATED_VAR_COUNT; i++) {
        if (!pin_is_mapped(plc_located_vars[i].name)) {
            plc_hal_log_warn("%s nao tem pino no mapa desta placa; sera ignorado",
                              plc_located_vars[i].name);
        }
    }
}

/* ------------------------------------------------------------------------ */
/* Ciclo de varredura                                                        */
/* ------------------------------------------------------------------------ */

static void update_current_time(void)
{
    int64_t now_us = plc_hal_time_us();
    __CURRENT_TIME.tv_sec = now_us / 1000000;
    __CURRENT_TIME.tv_nsec = (now_us % 1000000) * 1000;
}

/* Nivel ELETRICO do pino -> valor LOGICO da variavel: e aqui, e so aqui, que
 * active_low e invertido (ver o comentario no topo de plc_hal.h). A HAL so
 * devolve 0/1 brutos. */
static void read_inputs(void)
{
    for (size_t i = 0; i < plc_binding_count; i++) {
        const plc_io_pin_t *pin = plc_bindings[i].pin;
        if (pin->direction != PLC_IO_INPUT) {
            continue;
        }
        int level = plc_hal_pin_read(pin);
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
        plc_hal_pin_write(pin, (pin->active_low ? !on : on) ? 1 : 0);
    }
}

void plc_glue_init(void)
{
    plc_hal_init();
    update_current_time();
    bind_io();
    config_init__();
    write_outputs();
}

/* Invariante de imagem de processo (IEC 61131-3): read_inputs() e o UNICO
 * ponto de leitura de pino do ciclo, e write_outputs() so le variaveis --
 * nunca consulta um pino de entrada. Uma mudanca eletrica ocorrida entre as
 * duas so pode aparecer no ciclo SEGUINTE, nunca no atual.
 *
 * Esta propriedade e estrutural (decorre de nao existir outro ponto de
 * leitura no codigo) e e assumida aqui sem teste que a derrube por inteiro.
 * backend/tests/test_plc_runtime_host.py conta leituras por ciclo (pega uma
 * leitura extra ou perdida), mas a docstring por volta da linha 175 desse
 * arquivo declara explicitamente que a janela entre read_inputs() e
 * write_outputs() dentro do MESMO ciclo nao e coberta. Quem acrescentar
 * leitura de pino fora de read_inputs(), ou fizer write_outputs consultar
 * entrada, quebra esta semantica -- possivelmente sem nenhum teste acusar. */
void plc_glue_scan(unsigned long tick)
{
    update_current_time();
    read_inputs();
    config_run__(tick);
    write_outputs();
}

void plc_glue_step_logic(unsigned long tick)
{
    update_current_time();
    config_run__(tick);
}

uint64_t plc_glue_cycle_time_us(void)
{
    uint64_t period_us = common_ticktime__ / 1000ULL;
    return period_us > 0 ? period_us : 1000ULL;
}

/* ------------------------------------------------------------------------ */
/* Acesso por endereco IEC, sem passar pelo mapa de pinos                    */
/* ------------------------------------------------------------------------ */
/* Usado por plc_host_runner (modo padrao do contrato em
 * docs/validacao/contrato-runtime-host.md): o simulador de F9 conhece
 * %QX0.0, nao GPIO2, entao o executor padrao tambem nao pode depender do
 * mapa de pinos -- so dele, plc_glue_step_logic mais estas quatro funcoes dao
 * conta de rodar a logica e ler/escrever variaveis localizadas sem tocar a
 * HAL. Cobrem so BOOL: e a unica classe de variavel localizada que este
 * projeto usa (ver o comentario no topo de plc_io_map.h). */

/* "__IX0_0" -> "%IX0.0" (mesma correspondencia descrita no topo de
 * plc_io_map.h e verificada por backend/tests/test_plc_io_map.py). */
static void symbol_to_address(const char *symbol, char *buf, size_t buf_len)
{
    const char *body = symbol + 2; /* remove o "__" */
    char kind = body[0];
    char x = body[1];
    const char *rest = body + 2; /* "0_0" */
    const char *underscore = strchr(rest, '_');
    int word_len = underscore ? (int)(underscore - rest) : 0;
    const char *bit = underscore ? underscore + 1 : "";
    snprintf(buf, buf_len, "%%%c%c%.*s.%s", kind, x, word_len, rest, bit);
}

size_t plc_glue_var_count(void)
{
    return PLC_LOCATED_VAR_COUNT;
}

void plc_glue_var_address(size_t index, char *buf, size_t buf_len)
{
    if (index >= PLC_LOCATED_VAR_COUNT) {
        if (buf_len > 0) {
            buf[0] = '\0';
        }
        return;
    }
    symbol_to_address(plc_located_vars[index].name, buf, buf_len);
}

int plc_glue_var_get(size_t index)
{
    if (index >= PLC_LOCATED_VAR_COUNT) {
        return 0;
    }
    return *plc_located_vars[index].value != 0 ? 1 : 0;
}

void plc_glue_var_set(size_t index, int value)
{
    if (index >= PLC_LOCATED_VAR_COUNT) {
        return;
    }
    *plc_located_vars[index].value = value != 0 ? 1 : 0;
}
