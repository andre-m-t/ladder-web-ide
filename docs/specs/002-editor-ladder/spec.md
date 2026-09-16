# Spec 002 — Editor Ladder visual

> **Status:** rascunho
> **Autor:** André  ·  **Data:** 2026-09-16
> **Princípios aplicáveis:** §2, §3, §5, §6, §10, §11

Esta especificação descreve **o quê** e **o porquê**. Não descreve *como*.

> A tecnologia usada para desenhar a grade e os elementos gráficos na tela é
> decidida na fase de planejamento, por meio de um *spike* técnico dedicado —
> não é objeto desta especificação e não é citada aqui.

---

## 1. Objetivo e contexto

A spec 001 provou que o "tubo" completo do LadderFlow funciona — ST colado em
uma caixa de texto chega compilado e gravado no ESP32 — mas deixou de fora,
deliberadamente, a peça que dá nome ao produto: o **editor visual de diagramas
Ladder**. Esta é a **maior feature do projeto** e a que o público-alvo
(estudante e professor de automação) reconhece como a própria linguagem que
está aprendendo — degraus (*rungs*) com contatos e bobinas, não texto.

Esta spec entrega a superfície de edição: a pessoa monta um diagrama Ladder em
uma grade, ligando cada elemento a uma variável, com o editor recusando ou
sinalizando estrutura inválida em vez de aceitá-la em silêncio. O diagrama
resultante é o insumo de duas features futuras, ambas **fora de escopo aqui**:
a serialização Ladder → Structured Text (F8, que dá sentido industrial ao
diagrama) e o simulador de ciclo de varredura (F9, que o executa no
navegador). Sem o modelo de edição desta spec, nenhuma das duas tem o que
consumir.

## 2. Usuários e cenário de uso

**Usuário:** estudante ou professor de automação montando uma lógica de
controle sem escrever texto em Structured Text — o próprio motivo de o
Ladder existir como linguagem gráfica.

**Cenário:** a pessoa abre a aplicação e vê um diagrama com um degrau (rung)
vazio. Ela insere um contato, escolhe se é normalmente aberto ou fechado,
vincula-o a uma variável de entrada; insere uma bobina e vincula-a a uma
variável de saída. Adiciona mais degraus, remove ou move elementos, cria um
ramo paralelo quando a lógica exige uma condição "ou". Se deixar um degrau
incompleto ou uma variável sem vínculo, o editor mostra isso visualmente antes
que ela tente prosseguir. Ao final, o diagrama construído é o que, em uma
feature futura, vira código e é simulado — mas isso não acontece nesta tela.

**Cenários de referência.** Para ancorar o que o editor precisa suportar no
dia em que a serialização (F8) existir, três programas já usados como
referência no restante do projeto foram traduzidos para linguagem de usuário
(nenhum deles é construído automaticamente por esta spec — são apenas o
padrão de comparação):

- **Espelho direto entrada → saída.** Um único degrau: um contato normalmente
  aberto ligado a uma entrada e uma bobina ligada a uma saída. O grau mais
  simples de uso do editor, cobrindo o caso de uma entrada física comandando
  uma saída física sem lógica adicional.
- **Programa mínimo com variáveis internas.** Um único degrau: um contato
  normalmente fechado ligado a uma variável de entrada **sem endereço físico**
  (não é ligada a um pino do controlador) e uma bobina ligada a uma variável
  de saída igualmente **sem endereço**. Este cenário exige que o editor aceite
  vincular elementos a variáveis internas, não só a entradas/saídas
  localizadas.
- **Pisca-pisca com contagem e forçamento.** Um programa com três ingredientes
  combinados: (a) uma contagem de ciclos de varredura que, ao atingir um
  limite, alterna o estado de uma saída — o que exige um elemento de contagem
  crescente e uma forma de expressar "alternar o estado atual"; (b) enquanto
  um botão estiver pressionado, a mesma saída é forçada para o estado ligado,
  independentemente da contagem — o que exige uma bobina do tipo "forçar e
  manter" (SET) e uma forma de combinar as duas condições sobre a mesma saída,
  tipicamente um ramo paralelo. Este é o cenário mais exigente dos três e é o
  que motiva a maior parte dos elementos além do trio básico (contato/contato/
  bobina) — ver §4 e a Questão Q-6.

## 3. Histórias de usuário

- Como **estudante de automação**, quero montar um diagrama Ladder em uma
  grade de degraus e colunas, para programar sem escrever texto.
- Como **usuário**, quero inserir contatos normalmente abertos e normalmente
  fechados e vinculá-los a uma variável, para representar condições de
  entrada.
- Como **usuário**, quero inserir uma bobina simples e vinculá-la a uma
  variável, para representar uma saída comandada pela lógica do degrau.
- Como **usuário**, quero inserir bobinas do tipo "forçar e manter" (SET) e
  sua contrapartida de desligar (RESET), para representar lógica de trava sem
  precisar reescrever a condição em todo degrau seguinte.
- Como **usuário**, quero criar um ramo paralelo dentro de um degrau, para
  representar uma condição "ou" sem reescrever o degrau inteiro.
- Como **usuário**, quero inserir um contador crescente, para representar
  lógica que depende de contar eventos ou ciclos.
- Como **usuário**, quero mover ou remover um elemento já posicionado, para
  corrigir o diagrama sem recomeçá-lo.
- Como **usuário**, quero inserir e remover degraus, e ter quantos degraus
  precisar, para organizar a lógica em blocos independentes.
- Como **usuário**, quero vincular um elemento tanto a uma variável com
  endereço físico (entrada/saída localizada) quanto a uma variável interna
  sem endereço, para cobrir tanto E/S real quanto lógica auxiliar.
- Como **usuário**, quero ser avisado quando um degrau estiver incompleto, uma
  variável não estiver vinculada, ou um elemento estiver em posição inválida,
  para corrigir o erro antes de prosseguir, em vez de descobrir depois.
- Como **usuário**, quero que o diagrama que estou editando continue presente
  enquanto eu uso a aplicação, para não perder o trabalho ao navegar ou
  recarregar sem querer.

## 4. Requisitos funcionais

**Subconjunto IEC 61131-3 coberto por esta spec:** contato normalmente aberto,
contato normalmente fechado, bobina simples, bobina SET, bobina RESET, ramo
paralelo (estrutura "ou" dentro de um degrau) e contador crescente. Nenhum
outro elemento gráfico é reconhecido nesta fase (ver §7, Fora de escopo). Os
dois elementos além do trio básico contato/contato/bobina — bobina SET/RESET,
ramo paralelo e contador crescente — entram porque os três programas de
referência do §2 não são construíveis sem eles: o contador e a alternância
condicional aparecem no cenário de pisca-pisca, e a bobina SET é a tradução
natural de "forçar uma saída para ligada quando uma condição é verdadeira,
sem apagá-la quando a condição deixa de valer". Esta é, em parte, a decisão da
Questão Q em aberto sobre temporizadores e contadores no escopo do projeto:
**o contador crescente entra no escopo do editor; temporizadores (ligar/
desligar com atraso) continuam fora** — ver §7.

- **RF-1.** O sistema deve apresentar o diagrama como uma grade de degraus
  (linhas) e posições válidas dentro de cada degrau (colunas), tornando
  explícito onde um elemento pode ou não ser colocado.
- **RF-2.** O sistema deve permitir inserir, em uma posição válida da grade,
  um contato normalmente aberto, um contato normalmente fechado ou uma bobina
  simples.
- **RF-3.** O sistema deve permitir inserir uma bobina do tipo SET e uma
  bobina do tipo RESET.
- **RF-4.** O sistema deve permitir criar, dentro de um degrau, um ramo
  paralelo que combine duas ou mais condições em "ou".
- **RF-5.** O sistema deve permitir inserir um elemento de contador crescente.
  Requisito **destacável** (Q-7): nenhum outro RF depende dele; retirá-lo
  remove apenas o CA-3 da aceitação.
- **RF-6.** O sistema deve permitir mover um elemento já inserido para outra
  posição válida da grade.
- **RF-7.** O sistema deve permitir remover um elemento já inserido.
- **RF-8.** O sistema deve permitir inserir um novo degrau e remover um
  degrau existente, suportando qualquer número de degraus no mesmo diagrama.
- **RF-9.** O sistema deve permitir vincular um elemento a uma variável de
  entrada ou saída **localizada** (com endereço do controlador).
- **RF-10.** O sistema deve permitir vincular um elemento a uma variável
  **interna**, sem endereço do controlador.
- **RF-11.** O sistema deve validar a estrutura do diagrama e identificar, no
  mínimo: degrau incompleto, variável não vinculada a um elemento que a
  exige, e elemento em posição inválida da grade. Também identifica duas
  bobinas simples vinculadas à mesma variável (erro) e SET/RESET da mesma
  variável acionados por condição que depende dela própria (aviso) — ver Q-6.
- **RF-12.** Quando a validação de RF-11 encontrar um problema, o sistema deve
  sinalizar visualmente o erro, de forma distinguível do estado válido, e
  **nunca** aceitar a estrutura inválida em silêncio (cf. §3 da Constituição)
  — impedindo a ação que a causaria ou marcando-a como inválida até ser
  corrigida.
- **RF-13.** O sistema deve manter o diagrama em edição presente na sessão do
  navegador, sem envolver o servidor (cf. §6 da Constituição), sobrevivendo
  ao fechamento da aba e do navegador (Q-1, decidida).

## 5. Critérios de aceitação

- **CA-1 (RF-1/RF-2/RF-9).** Dado um diagrama vazio, quando a pessoa insere um
  contato normalmente aberto vinculado a uma entrada e uma bobina vinculada a
  uma saída no mesmo degrau, então o cenário de "espelho direto" do §2 fica
  montado sem erro sinalizado.
- **CA-2 (RF-10).** Dado um diagrama vazio, quando a pessoa insere um contato
  normalmente fechado e uma bobina, ambos vinculados a variáveis internas sem
  endereço, então o cenário de "programa mínimo com variáveis internas" do §2
  fica montado sem erro sinalizado.
- **CA-3 (RF-3/RF-4/RF-5).** Dado um diagrama vazio, quando a pessoa usa o
  contador crescente, uma estrutura que alterna o estado de uma saída, um
  ramo paralelo e uma bobina SET vinculados às variáveis do cenário de
  "pisca-pisca com contagem e forçamento" do §2, então consegue montar uma
  estrutura Ladder que representa esse comportamento, com o grau de
  equivalência definido na Q-4 (decidida). Este CA depende só do RF-5
  destacável (Q-7).
- **CA-4 (RF-11/RF-12).** Dado um degrau incompleto (por exemplo, um contato
  sem bobina ao final, ou um ramo paralelo aberto) ou um elemento com
  variável não vinculada, quando a pessoa tenta deixar essa condição sem
  correção, então o editor sinaliza o problema visualmente e a estrutura
  inválida não é aceita como se fosse válida.
- **CA-5 (RF-1/RF-11).** Dado um diagrama em edição, quando a pessoa tenta
  posicionar um elemento fora de uma posição válida da grade, então o sistema
  impede a ação ou sinaliza a posição como inválida.
- **CA-6 (RF-8).** Dado um diagrama com um degrau, quando a pessoa insere um
  novo degrau, então o diagrama passa a ter dois degraus editáveis de forma
  independente; quando ela remove um deles, o outro permanece intacto.
- **CA-7 (RF-6/RF-7).** Dado um elemento já posicionado em um degrau, quando a
  pessoa o move para outra posição válida ou o remove, então a grade reflete
  a nova posição ou a ausência do elemento, sem deixar vínculos ou posições
  inconsistentes.
- **CA-8 (RF-13).** Dado um diagrama em edição, quando a pessoa permanece
  dentro dos limites da mesma sessão do navegador (Q-1: inclusive após fechar
  a aba ou o navegador), então o diagrama
  construído continua presente ao voltar a ver a tela.

## 6. Requisitos não-funcionais

- A validação estrutural (RF-11/RF-12) deve reagir sem depender de uma
  requisição ao servidor — é responsabilidade exclusiva do cliente (cf. §6 da
  Constituição), coerente com o servidor desta arquitetura só compilar.
- A interface é apresentada em português; identificadores técnicos (nomes de
  variável, endereços IEC) permanecem como o usuário os digitar.
- O diagrama deve suportar múltiplos degraus e múltiplos elementos por degrau
  sem exigir que a pessoa perceba degradação de resposta ao editar — números
  de limite de colunas e ramos na Q-3 (decidida); degraus sem limite.
- Navegador: mesma faixa de compatibilidade já assumida pelo projeto
  (Chrome/Edge 89+, cf. `docs/context/constraints.md`); esta feature não usa
  Web Serial, mas herda a base de compatibilidade do restante da aplicação.

## 7. Fora de escopo

- Serialização do diagrama para Structured Text (F8, spec futura).
- Simulação do diagrama — execução do ciclo de varredura no navegador (F9,
  spec futura).
- Qualquer forma de compilação a partir do diagrama.
- Temporizadores (TON/TOF) e contador decrescente (CTD) — só o contador
  crescente (CTU) entra nesta fase (ver §4).
- Persistência do diagrama além da sessão do navegador (RF-13) — nuvem, conta
  de usuário, ou arquivo local, ficam para spec futura caso venham a existir.
- Importação de Structured Text existente para o formato do diagrama (ST →
  Ladder) — só o sentido contrário (Ladder → ST) está no roadmap, e mesmo
  esse é F8, fora daqui.
- Colaboração entre múltiplas pessoas no mesmo diagrama.
- Seleção da tecnologia de renderização visual — decidida no plano, por
  *spike* (ver nota no topo deste documento).

**Restrição de propriedade intelectual (cf. §10 da Constituição):** referência
conceitual a editores Ladder de projetos correlatos, para entender o domínio e
convenções visuais consagradas, é legítima. Copiar arquivos, trechos de
código ou ativos desses projetos para dentro deste repositório não é —
transformaria a criação em obra derivada e esvaziaria a originalidade exigida
pelo depósito no INPI.

## 8. Dependências

- **Spec 001** (fatia vertical mínima) — não há dependência técnica direta
  entre o editor e o pipeline de compilação/gravação, mas esta spec pressupõe
  o contexto de produto que a spec 001 estabeleceu (cf. `docs/context/
  architecture.md`, "Fluxo de execução"): o diagrama construído aqui é o que,
  nas specs seguintes, alimenta a serialização e chega ao mesmo pipeline já
  validado.
- Nenhum recurso externo (MATIEC, toolchain ESP32, dispositivo físico) é
  necessário para esta feature — ela roda inteiramente no navegador.

## 9. Registro de decisões

Cada questão que precisa da decisão do autor antes da aprovação da spec. As
entradas **permanecem visíveis após decididas** — o histórico de decisões é
parte da rastreabilidade do projeto (§8 da Constituição) e insumo direto do
capítulo de Desenvolvimento do TCC. Ao decidir uma questão, preencha status,
data, decisão e justificativa; não apague o enunciado.

### Q-1 — Escopo exato de "sessão" para a persistência (RF-13)
- **Enunciado:** RF-13 exige manter o diagrama presente "na sessão do
  navegador", mas isso pode significar duas coisas bem diferentes: (a) dura
  enquanto a **aba** estiver aberta, desaparecendo ao fechá-la; ou (b) dura
  enquanto o **navegador** mantiver os dados armazenados localmente,
  sobrevivendo ao fechamento da aba (e até do navegador), até a pessoa limpar
  os dados do site. Qual das duas é o comportamento esperado?
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** Por **navegador**: o diagrama sobrevive ao fechamento da aba e do navegador, até a pessoa limpar os dados do site.
- **Justificativa:** Perder o trabalho ao fechar a aba por engano é o pior caso para um estudante em laboratório; a persistência continua inteiramente no cliente (§6).

### Q-2 — Convivência com a caixa de Structured Text da tela mínima (F6)
- **Enunciado:** a tela mínima entregue pela spec 001 (F6) tem uma caixa de
  texto para colar ST diretamente. Esta spec introduz o editor visual — ele
  **substitui** essa caixa de texto (a pessoa só edita visualmente) ou
  **convive** com ela (por exemplo, abas alternando entre os dois modos, ou
  a caixa de ST permanece disponível para casos que o editor ainda não
  cobre)? Isso não muda o modelo de dados do diagrama, mas muda a navegação
  entre as duas telas.
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** **Convivem**, em modos alternáveis ("Ladder" e "ST"). A caixa de ST da F6 permanece.
- **Justificativa:** Até a serialização Ladder → ST (F8) existir, a caixa de ST é o único caminho que compila e grava; removê-la regrediria a fatia vertical da spec 001 (§2).

### Q-3 — Limites de tamanho do diagrama
- **Enunciado:** há um limite máximo de colunas por degrau e de degraus por
  diagrama? Se sim, quais valores, e o que acontece ao tentar ultrapassá-los
  (a ação é impedida, ou apenas desencorajada)?
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** Cada degrau tem **número fixo de colunas** (valor definido no plano, da ordem de 8) e ramos paralelos de **até duas linhas** além do trilho principal; o **número de degraus é livre**. Tentar ultrapassar o limite de colunas ou de linhas de ramo é **impedido com mensagem** (RF-12).
- **Justificativa:** Largura fixa mantém as posições válidas explícitas (RF-1) e cobre com folga os três cenários de referência; limitar degraus não traz ganho didático. O desempenho com muitos degraus é verificado no plano (referência: 50 degraus).

### Q-4 — Critério de "pisca-pisca construível" (CA-3)
- **Enunciado:** o critério de aceitação CA-3, que usa o cenário de
  pisca-pisca com contagem e forçamento como referência, pode ser lido de
  duas formas: (a) **equivalência exata**, isto é, o diagrama montado no
  editor deve produzir, ciclo a ciclo, o mesmo comportamento do programa de
  referência — verificável no futuro pelo instrumento de teste diferencial já
  existente no projeto (`backend/tests/diferencial/`); ou (b) **equivalência
  estrutural**, isto é, basta que a pessoa consiga montar, com os elementos
  desta spec, uma estrutura Ladder que representa a mesma intenção lógica,
  sem que esta spec garanta ou verifique igualdade de comportamento ciclo a
  ciclo (isso ficaria para quando o simulador, F9, existir). Qual das duas
  vale para esta spec?
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** **Mesmo comportamento observável**, não equivalência exata ciclo a ciclo: o diagrama de pisca-pisca montado no editor deve piscar a saída por contagem e ser forçado ligado pela entrada. A divergência de fase em relação ao programa de referência é aceita e registrada como limite do subconjunto.
- **Justificativa:** Medido no spike S4 (`spike-canvas.md` §5): com o contador crescente do subconjunto, a equivalência exata é impossível por construção — o contador conta bordas de subida, e um sinal leva no mínimo dois ciclos para produzir uma borda (1 divergência em 50 ciclos no melhor caso). Obter exatidão exigiria blocos de comparação e aritmética, ampliando o subconjunto além do que os cenários pedem (§11). O comportamento do diagrama ganha gabarito próprio no teste diferencial quando houver serialização (F8).
- **Revisão aditiva (2026-09-16) — premissa da justificativa refutada, decisão
  endurecida:** a justificativa acima afirma que a equivalência exata é
  "impossível por construção". **Isso é falso.** A investigação posterior
  (`spikes/modelo/preset25/RESULTADO.md`) encontrou um diagrama só com
  elementos do subconjunto — contador crescente com limite 12, reinício da
  contagem e realinhamento do sinal de contagem pelo próprio limite atingido,
  e alternância da saída pelo limite atrasado um ciclo — que reproduz o
  programa de referência **ciclo a ciclo**, com zero divergências em 200
  ciclos e três padrões de entrada, no runtime real. A decisão passa a ser:
  **o cenário de pisca-pisca deve ser construível com equivalência exata ciclo
  a ciclo**; a verificação automática dessa equivalência a partir do diagrama
  depende da serialização (F8) e fica registrada como pendência dela. A
  decisão original ("mesmo comportamento observável") fica como piso, caso o
  diagrama exato se mostre inviável no editor — o que exigiria nova revisão
  aditiva.

### Q-5 — Contorno do contador crescente: reset e leitura do valor
- **Enunciado:** o cenário de pisca-pisca (§2) usa uma contagem que, ao
  atingir um limite, reinicia e alterna a saída. Isso levanta duas perguntas
  sobre o elemento de contador crescente (RF-5): (a) o reinício da contagem é
  uma entrada explícita do elemento, algo que a pessoa liga visualmente no
  diagrama, ou é um comportamento que só se define quando o elemento é
  configurado (por exemplo, um valor-limite após o qual reinicia sozinho)?
  (b) o valor atual da contagem (ou o fato de ter atingido o limite) precisa
  ficar disponível para outras condições do diagrama — por exemplo, para
  alimentar o ramo paralelo que decide a alternância da saída? Como isso é
  representado na grade?
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** A contagem e o reinício vêm de **caminhos de contatos explícitos** no diagrama; o limite é um **número configurado** no elemento; o elemento publica apenas **"atingiu o limite"** numa variável booleana, usada por outros degraus como contato. O valor corrente da contagem **não é exposto**.
- **Justificativa:** Segue o contador crescente da norma (entrada de contagem, entrada de reinício, valor-limite, saída de limite atingido). Expor a contagem só teria uso com blocos de comparação, que estão fora do subconjunto (§4, §7).

### Q-6 — Mesma variável de saída escrita em mais de um degrau
- **Enunciado:** no cenário de pisca-pisca (§2), a mesma saída é afetada por
  duas condições distintas: a alternância por contagem e o forçamento pelo
  botão. Isso pode ser modelado de duas formas: (a) um único degrau, com um
  ramo paralelo combinando as duas condições sobre uma única bobina; ou (b)
  dois degraus separados, cada um com sua própria bobina vinculada à mesma
  variável de saída — prática comum em Ladder real, mas que alguns ambientes
  tratam como erro ("bobina duplicada"). Esta spec permite (b), trata como
  erro estrutural (RF-11), ou exige sempre (a)?
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** Duas **bobinas simples** vinculadas à mesma variável são **erro estrutural** (RF-11). Bobinas SET e RESET da mesma variável são permitidas — é o uso normal delas — e recebem **aviso** quando a condição que as aciona depende da própria variável.
- **Justificativa:** O spike S4 mostrou que SET e RESET da mesma variável acionados no mesmo ciclo, lendo a variável ao vivo, se anulam — comportamento correto da varredura sequencial, mas armadilha para o estudante. Bobina simples duplicada é sempre sobrescrita pela última e nunca é intencional; SET/RESET pareados são idioma legítimo de Ladder.
- **Revisão aditiva (2026-09-16) — desvio deliberado da prática corrente:**
  a decisão acima **diverge conscientemente** do comportamento usual. Nos
  ambientes Ladder de mercado e na leitura corrente da IEC 61131-3, bobinas
  simples duplicadas na mesma variável são **aceitas** — a última escrita do
  ciclo prevalece, e há quem use isso de propósito (por exemplo, um degrau de
  exceção depois do degrau normal). A frase "nunca é intencional", na
  justificativa original, é portanto forte demais: o correto é "raramente é
  intencional para quem está aprendendo, e é a origem mais comum de saída que
  'não obedece'". O LadderFlow recusa a duplicação por objetivo **didático**
  (§9, escopo acadêmico): torna explícito, no editor, um efeito que na prática
  corrente fica implícito na ordem dos degraus. **Custo aceito:** programas
  vindos de outros ambientes que usem bobina duplicada precisarão ser
  reescritos (com ramo paralelo ou SET/RESET) para serem aceitos. O desvio
  fica declarado junto ao subconjunto suportado (§4 e RF-11), conforme §3 da
  Constituição — nunca implícito.

### Q-7 — Contador crescente: dentro do escopo, mas destacável
- **Enunciado:** o contador crescente entra no subconjunto só por causa do
  cenário de pisca-pisca, e é o elemento de maior risco da spec (semântica de
  borda, divergência medida no spike S4). Ele fica no escopo? Se ficar, como
  garantir que um problema com ele não arraste o restante do editor?
- **Status:** decidida
- **Data da decisão:** 2026-09-16
- **Decisão:** o contador crescente **fica no escopo**, como requisito
  **destacável**: tem RF próprio (RF-5) e CA próprio (CA-3), e nenhum outro
  requisito depende dele. Retirá-lo — por decisão do autor, se o custo se
  mostrar desproporcional durante a implementação — remove apenas o cenário
  de pisca-pisca da aceitação, sem reescrever os demais requisitos. Como isso
  se traduz em isolamento técnico é decisão do plano.
- **Justificativa:** mantém o cenário mais exigente como meta (os três
  programas de referência construíveis), sem transformar o elemento de maior
  risco em dependência do editor inteiro. A retirada, se ocorrer, é revisão
  aditiva desta questão, não apagamento.

## 10. Conformidade com a Constituição

- **§2 (fatia vertical primeiro):** esta spec não é, sozinha, uma fatia
  vertical — é a camada de edição que, junto com F8 e F9 (specs futuras),
  completará o segundo caminho fim-a-fim do produto (editar → simular →
  gravar), complementar ao caminho já provado pela spec 001 (colar ST →
  compilar → gravar).
- **§3 (conformidade com a IEC 61131-3):** o subconjunto suportado é
  declarado de forma explícita em §4, e a validação estrutural (RF-11/RF-12)
  garante que estrutura fora desse subconjunto ou incompleta seja sinalizada,
  nunca aceita em silêncio.
- **§5 (cliente sem instalação):** o editor roda inteiramente no navegador,
  sem toolchain, driver ou aplicativo local.
- **§6 (separação de responsabilidades):** a edição, a validação estrutural e
  a persistência de sessão (RF-13) ficam inteiramente no cliente; nenhum
  requisito desta spec envolve o servidor.
- **§10 (propriedade intelectual):** a restrição sobre referência conceitual
  versus cópia de projetos correlatos está registrada em §7.
- **§11 (simplicidade e legibilidade):** o subconjunto de elementos (§4) foi
  limitado ao que os três cenários de referência exigem, em vez de antecipar
  cobertura mais ampla da norma "porque pode ser útil depois".
