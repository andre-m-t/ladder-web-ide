import { describe, expect, it, vi } from 'vitest'

import type { Pacote } from './api'
import { gravar, webSerialDisponivel, type LoaderLike, type SerialLike } from './gravador'

/** Pacote de exemplo com offsets fora de ordem, para exercitar a ordenação por offset. */
const pacoteExemplo: Pacote = {
  chip: 'esp32',
  flash: { mode: 'dio', freq: '40m', size: '4MB' },
  images: [
    { name: 'app', offset: 65536, size: 4, sha256: 'app-sha', data_base64: btoa('AAAA') },
    { name: 'bootloader', offset: 4096, size: 4, sha256: 'boot-sha', data_base64: btoa('BOOT') },
    { name: 'partition-table', offset: 32768, size: 4, sha256: 'part-sha', data_base64: btoa('PART') },
  ],
}

function loaderFalsoBemSucedido(
  aoEscrever?: (opcoes: Parameters<LoaderLike['writeFlash']>[0]) => void,
): LoaderLike {
  return {
    main: vi.fn().mockResolvedValue('esp32'),
    writeFlash: vi.fn().mockImplementation(async (opcoes) => {
      aoEscrever?.(opcoes)
    }),
    after: vi.fn().mockResolvedValue(undefined),
    transport: { disconnect: vi.fn().mockResolvedValue(undefined) },
  }
}

describe('webSerialDisponivel', () => {
  it('retorna false quando o navegador (jsdom, no teste) não expõe navigator.serial', () => {
    expect(webSerialDisponivel()).toBe(false)
  })
})

describe('gravar', () => {
  it('rejeita com sem_web_serial quando não há Web Serial e nenhum `serial` é injetado', async () => {
    await expect(gravar(pacoteExemplo)).rejects.toMatchObject({ tipo: 'sem_web_serial' })
  })

  it('rejeita com porta_nao_selecionada quando requestPort() é cancelado pelo usuário (NotFoundError)', async () => {
    const serial: SerialLike = {
      requestPort: vi.fn().mockRejectedValue(new DOMException('cancelado pelo usuário', 'NotFoundError')),
    }

    await expect(gravar(pacoteExemplo, { serial })).rejects.toMatchObject({ tipo: 'porta_nao_selecionada' })
  })

  it('rejeita com falha_conexao quando ESPLoader.main() lança (sem bootloader)', async () => {
    const serial: SerialLike = { requestPort: vi.fn().mockResolvedValue({}) }
    const loader = loaderFalsoBemSucedido()
    loader.main = vi.fn().mockRejectedValue(new Error('sync falhou'))

    await expect(
      gravar(pacoteExemplo, { serial, criarLoader: () => loader }),
    ).rejects.toMatchObject({ tipo: 'falha_conexao' })
    expect(loader.transport.disconnect).toHaveBeenCalledTimes(1)
  })

  it('rejeita com porta_desconectada quando writeFlash lança NetworkError, e desconecta mesmo assim', async () => {
    const serial: SerialLike = { requestPort: vi.fn().mockResolvedValue({}) }
    const loader = loaderFalsoBemSucedido()
    loader.writeFlash = vi.fn().mockRejectedValue(new DOMException('device has been lost', 'NetworkError'))

    await expect(
      gravar(pacoteExemplo, { serial, criarLoader: () => loader }),
    ).rejects.toMatchObject({ tipo: 'porta_desconectada' })
    expect(loader.transport.disconnect).toHaveBeenCalledTimes(1)
  })

  it('rejeita com falha_gravacao para um erro genérico durante writeFlash', async () => {
    const serial: SerialLike = { requestPort: vi.fn().mockResolvedValue({}) }
    const loader = loaderFalsoBemSucedido()
    loader.writeFlash = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(
      gravar(pacoteExemplo, { serial, criarLoader: () => loader }),
    ).rejects.toMatchObject({ tipo: 'falha_gravacao' })
    expect(loader.transport.disconnect).toHaveBeenCalledTimes(1)
  })

  it('monta o fileArray com os offsets e os dados do pacote, em ordem crescente de offset', async () => {
    const serial: SerialLike = { requestPort: vi.fn().mockResolvedValue({}) }
    let recebido: { data: Uint8Array; address: number }[] = []
    const loader = loaderFalsoBemSucedido((opcoes) => {
      recebido = opcoes.fileArray
    })

    await gravar(pacoteExemplo, { serial, criarLoader: () => loader })

    expect(recebido.map((arquivo) => arquivo.address)).toEqual([4096, 32768, 65536])
    expect(new TextDecoder().decode(recebido[0].data)).toBe('BOOT')
    expect(new TextDecoder().decode(recebido[1].data)).toBe('PART')
    expect(new TextDecoder().decode(recebido[2].data)).toBe('AAAA')
  })

  it('reporta progresso agregado até 100% e chama disconnect ao final', async () => {
    const serial: SerialLike = { requestPort: vi.fn().mockResolvedValue({}) }
    const loader = loaderFalsoBemSucedido((opcoes) => {
      opcoes.fileArray.forEach((arquivo, indice) => {
        opcoes.reportProgress?.(indice, arquivo.data.length, arquivo.data.length)
      })
    })
    const progresso: number[] = []

    await gravar(pacoteExemplo, { serial, criarLoader: () => loader, onProgresso: (p) => progresso.push(p) })

    expect(progresso[progresso.length - 1]).toBe(100)
    expect(loader.transport.disconnect).toHaveBeenCalledTimes(1)
    expect(loader.after).toHaveBeenCalledWith('hard_reset')
  })
})
