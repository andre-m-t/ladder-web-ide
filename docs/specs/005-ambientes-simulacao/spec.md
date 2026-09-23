# Spec 005 — Ambientes de simulação acoplados ao ciclo de varredura

> **Status:** aprovada (2026-09-21). Q-1 a Q-8 decididas no §9
> **Autor:** André  ·  **Data:** 2026-09-21
> **Princípios aplicáveis:** §2, §4, §5, §6, §10, §11

Esta especificação descreve **o quê** e **o porquê**. Não descreve *como*.

---

## 1. Objetivo e contexto

A spec 004 entregou o simulador de ciclo de varredura no navegador: o usuário
aciona entradas pela tabela de variáveis e vê a energização no diagrama. Isso
responde à pergunta "a lógica que desenhei se comporta como espero?", mas num
ambiente abstrato — entradas e saídas são interruptores e lâmpadas na tela, não
um processo físico.

Esta feature acrescenta **ambientes de simulação**: plantas visuais que se
acoplam ao mesmo ciclo de varredura. Cada ambiente lê as saídas do programa
depois de cada ciclo, avança um passo de física simplificada e devolve o estado
das entradas que o programa verá no ciclo seguinte. O usuário interage com botões
e sensores na cena, enquanto a lógica continua no diagrama Ladder que ele já
editou.

O primeiro ambiente é o **portão do bar** — cenário didático já usado pelo autor
em trabalho anterior (ver §11). Fecha o laço "diagrama → simular → ver o
processo reagir" sem hardware. A arquitetura prevê outros ambientes no futuro;
nesta spec só o portão entra no catálogo.

Depende da F9 (simulador de varredura) e do editor Ladder (F7/F8). Não altera
compilação, gravação nem o contrato do servidor.

## 2. Usuários e cenário de uso

**Estudante de automação**, com um programa que comanda um motor de subida e
descida, lâmpadas de posição e botões Open/Stop/Close. Ele entra em simulação,
abre o ambiente "Portão do bar" num painel flutuante, pressiona Open na cena e
vê o portão subir enquanto as saídas que ele programou acionam o motor; os fins
de curso alimentam as entradas que ele mapeou no diagrama.

**Professor**, mostrando que entradas e saídas não são abstratas: o mesmo
`%QX0.4` que energiza uma bobina no diagrama move o portão na planta.

## 3. Histórias de usuário

- Como **estudante**, quero abrir um ambiente visual acoplado à minha simulação,
  para testar a lógica num processo que se parece com o da aula.
- Como **estudante**, quero escolher entre ambientes disponíveis (hoje só o
  portão), para saber qual planta estou usando.
- Como **estudante**, quero que botões e sensores do ambiente conversem com as
  entradas e saídas do meu diagrama por **endereço** (`%IX` / `%QX`), para
  ligar variáveis sem renomear a planta.
- Como **estudante**, quero ver falhas didáticas (motor danificado) quando
  comando conflitante ou fim de curso com motor ainda ligado, para entender
  proteções de projeto.
- Como **autor do trabalho**, quero um programa de referência do portão medido
  pelo arcabouço diferencial, para manter a rastreabilidade da lógica.

## 4. Requisitos funcionais

### Catálogo e janela

- **RF-1.** O sistema deve oferecer um botão para abrir o painel de ambientes
  de simulação, disponível em projeto Ladder (mesmo portão de "simulação só em
  Ladder" da spec 004).
- **RF-2.** O painel deve ser uma **janela flutuante** dentro da IDE: arrastável
  e redimensionável, sem abrir outro documento do navegador.
- **RF-3.** O usuário deve poder escolher um ambiente na lista; nesta versão a
  lista contém exatamente um item: **Portão do bar**.

### Contrato de E/S por endereço

- **RF-4.** Cada ambiente declara pontos de E/S por **endereço localizado**
  (`%IX0.n`, `%QX0.n`), com rótulo legível e papel (comando do usuário, sensor,
  atuador, indicador).
- **RF-5.** O vínculo entre planta e programa é por endereço: o valor de uma
  saída no estado da simulação é lido no endereço mapeado à variável de saída;
  as entradas que a planta produz são aplicadas às variáveis de entrada que
  usam aquele endereço. Endereço sem variável declarada aparece como "não
  conectado"; o ambiente abre e funciona para os pontos conectados.

### Acoplamento ao ciclo de varredura

- **RF-6.** A planta avança **exatamente um passo por ciclo de varredura**
  executado (tempo real, marcha lenta ou Passo). Não possui relógio próprio.
- **RF-7.** Abrir o painel de ambiente **não** inicia a simulação. Sem simulação
  ativa, a cena mostra estado estático e indica que é preciso entrar em
  simulação para o processo reagir.
- **RF-8.** Com ambiente ativo e simulação rodando, entradas **comandadas pela
  planta** (botões e sensores) ficam somente-leitura na tabela de variáveis,
  com motivo visível; outras entradas continuam acionáveis manualmente se não
  forem escritas pela planta no mesmo ciclo.

### Portão do bar (planta)

- **RF-9.** O ambiente portão deve modelar: botões momentâneos Open, Stop e
  Close; sensores de fim de curso superior (lógica NF no endereço superior) e
  inferior (NA); saídas de lâmpadas Aberto, Entreaberto e Fechado; saídas de
  motor subir e descer; curso visual do portão proporcional à posição.
- **RF-10.** Conflito **subir e descer** simultâneos ou comando de motor contra
  fim de curso deve marcar **motor danificado**, pausar a simulação, zerar
  saídas no estado da simulação, exibir toast de erro e registrar no Console;
  recuperação exige Reiniciar na simulação e reinício da planta.

### Medição

- **RF-11.** Deve existir diagrama de referência **PORTAO** exercitando a lógica
  típica do cenário, exportado como JSON dourado e ST dourado, medido pelo
  arcabouço diferencial (simulador × runtime hospedeiro) como os demais
  programas de referência.

## 5. Critérios de aceitação

- **CA-1 (RF-1, RF-2).** Dado projeto Ladder aberto, quando o usuário abre
  "Ambiente", então aparece painel flutuante com seletor e cena do portão.
- **CA-2 (RF-4, RF-5).** Dado variáveis com endereços do contrato do portão,
  quando a simulação roda, então acionar Open na cena altera `%IX0.0` no
  próximo ciclo e `%QX0.4` true faz o portão subir na cena.
- **CA-3 (RF-6, RF-7).** Dado painel aberto sem simulação, quando o usuário
  pressiona botão na cena, então a posição do portão não muda e há indicação de
  que a simulação está inativa.
- **CA-4 (RF-8).** Dado ambiente portão ativo em simulação, quando o usuário
  tenta alternar na tabela uma entrada comandada pela planta, então o controle
  está desabilitado com motivo.
- **CA-5 (RF-10).** Dado simulação com ambos motores comandados, quando um
  ciclo completa, então simulação pausa, toast de motor danificado e Console
  registram o evento.
- **CA-6 (RF-11).** Dado fixture PORTAO, quando roda
  `test_simulacao_diferencial` (ou extensão equivalente), então 0 divergências
  nos ciclos do gabarito.

## 6. Requisitos não-funcionais

- **RNF-1.** Núcleo da planta em TypeScript puro, sem React — testável em
  `vitest` como `ladder/simulacao.ts`.
- **RNF-2.** Cena do portão em SVG autoral, tokens de tema claro/escuro; sem
  importar imagens do projeto Java.
- **RNF-3.** Nenhuma dependência nova no `package.json` do frontend.
- **RNF-4.** Estado do ambiente (escolha, posição e tamanho da janela) volátil
  — não persiste em `localStorage`.

## 7. Fora de escopo

- Segundo ambiente além do portão (apenas catálogo extensível).
- Simulação acoplada em projeto ST.
- Comunicação entre janelas (`window.open`, `BroadcastChannel` entre documentos).
- Gravação, compilação ou alteração do firmware.
- Temporizadores e contadores **dentro da planta** (só a lógica Ladder usa CTU).
- Modos PROGRAM/STOP/RUN do CLP Java — só o ciclo da spec 004.

## 8. Dependências

- Spec 004 (simulador de varredura) — obrigatória.
- Spec 002/003 (editor e serializador) — diagrama e endereços 8+8.
- Nenhum recurso de servidor novo.

## 9. Registro de decisões

### Q-1 — Forma da janela
- **Enunciado:** popup de navegador ou painel flutuante na IDE?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** painel flutuante arrastável e redimensionável no mesmo documento.
- **Justificativa:** evita sincronização entre documentos e bloqueio de pop-up;
  alinhado à escolha do autor no planejamento.

### Q-2 — Vínculo planta ↔ programa
- **Enunciado:** por nome de variável ou por endereço?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** por endereço `%IX` / `%QX`; variável é resolução opcional.
- **Justificativa:** contrato da planta é físico-elétrico; nomes mudam entre
  projetos.

### Q-3 — Fins de curso
- **Enunciado:** como modelar I3/I4 do portão Java?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** manter NF no superior e NA no inferior; sensores por **faixa**
  de abertura, não igualdade exata de pixel.
- **Justificativa:** fidelidade didática com robustez numérica.

### Q-4 — Tabela de variáveis vs planta
- **Enunciado:** quem manda nas entradas comandadas pela planta?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** planta prevalece; tabela somente-leitura com motivo.
- **Justificativa:** evita estado inconsistente.

### Q-5 — Persistência
- **Enunciado:** salvar ambiente e geometria da janela?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** não persistir (volátil).
- **Justificativa:** alinhado à Q-5 da spec 004.

### Q-6 — Passo da planta
- **Enunciado:** planta avança por quadro de vídeo ou por ciclo?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** um passo de planta por `executarCiclo`, inclusive em Passo.
- **Justificativa:** imagem de processo coerente com a norma.

### Q-7 — Falha do motor
- **Enunciado:** o que fazer ao detectar motor danificado?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** pausar simulação, toast erro, Console, exigir Reiniciar.
- **Justificativa:** equivalente ao STOP do simulador Java.

### Q-8 — Medição
- **Enunciado:** incluir programa PORTAO no diferencial?
- **Status:** decidida
- **Data da decisão:** 2026-09-21
- **Decisão:** sim, fixture + gabarito TOML + 0 divergências.
- **Justificativa:** mesma política do BLINK e IO_ESPELHO.

## 10. Conformidade com a Constituição

- **§2:** fatia vertical — portão acoplado à simulação existente antes de
  segundo ambiente.
- **§4:** testes no núcleo, e2e no painel, medição diferencial.
- **§5:** 100% navegador; sem instalação.
- **§6:** planta e UI no cliente; servidor intocado.
- **§10:** procedência documentada; sem cópia de código ou PNG de terceiros;
  reimplementação autoral (§11).
- **§11:** núcleo puro + componentes SVG; reúso de Pointer Events e tokens IDE.

## 11. Procedência do cenário portão

O comportamento didático do portão do bar foi concebido e implementado pelo autor
no repositório acadêmico `Trabalho-Final-CLP-2025` (commits `7f0619c` a
`0cdc2dc`, 2025). **Nenhum** arquivo Java, `.form` ou PNG desse repositório é
copiado para o LadderFlow. Esta entrega é **reimplementação** em TypeScript com
arquitetura de planta acoplada ao simulador da spec 004 e cena SVG autoral —
matéria própria para o depósito INPI, com rastreabilidade de ideia, não de
código literal.

## Revisão aditiva — 2026-09-21 (redesign UI e mapa de E/S)

- **Nome do ambiente:** “Portão” (`id: portao`), não “Portão do bar”.
- **Fluxo:** botão **Ambiente** abre `ModalAmbiente` (escolha por cartão); ao
  confirmar, abre a janela flutuante. O `<select>` dentro da janela foi
  removido.
- **Janela flutuante:** correção do botão fechar (não capturar ponteiro ao
  clicar no “×”); tamanho padrão maior; arrasto preso à viewport.
- **Mapa de E/S** alinhado à referência didática (bit a bit em `%IX0`/`%QX0`):
  Abrir/Fechar/Parar, FC1/FC2 (NA), motor sobe/desce, lâmpadas
  Entreaberto/Aberto/Fechado. Fixture `PORTAO` com intertravamento NF; dourados
  e `portao.toml` regenerados.
- **Cena:** SVG autoral inspirado no layout de simuladores de porta
  (The Learning Pit / LogixPro); rótulos em **português** com endereço IEC —
  sem cópia de assets de terceiros.
- **Planta:** fins de curso NA com margem `MARGEM_FC`; dano do motor só no
  batente (`0`/`100` %), não no mesmo limiar do sensor.

## Revisão aditiva — 2026-09-22 (cena física e arte)

- **Abertura:** folha de enrolar ancorada no topo do vão (abre por baixo);
  tambor no topo; motor desenhado (carcaca, polia, correia) com setas por
  `%QX0.0`/`%QX0.1`.
- **FC:** rótulos legíveis na parede com linha de chamada; estados por cor e
  anel de destaque.
- **Removidos:** leitor I/O hex, ônibus e caminhão da cena.
- **Arte:** fachada do bar (toldo, letreiro, janela, calçada) e interior visível
  pelo vão (balcão, garrafas, banquetas, luminárias). Lâmpadas acopladas aos
  degraus `lamp_*` do fixture `PORTAO` ampliado.

## Revisão aditiva — 2026-09-23 (painel lateral e encerramento da simulação)

- **Layout:** o ambiente ocupa o **painel lateral direito** (mesmo slot das
  variáveis); enquanto aberto, o alternador de variáveis na barra superior fica
  desabilitado. A janela flutuante (`JanelaFlutuante`) foi removida.
- **Fechar:** o botão Fechar do painel (ou **Ambiente** na faixa de simulação)
  fecha o painel e, se a simulação estiver ativa, **encerra a simulação** também.
- **Controles:** botão **Ambiente** passou para `BarraSimulacao`, acima do editor.
- **Largura do painel:** o teto de redimensionamento do painel lateral direito
  passa a ser dinâmico (largura da janela menos um mínimo reservado ao editor
  central), para o ambiente poder usar quase a tela inteira.

## Revisão aditiva — 2026-09-23 (correções de arte do motor e limpeza visual)

- **Letreiro removido:** o letreiro "BAR" da fachada saiu; o toldo/janela
  permanecem, sem texto.
- **Motor:** passou a ficar **ao lado** do vão (nunca sobre a folha), em caixa
  própria com as setas SOBE/DESCE e o respectivo endereço (`%QX0.0`/`%QX0.1`)
  legíveis dentro da caixa. A orientação das setas (`SetaMotor`) estava
  trocada — SOBE desenhava ápice para baixo e vice-versa — e foi corrigida.
- **Conector motor↔tambor:** o eixo do tambor não liga direto à caixa do motor
  por uma diagonal solta; liga a uma **barra** vertical fixa no lado direito
  do vão (na altura do tambor até a altura do motor), da qual sai o fio
  (horizontal) até a caixa. Evita o efeito de traço "quebrado" atravessando a
  moldura.
- **Fim de curso:** o fundo pastel atrás do rótulo/endereço dos sensores foi
  removido; ficam só a linha de chamada, o texto e o retângulo colorido do
  sensor.

## Revisão aditiva — 2026-09-23 (criar variáveis pelo contrato de E/S)

- **Problema levantado pelo autor:** desde a revisão do painel lateral (mesma
  data), o ambiente ocupa o slot das variáveis e o alternador fica
  desabilitado. Sem variáveis declaradas, o usuário precisava fechar o
  ambiente, declarar, reabrir — ida e volta a cada ponto. O pedido: montar a
  lógica **pensando no ambiente**, sem alternar painéis. Duas opções foram
  postas: (1) criar a variável a partir do contrato de E/S do ambiente;
  (2) criar a variável a partir do elemento no editor.
- **Decisão: as duas, com papéis diferentes.**
  - **Principal — contrato de E/S (opção 1).** A seção "Contrato de E/S" do
    painel passa a abrir **expandida** e mostra, no título, "N de M
    conectados". Cada ponto mostra o **nome da variável vinculada** ao endereço
    (útil também quando já há vínculo: é o que se lê no diagrama) ou, sem
    vínculo, o botão **"Criar"**, que abre um modal de criação de **uma**
    variável (`ModalNovaVariavel`) com o endereço **fixo** do ponto, uso
    derivado (entrada para `%IX`, saída para `%QX`), tipo `BOOL` e nome
    sugerido — só falta confirmar ou ajustar o nome. **"Criar todas (N)"**
    declara de uma vez as que faltam, tudo ou nada, numa única entrada do
    Desfazer.
  - **Complementar — elemento (opção 2).** "Nova variável…" no modal do
    elemento cria e vincula numa jogada; com ambiente aberto, o seletor de
    pino mostra o ponto da planta de cada endereço e sugere o nome do
    contrato. Detalhe na revisão de mesma data da spec 002.
- **Por que o contrato é o fluxo principal:** o contrato é a lista do que a
  planta espera — é o único lugar da tela que já sabe endereço, direção e
  significado de cada ponto, e fica **à vista** enquanto o ambiente está
  aberto. Criar ali não pede escolha nenhuma além do nome, não há como errar
  a classe (é a do endereço) e o nome sugerido é o do programa de referência.
  A opção 2 sozinha resolveria só metade: o usuário ainda precisaria saber de
  cor qual `%IX` é "Abrir". Com as duas, o caminho natural fica: declarar os
  pontos pelo contrato, arrastar os elementos, escolher a variável pelo nome
  que a planta usa.
- **Nome sugerido:** campo opcional `nomeSugerido` no `PontoAmbiente` (aditivo
  ao contrato do plano D-1); no portão, os nomes da fixture `PORTAO`
  (`abrir`, `fc_superior`, `motor_sobe`, `lamp_aberto`...). Sem ele, o nome
  sai do rótulo (sem acento, minúsculo, sem o trecho entre parênteses). Nome
  já usado — comparado **sem** diferenciar maiúsculas, porque o serializador
  recusa nomes que só diferem na caixa (spec 003, D-5) — ganha `_2`, `_3`...
- **Regras preservadas:** a criação passa pelo mesmo `declararVariavel` da
  tabela (nome IEC válido, nome e endereço únicos) e pelo mesmo
  `aoMudarProjeto`, logo entra no histórico de Desfazer como qualquer edição
  de variável. A recusa aparece dentro do modal, junto do campo (o toast
  ficaria sob o overlay); a recusa de "Criar todas", sem modal, vai ao toast.
  Cada criação registra uma linha no Console.
- **Simulação ativa:** "Criar" e "Criar todas" ficam desabilitados com o
  motivo "Saia da simulação para criar variáveis" — mesmo congelamento da
  edição do diagrama (spec 004, Q-7). A tabela de variáveis continua sem esse
  bloqueio (pendência já registrada na F9); a assimetria é consciente: aqui a
  criação nasce do ambiente, que durante a simulação está comandando as
  entradas.
- **Fora desta revisão:** renomear, trocar pino ou remover pelo contrato — a
  tabela de variáveis continua o lugar disso.

## Revisão aditiva — 2026-09-23 (confirmação da semântica NA dos fins de curso)

- **Dúvida verificada:** se os dois fins de curso (`FC1`/superior e
  `FC2`/inferior) são NA e se o aceso/apagado do `SensorFc` em `CenaPortao.tsx`
  respeita essa semântica.
- **Confirmação:** ambos são **NA** — decisão já vigente desde a revisão
  aditiva de 2026-09-21 ("Fins de curso NA com margem `MARGEM_FC`"), que
  substitui a redação original da Q-3 (NF no superior). `nivelFcSuperior` e
  `nivelFcInferior`, em `portao.ts`, retornam `true` exatamente quando o
  contato fecha por a folha ter alcançado aquela extremidade (dentro da
  margem) — é esse mesmo booleano, sem inversão, que acende `lamp_aberto`/
  `lamp_fechado` no fixture `PORTAO` (`fixtures.ts`).
- **Verificação em `CenaPortao.tsx`:** o `ativo` passado a cada `SensorFc` já
  era o valor bruto de `entradas[ENDERECO_FC_SUPERIOR|INFERIOR]`
  (`montarEntradasPortao(estado)`), sem inversão nem derivação a partir de
  `abertura` — a lógica **já estava correta** (aceso = detectando). O ajuste
  desta rodada foi só de clareza: JSDoc explícito em `SensorFc` e no cálculo
  de `fcSup`/`fcInf` documentando a semântica NA, e remoção do ramo morto
  `ring = ativo ? '#f1c40f' : 'none'` (o anel só é renderizado quando `ativo`,
  então o `'none'` nunca era usado — deixava a leitura ambígua). Nenhuma
  mudança de comportamento visual. Teste novo em `CenaPortao.test.tsx` cobre
  os três estados (fechado, aberto, entreaberto).

## Revisão aditiva — 2026-09-23 (correção física do FC superior — inversão do limiar)

- **A revisão anterior (mesma data, acima) estava incompleta.** Confirmou que
  os dois fins de curso são NA e que `CenaPortao.tsx` não inverte o booleano
  — isso continua verdadeiro. O que ela não questionou foi **qual** booleano
  `nivelFcSuperior` deveria calcular. A leitura assumida ali (`fc_superior`
  ativo perto do totalmente aberto, simétrica ao FC inferior) é a leitura
  **fisicamente errada** para este sensor, apontada pelo autor nesta mesma
  rodada. Esta nota não apaga a anterior — ela está correta sobre NA e sobre
  `CenaPortao.tsx`; está incompleta sobre a física do sensor. Fica registrada
  como o histórico exige (decisão não se apaga, revisão é aditiva).
- **A física, para o portão de enrolar (folha ancorada no topo, tambor no
  topo — revisão de 2026-09-22 acima):** o FC1/superior fica montado junto ao
  tambor, no ponto fixo por onde a lona passa ao enrolar ou desenrolar. Um
  sensor NA nesse ponto detecta **a presença da lona**, não "a folha chegou
  ao topo": enquanto o portão está fechado ou entreaberto, ainda há lona
  correndo por aquele ponto (na direção do tambor ou pendendo dele) e o
  contato fica **fechado** (`true`). Só quando o portão está **totalmente
  aberto** — a lona quase inteira enrolada no tambor — aquele ponto fica
  livre e o contato **abre** (`false`). É o contrário do que a primeira
  versão (2026-09-21) implementava, e também o contrário do FC2/inferior
  (que continua correto: fecha perto do totalmente **fechado**, porque
  detecta a borda de baixo se aproximando do solo — o autor não questionou
  esse sensor e a investigação não achou motivo para revisá-lo).
- **Correção implementada, só na planta (`frontend/src/ambientes/portao.ts`):**
  `nivelFcSuperior(abertura)` passa de `abertura >= ABERTURA_MAX - MARGEM_FC`
  para **`abertura < ABERTURA_MAX - MARGEM_FC`** — ativo em todo o curso,
  exceto na margem final perto do totalmente aberto. `nivelFcInferior` não
  muda. `CenaPortao.tsx` não muda: o `SensorFc` já acende com o booleano
  bruto, sem inversão, e continua acendendo certo com o booleano corrigido.
- **Efeito sobre o programa de referência (`PORTAO`, `frontend/src/ladder/
  fixtures.ts`, e os dourados `backend/tests/fixtures/{serializados/portao.st,
  diagramas/portao.json}` e `backend/tests/diferencial/fixtures/serializador/
  portao.toml`):** o programa fixture usa `fc_superior` (e sua negação) para
  três finalidades — parar o motor no batente de cima, acender `lamp_aberto`
  e acender `lamp_entreaberto`. Com o booleano do sensor invertido, cada
  contato que lia `fc_superior` precisou trocar de NF↔NA para preservar o
  **mesmo comportamento físico observável** (motor para no batente, lâmpada
  certa acende):
  - degrau 1 (`motor_sobe`): contato de `fc_superior` passa de **NF para
    NA** — "pode subir" volta a significar "sensor detectando lona", que
    agora é justamente a condição de "ainda não chegou ao batente";
  - degrau 3 (`lamp_aberto`): contato de `fc_superior` passa de **NA para
    NF** — "aberto" volta a significar "sensor não detecta mais lona";
  - degrau 5 (`lamp_entreaberto`): contato de `fc_superior` passa de **NF
    para NA**, mantendo o de `fc_inferior` em NF — "entreaberto" continua
    "nem no batente de cima nem no de baixo".
  - O TOML teve o valor de entrada de `%IX0.3` trocado de `false` para
    `true` nos dois blocos de ciclos (o cenário do teste é "portão
    fechado/abrindo", onde o sensor fisicamente correto é `true`); as
    saídas esperadas não mudaram, porque o circuito corrigido produz o
    mesmo resultado com o sinal fisicamente correto.
  - Os arquivos dourados (`portao.st`, `portao.json`) foram **regenerados**
    pelo vitest (`toMatchFileSnapshot`, D-11) a partir do fixture corrigido
    — nunca escritos à mão.
- **O que não muda:** `CenaPortao.tsx` (render já correto, só o JSDoc
  ganhou uma frase distinguindo a física dos dois sensores); o FC inferior,
  em planta e em fixture; a margem `MARGEM_FC`; o mapa de endereços.
- **Verificação:** `tsc --noEmit` sem erros novos (só os dois pré-existentes
  em `ModalVariavel.tsx`/`edicao.test.ts`, alheios a esta mudança); vitest
  completo 872 passed (a suíte relevante — `src/ambientes`, `src/ladder`,
  `src/App.test.tsx`, `CenaPortao.test.tsx` — 403 passed isoladamente); pytest
  no backend (`docker run ladderflow-backend:dev`) com 26 passed nos dois
  arquivos diferenciais tocados e 89 passed/7 deselected na suíte `not slow`
  completa.
- **Pergunta em aberto para o autor:** esta correção resolve a física do
  sensor e do programa-fixture de teste (`PORTAO`), que é material de
  referência/medição, não a lógica que o usuário eventualmente monta na IDE
  para o ambiente Portão interativo — essa lógica é livre, e cabe a quem a
  monta usar `fc_superior` do jeito fisicamente correto agora documentado
  aqui e no JSDoc de `nivelFcSuperior`. Nenhuma outra peça do produto (RF/CA
  desta spec) afirma uma convenção diferente para o sensor além do que já
  foi corrigido nesta nota.

## Revisão aditiva — 2026-09-23 (botão Ambiente oculto com painel aberto)

- **Decisão do autor:** enquanto o painel lateral de ambiente está visível, o
  botão **Ambiente** na `BarraSimulacao` **não aparece** — evita duplicar o
  controle de fechar (antes o mesmo botão alternava aberto/fechado na faixa).
- **Fechar:** permanece só pelo botão **Fechar ambiente** do `PainelAmbiente`
  (comportamento já existente: encerra a simulação ativa, se houver).
- **Abrir:** com o painel fechado, o botão **Ambiente** na faixa abre o modal
  de escolha, como antes.
