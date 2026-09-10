---
description: Fase 1 do SDD — cria uma especificação de feature a partir de uma descrição
argument-hint: "\"descrição curta da feature\""
---

Você está executando a **Fase 1 (Especificar)** do Spec-Driven Development do
LadderFlow. Ver `docs/workflow.md`.

Descrição da feature dada pelo usuário: **$ARGUMENTS**

## Passos

1. **Leia o contexto** (obrigatório, nesta ordem):
   - `docs/constitution.md`
   - `docs/context/architecture.md`, `tech-stack.md`, `glossary.md`, `constraints.md`
   - `docs/templates/spec-template.md`
   - As specs já existentes em `docs/specs/` (para não duplicar e para
     encadear dependências).

2. **Determine o número** `NNN`: o maior número de pasta em `docs/specs/`
   mais um, com três dígitos. Crie um slug curto em kebab-case a partir da
   descrição.

3. **Crie** `docs/specs/NNN-slug/spec.md` preenchendo **todas** as seções do
   template, em **português**.

4. Crie também, na mesma pasta, `plan.md` e `tasks.md` como *placeholders*
   (status "não iniciado", apontando para os templates e checklists), no estilo
   dos placeholders da spec 001.

## Regras

- **Não escreva nenhum código.** Não crie arquivos fora de `docs/specs/NNN-slug/`.
- A spec descreve **o quê / o porquê**, nunca **o como**. Proibido citar
  bibliotecas, frameworks, endpoints, esquemas de dados, nomes de arquivo de
  código, algoritmos.
- Requisitos funcionais numerados e testáveis; cada um com critério de aceitação
  em Dado/Quando/Então.
- Liste no topo os princípios (§) aplicáveis e preencha a seção de conformidade.
- Toda incerteza vira uma entrada no **Registro de decisões** (Q-n, status
  "aberta") — não invente a resposta.
- Respeite os limites de `constraints.md`: se a feature pedida sai do escopo do
  produto, diga isso claramente antes de gerar a spec.

## Ao terminar

- Mostre o caminho do arquivo criado e um resumo das seções.
- Liste as questões (Q-n) do **Registro de decisões** que precisam da decisão do usuário.
- Lembre: rode a checklist `docs/checklists/spec-review.md` e só depois de
  "spec aprovada" siga para `/planejar NNN`.
