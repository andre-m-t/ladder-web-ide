---
description: Fase 2 do SDD — cria o plano técnico a partir de uma spec aprovada
argument-hint: "NNN (número da spec)"
---

Você está executando a **Fase 2 (Planejar)** do SDD do LadderFlow.
Ver `docs/workflow.md`.

Spec alvo: **$ARGUMENTS**

## Passos

1. **Confirme que a spec está aprovada.** Abra `docs/specs/NNN-*/spec.md`. Se
   o status não for "aprovada" ou houver questões do Registro de decisões ainda abertas,
   **pare** e peça ao usuário para fechar a Fase 1 primeiro.

2. **Leia o contexto:**
   - A `spec.md` alvo (inteira).
   - `docs/constitution.md`
   - `docs/context/*.md`
   - `docs/templates/plan-template.md`
   - `docs/checklists/plan-review.md`

3. **Procure o que já existe** no repositório antes de propor código novo:
   utilitários, componentes, tipos, padrões, endpoints. Use busca ampla.
   Registre os achados (com caminhos) na seção "Reúso do que já existe". Se o
   projeto ainda não tem código para a área, diga isso e descreva o padrão que
   está sendo estabelecido.

4. **Escreva** `docs/specs/NNN-*/plan.md` seguindo o template, em português.

## Regras

- Toda decisão técnica (D-n) rastreia para um requisito (RF-n) da spec.
- Todo critério de aceitação (CA-n) precisa aparecer na estratégia de testes.
- **Não introduza comportamento que não está na spec.** Se descobrir que a spec
  está incompleta/errada, pare, volte à Fase 1, atualize a `spec.md` e re-aprove.
- Respeite a separação cliente/servidor (§6) e o isolamento do `iec2c` (§10).
- Prefira a solução mais simples que atende à spec (§11); sem dependência nova
  sem justificativa.
- Ainda **não escreva código** — só o plano.

## Ao terminar

- Mostre o caminho do `plan.md` e um resumo das decisões e riscos.
- Rode mentalmente a `plan-review.md` e reporte itens que ainda não fecham.
- Lembre: após "plano aprovado", siga para `/tarefas NNN`.

## Painel de estado

Toda questão Q-n decidida nesta fase sai da tabela "Decisões em aberto" de
`.claude/state.md` e passa a constar na feature afetada. Atualize o painel ao
fim da fase. Ver "Painel de estado" em `docs/workflow.md`.
