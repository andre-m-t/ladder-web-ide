import { describe, expect, it } from 'vitest'

import { IO_ESPELHO, PORTAO } from '../ladder/fixtures'
import type { Diagrama } from '../ladder/modelo'
import { criarEstado } from '../ladder/simulacao'
import type { PontoAmbiente } from './contrato'
import {
  aplicarEntradasPlanta,
  declararVariaveisDoContrato,
  pontosSemVariavel,
  saidasPorEndereco,
  sugerirNomeVariavel,
} from './vinculo'
import { ENDERECO_ABRIR, PONTOS_PORTAO } from './portao'

describe('vinculo endereço', () => {
  it('saidasPorEndereco lê variáveis de saída', () => {
    const estado = criarEstado(IO_ESPELHO)
    const comEntrada = { ...estado, variaveis: { ...estado.variaveis, entrada: true, saida: true } }
    const mapa = saidasPorEndereco(IO_ESPELHO, comEntrada.variaveis)
    expect(mapa['%QX0.1']).toBe(true)
  })

  it('aplicarEntradasPlanta grava na variável de entrada', () => {
    const diagrama = {
      ...IO_ESPELHO,
      variaveis: [{ nome: 'abrir', tipo: 'BOOL' as const, endereco: ENDERECO_ABRIR }],
    }
    const estado = criarEstado(diagrama)
    const novo = aplicarEntradasPlanta(diagrama, estado, { [ENDERECO_ABRIR]: true })
    expect(novo.entradas.abrir).toBe(true)
  })
})

const VAZIO: Diagrama = { versao: 1, variaveis: [], rungs: [{ id: 'r1', elementos: [], ramos: [] }] }

function ponto(rotulo: string, extra: Partial<PontoAmbiente> = {}): PontoAmbiente {
  return { endereco: '%IX0.0', direcao: 'entrada', papel: 'sensor', rotulo, ...extra }
}

describe('criar variável pelo contrato (revisão 2026-09-23)', () => {
  it('pontosSemVariavel lista só os endereços sem variável declarada', () => {
    const faltando = pontosSemVariavel(IO_ESPELHO, PONTOS_PORTAO)
    expect(faltando.map((p) => p.endereco)).not.toContain('%IX0.1')
    expect(faltando.map((p) => p.endereco)).not.toContain('%QX0.1')
    expect(faltando).toHaveLength(PONTOS_PORTAO.length - 2)
    expect(pontosSemVariavel(PORTAO, PONTOS_PORTAO)).toEqual([])
  })

  it('usa o nomeSugerido do ponto — os do portão são os nomes da fixture PORTAO', () => {
    const nomes = PONTOS_PORTAO.map((p) => sugerirNomeVariavel(p, []))
    const daFixture = PONTOS_PORTAO.map((p) => PORTAO.variaveis.find((v) => v.endereco === p.endereco)?.nome)
    expect(nomes).toEqual(daFixture)
  })

  it('sem nomeSugerido, deriva do rótulo: sem acento, minúsculo, sem o parêntese', () => {
    expect(sugerirNomeVariavel(ponto('Botão de emergência'), [])).toBe('botao_de_emergencia')
    expect(sugerirNomeVariavel(ponto('FC1 (fim de curso superior)'), [])).toBe('fc1')
    expect(sugerirNomeVariavel(ponto('2º sensor'), [])).toBe('_2_sensor')
    expect(sugerirNomeVariavel(ponto('(—)'), [])).toBe('ponto')
  })

  it('colisão, inclusive só de maiúsculas, ganha sufixo numérico', () => {
    const p = ponto('Abrir', { nomeSugerido: 'abrir' })
    expect(sugerirNomeVariavel(p, [{ nome: 'ABRIR', tipo: 'BOOL' }])).toBe('abrir_2')
    expect(
      sugerirNomeVariavel(p, [
        { nome: 'abrir', tipo: 'BOOL' },
        { nome: 'abrir_2', tipo: 'BOOL' },
      ]),
    ).toBe('abrir_3')
  })

  it('declararVariaveisDoContrato declara todos os pontos faltantes com o endereço e o nome sugerido', () => {
    const resultado = declararVariaveisDoContrato(VAZIO, PONTOS_PORTAO)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.diagrama.variaveis).toEqual(PORTAO.variaveis)
    expect(VAZIO.variaveis).toEqual([])
  })

  it('declararVariaveisDoContrato preserva as existentes e desvia de nome já usado em outro endereço', () => {
    const base: Diagrama = { ...VAZIO, variaveis: [{ nome: 'abrir', tipo: 'BOOL', endereco: '%IX0.7' }] }
    const resultado = declararVariaveisDoContrato(base, PONTOS_PORTAO)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.diagrama.variaveis[0]).toEqual({ nome: 'abrir', tipo: 'BOOL', endereco: '%IX0.7' })
    expect(resultado.diagrama.variaveis.find((v) => v.endereco === ENDERECO_ABRIR)?.nome).toBe('abrir_2')
  })

  it('declararVariaveisDoContrato com contrato já completo devolve o diagrama sem variável nova', () => {
    const resultado = declararVariaveisDoContrato(PORTAO, PONTOS_PORTAO)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.diagrama.variaveis).toEqual(PORTAO.variaveis)
  })
})
