---
description: Fase 3 do SDD — quebra o plano aprovado em tarefas ordenadas
argument-hint: "NNN (número da spec)"
---

Você está executando a **Fase 3 (Tarefas)** do SDD do LadderFlow.
Ver `docs/workflow.md`.

Spec alvo: **$ARGUMENTS**

## Passos

1. **Confirme que o plano está aprovado.** Abra `docs/specs/NNN-*/plan.md`.
   Se não estiver aprovado, **pare** e peça para fechar a Fase 2.

2. **Leia:**
   - `docs/specs/NNN-*/plan.md` e a `spec.md` correspondente.
   - `docs/templates/tasks-template.md`
   - `docs/checklists/definition-of-done.md`

3. **Escreva** `docs/specs/NNN-*/tasks.md` seguindo o template, em português.

## Regras

- Agrupe por **fatia vertical**. A Fatia 1 é a menor coisa testável de ponta a
  ponta (§2).
- Cada tarefa: título, arquivo(s) alvo, `depende de: #N`, e um critério
  "Pronto quando" **verificável**.
- Tarefas de código incluem suas tarefas de teste (§4).
- Nenhuma tarefa introduz comportamento fora do `plan.md`.
- Preencha a tabela de rastreabilidade (tarefa → RF → CA).
- Tarefas pequenas: idealmente concluíveis em uma sessão.

## Ao terminar

- Mostre o caminho do `tasks.md` e a contagem de tarefas por fatia.
- Lembre: após "tarefas aprovadas", siga para `/implementar NNN`.
