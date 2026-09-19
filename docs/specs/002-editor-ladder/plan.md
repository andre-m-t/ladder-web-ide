# Plano 002 — Editor Ladder visual

> **Status:** aprovado (2026-09-16), com três ressalvas incorporadas na §10
> **Spec de origem:** [`spec.md`](./spec.md) — aprovada em 2026-09-16, Q-1 a Q-7 decididas
> **Autor:** André · **Data:** 2026-09-16
> **Insumos:** [`spike-canvas.md`](./spike-canvas.md) (tecnologia de renderização e modelo),
> `spikes/modelo/` (modelo, validação, fixtures) e `spikes/modelo/preset25/RESULTADO.md`
> (blink exato com CTU)

Este documento descreve **o como**. Cada decisão aqui rastreia para um
requisito da `spec.md`.

---

## 1. Resumo da abordagem

O editor é um módulo **inteiramente no navegador** (§5, §6), em duas camadas
separadas por um contrato de dados:

1. **Núcleo em TypeScript puro** (`frontend/src/ladder/`): o modelo da grade, as
   operações de edição como funções puras `Diagrama → Resultado`, a validação
   estrutural e a persistência. Nada aqui importa React. É a peça que F8
   (serializador) e F9 (simulador) vão consumir, e a que o spike S4 já provou
   com as três fixtures.
2. **Renderização em SVG puro pelo React** (`frontend/src/components/ladder/`),
   decidida pelo spike (`spike-canvas.md` §3): cada célula é um elemento do DOM
   com seu próprio handler — sem tradução de coordenadas, testável em jsdom sem
   mock, focável por teclado.

A interação é **selecionar e aplicar**, não arrastar: escolhe-se uma ferramenta
na paleta (ou um elemento já posto) e depois a célula de destino. Isso cobre
inserir, mover e remover com a mesma mecânica, funciona por teclado e dispensa
biblioteca de arrastar-e-soltar. Toda ação passa por uma operação pura que ou
devolve o novo diagrama ou recusa com motivo — **estrutura inválida por posição
ou limite nunca entra no estado** (RF-12, CA-5, CA-10). Problemas que só existem
no diagrama como um todo (degrau incompleto, variável não vinculada, bobina
duplicada) são permitidos durante a edição e **sinalizados** continuamente pela
validação (RF-11/RF-12, CA-4, CA-9).

A entrega segue as duas sprints previstas: **S5a** (grade, NA/NF/bobina,
inserir/mover/remover, variáveis, múltiplos degraus) e **S5b** (validação
visível, persistência, modos Ladder/ST, ramo paralelo, SET/RESET e o CTU
destacável). O CTU fica isolado em módulo próprio (Q-7).

## 2. Reúso do que já existe

- `spikes/modelo/modelo.ts` — contrato da grade (`Variavel`, `Celula`,
  `Elemento`, `Ramo`, `Rung`, `Diagrama`), validado pelo spike sem alteração.
  **Migra** para `frontend/src/ladder/modelo.ts` com três mudanças (D-2):
  entrada de reset no CTU, `tipo` só `BOOL`, severidade nos problemas.
- `spikes/modelo/validacao.ts` — `posicaoValida` e `validarDiagrama` com seis
  códigos de problema e 15 testes. **Migra** para `frontend/src/ladder/validacao.ts`,
  ganhando os códigos da Q-6 e a regra de CTU extraída para `ladder/ctu.ts`.
- `spikes/modelo/fixtures.ts` — `MINIMAL` e `IO_ESPELHO` migram como estão;
  `BLINK` é **reescrito** para a variante K (`preset25/variante_k_pv12_ctu_antes_iniFALSE_led_atrasado.st`).
- `spikes/modelo/*.test.ts` — migram, reescritos para imports explícitos de
  `vitest` (o front-end usa `test.globals` desligado, `frontend/vitest.config.ts`).
- `spikes/canvas-svg/src/App.tsx` — **não migra**; reaproveita-se o padrão
  (célula = `<g>` com `tabIndex`, `role="button"`, `aria-label`, `onClick` +
  `onKeyDown`) e o desenho dos símbolos, reescritos em componentes com Tailwind.
- `frontend/src/App.tsx` — padrão de estado em união discriminada (`fase`), handlers
  `ao*`; ganha a alternância de modos (D-6) sem alterar o fluxo de compilação.
- `frontend/src/components/EditorST.tsx`, `PainelErro.tsx` — convenções de props
  (`<Componente>Props`), `role="alert"` e detalhes em `<details>`, imitadas pela
  lista de problemas.
- `frontend/src/test/setup.ts`, `App.test.tsx` — Testing Library + `userEvent.setup()`,
  `afterEach(cleanup)`; mesmo padrão nos testes de componente.
- `frontend/src/lib/gravador.test.ts` — injeção de dependência por parâmetro;
  usada para injetar o armazenamento na persistência (D-5).
- `backend/tests/diferencial/` (`executores.py`, `comparador.comparar_execucoes`)
  e `spikes/modelo/preset25/medir.py` — base do teste de equivalência do blink (D-8).
- `backend/firmware/esp32-template/main/plc_io_map.h` — fonte dos endereços
  localizados válidos (`%IX0.0`, `%IX0.1`, `%QX0.0`, `%QX0.1`), espelhada no cliente (D-9).
- `scripts/build-deposito.sh` — `frontend/src` já está na allowlist e `*.test.ts(x)`
  já são excluídos; só `REQUIRED_FILES` muda.

Não há hoje persistência local, abas nem navegação no front-end: o padrão de
persistência (D-5) e de modos (D-6) é estabelecido aqui.

## 3. Componentes afetados

| Componente | Caminho | Novo/alterado | Responsabilidade |
|---|---|---|---|
| Modelo da grade | `frontend/src/ladder/modelo.ts` | novo | Tipos do diagrama e constantes de limite (Q-3) |
| Validação | `frontend/src/ladder/validacao.ts` | novo | `posicaoValida`, `validarDiagrama` → `Problema[]` com severidade |
| Operações de edição | `frontend/src/ladder/edicao.ts` | novo | Funções puras: inserir/mover/remover elemento, inserir/remover degrau, criar/remover ramo, vincular variável |
| Endereços do controlador | `frontend/src/ladder/enderecos.ts` | novo | Endereços localizados válidos, espelho de `plc_io_map.h` |
| CTU destacável | `frontend/src/ladder/ctu.ts` | novo | Posição, validação e criação do contador (Q-7) |
| Persistência | `frontend/src/ladder/persistencia.ts` | novo | Salvar/carregar diagrama no `localStorage` com versão (Q-1) |
| Fixtures | `frontend/src/ladder/fixtures.ts` | novo | `IO_ESPELHO`, `MINIMAL`, `BLINK` (variante K) |
| Editor | `frontend/src/components/ladder/EditorLadder.tsx` | novo | Estado do diagrama, ferramenta ativa, orquestra paleta/grade/painéis |
| Grade | `frontend/src/components/ladder/GradeDegrau.tsx` | novo | SVG de um degrau: trilhos, células, ramos, marcação de problemas |
| Símbolos | `frontend/src/components/ladder/Simbolos.tsx` | novo | Desenho de NA, NF, bobina, SET, RESET |
| Símbolo CTU | `frontend/src/components/ladder/SimboloCtu.tsx` | novo | Desenho do contador (Q-7) |
| Paleta | `frontend/src/components/ladder/Paleta.tsx` | novo | Ferramentas: elementos, mover, remover, ramo |
| Variáveis | `frontend/src/components/ladder/PainelVariaveis.tsx` | novo | Declarar variável interna/localizada, vincular ao elemento selecionado |
| Problemas | `frontend/src/components/ladder/ListaProblemas.tsx` | novo | Erros e avisos, com foco no elemento ao clicar |
| Tela | `frontend/src/App.tsx` | alterado | Modos "Ladder" e "ST" (Q-2) |
| Equivalência do blink | `backend/tests/fixtures/blink_ladder.st`, `backend/tests/test_blink_ladder.py` | novo | ST derivado do `BLINK` comparado ciclo a ciclo com `blink.st` (CA-3, Q-4) |
| Manifesto | `scripts/build-deposito.sh` | alterado | Núcleo `ladder/` e `EditorLadder.tsx` em `REQUIRED_FILES` |
| Terceiros | `THIRD_PARTY.md` | inalterado | Nenhuma dependência nova |

## 4. Decisões técnicas

### D-1: renderização em SVG puro pelo React
- **Escolha:** SVG emitido por componentes React, sem biblioteca de canvas.
- **Alternativas descartadas:** Konva — pior em todos os critérios medidos (325 × 213
  linhas, exige `canvas` nativo no teste, células invisíveis a leitor de tela,
  174 × 71 kB gzip); React Flow — feito para grafos de posicionamento livre, a
  grade rígida seria imposta contra a biblioteca. Evidência em `spike-canvas.md`.
- **Requisito atendido:** RF-1, RF-2 a RF-7 (superfície de edição); §5.

### D-2: modelo da grade migrado do spike, com três ajustes
- **Escolha:** o contrato de `spikes/modelo/modelo.ts`, com:
  1. **CTU com entrada de reset** (Q-5, variante K): o CTU é elemento
     **terminal** — ocupa a última coluna, como uma bobina, e publica "atingiu
     o limite" em `saida`. Ele se estende por duas linhas: a linha do elemento
     leva o caminho de contagem (CU) e o campo `linhaReset` indica a linha cujos
     contatos, a partir do trilho esquerdo, formam o caminho de reinício (R).
     Essa linha não pode conter ramo nem outro terminal.
  2. `Variavel.tipo` restrito a `'BOOL'` — o subconjunto não tem variável
     numérica exposta (Q-5); `UINT` do spike existia só para o contador do
     `blink.st`, que a variante K dispensa (§11).
  3. `Problema` ganha `severidade: 'erro' | 'aviso'` (Q-6).
- **Constantes de limite (Q-3):** `COLUNAS_POR_DEGRAU = 8`; `LINHAS_EXTRAS_MAX = 2`
  (ramos e linha de reset do CTU contam no mesmo limite).
- **Alternativas descartadas:** árvore série/paralelo — exige reestruturar nós a
  cada edição e um passo de layout antes de desenhar (`NOTAS.md` §1.1); CTU
  com reset por nome de variável em vez de caminho de contatos — contraria a Q-5.
- **Requisito atendido:** RF-1, RF-4, RF-5, RF-9, RF-10; Q-3, Q-5.

### D-3: operações de edição como funções puras que recusam
- **Escolha:** `edicao.ts` expõe operações `(Diagrama, args) → { ok: true; diagrama } | { ok: false; motivo }`,
  sem mutação. Posição inválida (`posicaoValida`), célula ocupada, limite de
  colunas/linhas (Q-3) e CTU sem espaço para a linha de reset **recusam** com
  motivo em português, exibido pelo editor em `role="alert"`. Remover um degrau
  ou elemento não deixa ramo órfão nem vínculo pendente (CA-7).
- **Alternativas descartadas:** aceitar qualquer posição e só sinalizar — a
  spec permite, mas posição inválida não tem desenho coerente na grade; mutação
  in-place — quebra o `useState` e dificulta o teste.
- **Requisito atendido:** RF-2 a RF-8, RF-12; CA-5, CA-7, CA-10.

### D-4: interação por seleção (ferramenta → célula), sem arrastar
- **Escolha:** paleta com ferramentas (NA, NF, bobina, SET, RESET, CTU, ramo,
  mover, remover). Clique ou Enter numa célula aplica a ferramenta; "mover" pede
  origem e depois destino. Esc cancela. Vincular variável: selecionar o
  elemento e escolher a variável no painel.
- **Alternativas descartadas:** arrastar-e-soltar — exige biblioteca ou código de
  ponteiro próprio, é pior por teclado e não é pedido pela spec (§11).
- **Requisito atendido:** RF-2 a RF-7, RF-9, RF-10.

### D-5: persistência em `localStorage` com envelope versionado
- **Escolha:** chave `ladderflow:diagrama`, valor `{ versao: 1, diagrama }`,
  gravado a cada mudança do diagrama. Na carga, JSON inválido ou versão
  desconhecida **não** quebram a tela: o editor abre vazio e mostra aviso de
  que o diagrama salvo foi descartado (nunca em silêncio, RF-12). O
  armazenamento é injetado (`Storage`) para teste; exceção do navegador (cota,
  modo privado) vira aviso.
- **Alternativas descartadas:** `sessionStorage` — some ao fechar a aba,
  contraria a Q-1; IndexedDB — assíncrono e desproporcional ao tamanho de um
  diagrama (§11).
- **Requisito atendido:** RF-13, CA-8; Q-1; §6 (nada vai ao servidor).

### D-6: modos "Ladder" e "ST" na mesma tela
- **Escolha:** `App.tsx` ganha `modo: 'ladder' | 'st'`, com dois botões em
  `role="tablist"`. O modo ST é a tela da F6, intocada, e continua sendo o
  caminho que compila. O modo inicial é Ladder. Trocar de modo não perde nenhum
  dos dois estados.
- **Alternativas descartadas:** roteador — dependência nova para duas telas (§11);
  substituir a caixa de ST — contraria a Q-2 e regride a fatia vertical (§2).
- **Requisito atendido:** Q-2; preserva RF-1 a RF-6 da spec 001.

### D-7: CTU destacável
- **Escolha:** tudo o que é específico do contador vive em `ladder/ctu.ts`
  (criação, regra de posição com linha de reset, validação) e em
  `components/ladder/SimboloCtu.tsx`, com testes próprios (`ctu.test.ts`). O
  resto do núcleo só conhece o CTU pelo tipo discriminado e por uma chamada em
  cada ponto de extensão (`posicaoValida`, `validarDiagrama`, paleta,
  símbolos). A fatia do CTU é a **última** (fatia 4) e o `BLINK` é a única
  fixture que o usa. **Retirar o CTU** = apagar os dois arquivos, remover o
  membro `'ctu'` da união e as chamadas nos pontos de extensão; o compilador
  aponta cada uma.
- **Alternativas descartadas:** registro dinâmico de tipos de elemento
  (plug-ins) — generalização especulativa para um único elemento opcional (§11).
- **Requisito atendido:** RF-5, CA-3; Q-7.

### D-8: equivalência exata do blink verificada sem esperar a F8
- **Escolha:** a spec exige equivalência ciclo a ciclo (Q-4 revisada), e a
  serialização automática é F8. Até lá, a cadeia é verificada em dois elos:
  1. **Diagrama → estrutura:** teste de componente constrói o `BLINK` pela UI
     e compara com `ladder/fixtures.ts`; teste unitário garante que `BLINK`
     não tem erro de validação.
  2. **Estrutura → comportamento:** `backend/tests/fixtures/blink_ladder.st`
     (a variante K, com cabeçalho que mapeia cada degrau do `BLINK` a um trecho
     de ST) é comparado com `blink.st` por `comparar_execucoes`, 200 ciclos,
     três padrões de entrada, em `test_blink_ladder.py` (pula se o
     `plc_host_runner` não estiver disponível, como `test_diferencial.py`).
  O elo manual (diagrama → ST à mão) fica registrado como risco e é fechado
  pela F8, que substitui o ST à mão pelo serializado.
- **Alternativas descartadas:** escrever um serializador mínimo agora —
  antecipa F8 e introduz comportamento fora da spec (§7 da spec).
- **Requisito atendido:** CA-3; Q-4.

### D-9: endereços localizados restritos ao mapa de pinos
- **Escolha:** `ladder/enderecos.ts` lista os endereços de `plc_io_map.h`
  (`%IX0.0`, `%IX0.1`, `%QX0.0`, `%QX0.1`); o painel oferece só esses, e a
  validação marca endereço fora da lista como erro (`endereco_invalido`, que
  substitui `endereco_mal_formado`) e bobina em `%IX` como erro. Um teste
  confere a lista contra o header, no mesmo espírito de `test_plc_io_map.py`.
- **Alternativas descartadas:** aceitar qualquer `%IX/%QX` bem formado — o
  diagrama seria aceito e falharia só no firmware, longe do erro.
- **Requisito atendido:** RF-9, RF-11.

### D-10: regras de validação da Q-6
- **Escolha:** dois códigos novos: `bobina_duplicada` (erro — duas bobinas
  simples com a mesma variável, apontando as duas) e `set_reset_autodependente`
  (aviso — existem SET e RESET da mesma variável e algum deles tem contato
  dessa mesma variável no seu caminho). A lista de problemas separa erros de
  avisos, e a grade marca a célula com cor e ícone distintos (não só cor).
- **Alternativas descartadas:** aviso para qualquer par SET/RESET — ruído no
  uso normal, contraria a Q-6.
- **Requisito atendido:** RF-11, RF-12, CA-9; Q-6.

## 5. Contratos (dados)

Não há API nova: o editor não fala com o servidor. O contrato é o modelo, que
F8 e F9 vão consumir.

```ts
// frontend/src/ladder/modelo.ts
export const COLUNAS_POR_DEGRAU = 8
export const LINHAS_EXTRAS_MAX = 2

export interface Variavel { nome: string; tipo: 'BOOL'; endereco?: string }
export interface Celula { linha: number; coluna: number }   // linha 0 = trilho principal
export type TipoContato = 'contato_na' | 'contato_nf'
export type TipoBobina = 'bobina' | 'bobina_set' | 'bobina_reset'
export type Elemento =
  | { id: string; tipo: TipoContato | TipoBobina; celula: Celula; variavel: string | null }
  | { id: string; tipo: 'ctu'; celula: Celula; linhaReset: number;
      instancia: string | null; pv: number; saida: string | null }
export interface Ramo { id: string; linha: number; colunaInicio: number; colunaFim: number }
export interface Rung { id: string; elementos: Elemento[]; ramos: Ramo[] }
export interface Diagrama { versao: 1; variaveis: Variavel[]; rungs: Rung[] }

// frontend/src/ladder/validacao.ts
export type CodigoProblema =
  | 'rung_incompleto' | 'variavel_nao_atribuida' | 'variavel_inexistente'
  | 'posicao_invalida' | 'endereco_invalido' | 'bobina_escreve_entrada'
  | 'bobina_duplicada' | 'set_reset_autodependente'
export interface Problema {
  codigo: CodigoProblema; severidade: 'erro' | 'aviso'
  rungId: string; elementoId: string | null; mensagem: string
}

// frontend/src/ladder/edicao.ts
export type ResultadoEdicao = { ok: true; diagrama: Diagrama } | { ok: false; motivo: string }
```

Notas: `Rung.colunas` do spike sai (largura fixa, Q-3). Terminais (bobinas e
CTU) só na última coluna e na linha 0; contatos nas colunas anteriores; linhas
> 0 só dentro de um `Ramo` ou na `linhaReset` de um CTU.

Persistência: `localStorage["ladderflow:diagrama"] = JSON.stringify({ versao: 1, diagrama })`.

## 6. Estratégia de testes

- **Unidade (vitest, `frontend/src/ladder/*.test.ts`):** cada operação de
  `edicao.ts` no caminho feliz e em cada recusa; `validarDiagrama` com um caso
  negativo por código; `ctu.test.ts` isolado; persistência com `Storage`
  falso (ok, JSON inválido, versão desconhecida, exceção de cota);
  `enderecos.test.ts` contra o conteúdo de `plc_io_map.h` lido como texto.
- **Componente (Testing Library, `components/ladder/*.test.tsx`):** construção
  pela UI e comparação do diagrama resultante com as fixtures; teclado.
- **Integração no back-end:** `test_blink_ladder.py` (D-8), na imagem, sem `slow`
  se o runner for construído rápido; senão marcado `slow`.
- **Ponta a ponta:** Playwright em contêiner contra `vite preview` (padrão da S3,
  sem publicar portas): construir `io_espelho`, recarregar a página e conferir
  que o diagrama continua; trocar para o modo ST e compilar como antes.
- **Desempenho (RNF):** teste de componente com 50 degraus preenchidos mede o
  tempo de uma inserção; registrado, com alerta se passar de 100 ms.
- **Manual/hardware:** nenhum — a feature não toca o ESP32.

| CA | Teste |
|---|---|
| CA-1 | componente: construir `IO_ESPELHO` pela UI (NA `%IX0.1` → bobina `%QX0.1`) = fixture, sem problemas |
| CA-2 | componente: construir `MINIMAL` (NF `entrada` → bobina `saida`, internas) = fixture, sem problemas |
| CA-3 | componente: construir `BLINK` pela UI = fixture; unidade: `BLINK` sem erros; back-end: `test_blink_ladder.py` 0 divergências |
| CA-4 | unidade: `rung_incompleto` (contato sem terminal, ramo aberto), `variavel_nao_atribuida`; componente: problema visível na grade e na lista |
| CA-5 | unidade: recusas de `inserirElemento`; componente: clique inválido não altera o diagrama e mostra motivo |
| CA-6 | componente: inserir segundo degrau, editar os dois, remover um, o outro intacto |
| CA-7 | unidade: `moverElemento`/`removerElemento`/`removerDegrau` sem vínculo ou ramo órfão; componente: mover por teclado |
| CA-8 | unidade: persistência; e2e: recarregar a página mantém o diagrama |
| CA-9 | unidade: `bobina_duplicada` (erro) e `set_reset_autodependente` (aviso); componente: erro e aviso visualmente distintos |
| CA-10 | unidade: recusa na 9ª coluna e na 3ª linha extra; componente: mensagem do limite |

## 7. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| ST do blink escrito à mão diverge do diagrama `BLINK` | alto | média | Cabeçalho de `blink_ladder.st` mapeia degrau a degrau; revisão cruzada na tarefa; F8 substitui pelo serializado e o mesmo teste passa a rodar sobre ele |
| CTU (linha de reset, símbolo de duas linhas) consome a sprint | médio | média | Fatia 4, isolado (D-7); retirada por revisão aditiva da Q-7 sem tocar o resto |
| Grade aceita ramo sem sentido elétrico | médio | média | `rung_incompleto` cobre ramo aberto; casos negativos dedicados |
| `localStorage` com diagrama de versão antiga após mudança do modelo | médio | baixa | Envelope versionado; descarte com aviso, nunca silencioso |
| Acessibilidade do SVG regride ao crescer | baixo | média | Células com `role`/`aria-label` testadas por teclado desde a fatia 1 |
| Desempenho com muitos degraus | baixo | baixa | Teste com 50 degraus (§6); só otimizar se medir lento |
| Endereços do cliente divergem de `plc_io_map.h` | médio | baixa | Teste que lê o header (D-9) |

Nenhum item exige ESP32 físico.

## 8. Sequência de entrega em fatias

**S5a — renderização e edição básica**

1. **Fatia 1 — espelho construível:** migração de `modelo.ts`/`validacao.ts`
   (sem CTU) e `enderecos.ts`; `edicao.ts` com inserir/remover elemento e
   vincular variável; `EditorLadder`, `GradeDegrau`, `Simbolos` (NA, NF,
   bobina), `Paleta`, `PainelVariaveis`; um degrau. Ponta a ponta: `IO_ESPELHO`
   e `MINIMAL` construídos pela UI (CA-1, CA-2, CA-5).
2. **Fatia 2 — múltiplos degraus e mover:** inserir/remover degrau, mover
   elemento, limite de colunas (CA-6, CA-7, parte de CA-10).

**S5b — usabilidade e validação**

3. **Fatia 3 — validação visível, persistência e modos:** `ListaProblemas`,
   marcação na grade, regras da Q-6, `persistencia.ts`, modos em `App.tsx`,
   e2e com recarga (CA-4, CA-8, CA-9).
4. **Fatia 4 — ramo, SET/RESET e CTU:** ramo paralelo com limite de linhas,
   bobinas SET/RESET, `ctu.ts` + `SimboloCtu`, `BLINK` pela UI,
   `blink_ladder.st` + `test_blink_ladder.py`, manifesto do depósito (CA-3,
   resto de CA-10).

Paralelismo possível para a implementação: na fatia 3, `persistencia.ts` +
modos (`App.tsx`) e validação visível (`ListaProblemas`, `validacao.ts`) não
compartilham arquivo; na fatia 4, `blink_ladder.st` + teste de back-end é
independente do front-end.

## 9. Impacto na Constituição

- **§2:** não é fatia vertical sozinha (a spec já registra); cada fatia do
  plano é testável de ponta a ponta dentro do navegador, e o modo ST preserva a
  fatia vertical da spec 001.
- **§3:** subconjunto declarado na spec; o desvio da Q-6 aparece como regra
  explícita de validação, nunca como recusa silenciosa; recusas sempre com motivo.
- **§4:** núcleo puro com cobertura unitária; o blink ganha teste diferencial.
- **§5/§6:** tudo no navegador; nenhum endpoint novo; persistência local.
- **§10:** nenhuma dependência nova; código do spike migra por reescrita
  autoral; `ladder/` e `EditorLadder.tsx` entram em `REQUIRED_FILES`.
- **§11:** sem arrastar-e-soltar, sem roteador, sem registro dinâmico de
  elementos; a única generalização (pontos de extensão do CTU) é a que a Q-7
  pede.
- **Tensão registrada:** D-8 aceita, até a F8, um elo verificado à mão
  (diagrama → ST). É a única parte do CA-3 não automatizada ponta a ponta.

## 10. Revisão aditiva — ressalvas da aprovação (2026-09-16)

O autor aprovou o plano com três ressalvas. Elas **complementam** as decisões
acima; nada foi apagado.

### R-1 (D-8): o elo manual do CA-3 fica declarado no código, não só aqui
`blink_ladder.st` escrito à mão prova que **aquele ST** equivale ao `blink.st`,
não que o **diagrama** `BLINK` equivale. Se a F8 gerar ST diferente, o CA-3
estaria validando outra coisa. Por isso:
- `test_blink_ladder.py` e o cabeçalho de `blink_ladder.st` levam um
  comentário explícito, no mesmo espírito do aviso sobre a invariante de
  `plc_glue_scan`: **a equivalência diagrama ↔ ST é assumida, não testada;
  este teste prova só ST ↔ `blink.st`; a F8 deve substituir o ST à mão pelo
  serializado a partir de `ladder/fixtures.ts` `BLINK`, e só então o CA-3 fica
  verificado de ponta a ponta.**
- O mesmo aviso, curto, acompanha `BLINK` em `ladder/fixtures.ts`, apontando
  para o teste.
- Risco da §7 mantido; a tarefa correspondente só fecha com os dois comentários.

### R-2 (D-4): seleção sem arrastar é decisão de design, não corte de escopo
A justificativa principal de D-4 passa a ser a **correção do modelo de
interação**: arrastar comunica posicionamento livre, e a grade Ladder não tem
posição livre — só células válidas, explícitas (RF-1). Seleção de ferramenta +
célula de destino expõe exatamente esse espaço discreto, e toda posição
oferecida é uma posição que existe. Simplicidade (§11) e acessibilidade por
teclado são consequências, não o motivo. O registro vale como decisão de
design para o capítulo de Desenvolvimento.

### R-3 (D-9): acoplamento com `plc_io_map.h` travado por teste que falha
Hoje **não existe** teste ligando o front-end ao header — o previsto em §6
(`enderecos.test.ts` lendo o header) nem rodaria no contêiner do front-end,
que não tem `backend/`. Substituição: o teste vai para
`backend/tests/test_plc_io_map.py` (roda em `-m "not slow"`, com o repositório
inteiro montado), extraindo os endereços de `plc_io_map.h` e de
`frontend/src/ladder/enderecos.ts` e exigindo **igualdade dos conjuntos, nos
dois sentidos**, com mensagem que nomeia o endereço sobrando ou faltando. Um
teste negativo prova que o comparador morde (conjunto com pino a mais falha).
Assim, acrescentar um pino no firmware sem atualizar o editor quebra a suíte
em vez de deixar o editor desatualizado em silêncio. A linha de CA/§6 que
citava `enderecos.test.ts` fica substituída por este teste.

### Nota para as frentes paralelas da implementação
`frontend/src/ladder/` é onde tudo converge e é o ponto natural de conflito.
Regra para `tasks.md`: **cada arquivo tem uma única frente dona por fatia**;
frentes de desenho (`components/ladder/`) consomem o núcleo por contrato
(§5) e não o editam; mudanças no contrato do núcleo são feitas pela frente
núcleo **antes** de as frentes de desenho começarem a fatia.

### Limitação declarada (Q-6)
A recusa de bobina simples duplicada entra, no TCC, como **limitação
declarada**, ao lado da cobertura parcial da IEC 61131-3: desvio consciente
da prática de mercado ("vale a última escrita"), por motivo didático.

## 11. Revisão aditiva — ajuste de interação entre as fatias 1 e 2 (2026-09-16)

Depois da fatia 1, o autor pediu que o editor mostrasse o efeito de uma ação
**antes** do clique e a recusa **junto à grade**. Não muda a spec (RF-12 já
exige sinalização visual; D-4/R-2 continuam valendo): muda o como da
interação. Tarefa #21.

### D-11: prévia fiel ao núcleo e recusa junto à grade
- **Escolha:**
  - **Paleta com símbolo:** cada botão mostra o símbolo do elemento (mini-SVG
    `aria-hidden`, reaproveitando `Simbolos.tsx`) ao lado do nome; o nome
    acessível continua sendo o texto.
  - **Prévia sob o cursor:** com ferramenta ativa, a célula sob o mouse **ou
    com foco de teclado** é destacada, e a prévia é calculada chamando a
    **própria operação do núcleo** (`inserirElemento`, ou a existência de
    elemento para `remover`) sem aplicar o resultado. Válida → fantasma
    translúcido do símbolo; inválida → célula em vermelho com o motivo do
    núcleo em `<title>`; remover → elemento em vermelho.
  - **Recusa junto à grade:** o motivo aparece em `role="alert"` logo abaixo do
    degrau afetado, e a célula recusada fica marcada (`aria-invalid`,
    `aria-describedby`) até a próxima ação bem-sucedida, Esc ou troca de
    ferramenta. Erros de declarar/vincular variável continuam no painel.
- **Por quê:** a prévia só é honesta se prometer exatamente o que o clique
  fará; derivá-la da operação do núcleo evita uma segunda cópia da regra de
  posição na UI, que divergiria com o tempo. Prévia também no foco mantém a
  paridade entre mouse e teclado exigida por R-2.
- **Alternativas descartadas:** reimplementar `posicaoValida` + ocupação no
  componente — duplica regra; texto do motivo dentro da célula — não cabe em
  64 px; prévia só por mouse — quebra a paridade com o teclado.
- **Requisito atendido:** RF-12, CA-5 (antecipa a parte "recusa visível junto
  ao elemento" da #13; a lista de problemas da validação continua na #13).

## 12. Revisão aditiva — arrastar-e-soltar, tabela de variáveis e modal (2026-09-16)

O autor usou o editor da fatia 1 com a #21 e **reverteu a decisão de
interação**: elementos com cara de botão, ferramenta ativa e seleção
persistente atrapalham o uso. D-4 (seleção ferramenta → célula) e a ressalva
R-2 (seleção como decisão de design) ficam registradas acima como a decisão
anterior; esta seção as **substitui**. A spec não muda — RF-2 a RF-10 dizem o
quê, não o gesto. D-11 (prévia pelo núcleo, recusa junto à grade) continua,
agora acionada durante o arrasto. Tarefa #22.

### D-12: somente arrastar-e-soltar, com teclado dentro do próprio arrasto
- **Escolha:**
  - Inserir (paleta → célula), mover (célula → célula) e remover (célula →
    lixeira) **só por arrasto**. Clique simples apenas marca o item; a
    lixeira (ou Delete) remove o marcado; a marcação some ao clicar fora,
    soltar algo ou Esc.
  - Arrasto implementado com **Pointer Events**, sem biblioteca: a grade é
    SVG (onde `draggable` nativo não existe) e o jsdom não tem `DataTransfer`.
  - **Teclado** usa a mesma máquina de estado: Espaço pega, setas movem o
    alvo, Espaço/Enter solta, Esc cancela, com anúncios em `aria-live`.
  - **Variáveis numa tabela ao lado dos degraus**: nome, **tipo**
    (entrada/saída/interna, derivado do endereço — modelo inalterado, dado
    continua BOOL) e **valor** (endereço, só pinos mapeados e livres).
  - **Modal** para atribuir variável: abre ao soltar item novo e com duplo
    clique/Enter no item; bobina não aceita variável de entrada.
  - Núcleo ganha `moverElemento` (antecipado da #9), `atualizarVariavel`
    (renomear propaga aos itens), `removerVariavel` (recusa se em uso) e
    `classeDaVariavel`/`enderecosDaClasse`.
- **Por quê:** avaliação de uso do autor — arrastar é o gesto esperado para
  compor um diagrama, e a seleção persistente criava modo escondido. A
  paridade de teclado que motivou R-2 é preservada dentro do arrasto.
- **Alternativas descartadas:** HTML5 DnD nativo — não arrasta a partir de
  SVG e não é testável em jsdom; `@dnd-kit` — dependência nova e colisão por
  retângulos sem teste em jsdom; manter seleção como alternativa ao arrasto —
  rejeitado explicitamente pelo autor ("apenas arrastar-e-soltar").
- **Requisito atendido:** RF-2, RF-6, RF-7, RF-9, RF-10, RF-12; CA-1, CA-2,
  CA-5, CA-7.

## 13. Revisão aditiva — IDE, segundo clique, variáveis simplificadas e 8/8 E/S (2026-09-17)

O autor usou a #22 e pediu três ajustes antes da fatia 2. Tarefa #23. D-12
(arrasto) continua; muda o gatilho do modal, o painel de variáveis e toda a
casca visual.

### D-13: IDE de tela inteira, segundo clique e variáveis BOOL com endereço
- **Escolha:**
  - **Segundo clique:** clique marca; clique no item já marcado (ou Enter)
    abre o modal; duplo clique é o caso rápido. Soltar item novo **marca e não
    abre** o modal.
  - **Variáveis:** colunas Nome | Endereço | Tipo (`BOOL` fixo) | Valor (estado
    atual, "—" até a F9 fornecer valor ao vivo); endereço opcional escolhido
    entre os livres, agrupados em entradas e saídas; filtro por classe; mapa
    endereço → GPIO.
  - **8 entradas e 8 saídas** (`%IX0.0–7`, `%QX0.0–7`) com pinagem real no
    firmware (revisão da Q-5 da spec 001, 2026-09-17); o teste R-3 passa a
    conferir também o GPIO de cada endereço.
  - **Casca de IDE** (`components/ide/`): tela inteira sem `max-w`; barra
    superior com abas Ladder/ST, status do servidor, Compilar, Gravar,
    alternadores e tema; painel de variáveis à direita e console embaixo,
    ambos recolhíveis e redimensionáveis por divisor (ponteiro e teclado);
    preferências de layout em `localStorage`.
  - **Diagrama sobe para a IDE:** `EditorLadder` controlado; `PainelVariaveis`
    como container sobre o núcleo.
  - **Console de eventos do cliente:** `/health`, compilação (início, tempo,
    imagens, cada diagnóstico) e gravação (progresso, erro classificado);
    substitui o `PainelGravacao`. Servidor continua síncrono (Q-6 da spec 001);
    transmitir a saída do `iec2c`/`idf.py` fica para spec futura.
  - **Temas escuro e claro** por tokens CSS (`index.css`, `data-theme`),
    escolhidos pela preferência do sistema e alternáveis.
  - As abas Ladder/ST antecipam os "modos" da #12, que fica só com a
    persistência do diagrama.
- **Por quê:** avaliação de uso do autor — modal a cada inserção interrompia a
  composição; "tipo/valor" da tabela anterior confundia; a tela em coluna
  estreita não parecia ferramenta de trabalho. Modelo de referência
  (`.claude/references/modelo.png`) usado como inspiração, sem cópia.
- **Alternativas descartadas:** manter o modal na soltura (rejeitado pelo
  autor); endereços 8/8 só no editor sem firmware (autor escolheu firmware
  agora); streaming do servidor no console (muda contrato da API, spec própria);
  biblioteca de painéis redimensionáveis (dependência nova; divisor próprio
  basta).
- **Requisito atendido:** RF-9, RF-10, RF-12; CA-1 (agora ponta a ponta na IDE),
  CA-2, CA-5, CA-7; preserva RF-1 a RF-6 da spec 001.

## 14. Revisão aditiva — degrau responsivo, variáveis por pino, ícones e ramo paralelo (2026-09-17)

Ajustes pedidos pelo autor após usar a #23. Tarefa #24. D-12 e D-13 continuam.

### D-14: degrau responsivo, "memória", pino no seletor, ícones e ramo por arrasto
- **Escolha:**
  - **Degrau responsivo:** largura da célula calculada da largura medida do
    cartão (mínimo 56 px), trilho e fio até a borda; rolagem horizontal só
    abaixo do mínimo.
  - **Variáveis:** "interna" passa a **Memória (sem pino)**; formulário com
    escolha explícita Entrada | Saída | Memória; seletor mostra `GPIO n · %IX0.k`;
    filtro Todas | Entradas | Saídas | Memórias; mapa de pinos em duas tabelas
    (Entradas e Saídas) com Endereço | GPIO | Variável.
  - **Header** com ícones e sem os chips de MATIEC/toolchain; o console registra
    **uma linha por ferramenta** na abertura.
  - **Paleta** sem rótulo, glifo monoespaçado por item (sem SVG duplicado), item
    **Ramo** e lixeira com ícone.
  - **Ramo paralelo por arrasto** (antecipado da #15): soltar "Ramo" numa coluna
    de contato cria o ramo na primeira linha livre; **alça** na ponta direita
    estica/encolhe; ramo marcado sai pela lixeira/Delete; ramo vazio é
    `rung_incompleto`. Prévia e recusa pelo núcleo (`criarRamo`,
    `redimensionarRamo`, `removerRamo`).
  - **Dependência nova:** `lucide-react` (ISC), só ícones, importados por nome
    (tree-shaking), pedida pelo autor; registrada em `THIRD_PARTY.md`.
- **Por quê:** avaliação de uso — espaço desperdiçado ao lado do degrau, criação
  de variável sem pino não percebida, pino físico é o que o estudante liga na
  bancada, status duplicado no header, e o contato de selo (ramo) é o primeiro
  circuito que todo curso de Ladder ensina.
- **Alternativas descartadas:** ramo criado arrastando sobre colunas sem alça
  (autor preferiu alça); ícones SVG próprios (autor pediu biblioteca);
  mostrar só GPIO sem o endereço (o endereço é o que aparece no degrau e no ST).
- **Requisito atendido:** RF-1, RF-4, RF-9, RF-10, RF-12; CA-2, CA-4 (ramo vazio),
  CA-10 (limite de linhas).


## 15. Revisão aditiva — fatias 2 e 3 na casca de IDE (2026-09-17)

As fatias 2 e 3 (#9–#14) foram executadas juntas, porque a #22–#24 já tinham
entregue mover, abas Ladder/ST e ramo paralelo. D-5 e D-10 continuam valendo;
esta seção só registra onde a interface mudou em relação à §8.

### D-15: problemas numa aba do painel inferior, foco por token e leitura de "caminho"
- **Escolha:**
  - **Lista de problemas** (`components/ide/ListaProblemas.tsx`) vai para uma
    aba **"Problemas (N)"** no painel inferior, ao lado do Console, em vez de
    ficar abaixo dos degraus como a §8 previa. Erros e avisos em grupos
    separados, ícone e texto distintos; `role="alert"` só com erro.
  - `validarDiagrama` roda uma vez no `App` (`useMemo`) e desce para o editor
    (`problemas`) e para a lista; a grade marca a célula com selo de forma
    distinta (círculo = erro, triângulo = aviso) e sufixo no `aria-label`;
    problema sem elemento marca o cabeçalho do degrau.
  - **Foco por token:** `EditorLadder` recebe `foco = { rungId, elementoId,
    token }`; clicar num problema troca para a aba Ladder e incrementa o token.
  - **Degraus:** inserir abaixo e remover por botões no cabeçalho do degrau,
    inserir no fim por botão após a lista; o último degrau não pode ser
    removido.
  - **Persistência:** carregada no `App` na montagem, salva a cada mudança; aviso
    de descarte ou falha de gravação vai ao Console (uma vez por falha).
  - **`set_reset_autodependente`:** D-10 não define "caminho". Leitura adotada:
    o **degrau inteiro** do SET/RESET, porque cada degrau tem no máximo uma
    bobina. É a leitura mais abrangente que dispensa simular o circuito — pode
    avisar a mais (contato num ramo sem efeito real), nunca a menos.
    *Nota (2026-09-17, autor):* mantida. Registrada como **limitação conhecida**:
    com ramo paralelo, "mesmo caminho" passa a ter sentido preciso e o aviso fica
    conservador demais em alguns casos. Reavaliar depois da fatia 4, se incomodar.
- **Por quê:** a tela virou IDE na #23; lista abaixo dos degraus disputaria
  espaço com a grade, e o painel inferior já é o lugar de saída da ferramenta.
  Decisão do autor em 2026-09-17.
- **Alternativas descartadas:** faixa de problemas dentro do `EditorLadder`;
  validar dentro do editor (duplicaria o cálculo que a lista também usa).
- **Requisito atendido:** RF-6, RF-8, RF-11, RF-12, RF-13; CA-4, CA-6, CA-7,
  CA-8, CA-9, CA-10.

## 16. Revisão aditiva — ajustes de UX após as fatias 2 e 3 (2026-09-17)

Pedido do autor após usar a IDE. Tarefa #25. D-15 continua, com os ajustes abaixo.

### D-16: degrau vazio, mensagens fora do editor, escada contínua e soltura da bobina
- **Escolha:**
  - **Vazio × incompleto:** degrau sem elemento e sem ramo não gera problema;
    com ao menos um elemento ou ramo e sem bobina, `rung_incompleto` (erro).
  - **Aba inicial do painel inferior:** Console; Problemas só quando o diagrama
    carregado do armazenamento tem erro. Aviso não muda a aba. A preferência
    salva da aba inferior deixa de existir.
  - **Mensagens:** nenhum texto dentro do editor. Problemas → aba Problemas;
    recusa de ação → `BarraStatus` (rodapé da IDE, some em 6 s) + Console, via
    `aoRecusar` em `EditorLadder` e `PainelVariaveis`. No degrau ficam só sinais
    sem texto (ícone de problema, prévia vermelha), com o texto no nome acessível
    e o anúncio `aria-live` para leitor de tela.
  - **Escada contínua:** sem cartão por degrau; trilhos contínuos, número do
    degrau na calha à esquerda, separação por espaço e traço sutil, ações do
    degrau na calha (hover/foco). Só estilo — geometria, gestos e nomes
    acessíveis inalterados.
  - **Soltura da bobina:** `celulaDeSoltura(tipo, celula)` no núcleo leva
    qualquer bobina à coluna terminal da linha 0; a UI aplica antes da prévia e
    de `inserirElemento`/`moverElemento`, que continuam estritos.
- **Por quê:** IDE abrindo com erro ensina a ignorar o painel de problemas;
  mensagens espalhadas pela grade quebram o padrão de IDE (VS Code, JetBrains,
  TIA Portal separam diagnóstico persistente de feedback de ação); editores
  Ladder desenham um único par de trilhos com degraus numerados à esquerda; a
  bobina só tem uma posição válida, então exigir precisão no alvo é atrito puro.
- **Alternativas descartadas:** toast (cobre a grade e empilha em tentativas
  repetidas); aba própria para recusas (invisível se outra aba estiver aberta);
  trocar de aba automaticamente na recusa; normalizar a célula dentro de
  `inserirElemento` (esconderia a regra de posição no núcleo).
- **Requisito atendido:** RF-1, RF-8, RF-11, RF-12; CA-4, CA-5, CA-6.

## 17. Revisão aditiva — projeto de linguagem única, cabeçalho, aba Variáveis e painel inferior (2026-09-17)

Pedido do autor com referências visuais (`.claude/references/modelo_header.png`,
`modelo_vars.png`, só como inspiração — nenhum código ou asset copiado). Tarefa
#26. Revisa D-6 (modos Ladder/ST) e, em D-16, a barra de status.

### D-17: projeto, cabeçalho em duas faixas, aba Variáveis e painel em três abas
- **Escolha:**
  - **Projeto** (`frontend/src/projeto/projeto.ts`): `{ versao: 1, titulo,
    linguagem: 'ld' | 'st', diagrama | fonte }` em `localStorage["ladderflow:projeto"]`.
    A carga reabre o último projeto; na primeira vez migra
    `ladderflow:diagrama` para um projeto Ladder "Sem título" e remove a chave
    antiga só depois de gravar a nova; corrompido vira projeto vazio com aviso.
  - **Novo projeto:** se o projeto atual tem conteúdo, modal de confirmação de
    descarte (foco inicial em Cancelar); depois modal de título (1–60 caracteres)
    e linguagem. Projeto ST nasce com esqueleto `PROGRAM`/`CONFIGURATION` mínimo.
  - **Cabeçalho em duas faixas:** (1) Novo projeto, título + chip LD/ST,
    Compilar, Gravar, painel inferior, tema; (2) abas da área de edição
    **Lógica** e **Variáveis** (esta só em projeto Ladder). Em projeto Ladder,
    Compilar e Gravar ficam desabilitados com o motivo (dependem da F8).
  - **Variáveis** em largura inteira (tabela Nome | Tipo | Uso | Pino | Valor,
    linha "Adicionar variável…" no fim, mapa de pinos recolhível). Sai o painel
    lateral direito e suas preferências de largura.
  - **Painel inferior:** abas **Problemas** (diagnóstico persistente),
    **Mensagens** (recusas de ação, com contador de não lidas até a aba ser
    aberta) e **Console** (servidor, compilação, gravação). A `BarraStatus` da
    D-16 sai; recusa não troca de aba sozinha.
- **Por quê:** abas Ladder e ST lado a lado deixam ambíguo o que é compilado;
  o painel lateral tirava largura da grade; misturar recusas com o log de
  compilação e mostrá-las numa barra efêmera fazia o estudante perdê-las.
- **Alternativas descartadas:** manter as abas LD/ST; painel inferior com
  filtros por severidade (Todos/Erros/Avisos/Info), que misturaria diagnóstico
  persistente com eventos transitórios; aba Variáveis também em projeto ST
  (duas fontes de verdade com o `VAR ... END_VAR` do texto); esconder Compilar
  em projeto Ladder.
- **Requisito atendido:** RF-9, RF-12, RF-13; Q-2 (revisão aditiva).

## 18. Revisão aditiva — recusas em toasts, aba Mensagens removida (2026-09-18)

Pedido do autor depois de usar a IDE com a F8 (spec 003) pronta. Tarefa #27.
Revisa, em D-17, a aba **Mensagens** do painel inferior. O texto de D-17
continua valendo como registro do que foi decidido em 2026-09-17.

### D-18: recusas de ação como toasts
- **Escolha:**
  - as recusas de ação do editor e do painel de variáveis (`aoRecusar`), que
    iam para a aba Mensagens, passam a aparecer como **toasts** no canto
    inferior direito, no momento em que acontecem;
  - só as recusas viram toast. O **Console** não muda e nada dele vira toast
    (decisão explícita do autor);
  - o componente é próprio (`lib/toasts.ts`, puro, e
    `components/ide/Toasts.tsx`), sem dependência nova, com os níveis
    `info | sucesso | aviso | erro` prontos. Hoje só chega `aviso`;
  - `aviso`/`info`/`sucesso` somem em 5 s, com pausa sob o cursor ou com
    foco. `erro` fica até ser fechado;
  - mensagem idêntica seguida não empilha, só reinicia o tempo. A pilha tem no
    máximo 3 toasts;
  - acessibilidade: região `aria-live="polite"`; `role="alert"` só em erro;
  - a aba Mensagens e o contador de não lidas saem. O painel inferior fica
    com **Problemas | Console** (a aba "ST gerado" da spec 003 sai na mesma
    rodada; ver revisão da Q-1 na spec 003);
  - a marca vermelha de 3 s na célula recusada (#26) continua.
- **Por quê:** na aba, a recusa acontecia longe dos olhos e o estudante não
  percebia, em tempo real, por que o arrasto não surtiu efeito. O toast
  aparece junto da ação e some sozinho. É a opção "toast" que o autor avaliou
  e preteriu na #25; a experiência com a barra de status (#25) e com a aba
  (#26) mostrou que ela resolve melhor.
- **Alternativas descartadas:** biblioteca pronta (ex.: `sonner`), que é
  dependência nova e tem visual menos alinhado aos tokens da IDE; espelhar o
  Console em toasts, que seria barulhento.
- **Requisito atendido:** RF-9 (recusa visível e explicada), sem mudar o que o
  núcleo recusa.

> **Ajuste de D-18 (2026-09-18, mesmo dia):** a pedido do autor, os toasts
> passam do canto inferior direito para o **canto superior esquerdo**, logo
> abaixo do cabeçalho (`top-14`, para não cobrir "Novo projeto"). O
> comportamento não muda.
