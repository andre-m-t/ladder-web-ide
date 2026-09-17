# Spec 003 — Serializador Ladder → ST

> **Status:** rascunho
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
- Temporizadores (TON/TOF) e contador decrescente (CTD) — permanecem fora do
  subconjunto do projeto inteiro, não só desta spec (cf. §7 da spec 002).
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
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

### Q-2 — Serializar um diagrama com problema de severidade "erro"
- **Enunciado:** quando o diagrama de origem tem ao menos um problema de
  severidade "erro" já identificado pela validação existente do editor
  (degrau incompleto, variável não vinculada, bobina duplicada, entre
  outros), a serialização (ou a tentativa de compilar) é recusada na tela,
  antes de qualquer coisa ser enviada ao compilador externo, ou a tentativa
  segue adiante e deixa o compilador externo ser quem efetivamente rejeita
  o programa resultante?
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

### Q-3 — Rastreio entre diagnóstico do compilador e trecho do diagrama
- **Enunciado:** o texto ST gerado carrega alguma forma de marcação que
  relacione cada trecho de volta ao degrau (ou elemento) do diagrama que o
  originou, de modo que um diagnóstico de erro devolvido pelo compilador
  externo (linha/coluna) possa ser lido de volta como "este degrau, este
  elemento" — ou essa relação não é mantida nesta spec, e um erro de
  compilação num projeto Ladder aparece apenas como texto do compilador,
  sem apontar para o diagrama?
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

### Q-4 — Nomes fixos ou configuráveis para programa/recurso/tarefa e intervalo de execução
- **Enunciado:** os programas de referência já existentes no projeto usam
  sempre o mesmo nome de programa, o mesmo nome de recurso e o mesmo
  intervalo de tarefa (20 ms). A serialização de um projeto Ladder deve
  sempre usar esses mesmos valores fixos, independentemente do projeto, ou
  algum deles (em especial o intervalo de execução) deve poder ser
  configurado por projeto?
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

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
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

### Q-6 — Resultado da serialização de diagrama vazio ou degrau vazio
- **Enunciado:** um diagrama sem nenhum degrau, ou com ao menos um degrau
  sem nenhum elemento nem ramo (situação que a validação do editor já trata
  como "espaço em branco", não como erro), produz algum texto ST válido
  quando serializado — e, se sim, o que esse texto faz — ou a serialização
  desses casos é tratada como uma condição própria, distinta de "diagrama
  válido pronto para compilar"?
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

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
