# Checklist — revisão de spec (portão da Fase 1 → 2)

Percorra antes de dizer "spec aprovada". Se algum item falhar, a spec volta
para ajuste.

## Conteúdo

- [ ] O **objetivo** está claro e cabe em um parágrafo.
- [ ] Descreve **o quê / o porquê**, nunca **o como**.
- [ ] **Nenhuma** menção a biblioteca, framework, endpoint, esquema de dados,
      nome de arquivo de código ou algoritmo.
- [ ] Todo requisito funcional (RF-n) é **testável** e **inequívoco**.
- [ ] Todo RF tem pelo menos um critério de aceitação (CA-n) em Dado/Quando/Então.
- [ ] Entradas inválidas e casos de erro têm comportamento especificado.
- [ ] A seção **Fora de escopo** lista o que o leitor razoavelmente esperaria.
- [ ] Dependências de specs anteriores e de recursos externos estão nomeadas.

## Alinhamento

- [ ] Coerente com `context/architecture.md` e `context/constraints.md`.
- [ ] Respeita cada princípio da `constitution.md` citado no topo; tensões estão
      explicadas e resolvidas.
- [ ] Não expande o escopo do produto além do permitido em `constraints.md`.
- [ ] O subconjunto da IEC 61131-3 tocado pela feature está **declarado**, não implícito (§3).

## Prontidão

- [ ] Todas as **Questões em aberto (Q-n)** foram respondidas ou explicitamente
      adiadas com dono e prazo.
- [ ] A feature pode ser entregue como uma ou mais **fatias verticais** (§2).
- [ ] Dá para escrever o `plan.md` sem voltar a adivinhar intenção.
