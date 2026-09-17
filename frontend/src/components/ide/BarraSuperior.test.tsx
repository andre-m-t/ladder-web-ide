import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import BarraSuperior, { type BarraSuperiorProps } from './BarraSuperior'

function propsBase(): BarraSuperiorProps {
  return {
    titulo: 'Sem título',
    linguagem: 'ld',
    abaEdicao: 'logica',
    aoMudarAbaEdicao: vi.fn(),
    aoNovoProjeto: vi.fn(),
    compilando: false,
    aoCompilar: vi.fn(),
    gravando: false,
    podeGravar: false,
    aoGravar: vi.fn(),
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

  it('mostra a aba Variáveis só em projeto Ladder', () => {
    const { rerender } = render(<BarraSuperior {...propsBase()} linguagem="ld" />)
    expect(screen.getByRole('tab', { name: /variáveis/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /lógica/i })).toBeInTheDocument()

    rerender(<BarraSuperior {...propsBase()} linguagem="st" />)
    expect(screen.queryByRole('tab', { name: /variáveis/i })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /lógica/i })).toBeInTheDocument()
  })

  it('clicar em "Novo projeto" chama aoNovoProjeto', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('button', { name: /novo projeto/i }))
    expect(props.aoNovoProjeto).toHaveBeenCalledTimes(1)
  })

  it('clicar na aba Variáveis chama aoMudarAbaEdicao com "variaveis"', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('tab', { name: /variáveis/i }))
    expect(props.aoMudarAbaEdicao).toHaveBeenCalledWith('variaveis')

    await usuario.click(screen.getByRole('tab', { name: /lógica/i }))
    expect(props.aoMudarAbaEdicao).toHaveBeenCalledWith('logica')
  })

  it('setas alternam entre as abas Lógica e Variáveis (WAI-ARIA tablist)', () => {
    const aoMudarAbaEdicao = vi.fn()
    const { rerender } = render(<BarraSuperior {...propsBase()} abaEdicao="logica" aoMudarAbaEdicao={aoMudarAbaEdicao} />)

    fireEvent.keyDown(screen.getByRole('tab', { name: /lógica/i }), { key: 'ArrowRight' })
    expect(aoMudarAbaEdicao).toHaveBeenCalledWith('variaveis')

    aoMudarAbaEdicao.mockClear()
    rerender(<BarraSuperior {...propsBase()} abaEdicao="variaveis" aoMudarAbaEdicao={aoMudarAbaEdicao} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: /variáveis/i }), { key: 'ArrowLeft' })
    expect(aoMudarAbaEdicao).toHaveBeenCalledWith('logica')
  })

  it('não navega por setas quando só há a aba Lógica (projeto ST)', () => {
    const aoMudarAbaEdicao = vi.fn()
    render(<BarraSuperior {...propsBase()} linguagem="st" aoMudarAbaEdicao={aoMudarAbaEdicao} />)

    fireEvent.keyDown(screen.getByRole('tab', { name: /lógica/i }), { key: 'ArrowRight' })
    expect(aoMudarAbaEdicao).not.toHaveBeenCalled()
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

  it('todo botão e aba do header tem um ícone svg marcado aria-hidden', () => {
    render(<BarraSuperior {...propsBase()} />)

    for (const botao of screen.getAllByRole('button')) {
      expect(botao.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }
    for (const aba of screen.getAllByRole('tab')) {
      expect(aba.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
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
