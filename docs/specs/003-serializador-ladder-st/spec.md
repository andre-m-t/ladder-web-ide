# Spec 003 — Serializador Ladder → ST

> **Status:** aprovada (2026-09-18). Q-1 a Q-6 decididas no §9
> **Autor:** André  ·  **Data:** 2026-09-17
> **Princípios aplicáveis:** §2, §3, §4, §5, §6, §11

Esta especificação descreve **o quê** e **o porquê**. Não descreve *como*.

---

## 1. Objetivo e contexto

O editor Ladder (spec 002) já constrói, inteiramente no navegador, um diagrama
estruturado — degraus com contatos, bobinas simples, bobinas SET/RESET e ramo
paralelo, cada elemento vinculado a uma variável — e já valida essa estrutura
antes de aceitar qualquer edição. O que falta para esse diagrama ter qualquer
efeito fora da tela é a peça que dá nome à arquitetura do produto: traduzi-lo
para Structured Text, a linguagem que o compilador externo (MATIEC/`iec2c`)
de fato entende. Sem essa tradução, um projeto Ladder não tem como chegar ao
pipeline de compilação e gravação que a spec 001 já provou funcionar — hoje,
**Compilar** e **Gravar** ficam desabilitados sempre que o projeto é Ladder,
pendência registrada na revisão aditiva de 2026-09-17 da Questão Q-2 da
spec 002.

Esta feature entra **antes** de a spec 002 terminar sua última fatia de
edição (a que acrescenta o contador crescente e a inserção de SET/RESET pela
interface). Isso é possível porque o modelo de dados do diagrama já contém,
desde a fatia anterior, todos os tipos de elemento que esta spec precisa
traduzir — contato normalmente aberto, contato normalmente fechado, bobina
simples, bobina SET, bobina RESET e ramo paralelo — mesmo que a interface
ainda não ofereça um jeito de inserir todos eles clicando. A serialização
trabalha sobre o diagrama já validado, não sobre a interface que o constrói.

O ganho não é só funcional. A spec 002 registrou, na sua revisão da Questão
Q-4 e na ressalva R-1 do plano correspondente, que a equivalência entre um
diagrama Ladder e o Structured Text que o representa está **assumida**, não
verificada: o único ST de referência usado nos testes automatizados foi
escrito à mão, provando apenas que aquele texto específico se comporta como o
programa canônico — nunca que o diagrama de fato produz aquele texto. Esta
spec fecha essa lacuna: a partir daqui, o texto ST comparado ao comportamento
esperado é o que a serialização realmente produz a partir do diagrama, e não
mais um substituto escrito por uma pessoa. Isso é resultado direto de TCC —
transforma uma suposição de projeto em algo medido.

## 2. Usuários e cenário de uso

**Usuário:** o mesmo estudante ou professor de automação da spec 002, agora
em um ponto além da montagem visual: o diagrama já está pronto e a pessoa
quer ver o programa funcionar de verdade — compilado e, quando houver
hardware, gravado no ESP32.

**Cenário:** a pessoa termina de montar um diagrama Ladder — por exemplo, o
espelho direto entrada→saída ou o programa mínimo com variáveis internas, os
mesmos cenários de referência da spec 002 — e aciona **Compilar**. Sem que
ela precise escrever uma linha de Structured Text, o diagrama é traduzido
para esse formato e enviado ao mesmo serviço de compilação que já existe
desde a spec 001. Se a tradução for possível, a pessoa acompanha a
compilação normalmente, como já acontece hoje num projeto de Structured
Text; se o diagrama tiver algum elemento ou condição que a tradução não sabe
resolver, ela é informada antes de qualquer coisa ser enviada ao servidor.

## 3. Histórias de usuário

- Como **estudante de automação**, quero que o diagrama Ladder que montei
  vire código executável sem eu escrever Structured Text, para poder
  compilar e gravar sem conhecer a linguagem textual.
- Como **usuário**, quero que contatos, bobinas simples, bobinas SET/RESET e
  ramos paralelos no meu diagrama produzam um programa que se comporta como
  eu esperava ao montar cada um deles.
- Como **usuário**, quero que a tradução recuse, com aviso claro, qualquer
  parte do diagrama que ela ainda não saiba traduzir, em vez de gerar um
  programa incompleto ou incorreto em silêncio.
- Como **professor**, quero poder confiar que um diagrama Ladder montado na
  ferramenta e um Structured Text escrito à mão com a mesma intenção lógica
  produzem o mesmo comportamento observável, para usar a ferramenta como
  material de ensino sem ressalva.
- Como **usuário de um projeto Ladder**, quero que os botões **Compilar** e
  **Gravar**, hoje desabilitados nesse tipo de projeto, passem a funcionar
  exatamente como já funcionam num projeto de Structured Text.

## 4. Requisitos funcionais

**Subconjunto coberto por esta spec:** contato normalmente aberto, contato
normalmente fechado, bobina simples, bobina SET, bobina RESET e ramo
paralelo (estrutura "ou" dentro de um degrau) — os cinco tipos de elemento e
a estrutura de ramo que o modelo de dados do diagrama já reconhece hoje.
**O contador crescente (CTU) fica fora desta spec**: ele ainda não existe no
modelo de dados do diagrama — entra numa fatia futura da spec 002 — e, por
isso, não há hoje nenhum diagrama que a serialização precise recusar por
causa dele. Quando o contador crescente for incorporado ao modelo, o
serializador precisará ser estendido para reconhecê-lo; isso é trabalho
registrado como consequência desta spec, não coberto por ela.

- **RF-1.** O sistema deve traduzir um diagrama, contendo qualquer combinação
  dos elementos do subconjunto declarado acima, para um texto equivalente na
  linguagem que o compilador externo aceita, preservando o comportamento
  lógico de cada contato, bobina e ramo paralelo.
- **RF-2.** O sistema deve declarar, no texto produzido, todas as variáveis
  usadas pelo diagrama, respeitando a restrição já conhecida do compilador
  externo de não aceitar, numa mesma declaração composta, variáveis com
  endereço de controlador e variáveis sem endereço lado a lado.
- **RF-3.** O texto produzido deve usar exclusivamente o conjunto de
  caracteres que o compilador externo aceita (texto puro, sem acentuação nem
  caracteres fora da faixa ASCII), independentemente de a pessoa ter usado
  acentos ao nomear variáveis ou degraus na interface.
- **RF-4.** O texto produzido deve ter a estrutura mínima que o compilador
  externo exige para ser aceito como um programa executável — um bloco de
  lógica associado a uma configuração de execução — sem que esta spec fixe a
  forma exata desse texto (isso é decisão do plano).
- **RF-5.** Quando o diagrama contiver um elemento fora do subconjunto
  declarado nesta spec, o sistema deve recusar a serialização com uma
  mensagem clara, identificando o elemento, em vez de produzir um texto
  incompleto, incorreto ou parcialmente traduzido. (Hoje, nenhum diagrama
  possível cai nesse caso, porque o modelo de dados do diagrama ainda não
  tem o contador crescente; este requisito garante que a extensão futura
  citada na abertura deste capítulo tenha, desde já, um comportamento de
  recusa explícito para se apoiar, em vez de ausência de menção.)
- **RF-6.** O sistema deve, para um projeto Ladder, habilitar as ações de
  compilar e gravar já existentes, usando o texto produzido pela
  serialização como entrada do mesmo serviço de compilação já usado por um
  projeto de Structured Text — sem introduzir um caminho de compilação
  separado.
- **RF-7.** Quando o diagrama de origem tiver algum problema estrutural de
  severidade "erro" já identificado pela validação existente do editor, o
  sistema deve ter um comportamento definido e único para essa situação
  antes de a serialização (ou a compilação) prosseguir — ver Questão Q-2.
- **RF-8.** O sistema deve produzir um resultado definido para um diagrama
  vazio e para um degrau vazio dentro de um diagrama não vazio, em vez de
  falhar de forma não tratada — ver Questão Q-6.
- **RF-9.** O sistema deve dar à pessoa alguma forma de saber que a
  serialização ocorreu e de que resultado ela produziu, num projeto Ladder —
  a forma exata (visualização do texto, apenas indicação de que a etapa
  ocorreu, ou outra) é decisão de Questão Q-1.
- **RF-10.** O sistema deve tornar possível relacionar um diagnóstico
  devolvido pelo compilador externo, quando a compilação falha, de volta ao
  trecho do diagrama que o originou — o grau de detalhe dessa relação é
  decisão de Questão Q-3.
- **RF-11.** A tradução de uma bobina SET e de uma bobina RESET deve produzir
  comportamento coerente com a semântica de "forçar e manter"/"forçar e
  apagar" que a spec 002 já assume ao validar essas bobinas — inclusive no
  caso de SET e RESET da mesma variável acionados por condição que depende
  dela própria, hoje sinalizado como aviso pela validação do editor. A forma
  exata dessa semântica no texto produzido é decisão de Questão Q-5.
- **RF-12.** O texto produzido não deve referenciar nenhum endereço de
  controlador além dos que o próprio diagrama de origem já usa — a
  serialização não introduz, nem precisa validar de novo, endereço fora do
  conjunto que o editor já restringe ao construir o diagrama.
- **RF-13.** *Revisão aditiva (2026-09-23):* o sistema deve oferecer **exportação**
  do diagrama em PLCopen XML (TC6 0201) pelo menu Baixar, cobrindo o subconjunto
  do editor (contatos, bobinas SET/RESET, ramo, CTU, endereços em `localVars`).
  É **somente exportação** — não há importação. A leitura de topologia do
  exportador é independente do serializador ST (mesma disciplina do RF-7). O JSON
  do projeto continua sendo o formato nativo.

> **Revisão aditiva do RF-5 (2026-09-18), na aprovação do plano.** O texto
> original do RF-5 continua valendo. A recusa com mensagem clara passa a
> cobrir também **nomes de variável que o compilador externo não aceita,
> embora o editor os aceite**:
> - palavras reservadas da IEC 61131-3 (como `AND`, `NOT`, `TRUE`, `IF`);
> - os nomes fixos do programa e da configuração (Q-4);
> - dois nomes que diferem só em maiúsculas e minúsculas, porque
>   identificadores IEC não fazem essa distinção.
>
> A recusa identifica a variável e não produz texto parcial. Renomear em
> silêncio foi descartado, porque quebraria a correspondência entre diagrama e
> texto que a Q-1 torna visível. Origem: decisão D-5 do `plan.md`, registrada
> ali como tensão e trazida para a spec por decisão do autor.

> **Revisão aditiva do escopo (2026-09-19): contador crescente.** O §7
> deixava o contador crescente de fora e registrava a extensão como "trabalho
> novo, não dívida". A extensão entra agora, por decisão do autor, na mesma
> rodada em que o contador entra no modelo de dados (Fatia 4 da spec 002).
> Motivo: sem ela, um diagrama com contador podia ser montado mas não
> compilado, e a equivalência exata do pisca-pisca (Q-4 da spec 002) seguiria
> verificável só contra um texto escrito à mão.
>
> - **RF-13.** A tradução deve cobrir o contador crescente do modelo da
>   spec 002. A entrada de contagem vem do caminho de contatos que alimenta o
>   elemento. O reinício vem do caminho de contatos da linha de reset, e a
>   ausência de contato nesse caminho equivale a "nunca reinicia". O
>   valor-limite é o configurado no elemento, e "atingiu o limite" é escrito
>   na variável de saída do elemento. A instância do contador segue as mesmas
>   recusas de nome da revisão do RF-5.
> - **CA-10 (RF-13).** Dado o diagrama de referência de pisca-pisca com
>   contagem e forçamento (`BLINK`), quando ele é serializado, então o texto
>   é aceito pelo compilador externo. Executado no runtime real contra o
>   programa de referência `blink.st` da spec 001, com as mesmas entradas,
>   ele produz **zero divergências** ciclo a ciclo, em 200 ciclos e em três
>   padrões de entrada: botão sempre solto, pulso isolado e botão mantido
>   pressionado.

## 5. Critérios de aceitação

- **CA-1 (RF-1/RF-2/RF-3/RF-4).** Dado o diagrama de referência "espelho
  direto entrada → saída" (contato normalmente aberto ligado a uma entrada,
  bobina simples ligada a uma saída, ambas com endereço de controlador),
  quando ele é serializado, então o texto produzido é aceito pelo compilador
  externo sem erro e, medido pelo arcabouço de teste diferencial já
  existente no projeto, se comporta como o programa de referência
  equivalente já usado nos testes da spec 001 — sem divergência em nenhum
  ciclo, para os mesmos padrões de entrada.
- **CA-2 (RF-1/RF-2/RF-3/RF-4).** Dado o diagrama de referência "programa
  mínimo com variáveis internas" (contato normalmente fechado e bobina
  simples, ambos ligados a variáveis sem endereço), quando ele é
  serializado, então o texto produzido é aceito pelo compilador externo sem
  erro e, medido pelo mesmo arcabouço diferencial, se comporta como o
  programa de referência equivalente da spec 001.
- **CA-3 (RF-1).** Dado um diagrama cujo degrau usa um ramo paralelo para
  combinar duas condições em "ou" sobre uma mesma bobina, quando ele é
  serializado, então o texto produzido é aceito pelo compilador externo e,
  medido pelo arcabouço diferencial com um caso próprio para este cenário, a
  bobina é energizada exatamente quando pelo menos uma das condições do ramo
  é verdadeira, em todos os ciclos comparados.
- **CA-4 (RF-1/RF-11).** Dado um diagrama com uma bobina SET e uma bobina
  RESET vinculadas à mesma variável, cada uma acionada por uma condição
  distinta, quando ele é serializado, então o texto produzido é aceito pelo
  compilador externo e, medido pelo arcabouço diferencial com um caso
  próprio para este cenário, a variável é forçada e mantida ligada a partir
  do ciclo em que a condição do SET se torna verdadeira, e apagada a partir
  do ciclo em que a condição do RESET se torna verdadeira, com a decisão de
  Q-5 definindo o resultado do ciclo em que as duas condições coincidem.
- **CA-5 (RF-6).** Dado um projeto Ladder montado na interface (por exemplo,
  reproduzindo um dos diagramas de referência do §2), quando a pessoa aciona
  Compilar, então o mesmo caminho de compilação já usado por um projeto de
  Structured Text é percorrido e devolve, em caso de sucesso, as mesmas
  imagens de gravação que esse caminho já devolve hoje; Gravar passa a
  operar sobre elas exatamente como já opera num projeto de Structured Text.
- **CA-6 (RF-5).** Dado um diagrama contendo um elemento fora do subconjunto
  declarado no §4 desta spec — situação hoje só alcançável de forma
  controlada, por não existir ainda no modelo de dados do diagrama —, quando
  a serialização é tentada, então o sistema recusa com mensagem que
  identifica o elemento, sem produzir texto parcial.
- **CA-7 (RF-7, Q-2).** Dado um diagrama com ao menos um problema de
  severidade "erro" identificado pela validação já existente do editor,
  quando a pessoa tenta serializar ou compilar esse diagrama, então o
  sistema segue o comportamento único definido pela decisão de Q-2 —
  recusar antes de qualquer coisa ser enviada ao compilador externo, ou
  permitir a tentativa e reportar a falha que o compilador externo
  devolver.
- **CA-8 (RF-8, Q-6).** Dado um diagrama sem nenhum degrau, ou um diagrama em
  que ao menos um degrau não tem nenhum elemento nem ramo, quando ele é
  serializado, então o resultado é o definido pela decisão de Q-6, nunca uma
  falha não tratada.
- **CA-9 (RF-12).** Dado um diagrama cujas variáveis com endereço usam apenas
  endereços do conjunto que o editor já oferece, quando ele é serializado,
  então o texto produzido referencia exatamente esses endereços e nenhum
  outro.

> **Revisão aditiva (2026-09-18), após as decisões do §9.** O texto original
> de CA-4, CA-7 e CA-8 fica mantido acima. Com as questões decididas, eles
> passam a ser verificados assim:
> - **CA-4 (Q-5):** no ciclo em que as condições do SET e do RESET coincidem,
>   a variável fica com o valor da bobina do degrau mais abaixo.
> - **CA-7 (Q-2):** com erro de validação, Compilar fica indisponível com
>   motivo que aponta para a lista de problemas, e nenhuma requisição chega ao
>   serviço de compilação. Com apenas avisos, a compilação segue.
> - **CA-8 (Q-6):** um degrau vazio não aparece no texto produzido. Um
>   diagrama sem nenhum elemento resulta em "nada a compilar", sem texto, com
>   Compilar indisponível e esse motivo exposto.
> - **Acréscimos decorrentes de Q-1 e Q-3:** num projeto Ladder, o texto
>   gerado aparece somente leitura e muda quando o diagrama muda. Um
>   diagnóstico do compilador com linha é apresentado como referente ao
>   degrau que gerou aquela linha.

## 6. Requisitos não-funcionais

- A serialização ocorre inteiramente no navegador, sem requisição ao
  servidor para produzir o texto (cf. §6 da Constituição); só o texto já
  produzido viaja até o serviço de compilação, exatamente como o texto
  colado manualmente já viaja hoje num projeto de Structured Text.
- A serialização de um mesmo diagrama, sem alteração entre uma chamada e
  outra, deve produzir sempre o mesmo texto — determinismo necessário para
  que os critérios de aceitação sejam verificáveis de forma repetível.
- A serialização de um diagrama dentro dos limites de tamanho já
  estabelecidos pela spec 002 (colunas por degrau, linhas de ramo, sem
  limite de número de degraus) não deve introduzir demora perceptível ao
  acionar Compilar, além do tempo de compilação em si, já medido pela
  spec 001.
- Mensagens de recusa e de erro apresentadas na interface permanecem em
  português, no mesmo padrão já estabelecido pela spec 002 para problemas de
  validação.

## 7. Fora de escopo

- Tradução no sentido inverso (Structured Text → Ladder).
- Simulação do diagrama — execução do ciclo de varredura no navegador (F9,
  spec futura). Esta spec mede equivalência entre o diagrama serializado e o
  compilador/runtime reais, nunca entre o diagrama e uma simulação.
- Edição manual do texto ST gerado pela serialização.
- Qualquer alteração no contrato do serviço de compilação já estabelecido
  pela spec 001 — esta spec reusa esse serviço como já existe, sem propor
  caminho, formato de requisição ou resposta novos.
- O contador crescente (CTU) e, por decorrência, a verificação automática da
  equivalência exata do cenário de pisca-pisca com contagem e forçamento
  (Questão Q-4 da spec 002) — ambos dependem de o contador crescente entrar
  no modelo de dados do diagrama, o que só ocorre numa fatia futura da
  spec 002. Fica registrado que, quando isso acontecer, o serializador
  precisará ser estendido; essa extensão é trabalho novo, não uma dívida
  desta spec.
  *(Revisto em 2026-09-19: o contador crescente passou a fazer parte do
  escopo pelo RF-13. Ver a revisão aditiva no §4.)*
- Temporizadores (TON/TOF) e contador decrescente (CTD) — permanecem fora do
  subconjunto do projeto inteiro, não só desta spec (cf. §7 da spec 002).
  *(Revisão aditiva 2026-09-28, spec 006: passam a ser emitidos como FB
  padrão `TON`/`TOF`/`CTD` com `PT`/`PV` conforme IEC 61131-3.)*
- Seleção de placa, pinagem ou endereço por interface além do que a
  spec 001/002 já decidiram.
- Qualquer forma de otimização, reescrita ou simplificação do texto
  produzido que não seja necessária à sua aceitação pelo compilador externo.

## 8. Dependências

- **Spec 002** (editor Ladder visual) — fornece o modelo de dados do
  diagrama e a validação estrutural que a serialização usa como entrada. A
  dependência é sobre o modelo de dados e os tipos de elemento que ele já
  contém (contato NA/NF, bobina simples, bobina SET/RESET, ramo paralelo),
  concluídos antes desta spec — não sobre a última fatia da spec 002 (que
  acrescenta contador crescente e a inserção de SET/RESET pela interface),
  que permanece pendente e não bloqueia esta spec.
- **Spec 001** (fatia vertical mínima) — fornece o serviço de compilação já
  em funcionamento (o mesmo endpoint que hoje recebe Structured Text colado
  manualmente e devolve as imagens de gravação). Esta spec reusa esse
  serviço sem alterá-lo.
- **Recursos externos:** o compilador externo (MATIEC/`iec2c`), já integrado
  ao serviço de compilação desde a spec 001, é a autoridade que decide se um
  texto produzido pela serialização é aceito. O arcabouço de teste
  diferencial já existente no projeto — hoje pronto, mas ainda sem um
  segundo executor com que comparar, à espera do simulador (F9) — é o
  instrumento usado para medir os critérios de aceitação desta spec contra
  o runtime real, sem depender de hardware físico.

## 9. Registro de decisões

Cada questão que precisa da decisão do autor antes da aprovação da spec. As
entradas **permanecem visíveis após decididas** — o histórico de decisões é
parte da rastreabilidade do projeto (§8 da Constituição) e insumo direto do
capítulo de Desenvolvimento do TCC. Ao decidir uma questão, preencha status,
data, decisão e justificativa; não apague o enunciado.

### Q-1 — Visibilidade do texto ST gerado antes de compilar
- **Enunciado:** o texto produzido pela serialização de um projeto Ladder
  fica visível na interface antes de ser enviado ao serviço de compilação
  (por exemplo, numa visualização somente leitura, o que ajudaria quem está
  aprendendo a associar o diagrama ao texto equivalente), ou a serialização
  é inteiramente interna, e a pessoa só vê o resultado da compilação em si,
  sem nunca ver o texto intermediário?
- **Status:** decidida
- **Data da decisão:** 2026-09-18
- **Decisão:** visível, **somente leitura**. Num projeto Ladder, a interface
  mostra o texto ST gerado pela serialização, atualizado a cada edição do
  diagrama. Ele não pode ser editado ali (a edição manual continua fora de
  escopo, §7).
- **Justificativa:** tem valor didático, porque deixa quem aprende associar o
  diagrama ao texto equivalente, e ajuda a depurar o próprio serializador.
  Custa pouco: a serialização roda no navegador e é determinística (§6), então
  mostrar o texto não exige nenhuma requisição nova.

> **Revisão aditiva da Q-1 (2026-09-18), após uso da F8 pelo autor.** A
> decisão acima continua registrada. O texto ST gerado **deixa de ficar
> visível** na interface: o autor concluiu, usando a ferramenta, que ver o
> texto intermediário não ajuda o usuário. Em seu lugar, o projeto pode ser
> **baixado** por um botão no cabeçalho, com a escolha entre a versão Ladder
> (o projeto em JSON, no mesmo formato em que ele é salvo) e a versão ST (o
> texto que a serialização produz, o mesmo enviado ao compilador). Num
> diagrama com erro ou vazio, o download do ST fica indisponível com o mesmo
> motivo do Compilar (Q-2, Q-6). O RF-9 continua atendido: a pessoa sabe que
> a serialização ocorreu pelo estado do Compilar e pode obter o resultado
> pelo download. O rastreio da Q-3 continua citando degrau e linha, e a linha
> é a do arquivo baixado.
>
> **Revisão aditiva da Q-1 (2026-09-28), pedido do orientador.** O menu
> **Baixar** ganha a opção **Firmware ESP32 (.zip)** em projeto Ladder e em
> projeto ST. O arquivo contém as três imagens de flash devolvidas por
> `POST /compile/pacote` (bootloader, tabela de partições, aplicação) e um
> `gravacao.txt` com os endereços e um exemplo de comando `esptool`. A opção
> obedece ao mesmo portão de indisponibilidade do Compilar em projeto Ladder
> (`motivoIndisponivel`); em projeto ST, só a simulação bloqueia (como
> Compilar). Se ainda não houver pacote compilado para a fonte ST atual, a
> IDE compila antes do download, avisa no console e em toast («A lógica será
> compilada antes do download.») e só então dispara o download; se já houver
> sucesso de compilação para a mesma fonte, reutiliza o pacote sem compilar de
> novo. O ZIP é montado no cliente (`lib/download.ts`), sem endpoint novo.
>
> **Revisão aditiva da Q-1 (2026-09-28), manifesto ESP Web Tools.** O zip passa
> a incluir também `manifest.json` no formato do [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
> (instalador web usado pelo ESPHome — não é arquivo YAML de configuração).
> `builds[0].parts` aponta para os três `.bin` do zip com `offset` decimal,
> vindos do pacote de compilação. Não inclui `boot_app0.bin` (o build IDF do
> LadderFlow não produz essa imagem). `gravacao.txt` e o README explicam que a
> pasta descompactada precisa ser publicada junta para o instalador web.

### Q-2 — Serializar um diagrama com problema de severidade "erro"
- **Enunciado:** quando o diagrama de origem tem ao menos um problema de
  severidade "erro" já identificado pela validação existente do editor
  (degrau incompleto, variável não vinculada, bobina duplicada, entre
  outros), a serialização (ou a tentativa de compilar) é recusada na tela,
  antes de qualquer coisa ser enviada ao compilador externo, ou a tentativa
  segue adiante e deixa o compilador externo ser quem efetivamente rejeita
  o programa resultante?
- **Status:** decidida
- **Data da decisão:** 2026-09-18
- **Decisão:** **recusar na tela.** Com ao menos um problema de severidade
  "erro", Compilar fica indisponível, com o motivo exposto e apontando para a
  lista de problemas, e nada é enviado ao servidor. Problemas de severidade
  "aviso" não bloqueiam.
- **Justificativa:** o editor já sabe o que está errado e diz onde. O
  compilador externo não conhece conceitos como "degrau incompleto": ou
  rejeitaria o texto com uma mensagem que não se lê de volta no diagrama, ou,
  pior, aceitaria um programa diferente do que a pessoa montou. Recusar antes
  também garante que um erro devolvido pelo compilador num projeto Ladder
  indique defeito do serializador, e não do diagrama.

### Q-3 — Rastreio entre diagnóstico do compilador e trecho do diagrama
- **Enunciado:** o texto ST gerado carrega alguma forma de marcação que
  relacione cada trecho de volta ao degrau (ou elemento) do diagrama que o
  originou, de modo que um diagnóstico de erro devolvido pelo compilador
  externo (linha/coluna) possa ser lido de volta como "este degrau, este
  elemento" — ou essa relação não é mantida nesta spec, e um erro de
  compilação num projeto Ladder aparece apenas como texto do compilador,
  sem apontar para o diagrama?
- **Status:** decidida
- **Data da decisão:** 2026-09-18
- **Decisão:** a relação é mantida **no nível do degrau**. A serialização
  produz, junto com o texto, a correspondência entre cada degrau e as linhas
  do texto que ele gerou, e marca cada trecho com um comentário que identifica
  o degrau. Um diagnóstico do compilador com linha é apresentado como
  referente àquele degrau. A relação no nível do elemento fica fora desta
  spec.
- **Justificativa:** o compilador externo já devolve a linha do diagnóstico, e
  o serviço de compilação já o estrutura (spec 001). Como a Q-2 barra erros
  estruturais antes do envio, um erro de compilação aqui indica defeito do
  serializador, e apontar o degrau basta para localizá-lo. Descer ao nível do
  elemento custaria mais do que ganharia nesse cenário.

### Q-4 — Nomes fixos ou configuráveis para programa/recurso/tarefa e intervalo de execução
- **Enunciado:** os programas de referência já existentes no projeto usam
  sempre o mesmo nome de programa, o mesmo nome de recurso e o mesmo
  intervalo de tarefa (20 ms). A serialização de um projeto Ladder deve
  sempre usar esses mesmos valores fixos, independentemente do projeto, ou
  algum deles (em especial o intervalo de execução) deve poder ser
  configurado por projeto?
- **Status:** decidida
- **Data da decisão:** 2026-09-18
- **Decisão:** **fixos.** Nome de programa, de configuração, de recurso e de
  tarefa, e o intervalo de 20 ms, são os mesmos dos programas de referência já
  existentes no projeto, independentemente do projeto.
- **Justificativa:** menos superfície de interface e de teste. O firmware e o
  arcabouço diferencial já trabalham com esses valores, e o intervalo da
  tarefa não é algo que o público-alvo ajuste na PoC. Torná-los configuráveis
  depois é aditivo e não quebra projetos salvos.

### Q-5 — Semântica exata de SET/RESET no texto gerado
- **Enunciado:** a validação do editor já trata SET e RESET da mesma
  variável, acionados por condição que depende dela própria, como um aviso
  (não um erro) — reconhecendo que os dois podem se anular ou se sobrepor
  dentro do mesmo ciclo de varredura, dependendo da ordem de avaliação. O
  texto ST gerado precisa preservar uma ordem específica entre a tradução do
  SET e a do RESET de uma mesma variável (e, se sim, qual — sempre SET antes
  de RESET, sempre a ordem dos degraus no diagrama, ou outra regra), de modo
  que o comportamento do texto gerado continue sendo o que o aviso já
  descreve?
- **Status:** decidida
- **Data da decisão:** 2026-09-18
- **Decisão:** **ordem dos degraus**, de cima para baixo. Cada bobina SET ou
  RESET é traduzida no lugar do seu degrau, como uma escrita condicional ("se
  a condição do degrau for verdadeira, forçar/apagar") que não altera a
  variável quando a condição é falsa. Se SET e RESET da mesma variável ficarem
  verdadeiros no mesmo ciclo, vence o que estiver no degrau mais abaixo, ou
  seja, a última escrita do ciclo. O CA-4 mede exatamente esse ciclo.
- **Justificativa:** é a semântica de varredura dos controladores reais e a
  mesma que o aviso de SET/RESET autodependente do editor já descreve. A
  pessoa controla o resultado pela ordem em que monta os degraus, sem regra
  escondida de prioridade, e a tradução não reordena nada.

### Q-6 — Resultado da serialização de diagrama vazio ou degrau vazio
- **Enunciado:** um diagrama sem nenhum degrau, ou com ao menos um degrau
  sem nenhum elemento nem ramo (situação que a validação do editor já trata
  como "espaço em branco", não como erro), produz algum texto ST válido
  quando serializado — e, se sim, o que esse texto faz — ou a serialização
  desses casos é tratada como uma condição própria, distinta de "diagrama
  válido pronto para compilar"?
- **Status:** decidida
- **Data da decisão:** 2026-09-18
- **Decisão:** um **degrau vazio é omitido** do texto e não produz nada. Um
  **diagrama sem nenhum elemento**, seja sem degraus, seja só com degraus
  vazios, é uma condição própria, "nada a compilar": Compilar fica
  indisponível com esse motivo, e a serialização não produz texto.
- **Justificativa:** o compilador externo recusa corpo de programa vazio
  (verificado na tarefa #26 da spec 002, ao montar o esqueleto de projeto ST).
  Inventar uma instrução de preenchimento esconderia o caso e mandaria ao
  dispositivo um programa que não faz nada. Omitir o degrau vazio mantém a
  leitura da spec 002, em que ele é espaço em branco, não erro.

## Revisão aditiva — 2026-09-22 (emissão por bobina paralela)

- **`emitirDegrau`:** coleta todas as bobinas na coluna terminal (ordenadas por
  linha) e emite uma atribuição por bobina com a **mesma** expressão booleana
  do degrau. Fixture `SAIDAS_PARALELAS` e dourado `saidas_paralelas.st`.

## Revisão aditiva — 2026-09-22 (ramo de saída fora da topologia de contatos)

- Na leitura de ramos para a expressão booleana do degrau, ramos com
  `ehRamoDeSaida` são ignorados (não entram na redução série-paralelo). A emissão
  por bobina paralela da revisão anterior permanece; a fixture `SAIDAS_PARALELAS`
  inclui o ramo de saída no diagrama JSON.

## 10. Conformidade com a Constituição

- **§2 (fatia vertical primeiro):** esta spec completa, junto com a spec 002,
  o segundo caminho fim-a-fim do produto (editar → serializar → compilar →
  gravar), habilitando **Compilar** e **Gravar** num projeto Ladder pela
  primeira vez — fecha a pendência registrada na revisão aditiva de Q-2 da
  spec 002 e a ressalva R-1/decisão D-8 do plano correspondente.
- **§3 (conformidade com a IEC 61131-3):** o subconjunto traduzido é
  declarado explicitamente no §4; um elemento fora dele é recusado com
  mensagem clara (RF-5), nunca aceito ou ignorado em silêncio. A CA-1 e a
  CA-2 substituem, pela primeira vez, uma equivalência diagrama↔ST assumida
  por uma equivalência medida contra o compilador e o runtime reais.
- **§4 (testes como rede de segurança):** todos os critérios de aceitação
  centrais (CA-1 a CA-4) são verificados pelo arcabouço de teste diferencial
  já existente no projeto — comportamento medido, não assumido.
- **§5 (cliente sem instalação):** a serialização roda inteiramente no
  navegador; não introduz toolchain, driver ou aplicativo local novo.
- **§6 (separação de responsabilidades):** a serialização é responsabilidade
  exclusiva do cliente; o servidor continua a compilar exatamente o que já
  compila hoje, sem nenhuma mudança de contrato (RF-6).
- **§11 (simplicidade e legibilidade):** o subconjunto coberto (§4) é
  exatamente o que o modelo de dados do diagrama já contém hoje — nada é
  antecipado para um contador crescente ou outro elemento que ainda não
  existe, mesmo sabendo que ele está a caminho.
