# Tarefas 004 — Simulação de ciclo de varredura no navegador

> **Status:** aprovado (2026-09-20) — liberado junto com o plano, na mesma
> decisão do autor
> **Plano de origem:** `plan.md` (aprovado em 2026-09-20)

Frentes, com **dono único de arquivo** (plano §8):

| Frente | Dona de |
|---|---|
| **O** — orquestrador | contrato da Etapa 0, integração, `.claude/state.md` |
| **N** — núcleo | `frontend/src/ladder/simulacao*.ts` |
| **X** — executor/back-end | `backend/**`, `THIRD_PARTY.md` |
| **D** — desenho | `components/ladder/{GradeDegrau,Simbolos,SimboloCtu}.tsx` |
| **T** — tela | `App.tsx`, `components/ide/BarraSuperior.tsx`, `components/ladder/{EditorLadder,PainelVariaveis,TabelaVariaveis}.tsx` |
| **E** — e2e | `frontend/e2e/` |
| **B** — depósito | `scripts/build-deposito.sh` |

---

## Etapa 0 — contrato (frente O, antes de qualquer frente)

- [x] **#0 — Publicar o contrato do motor e do shim**
  - Arquivos: `frontend/src/ladder/simulacao.ts` (tipos e assinaturas, sem
    implementação), cabeçalho de `frontend/src/ladder/simulacao-cli.ts`
  - Depende de: —
  - Pronto quando: `npx tsc --noEmit` limpo com o arquivo de contrato no lugar, e
    os §5.1/§5.2 do plano refletidos nele linha a linha.

## Fatia 1 — o motor medido

- [x] **#1 — Motor de simulação (núcleo puro)** — frente N
  - Arquivos: `frontend/src/ladder/simulacao.ts`
  - Depende de: #0
  - Pronto quando: `criarEstado`, `executarCiclo`, `acionarEntrada` e `reiniciar`
    implementam D-1 a D-4, D-6 e D-7; sem import de React, SVG, `localStorage`,
    relógio ou pinagem; **sem import de `serializador.ts`** (RF-7).

- [x] **#2 — Testes do motor** — frente N
  - Arquivos: `frontend/src/ladder/simulacao.test.ts`
  - Depende de: #1
  - Pronto quando: tabela-verdade por enumeração (série, ramo, ramo aninhado,
    ramo cruzado, lacuna); imagem de processo (acionamento no meio do ciclo só
    vale no seguinte); escrita visível para o degrau seguinte; ordem SET/RESET no
    mesmo ciclo; borda de subida do contador com CU preso; reinício com
    precedência sobre a contagem; `BLINK` alternando com o período esperado em
    200 ciclos; energização por nó/célula/elemento conferida célula a célula em
    pelo menos um degrau com ramo. (CA-5, CA-6 no núcleo)

- [x] **#3 — Medição de cadência** — frente N
  - Arquivos: `frontend/src/ladder/simulacao.test.ts`
  - Depende de: #1
  - Pronto quando: 50 degraus × N ciclos medidos, número registrado no teste como
    a Fatia 4 registrou os 141 ms. (CA-11)

- [x] **#4 — Shim de linha de comando** — frente N
  - Arquivos: `frontend/src/ladder/simulacao-cli.ts`
  - Depende de: #1
  - Pronto quando: lê o diagrama JSON do argumento, consome stdin e escreve
    stdout exatamente no formato do §5.2; diagrama com erro de validação sai com
    código != 0 e motivo íntegro em stderr; nenhuma referência a GPIO.

- [x] **#5 — Diagramas de referência exportados** — frente N
  - Arquivos: `frontend/src/ladder/simulacao.dourados.test.ts`,
    `backend/tests/fixtures/diagramas/*.json` (gerados)
  - Depende de: #1
  - Pronto quando: os seis cenários (`io_espelho`, `minimal`, `ramo_ou`,
    `set_reset`, `selo`, `blink`) são gravados por `toMatchFileSnapshot`, e uma
    segunda rodada sem `-u` passa sem diferença.

- [x] **#6 — `node` na imagem de teste** — frente X
  - Arquivos: `backend/Dockerfile`, `THIRD_PARTY.md`
  - Depende de: —
  - Pronto quando: `docker build -t ladderflow-backend:dev backend/` conclui e
    `docker run --rm ladderflow-backend:dev bash -lc 'node -v'` responde; Node.js
    identificado em `THIRD_PARTY.md` como ferramenta externa em processo
    separado, usada só em teste; crescimento da imagem medido e registrado.

- [x] **#7 — `SimuladorExecutor`** — frente X
  - Arquivos: `backend/tests/diferencial/executores.py`
  - Depende de: #4, #6 (contrato do §5.2 basta para começar)
  - Pronto quando: empacota sob demanda com o binário nativo do `esbuild`, em
    diretório temporário **fora do repositório**; resolve o diagrama irmão pelo
    nome do `.st` (D-11) e **falha com motivo** se ele não existir; resolução em
    três vias como o `HostRunnerExecutor`; `Executor`, `ResultadoExecucao`,
    `runner.py`, `comparador.py` e os TOMLs **inalterados**.

- [x] **#8 — Teste diferencial simulador × runtime** — frente X
  - Arquivos: `backend/tests/test_simulacao_diferencial.py`
  - Depende de: #5, #7
  - Pronto quando: os 5 cenários sem contador batem o gabarito TOML existente
    (CA-1); `BLINK` × `blink.st` roda 200 ciclos × 3 padrões por
    `comparar_execucoes` (CA-2); a mensagem de falha traz ciclo/ponto/esperado/
    obtido (CA-3); nenhuma fixture alterada; o teste **falha**, não pula, quando
    o diagrama exportado está ausente.

- [x] **#9 — README do arcabouço atualizado** — frente X
  - Arquivos: `backend/tests/diferencial/README.md`
  - Depende de: #8
  - Pronto quando: "aguardando F9" sai; o segundo executor e a forma de rodá-lo
    ficam descritos; a promessa de "nem `runner.py`, nem `comparador.py`, nem as
    fixtures precisam mudar" é confirmada com o que de fato aconteceu.

## Fatia 2 — a simulação na ferramenta

- [x] **#10 — Energização no desenho** — frente D
  - Arquivos: `components/ladder/GradeDegrau.tsx`, `Simbolos.tsx`,
    `SimboloCtu.tsx`
  - Depende de: #0
  - Pronto quando: prop `energizacao` opcional (ausente = desenho de hoje, sem
    regressão nos testes existentes); fio, símbolo e conector de ramo
    energizados por **cor e espessura** (D-12), com token por tema; marcação de
    problema intocada; nome acessível da célula informa o estado.

- [x] **#11 — Modo simulação na IDE** — frente T
  - Arquivos: `App.tsx`, `components/ide/BarraSuperior.tsx`,
    `components/ladder/EditorLadder.tsx`
  - Depende de: #0
  - Pronto quando: controles Executar/Pausar, Passo, Reiniciar e marcha
    (tempo real + lenta); relógio por quadro com teto (D-8); modo exclusivo
    (edição congelada, Compilar/Gravar/`.st` desabilitados com motivo — CA-8);
    portão de erro de validação (CA-12); em projeto ST o controle aparece
    desabilitado com motivo (CA-7); estado volátil (CA-13).

- [x] **#12 — Variáveis ao vivo e acionáveis** — frente T
  - Arquivos: `components/ladder/PainelVariaveis.tsx`, `TabelaVariaveis.tsx`
  - Depende de: #0
  - Pronto quando: a coluna "Valor" (já existente desde a #23) mostra o estado ao
    vivo; entradas são acionáveis por clique e por teclado, saídas e memórias não
    (CA-9); fora da simulação, a coluna volta a "—" sem mudança de layout.

- [x] **#13 — e2e da simulação** — frente E
  - Arquivos: `frontend/e2e/simular.spec.ts`
  - Depende de: #10, #11, #12
  - Pronto quando, em Chromium real com mouse real: degrau montado pela UI entra
    em simulação, o acionamento energiza contato e bobina e desenergiza ao soltar
    (CA-4); `BLINK` alterna a saída (CA-5); Compilar/Gravar desabilitados durante
    a simulação (CA-8); reload volta ao modo edição (CA-13).

- [x] **#14 — Manifesto do depósito** — frente B
  - Arquivos: `scripts/build-deposito.sh`
  - Depende de: #1, #4
  - Pronto quando: `simulacao.ts` e `simulacao-cli.ts` em `REQUIRED_FILES` e
    `bash scripts/build-deposito.sh --verificar` com exit 0.

## Fechamento (frente O)

- [x] **#15 — Integração, verificação e painel de estado**
  - Arquivos: `.claude/state.md`, correções do §"Correções" do plano de rodada
  - Depende de: #1–#14
  - Pronto quando: `tsc`, `vitest`, `vite build`, pytest `not slow`, e2e e
    `--verificar` verdes; verificação em Chromium real nos dois temas feita pelo
    orquestrador; divergências do R-1, se houver, investigadas e registradas;
    `state.md` atualizado no mesmo commit.

---

## Rastreabilidade

| Tarefa | Requisito(s) | Critério(s) de aceitação |
|---|---|---|
| #0 | RF-6, RF-19 | — (contrato) |
| #1 | RF-1 a RF-9 | CA-1, CA-2 |
| #2 | RF-1 a RF-8 | CA-5, CA-6 |
| #3 | RF-11 | CA-11 |
| #4 | RF-19, RF-9 | CA-1 |
| #5 | RF-19, RF-20 | CA-1, CA-2 |
| #6 | RF-19 | CA-1, CA-2 |
| #7 | RF-19, RF-20 | CA-1, CA-2 |
| #8 | RF-8, RF-20, RF-21 | CA-1, CA-2, CA-3 |
| #9 | RF-19 | — (documentação) |
| #10 | RF-6, RF-14 | CA-4, CA-10 |
| #11 | RF-10, RF-11, RF-15 a RF-18 | CA-6, CA-7, CA-8, CA-12, CA-13 |
| #12 | RF-12, RF-13 | CA-9 |
| #13 | RF-6, RF-12, RF-15 | CA-4, CA-5, CA-8, CA-13 |
| #14 | — (conformidade INPI) | — |
| #15 | RF-8 | todos |
