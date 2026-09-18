/**
 * Download de projeto no cliente (rodada de UX, frente D).
 *
 * A aba "ST gerado" saiu da tela; no lugar, o cabeçalho ganha um botão de
 * download (`MenuDownload`, ao lado do Compilar) com duas opções: o envelope
 * do projeto em JSON (mesmo formato de `salvarProjeto`,
 * `projeto/projeto.ts`) e o texto Structured Text — em projeto LD, a saída do
 * serializador Ladder → ST; em projeto ST, `projeto.fonte` direto. Este
 * módulo não decide *quando* cada opção está disponível (isso é do `App`,
 * que conhece o resultado da compilação) — só monta nome de arquivo,
 * conteúdo e o download em si.
 *
 * Puro, sem estado: as únicas duas funções que tocam o DOM
 * (`baixarTexto`) usam a técnica padrão de `<a download>` temporário —
 * `Blob` + `URL.createObjectURL`, anexa, `click()`, remove, revoga a URL.
 * `URL.revokeObjectURL` é adiado com `setTimeout` para não invalidar a URL
 * antes do navegador iniciar o download em alguns browsers.
 */
import type { Projeto } from '../projeto/projeto'

/** Remove acentos e outros diacríticos de `texto` via decomposição Unicode
 * (NFD) seguida da remoção dos marcadores de combinação (categoria Mn). */
function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Deriva um nome de arquivo a partir do título do projeto: ASCII minúsculo,
 * sem acentos, com qualquer caractere fora de `[a-z0-9]` virando `-`
 * (colapsando repetições e aparando das pontas). Título vazio ou só feito de
 * símbolos vira `projeto`. `extensao` não leva o ponto inicial (ex.: `'st'`,
 * ou `'ladderflow.json'` para múltiplas partes).
 *
 * Ex.: `nomeDeArquivo('Semáforo 2', 'st')` → `'semaforo-2.st'`.
 */
export function nomeDeArquivo(titulo: string, extensao: string): string {
  const base = semAcentos(titulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'projeto'}.${extensao}`
}

/** Serializa `projeto` no mesmo formato gravado por `salvarProjeto`
 * (`projeto/projeto.ts`): JSON com indentação de 2 espaços, terminado em
 * `\n`. */
export function conteudoProjetoJson(projeto: Projeto): string {
  return JSON.stringify(projeto, null, 2) + '\n'
}

/** Dispara o download de `conteudo` como o arquivo `nome`, com o tipo MIME
 * `mime` (ex.: `'application/json'`, `'text/plain;charset=utf-8'`). Cria um
 * `Blob`, um `<a download>` temporário anexado ao `document.body`, clica
 * nele e o remove; a URL do objeto é revogada logo em seguida (adiada com
 * `setTimeout` para não cortar o download antes de começar em alguns
 * navegadores). */
export function baixarTexto(nome: string, conteudo: string, mime: string): void {
  const blob = new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
