import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { diagramaVazio } from '../../ladder/edicao'
import AreaEditor from './AreaEditor'

describe('AreaEditor', () => {
  it('aba "ladder" mostra o tabpanel do editor Ladder', () => {
    render(
      <AreaEditor
        aba="ladder"
        diagrama={diagramaVazio()}
        aoMudarDiagrama={() => {}}
        problemas={[]}
        foco={null}
        fonte=""
        aoMudarFonte={() => {}}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )

    const painel = screen.getByRole('tabpanel')
    expect(painel).toHaveAttribute('id', 'painel-ladder')
    expect(painel).toHaveAttribute('aria-labelledby', 'aba-ladder')
  })

  it('aba "st" mostra o editor ST dentro do tabpanel correspondente', () => {
    render(
      <AreaEditor
        aba="st"
        diagrama={diagramaVazio()}
        aoMudarDiagrama={() => {}}
        problemas={[]}
        foco={null}
        fonte="PROGRAM x END_PROGRAM"
        aoMudarFonte={() => {}}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )

    const painel = screen.getByRole('tabpanel')
    expect(painel).toHaveAttribute('id', 'painel-st')
    expect(screen.getByLabelText(/structured text/i)).toBeInTheDocument()
  })

  it('trocar a aba troca o conteúdo mostrado (sem perder as props do outro lado)', () => {
    const aoMudarFonte = vi.fn()
    const { rerender } = render(
      <AreaEditor
        aba="ladder"
        diagrama={diagramaVazio()}
        aoMudarDiagrama={() => {}}
        problemas={[]}
        foco={null}
        fonte="conteudo st"
        aoMudarFonte={aoMudarFonte}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )
    expect(screen.queryByLabelText(/structured text/i)).not.toBeInTheDocument()

    rerender(
      <AreaEditor
        aba="st"
        diagrama={diagramaVazio()}
        aoMudarDiagrama={() => {}}
        problemas={[]}
        foco={null}
        fonte="conteudo st"
        aoMudarFonte={aoMudarFonte}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )
    expect(screen.getByLabelText(/structured text/i)).toHaveValue('conteudo st')
  })
})
