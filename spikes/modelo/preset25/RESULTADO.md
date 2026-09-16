# RESULTADO — preset25: "erro de fase" ou limite intrínseco?

**Pergunta:** `spikes/modelo/NOTAS.md` (`Experimento BLINK`, §3.5) mediu que o
Ladder do BLINK com `CTU` **não é equivalente ciclo a ciclo** a `blink.st`
(PV=13 → 1 divergência no ciclo 50; PV=12 → 2, ciclos 24 e 49) e levantou a
hipótese de limite estrutural. Este spike investiga se isso é **erro de
fase** (corrigível por valor inicial de `pulso`, ordem dos rungs ou
construção do reset) antes de aceitar "limite intrínseco".

## Revisão aditiva (2026-09-16, orquestrador) — veredito abaixo REFUTADO

O veredito original ("divergência intrínseca") e a prova ficam preservados
abaixo como registro, mas **estão errados**: a variante
`variante_k_pv12_ctu_antes_iniFALSE_led_atrasado.st` fecha com **0
divergências nos três padrões de entrada** em 200 ciclos, contra o
`blink.st` real no `plc_host_runner` (medido com o mesmo `medir.py`). A
variante irmã `variante_k_pv12_pulso_antes_iniTRUE_led_atrasado.st` também
fecha, mas depende de valor inicial de variável, que o modelo não tem.

**Onde a prova falha.** O Fato 2 e a soma `1 + (2·PV − 1)` assumem que as
bordas de `CU` caem numa grade fixa de paridade — verdade só se `pulso`
oscilar livre. O diagrama pode **realinhar** `pulso` (bobina RESET de `pulso`
acionada pelo limite atingido), e aí a primeira borda depois do reset vem um
ciclo antes do que a grade livre daria. Com PV=12 isso produz período **25**
(ímpar). Faltava só a fase: alternar o LED pelo limite atrasado 1 ciclo
(`reset_ctu`, que já existe) em vez de `atingiu`.

**Caminho medido até a variante vencedora** (padrão (a), 200 ciclos):

| Variante | Mudança | Divergências | 1ª |
|---|---|---|---|
| H | PV=12 + reset atrasado 1 ciclo (sem realinhar) | 99 | 23 |
| I (`pv12_reset_pulso`) | PV=12 + RESET de `pulso` ao atingir | 16 | 23 |
| J (`pv12_ctu_antes_iniFALSE_realinhaFALSE`) | + rung do CTU antes do rung de `pulso` | 8 | 24 |
| **K (`pv12_ctu_antes_iniFALSE_led_atrasado`)** | **+ LED alterna por `reset_ctu`** | **0** | — |

As 16 → 8 → 0 divergências (2 por transição, depois 1, depois nenhuma)
mostram exatamente o previsto: I acerta o período e erra a fase em 2
ciclos; J reduz para 1; K fecha.

**Ladder da variante K** (sem valor inicial; só NA/NF, bobina, SET/RESET,
CTU):

```
R1 |--[ pulso ]---------+--[CTU ctu0 PV=12]--( atingiu )
   |--[ reset_ctu ]-----+   (CU no 1º caminho, R no 2º)
R2 |--[ atingiu ]------------------------(R pulso )
R3 |--[/ pulso ]-------------------------( pulso )
R4 |--[ led ]----------------------------( led_estava_aceso )
R5 |--[ reset_ctu ]--[/ led_estava_aceso ]--(S led )
R6 |--[ reset_ctu ]--[ led_estava_aceso ]---(R led )
R7 |--[ atingiu ]------------------------( reset_ctu )
R8 |--[ botao ]--------------------------(S led )
```

**Consequências para o modelo** (a resolver no plano da spec 002, não aqui):
- O `CTU` do contrato atual (`instancia`, `pv`, `saida`) não tem **entrada
  de reset**; a variante K exige um caminho de contatos até `R` — é também
  o que a Q-5 decidiu. Lacuna do modelo a fechar.
- R5/R6 são SET/RESET de `led` condicionados a um instantâneo do próprio
  `led`: recebem o **aviso** decidido na Q-6. É o comportamento correto do
  aviso, não falso positivo.

`fixtures.ts` **não** foi atualizado nesta revisão: o `BLINK` só pode
representar a variante K depois que o `CTU` do modelo ganhar a entrada de
reset (decisão de plano).

## Veredito (original, refutado pela revisão acima)

**Divergência intrínseca.** Nenhuma variante expressável no modelo
(`spikes/modelo/modelo.ts`: contato NA/NF, bobina comum/SET/RESET, ramo
paralelo, `CTU`) fecha com `blink.st`. A prova é analítica (abaixo) e as 7
variantes medidas (21 combinações variante×padrão de entrada, 200 ciclos
cada, gabarito forte = `plc_host_runner` rodando o `blink.st` real) a
confirmam sem exceção: a melhor variante medida (A, empatada com E) diverge
em 21–22 dos 200 ciclos, nunca 0.

## A prova (por que nenhuma variante fecha)

`CTU` (`/usr/local/share/matiec/lib/counter.txt`):

```
CU_T(CU);
IF R THEN CV := 0;
ELSIF CU_T.Q AND (CV < PV) THEN CV := CV+1;
END_IF;
Q := (CV >= PV);
```

Dois fatos, cada um independente de como o Ladder é desenhado:

**Fato 1 — nenhum `CU` construído a partir de contato/bobina pode gerar
borda de subida mais de 1 vez a cada 2 ciclos.** Uma borda de subida exige
o sinal baixo no scan anterior e alto neste. Qualquer variável booleana do
modelo é escrita no máximo 1 vez por scan e persiste até a próxima escrita
— o mínimo fisicamente possível entre "ficar baixo" e "voltar a ficar alto"
é 1 scan intermediário. Isso vale tanto para `pulso := NOT pulso` (período
2, o mais rápido possível) quanto para qualquer combinação série/paralela de
contatos sobre variáveis desse tipo — não há como um sinal assim ficar
"alto todo scan" e ainda gerar borda todo scan: se `CU` é constante-alto,
`CU_T.Q` só é verdadeiro no primeiro scan (não há transição depois). Isso já
descarta, à parte, a célula da matriz "PV=25 com borda a cada ciclo": **não
existe essa forma no modelo — não é limitação de desenho, é impossibilidade
do `R_TRIG`.**

**Fato 2 — resetar o `CTU` a partir do seu próprio `Q` custa no mínimo 1
scan inteiro sem contar.** `R` é uma entrada da chamada que produz `Q`;
usar `Q` desta MESMA chamada como `R` da MESMA chamada é uma referência
circular (não expressável em ST sequencial, nem no `iec2c`). O mínimo
possível é `R` no scan `n+1` refletir o `Q` do scan `n` — e nesse scan de
reset, a estrutura `IF R THEN CV:=0 ELSIF ... THEN CV:=CV+1` **impede** a
contagem de andar (reset tem prioridade sobre incremento no mesmo scan).
Esse scan de reset nunca conta um pulso — é sempre 1 scan "perdido", não
importa se o caminho até `R` tem 1 bobina intermediária (variante A, o
mínimo) ou mais (variante D).

**Combinando os dois fatos:** partindo de um reset em CV=0, o número mínimo
de scans para `CV` voltar a atingir `PV` é `1 (scan do próprio reset, sem
contar) + (2·PV − 1) (contagens espaçadas de 2 em 2, a mais rápida
possível)` = **2·PV scans** — sempre um número PAR, e esse é o **piso**
(qualquer desalinhamento de fase ou atraso extra de reset só aumenta esse
número, nunca diminui). `blink.st` alterna a cada **25** scans — ímpar. Não
existe `PV` inteiro com `2·PV = 25`; o piso para `PV=12` é 24 e para `PV=13`
é 26 — 25 fica estritamente entre os dois pisos possíveis, inatingível por
qualquer `PV` inteiro. **Isto é o que se mede**: a variante A com PV=13 bate
exatamente na largada (`atingiu` liga no ciclo 25, o mesmo de `blink.st`),
mas o período do próprio `CTU` é 26, não 25, e o erro de 1 ciclo se acumula
a cada meio-período — não é um erro pontual de fase que uma escolha de
valor inicial ou ordem de rung resolva (confirmado empiricamente pelas
variantes F e G, abaixo: mudar a fase move a PRIMEIRA divergência para
ANTES, não elimina a divergência).

Esta prova generaliza para qualquer topologia dentro do modelo (não só a
fixture `BLINK` de `fixtures.ts`): qualquer `CU` construído de
contato/bobina tem Fato 1; qualquer `R` alimentado a partir de `Q` (direto
ou por cadeia de bobinas) tem Fato 2. Não testei o produto cartesiano
completo da matriz por isso — células adicionais de fase/ordem só
redistribuem QUANDO o erro de 1 ciclo por meio-período aparece, nunca se
ele existe.

## Matriz medida

7 variantes, 3 padrões de `%IX0.0`, 200 ciclos cada, gabarito forte =
`blink.st` real via `plc_host_runner`, comparação completa
(`comparador.comparar_execucoes`). Todas compilam no `iec2c` (nenhuma falha
de compilação em nenhuma variante).

| Variante | O que varia frente à variante A | (a) sempre 0 | (b) pulso c.60 | (c) pressionado 45–55 |
|---|---|---|---|---|
| **A** — `variante_a_pv13_base.st` | baseline: PV=13, `pulso` inicia FALSE, rung `pulso` antes do `CTU`, reset com atraso mínimo (1 scan), toggle SET/RESET com instantâneo | 22 div., 1ª no ciclo 50 | 22 div., 1ª no 50 | 21 div., 1ª no 75 |
| **B** — `variante_b_pv12.st` | PV=12 | 44 div., 1ª no 23 | 44 div., 1ª no 23 | 41 div., 1ª no 23 |
| **C** — `variante_c_pv25.st` | PV=25 | 100 div., 1ª no 25 | 109 div., 1ª no 25 | 95 div., 1ª no 25 |
| **D** — `variante_d_pv13_reset_atrasado.st` | reset com 1 scan de atraso EXTRA (2 scans no total) | 99 div., 1ª no 26 | 99 div., 1ª no 26 | 93 div., 1ª no 26 |
| **E** — `variante_e_pv13_toggle_paralelo.st` | toggle por ramo paralelo (`led := (atingiu AND NOT led) OR (NOT atingiu AND led)`), sem SET/RESET nem instantâneo | 22 div., 1ª no 50 | 22 div., 1ª no 50 | 21 div., 1ª no 75 |
| **F** — `variante_f_pv13_pulso_inicial_true.st` | `pulso` inicia TRUE (não desenhável no modelo hoje — ver "achado") | 29 div., 1ª no 25 | 29 div., 1ª no 25 | 27 div., 1ª no 25 |
| **G** — `variante_g_pv13_ordem_invertida.st` | rung do `CTU` antes do rung de `pulso` | 29 div., 1ª no 25 | 29 div., 1ª no 25 | 27 div., 1ª no 25 |

**Leitura da tabela:**

- **A e E empatam como melhores** (22/22/21) — confirma que trocar o
  mecanismo de toggle (SET/RESET+instantâneo vs. ramo paralelo
  combinacional) não muda o período do `CTU`, só a robustez do desenho: E
  não precisa da variável auxiliar `led_estava_aceso` nem corre o risco de
  auto-cancelamento (NOTAS.md, §3.4) porque é 1 único rung, não 2 bobinas
  concorrentes.
- **B (PV=12) e C (PV=25) são piores**, não melhores — confirma que não há
  um "PV mágico" mais próximo de 25 que resolva; qualquer PV integer erra
  por pelo menos 1 ciclo de meio-período, e o erro absoluto cresce com a
  distância de `PV` ao ponto ótimo (13).
- **D (reset mais atrasado) é pior**, não melhor — confirma que adicionar
  atraso ao reset (a direção oposta de "imediato") só piora; a variante A
  já usa o atraso mínimo possível (Fato 2 da prova).
- **F (fase por valor inicial) e G (fase por ordem de rung) são piores, não
  melhores** — esta é a refutação direta da hipótese do enunciado. Ambas
  adiantam a primeira divergência do ciclo 50 para o ciclo **25** (a
  própria transição em que `blink.st` liga o LED pela primeira vez já sai
  errada). Mudar a fase não elimina a divergência: só escolhe ONDE ela
  aparece primeiro, e as duas escolhas testadas aqui a trazem para mais
  cedo, não a eliminam.

## Achado sobre o modelo (não é o motivo da não-equivalência)

A variante F depende de `pulso : BOOL := TRUE;` — um valor inicial de
variável. `Variavel` em `spikes/modelo/modelo.ts` não tem esse campo (só
`nome`, `tipo`, `endereco?`), então esta variante é escrita em ST puro mas
**não é desenhável hoje** com o modelo gráfico da grade: nada em
`Diagrama`/`Rung`/`Elemento` deixa o autor de um diagrama declarar "esta
variável começa em TRUE". Registro isso como o gap que a instrução pediu
para reportar — mas como F **não é a variante vencedora** (é estritamente
pior que a A), o modelo **não precisa mudar** por causa deste spike.

## ST da variante A (a melhor medida, referência)

```st
PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL;
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

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
END_PROGRAM
```

Diagrama ASCII e explicação completa em
`spikes/modelo/preset25/variante_a_pv13_base.st` (cabeçalho do arquivo).
Idêntico, aliás, ao `blink_ladder.st` já existente em `spikes/modelo/` —
reproduzido aqui só para entrar na mesma bateria de medição de 200 ciclos.

Como o veredito é "divergência intrínseca" (não "equivalência exata
alcançada"), **`spikes/modelo/fixtures.ts` não foi alterado** — a fixture
`BLINK` já documenta a mesma limitação em `NOTAS.md`, e não há variante
vencedora que justifique trocar o desenho de referência. Nenhum `tsc`/
`vitest` precisou rodar por conta deste spike (a condição do enunciado para
rodá-los era exatamente a equivalência exata, que não ocorreu).

## Reprodutibilidade

- `spikes/modelo/preset25/variante_{a..g}_*.st` — as 7 variantes, cada uma
  com diagrama ASCII e ST comentados no próprio cabeçalho do arquivo.
- `spikes/modelo/preset25/medir.py` — script de medição; importa
  `backend/tests/diferencial/{executores,comparador}.py` por import direto
  (mesmo mecanismo de `spikes/modelo/verificar_blink_ladder.py`), sem copiar
  código de lá. Roda `blink.st` (gabarito forte) e as 7 variantes contra 3
  padrões de `%IX0.0`, 200 ciclos, e imprime divergências + tabela resumida.
- Comando usado (Regra 5 do `CLAUDE.md`; sem publicar porta, sem
  `docker compose up`):

  ```bash
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v .:/repo -w /repo/backend ladderflow-backend:dev \
    python /repo/spikes/modelo/preset25/medir.py
  ```

  (rodado a partir da raiz do worktree; `plc_host_runner` resolvido por
  compilação sob demanda em `/tmp/ladderflow-plc-host-runner/`, terceira via
  de `executores._resolver_binario`, igual ao que `verificar_blink_ladder.py`
  já fazia).
