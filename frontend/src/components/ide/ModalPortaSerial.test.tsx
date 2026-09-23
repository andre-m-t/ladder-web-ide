import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PortaLike } from '../../lib/gravador'
import ModalPortaSerial from './ModalPortaSerial'
import type { SerialGerenciadorLike } from '../../lib/portasSeriais'

function porta(vendorId: number, productId: number): PortaLike {
  return {
    getInfo: () => ({ usbVendorId: vendorId, usbProductId: productId }),
  } as PortaLike
}

function serialFalso(opcoes: {
  portas?: PortaLike[]
  aoRequest?: () => Promise<PortaLike>
}): SerialGerenciadorLike {
  const lista = [...(opcoes.portas ?? [])]
  return {
    getPorts: vi.fn().mockImplementation(async () => [...lista]),
    requestPort: vi.fn().mockImplementation(async () => {
      const p = opcoes.aoRequest ? await opcoes.aoRequest() : porta(0x10c4, 1)
      if (!lista.some((x) => x === p)) lista.push(p)
      return p
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

describe('ModalPortaSerial', () => {
  it('mostra estado vazio e Gravar desabilitado sem portas', async () => {
    render(<ModalPortaSerial aoConfirmar={vi.fn()} aoCancelar={vi.fn()} serial={serialFalso({})} />)

    expect(screen.getByRole('dialog', { name: 'Porta serial do ESP32' })).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma porta autorizada/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Gravar' })).toBeDisabled()
    })
  })

  it('lista portas autorizadas e permite confirmar', async () => {
    const usuario = userEvent.setup()
    const p = porta(0x303a, 0x1001)
    const aoConfirmar = vi.fn()
    render(
      <ModalPortaSerial aoConfirmar={aoConfirmar} aoCancelar={vi.fn()} serial={serialFalso({ portas: [p] })} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Espressif/)).toBeInTheDocument()
    })
    await usuario.click(screen.getByRole('button', { name: 'Gravar' }))
    expect(aoConfirmar).toHaveBeenCalledWith(p)
  })

  it('Adicionar porta chama requestPort e seleciona a nova porta', async () => {
    const usuario = userEvent.setup()
    const nova = porta(0x1a86, 0x7523)
    const serial = serialFalso({ aoRequest: async () => nova })
    render(<ModalPortaSerial aoConfirmar={vi.fn()} aoCancelar={vi.fn()} serial={serial} />)

    await usuario.click(screen.getByRole('button', { name: 'Adicionar porta…' }))
    await waitFor(() => {
      expect(screen.getByText(/WCH CH340/)).toBeInTheDocument()
    })
    expect(serial.requestPort).toHaveBeenCalled()
  })

  it('Cancelar chama aoCancelar', async () => {
    const usuario = userEvent.setup()
    const aoCancelar = vi.fn()
    render(<ModalPortaSerial aoConfirmar={vi.fn()} aoCancelar={aoCancelar} serial={serialFalso({})} />)

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoCancelar).toHaveBeenCalledTimes(1)
  })

  it('Esc chama aoCancelar', async () => {
    const usuario = userEvent.setup()
    const aoCancelar = vi.fn()
    render(<ModalPortaSerial aoConfirmar={vi.fn()} aoCancelar={aoCancelar} serial={serialFalso({})} />)

    await usuario.keyboard('{Escape}')
    expect(aoCancelar).toHaveBeenCalledTimes(1)
  })
})
