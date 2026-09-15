# Spec 001 — Fatia vertical mínima: ST → compilação → gravação

> **Status:** rascunho (semente / exemplo de referência)
> **Autor:** André  ·  **Data:** 2026-09-09
> **Princípios aplicáveis:** §2, §3, §5, §6, §7, §9

Esta especificação descreve **o quê** e **o porquê**. Não descreve *como*.

> Esta é a **primeira spec** do projeto e serve também de **exemplo** do formato
> esperado. Ela existe para forçar, o quanto antes, o caminho fim-a-fim mais
> estreito possível do LadderFlow (cf. §2). O editor visual e o simulador são
> deliberadamente deixados de fora e virão nas specs 002+.

---

## 1. Objetivo e contexto

O LadderFlow tem valor apenas quando o caminho completo funciona: uma lógica
sai do navegador, é compilada remotamente e chega gravada no ESP32, sem nada
instalado na máquina do usuário. Antes de investir no editor visual e no
simulador, é preciso provar que esse "tubo" existe e é confiável.

Esta feature entrega esse tubo na forma mais crua: o usuário **cola** um trecho
curto de Structured Text (ST) em uma caixa de texto, clica em um botão, o
back-end compila via MATIEC + toolchain ESP32, e o navegador grava o binário
resultante no ESP32 conectado via Web Serial. É a fatia vertical mínima do
roadmap ("Pipeline completo de compilação e gravação").

## 2. Usuários e cenário de uso

**Usuário:** o próprio time de desenvolvimento e, depois, um estudante de
automação avaliando a viabilidade da ferramenta.

**Cenário:** a pessoa abre a aplicação em `localhost` (ou HTTPS), conecta um
ESP32 por USB, cola um ST de exemplo que faz um LED piscar (ou espelha uma
entrada em uma saída), clica em "Compilar e gravar", acompanha o progresso e,
ao final, vê o ESP32 executando a lógica. Se o ST tiver erro, ela vê as
mensagens do compilador e nada é gravado.

## 3. Histórias de usuário

- Como **desenvolvedor**, quero enviar um ST arbitrário e recebê-lo compilado,
  para validar a integração com o MATIEC e a toolchain.
- Como **avaliador**, quero gravar o resultado no ESP32 direto do navegador,
  para confirmar que não preciso instalar toolchain nem driver.
- Como **usuário**, quero ver os erros de compilação quando o ST é inválido,
  para corrigir sem adivinhação.

## 4. Requisitos funcionais

- **RF-1.** A aplicação deve apresentar um campo de texto multilinha para o
  usuário inserir código Structured Text e um botão para iniciar o processo.
- **RF-2.** Ao acionar o botão, a aplicação deve enviar o ST ao serviço de
  compilação e indicar visualmente que a compilação está em andamento.
- **RF-3.** Quando a compilação **tem sucesso**, a aplicação deve obter o
  firmware binário e habilitar a etapa de gravação.
- **RF-4.** Quando a compilação **falha**, a aplicação deve exibir as mensagens
  de erro retornadas pelo compilador e **não** deve oferecer gravação.
- **RF-5.** A aplicação deve permitir ao usuário selecionar a porta serial do
  ESP32 (via diálogo nativo da Web Serial API) e gravar o firmware obtido.
- **RF-6.** Durante a gravação, a aplicação deve exibir progresso e, ao final,
  informar sucesso ou falha da gravação.
- **RF-7.** O serviço de compilação deve rejeitar requisições cujo corpo exceda
  um limite de tamanho definido, com erro claro.
- **RF-8.** O serviço de compilação deve tratar o MATIEC (`iec2c`) e a toolchain
  como processos externos e retornar `stdout`/`stderr` deles de forma
  estruturada em caso de erro.
- **RF-9.** O escopo de ST aceito nesta feature é **"o que o `iec2c` aceitar"**:
  não há validação própria do LadderFlow além de repassar o resultado do
  compilador. (O subconjunto controlado da IEC 61131-3 é responsabilidade das
  specs do serializador/editor.)

## 5. Critérios de aceitação

- **CA-1 (RF-1/RF-2).** Dado um ST válido colado no campo, quando clico em
  "Compilar e gravar", então vejo um indicador de "compilando" e uma requisição
  é enviada ao serviço.
- **CA-2 (RF-3).** Dado um ST válido de exemplo (LED piscando), quando a
  compilação termina, então a aplicação tem um binário e o botão de gravar fica
  habilitado.
- **CA-3 (RF-4).** Dado um ST com erro de sintaxe, quando a compilação termina,
  então vejo as mensagens de erro do compilador e **não** há opção de gravar.
- **CA-4 (RF-5/RF-6).** Dado um binário compilado e um ESP32 conectado, quando
  escolho a porta e confirmo a gravação, então o firmware é transferido, vejo
  progresso, e ao final o ESP32 reinicia executando a lógica.
- **CA-5 (RF-7).** Dado um corpo de requisição acima do limite, quando envio,
  então recebo erro explícito e nenhuma compilação é iniciada.
- **CA-6 (RF-8).** Dado um ST inválido, quando a compilação falha, então a
  resposta do serviço contém as mensagens do `iec2c` em campo estruturado
  (não um erro 500 genérico).

## 6. Requisitos não-funcionais

- Navegador: Chrome/Edge 89+; a gravação depende da Web Serial API.
- Contexto seguro obrigatório (HTTPS ou `localhost`) — cf. §7.
- Compilação de um ST curto deve concluir em tempo interativo em máquina de dev
  (meta: dezenas de segundos, não minutos) — número a refinar no plano.
- Mensagens de erro em português na interface; saída bruta do compilador pode
  permanecer no idioma original.

## 7. Fora de escopo

- Editor visual Ladder e serialização Ladder → ST (spec 002+).
- Simulador de ciclo de varredura (spec 003+).
- Validação/normalização do ST pelo LadderFlow além de repassar o `iec2c`.
- Persistência de projetos, contas de usuário, histórico.
- Suporte a variantes do ESP32 além do clássico (§9).
- Seleção de placa/pinos por interface — assume-se um alvo fixo nesta fatia.
- Autenticação/rate-limiting do serviço de compilação além do limite de tamanho.

## 8. Dependências

- Nenhuma spec anterior.
- Recursos externos: imagem de contêiner com MATIEC (`iec2c`) e toolchain de
  build do ESP32 funcionais; um ESP32 clássico físico para validar CA-4.
- `esptool-js` para a gravação no navegador.

## 9. Registro de decisões

Cada questão que precisa da decisão do autor antes da aprovação da spec. As
entradas **permanecem visíveis após decididas** — o histórico de decisões é
parte da rastreabilidade do projeto (§8) e insumo direto do capítulo de
Desenvolvimento do TCC. Ao decidir uma questão, preencha status, data,
decisão e justificativa; não apague o enunciado.

### Q-1 — ST de exemplo canônico para os testes
- **Enunciado:** Qual ST de exemplo canônico usar para os testes (piscar LED em
  GPIO fixo? espelhar entrada→saída)? Definir o pino e o comportamento.
- **Status:** decidida
- **Data da decisão:** 2026-09-10
- **Decisão:** `backend/tests/fixtures/blink.st` — pisca `%QX0.0` contando 25
  ciclos de varredura de 20 ms (500 ms ligado / 500 ms desligado) e força o LED
  aceso enquanto `%IX0.0` estiver acionada.
- **Justificativa:** um único programa exercita as duas direções de I/O
  (leitura de entrada e escrita de saída) e é observável a olho nu na bancada,
  sem instrumento. A temporização vem da contagem de ciclos, não de um bloco
  `TON`, para que o teste não dependa das funções de tempo da biblioteca do
  MATIEC nesta primeira fatia. O pino sai de Q-5.

### Q-2 — Limite de tamanho da requisição de compilação
- **Enunciado:** Limite de tamanho do corpo da requisição de compilação (RF-7): valor?
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

### Q-3 — Formato da resposta de erro estruturada
- **Enunciado:** Formato exato da resposta de erro estruturada (RF-8): campos, códigos.
- **Status:** decidida
- **Data da decisão:** 2026-09-10
- **Decisão:** envelope estável com diagnósticos extraídos da saída do
  compilador, sempre acompanhados da saída bruta íntegra:

  ```json
  {
    "stage": "matiec" | "esp32",
    "code": "compile_error" | "toolchain_error" | "timeout" | "payload_too_large",
    "message": "mensagem curta em português",
    "diagnostics": [
      {"file": "plc.st", "line": 12, "column": 5, "severity": "error", "message": "..."}
    ],
    "raw": {"stdout": "...", "stderr": "..."}
  }
  ```

  `stage` diz em qual das duas etapas externas o processo parou. `diagnostics`
  é *best-effort*: linhas que o parser não reconhecer não somem, continuam em
  `raw`.
- **Justificativa:** o `iec2c` já é invocado com `-f` justamente para preservar
  a localização do token, então `line`/`column` estão disponíveis sem custo
  adicional — permitem marcar o erro no texto hoje e mapear de volta para o
  rung quando o editor visual existir (specs 002+). Manter `raw` cumpre RF-8 ao
  pé da letra e evita que a interface fique refém da qualidade do parsing. A
  separação por `stage` importa porque um erro do ESP-IDF quase sempre indica
  defeito do LadderFlow (a *glue* do firmware), não do programa do usuário.

### Q-4 — Meta de tempo de compilação
- **Enunciado:** Meta de tempo de compilação aceitável para a fatia mínima.
- **Status:** decidida
- **Data da decisão:** 2026-09-10
- **Decisão:** meta de **≤ 30 s** para a compilação de um programa curto com o
  ambiente já aquecido, e **≤ 120 s** para a primeira compilação após subir o
  ambiente (build frio). Acima disso, a decisão de Q-6 (síncrona) deve ser
  reaberta.
- **Justificativa:** números medidos em 2026-09-10, em máquina de
  desenvolvimento, com o `blink.st` de Q-1 (as duas etapas, `iec2c` +
  `idf.py build`): **build frio 66 s**, **build incremental 11–13 s** — este
  último é o caso comum, já que entre duas compilações só mudam os arquivos
  gerados pelo `iec2c`. As metas ficam com folga sobre o medido para absorver
  máquinas mais modestas sem invalidar o contrato síncrono.

### Q-5 — Alvo fixo (placa/pinagem)
- **Enunciado:** O alvo fixo (placa/pinagem) desta fatia: qual configuração assumir?
- **Status:** decidida
- **Data da decisão:** 2026-09-10
- **Decisão:** ESP32 clássico, placa DevKit v1 (módulo WROOM-32), com o mapa
  fixo declarado em `backend/firmware/esp32-template/main/plc_io_map.h`:

  | Endereço IEC | GPIO | Observação |
  |---|---|---|
  | `%IX0.0` | 0 | botão BOOT da placa, ativo em nível baixo, pull-up interno |
  | `%IX0.1` | 5 | entrada livre, pull-up interno |
  | `%QX0.0` | 2 | LED embarcado da DevKit v1 |
  | `%QX0.1` | 4 | saída livre |

  Endereço localizado sem pino no mapa é ignorado com aviso no log serial do
  dispositivo; pino do mapa não usado pelo programa simplesmente não é
  configurado.
- **Justificativa:** os quatro pinos cobrem entrada e saída em duplicata sem
  exigir nenhum componente externo para o teste mínimo (botão e LED já estão na
  placa). O mapa é um cabeçalho próprio, e não uma constante espalhada pela
  *glue*, porque trocar um pino é mudança de contrato com quem escreve o
  Ladder. Seleção de placa ou pinagem pela interface continua fora de escopo
  (§7).

- **Revisão (2026-09-15):** `%IX0.1` passa de **GPIO5 para GPIO18**.
  - **Motivo técnico:** GPIO5 é *strapping pin* do ESP32 e precisa estar em
    nível alto no reset. Como entrada acionada por circuito externo, um nível
    baixo no momento do boot impede a inicialização da placa — falha que se
    manifestaria só na bancada e seria lida como defeito de hardware.
  - **Decisão substituta:** GPIO18 — sem papel no boot, com pull-up interno,
    exposto no header da DevKit v1. GPIO19 fica como equivalente; GPIO21/22
    foram preservados para o par I²C padrão.
  - **`%IX0.0` mantido em GPIO0** deliberadamente: também é strapping, mas é o
    botão BOOT onboard, o que permite validar leitura de entrada sem componente
    externo. Ressalva de contrato: circuito externo em GPIO0 deve garantir
    nível alto no reset.
  - **`%QX0.0` mantido em GPIO2:** strapping, porém saída e LED onboard — o uso
    é consagrado na plataforma e não há conflito no reset.

  Tabela consolidada, em vigor após esta revisão:

  | Endereço IEC | GPIO | Observação |
  |---|---|---|
  | `%IX0.0` | 0 | botão BOOT da placa, ativo em nível baixo, pull-up interno; strapping pin — circuito externo deve garantir nível alto no reset |
  | `%IX0.1` | 18 | entrada livre, pull-up interno; não é strapping pin |
  | `%QX0.0` | 2 | LED embarcado da DevKit v1; strapping pin, uso consagrado como saída |
  | `%QX0.1` | 4 | saída livre |

### Q-6 — Compilação síncrona ou assíncrona
- **Enunciado:** A compilação é síncrona (uma requisição bloqueia até o binário)
  ou assíncrona (poll/stream de progresso)? Impacta o contrato de API.
- **Status:** decidida
- **Data da decisão:** 2026-09-10
- **Decisão:** **síncrona** — uma requisição bloqueia até o firmware ou o erro,
  com tempo limite por etapa. O servidor não guarda estado de compilação entre
  requisições.
- **Justificativa:** §2 pede a fatia mais fina que atravesse todas as camadas, e
  §6 pede servidor sem estado — uma fila de *jobs* introduziria identidade de
  requisição, ciclo de vida e limpeza de artefatos, tudo antes de o caminho
  fim-a-fim estar provado. É viável porque a compilação é incremental: o
  projeto ESP-IDF fica em um diretório de trabalho persistente e só os arquivos
  gerados pelo `iec2c` mudam entre compilações, de modo que apenas eles são
  recompilados e religados.
  **Consequências registradas:** (a) o diretório de trabalho é compartilhado,
  então duas compilações simultâneas se atropelariam — serializar o acesso é
  responsabilidade do endpoint; (b) o primeiro build após subir o ambiente é
  frio e leva minutos, o que a interface precisa comunicar; (c) migrar para
  `202 + job_id` mais tarde é **aditivo** e vira spec própria, sem invalidar
  este contrato.

## 10. Conformidade com a Constituição

- **§2 (fatia vertical):** esta spec É a fatia mínima; nada mais fino atravessa
  todas as camadas.
- **§3 (IEC 61131-3):** o resultado do `iec2c` é a autoridade nesta fatia; o
  subconjunto controlado vem depois.
- **§5 (cliente sem instalação):** entrada por caixa de texto no navegador,
  gravação por Web Serial — zero instalação local.
- **§6 (separação):** servidor só compila e devolve binário/erros; cliente não compila.
- **§7 (segurança/contexto):** exige contexto seguro; sem contorno da Web Serial.
- **§9 (alvo único/escopo acadêmico):** ESP32 clássico, alvo fixo, PoC.
