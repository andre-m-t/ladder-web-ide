# Plano 004 — Simulação de ciclo de varredura no navegador

> **Status:** aprovado (2026-09-20) — o autor aprovou o plano de rodada e liberou
> `/planejar`, `/tarefas` e `/implementar` na mesma decisão
> **Spec de origem:** `spec.md` (aprovada em 2026-09-20, Q-1 a Q-8 decididas)
> **Autor:** André  ·  **Data:** 2026-09-20

Este documento descreve **o como**. Cada decisão rastreia para um requisito da
`spec.md`.

---

## 1. Resumo da abordagem

O motor de simulação é **núcleo puro** em `frontend/src/ladder/simulacao.ts`:
funções sem React, sem SVG, sem `localStorage` e sem relógio. Recebe um
`Diagrama` e um `EstadoSimulacao` e devolve um `EstadoSimulacao` novo. Quem
decide *quando* chamar é a interface (que usa relógio) ou o executor de teste
(que chama em laço). É o mesmo padrão núcleo/desenho que a spec 002 estabeleceu
e a spec 003 repetiu — e é o que faz o lado 2 (RF-19) sair quase de graça.

A energização de um degrau é calculada por **propagação de fluxo da esquerda
para a direita** sobre um grafo de nós por linha (D-1), leitura própria e
independente da redução série-paralelo do serializador (RF-7). O resultado não é
só um booleano por degrau: é o estado de cada nó, de cada célula e de cada
elemento — é isso que o desenho consome para engrossar o traço certo (RF-6).

O segundo executor (RF-19) é um processo de verdade: um *shim* de linha de
comando, empacotado sob demanda pelo `esbuild` que já existe em
`frontend/node_modules`, executado por `node` dentro da imagem de teste do
back-end. O `SimuladorExecutor` fala exatamente o contrato já publicado em
`docs/validacao/contrato-runtime-host.md`, de modo que `runner.py`,
`comparador.py` e as fixtures TOML não mudam uma linha (RF-20).

Na interface, a simulação é um **modo**: entrar nele congela a edição e
desabilita Compilar/Gravar (RF-15); a cadência de ciclo (20 ms) é separada da
cadência de quadro (D-8).

## 2. Reúso do que já existe

| O que | Onde | Como é usado |
|---|---|---|
| Modelo da grade e utilitários de forma | `frontend/src/ladder/modelo.ts` (`ehContato`, `ehBobina`, `ehTerminal`, `ehCtu`, `variavelDoElemento`, `COLUNAS_POR_DEGRAU`, `COLUNA_TERMINAL`) | entrada do simulador; nenhuma forma nova de elemento |
| Limites do contador | `frontend/src/ladder/ctu.ts` (`PV_MIN`, `PV_MAX`) | validação já existente, não reimplementada |
| Classe da variável | `frontend/src/ladder/edicao.ts` (`classeDaVariavel`) | decide o que é acionável (RF-12); **lido, não alterado** |
| Validação | `frontend/src/ladder/validacao.ts` (`validarDiagrama`) | portão de simulação (RF-18), pelo mesmo caminho do Compilar |
| Fixtures de referência | `frontend/src/ladder/fixtures.ts` (`MINIMAL`, `IO_ESPELHO`, `RAMO_OU`, `SET_RESET`, `SELO`, `BLINK`) | os seis cenários medidos; nenhum inventado |
| Arquivos dourados | `backend/tests/fixtures/serializados/*.st` | o que o runtime em C executa do outro lado |
| Gabaritos e arcabouço | `backend/tests/diferencial/**` (`Executor`, `HostRunnerExecutor`, `comparar_execucoes`, `rodar_fixture`, TOMLs) | **sem alteração**, exceto a classe nova em `executores.py` |
| Construção sob demanda | `diferencial/executores.py::_construir_sob_demanda` | o padrão que o empacotamento do simulador copia (D-10) |
| Coluna "Valor" | `components/ladder/TabelaVariaveis.tsx` (`ValorCelula`, prop `valores?: Record<string, boolean>`) | **já reservada desde a #23**; ganha acionamento e passa a receber dados |
| Recusas e avisos | `lib/toasts.ts`, `components/ide/Console.tsx`, `ListaProblemas.tsx` | nenhum mecanismo novo de mensagem |
| Tokens de tema | `index.css` / classes `ide-*` | a cor de energizado entra como token, nos dois temas |
| e2e em Chromium real | `frontend/e2e/rodar.sh` | cenário novo no mesmo arcabouço |

Nenhuma dependência nova no produto. A única dependência nova é **no ambiente de
teste do servidor** (`node`, Q-8a) — ver D-10.

## 3. Componentes afetados

| Componente | Caminho | Novo/alterado | Responsabilidade |
|---|---|---|---|
| Motor de simulação | `frontend/src/ladder/simulacao.ts` | **novo** | RF-1 a RF-9; núcleo puro |
| Testes do motor | `frontend/src/ladder/simulacao.test.ts` | novo | tabela-verdade, ciclo, contador, SET/RESET |
| Diagramas exportados | `frontend/src/ladder/simulacao.dourados.test.ts` | novo | grava `backend/tests/fixtures/diagramas/<nome>.json` |
| Shim de linha de comando | `frontend/src/ladder/simulacao-cli.ts` | **novo** | RF-19; lê stdin, escreve stdout no contrato |
| Desenho da energização | `components/ladder/GradeDegrau.tsx`, `Simbolos.tsx`, `SimboloCtu.tsx` | alterado | RF-6, RF-14 |
| Editor (fronteira) | `components/ladder/EditorLadder.tsx` | alterado | repassa energização e `congelado` |
| Painel de variáveis | `components/ladder/PainelVariaveis.tsx`, `TabelaVariaveis.tsx` | alterado | RF-12, RF-13 |
| Barra superior | `components/ide/BarraSuperior.tsx` | alterado | RF-10, RF-11, RF-15, RF-16 |
| IDE | `App.tsx` | alterado | dono do relógio e do modo (D-8, D-9) |
| Executor do simulador | `backend/tests/diferencial/executores.py` | alterado (aditivo) | `SimuladorExecutor` |
| Teste diferencial | `backend/tests/test_simulacao_diferencial.py` | **novo** | CA-1 a CA-3 |
| Imagem de teste | `backend/Dockerfile` | alterado | `node` (Q-8a) |
| Terceiros | `THIRD_PARTY.md` | alterado | Node.js identificado |
| Depósito | `scripts/build-deposito.sh` | alterado | `simulacao.ts` e `simulacao-cli.ts` em `REQUIRED_FILES` |
| e2e | `frontend/e2e/simular.spec.ts` | novo | CA-4, CA-5, CA-8 |
| Arcabouço (doc) | `backend/tests/diferencial/README.md` | alterado | "aguardando F9" deixa de ser verdade |

## 4. Decisões técnicas

### D-1: energização por propagação de fluxo sobre nós, não por redução série-paralelo
- **Escolha:** cada degrau vira um grafo de **nós por linha**. Na linha 0, o nó
  `k` é a fronteira à esquerda da coluna `k` (`k` de 0 a `COLUNAS_POR_DEGRAU`); o
  nó 0 é o trilho esquerdo e está sempre energizado. A célula `(linha, coluna)` é
  uma aresta de `coluna` para `coluna+1` naquela linha, que **conduz** se a
  célula está vazia (fio) ou se o elemento dela conduz. Um ramo na linha `L`
  entre `colunaInicio` e `colunaFim` liga o nó `colunaInicio` da linha 0 à
  linha `L`, e a linha `L` de volta ao nó `colunaFim+1` da linha 0. A
  propagação é uma varredura da esquerda para a direita até estabilizar: nó
  energizado + aresta que conduz ⇒ nó seguinte energizado.
- **Alternativas descartadas:** reaproveitar `serializador.ts`
  (`construirArestas`/`reduzirSerieParalelo`/`propagarPorNo`) — **proibido pelo
  RF-7**: os dois lados da medição ficariam com a mesma leitura de topologia e a
  comparação mediria zero divergências sem medir nada. Avaliar a expressão
  booleana do degrau — daria o resultado, mas não diz **por onde** a energia
  passa, e o RF-6 precisa disso para o desenho.
- **Consequência:** a propagação por nós trata ramos cruzados sem caso especial,
  e é justamente onde o diferencial pode achar diferença contra a redução do
  serializador (R-4).
- **Requisito atendido:** RF-6, RF-7.

### D-2: imagem de processo explícita
- **Escolha:** `executarCiclo` copia as entradas acionadas (`estado.entradas`)
  para os valores das variáveis **uma vez**, no início do ciclo; resolve os
  degraus na ordem, escrevendo em `variaveis` conforme resolve; publica o estado
  ao fim. Acionamento feito no meio de um ciclo só entra no ciclo seguinte.
- **Alternativa descartada:** ler a entrada no momento em que cada contato é
  avaliado — é o modelo de circuito, não o de CLP, e é exatamente o
  mal-entendido que a feature existe para desfazer.
- **Requisito atendido:** RF-1, RF-2, RF-12.

### D-3: escrita dentro do ciclo é visível para o degrau seguinte
- **Escolha:** a escrita de bobina, SET, RESET e saída de contador vai para o
  mesmo mapa `variaveis` que os degraus seguintes leem, no mesmo ciclo.
- **Justificativa:** é a semântica do texto que a serialização gera e que o
  runtime executa (uma sequência de atribuições). Qualquer outra escolha criaria
  divergência **por construção** entre simulador e runtime, poluindo a métrica
  com uma diferença que não é de leitura da norma, e sim de decisão nossa.
- **Requisito atendido:** RF-2, RF-5.

### D-4: contador com estado próprio e borda de subida
- **Escolha:** `contadores[instancia] = { contagem, cuAnterior }`. Em cada ciclo,
  na ordem do degrau: se o caminho de reinício conduz, `contagem = 0`; senão, se
  `cu && !cuAnterior`, incrementa até o teto (`PV_MAX`); depois `cuAnterior = cu`
  e a saída recebe `contagem >= pv`.
- **Justificativa:** é a semântica do bloco `CTU` da norma, a mesma já medida nos
  dois lados na Fatia 4. O simulador **reproduz** semântica conhecida, não a
  descobre.
- **Requisito atendido:** RF-4.

### D-5: contrato de energização por nó, célula e elemento
- **Escolha:** ver §5. O núcleo devolve o estado por nó, por célula e por
  elemento; o desenho decide o pixel. Nenhuma coordenada, cor ou espessura
  atravessa essa fronteira.
- **Requisito atendido:** RF-6, §6 da Constituição.

### D-6: estado imutável, funções puras
- **Escolha:** `executarCiclo`, `acionarEntrada` e `reiniciar` devolvem estado
  novo; nada é mutado no lugar.
- **Justificativa:** o React re-renderiza por identidade; e o executor de teste
  precisa guardar o estado de cada ciclo sem cópia defensiva. Custo medido na
  CA-11; se o custo aparecer, a otimização é interna ao núcleo.
- **Requisito atendido:** RF-19, CA-11.

### D-7: `Reiniciar` volta ao estado inicial completo
- **Escolha:** `reiniciar(diagrama)` é `criarEstado(diagrama)` — zera variáveis,
  entradas acionadas, contadores e a contagem de ciclos.
- **Alternativa descartada:** preservar os acionamentos de entrada ("as chaves
  continuam onde estavam"). É defensável, mas a CA-6 pede estado inicial, e um
  reinício que preserva parte do estado é mais difícil de explicar do que um que
  não preserva nada.
- **Requisito atendido:** RF-10, CA-6.

### D-8: cadência de ciclo separada da cadência de quadro
- **Escolha:** o relógio vive em `App.tsx`. Um laço baseado em
  `requestAnimationFrame` calcula, a cada quadro, **quantos ciclos** cabem no
  tempo decorrido (`floor(dt / intervalo)`, com teto por quadro para não travar a
  aba depois de uma pausa da janela), executa esse número de ciclos em sequência
  e **redesenha uma vez**. Em tempo real (20 ms) isso dá ~1 ciclo por quadro a
  60 Hz; na marcha lenta, 1 ciclo a cada N quadros.
- **Alternativa descartada:** `setInterval(20)` com um `setState` por ciclo —
  a granularidade do temporizador do navegador não garante 20 ms e cada ciclo
  forçaria um redesenho, que é o gargalo.
- **Teto registrado:** no máximo `MAX_CICLOS_POR_QUADRO` ciclos por quadro; se o
  orçamento estourar de forma sustentada, a interface indica que está atrasada em
  vez de mentir. Medido na CA-11.
- **Requisito atendido:** RF-11, CA-11.

### D-9: simulação é um modo exclusivo da IDE
- **Escolha:** `App` guarda `simulacao: { ativa, rodando, intervalo, estado }`.
  Com a simulação ativa: `EditorLadder` recebe `congelado` (nenhuma edição,
  nenhum arrasto, nenhuma paleta ativa), Compilar/Gravar/Baixar-`.st` ficam
  desabilitados com motivo, e o painel de variáveis entra em modo ao vivo.
  Ao sair, o estado de simulação é descartado (RF-17).
- **Portão de entrada:** o mesmo que o Compilar já usa — erros de
  `validarDiagrama` impedem, avisos não (RF-18).
- **Requisito atendido:** RF-15, RF-16, RF-17, RF-18.

### D-10: segundo executor como processo real, empacotado sob demanda (Q-8a)
- **Escolha:** três peças.
  1. **`simulacao-cli.ts`** (front-end, autoral): lê um `Diagrama` em JSON de um
     caminho passado como argumento, consome stdin no formato do contrato
     (`%IX0.0=1 %IX0.1=0`, uma linha por ciclo, linha vazia = "sem mudança") e
     escreve stdout no formato do contrato (`ciclo=N %QX0.0=1 ...`, todas as
     saídas, em ordem crescente de endereço). Código de saída diferente de zero
     com a mensagem íntegra em stderr, como o runtime em C.
  2. **Empacotamento sob demanda** (`SimuladorExecutor`): invoca o binário nativo
     `frontend/node_modules/@esbuild/linux-x64/bin/esbuild` — que **não precisa
     de `node` para empacotar** — produzindo um `.mjs` único num diretório
     temporário do sistema, **nunca dentro do repositório** (a mesma restrição de
     `_construir_sob_demanda`, que o `build-deposito.sh` cobra). Memoizado por
     sessão de pytest.
  3. **`node`** na imagem do back-end (`apt-get install -y nodejs`), para
     executar o pacote.
- **Resolução em três vias**, igual ao `HostRunnerExecutor`: variável de ambiente
  `LADDERFLOW_SIMULADOR` → `node` no PATH + empacotamento sob demanda →
  indisponível.
- **Alternativa mantida como plano B:** traço de execução gravado por um teste do
  vitest (Q-8b). Se (a) não fechar (R-3), a queda é registrada **com a limitação
  explícita de que o traço pode envelhecer** e com a guarda que impede isso: o
  traço carrega a sequência de entradas que o gerou e o `SimuladorExecutor`
  **falha alto** (nunca pula) se a sequência pedida não for exatamente aquela,
  mais um teste do vitest que regrava o traço e falha se o conteúdo mudar.
- **Requisito atendido:** RF-19, RF-20, Q-8.

### D-11: os diagramas de referência atravessam a fronteira como JSON gerado
- **Escolha:** `simulacao.dourados.test.ts` grava, por `toMatchFileSnapshot`,
  `backend/tests/fixtures/diagramas/<nome>.json` para os seis cenários — o mesmo
  mecanismo que já gera os `.st` dourados, e pelo mesmo motivo: o arquivo é
  **gerado a partir da fonte**, nunca escrito à mão, e uma mudança no modelo que
  altere o JSON faz o teste falhar e obriga a olhar o diff.
- **Como o executor acha o diagrama:** o `Executor` recebe `st_path` (contrato do
  arcabouço, que não muda — RF-20). `SimuladorExecutor` resolve o diagrama irmão
  pelo nome do arquivo: `.../serializados/blink.st` → `.../diagramas/blink.json`.
  Se o irmão não existir, **falha com motivo**, não pula.
- **Requisito atendido:** RF-19, RF-20.

### D-12: energizado se distingue por cor **e** espessura
- **Escolha:** um token de cor por tema (`--ide-energizado`) e um incremento de
  espessura no traço do fio, do símbolo e do conector do ramo. O símbolo
  energizado usa o mesmo par. A marcação de problema continua no canto da célula,
  sem mudança.
- **Alternativa descartada:** só cor (não sobrevive a quem não distingue a cor,
  nem à captura em tons de cinza do TCC); animação de fluxo (custa mais e some na
  marcha lenta).
- **Requisito atendido:** RF-14, CA-10.

### D-20: o congelamento se anuncia — preventivo antes de mensagem (2026-09-21)

> Decisão aditiva desta rodada de fechamento, sobre a revisão aditiva de
> RF-13/RF-15/CA-8 da spec. Não substitui a D-9: o congelamento continua sendo
> checado no `EditorLadder`, que segue dono da regra.

- **Escolha:** `congelado` deixa de ser exclusivo do `EditorLadder` e passa a ser
  **repassado** a `Paleta` e a `GradeDegrau`, que hoje não o recebem e por isso
  continuam desenhando os afetos de "arrastável". Em ordem de importância:
  1. **preventivo** — paleta esmaecida, não interativa e `aria-disabled`; cursor
     `not-allowed` sobre a grade e sobre a alça de ramo; **estado de simulação
     visível no cabeçalho**, como chip ao lado do chip de linguagem, e não apenas
     como `aria-pressed` no botão Simular;
  2. **complementar** — os manipuladores que hoje fazem `if (congelado) return`
     passam a emitir a recusa antes de sair, pela via já existente
     (`App.tsx: recusar` -> `aoRecusar` -> `lib/toasts.ts`). Nenhum componente
     novo, nenhuma dependência nova; `adicionarToast` já deduplica repetição
     consecutiva, então insistir no gesto não empilha.
- **Alternativa descartada:** só o toast, sem o preventivo. Foi o diagnóstico do
  autor: o problema não é a falta de mensagem, é a interface **convidar** uma
  ação que vai recusar — mesmo caso de affordance da fatia 1 da spec 002.
- **O que não muda:** `simulacao.ts` não é tocado. O núcleo está medido contra o
  runtime, e questão de desenho não ajusta núcleo medido — a mesma regra que
  valeu para o achado do fio da célula terminal. `PainelVariaveis` também não
  congela (decisão registrada no próprio arquivo): declarar, renomear e remover
  variável seguem liberados durante a simulação, o que permanece **limitação
  declarada**, não defeito.
- **Ordem das colunas (RF-13):** em `TabelaVariaveis`, "Valor" passa para logo
  depois de "Nome" — **Nome | Valor | Tipo | Uso | Pino | Ações**. Mudam juntos o
  `colgroup`, o `thead` e as duas linhas de corpo (`LinhaVariavel` e
  `LinhaAdicionar`); as larguras acompanham a coluna, não a posição. O
  `min-w-[600px]` **permanece**: a correção é de ordem, não de largura.
- **Requisitos atendidos:** RF-13, RF-15, CA-8 (todos na redação revisada de
  2026-09-21).

## 5. Contratos

### 5.1 Núcleo — `frontend/src/ladder/simulacao.ts`

Publicado **antes** de qualquer frente começar (Etapa 0), como `plc_hal.h` e
`ElementoCtu` foram.

```ts
/** Chave de nó: `${linha}:${no}`, `no` de 0 a COLUNAS_POR_DEGRAU (0 = trilho esquerdo). */
export type ChaveNo = string
/** Chave de célula: `${linha}:${coluna}`. */
export type ChaveCelula = string

export interface EnergizacaoDegrau {
  /** Nó energizado (a energia chega até aquela fronteira de coluna). */
  nos: Record<ChaveNo, boolean>
  /** O trecho de fio da célula está energizado: entra energizado E conduz. */
  celulas: Record<ChaveCelula, boolean>
  /** Estado próprio do elemento: contato conduzindo, bobina/contador acionado. */
  elementos: Record<string, boolean>
}

export interface EstadoContador {
  contagem: number
  /** Nível de CU no ciclo anterior — base da borda de subida (D-4). */
  cuAnterior: boolean
}

export interface EstadoSimulacao {
  /** Ciclos já executados; 0 no estado inicial. */
  ciclo: number
  /** Nível de cada variável declarada, depois do último ciclo. */
  variaveis: Record<string, boolean>
  /** Entradas acionadas pelo usuário; valem a partir do próximo ciclo (D-2). */
  entradas: Record<string, boolean>
  /** Por instância de contador. */
  contadores: Record<string, EstadoContador>
  /** Por id de degrau; tudo falso no estado inicial. */
  energizacao: Record<string, EnergizacaoDegrau>
}

/** Estado inicial: tudo falso, ciclo 0, energização calculada sem nenhuma entrada. */
export function criarEstado(diagrama: Diagrama): EstadoSimulacao

/** Um ciclo de varredura (D-2, D-3, D-4). Puro: devolve estado novo. */
export function executarCiclo(diagrama: Diagrama, estado: EstadoSimulacao): EstadoSimulacao

/** Aciona uma entrada; só tem efeito no ciclo seguinte (RF-12). Recusa
 *  variável que não seja de entrada, com motivo. */
export function acionarEntrada(
  diagrama: Diagrama,
  estado: EstadoSimulacao,
  nome: string,
  nivel: boolean,
): { ok: true; estado: EstadoSimulacao } | { ok: false; motivo: string }

/** Volta ao estado inicial completo (D-7). */
export function reiniciar(diagrama: Diagrama): EstadoSimulacao

/** Intervalo de ciclo do firmware, em milissegundos (RF-11). */
export const INTERVALO_TEMPO_REAL_MS = 20
```

### 5.2 Shim de linha de comando — `frontend/src/ladder/simulacao-cli.ts`

Empacotado para um `.mjs` único e executado por `node`. Formato **idêntico** ao
de `docs/validacao/contrato-runtime-host.md`, modo padrão (endereço da norma):

```
node simulador.mjs <diagrama.json>

stdin  : %IX0.0=1 %IX0.1=0        (uma linha por ciclo; linha vazia = sem mudança)
stdout : ciclo=1 %QX0.0=0 %QX0.1=0
         ciclo=2 %QX0.0=1 %QX0.1=0
saída  : 0 se executou todos os ciclos; != 0 com a mensagem íntegra em stderr
```

Regras: as saídas listadas são **todas** as variáveis com endereço `%QX`, em
ordem crescente de endereço; o shim não conhece GPIO (RF-9); um diagrama que
`validarDiagrama` recusa por erro faz o processo sair com código != 0 e motivo
em stderr.

### 5.3 Executor — `backend/tests/diferencial/executores.py` (aditivo)

```python
@dataclass
class SimuladorExecutor:
    nome: str = "simulador-ts"
    def disponivel(self) -> bool: ...
    def executar(self, st_path: Path, entradas: list[dict[str, bool]]) -> ResultadoExecucao: ...
```

`Executor`, `ResultadoExecucao`, `runner.py`, `comparador.py` e as fixtures TOML
**não mudam** (RF-20).

### 5.4 Props novas (interface)

```ts
// GradeDegrau / EditorLadder — ambas opcionais; ausentes = comportamento de hoje
energizacao?: EnergizacaoDegrau | null   // GradeDegrau (por degrau)
simulacao?: { energizacao: Record<string, EnergizacaoDegrau> } | null  // EditorLadder
congelado?: boolean                      // EditorLadder: nenhuma edição (D-9)

// TabelaVariaveis / PainelVariaveis
valores?: Record<string, boolean>        // JÁ EXISTE, hoje sempre ausente
aoAcionar?: (nome: string, nivel: boolean) => void  // só entradas (RF-12)
```

## 6. Estratégia de testes

| CA | Teste | Onde |
|---|---|---|
| CA-1 | `test_simulacao_diferencial.py` — 5 cenários contra os TOMLs existentes | pytest |
| CA-2 | `BLINK` no simulador × `blink.st` no `plc_host_runner`, 200 ciclos × 3 padrões, `comparar_execucoes` | pytest |
| CA-3 | divergência sintética → relatório com ciclo/ponto/esperado/obtido | pytest (já coberto pelo comparador; teste de fumaça do executor novo) |
| CA-4 | contato + bobina energizando com acionamento | vitest de componente **e** e2e com mouse real |
| CA-5 | `BLINK` alternando com o mesmo período em ciclos | vitest (núcleo, 200 ciclos) + e2e com relógio controlado |
| CA-6 | Passo avança 1 ciclo; Reiniciar zera | vitest (núcleo + componente) |
| CA-7 | projeto ST: controle desabilitado com motivo | vitest de componente |
| CA-8 | edição congelada, Compilar/Gravar desabilitados | vitest + e2e |
| CA-9 | valores ao vivo; entrada acionável, saída não | vitest de componente |
| CA-10 | energizado × desenergizado nos dois temas | captura em Chromium real (orquestrador) |
| CA-11 | 50 degraus a 20 ms/ciclo | medição em vitest, número registrado no `state.md` |
| CA-12 | diagrama com erro não simula | vitest de componente |
| CA-13 | reload volta ao modo edição | e2e |

Além dos CA: tabela-verdade do núcleo por enumeração (o mesmo rigor que o
serializador usou), incluindo ramo aninhado, ramo cruzado e lacuna; ordem
SET/RESET no mesmo ciclo; borda de subida do contador com CU preso em verdadeiro
(não conta duas vezes); reinício do contador tendo precedência sobre a contagem
no mesmo ciclo.

**Sem hardware.** Nada nesta spec depende de ESP32.

## 7. Riscos e mitigações

| # | Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|---|
| R-1 | Divergência simulador × runtime (borda de CU, ordem SET/RESET, momento da escrita da saída do contador) | alto | média | **Não ajustar o simulador até bater** (RF-8). Isolar ciclo e ponto, decidir qual lado lê a norma corretamente, corrigir esse lado, registrar a investigação na spec e no `state.md` |
| R-2 | Cadência: 50 ciclos/s × 50 degraus perde quadro | médio | média | D-8 (ciclos por quadro, redesenho único, teto por quadro); medir como a Fatia 4 mediu os 141 ms; se não fechar, marcha lenta vira padrão e o tempo real fica declarado como limitação medida |
| R-3 | Q-8a não fecha (`node`/`esbuild` no contêiner) | médio | baixa | Cair para Q-8b sem mudar a interface do executor, com a guarda do D-10 e a limitação registrada |
| R-4 | Ramos cruzados: a propagação de fluxo discorda da redução do serializador | médio | baixa | É o que o diferencial existe para achar (RF-7). Registrar como achado, ligado à pendência de desenho de ramos cruzados já aberta nas specs 002/003 |
| R-5 | Escopo de interface escorregar | médio | média | Congelamento de refinamento: o que incomodar vira lista no `state.md` |
| R-6 | Imagem velha (Regra 5) medindo o que não deveria | alto | média | Rebuild obrigatório assim que o `Dockerfile` mudar, antes de qualquer pytest |
| R-7 | Conflito de arquivo entre frentes | médio | baixa | Propriedade exclusiva por arquivo (§8); `frontend/src/ladder/` é só da frente N |

## 8. Sequência de entrega em fatias

**Etapa 0 (orquestrador, antes de despachar qualquer frente):** publicar o
contrato do §5.1 e §5.2 como arquivo com tipos e assinaturas, sem implementação.
Exigência explícita do autor, mesmo padrão de `plc_hal.h` e `ElementoCtu`.

**Fatia 1 — o motor medido (CA-1, CA-2, CA-3, CA-6 no núcleo, CA-11).**
É a fatia vertical no eixo que produz o resultado do trabalho: o motor existe e
já está medido contra o runtime real, antes de qualquer pixel.
- Frente **N** (dona de `frontend/src/ladder/`): `simulacao.ts`,
  `simulacao.test.ts`, `simulacao-cli.ts`, `simulacao.dourados.test.ts`.
- Frente **X** (dona de `backend/**` e do empacotamento): `SimuladorExecutor`,
  `test_simulacao_diferencial.py`, `Dockerfile`, `THIRD_PARTY.md`,
  `diferencial/README.md`.

**Fatia 2 — a simulação na ferramenta (CA-4, CA-5, CA-7 a CA-10, CA-12, CA-13).**
- Frente **D** (dona de `components/ladder/GradeDegrau|Simbolos|SimboloCtu`).
- Frente **T** (dona de `App.tsx`, `BarraSuperior`, `PainelVariaveis`,
  `TabelaVariaveis`, `EditorLadder`).
- Frente **E** (dona de `frontend/e2e/`) e **B** (dona de
  `scripts/build-deposito.sh`), ao fim.

**Propriedade de arquivo:** um dono por arquivo, sem exceção.
`frontend/src/ladder/` é **exclusivo da frente N** — é o ponto de convergência e
o candidato natural a conflito. `EditorLadder.tsx` é fronteira e pertence a
**T**; D não o toca. `.claude/state.md` é do orquestrador; nenhuma frente edita.

## 9. Impacto na Constituição

- **§2:** a Fatia 1 é a fatia vertical mínima **no eixo que importa** (motor
  medido ponta a ponta contra o runtime real); a Fatia 2 entrega o produto.
- **§4:** os critérios centrais são medidos contra o runtime real, não assumidos.
- **§5:** nenhuma dependência nova no produto; `node` entra **só na imagem de
  teste do servidor**, e o cliente continua sem instalar nada.
- **§6:** núcleo puro sem React, SVG, relógio ou pinagem; a interface consome.
- **§10:** Node.js entra em `THIRD_PARTY.md` como ferramenta externa em processo
  separado, usada só em teste; nenhum fonte de terceiro copiado para a árvore
  autoral. O pacote gerado pelo `esbuild` fica **fora do repositório**, em
  diretório temporário, como o binário do runtime no host.
- **§11 — tensão registrada (herdada do RF-7):** a duplicação da leitura de
  topologia entre serializador e simulador é deliberada. Unificá-la "por
  simplicidade" anularia a medição sem que nenhum teste acusasse. Está registrado
  na spec e aqui para sobreviver a uma futura refatoração bem-intencionada.
