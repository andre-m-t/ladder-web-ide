import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import BarraSuperior, { type BarraSuperiorProps } from './BarraSuperior'

function propsBase(): BarraSuperiorProps {
  return {
    aba: 'ladder',
    aoMudarAba: vi.fn(),
    compilando: false,
    aoCompilar: vi.fn(),
    gravando: false,
    podeGravar: false,
    aoGravar: vi.fn(),
    painelVariaveisAberto: true,
    aoAlternarPainelVariaveis: vi.fn(),
    consoleAberto: true,
    aoAlternarConsole: vi.fn(),
    tema: 'escuro',
    aoAlternarTema: vi.fn(),
  }
}

describe('BarraSuperior', () => {
  it('mostra as abas Ladder e ST, com Ladder selecionada por padrão', () => {
    render(<BarraSuperior {...propsBase()} />)

    const abas = screen.getAllByRole('tab')
    expect(abas.map((a) => a.textContent)).toEqual(['Ladder', 'ST'])
    expect(screen.getByRole('tab', { name: 'Ladder' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'ST' })).toHaveAttribute('aria-selected', 'false')
  })

  it('clicar na aba ST chama aoMudarAba com "st"', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('tab', { name: 'ST' }))
    expect(props.aoMudarAba).toHaveBeenCalledWith('st')
  })

  it('não mostra mais MATIEC/toolchain no header (foram para o console, D-14)', () => {
    render(<BarraSuperior {...propsBase()} />)

    expect(screen.queryByText(/MATIEC/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/toolchain/i)).not.toBeInTheDocument()
  })

  it('todo botão do header tem um ícone svg marcado aria-hidden', () => {
    render(<BarraSuperior {...propsBase()} />)

    for (const botao of screen.getAllByRole('button')) {
      expect(botao.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }
    for (const aba of screen.getAllByRole('tab')) {
      expect(aba.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it('Gravar fica desabilitado quando podeGravar é falso', () => {
    render(<BarraSuperior {...propsBase()} podeGravar={false} />)
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).toBeDisabled()
  })

  it('Gravar fica habilitado quando podeGravar é verdadeiro', () => {
    render(<BarraSuperior {...propsBase()} podeGravar={true} />)
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

  it('alternadores de painel de variáveis e console têm aria-pressed e chamam seus alternadores', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} painelVariaveisAberto={true} consoleAberto={false} />)

    const botaoVariaveis = screen.getByRole('button', { name: /alternar painel de variáveis/i })
    const botaoConsole = screen.getByRole('button', { name: /alternar painel inferior/i })
    expect(botaoVariaveis).toHaveAttribute('aria-pressed', 'true')
    expect(botaoConsole).toHaveAttribute('aria-pressed', 'false')

    await usuario.click(botaoVariaveis)
    expect(props.aoAlternarPainelVariaveis).toHaveBeenCalledTimes(1)

    await usuario.click(botaoConsole)
    expect(props.aoAlternarConsole).toHaveBeenCalledTimes(1)
  })

  it('não usa cores fixas (só classes de tokens ide-*)', () => {
    const { container } = render(<BarraSuperior {...propsBase()} />)
    const CORES_FIXAS = /\b(bg|text|border|stroke|fill)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)-?\d*\b/

    for (const el of container.querySelectorAll('[class]')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(CORES_FIXAS)
    }
  })
})
