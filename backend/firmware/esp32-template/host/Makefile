# Alvo de build do runtime PLC para o HOST (sem ESP32, sem toolchain Xtensa).
#
# So compila o DRIVER externo, plc_host_runner (main/plc_host_runner.c): e
# ele quem, a cada execucao, chama `iec2c` e `gcc` de novo para ligar o C
# gerado a partir do .st recebido ao runtime autoral (main/plc_glue.c) e a
# HAL de teste (main/plc_hal_stub.c) -- ver o comentario no topo de
# plc_host_runner.c para o raciocinio completo (por que nao da para compilar
# tudo de uma vez, aqui, neste Makefile: as variaveis localizadas so existem
# como simbolo C depois que o iec2c ve o .st especifico do usuario).
#
# OUT_DIR e onde o binario final fica. Tem um default FORA da arvore do
# repositorio de proposito: scripts/build-deposito.sh trata "build" e
# "generated" sob backend/firmware/ como contaminacao de terceiro no pacote
# de deposito do INPI, e nada que este alvo produz pode acabar versionado.
#
# Uso:
#   make -C backend/firmware/esp32-template/host
#   make -C backend/firmware/esp32-template/host OUT_DIR=/outro/caminho
#
# O binario resultante e o ponto de integracao com quem consome o contrato
# (docs/validacao/contrato-runtime-host.md): exporte
# PLC_HOST_RUNNER=$(OUT_DIR)/plc_host_runner, ou copie/symlink o binario para
# algum diretorio do PATH -- backend/tests/diferencial/executores.py e
# qualquer outro consumidor resolvem por essas duas vias, nessa ordem.

SRC_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))../main)
CC ?= gcc

OUT_DIR ?= /tmp/ladderflow-plc-host-runner

PLC_HOST_RUNNER := $(OUT_DIR)/plc_host_runner

.PHONY: all clean
all: $(PLC_HOST_RUNNER)

$(OUT_DIR):
	mkdir -p "$(OUT_DIR)"

# So plc_host_runner.c entra aqui: ele nao inclui plc_glue.h nem plc_hal.h,
# so orquestra processos (fork/exec de iec2c e gcc). O restante das fontes
# autorais (plc_host_cycle_runner.c, plc_glue.c, plc_hal_stub.c) e compilado
# por ELE, em tempo de execucao, contra o C que o iec2c acabou de gerar --
# por isso PLC_HOST_MAIN_DIR fica embutido aqui, como o caminho absoluto de
# main/, para que o binario resultante saiba onde procurar essas fontes
# depois, rodando de qualquer diretorio.
$(PLC_HOST_RUNNER): $(SRC_DIR)/plc_host_runner.c | $(OUT_DIR)
	$(CC) -std=c11 -Wall -Wextra -O2 \
	    -Wno-format-truncation \
	    -DPLC_HOST_MAIN_DIR='"$(SRC_DIR)"' \
	    -o "$@" "$<"

clean:
	rm -f "$(PLC_HOST_RUNNER)"
