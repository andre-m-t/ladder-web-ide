# Limites da validação sem hardware

**Status:** em vigor a partir de 2026-09-15 · **Contexto:** spec 001 (caminho
curto, `docs/workflow.md`) · **Companheiro de:** `ca-4-gravacao-esp32.md`

Esta rodada acrescentou três caminhos de validação que **não** exigem um ESP32
físico. Este documento existe para impedir que eles sejam lidos como mais do que
são. O alerta metodológico já registrado em F10 do `.claude/state.md` continua
valendo palavra por palavra, e agora precisa de uma segunda camada:

> "o firmware compila" é evidência de que um componente funciona, não de que a
> integração é viável.

Ao que se acrescenta: **"o firmware roda no emulador" é evidência de que o
código executa, não de que o dispositivo funciona.**

## O que passou a ser validado, e por qual caminho

| Afirmação | Caminho | O que sustenta |
|---|---|---|
| A lógica do ciclo de varredura está correta | runtime no host | Execução real do C gerado pelo MATIEC com I/O em memória |
| A ordem lê → resolve → escreve é respeitada | runtime no host | Sequência multi-ciclo com entradas controladas |
| O mapeamento de variável localizada ↔ pino está correto | runtime no host | Comparação contra `plc_io_pins` |
| O firmware arranca e não entra em pânico | QEMU | Boot real do binário Xtensa, sem bootloop |
| O laço de varredura progride no alvo | QEMU | Contagem crescente no log serial |

## Os três caminhos, em concreto

| Caminho | Onde vive | Como rodar |
|---|---|---|
| Runtime no host | `backend/tests/test_plc_runtime_host.py` + `firmware/esp32-template/host/` | `pytest tests/test_plc_runtime_host.py` |
| Boot em QEMU | `backend/tests/test_qemu.py` + `backend/scripts/run_qemu.py` | `pytest -m slow tests/test_qemu.py` |
| Teste diferencial | `backend/tests/diferencial/` | `pytest tests/test_diferencial.py` |

### Nota sobre o QEMU: custo real e caminho de execução

O QEMU **já vinha instalado** na imagem base `espressif/idf:v5.4.1` (fork
`esp_develop_9.0.0_20240606`). O passo de instalação no `Dockerfile` foi mantido
por ser idempotente e por documentar a dependência caso a base mude. O
crescimento **medido** da imagem foi de **~214 KB** — apenas metadados do
`idf_tools.py`, não os ~13,6 MB do pacote, que nunca chega a ser baixado.

A execução usa `qemu-system-xtensa` diretamente, e não `idf.py qemu`: este
último roda com `-serial mon:stdio`, que funde a UART da aplicação com o monitor
interativo do QEMU no mesmo fluxo e inviabiliza casar a regex do log de
varredura. A invocação direta com `-serial file:<log>` isola a UART.

### Armadilha de reprodutibilidade: a imagem pode estar velha

Descoberta durante esta rodada, e capaz de produzir resultado falso sem nenhum
sinal de erro.

O comando de teste documentado na Regra 5 do `CLAUDE.md` monta o repositório em
`/repo`:

```bash
docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev ...
```

Mas `ESP_PROJECT_TEMPLATE=/app/firmware/esp32-template` aponta para a **cópia
feita em tempo de build da imagem** (`COPY firmware/` no `Dockerfile`), e o
*bind mount* em `/repo` não sobrepõe `/app`. Consequência: o `pytest` roda o
código de teste da árvore de trabalho, mas `esp32.build_firmware()` compila o
firmware **embutido na imagem**.

Enquanto só o Python muda, isso não aparece. Quando o firmware muda, o teste
passa a medir uma versão que não é a do repositório — e como ele *passa* ou
*falha* normalmente, nada denuncia a discrepância.

**Regra prática:** toda alteração em `backend/firmware/**` exige
`docker build -t ladderflow-backend:dev backend/` antes de rodar os testes que
compilam firmware (`test_esp32.py`, `test_qemu.py`). Para conferir:

```bash
docker run --rm -v "$(pwd):/repo" ladderflow-backend:dev \
  bash -lc 'sha256sum /app/firmware/esp32-template/main/app_main.c \
                      /repo/backend/firmware/esp32-template/main/app_main.c'
```

Os dois hashes têm de ser iguais. Se divergirem, o resultado do teste é sobre
outro firmware.

Os testes do runtime no host (`test_plc_runtime_host.py`) e o arcabouço
diferencial (`test_diferencial.py`) **não** sofrem disso: compilam a partir de
`/repo` via `firmware/esp32-template/host/Makefile`.

## O que continua exigindo o dispositivo físico

Nada abaixo é coberto por host nem por QEMU. Enquanto o ESP32 não chegar, estes
pontos permanecem **sem evidência**, e nenhuma conclusão do TCC pode se apoiar
neles.

### 1. Gravação via Web Serial, ponta a ponta

O critério **CA-4** da spec 001 exige gravação **pelo navegador** (RF-5/RF-6,
Web Serial API), não por `esptool` no host. Depende de F5, que não existe. O
procedimento de bancada em `ca-4-gravacao-esp32.md` é pré-requisito de CA-4, não
o critério em si — e continua pendente de execução.

Também sem evidência: a **taxa de sucesso de gravação em N tentativas** (métrica
de F10), que por definição só se mede gravando.

### 2. Tempo de ciclo de varredura real

O runtime no host executa os ciclos em sequência, o mais rápido possível, com
relógio controlado — é justamente o que o torna determinístico. O QEMU não
emula temporização fiel: o tempo dentro dele não é o tempo do silício.

Portanto o **tempo de ciclo no dispositivo** (métrica de F10) continua ⬜. Medir
se a `INTERVAL := T#20ms` do `blink.st` é de fato respeitada, e qual a margem
até o limite, é medição de bancada com instrumento.

### 3. Comportamento dos strapping pins no boot

Este é o limite mais importante, porque é o único que já causou uma revisão de
decisão no projeto sem que ninguém tivesse rodado nada.

A revisão da **Q-5** (2026-09-15) tirou `%IX0.1` do GPIO5 e o levou ao GPIO18
exatamente porque o GPIO5 é *strapping pin*: como entrada ligada a circuito
externo, nível baixo no reset impede a inicialização da placa. Essa falha é
**invisível** para os três caminhos desta rodada — no host não há reset, e no
QEMU os pinos não estão ligados a nada.

O `%IX0.0` continua no GPIO0, que também é *strapping pin* (é o botão BOOT).
Que segurá-lo no boot entra em modo de gravação em vez de executar a aplicação
é comportamento esperado do hardware, e só a bancada mostra se isso atrapalha o
uso pretendido.

**Atualização (2026-09-17).** A Q-5 recebeu uma segunda revisão, ampliando a
pinagem de 2+2 para 8+8 endereços (`%IX0.0`–`%IX0.7`, `%QX0.0`–`%QX0.7`), a
pedido da spec 002 (editor Ladder com até 8 entradas e 8 saídas). Os quatro
pinos originais não mudaram de GPIO. Os doze pinos novos
(`%IX0.2`–`%IX0.7` em GPIO19/21/22/23/32/33; `%QX0.2`–`%QX0.7` em
GPIO16/17/25/26/27/13) foram escolhidos fora das faixas de risco conhecidas
(nenhum é *strapping pin*, nenhum está na faixa do flash SPI interno, nenhuma
entrada *input-only* recebeu pull-up) — mas esse limite de método vale
**integralmente** para eles: nenhum foi gravado, nenhum foi medido, e a
travessia de bancada continua bloqueada por falta de hardware físico (F3 em
`.claude/state.md`). Concretamente, o que muda para os quatro pinos
originais é zero; para os doze novos, a situação é a mesma que este
documento já descrevia para todo o mapa antes de existir gravação alguma —
só que agora são doze pinos a menos verificados, não dois.

### 4. Estado elétrico dos pinos

Um nível em memória não é uma tensão em um pino. Nenhum dos caminhos desta
rodada valida:

- se o pull-up interno realmente segura a entrada no nível esperado
- se o LED do GPIO2 de fato acende, e com que corrente
- se `active_low` corresponde à ligação física da placa
- ruído, *bouncing* do botão, ou qualquer efeito analógico

O QEMU **não** valida estado elétrico de GPIO. Se alguma afirmação neste
repositório sugerir o contrário, está errada.

## Consequência para o texto do TCC

A validação sem hardware fecha o risco de **corretude da lógica autoral** — o
que era, até esta rodada, a maior incógnita do projeto, já que `app_main.c` e
`plc_glue.c` nunca tinham executado. Ela não fecha, e não pode fechar, o risco
de **integração com o dispositivo real**.

A distinção precisa aparecer no capítulo de Desenvolvimento nesses termos. Um
texto que dissesse "o runtime foi validado" sem qualificar por qual caminho
seria mais forte do que a evidência sustenta.
