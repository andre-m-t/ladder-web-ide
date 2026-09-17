import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import BarraSuperior, { type BarraSuperiorProps, type EstadoSaude } from './BarraSuperior'

const SAUDE_OK: EstadoSaude = {
  kind: 'ok',
  health: {
    status: 'ok',
    iec2c: { available: true, path: '', version: null },
    esp_idf: { available: false, path: '', version: null },
  },
}

function propsBase(): BarraSuperiorProps {
  return {
    aba: 'ladder',
    aoMudarAba: vi.fn(),
    saude: SAUDE_OK,
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

  it('mostra o status de MATIEC e da toolchain a partir de /health', () => {
    render(<BarraSuperior {...propsBase()} />)

    expect(screen.getByText(/MATIEC: ok/)).toBeInTheDocument()
    expect(screen.getByText(/toolchain ESP32: indisponível/)).toBeInTheDocument()
  })

  it('mostra "consultando…" enquanto a saúde carrega, e o erro quando falha', () => {
    const { rerender } = render(<BarraSuperior {...propsBase()} saude={{ kind: 'carregando' }} />)
    expect(screen.getByText(/consultando/)).toBeInTheDocument()

    rerender(<BarraSuperior {...propsBase()} saude={{ kind: 'erro', message: 'falhou' }} />)
    expect(screen.getByText(/indisponível \(falhou\)/)).toBeInTheDocument()
  })

  it('Gravar fica desabilitado quando podeGravar é falso', () => {
    render(<BarraSuperior {...propsBase()} podeGravar={false} />)
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).toBeDisabled()
  })

  it('Gravar fica habilitado quando podeGravar é verdadeiro', () => {
    render(<BarraSuperior {...propsBase()} podeGravar={true} />)
    expect(screen.getByRole('button', { name: /gravar no esp32/i })).not.toBeDisabled()
  })

  it('Compilar mostra "Compilando…" e fica desabilitado durante a compilação', () => {
    render(<BarraSuperior {...propsBase()} compilando={true} />)
    expect(screen.getByRole('button', { name: /compilando/i })).toBeDisabled()
  })

  it('alternar tema tem aria-label e chama aoAlternarTema ao clicar', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('button', { name: /usar tema claro/i }))
    expect(props.aoAlternarTema).toHaveBeenCalledTimes(1)
  })

  it('botões de painel de variáveis e console chamam seus alternadores', async () => {
    const usuario = userEvent.setup()
    const props = propsBase()
    render(<BarraSuperior {...props} />)

    await usuario.click(screen.getByRole('button', { name: 'Variáveis' }))
    expect(props.aoAlternarPainelVariaveis).toHaveBeenCalledTimes(1)

    await usuario.click(screen.getByRole('button', { name: 'Console' }))
    expect(props.aoAlternarConsole).toHaveBeenCalledTimes(1)
  })
})
