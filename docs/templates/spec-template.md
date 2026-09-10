# Spec NNN — <título da feature>

> **Status:** rascunho | em revisão | aprovada
> **Autor:** <nome>  ·  **Data:** <AAAA-MM-DD>
> **Princípios aplicáveis:** <ex.: §2, §3, §5>

Esta especificação descreve **o quê** e **o porquê**. Não descreve *como*.
É proibido citar: bibliotecas, frameworks, nomes de arquivos de código,
esquemas de banco, endpoints, estruturas de dados, algoritmos. Isso é papel do
`plan.md`.

---

## 1. Objetivo e contexto

Um a três parágrafos. Qual problema esta feature resolve? Como ela se encaixa
no fluxo geral do LadderFlow (editar → simular → gravar)? Por que agora?

## 2. Usuários e cenário de uso

Quem usa esta feature (ex.: estudante de automação, professor em laboratório) e
em que situação. Descreva o cenário concreto de ponta a ponta, em linguagem de
usuário.

## 3. Histórias de usuário

- Como **<papel>**, quero **<ação>**, para **<benefício>**.
- Como ...

## 4. Requisitos funcionais

Numerados e testáveis. Cada um deve poder virar um critério de aceitação.

- **RF-1.** O sistema deve ...
- **RF-2.** Quando <condição>, o sistema deve ...
- **RF-3.** O sistema deve recusar <entrada inválida> com <mensagem>.

## 5. Critérios de aceitação

Para cada requisito, a condição observável de sucesso. Formato Dado/Quando/Então.

- **CA-1 (RF-1).** Dado <estado inicial>, quando <ação>, então <resultado observável>.
- **CA-2 (RF-2).** ...

## 6. Requisitos não-funcionais

Só os que importam para esta feature: desempenho, limites de tamanho,
compatibilidade de navegador, tempo de resposta, mensagens de erro.

## 7. Fora de escopo

Lista explícita do que esta spec **não** cobre — inclusive itens que o leitor
poderia razoavelmente esperar. Aponte para specs futuras quando fizer sentido.

## 8. Dependências

- Specs anteriores das quais esta depende: <NNN>.
- Recursos externos: <ex.: MATIEC no contêiner, ESP32 físico para teste>.

## 9. Registro de decisões

Decisões que precisam do autor antes da aprovação. Um bloco por questão; as
entradas **permanecem visíveis após decididas** — o histórico é parte da
rastreabilidade (§8).

### Q-1 — <rótulo curto>
- **Enunciado:** ...
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

### Q-2 — <rótulo curto>
- **Enunciado:** ...
- **Status:** aberta
- **Data da decisão:** —
- **Decisão:** —
- **Justificativa:** —

## 10. Conformidade com a Constituição

Marque como esta spec respeita cada princípio aplicável (§ citados no topo).
Se algum princípio for tensionado, explique e proponha a resolução.
