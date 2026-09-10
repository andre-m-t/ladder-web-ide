# Plano 001 — Fatia vertical mínima

> **Status:** não iniciado
> **Spec de origem:** [`spec.md`](./spec.md) — ainda em rascunho

---

⏳ **Este plano ainda não foi escrito.**

Pré-requisitos antes de preencher:

1. A [`spec.md`](./spec.md) deve estar **aprovada**. As questões que governam o
   contrato de API já estão decididas (2026-09-10): **Q-3** (envelope de erro com
   `stage`, `diagnostics` e `raw`) e **Q-6** (compilação síncrona), junto com
   **Q-1** e **Q-5** (ST canônico e pinagem fixa, materializados em
   `backend/firmware/esp32-template`). **Q-4** foi medida no
   ambiente containerizado (build frio 66 s, incremental 11–13 s). Continua
   **aberta** e é pré-requisito deste plano apenas **Q-2** (limite de tamanho do
   corpo da requisição).
2. Rodar `/planejar 001` (ou seguir a Fase 2 de [`../../workflow.md`](../../workflow.md)).

O conteúdo deve seguir [`../../templates/plan-template.md`](../../templates/plan-template.md)
e passar por [`../../checklists/plan-review.md`](../../checklists/plan-review.md).
