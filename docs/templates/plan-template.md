# Plano NNN — <título da feature>

> **Status:** rascunho | em revisão | aprovado
> **Spec de origem:** `spec.md` (versão aprovada em <AAAA-MM-DD>)
> **Autor:** <nome>  ·  **Data:** <AAAA-MM-DD>

Este documento descreve **o como**. Cada decisão aqui rastreia para um
requisito da `spec.md`.

---

## 1. Resumo da abordagem

Dois a quatro parágrafos: a estratégia técnica em alto nível e por que ela
atende à spec.

## 2. Reúso do que já existe

**Preencher antes de propor código novo.** O que já existe no repositório
(utilitários, componentes, padrões, tipos, endpoints) que será reaproveitado?
Cite caminhos. Se nada existe ainda (projeto novo), registre isso e descreva o
padrão que está sendo estabelecido para ser reusado depois.

## 3. Componentes afetados

| Componente | Caminho | Novo/alterado | Responsabilidade |
|---|---|---|---|
| ... | `frontend/src/...` | novo | ... |
| ... | `backend/app/...` | alterado | ... |

## 4. Decisões técnicas

Para cada decisão relevante:

### D-1: <decisão>
- **Escolha:** ...
- **Alternativas descartadas:** ... — por quê.
- **Requisito atendido:** RF-<n>.

## 5. Contratos (API / dados / mensagens)

Assinaturas de endpoints, formatos de payload, formatos de arquivo, eventos.
O suficiente para as duas pontas serem implementadas em paralelo.

## 6. Estratégia de testes

- **Unidade:** o quê.
- **Integração:** o quê (ex.: ST de exemplo → `iec2c` → binário).
- **Manual / hardware:** o que exige ESP32 físico e como validar.
- Mapeie cada critério de aceitação (CA-n) da spec a um teste.

## 7. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| ... | alto/médio/baixo | ... | ... |

## 8. Sequência de entrega em fatias

Ordem das fatias verticais, a primeira sendo a menor coisa testável de ponta a
ponta (cf. §2 da constituição).

1. Fatia 1: ...
2. Fatia 2: ...

## 9. Impacto na Constituição

Confirme aderência aos princípios citados na spec. Sinalize qualquer tensão
nova descoberta durante o planejamento.
