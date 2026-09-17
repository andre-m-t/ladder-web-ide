/**
 * Painel inferior da IDE (spec 002, plano D-13): hospeda o `Console`,
 * recolhível pelo botão da barra superior e redimensionável por um divisor
 * horizontal na borda superior. `aberto=false` não renderiza nada — mesma
 * regra do `PainelLateral`.
 */
import type { ReactNode } from 'react'

import Divisor from './Divisor'

export interface PainelInferiorProps {
  aberto: boolean
  altura: number
  alturaMin: number
  alturaMax: number
  aoRedimensionar: (altura: number) => void
  children: ReactNode
}

export default function PainelInferior({
  aberto,
  altura,
  alturaMin,
  alturaMax,
  aoRedimensionar,
  children,
}: PainelInferiorProps) {
  if (!aberto) return null

  return (
    <div className="flex shrink-0 flex-col" style={{ height: altura }}>
      <Divisor
        orientacao="horizontal"
        valor={altura}
        min={alturaMin}
        max={alturaMax}
        aoMudar={aoRedimensionar}
        rotulo="Redimensionar console"
      />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
