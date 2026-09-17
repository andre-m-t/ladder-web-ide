import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Paleta from './Paleta'

function propsBase() {
  return {
    marcado: false,
    emArrasto: false,
    sobreLixeira: false,
    aoIniciarArrastoPonteiro: vi.fn(),
    aoIniciarArrastoTeclado: vi.fn(),
    aoPassarLixeira: vi.fn(),
    aoAcionarLixeira: vi.fn(),
    aoTeclarNaLixeira: vi.fn(),
  }
}

describe('Paleta — itens arrastáveis', () => {
  it('cada item é um "item arrastável" (aria-roledescription), não um botão de ação', () => {
    render(<Paleta {...propsBase()} />)

    for (const nome of [/contato na/i, /contato nf/i, /^bobina$/i]) {
      const item = screen.getByRole('button', { name: nome })
      expect(item).toHaveAttribute('aria-roledescription', 'item arrastável')
    }
  })

  it('cada item tem aria-describedby com instrução de teclado', () => {
    render(<Paleta {...propsBase()} />)

    const item = screen.getByRole('button', { name: /contato na/i })
    const idInstrucao = item.getAttribute('aria-describedby')
    expect(idInstrucao).toBeTruthy()
    expect(document.getElementById(idInstrucao as string)).toHaveTextContent(/espaço/i)
  })

  it('pointerdown num item chama aoIniciarArrastoPonteiro com o tipo certo', () => {
    const aoIniciarArrastoPonteiro = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    const item = screen.getByRole('button', { name: /^bobina$/i })
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 5, clientY: 5 })

    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledWith('bobina', expect.anything())
  })

  it('Espaço num item chama aoIniciarArrastoTeclado com o tipo certo', async () => {
    const usuario = userEvent.setup()
    const aoIniciarArrastoTeclado = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoTeclado={aoIniciarArrastoTeclado} />)

    const item = screen.getByRole('button', { name: /contato nf/i })
    item.focus()
    await usuario.keyboard(' ')

    expect(aoIniciarArrastoTeclado).toHaveBeenCalledWith('contato_nf')
  })

  it('cada item tem exatamente um ícone SVG marcado como aria-hidden', () => {
    render(<Paleta {...propsBase()} />)

    for (const item of screen.getAllByRole('button', { name: /contato|bobina/i })) {
      const svgsEscondidos = item.querySelectorAll('svg[aria-hidden="true"]')
      expect(svgsEscondidos).toHaveLength(1)
    }
  })

  it('nome acessível de cada item é exatamente o rótulo, sem texto do ícone', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Contato NA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contato NF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bobina' })).toBeInTheDocument()
  })

  it('data-tipo-paleta identifica o item, para foco programático durante o arrasto por teclado', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Contato NA' })).toHaveAttribute('data-tipo-paleta', 'contato_na')
  })
})

describe('Paleta — lixeira', () => {
  it('desabilitada quando não há marcação nem arrasto em curso', () => {
    render(<Paleta {...propsBase()} marcado={false} emArrasto={false} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeDisabled()
  })

  it('habilitada quando há elemento marcado', () => {
    render(<Paleta {...propsBase()} marcado={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeEnabled()
  })

  it('habilitada durante um arrasto, mesmo sem marcação (alvo de soltar)', () => {
    render(<Paleta {...propsBase()} emArrasto={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeEnabled()
  })

  it('texto de ajuda associado via aria-describedby', () => {
    render(<Paleta {...propsBase()} />)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    const idAjuda = lixeira.getAttribute('aria-describedby')
    expect(idAjuda).toBeTruthy()
    expect(document.getElementById(idAjuda as string)).not.toBeNull()
  })

  it('clique na lixeira chama aoAcionarLixeira', async () => {
    const usuario = userEvent.setup()
    const aoAcionarLixeira = vi.fn()
    render(<Paleta {...propsBase()} marcado={true} aoAcionarLixeira={aoAcionarLixeira} />)

    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    expect(aoAcionarLixeira).toHaveBeenCalledTimes(1)
  })

  it('pointerenter/leave na lixeira chamam aoPassarLixeira', () => {
    const aoPassarLixeira = vi.fn()
    render(<Paleta {...propsBase()} emArrasto={true} aoPassarLixeira={aoPassarLixeira} />)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    fireEvent.pointerEnter(lixeira)
    expect(aoPassarLixeira).toHaveBeenLastCalledWith(true)

    fireEvent.pointerLeave(lixeira)
    expect(aoPassarLixeira).toHaveBeenLastCalledWith(false)
  })

  it('destaque visual quando é o alvo do arrasto (sobreLixeira)', () => {
    render(<Paleta {...propsBase()} emArrasto={true} sobreLixeira={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i }).className).toContain('border-red-500')
  })
})
