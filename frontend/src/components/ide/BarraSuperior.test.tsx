import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import BarraSuperior, { type BarraSuperiorProps } from './BarraSuperior'

function propsBase(): BarraSuperiorProps {
  return {
    titulo: 'Sem título',
    linguagem: 'ld',
    aoNovoProjeto: vi.fn(),
    compilando: false,
    aoCompilar: vi.fn(),
    gravando: false,
    podeGravar: false,
    aoGravar: vi.fn(),
    opcoesDownload: [
      { id: 'ld', rotulo: 'Ladder (.json)' },
      { id: 'st', rotulo: 'Structured Text (.st)' },
    ],
    aoBaixar: vi.fn(),
    simulando: false,
    simulacaoRodando: false,
    aoAlternarSimulacao: vi.fn(),
    aoAlternarExecucaoSimulacao: vi.fn(),
    aoPassoSimulacao: vi.fn(),
    aoReiniciarSimulacao: vi.fn(),
    marchas: [
      { id: 'tempo-real', rotulo: 'Tempo real (20 ms/ciclo)' },
      { id: 'lenta', rotulo: 'Marcha lenta (500 ms/ciclo)' },
    ],
    marchaAtual: 'tempo-real',
    aoEscolherMarcha: vi.fn(),
    painelVariaveisAberto: true,
    aoAlternarPainelVariaveis: vi.fn(),
    painelInferiorAberto: true,
    aoAlternarPainelInferior: vi.fn(),
    tema: 'escuro',
    aoAlternarTema: vi.fn(),
  }
}

describe('BarraSuperior', () => {
  it('mostra o título do projeto (truncado, com atributo title) e o chip da linguagem', () => {
    render(<BarraSuperior {...propsBase()} titulo="Esteira 1" linguagem="ld" />)

    const tituloEl = screen.getByText('Esteira 1')
    expect(tituloEl).toHaveAttribute('title', 'Esteira 1')
    expect(screen.getByText('ld')).toBeInTheDocument()
  })

  it('mostra o alternador do painel de variáveis só em projeto Ladder', () => {
    const { rerender } = render(<BarraSuperior {...propsBase()} linguagem="ld" />)
    expect(screen.getByRole('button', { name: /alternar painel de variáveis/i })).toBeInTheDocument()

    rerender(<BarraSuperior {...propsBase()} linguagem="st" />)
    expect(screen.queryByRole('button', { name: /alternar painel de variáveis/i })).not.toBeInTheDocument()
  })

  it('clicar em "Novo projeto" chama aoNovoProjeto', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
    expect(props.aoNovoProjeto).toHaveBeenCalledTimes(1)
  })

  it('alternador do painel de variáveis tem aria-pressed e chama aoAlternarPainelVariaveis', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} painelVariaveisAberto={false} />)

    const botao = screen.getByRole('button', { name: /alternar painel de variáveis/i })
    expect(botao).toHaveAttribute('aria-pressed', 'false')

    await usuario.click(botao)
    expect(props.aoAlternarPainelVariaveis).toHaveBeenCalledTimes(1)
  })

  it('motivoIndisponivel desabilita Compilar e Gravar juntos, com o motivo no title e em aria-describedby', () => {
    render(<BarraSuperior {...propsBase()} podeGravar={true} motivoIndisponivel="Nenhum projeto aberto" />)

    const botaoCompilar = screen.getByRole('button', { name: /compilar/i })
    const botaoGravar = screen.getByRole('button', { name: /gravar no esp32/i })

    expect(botaoCompilar).toBeDisabled()
    expect(botaoGravar).toBeDisabled()
    expect(botaoCompilar).toHaveAttribute('title', 'Nenhum projeto aberto')
    expect(botaoGravar).toHaveAttribute('title', 'Nenhum projeto aberto')

    const idDescricaoCompilar = botaoCompilar.getAttribute('aria-describedby')
    const idDescricaoGravar = botaoGravar.getAttribute('aria-describedby')
    expect(idDescricaoCompilar).toBeTruthy()
    expect(idDescricaoGravar).toBeTruthy()
    expect(document.getElementById(idDescricaoCompilar!)).toHaveTextContent('Nenhum projeto aberto')
    expect(document.getElementById(idDescricaoGravar!)).toHaveTextContent('Nenhum projeto aberto')
  })

  it('sem motivoIndisponivel, Gravar segue as regras de sempre (podeGravar)', () => {
    const { rerender } = render(<BarraSuperior {...propsBase()} podeGravar={false} />)
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).toBeDisabled()

    rerender(<BarraSuperior {...propsBase()} podeGravar={true} />)
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).not.toBeDisabled()
  })

  it('Gravar mostra o progresso e um spinner durante a gravação', () => {
    render(<BarraSuperior {...propsBase()} gravando={true} progressoGravacao={42} />)
    expect(screen.getByRole('button', { name: /gravando… 42%/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gravando/i }).querySelector('.animate-spin')).not.toBeNull()
  })

  it('Compilar mostra "Compilando…" com spinner e fica desabilitado durante a compilação', () => {
    render(<BarraSuperior {...propsBase()} compilando={true} />)
    const botao = screen.getByRole('button', { name: /compilando/i })
    expect(botao).toBeDisabled()
    expect(botao.querySelector('.animate-spin')).not.toBeNull()
  })

  it('alternar tema tem aria-label e chama aoAlternarTema ao clicar', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('button', { name: /usar tema claro/i }))
    expect(props.aoAlternarTema).toHaveBeenCalledTimes(1)
  })

  it('alternador do painel inferior tem aria-pressed e chama aoAlternarPainelInferior', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} painelInferiorAberto={false} />)

    const botao = screen.getByRole('button', { name: /alternar painel inferior/i })
    expect(botao).toHaveAttribute('aria-pressed', 'false')

    await usuario.click(botao)
    expect(props.aoAlternarPainelInferior).toHaveBeenCalledTimes(1)
  })

  it('o menu Baixar aparece entre Compilar e Gravar, e escolher uma opção chama aoBaixar', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    const botoes = screen.getAllByRole('button')
    const indiceCompilar = botoes.findIndex((botao) => /^compilar$/i.test(botao.getAttribute('aria-label') ?? ''))
    const indiceBaixar = botoes.findIndex((botao) => /baixar projeto/i.test(botao.getAttribute('aria-label') ?? ''))
    const indiceGravar = botoes.findIndex((botao) => /gravar no esp32/i.test(botao.getAttribute('aria-label') ?? ''))
    expect(indiceCompilar).toBeLessThan(indiceBaixar)
    expect(indiceBaixar).toBeLessThan(indiceGravar)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    await usuario.click(screen.getByRole('menuitem', { name: /structured text/i }))
    expect(props.aoBaixar).toHaveBeenCalledWith('st')
  })

  it('todo botão do header tem um ícone svg marcado aria-hidden', () => {
    render(<BarraSuperior {...propsBase()} />)

    for (const botao of screen.getAllByRole('button')) {
      expect(botao.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it('não usa cores fixas (só classes de tokens ide-*)', () => {
    const { container } = render(<BarraSuperior {...propsBase()} />)
    const CORES_FIXAS = /\b(bg|text|border|stroke|fill)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)-?\d*\b/

    for (const el of container.querySelectorAll('[class]')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(CORES_FIXAS)
    }
  })
})
