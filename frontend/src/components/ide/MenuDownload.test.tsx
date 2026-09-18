import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import MenuDownload, { type OpcaoDownload } from './MenuDownload'

function opcoesDuas(): OpcaoDownload[] {
  return [
    { id: 'ld', rotulo: 'Ladder (.json)' },
    { id: 'st', rotulo: 'Structured Text (.st)' },
  ]
}

describe('MenuDownload', () => {
  it('o menu começa fechado, e abre ao clicar no botão, focando o primeiro item', async () => {
    const usuario = userEvent.setup()
    render(<MenuDownload opcoes={opcoesDuas()} aoEscolher={vi.fn()} />)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    const botao = screen.getByRole('button', { name: /baixar projeto/i })
    expect(botao).toHaveAttribute('aria-expanded', 'false')

    await usuario.click(botao)

    expect(botao).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
    expect(within(menu).getByRole('menuitem', { name: /ladder \(\.json\)/i })).toHaveFocus()
  })

  it('foca o primeiro item HABILITADO quando o primeiro da lista está desabilitado', async () => {
    const usuario = userEvent.setup()
    const opcoes: OpcaoDownload[] = [
      { id: 'ld', rotulo: 'Ladder (.json)', desabilitadaMotivo: 'motivo qualquer' },
      { id: 'st', rotulo: 'Structured Text (.st)' },
    ]
    render(<MenuDownload opcoes={opcoes} aoEscolher={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))

    expect(screen.getByRole('menuitem', { name: /structured text/i })).toHaveFocus()
  })

  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    const usuario = userEvent.setup()
    render(<MenuDownload opcoes={opcoesDuas()} aoEscolher={vi.fn()} />)

    const botao = screen.getByRole('button', { name: /baixar projeto/i })
    await usuario.click(botao)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(botao).toHaveFocus()
  })

  it('clique fora fecha o menu', async () => {
    const usuario = userEvent.setup()
    render(
      <div>
        <MenuDownload opcoes={opcoesDuas()} aoEscolher={vi.fn()} />
        <button type="button">fora</button>
      </div>,
    )

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'fora' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('clicar no botão de novo fecha o menu (alterna)', async () => {
    const usuario = userEvent.setup()
    render(<MenuDownload opcoes={opcoesDuas()} aoEscolher={vi.fn()} />)

    const botao = screen.getByRole('button', { name: /baixar projeto/i })
    await usuario.click(botao)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await usuario.click(botao)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('setas ↓/↑ navegam entre os itens, com volta nas pontas', async () => {
    const usuario = userEvent.setup()
    render(<MenuDownload opcoes={opcoesDuas()} aoEscolher={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    const itemLd = screen.getByRole('menuitem', { name: /ladder/i })
    const itemSt = screen.getByRole('menuitem', { name: /structured text/i })

    expect(itemLd).toHaveFocus()

    await usuario.keyboard('{ArrowDown}')
    expect(itemSt).toHaveFocus()

    await usuario.keyboard('{ArrowDown}')
    expect(itemLd).toHaveFocus()

    await usuario.keyboard('{ArrowUp}')
    expect(itemSt).toHaveFocus()

    await usuario.keyboard('{ArrowUp}')
    expect(itemLd).toHaveFocus()
  })

  it('escolher um item habilitado chama aoEscolher com o id, fecha o menu e devolve o foco', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    render(<MenuDownload opcoes={opcoesDuas()} aoEscolher={aoEscolher} />)

    const botao = screen.getByRole('button', { name: /baixar projeto/i })
    await usuario.click(botao)
    await usuario.click(screen.getByRole('menuitem', { name: /structured text/i }))

    expect(aoEscolher).toHaveBeenCalledTimes(1)
    expect(aoEscolher).toHaveBeenCalledWith('st')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(botao).toHaveFocus()
  })

  it('escolher com Enter também funciona', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    render(<MenuDownload opcoes={opcoesDuas()} aoEscolher={aoEscolher} />)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    await usuario.keyboard('{Enter}')

    expect(aoEscolher).toHaveBeenCalledWith('ld')
  })

  it('item desabilitado não chama aoEscolher e mostra o motivo (visível e no title)', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const opcoes: OpcaoDownload[] = [
      { id: 'ld', rotulo: 'Ladder (.json)' },
      { id: 'st', rotulo: 'Structured Text (.st)', desabilitadaMotivo: 'diagrama vazio ou com erro' },
    ]
    render(<MenuDownload opcoes={opcoes} aoEscolher={aoEscolher} />)

    await usuario.click(screen.getByRole('button', { name: /baixar projeto/i }))
    const itemSt = screen.getByRole('menuitem', { name: /structured text/i })

    expect(itemSt).toHaveAttribute('aria-disabled', 'true')
    expect(itemSt).toHaveAttribute('title', 'diagrama vazio ou com erro')
    expect(within(itemSt).getByText('diagrama vazio ou com erro')).toBeInTheDocument()

    await usuario.click(itemSt)

    expect(aoEscolher).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('com uma única opção (ex.: projeto ST), abre focando ela e escolher funciona', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    const opcoes: OpcaoDownload[] = [{ id: 'st', rotulo: 'Structured Text (.st)' }]
    render(<MenuDownload opcoes={opcoes} aoEscolher={aoEscolher} />)

    const botao = screen.getByRole('button', { name: /baixar projeto/i })
    await usuario.click(botao)

    const item = screen.getByRole('menuitem', { name: /structured text/i })
    expect(item).toHaveFocus()

    await usuario.keyboard('{ArrowDown}')
    expect(item).toHaveFocus()

    await usuario.click(item)
    expect(aoEscolher).toHaveBeenCalledWith('st')
    expect(botao).toHaveFocus()
  })
})
