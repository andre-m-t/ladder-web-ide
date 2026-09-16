# Spike S4 — tecnologia de renderização e modelo de dados do editor Ladder

> **Status:** concluído · **Data:** 2026-09-16 · **Spec:** 002 (em rascunho)
> **Insumo de:** `plan.md` da spec 002 (decisão técnica com alternativas descartadas)

O objetivo do spike foi decidir a tecnologia de renderização **com evidência, não
por preferência**, e fixar um modelo de dados da grade independente dela. A
biblioteca é substituível; o modelo não.

Material bruto, versionado e fora do pacote de depósito:

| Diretório | Conteúdo |
|---|---|
| `spikes/modelo/` | tipos, validação estrutural, as três fixtures como diagrama, 19 testes, experimento do blink (`NOTAS.md`) |
| `spikes/canvas-svg/` | protótipo em SVG puro + `MEDICOES.md` |
| `spikes/canvas-konva/` | protótipo em Konva (`react-konva`) + `MEDICOES.md` |

---

## 1. O que foi testado

As duas opções implementaram **o mesmo mínimo, sobre o mesmo contrato de modelo**
(copiado sem alteração): grade de 3 rungs × 6 colunas com trilhos, paleta com
contato NA e bobina, colocação por clique com regra de posição (bobina só na
última coluna, contato antes dela; clique inválido não altera o modelo e avisa),
botão "Ler estrutura" que imprime o JSON do diagrama, e teste de UI em jsdom que
coloca contato e bobina e confere o JSON. Ambos foram construídos, tipados,
testados e empacotados em contêiner `node:22-bookworm-slim`.

**React Flow não foi prototipado.** Descartado por argumento: é feito para grafos
de posicionamento livre (nós arrastáveis, arestas roteadas); o Ladder é grade
rígida com posições válidas explícitas, e cada regra da grade seria uma
restrição imposta *contra* a biblioteca.

## 2. Medições

| Critério | SVG puro | Konva |
|---|---|---|
| Linhas de código autoral (sem modelo e testes) | **213** | 325 |
| Tradução tela → célula no código | **0** (cada célula é elemento DOM com seu handler) | 0 no produto; o teste de UI teve de recalcular coordenadas de clique |
| Teste de UI em jsdom | **sem mock** | só com `canvas` (dependência nativa de desenvolvimento); duas tentativas de alias no Vite falharam |
| Teclado / leitor de tela | **Tab + Enter por célula, 12 linhas**; cada célula focável e nomeável | cursor lógico único (~30 linhas); células invisíveis a leitor de tela |
| Bundle JS (bruto / gzip) | **227 kB / 71 kB** | 569 kB / 174 kB (aviso de chunk > 500 kB) |
| Dependências de runtime novas | **nenhuma** | `konva` 9.3.22, `react-konva` 19.3.0 (MIT) |
| Atrito | desenhar o arco da bobina | quase todo o tempo em canvas × jsdom |

## 3. Decisão

**SVG puro renderizado pelo React.** Venceu em todos os critérios medidos, e o
Konva não trouxe vantagem observável em nenhum: a suposta ajuda com clique e
arrastar não se materializou numa grade de células discretas, porque o próprio
DOM resolve o *hit-test*. Os fatores de maior peso para este projeto:

1. **Testabilidade (§4).** O teste roda no jsdom que o front-end já usa, sem
   dependência nativa nova no ambiente de teste.
2. **Nenhuma dependência nova** (convenção de `tech-stack.md`; nada entra em
   `THIRD_PARTY.md`).
3. **Acessibilidade de graça.** Célula como elemento do DOM é focável e nomeável;
   no canvas, isso teria de ser reconstruído por fora.

Custo aceito: desenho dos símbolos (arco da bobina, ramos) é código nosso.

## 4. Modelo de dados

O contrato usado pelos dois protótipos passou pelo spike **sem alteração**:
grade endereçada por `(linha, coluna)` dentro de cada rung — linha 0 é o trilho
principal, linhas > 0 são ramos paralelos declarados como intervalo de colunas —,
elementos como união discriminada (contatos NA/NF, bobina, SET, RESET, CTU),
variável com endereço opcional (exigido por `minimal.st`, que usa variáveis
internas). Validação como funções puras (`posicaoValida`, `validarDiagrama`) com
seis códigos de problema. As três fixtures (`IO_ESPELHO`, `MINIMAL`, `BLINK`)
passam na validação; cada código tem caso negativo. Justificativa de grade em
vez de árvore série/paralelo em `spikes/modelo/NOTAS.md` §1.

## 5. Achados de risco

- **Blink com CTU não é equivalente ciclo a ciclo a `blink.st` — por
  construção.** CTU conta borda de subida; um booleano leva no mínimo 2 ciclos
  para produzir uma borda, logo não conta ciclos de varredura 1 a 1. Medido no
  `plc_host_runner` real contra `blink.toml` (50 ciclos): PV=13 → 1 divergência
  (ciclo 50, fase deslocada em 1 ciclo pelo reset atrasado); PV=12 → 2
  divergências. O ST derivado do Ladder compila no `iec2c`. Equivalência exata
  exigiria blocos de comparação/aritmética (ADD, GE), fora do modelo atual.
  Afeta a Q-4 da spec 002.
  - **Revisão aditiva (2026-09-16): o item acima está errado.** A
    investigação em `spikes/modelo/preset25/` mediu, em 200 ciclos e três
    padrões de entrada contra o `blink.st` executado (não o gabarito esparso),
    que a linha "por construção" não se sustenta: com PV=12, RESET do sinal
    de contagem ao atingir o limite (quebra a grade de paridade das bordas) e
    alternância do LED pelo limite atrasado 1 ciclo, o Ladder dá **0
    divergências**. Os números "1 divergência em 50 ciclos" também
    subestimavam o erro das variantes antigas, que em 200 ciclos chegam a
    21–22. Nenhum bloco ADD/GE é necessário. Consequência para o modelo: o
    CTU precisa de **entrada de reset** por caminho de contatos (Q-5).
- **SET e RESET da mesma variável no mesmo scan se anulam** quando os dois rungs
  leem a variável ao vivo. Comportamento correto de varredura sequencial, não
  bug do runtime; contornado com um rung de "instantâneo". Um toggle com ramo
  paralelo e bobina comum (`led := (atingiu AND NOT led) OR (NOT atingiu AND
  led)`) evitaria o problema e deve ser o desenho preferido. Relevante para a
  Q-6 (bobinas repetidas na mesma variável) e para a validação.
