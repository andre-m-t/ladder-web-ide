# Dia do hardware — roteiro executável de bancada

**Status:** roteiro pronto para execução; nenhum passo executado ainda —
**não há ESP32 disponível** (ver `.claude/state.md`, "Bloqueado aguardando
hardware"). **Autor:** André · **Data:** 2026-09-21
**Companheiro de:** `ca-4-gravacao-esp32.md`, `limites-da-validacao-sem-hardware.md`,
`gravacao-qemu-esptool.md`, `contrato-runtime-host.md`

---

## Como usar este documento

Quando o ESP32 chegar, a sessão de bancada provavelmente vai acontecer **uma
vez**, sem tempo para investigar do zero. Este documento não é uma
explicação — é uma sequência de passos, em ordem de risco crescente, cada um
isolando **uma** variável. Siga em ordem. Não pule para o passo 4 achando que
"vai dar certo": os passos 1–3 existem para que, se algo falhar, se saiba
exatamente onde, sem fiação nenhuma de por meio.

> ## A regra do dia
>
> **Diagnosticar, não consertar.** Se um passo falhar, registre a evidência
> (o texto exato, uma foto, o horário) na tabela da seção "Gabarito de
> evidência" e siga para o diagnóstico da seção "Falhas prováveis" — não pare
> a sessão para consertar ali mesmo. Uma correção improvisada na bancada (um
> jumper diferente, um offset "só para testar", um `sudo` de última hora)
> gasta o tempo da sessão inteira e devolve um resultado que ninguém sabe
> reproduzir depois. Corrija com calma, depois, com o registro em mãos.

Os comandos abaixo foram **copiados e encadeados** de `ca-4-gravacao-esp32.md`
e `gravacao-qemu-esptool.md` — não reinventados. Onde este documento se
afasta do texto literal da fonte (por exemplo, a etiqueta de log corrigida no
passo 2 — ver "Nota de correção" abaixo), isso está marcado explicitamente.

---

## Material físico necessário

- Placa **DevKit v1** (módulo ESP32 WROOM-32, sem PSRAM — condição que libera
  GPIO16/17, ver tabela de pinagem).
- Cabo USB **de dados** — não um cabo só de carga. Sintoma de cabo errado:
  porta não aparece em `/dev/ttyUSB*`/`/dev/ttyACM*` (ver "Falhas prováveis").
- Protoboard, 8 botões (táteis, para as 8 entradas), 8 LEDs, 8 resistores
  (~330 Ω, limitadores de corrente dos LEDs), jumpers macho-macho e
  macho-fêmea.

**Os passos 1 a 3 não exigem nenhuma fiação externa.** `blink.st` usa só o
LED onboard (GPIO2) e o botão BOOT onboard (GPIO0). A protoboard só entra no
passo 4. É possível chegar ao passo 3 com placa e cabo apenas — vale a pena
fazê-lo antes mesmo de montar a bancada de I/O, porque um problema nos
passos 1–3 (placa não aparece, não conecta, não dá boot) torna a fiação do
passo 4 prematura.

---

## Programas de referência

| Arquivo | Usado nos passos | O que exercita |
|---|---|---|
| `backend/tests/fixtures/blink.st` | 2, 3 | LED onboard (GPIO2, `%QX0.0`) piscando a ~1 Hz; botão BOOT (GPIO0, `%IX0.0`) mantendo o LED aceso enquanto pressionado |
| `backend/tests/fixtures/io_espelho.st` | 4 (cobertura mínima, 2 pinos) | `%IX0.1` (GPIO18) espelhado em `%QX0.1` (GPIO4) |
| `backend/tests/fixtures/serializados/io_espelho_8.st` + `backend/tests/fixtures/diagramas/io_espelho_8.json` | 4 (cobertura completa, 16 pinos) | os 8 pares `%IXx.y`→`%QXx.y` espelhados, um a um |

> **Nota sobre `io_espelho_8`.** Este roteiro foi escrito contando com uma
> fixture nova, produzida em paralelo nesta mesma rodada por outra frente de
> trabalho, que estende `io_espelho.st` dos 2 pinos originais para os 16 do
> mapa atual, com gabarito ciclo a ciclo no TOML do arcabouço diferencial
> (`backend/tests/diferencial/fixtures/serializador/io_espelho_8.toml`, no mesmo formato de
> `io_espelho.toml`). **No momento em que este documento foi escrito, os
> arquivos `backend/tests/fixtures/serializados/io_espelho_8.st` e
> `backend/tests/fixtures/diagramas/io_espelho_8.json` ainda não existiam no
> repositório** — o passo 4 abaixo está escrito para o cenário em que eles
> existirem na hora da bancada. Se a sessão acontecer antes deles chegarem,
> use `io_espelho.st` (2 pinos) para a etapa "cobertura mínima" e trate a
> "cobertura completa" (16 pinos) como pendente, não como falha do passo 4.

---

## Passo 0 — Extrair as 3 imagens do build e conferir sha256

**Isola:** o artefato que será gravado — garante que o `.bin` corresponde ao
firmware do repositório, não a uma imagem Docker desatualizada (a "armadilha
de reprodutibilidade" de `limites-da-validacao-sem-hardware.md`).

### 0.1 — Confirmar que a imagem Docker não está velha

Se **qualquer coisa** em `backend/firmware/**` mudou desde o último
`docker build`, refaça a imagem antes de continuar:

```bash
docker build -t ladderflow-backend:dev backend/
```

Para conferir sem refazer o build (compara o firmware embutido na imagem
contra o da árvore de trabalho):

```bash
docker run --rm -v "$(pwd):/repo" ladderflow-backend:dev \
  bash -lc 'sha256sum /app/firmware/esp32-template/main/app_main.c \
                      /repo/backend/firmware/esp32-template/main/app_main.c'
```

**Resultado esperado:** os dois hashes SHA-256 impressos são **idênticos**.

**Se não aparecer:** os hashes divergem → a imagem está velha. Rode
`docker build -t ladderflow-backend:dev backend/` e repita a checagem antes
de seguir. Gravar a partir de uma imagem velha produz um `.bin` de outro
código, **sem acusar erro nenhum** — não prossiga sem resolver isto.

### 0.2 — Rodar o build e extrair as 3 imagens

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

**Resultado esperado:** `test_esp32.py` termina com `passed`; em seguida, três
arquivos em `dist/firmware/` (`ladderflow_plc.bin`, `bootloader.bin`,
`partition-table.bin`) e um `SHA256SUMS` com três linhas de hash. **Copie os
três hashes para a tabela de evidência (seção final) antes de gravar** — são
a prova de qual binário foi gravado nesta sessão.

**Se não aparecer:** se o `pytest` falhar, pare aqui — não há artefato para
gravar. Se os arquivos não aparecerem em `dist/firmware/`, confira se o volume
nomeado é mesmo `ladder-web-ide_esp-build-cache` (`docker volume ls | grep
esp-build-cache`; o prefixo depende do nome do diretório do projeto no
Compose).

---

## Passo 1 — Gravação por `esptool` de linha de comando

**Isola:** o firmware em si, tirando o navegador (Web Serial, `esptool-js`)
inteiramente da equação. Se este passo falhar, o problema é do firmware ou do
hardware — nunca do transporte do navegador.

Antes de gravar, identifique a porta e o grupo `dialout`:

```bash
ls /dev/ttyUSB* /dev/ttyACM*      # identifica a porta (tipicamente /dev/ttyUSB0)
groups | grep -q dialout || echo "usuario fora do grupo dialout: sudo usermod -aG dialout $USER (relogar depois)"
```

**Resultado esperado:** pelo menos um dispositivo listado (`/dev/ttyUSB0` na
maioria dos casos com DevKit v1/CH340 ou CP210x). O segundo comando não
imprime nada se o usuário já está no grupo `dialout`.

**Se não aparecer:** nenhum `/dev/ttyUSB*`/`/dev/ttyACM*` → ver "Falhas
prováveis", linha 1. Mensagem de grupo → rodar o `usermod` sugerido e
**reabrir a sessão** (logout/login, não só o terminal) antes de continuar.

Gravação (offset `0x1000` é específico do **ESP32 clássico** — ver alerta
abaixo):

```bash
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 460800 \
  --before default_reset --after hard_reset write_flash -z \
  --flash_mode dio --flash_freq 40m --flash_size detect \
  0x1000  dist/firmware/bootloader.bin \
  0x8000  dist/firmware/partition-table.bin \
  0x10000 dist/firmware/ladderflow_plc.bin
```

**Resultado esperado:** `esptool` imprime o handshake (`Connecting....`,
`Chip is ESP32-D0WDQ6...`), grava as três imagens com barra de progresso até
100%, e termina com `Hash of data verified.` e `Hard resetting via RTS pin...`
(código de saída `0`).

**Se não aparecer:** trava em `Connecting....` → ver "Falhas prováveis",
linha 2 (segurar BOOT). Erro de verificação de hash → repetir a gravação
antes de suspeitar do arquivo; se persistir, conferir o `SHA256SUMS` do
passo 0 contra o arquivo em disco.

> ⚠️ **Atenção ao offset do bootloader.** `0x1000` vale para o **ESP32
> clássico** (o alvo desta fatia — WROOM-32/DevKit v1, Q-5 da spec 001). No
> ESP32-S3/C3 o bootloader vai em `0x0`. O `esptool` **não avisa** se o offset
> estiver errado — a placa simplesmente não sobe, sem nenhuma mensagem de
> erro na gravação. Confira o alvo físico antes de copiar este comando para
> outra placa.

---

## Passo 2 — Boot e heartbeat no dispositivo

**Isola:** que o firmware **executa** no silício — não só que foi gravado.

Abra a UART a 115 200 baud (`esptool.py` sem `write_flash`, ou `idf.py
monitor`) e pressione o botão **EN/RESET** da placa (ou desconecte/reconecte
o USB) para forçar um boot limpo:

```bash
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 115200 chip_id
# ou, dentro do ambiente com o projeto IDF disponível:
# idf.py -p /dev/ttyUSB0 monitor
```

**Resultado esperado — três critérios, na ordem em que aparecem no log:**

1. **Nenhum marcador de pânico.** Não deve aparecer `Guru Meditation Error`
   nem `abort() was called` em nenhum ponto do log.
2. **Um único banner de reset** na janela de observação — uma linha
   `rst:0x... (...)`. Mais de um banner de reset é **bootloop**; zero é
   "nunca chegou a dar boot".
3. **Heartbeat estritamente crescente**, no formato exato
   `ladderflow: scan ciclo=<N>` (uma linha a cada 50 ciclos de varredura —
   `PLC_HEARTBEAT_CICLOS` em `app_main.c`), com pelo menos três ocorrências e
   `N` sempre maior que a leitura anterior. Linha completa esperada (o `I
   (313)` é o prefixo padrão do `ESP_LOGI`, o número entre parênteses é o
   timestamp em milissegundos desde o boot — varia a cada execução):
   ```
   I (313) ladderflow: scan ciclo=50
   I (1313) ladderflow: scan ciclo=100
   ```
   Estes três critérios são **exatamente** os que
   `backend/tests/qemu_boot_contrato.py::verificar_boot_saudavel` já confere
   contra o QEMU (`PANIC_MARKERS`, `RESET_BANNER_RE`, `HEARTBEAT_RE`) — é o
   mesmo contrato, agora contra silício em vez de emulador.

   Também deve aparecer, uma vez, uma linha de vinculação de pino por
   endereço localizado usado no programa gravado. Para `blink.st`:
   ```
   I (250) plc_hal: __IX0_0 <-> GPIO0 (entrada, ativo em nivel baixo)
   I (250) plc_hal: __QX0_0 <-> GPIO2 (saida)
   ```
   > **Nota de correção em relação a `ca-4-gravacao-esp32.md`.** Aquele
   > documento (seção 3) transcreve essas linhas com o prefixo `plc:`. Em
   > `backend/firmware/esp32-template/main/plc_hal_esp32.c:17`, a tag do
   > `ESP_LOG` é `static const char *TAG = "plc_hal"` — o prefixo real no log
   > é **`plc_hal:`**, não `plc:`. Este documento usa a tag correta.
   > `ca-4-gravacao-esp32.md` não foi alterado (é registro datado); mas quem
   > for grepar o log durante a bancada deve procurar por `plc_hal:`, não por
   > `plc:` — reporte isto se a correção não bastar.

**Se não aparecer:** ver "Falhas prováveis" — linhas 3 e 4 (bootloop/panic;
LED não pisca mas heartbeat sobe).

---

## Passo 3 — Strapping pins no reset: GPIO0 solto × pressionado

**Isola:** o risco nº 3 de `limites-da-validacao-sem-hardware.md` — o único
já registrado que causou uma revisão de decisão (Q-5) sem que ninguém tivesse
rodado nada. `%IX0.0` = GPIO0 é o botão BOOT: nível baixo no reset entra em
modo de gravação em vez de executar a aplicação.

Com `blink.st` já gravado (passo 1) e o firmware já dando boot (passo 2):

1. **GPIO0 solto no reset** — pressione e solte **EN/RESET** sem tocar em
   BOOT. **Resultado esperado:** o firmware dá boot normal (mesmos três
   critérios do passo 2) e o LED (GPIO2) começa a piscar a ~1 Hz (25 ciclos
   de 20 ms = 500 ms aceso / 500 ms apagado).
2. **GPIO0 pressionado no reset** — segure **BOOT**, pressione e solte
   **EN/RESET**, e só então solte **BOOT**. **Resultado esperado:** a placa
   entra em modo de gravação (download) em vez de rodar a aplicação — a UART
   não mostra o log de `app_main.c`; um `esptool.py --port /dev/ttyUSB0
   chip_id` nesse estado deve conectar e responder. **Isto é o comportamento
   correto do strapping pin, não uma falha do firmware.**
3. **BOOT pressionado durante a execução normal** (não no reset) — com o
   firmware já rodando (LED piscando), segure BOOT. **Resultado esperado:**
   o LED fica **aceso** continuamente enquanto o botão estiver pressionado
   (o programa lê `%IX0.0` e força `led := TRUE`); soltar retoma o piscar.
   Isto prova o caminho de leitura de entrada em runtime, e é distinto do
   caso 2 — aqui BOOT é lido como entrada do programa, porque o reset já
   tinha acontecido antes de pressionar.

**Se não aparecer:** se o caso 1 falhar mas o caso 2 funcionar (placa boota
só com BOOT pressionado durante o reset), há um problema elétrico externo
puxando GPIO0 para baixo — não deveria haver nada ligado a GPIO0 nesta etapa
(nenhuma fiação externa é necessária até o passo 4). Confira se algum jumper
do passo 4 já foi conectado por engano.

---

## Passo 4 — Entradas e saídas contra tabela-verdade

**Isola:** o mapa endereço IEC → GPIO — o único passo que exige a protoboard.

### 4.1 — Montagem

Para cada entrada testada: botão entre o GPIO e GND (as entradas do mapa têm
pull-up interno habilitado — ver tabela de pinagem — então o nível de repouso
é alto e pressionar o botão leva a GND, nível baixo). Para cada saída
testada: GPIO → resistor (~330 Ω) → LED → GND.

### 4.2 — Cobertura mínima (2 pinos) — `io_espelho.st`

Grave `backend/tests/fixtures/io_espelho.st` (repita o passo 1 com este
`.st` no lugar de `blink.st`, extraindo o `.bin` correspondente no passo 0).
Ligue um botão em **GPIO18** (`%IX0.1`) e um LED em **GPIO4** (`%QX0.1`).

**Resultado esperado:** aterrar GPIO18 (pressionar o botão) acende o LED em
GPIO4; soltar apaga.

### 4.3 — Cobertura completa (16 pinos) — `io_espelho_8`

Se `backend/tests/fixtures/serializados/io_espelho_8.st` e
`backend/tests/fixtures/diagramas/io_espelho_8.json` já existirem no
repositório na hora da bancada (ver nota em "Programas de referência"): grave
esse `.st` e monte os 8 pares de botão/LED, um para cada linha da tabela de
pinagem abaixo. Para cada par `%IXx.y` → `%QXx.y`, pressione o botão de
entrada e confira que o LED de saída correspondente acende, e que **nenhum
outro** LED muda de estado (prova que não há cruzamento entre pares).

O **gabarito ciclo a ciclo** desta fixture (quais entradas em qual ciclo
produzem qual saída) está no TOML do arcabouço diferencial —
`backend/tests/diferencial/fixtures/serializador/io_espelho_8.toml`, no formato de
`io_espelho.toml` (`st`, `ciclos`, `[[entradas]]`, `[[saidas_esperadas]]`).
Use-o para decidir a sequência de pressionar/soltar se quiser reproduzir uma
sessão específica em vez de só validar par a par.

**Resultado esperado:** cada um dos 8 pares espelha independentemente,
conforme o gabarito do TOML.

**Se não aparecer:** ver "Falhas prováveis", linha 5 (entrada não responde).
Se os arquivos de `io_espelho_8` não existirem ainda, registre a cobertura
mínima (4.2) como feita e a completa (4.3) como pendente — não é falha deste
passo, é uma fixture que ainda não chegou.

---

## Passo 5 — Gravação pelo navegador (Web Serial)

**Isola:** o transporte `esptool-js`/Web Serial, ponta a ponta. **Este passo
fecha o CA-4** da spec 001 — os passos 1–4 são pré-requisito, não o critério
em si (ver a "Nota de rastreabilidade (CA-4)" em
`docs/specs/001-fatia-vertical-minima/spec.md` §5).

1. Suba o stack (`docker compose up -d`, ou os contêineres avulsos
   equivalentes — sem colidir com as portas `8000`/`5173` já ocupadas por
   outro projeto nesta máquina, Regra 5 do `CLAUDE.md`) e abra o frontend em
   Chrome/Edge 89+, em `localhost` (Web Serial exige contexto seguro —
   HTTPS ou `localhost`).
2. Cole `blink.st` na caixa de texto e clique **Compilar**.
3. Clique **Gravar**, selecione a porta serial da placa no diálogo do
   navegador, confirme.

**Resultado esperado:** painel mostra "3 imagens prontas" após compilar;
depois de Gravar, uma barra de progresso de 0 a 100%; ao final, a placa
reinicia e o comportamento do passo 2/3 se repete (LED piscando, BOOT
segurando o LED aceso) — mas agora gravado pelo navegador, não por
`esptool.py` de linha de comando.

**Se não aparecer:** diálogo de porta não abre → ver "Falhas prováveis",
linha 6 (Web Serial indisponível). Gravação começa e falha no meio → anote em
qual % parou (é dado para a taxa de sucesso do passo 6) e o texto exato do
erro classificado pelo `frontend/src/lib/gravador.ts` (`sem_web_serial`,
`porta_nao_selecionada`, `falha_conexao`, `porta_desconectada`,
`falha_gravacao`).

---

## Passo 6 — Taxa de sucesso de gravação em N tentativas

**Isola:** a métrica de F10 "taxa de sucesso de gravação em N tentativas" —
por definição, só se mede gravando de verdade, repetidamente.

Repita o passo 5 (gravação pelo navegador) **N vezes seguidas** (sugestão:
N = 10, sem trocar cabo, porta ou placa entre tentativas) e registre cada
resultado.

| Tentativa | Sucesso? | Se falhou: em que % parou, e código de erro |
|---|---|---|
| 1 | | |
| ... | | |
| N | | |

**Resultado esperado a reportar:** `sucessos / N`. Não há gabarito de "quanto
é aceitável" — é uma medição descritiva para o capítulo de Desenvolvimento,
não um critério de aprovação/reprovação.

**Se não aparecer:** se a taxa de sucesso for baixa (menos de 8/10, por
exemplo), **não conserte na hora** — registre os códigos de erro de cada
falha (regra do dia) e trate como achado, não como bug a caçar na bancada.

---

## Passo 7 — Tempo de ciclo de varredura real

**Isola:** a métrica de F10 "tempo de ciclo de varredura no dispositivo" — o
único dos três caminhos sem hardware (host, QEMU, diferencial) que não pode
medir isto, porque nenhum dos dois emula temporização fiel de silício (ver
`contrato-runtime-host.md` e `limites-da-validacao-sem-hardware.md`, seção
"Tempo de ciclo de varredura real").

Com `blink.st` gravado e rodando (`INTERVAL := T#20ms`, 25 ciclos por
metade do período de piscar):

1. Com um **osciloscópio ou analisador lógico** na GPIO2, meça o período
   completo de uma transição aceso→apagado→aceso (deve corresponder a
   50 ciclos de varredura).
2. Divida o período medido por 50 para obter o tempo médio de um ciclo de
   varredura.
3. Compare contra os `T#20ms` nominais da `TASK` — a margem entre o medido e
   o nominal é o dado que interessa (não só "bateu" ou "não bateu").

Sem osciloscópio/analisador lógico disponível, alternativa menos precisa:
cronometrar manualmente 20 transições do LED com um cronômetro e dividir o
tempo total por (20 × 25) ciclos — suficiente para detectar um desvio grosseiro
(por exemplo, se o firmware estiver rodando a metade ou o dobro da velocidade
esperada), insuficiente para medir a margem fina até o limite de `T#20ms`.

**Resultado esperado a reportar:** tempo médio de ciclo medido, e a margem
percentual em relação aos 20 ms nominais.

**Se não aparecer:** desvio grande (>10–20%) do nominal → registre e não
tente ajustar `xTaskDelayUntil`/prioridade da task na bancada; é achado para
investigar depois, com calma (regra do dia).

---

## Tabela de pinagem completa (do `plc_io_map.h`, não de memória)

Fonte: `backend/firmware/esp32-template/main/plc_io_map.h` (revisão Q-5,
2026-09-17). **Marcados como strapping pin** os que exigem cuidado
específico no reset.

| Endereço IEC | GPIO | Direção | `active_low` | `pull_up` | Observação |
|---|---|---|---|---|---|
| `%IX0.0` | **GPIO0** | entrada | sim | sim | **Strapping pin.** É o botão BOOT onboard. Nível baixo no reset entra em modo de gravação em vez de executar — é exatamente o que o passo 3 investiga. |
| `%IX0.1` | GPIO18 | entrada | não | sim | Livre; par de GPIO18/19 nos headers da DevKit v1. |
| `%IX0.2` | GPIO19 | entrada | não | sim | Livre; sem papel no boot. Não gravado em hardware antes desta rodada. |
| `%IX0.3` | GPIO21 | entrada | não | sim | Pino padrão de I2C SDA quando essa periferia é usada; aqui é GPIO digital comum. |
| `%IX0.4` | GPIO22 | entrada | não | sim | Pino padrão de I2C SCL quando essa periferia é usada; aqui é GPIO digital comum. |
| `%IX0.5` | GPIO23 | entrada | não | sim | VSPI MOSI só quando essa periferia é ativada; sem papel no boot. |
| `%IX0.6` | GPIO32 | entrada | não | sim | RTC GPIO / ADC1; sem papel no boot. |
| `%IX0.7` | GPIO33 | entrada | não | sim | RTC GPIO / ADC1, mesma família do GPIO32. |
| `%QX0.0` | **GPIO2** | saída | não | — | **Strapping pin.** LED onboard da DevKit v1. |
| `%QX0.1` | GPIO4 | saída | não | — | Livre. |
| `%QX0.2` | GPIO16 | saída | não | — | Só está livre porque o alvo é **WROOM-32 sem PSRAM** — em módulos WROVER com PSRAM este pino é reservado. |
| `%QX0.3` | GPIO17 | saída | não | — | Mesma ressalva do GPIO16 — livre só por não haver PSRAM. |
| `%QX0.4` | GPIO25 | saída | não | — | Capaz de DAC1; usado aqui só como saída digital. |
| `%QX0.5` | GPIO26 | saída | não | — | Capaz de DAC2; usado aqui só como saída digital. |
| `%QX0.6` | GPIO27 | saída | não | — | Sem papel no boot. |
| `%QX0.7` | **GPIO13** | saída | não | — | **Compartilha MTCK com JTAG** quando há depurador externo conectado; sem depurador, comporta-se como GPIO comum. |

**GPIOs deliberadamente evitados** (registrado aqui para não serem
"descobertos" na bancada como se fosse falta de mapeamento):

- **GPIO5, GPIO12, GPIO15** — strapping pins, evitados por decisão (mesmo
  critério que tirou `%IX0.1` do GPIO5 na revisão Q-5 original).
- **GPIO6–GPIO11** — pinos do flash SPI interno; usá-los derruba a placa.
- **GPIO34–GPIO39** — *input-only*, sem pull-up interno disponível; o mapa
  não os usa porque todas as entradas do projeto dependem de pull-up
  interno.

---

## Falhas prováveis e primeiro diagnóstico

| # | Sintoma | Causa mais provável | Primeira coisa a checar |
|---|---|---|---|
| 1 | Placa não aparece em `/dev/ttyUSB*`/`/dev/ttyACM*` | Driver CH340/CP210x não instalado; ou cabo USB **só de carga** (sem linhas de dado) | `lsusb` mostra o chip USB-serial? Trocar o cabo por um confirmadamente de dados antes de suspeitar de driver |
| 2 | `esptool` não conecta (trava em `Connecting....`) | Placa não entrou em modo de gravação sozinha (sem circuito de auto-reset por DTR/RTS, ou circuito presente mas não reconhecido) | Segurar **BOOT** durante o handshake do `esptool` (do início do comando até aparecer `Connecting....` ou logo depois) |
| 3 | Bootloop ou *panic* na UART (`Guru Meditation Error`, `abort() was called`, ou banner `rst:0x...` repetido) | Firmware com erro real, ou strapping pin (GPIO0/2/5/12/15) em nível inesperado no reset por fiação externa | Confirmar que nenhuma fiação do passo 4 está ligada ainda (passos 1–3 não exigem fiação); se já estiver, desconectar tudo e repetir o passo 2 isolado |
| 4 | LED não pisca mas o heartbeat `scan ciclo=<N>` sobe na UART | Firmware rodando corretamente, mas GPIO2 não configurado/ligado (`gpio_config` falhou) ou LED onboard queimado/pino danificado | Procurar na UART a linha `plc_hal: GPIOxx: gpio_config falhou (...)` ou `__QX0_0: GPIO2 nao pode ser configurado; pino ignorado` — se aparecer, é aviso do próprio firmware, não hipótese |
| 5 | Entrada não responde (botão pressionado não muda a saída) | Pull-up não habilitado de fato, `active_low` trocado na cabeça de quem fiou, fio solto na protoboard, ou botão ligado ao pino errado | Medir com multímetro o nível do GPIO em repouso (deve ser alto, pull-up interno) e pressionado (deve cair para próximo de 0V); conferir contra a coluna `active_low`/`pull_up` da tabela de pinagem |
| 6 | Navegador não oferece porta serial (diálogo do Web Serial não abre, ou abre vazio) | Não é HTTPS nem `localhost`; ou navegador não é Chrome/Edge 89+; ou a extensão/política do SO bloqueia Web Serial | Conferir a URL da aba (precisa ser `http://localhost:...` ou HTTPS) e a versão do navegador (`chrome://version`) antes de suspeitar da placa |

---

## Gabarito de evidência

Uma linha por sessão de bancada. `<revisão>` é `git rev-parse --short HEAD`
no momento da gravação. Estende o gabarito da seção 4 de
`ca-4-gravacao-esp32.md` para cobrir os passos 0–7; mesmo formato, pensado
para ser citado direto no capítulo de Desenvolvimento do TCC.

| Data | Revisão | SHA-256 `ladderflow_plc.bin` | SHA-256 `bootloader.bin` | SHA-256 `partition-table.bin` | Placa / nº série | Porta | P0: hashes de imagem batem | P1: `esptool` grava (CLI) | P2: boot + heartbeat crescente | P3: GPIO0 solto/pressionado no reset | P4: tabela-verdade (2 pinos / 16 pinos) | P5: gravação pelo navegador (CA-4) | P6: sucessos/N | P7: tempo de ciclo medido (margem vs. 20 ms) | Foto/vídeo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | ok / falhou | ok / falhou / não verificado | ok / falhou / não verificado | ok / falhou / não verificado | ok / falhou / não verificado (indicar 2 ou 16 pinos) | ok / falhou / não verificado | _/N_ | _ms (±_%)_ | |

*(tabela vazia — preencher a cada sessão de bancada)*

---

## Nota sobre esta versão do documento

Escrito em 2026-09-21, sem ESP32 disponível — nenhum passo acima foi
executado. Os comandos dos passos 0–2 e a tabela de pinagem foram conferidos
palavra por palavra contra `ca-4-gravacao-esp32.md`,
`gravacao-qemu-esptool.md`, `contrato-runtime-host.md` e
`plc_io_map.h`; os passos 3, 5, 6 e 7 e a tabela de falhas prováveis são
roteiro novo desta rodada, desenhado a partir dos limites já registrados em
`limites-da-validacao-sem-hardware.md` (não há fonte anterior a copiar para
eles, porque nenhum caminho sem hardware os cobre). A correção do prefixo de
log (`plc_hal:` em vez de `plc:`, passo 2) foi conferida diretamente contra
`backend/firmware/esp32-template/main/plc_hal_esp32.c:17`.
