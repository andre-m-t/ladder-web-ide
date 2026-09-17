import { describe, expect, it } from 'vitest'

import {
  classeDaVariavel,
  ehEntrada,
  enderecoValido,
  ENDERECOS_LOCALIZADOS,
  enderecosDaClasse,
  ENTRADAS_LOCALIZADAS,
  GPIO_DO_ENDERECO,
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

describe('pinagem 8/8 (revisão 2026-09-17 da Q-5)', () => {
  it('ENTRADAS_LOCALIZADAS tem %IX0.0 a %IX0.7', () => {
    expect(ENTRADAS_LOCALIZADAS).toEqual([
      '%IX0.0',
      '%IX0.1',
      '%IX0.2',
      '%IX0.3',
      '%IX0.4',
      '%IX0.5',
      '%IX0.6',
      '%IX0.7',
    ])
  })

  it('SAIDAS_LOCALIZADAS tem %QX0.0 a %QX0.7', () => {
    expect(SAIDAS_LOCALIZADAS).toEqual([
      '%QX0.0',
      '%QX0.1',
      '%QX0.2',
      '%QX0.3',
      '%QX0.4',
      '%QX0.5',
      '%QX0.6',
      '%QX0.7',
    ])
  })
})

describe('GPIO_DO_ENDERECO', () => {
  it('tem uma entrada para cada endereço localizado, sem sobrar nenhuma', () => {
    expect(Object.keys(GPIO_DO_ENDERECO).sort()).toEqual([...ENDERECOS_LOCALIZADOS].sort())
  })

  it('mantém os quatro GPIOs já revisados em 2026-09-15', () => {
    expect(GPIO_DO_ENDERECO['%IX0.0']).toBe(0)
    expect(GPIO_DO_ENDERECO['%IX0.1']).toBe(18)
    expect(GPIO_DO_ENDERECO['%QX0.0']).toBe(2)
    expect(GPIO_DO_ENDERECO['%QX0.1']).toBe(4)
  })

  it('mapeia os oito GPIOs novos da revisão 2026-09-17', () => {
    expect(GPIO_DO_ENDERECO['%IX0.2']).toBe(19)
    expect(GPIO_DO_ENDERECO['%IX0.3']).toBe(21)
    expect(GPIO_DO_ENDERECO['%IX0.4']).toBe(22)
    expect(GPIO_DO_ENDERECO['%IX0.5']).toBe(23)
    expect(GPIO_DO_ENDERECO['%IX0.6']).toBe(32)
    expect(GPIO_DO_ENDERECO['%IX0.7']).toBe(33)
    expect(GPIO_DO_ENDERECO['%QX0.2']).toBe(16)
    expect(GPIO_DO_ENDERECO['%QX0.3']).toBe(17)
    expect(GPIO_DO_ENDERECO['%QX0.4']).toBe(25)
    expect(GPIO_DO_ENDERECO['%QX0.5']).toBe(26)
    expect(GPIO_DO_ENDERECO['%QX0.6']).toBe(27)
    expect(GPIO_DO_ENDERECO['%QX0.7']).toBe(13)
  })
})
