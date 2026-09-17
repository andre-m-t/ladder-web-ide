import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Paleta from './Paleta'

describe('Paleta', () => {
  it('nenhuma ferramenta pressionada quando ativa é null', () => {
    render(<Paleta ativa={null} aoEscolher={vi.fn()} />)

    for (const nome of [/contato na/i, /contato nf/i, /^bobina$/i, /remover/i]) {
      expect(screen.getByRole('button', { name: nome })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('escolhe uma ferramenta ao clicar', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    render(<Paleta ativa={null} aoEscolher={aoEscolher} />)

    await usuario.click(screen.getByRole('button', { name: /contato na/i }))

    expect(aoEscolher).toHaveBeenCalledWith('contato_na')
  })

  it('marca a ferramenta ativa com aria-pressed', () => {
    render(<Paleta ativa="bobina" aoEscolher={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^bobina$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /contato na/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicar na ferramenta ativa a desativa (null)', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    render(<Paleta ativa="remover" aoEscolher={aoEscolher} />)

    await usuario.click(screen.getByRole('button', { name: /remover/i }))

    expect(aoEscolher).toHaveBeenCalledWith(null)
  })

  it('cada botão tem exatamente um ícone SVG marcado como aria-hidden', () => {
    render(<Paleta ativa={null} aoEscolher={vi.fn()} />)

    for (const botao of screen.getAllByRole('button')) {
      const svgsEscondidos = botao.querySelectorAll('svg[aria-hidden="true"]')
      expect(svgsEscondidos).toHaveLength(1)
    }
  })

  it('nome acessível de cada botão é exatamente o rótulo, sem texto do ícone', () => {
    render(<Paleta ativa={null} aoEscolher={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Contato NA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contato NF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bobina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover' })).toBeInTheDocument()
  })

  it('botão pressionado envolve o ícone num chip claro (contraste sobre o fundo sky)', () => {
    render(<Paleta ativa="bobina" aoEscolher={vi.fn()} />)

    const botaoPressionado = screen.getByRole('button', { name: 'Bobina' })
    const chip = within(botaoPressionado).getByTestId('chip-icone')
    expect(chip.className).toContain('bg-white/90')
    expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull()

    const botaoSolto = screen.getByRole('button', { name: 'Contato NA' })
    expect(within(botaoSolto).queryByTestId('chip-icone')).toBeNull()
  })
})
