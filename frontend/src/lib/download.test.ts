import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Projeto } from '../projeto/projeto'
import { baixarTexto, conteudoProjetoJson, nomeDeArquivo } from './download'

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
