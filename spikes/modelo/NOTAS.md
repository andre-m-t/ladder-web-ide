# NOTAS — spike S4, modelo de dados da grade Ladder

**Status:** spike, não spec (constituição §1 — sem spec aprovada de editor
Ladder ainda). Este diretório não é consumido por `frontend/src` e não deve
ser tratado como decisão fechada — é o material que uma futura spec 002 vai
ler para decidir com mais informação.

**Escopo:** o modelo de dados da grade (`modelo.ts`), validação estrutural
(`validacao.ts`), três diagramas de referência (`fixtures.ts`) e o
experimento de risco pedido — desenhar o BLINK com CTU e verificar
equivalência ciclo a ciclo contra `blink.st`.

---

## 1. Decisões do modelo

### 1.1 Por que grade com linhas de ramo, e não árvore série/paralelo

A interface fornecida (ponto de partida obrigatório) já escolhe isso:
`Celula { linha, coluna }` com `linha 0` = trilho principal e `linha > 0` =
ramo paralelo, mais `Ramo { linha, colunaInicio, colunaFim }` para declarar
onde cada ramo entra e sai. Não alterei essa escolha, mas vale registrar por
que ela é melhor do que a alternativa óbvia (uma árvore de nós
série/paralelo, ao estilo de uma expressão booleana aninhada):

- **Edição incremental.** Um editor visual de Ladder trabalha por cliques em
  células vazias — "põe um contato aqui". Uma coordenada `(linha, coluna)` é
  uma operação O(1) de inserção/remoção; uma árvore série/paralelo exige
  reestruturar o nó pai toda vez que um ramo nasce, cresce ou morre (dividir
  um nó "série" em "série(série, paralelo)", etc.). A grade evita essa
  ginástica de reestruturação a cada edição, ao custo de não impedir por
  construção alguns desenhos sem sentido elétrico (ver §3).
- **Faz o rendering ser uma leitura direta.** Qualquer biblioteca de
  desenho (a razão do spike existir: "modelo independente de
  renderização") pode iterar `elementos` e plotar `celula.coluna *
  larguraDaCelula, celula.linha * alturaDaCelula` sem nenhuma lógica de
  layout — o layout já está no dado. Uma árvore precisaria de um passo de
  "compilação para coordenadas" antes de desenhar, e esse passo teria que
  ser reescrito (ou ao menos revisado) por quem prototipa a renderização em
  paralelo a este spike.
- **Ramo como intervalo `[colunaInicio, colunaFim)`, não como subárvore.**
  Isso modela literalmente o desenho gráfico do Ladder (uma linha extra que
  sai do trilho principal numa coluna e volta a ele em outra), que é
  exatamente o que um editor mostra na tela — não uma abstração lógica sobre
  ele.

O preço dessa escolha está em §3 ("o que a validação NÃO cobre"): a grade
não impede um `Ramo` que não fecha eletricamente nada, porque ela não
carrega semântica booleana — só posição. Isso é aceitável para um spike de
*modelo de dados*, não de simulador (F9 é quem vai precisar de semântica).

### 1.2 Por que `endereco` é opcional em `Variavel`

Reflete o próprio `.st` do projeto: `minimal.st` declara `entrada`/`saida`
como `BOOL` comuns, sem `AT %..` — só `blink.st` e `io_espelho.st` localizam
variáveis em I/O físico. Um editor Ladder precisa representar as duas coisas
(uma variável de trabalho interna, como o `pulso` do experimento do §4, e uma
variável localizada), e o `.st` gerado a partir do diagrama vai declarar cada
uma no bloco `VAR` certo (localizado ou não) dependendo exatamente desse
campo. Deixei `endereco?: string` como veio na interface obrigatória — não
precisei alterá-lo.

### 1.3 Elemento `ctu`: por que não reaproveita `variavel`

A variante do `Elemento` para `ctu` tem `instancia`, `pv` e `saida`, não
`variavel`. Isso não é acidente do enunciado: um bloco de função (FB) como o
`CTU` do IEC 61131-3 tem *três* nomes diferentes envolvidos — o nome da
**instância** (`ctu0`, memória própria persistente entre ciclos, análogo a
uma variável `VAR ctu0 : CTU;`), o **valor de ajuste** `PV` (um número, não
uma variável) e a **variável comum** que recebe a saída `Q` para o resto do
diagrama poder testá-la com um contato normal. Não modelei `CU`/`R` como
campos do elemento (ver §3.2) — na leitura deste modelo, esses pinos são
"o que quer que esteja antes do CTU na mesma linha/ramo", do mesmo jeito que
a condição de uma bobina é "o que está antes dela". É uma simplificação
deliberada, não um esquecimento — está registrada aqui para a spec 002
decidir se vale a pena dar pinos explícitos ao FB.

Consequência prática: a lista `variaveis` do `Diagrama` não modela
instâncias de bloco de função. `ctu0` não aparece em `variaveis` — é seu
próprio namespace, existe só dentro do campo `instancia` do elemento. Isso é
consistente com o tipo obrigatório (`Variavel.tipo` só tem `'BOOL' | 'UINT'`,
não um terceiro caso "instância de FB").

### 1.4 Regras de posicionamento adotadas em `posicaoValida`

O enunciado fixa duas regras ("bobinas só na última coluna, na linha 0;
contatos/CTU antes dela; célula livre; linha>0 só dentro de um Ramo"). O
resto — o que "antes dela" quer dizer quando não há uma bobina de fato no
rung — ficou para eu decidir, e decidi assim:

- **Bobina** (`bobina`, `bobina_set`, `bobina_reset`): só en `(linha=0,
  coluna=colunas-1)`.
- **Contato** (`contato_na`, `contato_nf`): qualquer `coluna < colunas-1`, em
  `linha=0` ou dentro do intervalo de um `Ramo` declarado na mesma linha.
- **`ctu`**: `linha=0`, em qualquer coluna até `colunas-1` **inclusive**.
  Diferente do contato, o `ctu` pode ocupar a última coluna porque ele
  mesmo sabe escrever uma variável (`saida`) — pode ser o elemento que
  termina um rung sozinho, sem precisar de uma bobina redundante depois
  (ver o rung do contador no §4.2: `contato NA(pulso) -- CTU -- saida =
  atingiu`, sem bobina nenhuma).

Optei por essa leitura ("CTU pode estar OU antes de uma bobina OU ele mesmo
terminar o rung") em vez da leitura mais literal ("CTU está sempre antes de
uma bobina") porque a leitura literal obrigaria todo rung com CTU a carregar
uma bobina supérflua só para satisfazer a regra de posição, sem nenhum
elemento novo sendo escrito — o `saida` do CTU já faz esse trabalho.

`rung_incompleto` (ver §1.5) usa a mesma ideia: um rung está completo se
termina em bobina OU em `ctu` com `saida` não nula.

### 1.5 O que a validação NÃO cobre (limitação registrada, não escondida)

`validarDiagrama` é checagem **estrutural**: posição de elemento, referência
de variável, formato de endereço, bobina em entrada. Ela **não simula** o
circuito. Em particular:

- "buraco no caminho" é uma checagem de **cobertura de coluna** (cada coluna
  entre o trilho esquerdo e a bobina tem um elemento na linha 0 OU está
  coberta por algum `Ramo`), não uma avaliação booleana. Um `Ramo` que cobre
  a coluna certa mas cuja lógica interna nunca fecha o caminho de verdade
  (ex.: um contato que é sempre falso) passa na validação estrutural e só
  seria pego por um simulador de verdade (F9).
- O modelo não impede um `Ramo` "solto" (que não corresponde a nenhum desvio
  elétrico real do trilho principal) nem um `ctu` cujo `CU` implícito nunca
  é energizado.

Isso é uma escolha consciente de escopo do spike, não um bug: a pergunta que
este arquivo responde é "o dado está bem formado", não "o programa faz o que
o autor quis".

---

## 2. As três fixtures, em ASCII

Notação: `--|entrada|--` é contato NA, `--|/entrada|--` é contato NF,
`--( saida )--` é bobina comum, `--(S saida )--`/`--(R saida )--` são
bobina SET/RESET, `--[ CTU ]--` é o bloco de função, `====` é o trilho.

### 2.1 MINIMAL — espelha `minimal.st` (`saida := NOT entrada`)

```
====|/entrada|===============( saida )====
```

Uma variável comum de cada lado (sem `AT %..`), um contato NF, uma bobina.
`validarDiagrama(MINIMAL)` devolve `[]`.

### 2.2 IO_ESPELHO — espelha `io_espelho.st` (`saida := entrada`)

```
====|entrada|================( saida )====
```

`entrada AT %IX0.1`, `saida AT %QX0.1` (pinagem Q-5). Único contato NA,
única bobina. `validarDiagrama(IO_ESPELHO)` devolve `[]`.

### 2.3 BLINK — ver §4 (é o experimento de risco do spike)

---

## 3. Experimento BLINK

### 3.1 O risco, antes de desenhar

`blink.st` incrementa `contador : UINT` a cada ciclo de varredura e testa
`contador >= 25`. O modelo obrigatório não tem um bloco de soma/comparação
gráfico — o único elemento de contagem disponível é `ctu` (`CTU`, contador
crescente padrão do IEC 61131-3, já embutido na lib do MATIEC como função de
biblioteca em `/usr/local/share/matiec/lib/counter.txt`, sem precisar
declarar nada extra). A pergunta do enunciado era literalmente se dá para
usar esse `CTU` para contar *ciclos de varredura* e bater com blink.st.

A resposta, adiantada: **não exatamente — e o motivo é estrutural, não um
detalhe de implementação.** `CTU.CU` é **borda de subida**: a definição
padrão (`counter.txt`, reproduzida abaixo) usa um `R_TRIG` interno que só
sinaliza quando `CU` passa de `FALSE` para `TRUE` **entre duas chamadas**:

```
FUNCTION_BLOCK CTU
  VAR_INPUT
    CU : BOOL; R : BOOL; PV : INT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL; CV : INT;
  END_VAR
  VAR CU_T: R_TRIG; END_VAR
  CU_T(CU);
  IF R THEN CV := 0;
  ELSIF CU_T.Q AND (CV < PV) THEN CV := CV+1;
  END_IF;
  Q := (CV >= PV);
END_FUNCTION_BLOCK
```

Um booleano só pode subir depois de ter descido — não existe "borda de
subida a cada ciclo": o mínimo período entre duas bordas é **2 ciclos**
(`0,1,0,1,...`). Contar "1 por ciclo" com um `CTU` é impossível em
princípio, não uma questão de desenhar melhor o Ladder. Documentei isso
antes de escrever qualquer ST, para não "descobrir" o problema tentando
forçar um resultado.

### 3.2 O desenho (`fixtures.ts`, `BLINK`)

Sete rungs (ASCII; `%` = ramo paralelo desenhado abaixo do trilho):

```
Rung 1 (pulso, oscilador de 1 ciclo):
====|/pulso|==================( pulso )====

Rung 2 (contador):
====|pulso|===+==[ CTU PV=13 ]===saida=atingiu====
              %
              +--|reset_ctu|--+     <- ramo paralelo (linha 1, colunas [0,1))
                               (retroalimenta o pino R do CTU)

Rung 3 (agenda reset, 1 ciclo de atraso):
====|atingiu|=================( reset_ctu )====

Rung 4 (instantaneo de led -- ver §3.4, acrescentado DEPOIS de medir o bug):
====|led|======================( led_estava_aceso )====

Rung 5 (liga led):
====|atingiu|==|/led_estava_aceso|========(S led )====

Rung 6 (desliga led):
====|atingiu|==|led_estava_aceso|=========(R led )====

Rung 7 (botao, igual ao blink.st original):
====|botao|====================(S led )====
```

Usa contato NA (`pulso`, `reset_ctu`, `atingiu`, `led_estava_aceso`,
`botao`), contato NF (`pulso`, `led_estava_aceso`), ramo paralelo (rung 2),
bobina comum (rungs 1, 3, 4), bobina SET (rungs 5, 7) e bobina RESET (rung
6) e um `ctu` (rung 2) — todos os elementos pedidos, numa única fixture.
`validarDiagrama(BLINK)` devolve `[]` (`fixtures.test.ts` cobre isso e
verifica a presença de cada tipo de elemento).

O ramo paralelo (rung 2) é uma simplificação **anotada, não escondida**: o
elemento `ctu` deste modelo não distingue pino a pino (`CU` vs. `R` — ver
§1.3), então o ramo ali é ilustrativo da capacidade da grade de representar
`Ramo`, não uma ligação literal ao pino `R`. Na tradução para ST (§3.3), o
contato do ramo (`reset_ctu`) é quem eu decidi que alimenta `R` — uma
convenção de tradução que registro aqui, não algo que o modelo force.

### 3.3 O ST derivado à mão (`blink_ladder.st`)

Tradução rung a rung, na ordem de leitura (semântica ladder padrão: bobina
comum = atribuição do valor do rung; SET = `IF cond THEN v := TRUE`; RESET =
`IF cond THEN v := FALSE`; CTU = chamada de instância de FB padrão IEC):

```st
pulso := NOT pulso;                          (* rung 1 *)
ctu0(CU := pulso, R := reset_ctu, PV := 13); (* rung 2 *)
atingiu := ctu0.Q;
reset_ctu := atingiu;                        (* rung 3 *)
led_estava_aceso := led;                     (* rung 4 *)
IF atingiu AND NOT led_estava_aceso THEN     (* rung 5 *)
  led := TRUE;
END_IF;
IF atingiu AND led_estava_aceso THEN         (* rung 6 *)
  led := FALSE;
END_IF;
IF botao THEN led := TRUE; END_IF;           (* rung 7 *)
```

Compila limpo no `iec2c` (confirmado com `-f -I
/usr/local/share/matiec/lib`, `EXIT=0`, sem usar nenhuma dependência além da
biblioteca padrão do MATIEC — `CTU` já vem nela).

### 3.4 Risco descoberto NO experimento (não antecipado no desenho)

A primeira versão de `blink_ladder.st` **não tinha** o rung 4
(`led_estava_aceso`) — os rungs 5/6 liam `led` ao vivo. Rodando contra o
gabarito, `%QX0.0` deu `False` em **todos** os 50 ciclos (inclusive nos
ciclos 25/26/49, onde deveria ser `True`). O motivo, achado inspecionando
variáveis localizadas de depuração (`%QX1.0..2`, removidas da versão final):
no ciclo em que `atingiu` fica `TRUE`, o rung 5 liga `led` (`SET`) e, **no
mesmo ciclo**, o rung 6 — avaliado logo depois, na mesma varredura — lê
`led` já `TRUE` e desliga de novo (`RESET`). Os dois rungs se
auto-cancelavam a cada ativação.

Isso não é um defeito do `plc_host_runner` nem do `iec2c` — é o
comportamento **correto e esperado** de um scan sequencial de memória
única: bits internos não têm buffer duplo entre redes do mesmo ciclo (só
E/S física costuma ter essa garantia). É um erro real e conhecido de quem
escreve pares SET/RESET do mesmo bit condicionados pela mesma variável de
disparo — a razão de eu ter deixado isso registrado em vez de só corrigir
em silêncio: é exatamente o tipo de risco que só aparece **rodando**, não
lendo o Ladder na tela, e um argumento a favor de F9 (simulador) existir
antes de confiar visualmente em qualquer diagrama com SET/RESET
compartilhado.

**Correção adotada:** rung 4, um "instantâneo" de `led` (`led_estava_aceso
:= led`) avaliado *antes* do par SET/RESET; os rungs 5/6 passam a ler
`led_estava_aceso` em vez de `led`. Isso é o próprio `fixtures.ts` (a versão
final, já com o rung 4) e o `blink_ladder.st` final.

### 3.5 Resultado medido

Comando (dentro do container, conforme Regra 5 do `CLAUDE.md`):

```bash
docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \
  python /repo/spikes/modelo/verificar_blink_ladder.py
```

O script (`verificar_blink_ladder.py`) resolve `plc_host_runner` do mesmo
jeito que `backend/tests/diferencial/executores.py` (variável de ambiente,
`PATH`, ou compilação sob demanda via `make` — neste ambiente, compilou sob
demanda, `/tmp/ladderflow-plc-host-runner/plc_host_runner`), e roda:

**1. Sanity check — `blink.st` original contra `backend/tests/diferencial/fixtures/blink.toml`:**
`nenhuma divergencia` (confirma que o arcabouço em si não foi alterado).

**2/3. `blink_ladder.st` (PV=13) contra o mesmo gabarito, e comparação
completa ciclo a ciclo com `blink.st`:**

```
1 divergencia(s):
ciclo=50 ponto=%QX0.0 esperado=False obtido=True
```

**Não é equivalente ciclo a ciclo em 50 ciclos** — mas chega perto: bate
exatamente nos ciclos 24, 25, 26 e 49 (os quatro primeiros pontos do
gabarito, incluindo os dois ciclos que provam a transição em 25), e diverge
só no ciclo 50. Explicação (analítica, confirmada pelos números medidos):
`pulso` alterna todo ciclo, então `CU` sobe em ciclos ímpares — 1 borda a
cada 2 ciclos. Com `R := reset_ctu` alimentado com **1 ciclo de atraso**
(rung 3), o `CTU` fica preso em `CV=13` por 1 ciclo extra antes de zerar
(ciclo 25 conta, ciclo 26 é o reset). Isso desloca a **segunda** janela de
contagem em 1 ciclo: a próxima vez que `CV` chegaria a 13 seria no ciclo 51,
não 50 — fora da janela de 50 ciclos do teste. `led` liga certinho no ciclo
25, mas não desliga a tempo do ciclo 50. O deslocamento é cumulativo: um
teste de 100 ciclos mostraria o padrão se repetindo, sempre 1 ciclo
atrasado por janela.

**4. Alternativa medida: mesmo desenho, `PV := 12`** (mesma tentativa
citada no enunciado, "PV diferente" —
`blink_ladder_pv12.st`/`blink_ladder_pv12.toml`):

```
2 divergencia(s):
ciclo=24 ponto=%QX0.0 esperado=False obtido=True
ciclo=49 ponto=%QX0.0 esperado=True obtido=False
```

Pior, não melhor: com `PV=12` a primeira borda de `Q` acontece no ciclo 23
(não 25), então `led` já liga cedo demais (diverge no ciclo 24) e a segunda
janela termina no ciclo 47 (não 49), então `led` já desligou cedo demais no
ciclo 49. **`PV=13` é a melhor tentativa medida.**

**Terceira alternativa considerada, não implementada:** trocar o `CTU` por
um par `ADD`/`GE` (a própria aritmética do `blink.st`, `contador :=
contador + 1; contador >= 25`) daria equivalência exata — é literalmente o
que `blink.st` já faz. Não implementei porque o modelo obrigatório **não
tem** um elemento gráfico de ADD/GE (só contato, bobina e `ctu`) — usar
aritmética teria significado abandonar o gráfico e escrever o ST peça
diretamente, o que não testaria nada sobre o modelo de dados da grade. A
conclusão que registro para a spec 002: **`CTU` é adequado para contar
eventos discretos com espaçamento natural ≥ 2 ciclos** (bordas de botão,
peças passando por um sensor), **não para contar ciclos de varredura
1-a-1** — se um editor Ladder quiser oferecer "conte N ciclos" como
primitiva visual, ele precisa de um elemento diferente de `CTU` (um
temporizador por ciclo, ou aceitar a mesma divergência de fase medida
aqui).

### 3.6 Reprodutibilidade

- `spikes/modelo/blink_ladder.st` — ST final (PV=13, com o rung 4 de
  instantâneo).
- `spikes/modelo/blink_ladder.toml` — fixture temporária (mesmo gabarito de
  `backend/tests/diferencial/fixtures/blink.toml`).
- `spikes/modelo/blink_ladder_pv12.st` / `.toml` — a tentativa alternativa
  do §3.5.
- `spikes/modelo/verificar_blink_ladder.py` — script que roda as quatro
  medições acima contra o `plc_host_runner` real. Não é teste do projeto
  (fica fora de `backend/tests/`, de propósito, para não misturar artefato
  de spike com a suíte real) — é só o script que produziu os números desta
  seção, para quem quiser reconferir.

---

## 4. Verificação de ambiente (o que rodou, onde)

- `npx tsc --noEmit` — limpo, sem erros, com `strict` + `noUncheckedIndexedAccess`
  + `exactOptionalPropertyTypes` (mais rígido que o mínimo pedido).
- `npx vitest run` — 19 testes, 2 arquivos, todos verdes
  (`fixtures.test.ts`: 4; `validacao.test.ts`: 15 — um teste (ou mais) por
  código de `Problema`, mais os casos de `posicaoValida`).
- `iec2c -f -I /usr/local/share/matiec/lib -T <out> blink_ladder.st` —
  `EXIT=0`, gera `POUS.c/h`, `Config0.c/h`, `Res0.c`, `GLOBALS.h`,
  `LOCATED_VARIABLES.h` (mesma saída canônica que `matiec.py` já verifica
  para os `.st` do projeto).
- `plc_host_runner` — resolvido por compilação sob demanda (terceira via de
  `executores._resolver_binario`, já que a imagem não tinha o binário no
  `PATH` nem `PLC_HOST_RUNNER` setada neste ambiente); nenhuma mudança
  necessária em `backend/`.

Tudo rodou em contêiner avulso (`ladderflow-backend:dev` para
Python/iec2c/plc_host_runner, `node:22-bookworm-slim` para TypeScript),
nunca `docker compose up`, nenhuma porta publicada — Regra 5 do
`CLAUDE.md`.
