# Medições — spike S4, protótipo Konva (react-konva)

Protótipo descartável em `spikes/canvas-konva/`, feito para comparar com o
protótipo paralelo em SVG puro sob os mesmos critérios. Todos os comandos
abaixo rodaram em `node:22-bookworm-slim` em contêiner avulso (Regra 5), sem
publicar porta, a partir da raiz do worktree:

```bash
docker run --rm -v "$(pwd)/spikes/canvas-konva:/w" -w /w node:22-bookworm-slim \
  sh -c "npm install && npx tsc --noEmit && npx vitest run && npx vite build"
```

Rodou de ponta a ponta sem erro (ver item 3 para o que precisou de ajuste no
caminho até chegar lá).

## 1. Linhas de código autoral em `src/` (exclui `modelo.ts` e testes)

```
223  src/App.tsx
 18  src/layout.ts
 13  src/main.tsx
 71  src/regras.ts
325  total
```

Medido com `wc -l`. `regras.ts` (lógica de colocação, pura) ficou separado de
`App.tsx` (grade Konva + paleta + navegação por teclado) deliberadamente —
ver item 3.

## 2. Pontos de tradução tela ↔ célula

**Um único ponto, e só num sentido** (célula → tela): `src/layout.ts`, funções
`xDaColuna(coluna)` e `yDoRung(indiceRung)` (18 linhas ao todo, comentário
incluído). É usado tanto para posicionar as formas Konva quanto para desenhar
o retângulo de foco do teclado.

**Não existe tradução no sentido inverso** (tela → célula) em código de
produção. Cada `<Rect>` de célula já nasce com sua própria `(rung, coluna)`
fechada no `onClick` (closure em `RungView`, `src/App.tsx`); o hit-test do
Konva resolve "qual forma foi clicada" internamente (via canvas de hit
offscreen) e entrega o clique já à forma certa — o app nunca precisa calcular
"que célula fica em x=234,y=87". Isso é uma diferença estrutural relevante
frente a uma abordagem só-DOM/SVG com um único listener delegado: lá a
tradução costuma ser explícita (`Math.floor(x / larguraCelula)`); aqui ela é
implícita, delegada à biblioteca.

O teste de UI (`src/App.test.tsx`) precisou, por sua vez, calcular manualmente
o centro de cada célula em coordenadas de tela (`centroDaCelula`, reaproveita
`xDaColuna`/`yDoRung`) para simular cliques via `fireEvent` no `<canvas>` — ou
seja, o teste reintroduz a tradução célula→tela que o app evita ter que fazer
no sentido inverso, porque simular um clique físico exige a posição, não a
identidade, do alvo.

## 3. O teste roda em jsdom sem mocks especiais?

**Não.** Precisou de um pacote real a mais (não foi um mock manual). Registro
do caminho até a solução, porque foi o ponto que mais custou tempo do spike:

1. `npm install` (react, react-dom, konva, react-konva, vite, vitest, jsdom,
   testing-library) rodou limpo, sem `canvas` na árvore de dependências.
2. `npx tsc --noEmit` passou sem erro.
3. `npx vitest run` falhou já no `App.test.tsx` com
   `Error: Cannot find module 'canvas'` apontando para
   `node_modules/konva/lib/index-node.js:4`. Causa: o `package.json` do
   `konva` declara `"main": "./lib/index-node.js"` (que faz
   `require('canvas')`) e `"browser": "./lib/index.js"` (que não precisa);
   o Vitest roda o teste em processo Node e resolve pelo campo `main`.
4. Duas tentativas de contornar **sem** instalar `canvas` não funcionaram:
   - `resolve.alias: { konva: 'konva/lib/index.js' }` no `vitest.config.ts`:
     sem efeito — o Vitest trata `konva` como dependência externa e usa
     `require()` nativo do Node para o pacote raiz, que ignora alias do Vite.
   - Adicionar `ssr: { noExternal: ['konva', 'react-konva'] }` para forçar as
     duas a passar pelo resolvedor do Vite: mudou o erro, mas quebrou um
     import profundo do próprio `react-konva`
     (`import Konva from 'konva/lib/Core.js'` em
     `react-konva/es/ReactKonvaCore.js`), que passou a falhar com
     "Failed to resolve import... Does the file exist?" mesmo o arquivo
     existindo em disco.
5. O que de fato funcionou: `npm install --save-dev canvas` (resolveu
   `canvas@3.2.3`, MIT). A imagem `node:22-bookworm-slim` **não** tem
   toolchain de compilação (sem `gcc`/`python3`/`cairo-dev`), mas o pacote
   trouxe um binário pré-compilado via `prebuild-install` para
   `linux-x64`/Node 22 — instalação levou segundos, sem compilar nada local.
   Isso resolve dois problemas ao mesmo tempo: (a) o `require('canvas')` de
   `index-node.js` passa a resolver por resolução comum de `node_modules`,
   sem tocar em config nenhuma do Vite; (b) o jsdom (que sozinho retorna
   `null` de `HTMLCanvasElement.getContext('2d')`) passa a delegar a esse
   mesmo pacote para implementar o contexto 2D dos `<canvas>` que o Konva
   cria — sem essa segunda parte, o teste até rodaria mas o Konva quebraria
   ao tentar desenhar.
6. Com `canvas` instalado, `vitest.config.ts` voltou a ficar simples (sem
   alias, sem `ssr.noExternal`) e os 7 testes passaram, incluindo os 3 que
   simulam clique real no `<canvas>` renderizado (`src/App.test.tsx`).
7. Ruído inofensivo no console durante os testes: `Fontconfig error: Cannot
   load default config file` (o `node-canvas` tentando carregar fontes do
   sistema para medir texto). Não derruba nenhum teste; ignorado aqui porque
   os testes não fazem asserção sobre texto renderizado no canvas em si (o
   texto de rótulo do elemento é lido via JSON do modelo, não via pixel).

Conclusão prática: **testar via UI real (clique físico no canvas) é viável**,
mas custa uma dependência nativa a mais (ainda que binária pré-compilada, sem
custo de build) só para o ambiente de teste — ela não entra no bundle de
produção (`vite build` não a inclui; é `devDependency`). A lógica de negócio
(`regras.ts`) também tem teste próprio, independente de DOM/canvas, e teria
sido suficiente sozinha se `canvas` não desse certo.

## 4. Acessibilidade: foco e colocação por teclado

**Deu**, mas não "de graça": formas Konva não entram na árvore de foco do DOM
(um `<Rect>` não é um elemento focável, não tem `tabIndex` próprio, não
aparece para leitor de tela como item de grade). A solução foi um cursor de
foco lógico, não uma navegação real célula-a-célula por Tab:

- `tabIndex={0}` + `role="grid"` no `<div>` que envolve a `<Stage>` inteira —
  **um único** parada de Tab para a grade toda (não 18 paradas, uma por
  célula).
- Estado `foco: { rung, coluna }` + `onKeyDown` com as 4 setas movendo esse
  cursor (clampado nos limites) e Enter/Espaço chamando a mesma função
  `colocar(...)` que o clique do mouse usa.
- Realce visual do cursor: a célula em foco recebe `stroke`/`strokeWidth`
  diferentes (comparação `foco.rung === indiceRung && foco.coluna === coluna`
  passada como prop até `CelulaView`).

Custo: ~30 linhas junto (a função `aoTeclarNaGrade` tem 24 linhas; a
plumbing de `foco`/`emFoco` até a célula soma mais ~10 linhas espalhadas em
`RungView`/`CelulaView`). Coube no orçamento sugerido de ~30 linhas.

Testado em `src/App.test.tsx` (`'coloca elemento por teclado...'`): foca a
grade, dispara `ArrowRight` 5×, depois `Enter`, confere que a bobina caiu em
`(0,5)`.

O que o canvas **não permite**, mesmo com esse contorno:
- Não há 18 (3 rungs × 6 colunas) elementos DOM focáveis individualmente —
  então não existe navegação real por Tab entre células (só Tab para
  "entrar" na grade inteira, depois setas). Um teclado que dependa de Tab
  puro (sem usar setas) não navega célula a célula.
- Não há papel/nome acessível por célula para leitor de tela (ex.:
  "célula linha 1, coluna 3, vazia" ou "contato NA"). Um leitor de tela vê
  um único `<div role="grid">` com um `<canvas>` opaco dentro — o conteúdo
  visual (retângulos, texto do elemento) não é exposto à árvore de
  acessibilidade a menos que se implemente isso à mão via `aria-live`,
  `aria-activedescendant` ou um DOM paralelo espelhando o estado (Konva tem
  suporte experimental a isso, não usado aqui por estourar o orçamento do
  spike).

## 5. Tamanho do bundle (`vite build`)

```
dist/assets/index-CFZXOrwh.js  569.04 kB │ gzip: 174.46 kB
dist/index.html                  0.34 kB │ gzip:   0.26 kB
```

Vite avisa que o chunk passa de 500 kB (sugestão de `manualChunks`/
`dynamic import`, não aplicado — fora do escopo do mínimo do spike). Todo o
peso vem de `konva` + `react-konva` + `react-dom`; não há mais nada
empacotado.

## 6. Dependências de runtime novas e licenças

| Pacote | Versão resolvida | Licença | Uso |
|---|---|---|---|
| `react` | 19.3.0 | MIT | já era dependência do projeto principal |
| `react-dom` | 19.3.0 | MIT | idem |
| `konva` | 9.3.22 | MIT | **nova** — motor de canvas |
| `react-konva` | 19.3.0 | MIT | **nova** — binding React↔Konva |

Só em desenvolvimento (não entra no bundle, `devDependency`):

| Pacote | Versão | Licença | Uso |
|---|---|---|---|
| `canvas` | 3.2.3 | MIT | backend 2D para `<canvas>` em jsdom (ver item 3) |

Nenhuma das quatro é copiada para dentro do repositório (ficam em
`node_modules`, fora do controle de versão); registro aqui é só para a
decisão do spike, não é uma entrada de `THIRD_PARTY.md` (isso só se aplica se
a tecnologia vencedora for adotada no `frontend/` de fato).

## 7. Tempo gasto / atritos percebidos

A grade, a paleta e a regra de colocação (`regras.ts` + a parte de desenho de
`App.tsx`) foram rápidas de escrever — o contrato `modelo.ts` já vinha pronto
e o Konva não exigiu nenhuma tradução manual de coordenada de clique (item 2).
A maior parte do tempo do spike foi gasta diagnosticando o problema de
`canvas`/jsdom do item 3 (duas tentativas de contorno via config do Vite que
não funcionaram, antes de instalar o pacote `canvas`). Sem esse atrito, a
implementação em si (mínimo pedido) é pequena — 325 linhas — e direta.
Atrito secundário menor: o Konva não tem suporte "de fábrica" nenhum a
foco/teclado (item 4), diferente de elementos DOM nativos.

## 8. Esboço: como adicionar um ramo paralelo (linha 1, colunas 1–3)

Não implementado (fora do mínimo do spike); esboço de como ficaria dentro de
`RungView` (`src/App.tsx`), reaproveitando `xDaColuna`:

```tsx
for (const ramo of rung.ramos) {
  const yRamo = y + ALTURA_CELULA * ramo.linha // uma "pista" abaixo do trilho principal
  // conector vertical (entrada/saída do ramo) + trilho horizontal do ramo:
  <Line points={[xDaColuna(ramo.colunaInicio), y, xDaColuna(ramo.colunaInicio), yRamo]} stroke="#333" />
  <Line points={[xDaColuna(ramo.colunaFim), y, xDaColuna(ramo.colunaFim), yRamo]} stroke="#333" />
  // células do ramo reaproveitam <CelulaView>, só variando `y` para `yRamo`
}
```

Precisaria também estender `tentarColocar` (`regras.ts`) para aceitar
`celula.linha > 0` validando contra o `colunaInicio`/`colunaFim` do `Ramo`
correspondente, em vez de só contra `rung.colunas`.
