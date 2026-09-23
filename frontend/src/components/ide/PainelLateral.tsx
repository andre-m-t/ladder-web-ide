/**
 * Painel lateral da IDE (spec 002, plano D-13; restaurado na revisão da
 * tarefa #26 — o autor testou as variáveis como sub-aba de largura inteira e
 * pediu de volta o painel lateral): hospeda `PainelVariaveis`, recolhível
 * pelo botão da barra superior e redimensionável por um divisor vertical na
 * borda esquerda. `aberto=false` não renderiza nada — sem painel não há nada
 * para o divisor arrastar, então ele some junto.
 */
import type { ReactNode } from 'react'

import Divisor from './Divisor'

export interface PainelLateralProps {
  aberto: boolean
  /** Rótulo do painel (aria-label do aside e do divisor). */
  rotulo: string
  largura: number
  larguraMin: number
  larguraMax: number
  aoRedimensionar: (largura: number) => void
  children: ReactNode
}

export default function PainelLateral({
  aberto,
  rotulo,
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
        rotulo={`Redimensionar ${rotulo.toLowerCase()}`}
      />
      <aside
        aria-label={rotulo}
        style={{ width: largura }}
        className="h-full shrink-0 overflow-y-auto bg-ide-painel"
      >
        {children}
      </aside>
    </>
  )
}
