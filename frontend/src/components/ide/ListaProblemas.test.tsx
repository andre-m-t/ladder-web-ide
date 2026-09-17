import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Problema } from '../../ladder/validacao'
import ListaProblemas from './ListaProblemas'

function erro(overrides: Partial<Problema> = {}): Problema {
  return {
    codigo: 'rung_incompleto',
    severidade: 'erro',
    rungId: 'r1',
    elementoId: null,
    mensagem: 'degrau 1 sem nenhuma bobina',
    ...overrides,
  }
}

function aviso(overrides: Partial<Problema> = {}): Problema {
  return {
    codigo: 'set_reset_autodependente',
    severidade: 'aviso',
    rungId: 'r1',
    elementoId: 'e1',
    mensagem: 'bobina SET depende da própria variável',
    ...overrides,
  }
}

describe('ListaProblemas', () => {
  it('sem problemas: mostra "Nenhum problema"', () => {
    render(<ListaProblemas problemas={[]} aoEscolher={() => {}} />)
    expect(screen.getByText('Nenhum problema.')).toBeInTheDocument()
  })

  it('separa erros e avisos em grupos distintos', () => {
    render(<ListaProblemas problemas={[erro(), aviso()]} aoEscolher={() => {}} />)

    expect(screen.getByText(/Erros \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Avisos \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/degrau 1 sem nenhuma bobina/)).toBeInTheDocument()
    expect(screen.getByText(/bobina SET depende da própria variável/)).toBeInTheDocument()
  })

  it('role="alert" só aparece quando há erro', () => {
    render(<ListaProblemas problemas={[aviso()]} aoEscolher={() => {}} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    render(<ListaProblemas problemas={[erro()]} aoEscolher={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('cada item tem ícone e texto de severidade distintos para erro e aviso', () => {
    render(<ListaProblemas problemas={[erro(), aviso()]} aoEscolher={() => {}} />)

    expect(screen.getByText('Erro:')).toBeInTheDocument()
    expect(screen.getByText('Aviso:')).toBeInTheDocument()
  })

  it('clicar num problema chama aoEscolher com o problema clicado', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const problemaErro = erro()
    render(<ListaProblemas problemas={[problemaErro]} aoEscolher={aoEscolher} />)

    await usuario.click(screen.getByRole('button', { name: /degrau 1 sem nenhuma bobina/ }))
    expect(aoEscolher).toHaveBeenCalledWith(problemaErro)
  })
})
