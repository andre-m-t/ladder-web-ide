/* plc_host_cycle_runner -- o main() que de fato roda os ciclos de varredura
 * no host, ciclo a ciclo, conforme docs/validacao/contrato-runtime-host.md.
 *
 * Nunca e chamado diretamente: plc_host_runner.c compila este arquivo junto
 * com plc_glue.c, plc_hal_stub.c e o C que o iec2c acabou de gerar a partir
 * do .st do usuario (Config0.c, Res0.c, LOCATED_VARIABLES.h), e entao troca
 * de processo (execv) para o binario resultante. So nesse momento este
 * main() existe como um executavel de verdade -- por isso ele nao sabe nada
 * sobre iec2c/gcc/arquivos .st, so sobre ciclos, stdin e stdout.
 *
 * Modo padrao (endereco IEC, o publicado no contrato):
 *   plc_host_cycle_runner
 *   stdin:  uma linha por ciclo, "%IX0.0=0 %IX0.1=1" (linha vazia = sem
 *           mudanca). Usa plc_glue_step_logic + plc_glue_var_get/set: nao
 *           toca a HAL, nao sabe de GPIO nem de active_low.
 *
 * Modo eletrico (nivel de pino):
 *   plc_host_cycle_runner --eletrico
 *   stdin:  uma linha por ciclo, "gpio18=0" (mesma regra de linha vazia).
 *           Usa plc_glue_scan (o ciclo completo, com a HAL) e plc_io_pins
 *           para saber quais GPIOs existem e em que direcao.
 *
 * --flip=<gpio>:<na_leitura>:<nivel> (interno, NAO documentado no contrato):
 *   agenda plc_hal_stub_flip_on_read uma unica vez, logo apos
 *   plc_glue_init, e acrescenta "leituras_gpio<N>=<contagem>" ao fim de cada
 *   linha de saida em modo eletrico. E o gancho que
 *   backend/tests/test_plc_runtime_host.py usa para prova que uma entrada so
 *   e amostrada uma vez por ciclo -- ver o comentario la para o raciocinio
 *   completo.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>

#include "plc_glue.h"
#include "plc_hal_stub.h"
#include "plc_hal_stub.h"
#include "plc_io_map.h"

/* Numero maximo de variaveis localizadas que este programa consegue listar
 * de uma vez (para imprimir as saidas em ordem crescente de endereco). Bem
 * acima de PLC_IO_PIN_COUNT hoje (16, pinagem 8/8 de 2026-09-17): existe folga para programas maiores
 * sem precisar mexer aqui. */
#define PLC_HOST_MAX_VARS 64

static int endereco_para_indice(const char *endereco)
{
    size_t n = plc_glue_var_count();
    char buf[32];
    for (size_t i = 0; i < n; i++) {
        plc_glue_var_address(i, buf, sizeof(buf));
        if (strcmp(buf, endereco) == 0) {
            return (int)i;
        }
    }
    return -1;
}

/* Aplica os tokens "chave=valor" de uma linha de entrada. Devolve 1 em
 * sucesso, 0 se a linha for malformada (token sem '=', valor fora de {0,1},
 * ou endereco/gpio que nao existe neste programa) -- o contrato reserva
 * codigo de saida != 0 exatamente para esse caso. Linha vazia e sucesso sem
 * efeito: "nenhuma mudanca em relacao ao ciclo anterior". */
static int aplicar_entradas(const char *linha, int eletrico)
{
    if (linha[0] == '\0') {
        return 1;
    }

    char copia[1024];
    if (strlen(linha) >= sizeof(copia)) {
        return 0;
    }
    strcpy(copia, linha);

    char *salvo = NULL;
    char *token = strtok_r(copia, " ", &salvo);
    while (token != NULL) {
        char *igual = strchr(token, '=');
        if (!igual || igual == token) {
            return 0;
        }
        *igual = '\0';
        const char *chave = token;
        const char *valor_str = igual + 1;
        if (strcmp(valor_str, "0") != 0 && strcmp(valor_str, "1") != 0) {
            return 0;
        }
        int valor = (valor_str[0] == '1') ? 1 : 0;

        if (eletrico) {
            if (strncmp(chave, "gpio", 4) != 0 || chave[4] == '\0') {
                return 0;
            }
            char *fim = NULL;
            long gpio = strtol(chave + 4, &fim, 10);
            if (!fim || *fim != '\0' || gpio < 0) {
                return 0;
            }
            plc_hal_stub_set_level((int)gpio, valor);
        } else {
            int idx = endereco_para_indice(chave);
            if (idx < 0) {
                return 0;
            }
            plc_glue_var_set((size_t)idx, valor);
        }

        token = strtok_r(NULL, " ", &salvo);
    }
    return 1;
}

static void imprimir_saidas(unsigned ciclo, int eletrico, int flip_gpio_diagnostico)
{
    printf("ciclo=%u", ciclo);

    if (eletrico) {
        for (size_t i = 0; i < PLC_IO_PIN_COUNT; i++) {
            const plc_io_pin_t *pin = &plc_io_pins[i];
            if (pin->direction != PLC_IO_OUTPUT) {
                continue;
            }
            printf(" gpio%d=%d", pin->gpio, plc_hal_stub_get_level(pin->gpio));
        }
    } else {
        /* LOCATED_VARIABLES.h (gerado pelo iec2c) traz as variaveis na ordem
         * em que aparecem no ST, que nas fixtures deste projeto ja e
         * crescente por endereco -- mas o contrato exige a ordem crescente
         * como propriedade, nao como coincidencia, entao ordena aqui
         * (insertion sort: poucas dezenas de E/S no maximo, nao vale a pena
         * puxar qsort para isso). */
        size_t n = plc_glue_var_count();
        char enderecos[PLC_HOST_MAX_VARS][32];
        size_t indices[PLC_HOST_MAX_VARS];
        size_t total = 0;
        for (size_t i = 0; i < n && total < PLC_HOST_MAX_VARS; i++) {
            char buf[32];
            plc_glue_var_address(i, buf, sizeof(buf));
            if (buf[0] == '\0' || buf[1] != 'Q') {
                continue; /* so saidas entram na linha de saida */
            }
            strcpy(enderecos[total], buf);
            indices[total] = i;
            total++;
        }
        for (size_t a = 1; a < total; a++) {
            char chave_endereco[32];
            size_t chave_indice = indices[a];
            strcpy(chave_endereco, enderecos[a]);
            size_t b = a;
            while (b > 0 && strcmp(enderecos[b - 1], chave_endereco) > 0) {
                strcpy(enderecos[b], enderecos[b - 1]);
                indices[b] = indices[b - 1];
                b--;
            }
            strcpy(enderecos[b], chave_endereco);
            indices[b] = chave_indice;
        }
        for (size_t i = 0; i < total; i++) {
            printf(" %s=%d", enderecos[i], plc_glue_var_get(indices[i]));
        }
    }

    if (flip_gpio_diagnostico >= 0) {
        printf(" leituras_gpio%d=%u", flip_gpio_diagnostico,
               plc_hal_stub_read_count(flip_gpio_diagnostico));
    }

    printf("\n");
    fflush(stdout);
}

int main(int argc, char **argv)
{
    int eletrico = 0;
    int has_flip = 0;
    int flip_gpio = 0;
    unsigned flip_na_leitura = 0;
    int flip_nivel = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--eletrico") == 0) {
            eletrico = 1;
        } else if (strncmp(argv[i], "--flip=", 7) == 0) {
            has_flip = 1;
            if (sscanf(argv[i] + 7, "%d:%u:%d", &flip_gpio, &flip_na_leitura, &flip_nivel) != 3) {
                fprintf(stderr, "plc_host_cycle_runner: argumento invalido: %s\n", argv[i]);
                return 1;
            }
        } else {
            fprintf(stderr, "plc_host_cycle_runner: argumento desconhecido: %s\n", argv[i]);
            return 1;
        }
    }

    plc_hal_stub_reset();
    plc_glue_init();

    if (has_flip) {
        plc_hal_stub_flip_on_read(flip_gpio, flip_na_leitura, flip_nivel);
    }

    char *linha = NULL;
    size_t capacidade = 0;
    ssize_t tamanho;
    unsigned long tick = 0;
    unsigned ciclo = 0;

    while ((tamanho = getline(&linha, &capacidade, stdin)) != -1) {
        while (tamanho > 0 && (linha[tamanho - 1] == '\n' || linha[tamanho - 1] == '\r')) {
            linha[--tamanho] = '\0';
        }
        ciclo++;

        if (!aplicar_entradas(linha, eletrico)) {
            fprintf(stderr, "plc_host_cycle_runner: entrada malformada no ciclo %u: \"%s\"\n",
                    ciclo, linha);
            free(linha);
            return 1;
        }

        if (eletrico) {
            plc_glue_scan(tick++);
        } else {
            plc_glue_step_logic(tick++);
        }

        plc_hal_stub_advance_us((int64_t)plc_glue_cycle_time_us());

        imprimir_saidas(ciclo, eletrico, (has_flip && eletrico) ? flip_gpio : -1);
    }

    free(linha);
    return 0;
}
