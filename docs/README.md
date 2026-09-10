# LadderFlow — Método de Desenvolvimento (Spec-Driven Development)

Esta pasta (`docs/`) contém todo o material que orienta o desenvolvimento do
**LadderFlow** conduzido por assistentes de IA. É **versionada no repositório**:
a rastreabilidade requisito → código é um princípio do projeto
([`constitution.md`](./constitution.md) §8) e as especificações são insumo
direto do capítulo de Desenvolvimento do TCC.

> O que **não** compõe o código-fonte para depósito no INPI (esta documentação,
> a configuração de ferramenta em `.claude/`, dependências de terceiros) é
> removido por `scripts/build-deposito.sh` ao gerar o pacote — não pelo
> controle de versão.

---

## O método: Spec-Driven Development (SDD)

A regra central: **a especificação vem antes do código.** Nada é implementado
sem uma spec aprovada. O trabalho avança em quatro fases, cada uma com uma
saída revisável e um portão de aprovação humana.

```
┌─────────────┐   ┌───────────┐   ┌──────────┐   ┌──────────────┐
│ ESPECIFICAR │ → │ PLANEJAR  │ → │ TAREFAS  │ → │ IMPLEMENTAR  │
│   spec.md   │   │  plan.md  │   │ tasks.md │   │    código    │
└─────────────┘   └───────────┘   └──────────┘   └──────────────┘
      o quê /          o como        passos          execução
      o porquê                    ordenados
```

| Fase | Comando | Entrada | Saída | Portão |
|---|---|---|---|---|
| Especificar | `/especificar <descrição>` | ideia de feature | `specs/NNN-slug/spec.md` | você aprova a spec |
| Planejar | `/planejar NNN` | `spec.md` aprovada | `specs/NNN-slug/plan.md` | você aprova o plano |
| Tarefas | `/tarefas NNN` | `plan.md` aprovado | `specs/NNN-slug/tasks.md` | você aprova as tarefas |
| Implementar | `/implementar NNN` | `tasks.md` aprovado | código + testes | revisão de PR |

Detalhes de cada fase e das regras de transição: [`workflow.md`](./workflow.md).

---

## Estrutura da pasta

```
docs/
├── README.md            Este arquivo
├── workflow.md          As 4 fases em detalhe e as regras de aprovação
├── constitution.md      Princípios de engenharia não-negociáveis do projeto
├── templates/           Modelos preenchidos em cada fase
│   ├── spec-template.md
│   ├── plan-template.md
│   └── tasks-template.md
├── context/             Contexto estável que a IA lê antes de cada fase
│   ├── architecture.md
│   ├── tech-stack.md
│   ├── glossary.md
│   └── constraints.md
├── checklists/          Verificações nos portões de aprovação
│   ├── spec-review.md
│   ├── plan-review.md
│   └── definition-of-done.md
└── specs/               Uma pasta por feature (NNN-slug)
    └── 001-fatia-vertical-minima/
        ├── spec.md      Exemplo preenchido — leia como referência
        ├── plan.md
        └── tasks.md
```

Os slash commands vivem em `.claude/commands/` (versionados no repositório).

---

## Como começar

1. Leia [`constitution.md`](./constitution.md) e [`context/`](./context/) uma vez.
2. Leia a spec de exemplo em
   [`specs/001-fatia-vertical-minima/spec.md`](./specs/001-fatia-vertical-minima/spec.md)
   para ver o formato esperado.
3. Para a próxima feature: `/especificar "descrição curta da feature"`.
4. Revise, aprove, e siga para `/planejar`, `/tarefas`, `/implementar`.

## Numeração das specs

Pastas em `specs/` seguem `NNN-slug` com `NNN` incremental de três dígitos
(`001`, `002`, …). O slug é curto, em minúsculas, com hífens. O comando
`/especificar` calcula o próximo número automaticamente.
