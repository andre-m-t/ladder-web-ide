// Único lugar do spike que traduz célula (linha/rung, coluna) -> coordenada de
// tela. Não há tradução no sentido inverso (tela -> célula): cada forma Konva
// já nasce com sua (rung, coluna) fechadas no closure do onClick, então o
// hit-test do Konva resolve "qual forma foi clicada" e a célula já é
// conhecida — não precisamos calcular índice a partir de x/y de ponteiro.
// Ver MEDICOES.md, item 2.
export const LARGURA_CELULA = 90
export const ALTURA_CELULA = 60
export const LARGURA_TRILHO = 16
export const ESPACO_ENTRE_RUNGS = 24

export function xDaColuna(coluna: number): number {
  return LARGURA_TRILHO + coluna * LARGURA_CELULA
}

export function yDoRung(indiceRung: number): number {
  return indiceRung * (ALTURA_CELULA + ESPACO_ENTRE_RUNGS)
}
