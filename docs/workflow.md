# Workflow SDD — as quatro fases

Este documento descreve em detalhe cada fase do Spec-Driven Development do
LadderFlow, o que produz, quem aprova e quando é permitido avançar.

**Princípio inegociável:** nenhuma fase começa antes de a fase anterior ter
sido **aprovada explicitamente por você** (o autor). A IA nunca pula portões.

---

## Fase 1 — Especificar (`/especificar`)

**Objetivo:** definir *o quê* e *o porquê*, sem decidir *como*.

**A IA faz:**
1. Lê `constitution.md`, `context/*.md` e `templates/spec-template.md`.
2. Determina o próximo número `NNN` olhando `specs/`.
3. Cria `specs/NNN-slug/spec.md` preenchendo o template.
4. Lista as questões (Q-n) do "Registro de decisões" que precisam da sua decisão.

**A IA NÃO faz:** citar bibliotecas, esquemas de dados, endpoints, nomes de
arquivos de código, ou qualquer decisão de implementação.

**Portão:** você revisa com `checklists/spec-review.md`. Ajusta as questões em
aberto. Só quando disser "spec aprovada" é que a Fase 2 pode começar.

---

## Fase 2 — Planejar (`/planejar NNN`)

**Objetivo:** definir *o como*.

**A IA faz:**
1. Lê a `spec.md` aprovada, `constitution.md`, `context/*.md` e
   `templates/plan-template.md`.
2. **Procura primeiro o que já existe** no repositório — utilitários, padrões,
   componentes — e prefere reúso a código novo.
3. Cria `specs/NNN-slug/plan.md`: abordagem, componentes afetados (com
   caminhos), decisões técnicas com alternativas descartadas, contratos de
   API/dados, riscos, estratégia de testes, sequência de entrega em fatias.

**Portão:** você revisa com `checklists/plan-review.md`. Aprovação explícita
libera a Fase 3.

---

## Fase 3 — Tarefas (`/tarefas NNN`)

**Objetivo:** quebrar o plano em passos executáveis e ordenados.

**A IA faz:**
1. Lê `plan.md` e `templates/tasks-template.md`.
2. Cria `specs/NNN-slug/tasks.md`: lista `- [ ]` numerada, agrupada por fase de
   entrega, cada item com arquivo(s) alvo, dependências (`depende de: #N`) e um
   critério de pronto verificável.
3. A primeira fatia deve ser vertical e a menor possível que entregue valor
   testável de ponta a ponta.

**Portão:** você aprova a lista. Pode reordenar, cortar ou adicionar itens.

---

## Fase 4 — Implementar (`/implementar NNN`)

**Objetivo:** escrever o código, seguindo as tarefas.

**A IA faz:**
1. Lê `tasks.md`, `constitution.md` e `checklists/definition-of-done.md`.
2. Executa as tarefas **em ordem**, uma por vez, respeitando dependências.
3. Marca cada item como `[x]` ao concluí-lo e informa o progresso.
4. Para cada tarefa: implementação + testes + verificação da Definition of Done.
5. Para e pede orientação se encontrar uma decisão não coberta pela spec/plano
   (não improvisa mudança de escopo).
6. **Atualiza `.claude/state.md`** ao fim da rodada, no mesmo commit da mudança
   (ver "Painel de estado", abaixo).

**Portão:** revisão de código / PR. Todo commit referencia `spec NNN` e o número
da tarefa (ver princípio de rastreabilidade na `constitution.md`).

---

## Quando a realidade diverge da spec

Se durante o plano ou a implementação ficar claro que a spec está errada ou
incompleta: **pare, volte à fase correspondente, atualize o documento e
re-aprove.** Não se "conserta no código". O conjunto spec → plano → tarefas
deve permanecer a descrição fiel do que foi construído — é ele que dá
rastreabilidade ao projeto e serve de base para a documentação do TCC.

## Caminho curto

O ciclo de quatro fases é obrigatório para **fatias verticais** e para qualquer
mudança que altere o comportamento observável do produto. O cronograma do
projeto é curto — mudanças pequenas e de baixo risco seguem o **caminho curto**,
sem specs nem portões de fase.

### Critério de decisão (objetivo)

Responda a **uma** pergunta:

> A mudança altera comportamento observável por um usuário, um contrato de API,
> um formato de dados/arquivo, ou cria uma capacidade nova?

- **Sim** → ciclo completo (`spec → plan → tasks → código`).
- **Não** → caminho curto.
- **Na dúvida** → trate como "Sim".

### O que se enquadra no caminho curto

- Correção de bug que **restaura** o comportamento já especificado (sem alterá-lo).
- Ajuste de estilo, formatação, lint; renomeações internas.
- Refatoração sem mudança de comportamento observável.
- Atualização de documentação, comentários, textos do README.
- Bump de dependência sem mudança de contrato.
- Ajuste de configuração de build/infra sem efeito no comportamento do produto.

### Registro mínimo exigido

1. **Mensagem de commit** que diz o *quê* e o *porquê* (1–3 linhas).
2. Para correção de bug: um **teste de regressão** (§4 continua valendo).
3. Se a mudança toca comportamento já descrito em uma spec ou em `context/`,
   **atualize o documento correspondente no mesmo commit**.
4. **Atualize `.claude/state.md` no mesmo commit** — o caminho curto dispensa
   specs, não dispensa o painel de estado.
5. Não é necessário criar `spec.md` / `plan.md` / `tasks.md`.

Não há portão de aprovação por fases no caminho curto — a revisão acontece no
PR/commit. O commit ainda referencia o contexto (issue, bug, ou a spec cujo
comportamento estava sendo restaurado), conforme §8.

## Painel de estado — `.claude/state.md`

`.claude/state.md` é a fotografia em tempo real do projeto: features e seus
status, o que falta em cada uma, decisões em aberto, próximos passos em ordem e
histórico de rodadas. É o primeiro arquivo a ler ao retomar o trabalho e o
último a escrever ao encerrá-lo.

**É obrigatório atualizá-lo em toda rodada, no mesmo commit da mudança** — nas
quatro fases e também no caminho curto. Não há rodada pequena demais: se algo
mudou de estado, o painel muda junto.

O que revisar, ao fim de cada rodada:

1. Status (✅/🟡/⬜/🔒) das features tocadas, e o conteúdo de "Concluído"/"Falta"
2. "Última atualização" e "Branch ativa"
3. "Histórico de rodadas" — uma linha por rodada
4. "Próximos passos" — remover o que foi feito, repriorizar o resto
5. "Decisões em aberto" — Q-n decidida sai da tabela e reflete na feature afetada

A razão é a mesma que sustenta todo este método: o conjunto de documentos precisa
permanecer a descrição fiel do que foi construído, porque é ele que dá
rastreabilidade ao projeto e serve de base para a documentação do TCC. Um painel
desatualizado é pior que nenhum — é lido como verdade.
