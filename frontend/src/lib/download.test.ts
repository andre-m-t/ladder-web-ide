import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Pacote } from './api'
import type { Projeto } from '../projeto/projeto'
import {
  baixarTexto,
  conteudoGravacaoTxt,
  conteudoManifestEspWebTools,
  conteudoProjetoJson,
  montarZipFirmware,
  nomeDeArquivo,
} from './download'

describe('nomeDeArquivo', () => {
  it('remove acentos e passa para minúsculo', () => {
    expect(nomeDeArquivo('Semáforo 2', 'st')).toBe('semaforo-2.st')
  })

  it('troca espaços por hífen', () => {
    expect(nomeDeArquivo('Meu Projeto Ladder', 'json')).toBe('meu-projeto-ladder.json')
  })

  it('troca símbolos por hífen e colapsa repetições', () => {
    expect(nomeDeArquivo('Esteira #1 / v2!!', 'st')).toBe('esteira-1-v2.st')
  })

  it('apara hífens das pontas', () => {
    expect(nomeDeArquivo('  -- Projeto -- ', 'st')).toBe('projeto.st')
  })

  it('título vazio vira "projeto"', () => {
    expect(nomeDeArquivo('', 'st')).toBe('projeto.st')
  })

  it('título só com símbolos vira "projeto"', () => {
    expect(nomeDeArquivo('###!!!', 'json')).toBe('projeto.json')
  })

  it('aceita extensão com múltiplas partes', () => {
    expect(nomeDeArquivo('Projeto', 'ladderflow.json')).toBe('projeto.ladderflow.json')
  })
})

describe('conteudoProjetoJson', () => {
  it('serializa com indentação de 2 espaços, terminado em \\n, e o roundtrip é igual ao projeto', () => {
    const projeto: Projeto = {
      versao: 1,
      titulo: 'Sem título',
      linguagem: 'ld',
      diagrama: { versao: 2, rungs: [], variaveis: [] },
    }

    const conteudo = conteudoProjetoJson(projeto)

    expect(conteudo.endsWith('\n')).toBe(true)
    expect(conteudo).toContain('  "versao": 1')
    expect(JSON.parse(conteudo)).toEqual(projeto)
  })

  it('serializa projeto ST igualmente', () => {
    const projeto: Projeto = { versao: 1, titulo: 'Meu ST', linguagem: 'st', fonte: 'PROGRAM prog0\nEND_PROGRAM\n' }

    const conteudo = conteudoProjetoJson(projeto)

    expect(JSON.parse(conteudo)).toEqual(projeto)
    expect(conteudo.endsWith('\n')).toBe(true)
  })
})

const PACOTE_ZIP: Pacote = {
  chip: 'esp32',
  flash: { mode: 'dio', freq: '40m', size: '4MB' },
  images: [
    {
      name: 'bootloader',
      offset: 0x1000,
      size: 3,
      sha256: 'a'.repeat(64),
      data_base64: btoa('BOT'),
    },
    {
      name: 'partition-table',
      offset: 0x8000,
      size: 4,
      sha256: 'b'.repeat(64),
      data_base64: btoa('PART'),
    },
    {
      name: 'app',
      offset: 0x10000,
      size: 7,
      sha256: 'c'.repeat(64),
      data_base64: btoa('APP-BIN'),
    },
  ],
}

describe('conteudoGravacaoTxt', () => {
  it('lista offsets reais e inclui exemplo de esptool', () => {
    const texto = conteudoGravacaoTxt(PACOTE_ZIP)
    expect(texto).toContain('0x1000  bootloader.bin')
    expect(texto).toContain('0x8000  partition-table.bin')
    expect(texto).toContain('0x10000  ladderflow_plc.bin')
    expect(texto).toContain('esptool.py --chip esp32')
    expect(texto).toContain('0x1000 bootloader.bin 0x8000 partition-table.bin 0x10000 ladderflow_plc.bin')
  })
})

describe('conteudoManifestEspWebTools', () => {
  it('lista parts com offsets decimais e chipFamily ESP32', () => {
    const manifest = JSON.parse(conteudoManifestEspWebTools(PACOTE_ZIP)) as {
      name: string
      builds: { chipFamily: string; parts: { path: string; offset: number }[] }[]
    }
    expect(manifest.name).toBe('LadderFlow')
    expect(manifest.builds).toHaveLength(1)
    expect(manifest.builds[0].chipFamily).toBe('ESP32')
    expect(manifest.builds[0].parts).toEqual([
      { path: 'bootloader.bin', offset: 4096 },
      { path: 'partition-table.bin', offset: 32768 },
      { path: 'ladderflow_plc.bin', offset: 65536 },
    ])
  })
})

describe('montarZipFirmware', () => {
  it('produz um ZIP válido com as três imagens, manifest.json e gravacao.txt', async () => {
    const zip = montarZipFirmware(PACOTE_ZIP)
    expect(zip.type).toBe('application/zip')

    const bytes = new Uint8Array(await zip.arrayBuffer())
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)

    const nomes = [
      'bootloader.bin',
      'partition-table.bin',
      'ladderflow_plc.bin',
      'manifest.json',
      'gravacao.txt',
    ]
    for (const nome of nomes) {
      const marcador = new TextEncoder().encode(nome)
      let encontrado = false
      for (let i = 0; i <= bytes.length - marcador.length; i++) {
        if (marcador.every((byte, j) => bytes[i + j] === byte)) {
          encontrado = true
          break
        }
      }
      expect(encontrado).toBe(true)
    }
  })
})

describe('baixarTexto', () => {
  let urlsCriadas: string[]
  let cliqueSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    urlsCriadas = []
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => {
          const url = `blob:fake-${urlsCriadas.length}`
          urlsCriadas.push(url)
          return url
        }),
        revokeObjectURL: vi.fn(),
      }),
    )
    cliqueSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cliqueSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('cria um <a download> com o nome e a URL do blob, e clica nele', () => {
    baixarTexto('projeto.st', 'PROGRAM prog0\nEND_PROGRAM\n', 'text/plain;charset=utf-8')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    const blobPassado = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    expect(blobPassado.type).toBe('text/plain;charset=utf-8')

    expect(cliqueSpy).toHaveBeenCalledTimes(1)
  })

  it('anexa o link ao body antes de clicar e o remove depois', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    baixarTexto('dados.json', '{}', 'application/json')

    expect(appendSpy).toHaveBeenCalledTimes(1)
    const linkAnexado = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(linkAnexado.tagName).toBe('A')
    expect(linkAnexado.download).toBe('dados.json')
    expect(linkAnexado.href).toBe(urlsCriadas[0])

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy.mock.calls[0][0]).toBe(linkAnexado)

    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('revoga a URL do objeto após o download (adiado)', () => {
    baixarTexto('dados.json', '{}', 'application/json')

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(urlsCriadas[0])
  })
})
