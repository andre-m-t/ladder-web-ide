# Gravação via `esptool`/socket no QEMU

**Status:** em vigor a partir de 2026-09-16 · **Contexto:** spec 001, S2
(tarefa #13) · **Companheiro de:**
`docs/validacao/limites-da-validacao-sem-hardware.md` e
`ca-4-gravacao-esp32.md`

Esta rodada acrescentou um quarto caminho de validação sem hardware, sobre os
três que `limites-da-validacao-sem-hardware.md` já descreve: além de dar boot
num `.bin` mesclado pelo próprio `idf.py` (`test_qemu.py`), agora também se
prova, sem ESP32 físico, que o PROTOCOLO DE GRAVAÇÃO funciona — não só o
firmware em si.

## O que este caminho prova

- **O protocolo do `esptool` funciona contra um bootloader ROM.** `esptool`
  faz o mesmo handshake, sincronismo e sequência de `write_flash` que faria
  contra um ESP32 de verdade — só que o bootloader do outro lado é o do QEMU
  em modo download (`-global driver=esp32.gpio,property=strap_mode,
  value=0x0f`), não silício.
- **As imagens e os offsets que `POST /compile/pacote` entrega ao cliente
  bastam para reconstruir uma flash funcional.** O teste grava a flash
  usando EXATAMENTE o que a API devolveu (offsets decodificados do JSON,
  bytes decodificados de `data_base64`) — nunca `@flash_args`, nunca uma
  constante do repositório. Se o pacote estivesse com offset ou byte errado,
  o firmware não daria boot ou não chegaria a rodar o laço de varredura.
- **O firmware gravado dá boot e roda o laço.** Depois de gravar, o QEMU
  reinicia em boot normal sobre a mesma imagem de flash e o teste confere o
  MESMO contrato de saúde que `test_qemu.py` já provava para um `.bin`
  mesclado diretamente: nenhum marcador de pânico, exatamente um boot na
  janela de observação (sem *bootloop*) e o heartbeat
  `ladderflow: scan ciclo=<N>` estritamente crescente, com pelo menos três
  ocorrências.

## O que este caminho NÃO prova

Nada sobre o transporte real entre navegador e placa:

- **Web Serial no navegador.** O transporte aqui é um socket TCP
  (`tcp:127.0.0.1:<porta>,server,nowait`) local ao contêiner, não a API
  `navigator.serial` do Chrome/Edge. A camada Web Serial é código de
  terceiros (`esptool-js`) e vive inteiramente em `frontend/src/lib/
  gravador.ts` — este documento não cobre aquele caminho.
- **USB-UART físico.** Não há conversor USB-serial, driver de sistema
  operacional, nem cabo — o "cabo" aqui é um socket TCP dentro do mesmo
  contêiner Docker.
- **Auto-reset por DTR/RTS.** O modo download é forçado por
  `strap_mode=0x0f` no dispositivo QEMU (`esp32.gpio`), não pelos sinais
  DTR/RTS que o `esptool` pulsaria contra uma placa real para colocá-la em
  modo de gravação. `--before no_reset --after no_reset` foi usado
  justamente para não depender de reset nenhum.
- **Tempo de gravação real.** O `esptool` fala com um bootloader emulado
  sobre um socket local — não há latência de USB, não há velocidade real de
  flash NOR, não há handshake de baud rate sobre um cabo físico. Nenhuma
  conclusão sobre "quanto tempo leva para gravar" pode se apoiar neste
  teste.
- ***Strapping* físico de pinos.** O ESP32 real entra em modo download
  quando certos pinos (GPIO0, GPIO2, GPIO5/GPIO12 conforme a revisão) estão
  em níveis específicos no reset — normalmente um circuito de auto-reset ou
  o usuário segurando o botão BOOT. Aqui isso é simulado inteiramente por um
  argumento de linha de comando do QEMU; nenhum estado elétrico é
  verificado.

Depois desta rodada, o transporte Web Serial (navegador ↔ placa real) é a
ÚNICA camada da gravação que continua sem cobertura automatizada. É também
código da Espressif (`esptool-js`), não autoral — a fronteira de teste que
falta é justamente a que depende de hardware físico na bancada (ver
`ca-4-gravacao-esp32.md`).

## Fluxo, em concreto

Implementado em `backend/scripts/run_qemu.py`
(`flash_via_socket_and_boot` e as funções que ela orquestra:
`create_empty_flash_image`, `start_qemu_download_mode`,
`write_flash_via_esptool`, `boot_flash_image`):

1. **Cria uma flash vazia** de 4 MB, toda em `0xFF` — o estado apagado de
   uma NOR flash real.
2. **Sobe o QEMU em modo download**: `-M esp32 -m 4M` (a mesma placa virtual
   de `test_qemu.py`) mais `-global driver=esp32.gpio,property=strap_mode,
   value=0x0f` e `-serial tcp:127.0.0.1:<porta livre>,server,nowait`. A
   porta é escolhida dinamicamente (bind em `127.0.0.1:0`) e o script espera
   o socket abrir antes de seguir.
3. **Grava via `esptool`**:
   `python -m esptool --chip esp32 --port socket://127.0.0.1:<porta>
   --before no_reset --after no_reset write_flash <offset> <arquivo> …`,
   com as imagens e offsets vindos do PACOTE DA API (as três imagens de
   `POST /compile/pacote`, decodificadas de `data_base64` para arquivos
   temporários pelo teste) — nunca de `@flash_args`.
4. **Encerra** esse processo do QEMU e **sobe outro**, em boot normal
   (mesma placa, sem `strap_mode`, sem modo download), sobre a MESMA imagem
   de flash, com a UART capturada em arquivo — reaproveitando
   `boot_flash_image`, a mesma rotina que `run_qemu` usa para o caminho de
   `test_qemu.py`.
5. O teste confere o boot com o mesmo helper de `test_qemu.py`
   (`tests/qemu_boot_contrato.verificar_boot_saudavel`, extraído nesta
   rodada para as duas provas não divergirem em silêncio).

Os parâmetros de modo download (`strap_mode=0x0f` e o padrão de `-serial
tcp:…,server,nowait`) foram conferidos contra
`tools/idf_py_actions/qemu_ext.py` do ESP-IDF instalado na imagem
(`QEMU_TARGETS['esp32'].boot_mode_arg`, ESP-IDF v5.4.1) e contra
`qemu-system-xtensa -device esp32.gpio,help` (QEMU 9.0.0
`esp_develop_9.0.0_20240606`) — não foram inventados nem copiados de memória.
A referência pública é o guia da Espressif,
["Using esptool.py and espefuse.py to interact with QEMU"](https://github.com/espressif/esp-toolchain-docs/blob/main/qemu/esp32/README.md#using-esptoolpy-and-espefusepy-to-interact-with-qemu).

## Offsets observados

Não há offset hardcoded em nenhum lugar deste caminho — nem em
`esp32.flash_manifest`, nem em `run_qemu.py`, nem no teste. Os valores abaixo
são o que o build de `blink.st` produziu nesta rodada, transcritos aqui só
para referência (o teste `test_offsets_do_pacote_casam_com_flasher_args_do_build`
é o que garante isso de verdade, lendo o `flasher_args.json` do build a cada
execução):

| Imagem            | Offset   |
|---|---|
| `bootloader`       | `0x1000` (4096)  |
| `partition-table`  | `0x8000` (32768) |
| `app`              | `0x10000` (65536) |

`flash.size` observado neste build foi `"2MB"` (o `sdkconfig.defaults` do
template não fixa `CONFIG_ESPTOOLPY_FLASHSIZE`, então vale o padrão do
ESP-IDF para o alvo esp32) — também lido do `flasher_args.json`, não
assumido. A flash vazia que este caminho cria para a gravação é de 4 MB,
maior que os `2MB` configurados; isso não interfere no resultado porque os
offsets gravados (até `0x10000` + o tamanho do `.bin` da aplicação) cabem
com folga em qualquer um dos dois tamanhos.

## Como reproduzir

```bash
docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \
  python -m pytest -m slow tests/test_gravacao_qemu.py -q
```

Vale a mesma armadilha de reprodutibilidade documentada em
`limites-da-validacao-sem-hardware.md`: se `backend/firmware/**` mudou desde
o último `docker build`, refaça a imagem primeiro
(`docker build -t ladderflow-backend:dev backend/`), porque o `idf.py build`
roda contra o firmware que já veio embutido na imagem, não contra o do
*bind mount*.

## Plano B (não usado nesta rodada)

O plano previa uma alternativa com *timebox* de meio dia caso o `esptool`
sobre socket não funcionasse de forma limpa: validar offsets e integridade
por hash, e montar a flash com `esptool merge_bin` usando os offsets do
pacote em vez de gravar via protocolo. **Não foi necessário** — o fluxo
descrito acima funcionou de primeira, sem nenhuma falha de handshake ou de
sincronismo do `esptool` contra o bootloader ROM emulado. Este parágrafo
fica registrado porque o plano pedia essa transparência, não porque algo deu
errado.
