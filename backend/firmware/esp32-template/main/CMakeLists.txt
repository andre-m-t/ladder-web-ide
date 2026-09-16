# Fontes do firmware = glue autoral + C gerado pelo iec2c.
#
# POUS.c NAO entra na lista: o proprio MATIEC o inclui textualmente dentro de
# Config0.c e Res*.c (uma vez com GLOBAL_CAST vazio, outra com `static`).
# Compila-lo em separado quebraria a ligacao com simbolos duplicados.
#
# CONFIGURE_DEPENDS nao pode ser usado aqui: o ESP-IDF avalia este arquivo
# tambem em modo script, ao levantar as dependencias entre componentes, e a
# opcao e invalida nesse modo. O glob e resolvido na configuracao; a propriedade
# logo abaixo faz o CMake reconfigurar quando o conjunto de arquivos gerados
# muda (uma compilacao de outro programa ST, por exemplo).
file(GLOB PLC_GENERATED_SOURCES "${CMAKE_CURRENT_LIST_DIR}/generated/*.c")
list(FILTER PLC_GENERATED_SOURCES EXCLUDE REGEX "POUS\\.c$")

if(NOT CMAKE_SCRIPT_MODE_FILE)
    set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
                 "${CMAKE_CURRENT_LIST_DIR}/generated")
endif()

# Cabecalhos do MATIEC (iec_std_lib.h e cia., LGPL-2.1+): vem da imagem do
# container, nunca do repositorio. Ver THIRD_PARTY.md.
set(MATIEC_LIB_C_DIR "$ENV{MATIEC_LIB_DIR}/C")

# plc_hal_esp32.c e a implementacao da HAL (plc_hal.h) para este alvo, sobre
# driver/gpio.h e esp_timer.h. plc_hal_stub.c, plc_host_runner.c e
# plc_host_cycle_runner.c (implementacao para o alvo host, ver
# firmware/esp32-template/host/) ficam no mesmo diretorio mas de fora desta
# lista, de proposito: nunca sao compilados para o ESP32.
idf_component_register(
    SRCS "app_main.c" "plc_glue.c" "plc_hal_esp32.c" ${PLC_GENERATED_SOURCES}
    INCLUDE_DIRS "." "generated" "${MATIEC_LIB_C_DIR}"
    REQUIRES driver esp_timer
)

# O ESP-IDF compila com `-Werror=all`, mas nem o C gerado pelo iec2c nem os
# cabecalhos do MATIEC foram escritos sob essa regra. Os avisos rebaixados aqui
# sao exatamente os que impedem a compilacao de um programa qualquer -- o resto
# continua valendo, inclusive para o codigo autoral deste componente:
#
#   pointer-sign  vem de `__string_to_time` nos cabecalhos do MATIEC, que passam
#                 `unsigned char *` onde a libc espera `char *`; e erro fatal.
#   unused-*      a biblioteca padrao do IEC define centenas de funcoes e blocos
#                 funcionais como `static` e um programa usa uns poucos; sao
#                 avisos, silenciados so para manter o log legivel para quem
#                 escreveu Ladder, nao C.
#
# Nomear cada aviso e obrigatorio: nem `-Wno-error` nem `-Wno-error=all`
# cancelam o que a forma `-Werror=<grupo>` ja promoveu a erro (verificado com o
# gcc da toolchain).
target_compile_options(${COMPONENT_LIB} PRIVATE
    -Wno-error=pointer-sign
    -Wno-pointer-sign
    -Wno-unused-function
    -Wno-unused-variable
    -Wno-unused-but-set-variable
)
