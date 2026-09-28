# Limitações declaradas

Este documento consolida, num único lugar, as limitações conhecidas do
LadderFlow como ele existe hoje — software completo (F1–F9), fatia vertical
fechada até onde é possível sem hardware físico. Cada item registra a
**causa** (por que existe) e o **impacto** (o que o usuário ou o avaliador do
TCC sente por causa disso). A origem de cada decisão está nas specs e no
`.claude/state.md`; este documento não substitui esse histórico, apenas o
resume para quem lê de fora do processo de desenvolvimento.

A separação entre "limitação do software" e "ausência de evidência de
hardware" é proposital: a segunda categoria não é um defeito do código, é uma
lacuna de validação que só um ESP32 físico fecha.

---

## Limitações do software

### 1. Cruzamento visual residual de ramos de linhas diferentes

**Causa:** quando um ramo paralelo precisa ocupar uma linha diferente da que
ficaria livre pela regra normal de posicionamento (por exemplo, um ramo que
sobra sozinho na linha 2 depois que o da linha 1 é removido, seguido da
chegada de um contador CTU ao mesmo degrau), o editor nem sempre consegue
trocar as linhas para evitar sobreposição visual. O conector vertical de um
ramo pode então atravessar o traço de outra linha na tela.

**Impacto:** é só de desenho — a semântica do diagrama permanece correta e
testada (o ramo liga unicamente ao trilho principal, nunca à linha que
atravessa), e o caso é raro na prática de montar um diagrama. Registrado como
D-1 do plano da spec 003.

### 2. Exportação PLCopen XML sem importação e com subconjunto fixo

**Causa:** o menu Baixar ganhou exportação PLCopen TC6 0201 (`plcopen.ts`) para
interoperar com editores externos; o formato nativo do LadderFlow continua sendo
o envelope JSON do projeto. A leitura de topologia do exportador é autoral e
cobre só o que o editor desenha hoje — não há caminho de volta (importação).

**Impacto:** arquivos `.xml` gerados podem não abrir ou não redesenhar corretamente
em outro software; a validação contra o XSD oficial da PLCopen não está no
repositório (teste manual documentado em `docs/validacao/plcopen-exportacao.md`).

### 3. `set_reset_autodependente` usa o degrau inteiro como "caminho"

**Causa:** a checagem que avisa sobre um SET e um RESET que dependem um do
outro dentro do mesmo degrau lê o degrau inteiro como se fosse um único
caminho elétrico, em vez de rastrear os caminhos reais que um ramo paralelo
introduz.

**Impacto:** o aviso fica conservador demais em degraus com ramo paralelo —
pode disparar em situações em que, ramo a ramo, não haveria de fato
autodependência. É aviso, não erro: não impede compilar nem simular.
Registrado como D-15 do plano da spec 002. Com a revisão de 2026-09-22
(saídas paralelas na coluna terminal), o degrau pode ter mais de uma bobina
simples; a checagem continua lendo o degrau inteiro como um único caminho.

### 3. Nome da instância do CTU não é editável

**Causa:** a instância do contador (`ctu0`, `ctu1`, ...) é gerada
automaticamente pelo núcleo e nunca exposta a edição, por decisão de escopo
registrada em D-19 do plano da spec 002.

**Impacto:** o usuário não pode dar um nome de sua escolha à instância do
contador no texto ST gerado; o nome sempre segue o padrão sequencial.

### 4. `carregarDiagrama` confere só a forma dos dados, não cada elemento

**Causa:** deliberado e documentado no próprio `frontend/src/ladder/persistencia.ts`
— ao recarregar um diagrama do `localStorage`, `carregarDiagrama` verifica
apenas a forma mínima esperada (que `rungs` seja um array, que cada rung tenha
`id`, `elementos` e `ramos`), não a validade de cada elemento individual.

**Impacto:** não é uma lacuna de cobertura — a validação semântica completa
(posições, referências de variável, regras de negócio) é responsabilidade de
`validarDiagrama`, chamada pela IDE logo após o carregamento. A separação
existe para que a checagem de forma, que decide se dá para confiar no
JSON, não duplique a checagem de semântica.

### 5. Bobina simples duplicada é recusada como erro

**Causa:** decisão consciente (Q-6 da spec 002) de desviar da prática comum
de mercado, onde múltiplas bobinas simples com o mesmo endereço em degraus
diferentes costumam ser toleradas (a última escrita no ciclo vence). O
LadderFlow recusa essa duplicação como erro de validação.

**Impacto:** um padrão aceito em ferramentas comerciais não é reproduzível no
editor. É desvio didático deliberado, não uma omissão: o objetivo é forçar
uma associação clara entre endereço e bobina simples enquanto se aprende a
linguagem. SET e RESET, ao contrário, podem coexistir no mesmo endereço em
degraus diferentes — o comportamento de última escrita vencedora existe para
eles.

### 6. Rastreio de diagnóstico do compilador só no nível do degrau

**Causa:** decisão de escopo (Q-3 da spec 003): quando o `iec2c` recusa o ST
gerado, o diagnóstico é associado ao degrau de origem (via mapa degrau →
linhas do ST), não ao elemento específico dentro do degrau.

**Impacto:** um erro de compilação leva o usuário até o degrau certo, mas não
até a célula exata dentro dele — a mesma granularidade que a validação local
do editor já oferece (que marca a célula) não se estende aos erros vindos do
servidor.

### 7. Diagrama salvo descartado é sobrescrito na primeira gravação seguinte

**Causa:** quando o conteúdo do `localStorage` está corrompido ou num formato
inesperado, `carregarDiagrama` descarta o conteúdo, avisa o usuário e a IDE
abre com um projeto vazio. Não existe cópia de segurança do conteúdo
descartado.

**Impacto:** o aviso é dado no momento do descarte, mas o dado corrompido não
sobrevive: assim que o usuário salva de novo (o que acontece a cada edição),
o conteúdo antigo, ainda que recuperável por outros meios, deixa de existir
na única cópia que o software mantém.

### 8. Um projeto por vez

**Causa:** decisão de escopo fora da spec 002 — o LadderFlow não tem
biblioteca de projetos, nem abrir/salvar arquivo local. "Novo projeto"
substitui o projeto atual, com confirmação de descarte quando há conteúdo.

**Impacto:** não é possível manter vários projetos guardados simultaneamente
no navegador nem trocar entre eles sem passar por download/reimportação
manual (e a reimportação de um `.json` baixado não é uma funcionalidade da
interface hoje — o download serve para guardar fora do navegador, não para
reabrir).

### 9. Duplicação deliberada entre serializador e simulador (RF-7 da spec 004)

**Causa:** esta é a limitação mais contraintuitiva do projeto, e também a
mais importante para o TCC. O serializador (`frontend/src/ladder/serializador.ts`)
e o simulador (`frontend/src/ladder/simulacao.ts`) resolvem o mesmo problema
— ler a topologia de um degrau Ladder e decidir o que está energizado — com
**duas implementações independentes**, que não compartilham nenhum código de
leitura de topologia. O simulador é proibido, por requisito de primeira
ordem (RF-7 da spec 004), de importar o serializador ou de reaproveitar sua
redução série-paralelo.

Essa proibição existe em tensão deliberada com o §11 da Constituição do
projeto, que em geral pede a eliminação de duplicação de código. A tensão é
registrada por escrito, de propósito, para que uma refatoração
bem-intencionada no futuro — "esses dois módulos fazem a mesma coisa, vamos
unificar" — não apague sem perceber a única coisa que dá valor de medição ao
projeto.

**Por que a duplicação é o instrumento, e não um desperdício:** a validação
central do TCC compara a saída do simulador (rodando no navegador) com a
saída do runtime em C real (rodando no host, a partir do ST que o
serializador gerou), ciclo a ciclo, para o mesmo programa. Se o simulador
reaproveitasse a leitura de topologia do serializador, um erro na leitura da
topologia apareceria **igual nos dois lados da comparação** — o runtime em C
executaria o ST errado gerado por essa leitura, e o simulador leria a mesma
topologia errada diretamente do diagrama. A comparação mediria zero
divergências sem ter, de fato, medido nada: o instrumento reportaria
"de acordo" mesmo com um defeito real presente. É a duplicação de
implementação, e só ela, que garante que os dois caminhos possam discordar
quando um dos dois estiver errado — o que é exatamente o que aconteceu no
controle negativo registrado no `state.md` (alterar o limite do contador de
12 para 13 produziu 57 divergências detectadas, provando que o instrumento
mede).

**Impacto:** dois trechos de lógica de propagação de sinal Ladder existem e
precisam ser mantidos separadamente, incluindo o risco comum de duplicação —
um bug corrigido em um pode não ser corrigido no outro. O projeto aceita esse
custo porque o valor da medição depende dele.

### 10. ~~Declarar, renomear e remover variável seguem liberados durante a simulação~~ (revogada em 2026-09-23)

**Revogação (revisão aditiva de 2026-09-23):** a tabela de variáveis passou a
respeitar o modo exclusivo da simulação (spec 004, Q-7): com `simulacaoAtiva`,
criar, renomear, trocar classe/pino e remover ficam desabilitados com o motivo
no `title`, enquanto a leitura e a coluna "Valor" ao vivo permanecem. A
limitação abaixo descrevia o comportamento **antes** dessa correção; não vale
mais.

**Causa (histórico):** a spec 004 não previu nem testou o comportamento de
editar variáveis enquanto uma simulação estava em curso.

**Impacto (histórico):** era possível renomear uma variável em uso no meio da
simulação sem comportamento definido — assimetria corrigida na revisão de
2026-09-23 (spec 002) e registrada no `.claude/state.md` na F9.

### 11. Compilação síncrona com exclusão mútua, sem fila

**Causa:** decisão de escopo da spec 001 (Q-6): o endpoint `POST /compile`
bloqueia até ter um binário ou um erro, e um `threading.Lock` de módulo
serializa o acesso ao diretório de build compartilhado — não existe fila de
compilação.

**Impacto:** suficiente para um usuário por vez, que é o cenário da PoC. Sob
uso concorrente real, uma segunda compilação simplesmente espera a primeira
liberar a trava, sem posição de fila visível nem estimativa de espera — não
é um modelo pensado para múltiplos usuários simultâneos.

### 12. Cobertura parcial da IEC 61131-3

**Causa:** decisão de escopo motivada pelas três fixtures de referência do
projeto (`blink.st`, `io_espelho.st`, `minimal.st`). O subconjunto coberto —
contato NA, contato NF, bobina simples, bobina SET, bobina RESET, ramo
paralelo (OU) e contador crescente (CTU) — é o que essas fixtures exigem.

**Impacto:** temporizadores (TON/TOF) e contador decrescente (CTD) ficam fora
do editor, do serializador e do simulador. *(Revisão aditiva 2026-09-28, spec
006: TON, TOF e CTD passam a integrar o subconjunto; este parágrafo descreve o
estado anterior.)* As linguagens gráficas FBD e SFC e
a linguagem textual IL (Instruction List) da norma não são suportadas em
nenhuma camada — o projeto cobre Ladder e Structured Text.

### 13. Sem autenticação, rate limiting ou HTTPS de borda

**Causa:** fora de escopo da PoC (registrado como pendência na F4 do
`state.md`): o serviço de compilação não implementa nenhum dos três.

**Impacto:** são pré-requisitos antes de expor o serviço fora de
`localhost`. Rodar o LadderFlow numa rede pública ou numa VPS sem esses três
itens expõe o endpoint de compilação sem controle de acesso, sem proteção
contra abuso por volume de requisições e sem criptografia de borda.

> **Revisão aditiva (2026-09-23).** Para demonstração temporária na VPS, o
> runbook em `deploy/README.md` prevê **HTTPS e autenticação HTTP básica na
> borda** (Caddy do host, fora do código autoral) e limite de corpo no proxy.
> A aplicação FastAPI continua **sem** autenticação, rate limiting nem HTTPS
> integrados; remover o bloco do Caddyfile e os contêineres restaura o estado
> descrito acima.

---

### 8. Planta do portão (spec 005)

**Causa:** o ambiente é uma **simplificação didática** do cenário do trabalho
anterior em Java e da referência visual de simuladores comerciais de treinamento
(LogixPro / ProSim): curso normalizado em vez de pixels, faixas nos fins de curso
em vez de igualdade exata, cena SVG redesenhada do zero (sem cópia de imagem),
sem temporizadores Modbus nem editor IL embutido na janela.

**Impacto:** o comportamento visual e os tempos de movimento não reproduzem
pixel a pixel o simulador antigo; a lógica Ladder continua medida pelo
arcabouço diferencial (`PORTAO` + `portao.toml`). Lâmpadas Aberto/Entreaberto/
Fechado (`%QX0.2`–`%QX0.4`) dependem do **programa** do usuário — a planta só
aciona motores e sensores; não calcula essas saídas automaticamente.

---

## O que depende exclusivamente de hardware

Os itens abaixo **não são limitações do software** — o código correspondente
existe e está testado até onde é possível sem um ESP32 físico. São, em vez
disso, ausência de evidência: nada aqui foi medido porque não há um
dispositivo físico disponível para medir. Detalhe completo, incluindo os
caminhos de validação que **foram** percorridos sem hardware (runtime no
host, boot em QEMU, teste diferencial) e exatamente onde cada um para, está
em [`docs/validacao/limites-da-validacao-sem-hardware.md`](validacao/limites-da-validacao-sem-hardware.md).

- **Gravação via Web Serial, ponta a ponta (CA-4 da spec 001).** O fluxo
  chega até a tentativa de conexão e falha de forma clara sem dispositivo; a
  gravação do mesmo pacote foi comprovada por linha de comando (`esptool`)
  contra um ESP32 emulado em QEMU, mas nunca pelo navegador contra um
  dispositivo real.
- **Taxa de sucesso de gravação em N tentativas** — por definição, só se mede
  gravando de verdade.
- **Tempo de ciclo de varredura real no dispositivo** — o runtime no host
  executa ciclos em sequência com relógio controlado, e o QEMU não emula
  temporização fiel ao silício; nenhum dos dois mede se a cadência de
  `T#20ms` é de fato respeitada no ESP32.
- **Comportamento dos *strapping pins* no boot** — já causou uma revisão de
  pinagem no projeto (Q-5, `%IX0.1` saiu do GPIO5 por conflito com strapping
  pin) sem que nada tivesse sido gravado; o efeito é invisível tanto no host
  (sem reset) quanto no QEMU (pinos não ligados a nada).
- **Estado elétrico dos pinos** — nível em memória não é tensão num pino:
  pull-up interno, corrente do LED, `active_low` físico, ruído e *bouncing*
  não são validados por nenhum caminho sem hardware.
- **Os 12 pinos de E/S ampliados na pinagem 8+8 nunca foram gravados.** Só os
  4 pinos originais da fatia vertical mínima têm qualquer histórico de
  gravação (via `esptool`/QEMU, não via navegador); os 12 pinos acrescentados
  pela spec 002 foram escolhidos fora das faixas de risco conhecidas, mas
  essa escolha nunca foi verificada em bancada.
