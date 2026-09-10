---
description: Fase 4 do SDD — executa as tarefas aprovadas, escrevendo código e testes
argument-hint: "NNN (número da spec) [#N tarefa específica, opcional]"
---

Você está executando a **Fase 4 (Implementar)** do SDD do LadderFlow.
Ver `docs/workflow.md`.

Alvo: **$ARGUMENTS**

## Passos

1. **Confirme que as tarefas estão aprovadas.** Abra `docs/specs/NNN-*/tasks.md`.
   Se não estiver aprovado, **pare** e peça para fechar a Fase 3.

2. **Leia:**
   - `docs/specs/NNN-*/tasks.md`, `plan.md` e `spec.md`.
   - `docs/constitution.md`
   - `docs/checklists/definition-of-done.md`
   - O `CLAUDE.md` da raiz, se existir.

3. **Execute as tarefas em ordem**, respeitando `depende de:`. Se o usuário
   indicou uma tarefa específica (`#N`), faça só ela e suas dependências ainda
   pendentes. Uma tarefa por vez:
   - Implemente o código.
   - Escreva/atualize os testes.
   - Verifique a Definition of Done (por tarefa).
   - Marque o item como `[x]` no `tasks.md` e relate o progresso.

4. Ao fim de cada **fatia**, verifique a Definition of Done (por feature) na
   parte aplicável e rode os testes da fatia.

## Regras

- **Não improvise mudança de escopo.** Se encontrar uma decisão não coberta
  pela spec/plano, **pare e pergunte** — ou volte à fase correspondente e
  atualize o documento.
- Código novo imita o estilo da vizinhança (§11). Prefira reúso.
- Respeite §3 (ST válido no `iec2c`), §5 (cliente sem instalação),
  §6 (servidor só compila), §7 (contexto seguro, sem contornos), §10 (`iec2c`
  como processo externo, isolado num adaptador).
- Cada commit referencia `spec NNN` e `tarefa #N` (§8). Só faça commit/push se
  o usuário pedir; se estiver na branch `main`, crie uma branch antes.
- Sem segredos ou caminhos absolutos de máquina no diff.

## Ao terminar

- Resuma o que foi implementado, tarefas marcadas, testes rodados (com
  resultado real — se algo falhou, diga).
- Liste o que ficou pendente e por quê.
