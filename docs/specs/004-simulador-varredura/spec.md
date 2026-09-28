# Spec 004 — Simulação de ciclo de varredura no navegador

> **Status:** aprovada (2026-09-20). Q-1 a Q-8 decididas no §9
> **Autor:** André  ·  **Data:** 2026-09-20
> **Princípios aplicáveis:** §2, §3, §4, §5, §6, §11

Esta especificação descreve **o quê** e **o porquê**. Não descreve *como*.

---

## 1. Objetivo e contexto

Hoje o usuário monta um diagrama Ladder, vê os problemas de estrutura que o
editor aponta, compila e grava. O que ele **não** consegue fazer é descobrir se
a lógica que desenhou faz o que ele queria. Entre o diagrama e a primeira
evidência de comportamento há um compilador, um gravador e um dispositivo: a
pergunta "este selo prende mesmo?" só tem resposta depois de percorrer a cadeia
inteira, e a resposta chega como um LED que acende ou não acende, sem nada que
explique por quê.

Esta feature fecha essa lacuna — a última lacuna funcional da ferramenta. O
usuário executa o diagrama **no próprio navegador, sem gravar nada**: aciona as
entradas com o mouse, vê os contatos e as bobinas energizarem no desenho que ele
mesmo construiu, acompanha o avanço do ciclo de varredura e encontra o erro de
lógica longe do hardware. É isto que fecha a promessa da ferramenta; o resto
desta spec é consequência.

A consequência é a segunda entrega: o mesmo motor de execução, exposto sem
interface, vira o **segundo executor** do arcabouço de teste diferencial que o
projeto mantém pronto desde 2026-09-15 à espera desta feature. Com ele, a
métrica "divergência simulação ↔ runtime" — uma das métricas centrais do
trabalho, hoje com o instrumento pronto e sem o segundo lado — passa a ser
medível. O arcabouço foi desenhado para receber esse segundo executor sem
reescrita, e esta spec cobra essa promessa.

Por que agora: é a última feature de código do projeto. Fechada esta spec, o
software está completo, e o que restar sem cobertura é o transporte serial
contra um ESP32 físico — que não é código a escrever, e sim hardware que não
existe.

## 2. Usuários e cenário de uso

**Estudante de automação**, montando o programa de um portão automático num
laboratório sem CLP disponível. Ele desenha dois degraus: um selo que liga o
motor quando o botão é pressionado e o mantém ligado, e um contador que desarma
tudo depois de um número de acionamentos. Antes desta feature, a única forma de
saber se o selo prende era compilar e gravar. Agora ele entra em modo simulação,
clica o botão de entrada, vê o contato fechar, a bobina energizar e — ao soltar
o botão — o contato de selo manter o caminho fechado. Vê também o contador
avançar a cada acionamento. Quando o comportamento não é o esperado, ele reduz a
velocidade para uma marcha lenta, avança ciclo a ciclo e observa em que ponto do
degrau a energia para de passar.

**Professor em laboratório**, demonstrando a semântica do ciclo de varredura.
Ele quer mostrar que um CLP não é um circuito elétrico contínuo: que as entradas
são lidas uma vez por ciclo, que todos os degraus são resolvidos sobre aquela
mesma leitura, e que só então as saídas são escritas. Com a marcha lenta e o
passo a passo, o ciclo deixa de ser uma abstração do quadro e passa a ser uma
coisa visível na tela.

**Autor do trabalho**, medindo. Ele roda os seis programas de referência do
projeto nos dois executores — o simulador em TypeScript e o runtime em C — e
compara ciclo a ciclo, ponto a ponto. O número que sai daí é resultado do TCC.

## 3. Histórias de usuário

- Como **estudante**, quero executar meu diagrama no navegador, para descobrir
  um erro de lógica sem precisar de um CLP.
- Como **estudante**, quero acionar as entradas enquanto o programa roda, para
  provocar as situações que quero testar.
- Como **estudante**, quero ver no desenho quais contatos e bobinas estão
  energizados, para entender **por onde** a energia passa, não só o resultado.
- Como **estudante**, quero reduzir a velocidade e avançar um ciclo por vez,
  para observar o que muda entre um ciclo e o seguinte.
- Como **professor**, quero que a simulação siga a ordem lê → resolve → escreve,
  para que o que o aluno vê na tela seja a semântica da norma, e não uma
  animação que apenas se pareça com ela.
- Como **autor do trabalho**, quero executar os programas de referência no
  simulador e no runtime real e comparar as saídas ciclo a ciclo, para medir a
  divergência entre as duas implementações.

## 4. Requisitos funcionais

### Execução

- **RF-1.** O sistema deve executar o diagrama do projeto Ladder aberto em
  ciclos de varredura, seguindo a semântica de **imagem de processo** da norma:
  a cada ciclo, lê o estado das entradas **uma vez**, resolve todos os degraus na
  ordem em que aparecem sobre aquela leitura, e então publica o estado das
  saídas. Uma mudança de entrada feita durante um ciclo só tem efeito no ciclo
  seguinte.
- **RF-2.** Dentro do mesmo ciclo, o efeito da escrita de um degrau deve ser
  visível para os degraus seguintes — a mesma semântica do texto que a
  serialização produz e que o runtime executa.
- **RF-3.** O sistema deve simular o mesmo subconjunto que o editor e a
  serialização cobrem: contato normalmente aberto, contato normalmente fechado,
  bobina simples, bobina SET, bobina RESET, ramo paralelo e contador crescente.
  Nenhum elemento fora desse subconjunto existe no modelo; se um aparecer, a
  simulação deve recusar com motivo, nunca ignorá-lo em silêncio.
- **RF-4.** O contador crescente deve reproduzir a semântica já verificada nos
  dois lados do projeto: conta na **borda de subida** da entrada de contagem,
  reinicia enquanto o caminho de reinício conduz, e a saída indica "atingiu o
  limite". A contagem corrente não é exposta como variável.
- **RF-5.** Quando uma bobina SET e uma bobina RESET escrevem a mesma variável
  no mesmo ciclo, deve valer a **última escrita do ciclo**, na ordem dos degraus
  — a mesma regra já decidida para a serialização.
- **RF-6.** O sistema deve derivar, além do valor de cada variável, o estado de
  **energização de cada célula e de cada elemento** do diagrama: o desenho
  precisa mostrar por onde a energia passa, não apenas o resultado do degrau.

### Independência da implementação (requisito de primeira ordem)

- **RF-7.** O motor de simulação deve determinar a energização de um degrau por
  **propagação de fluxo a partir do trilho esquerdo**, como leitura própria e
  independente da topologia do degrau. É **proibido** reaproveitar a leitura de
  topologia usada pela serialização.

  **Razão, e por que isto é requisito e não detalhe de implementação:** a
  medição que dá valor a esta feature compara o simulador com o runtime em C, e
  o runtime executa o texto que a serialização produziu. Se os dois lados
  derivassem a topologia do degrau da mesma leitura, um erro nessa leitura
  apareceria **idêntico** nos dois, a comparação mediria zero divergências e o
  instrumento diria "de acordo" sem ter medido nada. A independência das duas
  leituras é a propriedade que faz a medição significar alguma coisa; compartilhar
  código entre elas destruiria silenciosamente o valor do resultado principal do
  trabalho. Vale também para o caminho inverso: a simulação não consulta o texto
  serializado, nem o compilador, nem o servidor.

- **RF-8.** O simulador é implementação **independente** do runtime em C. Uma
  divergência entre os dois não deve ser resolvida ajustando o simulador até
  coincidir. Se os dois discordam, um dos dois interpreta a norma de forma
  diferente: a divergência deve ser isolada (ciclo, ponto, esperado, obtido),
  atribuída a um dos lados, corrigida **nesse** lado e **registrada**. É
  resultado a reportar, não defeito a silenciar.
- **RF-9.** O simulador não deve conhecer pinagem. Ele fala em nome de variável e
  em endereço da norma; a correspondência com o pino físico é assunto do
  dispositivo e não entra aqui.

### Interação

- **RF-10.** O sistema deve oferecer os controles **Executar/Pausar**, **Passo**
  (avança exatamente um ciclo de varredura) e **Reiniciar** (zera valores de
  variáveis, contadores e a contagem de ciclos, e volta ao estado inicial).
- **RF-11.** O sistema deve executar por padrão em **tempo real, a 20 ms por
  ciclo** — o mesmo intervalo do laço de varredura do firmware — e oferecer ao
  menos uma **marcha lenta** selecionável, para que o ciclo seja observável.
  A cadência de atualização do desenho é independente da cadência de ciclo: a
  simulação não pode perder ciclos porque a tela não acompanha, nem redesenhar
  mais do que o necessário.
- **RF-12.** Durante a execução, o usuário deve poder **acionar manualmente** as
  variáveis de entrada, e o acionamento passa a valer a partir do ciclo seguinte
  (RF-1). Variáveis de saída e internas mostram o estado, mas não são acionáveis.
- **RF-13.** O sistema deve mostrar o estado ao vivo de **todas** as variáveis
  declaradas, e a contagem de ciclos decorridos.

  > **Revisão aditiva de 2026-09-21.** "Mostrar o estado ao vivo" passa a
  > exigir que o **nome** e o **valor** da variável sejam legíveis ao mesmo
  > tempo, na largura padrão do painel. Na entrega da Fatia 2 a coluna "Valor"
  > era a quinta de seis, numa tabela de largura mínima de 600 px com rolagem
  > horizontal própria (herdada da revisão pós-#26 da spec 002): no painel
  > estreito não dava para ver os dois juntos, e o laço central da feature —
  > acionar a entrada e ver o valor mudar (RF-12) — ficava prejudicado. A
  > ordem das colunas passa a ser **Nome | Valor | Tipo | Uso | Pino**, o que
  > resolve em qualquer largura e em qualquer modo, sem mexer no layout do
  > painel.
- **RF-14.** O estado energizado deve ser distinguível do desenergizado por
  **mais de um atributo visual** (cor **e** espessura do traço), de modo a ser
  legível nos temas claro e escuro e por quem não distingue as cores usadas. A
  marcação de problema da célula continua onde está, no canto; a energização vive
  no traço. Os dois não disputam o mesmo atributo.
- **RF-15.** A simulação e a edição são **mutuamente exclusivas**. Entrar em
  simulação congela a edição do diagrama e deixa **Compilar** e **Gravar**
  indisponíveis, com o motivo visível; sair devolve os três.

  > **Revisão aditiva de 2026-09-21.** Acrescenta-se ao congelamento um
  > requisito de **affordance**: enquanto a edição está congelada, a interface
  > não deve convidar o gesto que vai recusar. É o mesmo diagnóstico da fatia 1
  > da spec 002 — o problema não é a falta de mensagem, é a aparência de
  > arrastável sobre algo inerte. Preventivo primeiro (paleta esmaecida e não
  > interativa, ponteiro de recusa sobre a grade, estado de simulação visível
  > na faixa de simulação); mensagem depois, como complemento para quem
  > insistir. A nota de 2026-09-23 sobre `BarraSimulacao` fixa que o destaque
  > do modo ativo fica nessa faixa, não num chip na barra superior.
- **RF-16.** Em projeto de Texto Estruturado o controle de simulação deve
  aparecer **indisponível, com o motivo visível** — não escondido.
- **RF-17.** O estado da simulação é **volátil**: não sobrevive a recarregar a
  página. Ao recarregar, a ferramenta volta ao modo de edição, com o diagrama
  preservado como já é hoje.
- **RF-18.** Simular um diagrama que a validação recusa deve ser impedido com o
  mesmo tratamento que **Compilar** já recebe: motivo visível, nada executa.
  Aviso não bloqueia; erro bloqueia.

### Medição

- **RF-19.** O mesmo motor de simulação deve ser executável **sem interface**,
  como segundo executor do arcabouço de teste diferencial do projeto, recebendo
  uma sequência de entradas por ciclo e devolvendo o estado das saídas por ciclo,
  no formato de contrato que o arcabouço já publica.
- **RF-20.** A comparação simulador × runtime deve usar as fixtures de
  comparação **já existentes**, sem alterá-las, e sem alterar o executor, o
  comparador ou o arcabouço que as executa.
- **RF-21.** Uma divergência encontrada deve ser reportada com ciclo, ponto,
  valor esperado e valor obtido — nunca só "falhou".

## 5. Critérios de aceitação

- **CA-1 (RF-1, RF-2, RF-3, RF-19, RF-20).** Dados os programas de referência do
  projeto sem contador (espelho de E/S, mínimo, ramo/OU, SET/RESET, selo),
  quando cada um é executado no simulador com as entradas da fixture
  correspondente, então a saída de cada ciclo bate com o gabarito já registrado,
  sem alterar nenhuma fixture.
- **CA-2 (RF-4, RF-8).** Dado o programa de referência com contador, quando ele é
  executado no simulador e no runtime real com as mesmas entradas, por 200 ciclos
  e nos três padrões de entrada já usados no projeto, então ou não há divergência,
  ou cada divergência está isolada, atribuída a um dos lados e registrada.
- **CA-3 (RF-21).** Dada uma divergência entre os dois executores, quando a
  comparação é reportada, então a mensagem traz ciclo, ponto, esperado e obtido.
- **CA-4 (RF-6, RF-12, RF-14).** Dado um degrau com um contato e uma bobina,
  quando o usuário entra em simulação e aciona a entrada, então o contato e a
  bobina aparecem energizados no desenho e a variável de saída passa a verdadeira;
  ao desacionar, voltam ao estado desenergizado.
- **CA-5 (RF-1, RF-4, RF-11).** Dado o programa de referência com contador,
  quando ele é simulado na interface, então a saída alterna com o mesmo período
  em ciclos com que alterna no runtime.
- **CA-6 (RF-10).** Dada uma simulação pausada, quando o usuário aciona **Passo**,
  então exatamente um ciclo avança; quando aciona **Reiniciar**, então variáveis,
  contadores e a contagem de ciclos voltam ao estado inicial.
- **CA-7 (RF-16).** Dado um projeto de Texto Estruturado, quando o usuário olha o
  controle de simulação, então ele está indisponível e o motivo está visível.
- **CA-8 (RF-15).** Dada uma simulação em andamento, quando o usuário tenta
  editar o diagrama, compilar ou gravar, então as três ações estão indisponíveis
  com o motivo visível; ao sair da simulação, as três voltam.

  > **Revisão aditiva de 2026-09-21.** O texto acima não muda. Acrescenta-se que
  > "motivo visível" vale também para a **edição**, não só para Compilar e
  > Gravar. Na entrega da Fatia 2 o congelamento era silencioso: a paleta e a
  > grade seguiam com aparência arrastável e o gesto não produzia nada — sem
  > cursor de recusa, sem mensagem. Isso satisfazia a letra do RF-15 (a ação
  > está indisponível) e contrariava a intenção do CA-8 (o motivo está
  > visível), além da norma do projeto, fixada em #25 e #27 da spec 002, de que
  > **recusa se percebe**. A partir desta revisão o CA-8 exige que, com a
  > simulação em andamento: a paleta se apresente inerte, o ponteiro sobre a
  > grade indique recusa, o estado de simulação esteja visível na faixa
  > `BarraSimulacao`, e uma tentativa de editar mesmo assim produza mensagem —
  > pela mesma via de toasts do RF-5 da spec 002 (#27). O critério anterior,
  > de que nenhuma realimentação aparecia, fica **revogado por esta revisão**,
  > e com ele a asserção correspondente do e2e.
- **CA-9 (RF-12, RF-13).** Dado um diagrama com entradas, saídas e memórias,
  quando a simulação roda, então o estado ao vivo de todas aparece, as entradas
  são acionáveis e as demais não.
- **CA-10 (RF-14).** Dado um diagrama energizado, quando ele é visto no tema
  claro e no tema escuro, então energizado e desenergizado se distinguem em ambos,
  e a marcação de problema continua legível.
- **CA-11 (RF-11).** Dado um diagrama de cinquenta degraus em execução a 20 ms
  por ciclo, quando a simulação roda, então a cadência de ciclo se mantém e a
  medição fica registrada.
- **CA-12 (RF-18).** Dado um diagrama com erro de validação, quando o usuário
  tenta simular, então a simulação não inicia e o motivo está visível.
- **CA-13 (RF-17).** Dada uma simulação em andamento, quando a página é
  recarregada, então a ferramenta volta ao modo de edição com o diagrama
  preservado e sem estado de simulação.

## 6. Requisitos não-funcionais

- **Sem instalação e sem servidor.** A simulação roda inteiramente no navegador.
  Nenhuma chamada ao servidor participa dela, nem para validar, nem para
  executar. Um diagrama pode ser simulado com o back-end fora do ar.
- **Sem dependência nova** no produto. O motor é código próprio.
- **Cadência.** 20 ms por ciclo como padrão, com a atualização do desenho
  desacoplada da cadência de ciclo (RF-11). O alvo de cinquenta degraus da CA-11
  é o mesmo porte já medido no editor.
- **Acessibilidade.** Os controles são operáveis por teclado; a energização não
  depende só de cor (RF-14); o estado ao vivo tem nome acessível.
- **Mensagens** de recusa em português, dizendo a regra violada, no mesmo lugar
  onde a ferramenta já mostra recusas.

## 7. Fora de escopo

- **Simulação de projeto em Texto Estruturado** (Q-6). Exigiria um interpretador
  da linguagem inteira, e não há diagrama para energizar — o lado que é o produto
  não existiria. Fica registrado como spec futura.
- **Sequência de entradas pré-definida na interface** (Q-3). A sequência por
  ciclo já existe onde ela importa, nas fixtures do arcabouço de comparação.
  Trazê-la para a interface é um editor de sequências, com formato, edição e
  persistência próprios: **extensão futura**, registrada aqui.
- **Persistência do estado de simulação** (Q-5, RF-17).
- **Temporizadores (TON/TOF), contador decrescente (CTD)** e qualquer elemento
  fora do subconjunto do RF-3 — não existem no modelo do editor nem na
  serialização. *(Revisão aditiva 2026-09-28, spec 006: simulador e
  serializador passam a cobri-los; base de tempo lógica 20 ms/ciclo, alinhada
  a `TASK … INTERVAL := T#20ms`; equivalência de tempo exige `PT` e período em
  múltiplos de 1 ms — ver plano 006 sobre `__normalize_timespec`.)*
- **Medição de tempo real de varredura**. A simulação controla o relógio; tempo
  de ciclo no dispositivo é medição de bancada, e depende de hardware que não
  existe.
- **Depuração passo a passo dentro de um degrau** (parar no meio da resolução de
  um degrau). O passo é o ciclo.
- **Forçar o valor de uma saída ou de uma memória** à revelia da lógica.

## 8. Dependências

- **Spec 002** — o modelo de diagrama e todos os tipos de elemento que esta spec
  executa, incluindo o contador; a validação que decide se um diagrama pode
  rodar.
- **Spec 003** — o texto que o runtime executa do outro lado da comparação é o
  que a serialização produz; os arquivos de referência já gerados e medidos.
- **Arcabouço de comparação diferencial** e o **runtime executável no host**,
  ambos prontos desde 2026-09-15, com o contrato de execução já publicado em
  endereço da norma (e não em pino).
- **Nenhum ESP32 físico.** Esta feature não depende de hardware — é justamente o
  que a torna a última feature possível sem ele.

## 9. Registro de decisões

Todas as questões foram decididas pelo autor em **2026-09-20**, na aprovação da
spec. As entradas permanecem visíveis depois de decididas (§8 da Constituição).

### Q-1 — Velocidade de execução
- **Enunciado:** a simulação roda em tempo real (20 ms por ciclo, como o
  `T#20ms` do firmware) ou acelerada? Há valor didático em ver o ciclo acontecer
  devagar.
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** tempo real a 20 ms por ciclo como padrão, com marcha lenta
  selecionável. A cadência de ciclo é separada da cadência de quadro.
- **Justificativa:** o 20 ms é a âncora com o firmware — preserva a leitura "é
  isto que vai acontecer no dispositivo". A marcha lenta é o valor didático: um
  degrau combinacional em tempo real passa rápido demais para ensinar. As
  alternativas descartadas: só tempo real (perde a observação), só acelerado
  (perde a âncora).

### Q-2 — Controles de execução
- **Enunciado:** executar, pausar, passo a passo, reiniciar — quais entram?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** Executar/Pausar, Passo e Reiniciar.
- **Justificativa:** é o conjunto mínimo que permite depurar. "Rodar N ciclos"
  não responde nada que o Passo não responda, e acrescenta superfície de
  interface.

### Q-3 — Entradas
- **Enunciado:** só acionamento manual durante a execução, ou também sequência
  pré-definida?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** só acionamento manual nesta spec. Sequência pré-definida
  na interface fica registrada como extensão futura (§7).
- **Justificativa:** a sequência pré-definida já existe onde importa: nas
  fixtures do arcabouço, que é o caminho sem interface. Na interface, seria um
  editor de sequências — feature própria.

### Q-4 — Representação visual de energizado × desenergizado
- **Enunciado:** como mostrar energizado e desenergizado no desenho sem quebrar
  os temas claro e escuro e sem conflitar com as marcações de problema que já
  existem na célula?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** cor **mais** espessura, codificação redundante. Marcação
  de problema no canto, energização no traço.
- **Justificativa:** a espessura carrega o sinal sozinha, então a distinção
  sobrevive aos dois temas e a quem não distingue a cor. Separar o atributo
  (canto × traço) evita que energização e problema disputem o mesmo lugar.
  Descartadas: só cor (frágil) e animação de fluxo (custa mais e some sob a
  marcha lenta, que é onde o usuário está olhando).

### Q-5 — Persistência do estado da simulação
- **Enunciado:** o estado da simulação sobrevive ao recarregar a página, ou
  reinicia?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** volátil; recarregar volta ao modo de edição.
- **Justificativa:** salvá-lo criaria um segundo formato versionado, com
  migração e descarte próprios, para algo que o usuário reproduz em segundos.

### Q-6 — Projeto em Texto Estruturado
- **Enunciado:** simula também, ou só Ladder?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** fora do escopo; o controle aparece indisponível com o
  motivo visível.
- **Justificativa:** simular Texto Estruturado exigiria um interpretador da
  linguagem inteira, não de um subconjunto de diagrama. E em Texto Estruturado
  não há desenho para energizar: o lado que é o produto não existiria.

### Q-7 — Interação com Compilar e Gravar
- **Enunciado:** simulação e gravação podem coexistir, ou uma bloqueia a outra?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** modo exclusivo: a simulação congela a edição e deixa
  Compilar e Gravar indisponíveis, com o motivo.
- **Justificativa:** gravar durante a simulação gravaria um diagrama que o
  usuário está vendo em outro estado. Congelar a edição evita a pergunta "o que
  acontece com o estado quando o degrau muda no meio da execução", que não tem
  resposta barata. O argumento decisivo é a reversibilidade: soltar a restrição
  depois é aditivo; apertá-la depois, não.

### Q-8 — Como o simulador é executado na comparação automatizada
- **Enunciado:** o segundo executor precisa rodar o motor de simulação fora do
  navegador. O ambiente onde a comparação roda hoje não tem tempo de execução
  para a linguagem do motor. Como fechar isso?
- **Status:** decidida
- **Data da decisão:** 2026-09-20
- **Decisão:** **(a)** executar o motor como processo de verdade no ambiente de
  teste, preparado sob demanda — o mesmo padrão com que o runtime em C já é
  construído sob demanda naquele arcabouço. **(b)**, o traço de execução gravado
  em arquivo por um teste do lado do navegador, fica como **plano B**, acionável
  só se (a) não fechar (ver o risco correspondente no plano).
- **Justificativa (do autor):** o traço gravado é artefato congelado que pode
  divergir do código sem ninguém notar — exatamente o modo de falha que já custou
  caro ao projeto (teste verde medindo firmware velho embutido na imagem) e que
  motivou a Regra 5 do `CLAUDE.md`. Reintroduzir essa classe de problema
  justamente no instrumento que produz a métrica central do trabalho seria
  contraditório. A opção (a) preserva a propriedade que dá sentido à medição:
  **dois processos independentes executando agora**. Se (a) não fechar, (b) é
  aceitável, mas a queda deve ser registrada com a limitação explícita de que o
  traço pode envelhecer, e com a guarda que impede isso escrita junto.
- **Consequência registrada:** (a) altera a imagem do ambiente de teste do
  servidor. Vale a Regra 5 — reconstruir a imagem antes de rodar os testes — e o
  componente de terceiro acrescentado é identificado em `THIRD_PARTY.md`.

## 10. Conformidade com a Constituição

- **§2 (fatia vertical primeiro):** a primeira fatia entrega o motor **medido**
  contra o runtime real (CA-1 a CA-3) — ponta a ponta no eixo que produz o
  resultado do trabalho, antes de qualquer pixel. A segunda entrega a simulação
  visível na ferramenta.
- **§3 (conformidade com a IEC 61131-3):** a semântica de imagem de processo
  (RF-1) e a do contador (RF-4) são as da norma, e o subconjunto coberto (RF-3) é
  declarado. Onde a leitura da norma divergir entre simulador e runtime, a
  divergência é investigada e registrada (RF-8), nunca acomodada.
- **§4 (testes como rede de segurança):** os critérios centrais (CA-1 a CA-3) são
  medidos pelo arcabouço diferencial contra o runtime real — comportamento
  medido, não assumido. O RF-7 existe para que essa medição continue significando
  alguma coisa.
- **§5 (cliente sem instalação):** a simulação roda no navegador, sem servidor,
  sem toolchain e sem dispositivo. Nenhum requisito novo para o usuário.
- **§6 (separação de responsabilidades):** o motor é núcleo puro, sem
  conhecimento de desenho, de interface ou de pinagem (RF-9); a interface o
  consome. É a mesma separação núcleo/desenho da spec 002 e da spec 003, e é o
  que faz o RF-19 sair quase de graça.
- **§11 (simplicidade e legibilidade):** o subconjunto é exatamente o que o
  editor e a serialização já cobrem; nada é antecipado para temporizadores ou
  outros elementos que não existem no modelo.

## Revisão aditiva — 2026-09-22 (escrita por bobina paralela)

- **`calcularFluxoDoRung` / `executarCiclo`:** todas as bobinas na coluna
  terminal recebem o mesmo `energizadoTerminal` e `aplicarEscritaDoTerminal` em
  ordem de linha — espelho da emissão do serializador (spec 003).

## Revisão aditiva — 2026-09-22 (ramo de saída fora da topologia de contatos)

- Na propagação de fluxo do degrau, ramos com `ehRamoDeSaida` são ignorados na
  topologia de contatos (código duplicado em relação ao serializador, conforme
  RF-7). A escrita por bobina paralela da revisão anterior permanece.

## Revisão aditiva — 2026-09-23 (faixa de simulação acima do editor)

- Controles de simulação (Simular/Sair, Executar/Pausar, Passo, Reiniciar,
  marcha e contador de ciclo) saem da barra superior e ficam em **`BarraSimulacao`**
  — faixa sempre visível acima do editor: desabilitados fora do modo simulação,
  com destaque visual quando ativo. Os `aria-label` dos botões permanecem os
  mesmos (RF-10, CA-6).

**Tensão registrada:** o RF-7 proíbe reúso de código entre a serialização e a
simulação — o oposto do reflexo normal de §11. A duplicação é **deliberada e
necessária**: as duas leituras da topologia são os dois lados de uma medição, e
unificá-las anularia o instrumento sem que nenhum teste acusasse. A tensão fica
registrada aqui para que uma futura refatoração "óbvia" não a desfaça por
engano.
