import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TITULO_PADRAO } from '../../projeto/projeto'
import ModalNovoProjeto from './ModalNovoProjeto'

describe('ModalNovoProjeto — estrutura', () => {
  it('campo de título vem pré-preenchido com o título padrão e selecionado', () => {
    render(<ModalNovoProjeto aoCriar={vi.fn()} aoCancelar={vi.fn()} />)

    const campo = screen.getByLabelText('Título do projeto') as HTMLInputElement
    expect(campo).toHaveValue(TITULO_PADRAO)
    expect(campo).toHaveFocus()
    expect(campo.selectionStart).toBe(0)
    expect(campo.selectionEnd).toBe(TITULO_PADRAO.length)
  })

  it('Ladder (LD) vem selecionado por padrão no radiogroup', () => {
    render(<ModalNovoProjeto aoCriar={vi.fn()} aoCancelar={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /ladder/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /texto estruturado/i })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ModalNovoProjeto — fechar', () => {
  it('"Cancelar" chama aoCancelar', async () => {
    const usuario = userEvent.setup()
    const aoCancelar = vi.fn()
    render(<ModalNovoProjeto aoCriar={vi.fn()} aoCancelar={aoCancelar} />)

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(aoCancelar).toHaveBeenCalledTimes(1)
  })

  it('Esc chama aoCancelar', async () => {
    const usuario = userEvent.setup()
    const aoCancelar = vi.fn()
    render(<ModalNovoProjeto aoCriar={vi.fn()} aoCancelar={aoCancelar} />)

    await usuario.keyboard('{Escape}')

    expect(aoCancelar).toHaveBeenCalledTimes(1)
  })
})

describe('ModalNovoProjeto — validação do título', () => {
  it('título vazio mostra o motivo abaixo do campo e não chama aoCriar', async () => {
    const usuario = userEvent.setup()
    const aoCriar = vi.fn()
    render(<ModalNovoProjeto aoCriar={aoCriar} aoCancelar={vi.fn()} />)

    const campo = screen.getByLabelText('Título do projeto')
    await usuario.clear(campo)
    await usuario.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect(aoCriar).not.toHaveBeenCalled()
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    const idErro = campo.getAttribute('aria-describedby')
    expect(idErro).toBeTruthy()
    expect(document.getElementById(idErro as string)).toHaveTextContent(/.+/)
  })
})

describe('ModalNovoProjeto — criar', () => {
  it('título válido com ST escolhido por teclado chama aoCriar("Semáforo", "st")', async () => {
    const usuario = userEvent.setup()
    const aoCriar = vi.fn()
    render(<ModalNovoProjeto aoCriar={aoCriar} aoCancelar={vi.fn()} />)

    const campo = screen.getByLabelText('Título do projeto')
    await usuario.clear(campo)
    await usuario.type(campo, 'Semáforo')

    await usuario.tab()
    expect(screen.getByRole('radio', { name: /ladder/i })).toHaveFocus()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: /texto estruturado/i })).toHaveFocus()
    expect(screen.getByRole('radio', { name: /texto estruturado/i })).toHaveAttribute('aria-checked', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect(aoCriar).toHaveBeenCalledWith('Semáforo', 'st')
  })

  it('Enter no campo envia com a linguagem escolhida (Ladder por padrão)', async () => {
    const usuario = userEvent.setup()
    const aoCriar = vi.fn()
    render(<ModalNovoProjeto aoCriar={aoCriar} aoCancelar={vi.fn()} />)

    const campo = screen.getByLabelText('Título do projeto')
    await usuario.clear(campo)
    await usuario.type(campo, 'Semáforo{Enter}')

    expect(aoCriar).toHaveBeenCalledWith('Semáforo', 'ld')
  })
})
