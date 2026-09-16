# Tarefas 002 — Editor Ladder visual

> **Status:** em revisão
> **Plano de origem:** [`plan.md`](./plan.md) (aprovado em 2026-09-16, com as ressalvas R-1 a R-3 da §10)

Lista de execução. Cada tarefa é pequena, tem arquivos-alvo, dependências
explícitas e um critério de pronto verificável. `[x]` marca concluída.

## Frentes e propriedade de arquivos

A implementação roda em frentes paralelas (subagentes). Para evitar conflito
em `frontend/src/ladder/`, onde tudo converge (plano §10):

| Frente | Dona de | Regra |
|---|---|---|
| **N — núcleo** | `frontend/src/ladder/**` | Única frente que edita o núcleo. Mudança de contrato (§5 do plano) sai **antes** das tarefas D/T da mesma fatia. |
| **D — desenho** | `frontend/src/components/ladder/**` | Consome o núcleo só pelo contrato; não edita `ladder/`. Se precisar de algo novo no núcleo, para e pede à frente N. |
| **T — tela** | `frontend/src/App.tsx`, `App.test.tsx`, e2e | Só integra; não edita `ladder/` nem `components/ladder/`. |
| **B — back-end e depósito** | `backend/tests/**`, `scripts/build-deposito.sh` | Não toca o front-end. |

Dentro de uma fatia, tarefas de frentes diferentes sem dependência entre si
rodam em paralelo. Comandos em contêiner (Regra 5), com
`--user "$(id -u):$(id -g)"`: front-end em `node:22-bookworm-slim`
(`npx tsc --noEmit && npx vitest run`), back-end na `ladderflow-backend:dev`.

---

## Fatia 1 — S5a: espelho construível

- [ ] **#1 — [N] Modelo, endereços e fixtures sem CTU**
  - Arquivos: `frontend/src/ladder/modelo.ts`, `enderecos.ts`, `fixtures.ts`
  - Depende de: —
  - Pronto quando: tipos do plano §5 **exceto** o membro `'ctu'` da união (entra
    em #16); `COLUNAS_POR_DEGRAU = 8`, `LINHAS_EXTRAS_MAX = 2`; `Variavel.tipo`
    só `'BOOL'`; `enderecos.ts` exporta os quatro endereços de `plc_io_map.h`;
    `IO_ESPELHO` e `MINIMAL` em `fixtures.ts`, fiéis a `io_espelho.st` e
    `minimal.st`. Reescrito a partir de `spikes/modelo/`, sem copiar arquivo;
    `tsc --noEmit` limpo.

- [ ] **#2 — [N] Validação migrada, com severidade e endereço restrito**
  - Arquivos: `frontend/src/ladder/validacao.ts`, `validacao.test.ts`
  - Depende de: #1
  - Pronto quando: `posicaoValida` e `validarDiagrama` com `Problema` do plano
    §5 (severidade e `mensagem` em português); códigos `rung_incompleto`,
    `variavel_nao_atribuida`, `variavel_inexistente`, `posicao_invalida`,
    `endereco_invalido` (fora de `enderecos.ts`), `bobina_escreve_entrada`, cada
    um com caso negativo; `IO_ESPELHO` e `MINIMAL` sem problemas. Testes com
    imports explícitos de `vitest`.

- [ ] **#3 — [N] Operações de edição da fatia 1**
  - Arquivos: `frontend/src/ladder/edicao.ts`, `edicao.test.ts`
  - Depende de: #2
  - Pronto quando: `diagramaVazio()`, `inserirElemento`, `removerElemento`,
    `declararVariavel`, `vincularVariavel` devolvem `ResultadoEdicao` sem
    mutar a entrada (teste compara com cópia congelada); recusas com motivo para
    posição inválida, célula ocupada, variável inexistente e endereço fora da
    lista; remover elemento não deixa vínculo pendente.

- [ ] **#4 — [B] Teste de acoplamento `plc_io_map.h` ↔ `enderecos.ts` (R-3)**
  - Arquivos: `backend/tests/test_plc_io_map.py`
  - Depende de: #1
  - Pronto quando: teste novo extrai os endereços do header e de
    `frontend/src/ladder/enderecos.ts` e exige igualdade dos conjuntos, com
    mensagem nomeando o endereço sobrando/faltando; teste negativo prova que o
    comparador falha com um pino a mais em qualquer lado; roda em
    `pytest -m "not slow"` na imagem.

- [ ] **#5 — [D] Grade de um degrau e símbolos básicos**
  - Arquivos: `frontend/src/components/ladder/GradeDegrau.tsx`, `Simbolos.tsx`,
    `GradeDegrau.test.tsx`
  - Depende de: #1
  - Pronto quando: SVG com trilhos e 8 células por linha, cada célula `<g>` com
    `tabIndex`, `role="button"`, `aria-label` (degrau, coluna, conteúdo),
    `onClick` e Enter disparando `aoAtivarCelula(celula)`; NA, NF e bobina
    desenhados com nome da variável; renderização é função pura das props;
    teste em jsdom sem mock.

- [ ] **#6 — [D] Paleta e painel de variáveis**
  - Arquivos: `frontend/src/components/ladder/Paleta.tsx`, `PainelVariaveis.tsx`,
    testes `.test.tsx`
  - Depende de: #1
  - Pronto quando: paleta com ferramentas NA, NF, bobina e remover, ferramenta
    ativa indicada por `aria-pressed`; painel declara variável interna ou
    localizada (endereço escolhido só entre os de `enderecos.ts`) e vincula ao
    elemento selecionado; componentes controlados por props, sem estado de
    diagrama próprio.

- [ ] **#7 — [D] `EditorLadder` da fatia 1**
  - Arquivos: `frontend/src/components/ladder/EditorLadder.tsx`,
    `EditorLadder.test.tsx`
  - Depende de: #3, #5, #6
  - Pronto quando: estado `Diagrama` + ferramenta + seleção; toda ação passa por
    `edicao.ts`; recusa exibe o motivo em `role="alert"` e não altera o
    diagrama; Esc cancela a ferramenta. Testes: **CA-1** (construir
    `IO_ESPELHO` pela UI, diagrama igual à fixture, `validarDiagrama` vazio),
    **CA-2** (idem `MINIMAL`), **CA-5** (clique inválido não altera e mostra
    motivo), tudo também por teclado em pelo menos um caso.

- [ ] **#8 — [T] Editor visível na tela (provisório)**
  - Arquivos: `frontend/src/App.tsx`, `App.test.tsx`
  - Depende de: #7
  - Pronto quando: `EditorLadder` renderizado acima do fluxo de ST existente,
    sem alterar compilação/gravação; testes atuais de `App.test.tsx` seguem
    verdes; `npm run build` limpo. (Os modos da Q-2 chegam em #12.)

## Fatia 2 — S5a: múltiplos degraus e mover

- [ ] **#9 — [N] Degraus, mover e limite de colunas**
  - Arquivos: `frontend/src/ladder/edicao.ts`, `edicao.test.ts`
  - Depende de: #3
  - Pronto quando: `inserirDegrau(posicao)`, `removerDegrau(id)`,
    `moverElemento(id, destino)`; recusa além de `COLUNAS_POR_DEGRAU` com
    mensagem do limite; mover para posição inválida recusa e mantém o original;
    remover degrau não afeta os outros (**CA-6**, **CA-7** e parte de **CA-10**
    em unidade).

- [ ] **#10 — [D] Vários degraus, mover por seleção**
  - Arquivos: `frontend/src/components/ladder/EditorLadder.tsx`, `Paleta.tsx`,
    testes
  - Depende de: #7, #9
  - Pronto quando: lista de `GradeDegrau` com inserir/remover degrau; ferramenta
    "mover" (origem → destino, Esc cancela). Testes: **CA-6** (dois degraus
    editáveis, remover um preserva o outro) e **CA-7** (mover por clique e por
    teclado; remover sem resto inconsistente).

## Fatia 3 — S5b: validação visível, persistência e modos

- [ ] **#11 — [N] Regras da Q-6 e persistência**
  - Arquivos: `frontend/src/ladder/validacao.ts`, `persistencia.ts`, testes
  - Depende de: #9
  - Pronto quando: `bobina_duplicada` (erro, aponta as duas bobinas) e
    `set_reset_autodependente` (aviso) com casos positivos e negativos (par
    SET/RESET sem autodependência **não** gera aviso); `salvarDiagrama`/
    `carregarDiagrama` com `Storage` injetado, envelope `{ versao: 1, diagrama }`,
    e cada falha (JSON inválido, versão desconhecida, exceção do armazenamento)
    devolvendo diagrama vazio + aviso, nunca exceção.
  - Nota: o SET/RESET só é inserível pela UI em #18; aqui a regra é testada em
    unidade sobre diagramas montados à mão.

- [ ] **#12 — [T] Modos Ladder/ST e persistência ligada**
  - Arquivos: `frontend/src/App.tsx`, `App.test.tsx`
  - Depende de: #8, #11
  - Pronto quando: `modo: 'ladder' | 'st'` com `role="tablist"`, Ladder como
    inicial; trocar de modo preserva os dois estados; compilação e gravação do
    modo ST inalteradas (testes existentes verdes); diagrama carregado de
    `localStorage` ao montar e salvo a cada mudança; aviso de descarte visível.

- [ ] **#13 — [D] Problemas na grade e na lista**
  - Arquivos: `frontend/src/components/ladder/ListaProblemas.tsx`,
    `GradeDegrau.tsx`, `EditorLadder.tsx`, testes
  - Depende de: #10, #11
  - Pronto quando: `validarDiagrama` roda a cada mudança; erros e avisos
    listados separadamente (`role="alert"` para erros), clicar leva o foco à
    célula; célula com problema marcada por cor **e** ícone/`aria-label`
    distintos para erro e aviso. Testes: **CA-4** (contato sem terminal;
    variável não vinculada) e **CA-9** (bobina duplicada = erro; aviso visualmente
    distinto do erro).

- [ ] **#14 — [T] Ponta a ponta com recarga**
  - Arquivos: e2e em contêiner Playwright (script fora de `frontend/src`, em
    `frontend/e2e/`)
  - Depende de: #12, #13
  - Pronto quando: contra `vite preview` no contêiner, sem publicar portas:
    construir `IO_ESPELHO`, recarregar e conferir o diagrama (**CA-8**); trocar
    para ST e compilar `blink.st` como antes (com backend disponível) ou, sem
    backend, conferir que a aba ST abre intacta; captura salva no relatório da
    rodada.

## Fatia 4 — S5b: ramo paralelo, SET/RESET e CTU

- [ ] **#15 — [N] Ramo paralelo, SET/RESET e limite de linhas**
  - Arquivos: `frontend/src/ladder/edicao.ts`, `validacao.ts`, testes
  - Depende de: #11
  - Pronto quando: `criarRamo(degrau, colunaInicio, colunaFim)`,
    `removerRamo`; contatos em linha > 0 só dentro de ramo; recusa na 3ª linha
    extra (**CA-10**); `rung_incompleto` para ramo aberto/vazio (**CA-4**);
    SET/RESET inseríveis como terminais.

- [ ] **#16 — [N] CTU destacável e `BLINK`**
  - Arquivos: `frontend/src/ladder/ctu.ts`, `ctu.test.ts`, `modelo.ts`,
    `validacao.ts`, `fixtures.ts`
  - Depende de: #15
  - Pronto quando: membro `'ctu'` com `linhaReset` na união; `ctu.ts` concentra
    criação, posição (terminal na última coluna, linha de reset livre de ramo e
    dentro do limite) e validação; os demais arquivos só chamam `ctu.ts` nos
    pontos de extensão; `BLINK` = variante K
    (`spikes/modelo/preset25/variante_k_pv12_ctu_antes_iniFALSE_led_atrasado.st`),
    sem problemas, **com comentário R-1** apontando para `test_blink_ladder.py`
    e declarando que a equivalência diagrama ↔ ST é assumida até a F8.
    Verificação de destacabilidade: listar no relatório os pontos de extensão
    que o compilador aponta ao remover `'ctu'` (sem remover de fato).

- [ ] **#17 — [B] `blink_ladder.st` e teste de equivalência (R-1)**
  - Arquivos: `backend/tests/fixtures/blink_ladder.st`,
    `backend/tests/test_blink_ladder.py`
  - Depende de: — (o ST é a variante K já medida; o mapeamento degrau a degrau
    é conferido contra `BLINK` depois de #16)
  - Pronto quando: `blink_ladder.st` com cabeçalho mapeando cada degrau do
    `BLINK` a um trecho de ST; teste compara com `blink.st` por
    `comparar_execucoes`, 200 ciclos, três padrões de entrada (sempre 0; pulso
    no 60; pressionado 45–55), **0 divergências**, pulando limpo sem
    `plc_host_runner`; compila no `iec2c`; **comentário no topo do teste e do
    `.st`**: "equivalência diagrama ↔ ST assumida, não testada; este teste prova
    só ST ↔ blink.st; substituir pelo ST serializado quando a F8 existir".

- [ ] **#18 — [D] Ramo, SET/RESET e CTU no editor**
  - Arquivos: `frontend/src/components/ladder/GradeDegrau.tsx`, `Simbolos.tsx`,
    `SimboloCtu.tsx`, `Paleta.tsx`, `PainelVariaveis.tsx`, `EditorLadder.tsx`,
    testes
  - Depende de: #13, #16
  - Pronto quando: ferramenta "ramo" (coluna inicial → final), símbolos SET/RESET,
    CTU desenhado em duas linhas com limite editável e saída vinculável; aviso
    da Q-6 aparece nos degraus SET/RESET do `BLINK` quando aplicável. Testes:
    **CA-3** (construir `BLINK` pela UI, igual à fixture, sem erros) e **CA-10**
    (mensagem do limite de linhas).

- [ ] **#19 — [B] Manifesto do depósito**
  - Arquivos: `scripts/build-deposito.sh`
  - Depende de: #16, #18
  - Pronto quando: `modelo.ts`, `validacao.ts`, `edicao.ts`, `enderecos.ts`,
    `ctu.ts`, `persistencia.ts` e `components/ladder/EditorLadder.tsx` em
    `REQUIRED_FILES`; `--verificar` verde na imagem; nenhum `*.test.ts(x)` nem
    `frontend/e2e/` no pacote.

- [ ] **#20 — Fechamento da feature**
  - Arquivos: `.claude/state.md`, `docs/specs/002-editor-ladder/tasks.md`
  - Depende de: #14, #17, #18, #19
  - Pronto quando: suíte completa verde (vitest, `tsc`, `npm run build`,
    `pytest -m "not slow"` incluindo #4 e #17); teste de desempenho com 50
    degraus registrado (plano §6); F7 ✅ no painel com a limitação declarada da
    Q-6 e a pendência R-1 transferida para F8; Definition of Done por feature
    revisada — itens "ST gerado compila" e "caminho fim-a-fim até gravar"
    registrados como **não aplicáveis até a F8**, com justificativa.

---

## Rastreabilidade

| Tarefa | Requisito(s) | Critério(s) de aceitação |
|---|---|---|
| #1 | RF-1, RF-9, RF-10 | CA-1, CA-2 |
| #2 | RF-11, RF-9 | CA-4, CA-5 |
| #3 | RF-2, RF-7, RF-9, RF-10, RF-12 | CA-5, CA-7 |
| #4 | RF-9 (D-9, R-3) | — (proteção de contrato) |
| #5 | RF-1, RF-2 | CA-1, CA-2 |
| #6 | RF-2, RF-9, RF-10 | CA-1, CA-2 |
| #7 | RF-1, RF-2, RF-7, RF-9, RF-10, RF-12 | CA-1, CA-2, CA-5 |
| #8 | Q-2 (preserva spec 001) | — |
| #9 | RF-6, RF-7, RF-8, RF-12 | CA-6, CA-7, CA-10 |
| #10 | RF-6, RF-8 | CA-6, CA-7 |
| #11 | RF-11, RF-12, RF-13 | CA-8, CA-9 |
| #12 | RF-13, Q-2 | CA-8 |
| #13 | RF-11, RF-12 | CA-4, CA-9 |
| #14 | RF-13 | CA-8 |
| #15 | RF-3, RF-4, RF-11, RF-12 | CA-4, CA-10 |
| #16 | RF-5 (Q-7) | CA-3 |
| #17 | RF-5 (Q-4, R-1) | CA-3 |
| #18 | RF-3, RF-4, RF-5, RF-12 | CA-3, CA-10 |
| #19 | §10 | — |
| #20 | todos | todos |

## Paralelismo previsto

| Fatia | Em paralelo | Depois |
|---|---|---|
| 1 | #1 → (#2 → #3) ∥ #4 ∥ #5 ∥ #6 | #7 → #8 |
| 2 | #9 | #10 |
| 3 | #11 → (#12 ∥ #13) | #14 |
| 4 | #15 → #16 ∥ #17 (desde o início da fatia) | #18 → #19 → #20 |
