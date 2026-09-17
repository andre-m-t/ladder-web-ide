import { describe, expect, it } from 'vitest'

import { LIMITE_ENTRADAS, novaEntrada, registrar } from './console'

describe('novaEntrada', () => {
  it('formata a hora como hh:mm:ss com zero à esquerda', () => {
    const entrada = novaEntrada('info', 'mensagem', new Date(2026, 0, 1, 8, 5, 9))

    expect(entrada.hora).toBe('08:05:09')
  })

  it('mantém o nível e a mensagem informados, para os quatro níveis', () => {
    for (const nivel of ['info', 'sucesso', 'aviso', 'erro'] as const) {
      const entrada = novaEntrada(nivel, `mensagem de ${nivel}`, new Date(2026, 0, 1, 0, 0, 0))
      expect(entrada.nivel).toBe(nivel)
      expect(entrada.mensagem).toBe(`mensagem de ${nivel}`)
    }
  })

  it('sem `agora`, usa o instante atual (não lança e devolve uma hora válida)', () => {
    const entrada = novaEntrada('info', 'x')
    expect(entrada.hora).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('registrar', () => {
  it('acrescenta com id sequencial crescente, preservando a ordem', () => {
    let entradas = registrar([], 'info', 'primeira')
    entradas = registrar(entradas, 'sucesso', 'segunda')

    expect(entradas.map((e) => e.id)).toEqual([1, 2])
    expect(entradas.map((e) => e.mensagem)).toEqual(['primeira', 'segunda'])
  })

  it('não muta a lista recebida', () => {
    const original: ReturnType<typeof registrar> = []
    const resultado = registrar(original, 'info', 'x')

    expect(original).toHaveLength(0)
    expect(resultado).toHaveLength(1)
  })

  it(`descarta as entradas mais antigas acima de ${LIMITE_ENTRADAS}`, () => {
    let entradas: ReturnType<typeof registrar> = []
    for (let i = 0; i < LIMITE_ENTRADAS + 10; i++) {
      entradas = registrar(entradas, 'info', `mensagem ${i}`)
    }

    expect(entradas).toHaveLength(LIMITE_ENTRADAS)
    expect(entradas[0].mensagem).toBe('mensagem 10')
    expect(entradas[entradas.length - 1].mensagem).toBe(`mensagem ${LIMITE_ENTRADAS + 9}`)
  })
})
