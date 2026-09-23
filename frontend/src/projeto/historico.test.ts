import { describe, expect, it } from 'vitest'

import { criarHistorico, desfazer, podeDesfazer, podeRefazer, refazer, registrar } from './historico'

describe('historico', () => {
  it('registrar empilha e limpa o futuro', () => {
    const h0 = criarHistorico(1)
    const h1 = registrar(h0, 2)
    expect(h1.presente).toBe(2)
    expect(h1.passado).toEqual([1])
    const h2 = registrar(h1, 3)
    const d = desfazer(h2)
    expect(d?.presente).toBe(2)
    const r = refazer(d!)
    expect(r?.presente).toBe(3)
  })

  it('ignora registro idêntico ao presente', () => {
    const h = registrar(criarHistorico({ a: 1 }), { a: 1 })
    expect(h.passado).toHaveLength(0)
  })

  it('podeDesfazer e podeRefazer', () => {
    const h = registrar(criarHistorico('a'), 'b')
    expect(podeDesfazer(h)).toBe(true)
    expect(podeRefazer(h)).toBe(false)
  })
})
