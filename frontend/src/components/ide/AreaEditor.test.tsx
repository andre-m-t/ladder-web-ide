import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { diagramaVazio } from '../../ladder/edicao'
import { ESQUELETO_ST, type Projeto } from '../../projeto/projeto'
import AreaEditor from './AreaEditor'

function projetoLD(): Projeto {
  return { versao: 1, titulo: 'Sem título', linguagem: 'ld', diagrama: diagramaVazio() }
}

function projetoST(fonte = ESQUELETO_ST): Projeto {
  return { versao: 1, titulo: 'Sem título', linguagem: 'st', fonte }
}

describe('AreaEditor', () => {
  it('projeto LD na sub-aba "logica" mostra o tabpanel do EditorLadder', () => {
    render(
      <AreaEditor
        projeto={projetoLD()}
        abaEdicao="logica"
        aoMudarProjeto={() => {}}
        problemas={[]}
        foco={null}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )

    const painel = screen.getByRole('tabpanel')
    expect(painel).toHaveAttribute('id', 'painel-edicao-logica')
    expect(painel).toHaveAttribute('aria-labelledby', 'aba-edicao-logica')
    expect(screen.getByRole('button', { name: /^contato na$/i })).toBeInTheDocument()
  })

  it('projeto LD na sub-aba "variaveis" mostra o PainelVariaveis', () => {
    render(
      <AreaEditor
        projeto={projetoLD()}
        abaEdicao="variaveis"
        aoMudarProjeto={() => {}}
        problemas={[]}
        foco={null}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )

    const painel = screen.getByRole('tabpanel')
    expect(painel).toHaveAttribute('id', 'painel-edicao-variaveis')
    expect(painel).toHaveAttribute('aria-labelledby', 'aba-edicao-variaveis')
    expect(screen.getByRole('table', { name: 'Variáveis declaradas' })).toBeInTheDocument()
  })

  it('projeto ST mostra o editor de texto dentro do tabpanel "logica", ignorando abaEdicao', () => {
    render(
      <AreaEditor
        projeto={projetoST('PROGRAM x END_PROGRAM')}
        abaEdicao="variaveis"
        aoMudarProjeto={() => {}}
        problemas={[]}
        foco={null}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )

    const painel = screen.getByRole('tabpanel')
    expect(painel).toHaveAttribute('id', 'painel-edicao-logica')
    expect(screen.getByLabelText(/structured text/i)).toHaveValue('PROGRAM x END_PROGRAM')
  })

  it('editar o texto ST chama aoMudarProjeto com o projeto inteiro, fonte atualizada', async () => {
    const aoMudarProjeto = vi.fn()
    render(
      <AreaEditor
        projeto={projetoST('conteudo st')}
        abaEdicao="logica"
        aoMudarProjeto={aoMudarProjeto}
        problemas={[]}
        foco={null}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText(/structured text/i), { target: { value: 'novo conteudo' } })

    expect(aoMudarProjeto).toHaveBeenCalledWith({ versao: 1, titulo: 'Sem título', linguagem: 'st', fonte: 'novo conteudo' })
  })

  it('trocar entre projetos LD e ST troca o conteúdo mostrado', () => {
    const { rerender } = render(
      <AreaEditor
        projeto={projetoLD()}
        abaEdicao="logica"
        aoMudarProjeto={() => {}}
        problemas={[]}
        foco={null}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )
    expect(screen.queryByLabelText(/structured text/i)).not.toBeInTheDocument()

    rerender(
      <AreaEditor
        projeto={projetoST('conteudo st')}
        abaEdicao="logica"
        aoMudarProjeto={() => {}}
        problemas={[]}
        foco={null}
        compilando={false}
        erroCompilacao={null}
        aoRecusar={() => {}}
      />,
    )
    expect(screen.getByLabelText(/structured text/i)).toHaveValue('conteudo st')
  })
})
