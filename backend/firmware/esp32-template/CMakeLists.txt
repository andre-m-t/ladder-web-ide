# Projeto ESP-IDF que transforma o C gerado pelo MATIEC em firmware do ESP32.
#
# Este diretorio e um TEMPLATE: o backend copia a arvore inteira para um
# diretorio de trabalho, deposita os arquivos gerados pelo iec2c em
# main/generated/ e roda `idf.py build` la dentro (ver
# backend/app/services/esp32.py). Nada e compilado aqui dentro do repositorio.

cmake_minimum_required(VERSION 3.16)

set(PROJECT_VER "0.1.0")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(ladderflow_plc)
