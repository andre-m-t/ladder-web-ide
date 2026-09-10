# Tarefas NNN — <título da feature>

> **Status:** rascunho | em revisão | aprovado
> **Plano de origem:** `plan.md` (versão aprovada em <AAAA-MM-DD>)

Lista de execução. Cada tarefa é pequena (idealmente < 1 sessão de trabalho),
tem arquivos-alvo, dependências explícitas e um critério de pronto verificável.
A IA executa em ordem, marcando `[x]` ao concluir.

Regras:
- Tarefas sem dependência entre si podem ser feitas em qualquer ordem.
- Toda tarefa de código inclui seus testes (cf. §4 da constituição).
- Nenhuma tarefa introduz comportamento não descrito no `plan.md`.

---

## Fatia 1 — <nome da fatia vertical mínima>

- [ ] **#1 — <título>**
  - Arquivos: `caminho/arquivo`
  - Depende de: —
  - Pronto quando: <condição observável / teste que passa>

- [ ] **#2 — <título>**
  - Arquivos: `caminho/arquivo`
  - Depende de: #1
  - Pronto quando: ...

- [ ] **#3 — Testes da Fatia 1**
  - Arquivos: `caminho/testes`
  - Depende de: #1, #2
  - Pronto quando: CA-1 e CA-2 da spec cobertos e verdes.

## Fatia 2 — <nome>

- [ ] **#4 — <título>**
  - Arquivos: ...
  - Depende de: #3
  - Pronto quando: ...

---

## Rastreabilidade

| Tarefa | Requisito(s) | Critério(s) de aceitação |
|---|---|---|
| #1 | RF-1 | CA-1 |
| #2 | RF-2 | CA-2 |
