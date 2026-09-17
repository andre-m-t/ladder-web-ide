import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ModalConfirmarDescarte from './ModalConfirmarDescarte'

describe('ModalConfirmarDescarte', () => {
  it('mostra o título do projeto atual no aviso', () => {
    render(<ModalConfirmarDescarte tituloProjeto="Semáforo" aoConfirmar={vi.fn()} aoCancelar={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Descartar projeto atual?' })).toBeInTheDocument()
    expect(screen.getByText(/semáforo/i)).toBeInTheDocument()
    expect(screen.getByText(/será perdido/i)).toBeInTheDocument()
  })

  it('foca "Cancelar" ao abrir', () => {
    render(<ModalConfirmarDescarte tituloProjeto="Semáforo" aoConfirmar={vi.fn()} aoCancelar={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('"Cancelar" chama aoCancelar', async () => {
    const usuario = userEvent.setup()
    const aoCancelar = vi.fn()
    render(<ModalConfirmarDescarte tituloProjeto="Semáforo" aoConfirmar={vi.fn()} aoCancelar={aoCancelar} />)

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(aoCancelar).toHaveBeenCalledTimes(1)
  })

  it('"Descartar e continuar" chama aoConfirmar', async () => {
    const usuario = userEvent.setup()
    const aoConfirmar = vi.fn()
    render(<ModalConfirmarDescarte tituloProjeto="Semáforo" aoConfirmar={aoConfirmar} aoCancelar={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: 'Descartar e continuar' }))

    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  it('Esc chama aoCancelar', async () => {
    const usuario = userEvent.setup()
    const aoCancelar = vi.fn()
    render(<ModalConfirmarDescarte tituloProjeto="Semáforo" aoConfirmar={vi.fn()} aoCancelar={aoCancelar} />)

    await usuario.keyboard('{Escape}')

    expect(aoCancelar).toHaveBeenCalledTimes(1)
  })
})
