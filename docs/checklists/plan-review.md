# Checklist — revisão de plano (portão da Fase 2 → 3)

Percorra antes de dizer "plano aprovado".

## Rastreabilidade

- [ ] Cada decisão técnica (D-n) rastreia para um requisito (RF-n) da spec.
- [ ] Todo critério de aceitação (CA-n) da spec tem um teste correspondente na
      estratégia de testes.
- [ ] Nada no plano introduz comportamento que não está na spec (se precisa,
      volte e atualize a spec).

## Reúso e simplicidade

- [ ] A seção **Reúso do que já existe** foi preenchida antes de propor código novo.
- [ ] Utilitários/componentes/padrões existentes foram procurados e citados por caminho.
- [ ] Nenhuma dependência nova sem justificativa explícita.
- [ ] A solução é a mais simples que atende à spec (§11) — sem generalização especulativa.

## Arquitetura

- [ ] Respeita a separação cliente/servidor (§6): servidor só compila, cliente não compila.
- [ ] Contratos (API/dados/mensagens) estão completos o suficiente para as duas
      pontas serem implementadas em paralelo.
- [ ] A fronteira com o `iec2c` está isolada em um único módulo adaptador (§10).
- [ ] Contexto seguro / Web Serial tratados corretamente (§7); sem contornos.

## Entrega e risco

- [ ] A **Fatia 1** é a menor coisa testável de ponta a ponta.
- [ ] Riscos com impacto alto têm mitigação concreta.
- [ ] Itens que exigem ESP32 físico estão identificados.
- [ ] Dá para escrever `tasks.md` a partir daqui sem novas decisões de design.
