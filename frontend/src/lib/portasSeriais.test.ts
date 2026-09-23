import { describe, expect, it, vi } from 'vitest'

import type { PortaLike } from './gravador'
import {
  idPorta,
  listarPortas,
  mesmaPorta,
  observarPortas,
  rotuloPorta,
  solicitarPorta,
  type SerialGerenciadorLike,
} from './portasSeriais'

function portaComVid(vendorId: number, productId: number): PortaLike {
  return {
    getInfo: () => ({ usbVendorId: vendorId, usbProductId: productId }),
  } as PortaLike
}

describe('rotuloPorta', () => {
  it('mapeia vendor IDs conhecidos', () => {
    expect(rotuloPorta(portaComVid(0x10c4, 0xea60))).toMatch(/Silicon Labs CP210x/)
    expect(rotuloPorta(portaComVid(0x1a86, 0x7523))).toMatch(/WCH CH340/)
    expect(rotuloPorta(portaComVid(0x0403, 0x6001))).toMatch(/FTDI/)
    expect(rotuloPorta(portaComVid(0x303a, 0x1001))).toMatch(/Espressif/)
  })

  it('mostra VID:PID para vendor desconhecido', () => {
    expect(rotuloPorta(portaComVid(0xabcd, 0x0001))).toMatch(/Dispositivo USB/)
    expect(rotuloPorta(portaComVid(0xabcd, 0x0001))).toContain('0xabcd')
  })

  it('retorna "Porta serial" sem info USB', () => {
    expect(rotuloPorta({})).toBe('Porta serial')
  })
})

describe('listarPortas', () => {
  it('delega a getPorts()', async () => {
    const p1 = portaComVid(1, 2)
    const serial: SerialGerenciadorLike = {
      getPorts: vi.fn().mockResolvedValue([p1]),
      requestPort: vi.fn(),
    }
    await expect(listarPortas(serial)).resolves.toEqual([p1])
  })
})

describe('solicitarPorta', () => {
  it('retorna a porta quando o usuário escolhe', async () => {
    const p = portaComVid(0x10c4, 1)
    const serial: SerialGerenciadorLike = {
      getPorts: vi.fn(),
      requestPort: vi.fn().mockResolvedValue(p),
    }
    await expect(solicitarPorta(serial)).resolves.toBe(p)
  })

  it('retorna null quando o usuário cancela (NotFoundError)', async () => {
    const serial: SerialGerenciadorLike = {
      getPorts: vi.fn(),
      requestPort: vi.fn().mockRejectedValue(new DOMException('cancelado', 'NotFoundError')),
    }
    await expect(solicitarPorta(serial)).resolves.toBeNull()
  })

  it('relança outros erros', async () => {
    const serial: SerialGerenciadorLike = {
      getPorts: vi.fn(),
      requestPort: vi.fn().mockRejectedValue(new Error('falha')),
    }
    await expect(solicitarPorta(serial)).rejects.toThrow('falha')
  })
})

describe('observarPortas', () => {
  it('registra connect e disconnect e limpa no cancelamento', () => {
    const add = vi.fn()
    const remove = vi.fn()
    const serial: SerialGerenciadorLike = {
      getPorts: vi.fn(),
      requestPort: vi.fn(),
      addEventListener: add,
      removeEventListener: remove,
    }
    const aoMudar = vi.fn()
    const parar = observarPortas(serial, aoMudar)
    expect(add).toHaveBeenCalledWith('connect', aoMudar)
    expect(add).toHaveBeenCalledWith('disconnect', aoMudar)
    parar()
    expect(remove).toHaveBeenCalledWith('connect', aoMudar)
    expect(remove).toHaveBeenCalledWith('disconnect', aoMudar)
  })
})

describe('idPorta e mesmaPorta', () => {
  it('compara por referência ou VID:PID', () => {
    const a = portaComVid(1, 2)
    const b = portaComVid(1, 2)
    expect(idPorta(a)).toBe('1:2')
    expect(mesmaPorta(a, a)).toBe(true)
    expect(mesmaPorta(a, b)).toBe(true)
  })
})
