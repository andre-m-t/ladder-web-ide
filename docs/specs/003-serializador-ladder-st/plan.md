# Plano 003 — Serializador Ladder → ST

> **Status:** aprovado (2026-09-18). O autor aprovou o plano e liberou, na
> mesma decisão, `/tarefas` e `/implementar` das duas fatias.
> **Spec de origem:** [`spec.md`](./spec.md) (versão aprovada em 2026-09-18, com a revisão aditiva do RF-5 da mesma data)
> **Autor:** André  ·  **Data:** 2026-09-18

Este documento descreve **o como**. Cada decisão aqui rastreia para um
requisito da `spec.md`.

---

## 1. Resumo da abordagem

A serialização é uma **função pura** em `frontend/src/ladder/serializador.ts`,
vizinha do modelo e da validação da spec 002. Ela recebe um `Diagrama` e
devolve ou o texto ST com um mapa degrau → linhas, ou uma recusa com motivo.
Não conhece React nem rede. A IDE (`App.tsx`) só troca **de onde vem o texto**
que já é enviado ao `/compile/pacote`: num projeto ST, da caixa de texto; num
projeto Ladder, de `serializar(diagrama)`. O servidor não muda (RF-6).

Cada degrau vira uma expressão booleana, lendo a grade como um circuito:
fronteiras de coluna são nós, contatos do trilho e ramos são arestas, e o fluxo
de energia vai só da esquerda para a direita. A expressão sai fatorada por
redução série-paralelo, que é o caso comum e fica legível para quem aprende
(Q-1). Um caso que a edição permite e não é série-paralelo, o de ramos de
linhas diferentes com intervalos cruzados, cai num cálculo por nó, também
testado.

A equivalência é **medida**, não assumida (quita a R-1 do plano 002). Um teste
vitest grava o texto que o serializador produz para cada diagrama de referência
em arquivos dourados `backend/tests/fixtures/serializados/*.st`, com
`toMatchFileSnapshot` do próprio vitest. Um pytest novo executa esses mesmos
arquivos no `plc_host_runner` pelo arcabouço diferencial que já existe,
comparando contra o gabarito das fixtures TOML e, quando há ST de referência,
contra a execução dele. Se o texto mudar, o vitest acusa. Se o comportamento
mudar, o pytest acusa.

## 2. Reúso do que já existe

- **Modelo** — `frontend/src/ladder/modelo.ts`:
  - `Diagrama`, `Rung`, `Ramo`, `Elemento`, `ehContato`, `ehBobina`, `COLUNA_TERMINAL`, `COLUNAS_POR_DEGRAU`, `LINHAS_EXTRAS_MAX`;
  - o contrato do `Ramo` ("paralelo à linha 0, sai dela em `colunaInicio` e volta em `colunaFim`") é a base da semântica de D-1;
  - o desenho em `components/ladder/GradeDegrau.tsx` (`tracoRamo`) liga os dois conectores verticais do ramo ao trilho principal (`y0`), o que é coerente com esse contrato.
- **Validação** — `frontend/src/ladder/validacao.ts`:
  - `validarDiagrama` e `Problema` são o portão da Q-2 (D-6);
  - a regra "célula vazia na linha 0 conduz" (cabeçalho do arquivo) é a mesma que D-1 adota.
- **Identificadores** — `frontend/src/ladder/edicao.ts`: `REGEX_IDENTIFICADOR` já garante nomes ASCII `[A-Za-z_][A-Za-z0-9_]*`, então o RF-3 fica garantido na origem para as variáveis. O serializador só precisa não introduzir texto não ASCII por conta própria (cabeçalho e comentários).
- **Fixtures de diagrama** — `frontend/src/ladder/fixtures.ts`: `IO_ESPELHO`, `MINIMAL`.
- **Forma do ST** — `backend/tests/fixtures/io_espelho.st` e `minimal.st`: `PROGRAM prog0`, `VAR` localizado em bloco próprio (restrição do `iec2c` já registrada no comentário do `io_espelho.st`) e `CONFIGURATION Config0 / RESOURCE Res0 ON PLC / TASK task0(INTERVAL := T#20ms, PRIORITY := 0) / PROGRAM instance0 WITH task0 : prog0` (Q-4).
- **Compilação no cliente** — `frontend/src/lib/api.ts`: `compilarPacote`, `ErroCompilacao` (envelope Q-3 da spec 001) e `Diagnostico.line`.
- **IDE** — `frontend/src/App.tsx`:
  - `aoCompilar` (hoje retorna cedo em projeto LD), `motivoIndisponivel` (hoje fixo em LD), `problemas` (via `useMemo`) e `aoEscolherProblema` (foca o degrau);
  - `components/ide/PainelInferior.tsx`, `PainelInferiorConteudo.tsx` e `ListaProblemas.tsx` (abas do painel inferior).
- **Medição** — `backend/tests/diferencial/`:
  - `carregar_fixture(toml, diretorio_st)` aceita outro diretório de ST, então os TOMLs `io_espelho.toml` e `minimal.toml` são reusados **sem mudança**;
  - também reusados: `HostRunnerExecutor`, `rodar_fixture`, `comparar_execucoes` e `formatar_relatorio`;
  - `backend/tests/test_diferencial.py` é o padrão de teste a imitar (pular limpo sem `plc_host_runner`).
- **e2e** — `frontend/e2e/` (Playwright em contêiner, `rodar.sh`).
- **Depósito** — `scripts/build-deposito.sh` (`REQUIRED_FILES`).
- **Nenhuma dependência nova.** `toMatchFileSnapshot` é do vitest já instalado.

## 3. Componentes afetados

| Componente | Caminho | Novo/alterado | Responsabilidade |
|---|---|---|---|
| Serializador | `frontend/src/ladder/serializador.ts` | novo | `serializar(diagrama)` → ST + `mapaLinhas`, ou recusa |
| Testes do serializador | `frontend/src/ladder/serializador.test.ts` | novo | Unitários: topologia, SET/RESET, recusas, vazio, determinismo, ASCII |
| Dourados | `frontend/src/ladder/serializador.dourados.test.ts` → `backend/tests/fixtures/serializados/*.st` | novo | Grava/confere o texto real de cada diagrama de referência |
| Fixtures de diagrama | `frontend/src/ladder/fixtures.ts` | alterado | `RAMO_OU`, `SET_RESET`, `SELO` |
| Fixtures diferenciais | `backend/tests/diferencial/fixtures/serializador/{ramo_ou,set_reset,selo}.toml` | novo | Gabarito por ciclo de cada cenário novo. Fica em subdiretório porque `test_diferencial.py` parametriza por `fixtures/*.toml` com o diretório de ST antigo |
| Teste diferencial | `backend/tests/test_serializador_diferencial.py` | novo | CA-1 a CA-4 contra o `plc_host_runner` |
| Código de problema | `frontend/src/ladder/validacao.ts` | alterado | `CodigoProblema` ganha `erro_compilacao` (só o tipo; `validarDiagrama` não o produz) |
| IDE | `frontend/src/App.tsx` | alterado | Portão Q-2/Q-6, compilação LD, diagnóstico → degrau (Q-3) |
| Painel inferior | `frontend/src/components/ide/PainelInferior.tsx`, `PainelInferiorConteudo.tsx` | alterado | Aba **ST gerado** (Q-1), só em projeto LD |
| e2e | `frontend/e2e/*.spec.ts` | alterado | Compilar em LD envia o ST serializado |
| Depósito | `scripts/build-deposito.sh` | alterado | `serializador.ts` em `REQUIRED_FILES` |

## 4. Decisões técnicas

### D-1: degrau como circuito de nós, com redução série-paralelo
- **Escolha:** dentro de um degrau:
  - os nós são as fronteiras de coluna `0..COLUNA_TERMINAL`, em que o nó `k` fica à esquerda da coluna `k` e o nó `COLUNA_TERMINAL` é a entrada da bobina;
  - arestas do trilho: `k → k+1` para cada coluna de contato, com o contato em `(0, k)` ou `TRUE` se a célula estiver vazia;
  - arestas de ramo: `colunaInicio → colunaFim + 1`, com a série das células da linha do ramo nesse intervalo. Célula vazia dentro do ramo conduz, como no trilho. Ramo vazio já é erro de validação;
  - o ramo liga-se **só ao trilho principal**, conforme o contrato do `Ramo`. Fluxo apenas da esquerda para a direita, sem fluxo reverso;
  - a expressão da bobina sai de **redução série-paralelo** sobre esse grafo, com arestas paralelas → `OR` e nó de grau 1+1 → `AND`;
  - se a redução não fechar numa aresta única (ramos de linhas diferentes com intervalos cruzados, o que `redimensionarRamo` permite), usa-se a propagação por nó: `E(0) = TRUE` e `E(n) = OR` sobre as arestas `m → n` de `(E(m) AND termo)`;
  - contato NA = `x`, NF = `NOT x`, e o `TRUE` neutro é eliminado (`TRUE AND x` → `x`);
  - parênteses só onde a precedência exige (`OR` dentro de `AND`).
- **Alternativas descartadas:**
  - só a propagação por nó: duplica subexpressões mesmo no caso comum e produz texto ilegível para a aba da Q-1;
  - só série-paralelo, recusando o cruzado: recusaria um diagrama que o editor aceita, contrariando o RF-1;
  - variáveis temporárias por nó: poluem o `VAR` e o texto que o aluno lê.
- **Requisito atendido:** RF-1.

### D-2: bobinas e SET/RESET
- **Escolha:**
  - bobina simples → `x := expr;`;
  - SET → `IF expr THEN x := TRUE; END_IF;`;
  - RESET → `IF expr THEN x := FALSE; END_IF;`;
  - cada degrau é emitido no seu lugar, na ordem do diagrama, sem reordenar. A última escrita do ciclo vence (Q-5).
- **Alternativas descartadas:** `x := x OR expr` / `x := x AND NOT expr` são equivalentes, mas menos legíveis e sem ganho. Uma prioridade fixa de RESET contraria a Q-5.
- **Requisito atendido:** RF-1, RF-11.

### D-3: declarações
- **Escolha:**
  - todas as variáveis de `diagrama.variaveis`, na ordem da lista;
  - um bloco `VAR` só com as localizadas (`nome AT %IX0.n : BOOL;`) e outro só com as internas;
  - bloco sem variável é omitido;
  - o endereço é copiado do diagrama, sem revalidar nem introduzir outro.
- **Alternativas descartadas:** declarar só as variáveis usadas exigiria uma segunda passada e poderia sumir com uma saída declarada de propósito. O RF-2 pede "todas as usadas", e declarar todas as contém.
- **Requisito atendido:** RF-2, RF-12.

### D-4: forma do texto
- **Escolha:**
  - cabeçalho fixo em comentário ASCII, sem o título do projeto (que aceita acento);
  - `PROGRAM prog0` … `END_PROGRAM` e a `CONFIGURATION` idêntica às fixtures da spec 001;
  - indentação de 2 espaços e quebra `\n`;
  - operandos em ordem de coluna e de linha, sem depender de `id` nem da ordem de inserção. É o determinismo do §6 da spec.
- **Requisito atendido:** RF-3, RF-4 (Q-4).

### D-5: recusas do serializador
- **Escolha:** `serializar` devolve `{ ok: false, motivo, rungId? }`, sem texto parcial, quando:
  - (a) há um elemento de tipo fora do subconjunto. O `switch` é exaustivo por `never` e tem um `default` que recusa em tempo de execução, para dado forjado ou vindo de versão futura (CA-6);
  - (b) um nome de variável é palavra reservada da IEC 61131-3 (`AND`, `NOT`, `TRUE`, `IF`, `PROGRAM`, …) ou coincide com os nomes fixos da Q-4;
  - (c) dois nomes diferem só em maiúsculas e minúsculas, porque identificadores IEC não as distinguem.

  (b) e (c) são "condição que a tradução não sabe resolver" (§2 da spec): hoje o editor os aceita, e o `iec2c` os rejeitaria com uma mensagem que não aponta para o diagrama.
- **Alternativas descartadas:** renomear em silêncio (ex.: `and_1`) quebra a correspondência entre o diagrama e o texto que a Q-1 torna visível. Barrar no editor mudaria a spec 002.
- **Requisito atendido:** RF-5 (e a recusa explícita do §3 da Constituição).

### D-6: portão de compilação num projeto Ladder
- **Escolha:** `motivoIndisponivel` em projeto LD passa a ser, na primeira regra que valer:
  1. há problema de severidade `erro` → "N problema(s) no diagrama — ver aba Problemas";
  2. a serialização devolve `vazio` → "Nada a compilar: o diagrama não tem elementos";
  3. a serialização recusa → o motivo dela;
  4. senão, `undefined`, e Compilar fica habilitado.

  Avisos não bloqueiam. `serializar` é pura e não consulta a validação, porque o portão é da IDE.
- **Requisito atendido:** RF-7 (Q-2), RF-8 (Q-6).

### D-7: vazios
- **Escolha:** degrau sem elemento e sem ramo não gera nada, nem comentário. Se nenhum degrau gera texto, o resultado é `{ ok: false, vazio: true, motivo: 'nada a compilar' }`.
- **Requisito atendido:** RF-8 (Q-6).

### D-8: rastreio diagnóstico → degrau
- **Escolha:**
  - antes de cada degrau emitido entra `(* degrau N *)`, com N 1-based igual ao rótulo da tela;
  - `mapaLinhas` registra `{ rungId, linhaInicio, linhaFim }` (1-based, do comentário à última linha do degrau);
  - numa falha `ErroCompilacao` de projeto LD, cada `Diagnostico` com `line` vira um `Problema` `{ codigo: 'erro_compilacao', severidade: 'erro', rungId, elementoId: null, mensagem }`. O `rungId` vem do mapa, ou `''` se a linha cair fora de degrau (declarações, cabeçalho);
  - esses problemas ficam num estado próprio do `App`, somado aos de `validarDiagrama` na lista, e são limpos na próxima edição do diagrama ou na próxima compilação. Clicar neles usa o `aoEscolherProblema` que já existe.
- **Alternativas descartadas:** granularidade por elemento, pelo mesmo motivo da decisão Q-3.
- **Requisito atendido:** RF-10 (Q-3).

### D-9: aba "ST gerado"
- **Escolha:**
  - nova aba no painel inferior (ao lado de Problemas, Mensagens e Console), presente só em projeto LD;
  - `<pre>` somente leitura com número de linha, alimentado por `useMemo(() => serializar(diagrama))` no `App`, o mesmo resultado usado por D-6 e D-10;
  - com recusa ou vazio, mostra o motivo no lugar do texto.
- **Alternativas descartadas:** reusar o `EditorST` em modo leitura acopla ao componente de edição sem ganho. Uma aba no cabeçalho foi revertida pelo autor na revisão pós-#26.
- **Requisito atendido:** RF-9 (Q-1).

### D-10: compilar e gravar em projeto Ladder
- **Escolha:** `aoCompilar` em LD pega `resultado.st` e segue **o mesmo** fluxo do ST, com `compilarPacote`, log, estado `compilacao` e Gravar. Não há caminho novo nem mudança de contrato.
- **Requisito atendido:** RF-6.

### D-11: arquivos dourados como ponte TS → Python
- **Escolha:**
  - `serializador.dourados.test.ts` faz `await expect(serializar(F).st).toMatchFileSnapshot(<repo>/backend/tests/fixtures/serializados/<nome>.st)` para `IO_ESPELHO`, `MINIMAL`, `RAMO_OU`, `SET_RESET` e `SELO`;
  - os arquivos são versionados. Para regenerar, `npx vitest run -u`, e a mudança aparece no diff;
  - o pytest carrega os TOMLs com `diretorio_st = fixtures/serializados`.
- **Alternativas descartadas:**
  - rodar o serializador dentro do pytest (via Node) põe Node na imagem do backend;
  - copiar à mão reintroduziria o elo manual que a R-1 quer eliminar.
- **Requisito atendido:** RF-1 a RF-4 medidos (CA-1 a CA-4); quita a R-1 do plano 002.

### D-12: download do projeto no lugar da aba "ST gerado" (revisão aditiva, 2026-09-18)
- **Escolha:**
  - D-9 deixa de valer: a aba "ST gerado" sai do painel inferior. O texto de
    D-9 continua como registro;
  - botão **Baixar** no cabeçalho, entre Compilar e Gravar, que abre um menu
    acessível (`components/ide/MenuDownload.tsx`) com:
    - **Ladder (.json)**, só em projeto LD: o envelope do projeto, no formato
      de `salvarProjeto`;
    - **Structured Text (.st)**: `stGerado.st` em projeto LD, `projeto.fonte`
      em projeto ST;
  - em LD, a opção .st fica desabilitada com `motivoIndisponivel` (o mesmo
    portão de D-6);
  - o nome do arquivo vem do título, em ASCII minúsculo com `-` (ex.:
    `semaforo.st`, `semaforo.ladderflow.json`);
  - o download é feito no cliente, por `lib/download.ts` (`Blob` +
    `URL.createObjectURL`), sem requisição ao servidor (§6).
- **Por quê:** revisão aditiva da Q-1 na spec. O texto na tela não ajudava o
  usuário; o arquivo continua disponível para quem quiser levá-lo a outra
  ferramenta ou estudá-lo.
- **Alternativas descartadas:** PLCopen XML (IEC 61131-10) como versão LD,
  que pediria uma spec própria; imagem do diagrama, que não pode ser reaberta.
- **Requisito atendido:** RF-9 (Q-1 revista).

### D-13: serialização do contador crescente (revisão aditiva, 2026-09-19)
- **Escolha:**
  - O degrau com CTU emite `ctuN(CU := <expr>, R := <reset>, PV := n);`,
    seguido de `<saida> := ctuN.Q;`.
    - `<expr>` é a mesma redução de D-1 que alimenta uma bobina: linha 0 e
      seus ramos.
    - `<reset>` é a conjunção, em ordem de coluna, dos contatos da
      `linhaReset`, ou `FALSE` se ela está vazia.
    - Os contatos da linha de reset **não** entram no grafo de D-1.
  - A instância é declarada `ctuN : CTU;` no bloco `VAR` interno, na ordem
    dos degraus. O nome é gerado pelo editor e passa pelas recusas de D-5.
  - O `BLINK` (variante K do spike, `spikes/modelo/preset25/`) vira fixture
    e arquivo dourado. O pytest diferencial executa esse dourado contra o
    `blink.toml` e contra a execução de `blink.st`, em 200 ciclos × 3
    padrões de entrada.
- **Por quê:** RF-13/CA-10 (revisão aditiva do escopo na spec). A forma
  chamada + leitura de `.Q` é a mesma da variante K, já medida com 0
  divergências. Assim o texto gerado é o próprio programa que o spike provou
  equivalente.
- **Consequência para a spec 002:** a #17 (`blink_ladder.st` escrito à mão)
  é substituída por este teste. Nenhum ST de referência do pisca-pisca é
  escrito por uma pessoa.
- **Alternativas descartadas:** simular a contagem com bobinas e aritmética,
  o que exigiria blocos fora do subconjunto (§7 da spec 002). Também se
  descartou expor `CV`, que a Q-5 da spec 002 decidiu não expor.
- **Requisito atendido:** RF-13, CA-10.

## 5. Contratos

```ts
// frontend/src/ladder/serializador.ts
export interface TrechoDegrau {
  rungId: string
  linhaInicio: number // 1-based, inclusivo
  linhaFim: number    // 1-based, inclusivo
}

export type ResultadoSerializacao =
  | { ok: true; st: string; mapaLinhas: TrechoDegrau[] }
  | { ok: false; motivo: string; vazio?: true; rungId?: string }

export function serializar(diagrama: Diagrama): ResultadoSerializacao

// frontend/src/ladder/validacao.ts — só o tipo cresce
export type CodigoProblema = /* …existentes… */ | 'erro_compilacao'
```

Exemplo de saída (`IO_ESPELHO`):

```
(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    entrada AT %IX0.1 : BOOL;
    saida AT %QX0.1 : BOOL;
  END_VAR

  (* degrau 1 *)
  saida := entrada;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
```

Fixtures TOML novas seguem o formato de `backend/tests/diferencial/README.md`, com `st = "<nome>.st"`.

Servidor: **sem mudança**. `POST /compile/pacote` recebe o texto como já recebe hoje.

## 6. Estratégia de testes

- **Unidade (vitest, `serializador.test.ts`):**
  - contato NA e NF;
  - série com lacunas;
  - ramo simples, dois ramos disjuntos, ramo aninhado (linha 2 dentro da linha 1) e ramos cruzados (fallback por nó);
  - lacuna dentro de ramo;
  - degrau só com bobina (`x := TRUE;`);
  - bobina simples, SET e RESET;
  - ordem dos degraus preservada;
  - `VAR` separados e blocos vazios omitidos;
  - recusas de D-5;
  - vazios de D-7;
  - `mapaLinhas` batendo com as linhas do texto;
  - determinismo (duas chamadas, texto igual; diagrama com ids diferentes e mesma grade, texto igual);
  - ASCII (`/^[\x00-\x7F]*$/`);
  - pior caso (8 colunas, 2 linhas de ramo cruzadas), com o tamanho do texto registrado.
- **Integração (pytest, `test_serializador_diferencial.py`, contra o `plc_host_runner`, pulando limpo sem ele):** cada `.st` dourado compila no `iec2c` (é o próprio runner que o compila) e roda contra o gabarito do TOML. Onde há ST de referência da spec 001, também roda `comparar_execucoes` contra a execução dele.
- **Componente (vitest, `App` e painel):** portão D-6, compilação LD, aba ST gerado e rastreio D-8, com `compilarPacote` mockado como nos testes atuais do `App`.
- **e2e (Playwright, `rodar.sh`):** projeto LD com `IO_ESPELHO` montado pela UI; Compilar com `/compile/pacote` interceptado por `page.route`, o corpo conferido igual ao dourado, e a resposta de pacote fabricada habilitando Gravar.
- **Manual (Chromium, back-end real em rede isolada):** compilação real de um diagrama LD, com as 3 imagens no Console; aba ST gerado nos dois temas; Compilar indisponível com erro e com diagrama vazio.
- **Hardware:** nada novo. A gravação física segue bloqueada (state.md, "Bloqueado aguardando hardware").

| CA | Teste |
|---|---|
| CA-1 | `io_espelho.st` dourado; pytest com o gabarito de `io_espelho.toml` **e** `comparar_execucoes` contra `fixtures/io_espelho.st`, 0 divergências |
| CA-2 | idem, com `minimal` |
| CA-3 | `RAMO_OU` (`%IX0.0` OU `%IX0.1` → `%QX0.0`) + `ramo_ou.toml`, as 4 combinações; unitários aninhado e cruzado |
| CA-4 | `SET_RESET` (degrau 1 SET por `%IX0.0`, degrau 2 RESET por `%IX0.1`) + `set_reset.toml`, com set, retenção, reset e coincidência (vence o RESET, que está abaixo); unitário da ordem invertida; `SELO` como caso extra com ramo e realimentação |
| CA-5 | componente: LD com `IO_ESPELHO` → Compilar → `compilarPacote` chamado com `serializar(IO_ESPELHO).st`, e Gravar habilitado após sucesso; e2e com interceptação; manual com back-end real |
| CA-6 | unitário com elemento de tipo forjado → recusa, sem `st` |
| CA-7 | componente: diagrama com erro → Compilar desabilitado com motivo, `compilarPacote` não chamado; só com aviso → compila |
| CA-8 | unitários de D-7; componente: "nada a compilar" no motivo e na aba ST gerado |
| CA-9 | unitário: o conjunto de `%[IQ]X\d+\.\d+` do texto é igual ao conjunto de endereços do diagrama |
| Q-1 | componente: a aba mostra o texto e muda após uma edição |
| Q-3 | componente: diagnóstico fabricado na linha do degrau 2 → problema `erro_compilacao` com o `rungId` do degrau 2; clique foca o degrau |

## 7. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| Ramos de linhas diferentes que se cruzam ou aninham: o conector vertical da linha 2 atravessa a linha 1 no desenho e pode ser lido como junção, enquanto a semântica (D-1) liga o ramo só ao trilho | médio | média | Semântica fixada pelo contrato do modelo, testada nos dois casos e visível na aba ST gerado. A ambiguidade de **desenho** fica registrada como pendência do editor (spec 002), fora desta spec |
| Arquivo dourado desatualizado em silêncio | alto | baixa | `toMatchFileSnapshot` falha sem `-u`, e o pytest executa o mesmo arquivo versionado |
| Nome aceito pelo editor e rejeitado pelo `iec2c` (reservado, maiúsculas) | médio | média | Recusa em D-5, com motivo no Compilar e na aba |
| Expressão grande no fallback por nó | baixo | baixa | Grade limitada (8 × 3); teste do pior caso com tamanho medido |
| Erro do `iec2c` num texto que passou pela validação (defeito do serializador) | médio | baixa | O CA-1 a CA-4 compilam os dourados de verdade; D-8 aponta o degrau |
| Primeira compilação lenta (build frio ~66 s) confundida com travamento em LD | baixo | média | Mesmo aviso e log que o fluxo ST já tem (D-10) |

## 8. Sequência de entrega em fatias

1. **Fatia 1 — S6a, núcleo medido.**
   - `serializador.ts` com os unitários;
   - fixtures `RAMO_OU`, `SET_RESET` e `SELO`;
   - dourados;
   - TOMLs novos e `test_serializador_diferencial.py`;
   - `REQUIRED_FILES`.

   Fecha CA-1 a CA-4, CA-6, CA-8 (núcleo) e CA-9. É a menor coisa testável de ponta a ponta: diagrama → texto → `iec2c` → runtime → comparação.
2. **Fatia 2 — S6b, IDE.**
   - portão D-6;
   - compilar em LD;
   - aba ST gerado;
   - rastreio D-8;
   - e2e e verificação em Chromium;
   - fechamento (F8 ✅ e R-1 quitada no `state.md`).

   Fecha CA-5, CA-7, CA-8 (tela), Q-1 e Q-3.

## 9. Impacto na Constituição

- **§2:** fecha o segundo caminho fim-a-fim (editar → serializar → compilar → gravar).
- **§3:** subconjunto declarado na spec; o que sai dele é recusado com motivo (D-5). O ST gerado compila no `iec2c`, verificado pelos dourados.
- **§4:** CA-1 a CA-4 medidos no runtime real; cada caso de topologia tem teste.
- **§5/§6:** serialização só no cliente; servidor e contrato intactos.
- **§10:** nada novo toca o `iec2c` fora do adaptador. O pytest usa o `plc_host_runner` que já existe.
- **§11:** nenhuma dependência nova; o núcleo segue o padrão puro de `validacao.ts`/`edicao.ts`.

**Tensão registrada:** as recusas (b) e (c) de D-5, por palavra reservada e
por maiúsculas e minúsculas, são regra nova no cliente. Derivam do §2 da spec
("condição que a tradução não sabe resolver… é informada antes"), mas não têm
RF próprio. Se o autor preferir, entram como revisão aditiva do RF-5.

> **Resolvida (2026-09-18):** o autor optou pela revisão aditiva do RF-5 na
> spec. D-5 passa a rastrear diretamente para o RF-5 revisto.
