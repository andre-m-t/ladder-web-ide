# Medições — Spike S4, protótipo "canvas-svg" (SVG puro)

Protótipo descartável: editor Ladder mínimo renderizado com React gerando
`<svg>` diretamente, sem biblioteca de canvas. Comparar com o irmão
`spikes/canvas-konva/` (Konva), mesmos critérios.

Todas as medições abaixo foram tiradas rodando, a partir da raiz do
repositório:

```bash
docker run --rm -v "$(pwd)/spikes/canvas-svg:/w" -w /w node:22-bookworm-slim \
  sh -c "npm install && npx tsc --noEmit && npx vitest run && npx vite build"
```

`npm install`, `tsc --noEmit`, `vitest run` (2 testes) e `vite build` passaram
sem erro nem aviso.

## 1. Linhas de código autoral (src/, excluindo `modelo.ts` e testes)

| Arquivo | Linhas |
|---|---:|
| `src/App.tsx` | 203 |
| `src/main.tsx` | 9 |
| `src/setupTests.ts` | 1 |
| **Total** | **213** |

(`wc -l src/App.tsx src/main.tsx src/setupTests.ts`.)

## 2. Pontos de tradução coordenada de tela ↔ célula

**Zero.** `grep` por `clientX`, `clientY`, `getBoundingClientRect`, `offsetX`,
`offsetY`, `Math.floor` em `src/App.tsx` não retornou nenhuma ocorrência.

Motivo estrutural: cada célula é o seu próprio elemento SVG (`<g>` dentro de
um `.map` sobre `rung.colunas`), com `onClick`/`onKeyDown` fechando sobre
`(rungIndex, coluna)` já conhecidos em tempo de renderização
(`App.tsx:154-166`). O hit-testing "que célula foi clicada" é feito pelo
próprio navegador (DOM event target), não por código nosso — não existe
conversão de pixel de clique para índice de célula.

O único cálculo geométrico existente é o **inverso**, célula → pixel, para
posicionar cada `<rect>`/`<line>` (`cx = xEsq + coluna * CELL_W`, `y = MARGEM_TOPO
+ rungIndex * ESPACO_ENTRE_RUNGS`, em `App.tsx:139-141` e `App.tsx:153`); isso é
necessário em qualquer abordagem (SVG, Canvas ou Konva) para desenhar a grade, e
não é a mesma coisa que traduzir um clique de volta para célula.

## 3. jsdom sem mocks especiais?

**Sim.** Nenhum mock foi necessário. `vitest` com `environment: 'jsdom'` mais
`@testing-library/react` e `@testing-library/user-event` bastaram; `user-event`
disparou `click` e `keydown` em elementos `<g>`/`<rect>` SVG normalmente. Não
foi preciso mockar `getBBox`, `ResizeObserver`, `getComputedStyle` nem nada
específico de canvas/WebGL — porque não há canvas nem WebGL, é DOM comum.

## 4. Acessibilidade: foco por Tab + colocação por Enter

**Implementado**, coube em bem menos que o orçamento de ~30 linhas:

- 4 linhas de atributos JSX na célula: `tabIndex={0}`, `role="button"`,
  `aria-label={...}`, `onKeyDown={...}` (`App.tsx:157-161`).
- 8 linhas para o handler `handleTeclaCelula` (com comentário) que trata
  `Enter`/`Espaço` chamando a mesma função `colocarElemento` do clique
  (`App.tsx:90-97`).

Total: **12 linhas**. Custo baixo porque SVG (`<g>`) aceita `tabIndex` e
recebe eventos de teclado como qualquer elemento DOM em navegadores modernos e
em jsdom; não houve necessidade de nenhuma biblioteca de acessibilidade. Teste
de regressão cobrindo isso em `src/App.test.tsx` (`coloca elemento por teclado
(Tab + Enter)`), usando `celula.focus()` + `user.keyboard('{Enter}')`.

## 5. Tamanho do bundle (`vite build`)

```
dist/index.html                  0.35 kB │ gzip:  0.26 kB
dist/assets/index-Ba7qcxUu.js  227.28 kB │ gzip: 70.94 kB
```

JS gerado: **227.28 kB bruto / 70.94 kB gzip** (dominado por React 19 +
ReactDOM; o código do protótipo em si é ~5 kB dos 227 kB).

## 6. Dependências de runtime novas e licenças

Nenhuma além do que o `frontend/` já usa:

| Pacote | Versão | Licença |
|---|---|---|
| `react` | ^19.0.0 | MIT |
| `react-dom` | ^19.0.0 | MIT |

Nenhuma biblioteca de canvas/desenho foi adicionada (esse é o ponto do
protótipo). Dependências de build/teste (`vite`, `vitest`, `typescript`,
`@testing-library/*`, `jsdom`, `@vitejs/plugin-react`) são as mesmas classes de
dependência de dev já presentes em `frontend/package.json`, todas MIT.

## 7. Tempo gasto / atritos percebidos

Qualitativo: implementação direta, sem surpresas. O modelo mental "cada célula
é um elemento DOM com seu próprio handler" eliminou de saída qualquer código
de picking geométrico — o principal atrito esperado em uma abordagem de
canvas. O único ajuste fino foi desenhar os símbolos de contato/bobina com
`<line>`/`<path>` (arco de circunferência via SVG path `A`), que exige lembrar
a sintaxe de arco do SVG, mas é cerca de 4 linhas e não se repete por
elemento novo (é só uma função de desenho por tipo). Acessibilidade por
teclado "veio de graça" por os elementos serem DOM nativo. Nenhum atrito com
jsdom/testes.

## 8. Esboço: ramo paralelo (linha 1, colunas 1–3)

Sem implementar (fora do mínimo do spike). Como ficaria, no mesmo modelo de
"um elemento DOM por célula":

```tsx
// dentro do .map de rungs, além da linha 0 (linha principal):
{rung.ramos.map(ramo => (
  <RenderizarLinhaDeRamo key={ramo.id} y={y + LINHA_ALTURA * ramo.linha}
    colunaInicio={ramo.colunaInicio} colunaFim={ramo.colunaFim} />
  // + duas <line> verticais conectando a linha do ramo à linha principal
  // nas colunas colunaInicio e colunaFim, e repetir o .map de células
  // (mesma função encontrarElemento/colocarElemento) com linha: ramo.linha
))}
```

O ganho da abordagem SVG se mantém: cada célula do ramo continua sendo um
`<g>` independente com seu próprio handler, então a lógica de clique/teclado
já escrita para a linha 0 se reaplica sem tradução de coordenadas adicional —
só muda o `y` de renderização e o `celula.linha` gravado no elemento.
