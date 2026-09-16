# Plano 002 — Editor Ladder visual

> **Status:** em revisão
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
