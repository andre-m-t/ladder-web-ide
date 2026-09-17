# CA-4 — Procedimento de gravação em bancada (ESP32)

> **Status:** procedimento pronto para execução manual; gabarito de evidência
> ainda vazio.
> **Autor:** André · **Data:** 2026-09-15

---

## Distinção importante: isto não é o fechamento de CA-4

O **CA-4** da spec 001 (§5) cobre a gravação **pelo navegador**, via Web
Serial API (RF-5/RF-6) — interface que ainda **não existe** nesta fatia. O
procedimento abaixo valida, por `esptool` executado diretamente no host, que
o **firmware** produzido pela metade servidor do pipeline (ST → C → `.bin`,
já provado por `backend/tests/test_esp32.py`) de fato roda em um ESP32 físico
com o mapa de pinos vigente (Q-5, revisão de 2026-09-17 — 8 entradas e 8
saídas; ver a ressalva de 2026-09-17 na seção "Nota sobre esta versão do
documento", ao final: os doze pinos acrescentados nessa revisão não têm
nenhuma evidência de bancada).

É o **pré-requisito** de CA-4 — prova que o binário é correto antes de
investir na gravação pelo navegador — e não deve ser lido como evidência de
que CA-4 fechou. A nota de rastreabilidade em `docs/specs/001-fatia-vertical-minima/spec.md`
§5 registra essa mesma ressalva.

---

## 1. Extração do `.bin`

O build automatizado (`backend/tests/test_esp32.py::test_gera_firmware_a_partir_do_st`)
grava no diretório de trabalho compartilhado do volume `esp-build-cache`
(`backend/app/config.py:esp_build_root`, `backend/app/services/esp32.py`):
`/var/cache/ladderflow/esp-build/current/build/` dentro do contêiner
`backend`. O nome do projeto é `ladderflow_plc`
(`backend/firmware/esp32-template/CMakeLists.txt`).

Gravar um ESP32 **virgem** exige três arquivos, não só o da aplicação —
confirmado ao vivo em 2026-09-15, listando o volume `esp-build-cache` após
rodar o build com o mapa de pinos revisado (Q-5, GPIO18; a ampliação para
8+8 pinos de 2026-09-17 não muda a lista de arquivos nem os offsets abaixo):

```
build/ladderflow_plc.bin
build/bootloader/bootloader.bin
build/partition_table/partition-table.bin
```

`build/flasher_args.json` (gerado pelo ESP-IDF) confirma os mesmos três
caminhos e os offsets usados no passo 2.

Com o contêiner de pé (`docker compose up -d backend`):

```bash
docker compose exec backend pytest -m slow tests/test_esp32.py -q
mkdir -p dist/firmware
for f in ladderflow_plc.bin bootloader/bootloader.bin partition_table/partition-table.bin; do
  docker compose cp "backend:/var/cache/ladderflow/esp-build/current/build/$f" dist/firmware/
done
sha256sum dist/firmware/*.bin | tee dist/firmware/SHA256SUMS
```

Se preferir não subir o `docker-compose` completo (por exemplo, para não
colidir com as portas `8000`/`5173` já em uso por outro projeto na mesma
máquina), o mesmo build e a mesma extração funcionam com `docker run` avulso,
reaproveitando o volume nomeado `esp-build-cache` e sem publicar porta
alguma:

```bash
docker run --rm -v "$(pwd)/backend:/app" \
  -v ladder-web-ide_esp-build-cache:/var/cache/ladderflow/esp-build \
  -w /app ladderflow-backend:dev \
  python -m pytest -m slow tests/test_esp32.py -q

mkdir -p dist/firmware
docker run --rm -v ladder-web-ide_esp-build-cache:/var/cache/ladderflow/esp-build \
  -v "$(pwd)/dist/firmware:/out" alpine \
  sh -c 'cp /var/cache/ladderflow/esp-build/current/build/ladderflow_plc.bin \
            /var/cache/ladderflow/esp-build/current/build/bootloader/bootloader.bin \
            /var/cache/ladderflow/esp-build/current/build/partition_table/partition-table.bin /out/'
sha256sum dist/firmware/*.bin | tee dist/firmware/SHA256SUMS
```

## 2. Gravação

Placa-alvo: ESP32 clássico (módulo WROOM-32, DevKit v1) — Q-5 da spec 001.
`esptool.py` roda no **host**, não no contêiner (precisa da porta serial).

Antes de gravar:

```bash
ls /dev/ttyUSB* /dev/ttyACM*      # identifica a porta (tipicamente /dev/ttyUSB0)
groups | grep -q dialout || echo "usuario fora do grupo dialout: sudo usermod -aG dialout $USER (relogar depois)"
```

Gravação:

```bash
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 460800 \
  --before default_reset --after hard_reset write_flash -z \
  --flash_mode dio --flash_freq 40m --flash_size detect \
  0x1000  dist/firmware/bootloader.bin \
  0x8000  dist/firmware/partition-table.bin \
  0x10000 dist/firmware/ladderflow_plc.bin
```

**Atenção ao offset do bootloader.** `0x1000` é específico do **ESP32
clássico**. No ESP32-S3/C3 o bootloader vai em `0x0`. Gravar no offset errado
é a pegadinha clássica que custa uma hora de bancada (o `esptool` não avisa;
a placa simplesmente não sobe).

## 3. O que observar

Com `backend/tests/fixtures/blink.st` gravado (Q-1):

- **LED onboard (GPIO2, `%QX0.0`)** alterna a aproximadamente 1 Hz — 25 ciclos
  de varredura de 20 ms = 500 ms aceso / 500 ms apagado (Q-1). Prova o caminho
  de saída e a temporização do ciclo de varredura.
- **Botão BOOT (GPIO0, `%IX0.0`)** segurado mantém o LED **aceso**; soltar
  retoma o piscar. Prova o caminho de leitura de entrada.
- **UART a 115.200 baud** (`esptool.py` sem `write_flash`, ou `idf.py
  monitor`) mostra o log de inicialização da *glue*. Mensagens esperadas,
  literais de `backend/firmware/esp32-template/main/plc_glue.c`:
  - vinculação de cada pino usado pelo programa —
    `"%s <-> GPIO%d (%s%s)"`, por exemplo
    `plc: __IX0_0 <-> GPIO0 (entrada, ativo em nivel baixo)` e
    `plc: __QX0_0 <-> GPIO2 (saida)`;
  - aviso de endereço localizado sem pino no mapa desta placa —
    `"%s nao tem pino no mapa desta placa; sera ignorado"`.

Com `backend/tests/fixtures/io_espelho.st` gravado (fixture da Tarefa 2,
**não** usada no teste automatizado — só na bancada):

- Aterrar **GPIO18** (`%IX0.1`) deve acender a saída em **GPIO4**
  (`%QX0.1`); soltar deve apagá-la. Confirma a revisão de Q-5 (GPIO5 → GPIO18)
  na prática, e não só na compilação.

> **Os doze pinos da revisão 2026-09-17** (`%IX0.2`–`%IX0.7` em GPIO19, 21,
> 22, 23, 32, 33; `%QX0.2`–`%QX0.7` em GPIO16, 17, 25, 26, 27, 13) **não têm
> roteiro de observação nesta versão do documento** porque nenhum deles foi
> gravado ainda — `io_espelho.st` só declara `%IX0.1`/`%QX0.1`. Estender o
> roteiro acima (mais `%IXx.y`/`%QXx.y` gravados, mais fios de teste) é
> trabalho de bancada futuro, não desta rodada.

## 4. Gabarito de evidência

Uma linha por sessão de bancada. `<revisão>` é `git rev-parse --short HEAD`
no momento da gravação.

| Data | Revisão | SHA-256 `ladderflow_plc.bin` | SHA-256 `bootloader.bin` | SHA-256 `partition-table.bin` | Placa / nº série | Porta | LED ~1 Hz | BOOT segura LED aceso | Log UART (init + avisos) | `io_espelho.st`: GPIO18→GPIO4 | Foto/vídeo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | ok / falhou / não verificado | ok / falhou / não verificado | ok / falhou / não verificado | ok / falhou / não verificado | |

*(tabela vazia — preencher a cada sessão de bancada; formato pensado para ser
citado direto no capítulo de Desenvolvimento do TCC)*

---

## Nota sobre esta versão do documento

A seção 1 (subcaminhos do `.bin` dentro de `build/`) foi conferida ao vivo em
2026-09-15, listando o volume `esp-build-cache` depois de rodar o build com o
mapa de pinos revisado. As seções 2 e 3 (gravação e observação em hardware
físico) **não foram executadas nesta rodada** — não há ESP32 conectado à
máquina onde este documento foi escrito. Ficam para a sessão de bancada, cujo
resultado preenche a tabela da seção 4.

**Nota (2026-09-17).** A pinagem foi ampliada de 2+2 para 8+8 endereços
(Q-5 da spec 001, revisão 2026-09-17), a pedido da spec 002 (editor Ladder
com até 8 entradas e 8 saídas). Os quatro pinos que este documento já
descrevia (`%IX0.0`=GPIO0, `%IX0.1`=GPIO18, `%QX0.0`=GPIO2, `%QX0.1`=GPIO4)
não mudaram. Os doze pinos novos (`%IX0.2`–`%IX0.7` em GPIO19/21/22/23/32/33;
`%QX0.2`–`%QX0.7` em GPIO16/17/25/26/27/13) só foram verificados por
`test_plc_io_map.py` (contrato header ↔ spec ↔ editor), pelo runtime
hospedeiro e pelo boot em QEMU — **nenhum deles foi gravado ou medido em
hardware físico**. Este documento continua descrevendo, em detalhe, apenas o
procedimento para os quatro pinos originais; estendê-lo aos doze novos fica
para quando houver hardware disponível.
