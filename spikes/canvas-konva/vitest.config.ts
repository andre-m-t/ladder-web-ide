import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // `konva` resolve, por padrão de pacote Node (campo "main"), para
  // `lib/index-node.js`, que faz `require('canvas')`. Tentamos redirecionar
  // essa resolução para o build de browser via `resolve.alias`/`ssr.noExternal`
  // sem sucesso: o Vitest carrega `konva`/`react-konva` como dependência
  // externa e usa o `require()` nativo do Node para o pacote raiz, o que
  // ignora alias do Vite; e forçar `ssr.noExternal` quebra imports profundos
  // do `react-konva` (`konva/lib/Core.js` deixa de resolver). A solução que
  // funcionou de fato foi instalar o pacote nativo `canvas` como
  // devDependency (ver MEDICOES.md item 3): ele tem binário pré-compilado
  // para linux/x64/Node 22 (via `prebuild-install`), então `npm install`
  // não precisou de toolchain de compilação na imagem `node:22-bookworm-slim`.
  // Com `canvas` presente em node_modules, dois efeitos simultâneos:
  // (1) o `require('canvas')` de index-node.js passa a resolver normalmente
  //     (resolução de node_modules comum, sem tocar em config do Vite);
  // (2) o jsdom passa a usar esse mesmo pacote para implementar
  //     `HTMLCanvasElement.getContext('2d')` nos `<canvas>` que o Konva cria,
  //     que de outra forma retornaria `null` (jsdom não desenha canvas sozinho).
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
