# Tarefas 003 — Serializador Ladder → ST

> **Status:** aprovado (2026-09-18) — concluído (Fatias 1 e 2, 2026-09-18)
> **Plano de origem:** [`plan.md`](./plan.md) (aprovado em 2026-09-18; o autor liberou `/tarefas` e `/implementar` na mesma decisão)

Lista de execução. Cada tarefa é pequena, tem arquivos-alvo, dependências
explícitas e um critério de pronto verificável. `[x]` marca concluída.

## Frentes e propriedade de arquivos

A implementação roda em frentes paralelas (subagentes sonnet). O orquestrador
integra, revisa, verifica e cuida de git e do `state.md`.

| Frente | Dona de | Regra |
|---|---|---|
| **N — núcleo** | `frontend/src/ladder/**`, `backend/tests/fixtures/serializados/**` (gerados pelo vitest) | Única frente que edita o núcleo. O contrato do §5 do plano não muda sem voltar ao orquestrador |
| **B — back-end e depósito** | `backend/tests/**` (exceto `fixtures/serializados/`), `scripts/build-deposito.sh` | Não toca o front-end |
| **P — painel** | `frontend/src/components/ide/PainelInferior*.tsx` e testes | Consome `ResultadoSerializacao` só pelo contrato |
| **T — tela** | `frontend/src/App.tsx`, `App.test.tsx`, `frontend/e2e/**` | Só integra; não edita `ladder/` nem `components/` |

Comandos:
- **Front-end:** no diretório `frontend/`, rodar `npx tsc --noEmit` e `npx vitest run`. O `node_modules` já está instalado.
- **Back-end:** na imagem, pela Regra 5 do `CLAUDE.md`:
  ```bash
  docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev python -m pytest -m "not slow" -q
  ```

---

## Fatia 1 — S6a: núcleo medido

- [x] **#1 — [N] `serializar` e unitários**
  - Arquivos: `frontend/src/ladder/serializador.ts`, `serializador.test.ts`
  - Depende de: —
  - Pronto quando:
    - contrato do §5 do plano implementado, com D-1 (redução série-paralelo e fallback por nó), D-2, D-3, D-4, D-5 (tipo desconhecido, palavra reservada IEC e nomes fixos, nomes que diferem só em maiúsculas), D-7 e `mapaLinhas` de D-8;
    - unitários da lista do §6 do plano verdes, incluindo CA-6, CA-8 (núcleo) e CA-9, aninhado, cruzado, lacuna no ramo, determinismo, ASCII e pior caso;
    - `tsc` limpo.

- [x] **#2 — [N] Fixtures de diagrama e dourados**
  - Arquivos: `frontend/src/ladder/fixtures.ts`, `serializador.dourados.test.ts`, `backend/tests/fixtures/serializados/{io_espelho,minimal,ramo_ou,set_reset,selo}.st`
  - Depende de: #1
  - Pronto quando: `RAMO_OU`, `SET_RESET` e `SELO` existem conforme as definições abaixo; os cinco `.st` foram gerados por `toMatchFileSnapshot` e são ASCII; uma segunda rodada sem `-u` passa.
    - `RAMO_OU`: `a AT %IX0.0`, `b AT %IX0.1`, `q AT %QX0.0`. Degrau: NA `a` em (0,0), ramo linha 1 colunas 0–0 com NA `b` em (1,0), bobina `q`. Semântica `q = a OR b`.
    - `SET_RESET`: `liga AT %IX0.0`, `desliga AT %IX0.1`, `q AT %QX0.0`. Degrau 1: NA `liga` → `bobina_set q`. Degrau 2: NA `desliga` → `bobina_reset q`.
    - `SELO`: `partida AT %IX0.0`, `parada AT %IX0.1`, `motor AT %QX0.0`. Degrau: NA `partida` em (0,0) com ramo linha 1 colunas 0–0 e NA `motor` em (1,0); NF `parada` em (0,1); bobina `motor`. Semântica `motor = (partida OR motor) AND NOT parada`.

- [x] **#3 — [B] Fixtures TOML dos cenários novos**
  - Arquivos: `backend/tests/diferencial/fixtures/serializador/{ramo_ou,set_reset,selo}.toml`
  - Depende de: — (o gabarito vem da semântica de #2, não do texto)
  - Pronto quando: os TOMLs seguem o formato do `diferencial/README.md`, com `st = "<nome>.st"`, e o gabarito é denso nos ciclos que provam o cenário:
    - `ramo_ou`: 4 ciclos (00, 10, 01, 11 → 0, 1, 1, 1);
    - `set_reset` (entradas `liga`, `desliga` → `q`): 00→0, 10→1, 00→1 (retenção), 01→0, 00→0, 11→0 (coincidência: vence o RESET, degrau de baixo — Q-5), 10→1, 11→0;
    - `selo` (`partida`, `parada` → `motor`): 00→0, 10→1, 00→1, 01→0, 00→0, 11→0, 10→1.

    Os TOMLs ficam em subdiretório para não entrarem no `glob` de `test_diferencial.py`.

- [x] **#4 — [B] Teste diferencial do serializador**
  - Arquivos: `backend/tests/test_serializador_diferencial.py`
  - Depende de: #2, #3. Pode ser escrito em paralelo, desde que pule de forma limpa, com motivo, se o `.st` dourado ainda não existir.
  - Pronto quando:
    - `io_espelho` e `minimal`: rodam os TOMLs existentes de `diferencial/fixtures/` com `diretorio_st = fixtures/serializados`, **e** `comparar_execucoes` contra a execução do ST de referência de `fixtures/`, com as mesmas entradas;
    - `ramo_ou`, `set_reset` e `selo`: rodam os TOMLs de #3;
    - tudo com 0 divergências, pulando limpo sem `plc_host_runner`, no padrão de `test_diferencial.py`;
    - verde na imagem; `ruff check` e `ruff format --check` limpos no arquivo.

- [x] **#5 — [B] Manifesto do depósito**
  - Arquivos: `scripts/build-deposito.sh`
  - Depende de: #1
  - Pronto quando: `frontend/src/ladder/serializador.ts` está em `REQUIRED_FILES`, `--verificar` fica verde e nenhum `*.test.ts` nem `.st` dourado entra no pacote.

## Fatia 2 — S6b: IDE

- [x] **#6 — [N] Código `erro_compilacao` e busca de degrau por linha**
  - Arquivos: `frontend/src/ladder/validacao.ts` (só o tipo), `serializador.ts` (`degrauDaLinha(mapaLinhas, linha): string | null`), testes
  - Depende de: #1
  - Pronto quando: o tipo cresce sem `validarDiagrama` produzir o código novo, e `degrauDaLinha` está testado (linha dentro, fora e nas bordas de um trecho).

- [x] **#7 — [P] Aba "ST gerado"**
  - Arquivos: `frontend/src/components/ide/PainelInferior.tsx`, `PainelInferiorConteudo.tsx`, testes
  - Depende de: #1 (contrato)
  - Pronto quando:
    - nova prop opcional `stGerado?: ResultadoSerializacao`; a aba só existe quando ela é passada (projeto LD);
    - `ok` mostra um `<pre>` somente leitura com número de linha; recusa ou vazio mostra o motivo;
    - acessível no padrão das abas existentes;
    - testes cobrem a presença e ausência da aba, o texto e o motivo.

- [x] **#8 — [T] Compilar em Ladder, portão e rastreio**
  - Arquivos: `frontend/src/App.tsx`, `App.test.tsx`
  - Depende de: #6, #7
  - Pronto quando:
    - `useMemo(serializar)` em projeto LD;
    - `motivoIndisponivel` segue D-6, na ordem: erro → vazio → recusa → `undefined`;
    - `aoCompilar` em LD manda `resultado.st` ao `compilarPacote` (D-10);
    - numa `ErroCompilacao`, os diagnósticos viram `Problema` `erro_compilacao` com o `rungId` de `degrauDaLinha` (D-8), somados à lista e limpos na próxima edição ou compilação;
    - `stGerado` é passado ao painel.

    Testes: CA-5 (texto enviado = `serializar(IO_ESPELHO).st`, Gravar habilitado após sucesso), CA-7 (erro bloqueia sem chamar a API; aviso não bloqueia), CA-8 (tela), Q-1 (a aba muda após uma edição) e Q-3 (diagnóstico na linha do degrau 2 → problema do degrau 2).

- [x] **#9 — [T] e2e**
  - Arquivos: `frontend/e2e/*.spec.ts`
  - Depende de: #8
  - Pronto quando: em projeto LD com `IO_ESPELHO` montado pela UI, Compilar envia a `/compile/pacote` (interceptado por `page.route`) um corpo com `source` igual a `backend/tests/fixtures/serializados/io_espelho.st`; a resposta fabricada habilita Gravar; `bash frontend/e2e/rodar.sh` fica verde.

- [x] **#10 — Fechamento da feature**
  - Arquivos: `.claude/state.md`, este `tasks.md`
  - Depende de: #1–#9
  - Pronto quando:
    - suíte verde: `tsc`, vitest, `npm run build`, pytest `not slow` na imagem, e2e e `--verificar`;
    - verificação em Chromium real com back-end real: compilação de um diagrama LD, aba ST gerado e Compilar indisponível com erro e com vazio;
    - F8 ✅ no painel, R-1 do plano 002 quitada e a nota da #17 da spec 002 atualizada.

---

## Rastreabilidade

| Tarefa | Requisito(s) | Critério(s) de aceitação |
|---|---|---|
| #1 | RF-1, RF-2, RF-3, RF-4, RF-5, RF-8, RF-11, RF-12 | CA-6, CA-8, CA-9 |
| #2 | RF-1 a RF-4 | CA-1 a CA-4 (texto) |
| #3 | RF-1, RF-11 | CA-3, CA-4 |
| #4 | RF-1 a RF-4, RF-11 | CA-1, CA-2, CA-3, CA-4 |
| #5 | — (Regra 4 do `CLAUDE.md`) | — |
| #6 | RF-10 | Q-3 |
| #7 | RF-9 | Q-1 |
| #8 | RF-6, RF-7, RF-8, RF-9, RF-10 | CA-5, CA-7, CA-8 |
| #9 | RF-6 | CA-5 |
| #10 | todos | todos |

## Paralelismo previsto

- **Leva 1:** N (#1 → #2) ∥ B (#3, #4, #5).
- **Leva 2:** N (#6) ∥ P (#7) → T (#8 → #9).
- **Fechamento (#10):** orquestrador.
