/* Mapeamento fixo entre enderecos IEC 61131-3 e pinos do ESP32.
 *
 * Decisoes Q-1 e Q-5 da spec 001: o alvo desta fatia e o ESP32 classico
 * (WROOM-32 / DevKit v1) com pinagem fixa, sem escolha pelo usuario. Trocar
 * um pino aqui e uma mudanca de contrato com quem escreve o Ladder, nao um
 * detalhe de implementacao -- por isso a tabela vive em um cabecalho proprio.
 *
 * O nome da variavel e o simbolo que o iec2c emite em LOCATED_VARIABLES.h
 * para cada endereco: %IX0.0 -> __IX0_0, %QX0.1 -> __QX0_1.
 *
 * Revisao 2026-09-17 (Q-5 da spec 001): tabela ampliada de 2 entradas + 2
 * saidas para 8 entradas + 8 saidas, a pedido da spec 002 (o editor Ladder
 * oferece ate 8 enderecos localizados de cada classe -- D-13 do plano da
 * spec 002). Os quatro pinos originais (IX0.0, IX0.1, QX0.0, QX0.1) NAO
 * mudam de GPIO. Os doze pinos novos foram escolhidos com os mesmos
 * criterios da revisao anterior -- nada em strapping perigoso (GPIO5/12/15),
 * nada na faixa do flash SPI interno (GPIO6-11), nenhuma entrada input-only
 * (GPIO34-39) com pull-up -- mas NUNCA foram gravados ou medidos em hardware
 * fisico: ver docs/validacao/limites-da-validacao-sem-hardware.md e
 * docs/validacao/ca-4-gravacao-esp32.md. Tabela consolidada na spec 001,
 * Q-5.
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
    /* Entrada livre. GPIO18, nao GPIO5 (revisao Q-5, 2026-09-15): GPIO5 e
     * strapping pin e precisa estar em nivel alto no reset; como entrada
     * ligada a circuito externo, nivel baixo no boot impede a inicializacao
     * da placa -- falha que so apareceria na bancada. GPIO18 nao tem papel
     * no boot, tem pull-up interno e esta exposto no header da DevKit v1. */
    {"__IX0_1", 18, PLC_IO_INPUT, false, true},
    /* Entrada livre (revisao 2026-09-17). GPIO19: sem papel no boot, com
     * pull-up interno, par de GPIO18 nos headers da DevKit v1. Nao gravado
     * em hardware. */
    {"__IX0_2", 19, PLC_IO_INPUT, false, true},
    /* Entrada livre (revisao 2026-09-17). GPIO21: pino padrao de I2C SDA
     * quando essa periferia e usada, mas aqui e GPIO digital comum; sem
     * papel no boot. Nao gravado em hardware. */
    {"__IX0_3", 21, PLC_IO_INPUT, false, true},
    /* Entrada livre (revisao 2026-09-17). GPIO22: pino padrao de I2C SCL
     * quando essa periferia e usada, mas aqui e GPIO digital comum; sem
     * papel no boot. Nao gravado em hardware. */
    {"__IX0_4", 22, PLC_IO_INPUT, false, true},
    /* Entrada livre (revisao 2026-09-17). GPIO23: sem papel no boot; e VSPI
     * MOSI so quando essa periferia e ativada. Nao gravado em hardware. */
    {"__IX0_5", 23, PLC_IO_INPUT, false, true},
    /* Entrada livre (revisao 2026-09-17). GPIO32: RTC GPIO / ADC1, sem papel
     * no boot, suporta pull-up interno normalmente. Nao gravado em
     * hardware. */
    {"__IX0_6", 32, PLC_IO_INPUT, false, true},
    /* Entrada livre (revisao 2026-09-17). GPIO33: RTC GPIO / ADC1, mesma
     * familia do GPIO32. Nao gravado em hardware. */
    {"__IX0_7", 33, PLC_IO_INPUT, false, true},

    /* Saidas ---------------------------------------------------------- */
    /* LED embarcado da DevKit v1. */
    {"__QX0_0", 2, PLC_IO_OUTPUT, false, false},
    {"__QX0_1", 4, PLC_IO_OUTPUT, false, false},
    /* Saida livre (revisao 2026-09-17). GPIO16: livre por este alvo
     * (WROOM-32) nao ter PSRAM -- em modulos WROVER com PSRAM e reservado.
     * Nao gravado em hardware. */
    {"__QX0_2", 16, PLC_IO_OUTPUT, false, false},
    /* Saida livre (revisao 2026-09-17). GPIO17: mesma ressalva do GPIO16 --
     * livre so por nao haver PSRAM neste alvo. Nao gravado em hardware. */
    {"__QX0_3", 17, PLC_IO_OUTPUT, false, false},
    /* Saida livre (revisao 2026-09-17). GPIO25: capaz de DAC1, usado aqui
     * apenas como saida digital. Nao gravado em hardware. */
    {"__QX0_4", 25, PLC_IO_OUTPUT, false, false},
    /* Saida livre (revisao 2026-09-17). GPIO26: capaz de DAC2, usado aqui
     * apenas como saida digital. Nao gravado em hardware. */
    {"__QX0_5", 26, PLC_IO_OUTPUT, false, false},
    /* Saida livre (revisao 2026-09-17). GPIO27: sem papel no boot. Nao
     * gravado em hardware. */
    {"__QX0_6", 27, PLC_IO_OUTPUT, false, false},
    /* Saida livre (revisao 2026-09-17). GPIO13: compartilha papel com JTAG
     * (MTCK) quando ha um depurador externo conectado; sem depurador,
     * comporta-se como GPIO comum. Nao gravado em hardware. */
    {"__QX0_7", 13, PLC_IO_OUTPUT, false, false},
};

#define PLC_IO_PIN_COUNT (sizeof(plc_io_pins) / sizeof(plc_io_pins[0]))
