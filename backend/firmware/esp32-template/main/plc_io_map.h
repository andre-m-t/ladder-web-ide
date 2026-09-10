/* Mapeamento fixo entre enderecos IEC 61131-3 e pinos do ESP32.
 *
 * Decisoes Q-1 e Q-5 da spec 001: o alvo desta fatia e o ESP32 classico
 * (WROOM-32 / DevKit v1) com pinagem fixa, sem escolha pelo usuario. Trocar
 * um pino aqui e uma mudanca de contrato com quem escreve o Ladder, nao um
 * detalhe de implementacao -- por isso a tabela vive em um cabecalho proprio.
 *
 * O nome da variavel e o simbolo que o iec2c emite em LOCATED_VARIABLES.h
 * para cada endereco: %IX0.0 -> __IX0_0, %QX0.1 -> __QX0_1.
 */

#pragma once

#include <stdbool.h>

typedef enum {
    PLC_IO_INPUT,
    PLC_IO_OUTPUT,
} plc_io_direction_t;

typedef struct {
    const char *variable;      /* simbolo gerado pelo iec2c            */
    int gpio;                  /* pino fisico do ESP32                 */
    plc_io_direction_t direction;
    bool active_low;           /* nivel eletrico invertido em relacao a logica */
    bool pull_up;              /* habilita o pull-up interno (entradas) */
} plc_io_pin_t;

static const plc_io_pin_t plc_io_pins[] = {
    /* Entradas -------------------------------------------------------- */
    /* Botao BOOT da placa: fecha para GND, portanto ativo em nivel baixo. */
    {"__IX0_0", 0, PLC_IO_INPUT, true, true},
    {"__IX0_1", 5, PLC_IO_INPUT, false, true},

    /* Saidas ---------------------------------------------------------- */
    /* LED embarcado da DevKit v1. */
    {"__QX0_0", 2, PLC_IO_OUTPUT, false, false},
    {"__QX0_1", 4, PLC_IO_OUTPUT, false, false},
};

#define PLC_IO_PIN_COUNT (sizeof(plc_io_pins) / sizeof(plc_io_pins[0]))
