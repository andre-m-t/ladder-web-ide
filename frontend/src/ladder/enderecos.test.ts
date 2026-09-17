import { describe, expect, it } from 'vitest'

import {
  classeDaVariavel,
  ehEntrada,
  enderecoValido,
  ENDERECOS_LOCALIZADOS,
  enderecosDaClasse,
  ENTRADAS_LOCALIZADAS,
  SAIDAS_LOCALIZADAS,
} from './enderecos'

describe('enderecoValido', () => {
  it('aceita endereços de ENDERECOS_LOCALIZADOS', () => {
    for (const endereco of ENDERECOS_LOCALIZADOS) {
      expect(enderecoValido(endereco)).toBe(true)
    }
  })

  it('recusa endereço fora da lista', () => {
    expect(enderecoValido('%QX9.9')).toBe(false)
  })
})

describe('ehEntrada', () => {
  it('true para %IX..., false para %QX...', () => {
    expect(ehEntrada('%IX0.0')).toBe(true)
    expect(ehEntrada('%QX0.0')).toBe(false)
  })
})

describe('classeDaVariavel', () => {
  it('sem endereço → interna', () => {
    expect(classeDaVariavel({})).toBe('interna')
  })

  it('%IX... → entrada', () => {
    expect(classeDaVariavel({ endereco: '%IX0.0' })).toBe('entrada')
  })

  it('%QX... → saida', () => {
    expect(classeDaVariavel({ endereco: '%QX0.0' })).toBe('saida')
  })
})

describe('enderecosDaClasse', () => {
  it('entrada → ENTRADAS_LOCALIZADAS', () => {
    expect(enderecosDaClasse('entrada')).toEqual(ENTRADAS_LOCALIZADAS)
  })

  it('saida → SAIDAS_LOCALIZADAS', () => {
    expect(enderecosDaClasse('saida')).toEqual(SAIDAS_LOCALIZADAS)
  })

  it('interna → []', () => {
    expect(enderecosDaClasse('interna')).toEqual([])
  })
})
