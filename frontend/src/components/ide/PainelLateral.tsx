/**
 * Painel lateral da IDE (spec 002, plano D-13): hospeda `PainelVariaveis`,
 * recolhível pelo botão da barra superior e redimensionável por um divisor
 * vertical na borda esquerda. `aberto=false` não renderiza nada — sem painel
 * não há nada para o divisor arrastar, então ele some junto.
 */
import type { ReactNode } from 'react'

import Divisor from './Divisor'

export interface PainelLateralProps {
  aberto: boolean
  largura: number
  larguraMin: number
  larguraMax: number
  aoRedimensionar: (largura: number) => void
  children: ReactNode
}

export default function PainelLateral({
  aberto,
  largura,
  larguraMin,
  larguraMax,
  aoRedimensionar,
  children,
}: PainelLateralProps) {
  if (!aberto) return null

  return (
    <>
      <Divisor
        orientacao="vertical"
        valor={largura}
        min={larguraMin}
        max={larguraMax}
        aoMudar={aoRedimensionar}
        rotulo="Redimensionar painel de variáveis"
      />
      <aside
        aria-label="Painel de variáveis"
        style={{ width: largura }}
        className="h-full shrink-0 overflow-y-auto bg-ide-painel"
      >
        {children}
      </aside>
    </>
  )
}
