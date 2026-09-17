/**
 * Tema visual da IDE — escuro e claro (spec 002, plano D-13).
 *
 * `temaInicial` decide, nesta ordem: preferência salva em `localStorage`,
 * depois `prefers-color-scheme` do sistema, e por fim escuro como padrão.
 * `aplicarTema` só manipula `document.documentElement.dataset.theme` — os
 * valores de cor vivem nos tokens de `index.css` (`[data-theme="light"]` e
 * `[data-theme="dark"]`, plano §13/D-13). Ambas as funções toleram ambiente
 * sem `localStorage`/`matchMedia` (leitura e escrita em try/catch):
 * preferência de interface nunca pode quebrar a aplicação.
 *
 * Chamar `aplicarTema` antes do primeiro render (em `main.tsx`) evita o
 * "flash" de tema errado — a IDE nunca pinta escuro para depois trocar para
 * claro (ou vice-versa) assim que React monta.
 */

export type Tema = 'claro' | 'escuro'

const CHAVE_TEMA = 'ladderflow.tema'

function lerTemaSalvo(): Tema | null {
  try {
    const salvo = window.localStorage.getItem(CHAVE_TEMA)
    return salvo === 'claro' || salvo === 'escuro' ? salvo : null
  } catch {
    return null
  }
}

function preferenciaDoSistemaEhClara(): boolean {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false
  } catch {
    return false
  }
}

/** Decide o tema inicial: salvo > preferência do sistema > escuro (padrão). */
export function temaInicial(): Tema {
  const salvo = lerTemaSalvo()
  if (salvo) return salvo
  return preferenciaDoSistemaEhClara() ? 'claro' : 'escuro'
}

/** Aplica `tema` ao documento (`data-theme`) e tenta lembrar a escolha para a próxima visita. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.theme = tema === 'claro' ? 'light' : 'dark'
  try {
    window.localStorage.setItem(CHAVE_TEMA, tema)
  } catch {
    // sem localStorage (ex.: navegação privada): a troca de tema funciona, só não persiste.
  }
}
