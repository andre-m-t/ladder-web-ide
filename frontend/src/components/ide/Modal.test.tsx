import { createRef } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Modal from './Modal'

describe('Modal — estrutura acessível', () => {
  it('renderiza role dialog com aria-modal e título ligado por aria-labelledby', () => {
    render(
      <Modal titulo="Título do modal" aoFechar={vi.fn()} rodape={<button type="button">Ok</button>}>
        <p>Corpo</p>
      </Modal>,
    )

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    const idTitulo = dialogo.getAttribute('aria-labelledby')
    expect(idTitulo).toBeTruthy()
    expect(document.getElementById(idTitulo as string)).toHaveTextContent('Título do modal')
  })

  it('renderiza children no corpo e rodape no rodapé', () => {
    render(
      <Modal titulo="T" aoFechar={vi.fn()} rodape={<button type="button">Ação do rodapé</button>}>
        <p>Conteúdo do corpo</p>
      </Modal>,
    )

    expect(screen.getByText('Conteúdo do corpo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ação do rodapé' })).toBeInTheDocument()
  })
})

describe('Modal — fechar', () => {
  it('Esc fecha', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(
      <Modal titulo="T" aoFechar={aoFechar} rodape={<button type="button">Ok</button>}>
        <p>Corpo</p>
      </Modal>,
    )

    await usuario.keyboard('{Escape}')

    expect(aoFechar).toHaveBeenCalled()
  })

  it('clique no overlay fecha, clique dentro do diálogo não fecha', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(
      <Modal titulo="T" aoFechar={aoFechar} rodape={<button type="button">Ok</button>}>
        <p>Corpo</p>
      </Modal>,
    )

    await usuario.click(screen.getByRole('dialog'))
    expect(aoFechar).not.toHaveBeenCalled()

    const overlay = screen.getByRole('dialog').parentElement as HTMLElement
    await usuario.click(overlay)
    expect(aoFechar).toHaveBeenCalled()
  })
})

describe('Modal — foco inicial', () => {
  it('sem focoInicialRef, foca o primeiro elemento focável do diálogo', () => {
    render(
      <Modal titulo="T" aoFechar={vi.fn()} rodape={<button type="button">Rodapé</button>}>
        <button type="button">Primeiro</button>
        <button type="button">Segundo</button>
      </Modal>,
    )

    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus()
  })

  it('com focoInicialRef, foca o elemento indicado', () => {
    function Caso() {
      const ref = createRef<HTMLButtonElement>()
      return (
        <Modal
          titulo="T"
          aoFechar={vi.fn()}
          focoInicialRef={ref}
          rodape={
            <button type="button" ref={ref}>
              Rodapé
            </button>
          }
        >
          <button type="button">Primeiro</button>
        </Modal>
      )
    }
    render(<Caso />)

    expect(screen.getByRole('button', { name: 'Rodapé' })).toHaveFocus()
  })
})

describe('Modal — Tab preso no diálogo', () => {
  it('Tab a partir do último focável volta ao primeiro', async () => {
    const usuario = userEvent.setup()
    render(
      <Modal titulo="T" aoFechar={vi.fn()} rodape={<button type="button">Rodapé</button>}>
        <button type="button">Primeiro</button>
      </Modal>,
    )

    const rodape = screen.getByRole('button', { name: 'Rodapé' })
    rodape.focus()
    await usuario.tab()

    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus()
  })

  it('Shift+Tab a partir do primeiro focável vai para o último', async () => {
    const usuario = userEvent.setup()
    render(
      <Modal titulo="T" aoFechar={vi.fn()} rodape={<button type="button">Rodapé</button>}>
        <button type="button">Primeiro</button>
      </Modal>,
    )

    const primeiro = screen.getByRole('button', { name: 'Primeiro' })
    primeiro.focus()
    await usuario.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Rodapé' })).toHaveFocus()
  })
})
