import { describe, expect, it } from 'vitest'

import {
  ABERTURA_MIN,
  ABERTURA_MAX,
  avancarPortao,
  criarEstadoPortao,
  ENDERECO_FC_INFERIOR,
  ENDERECO_FC_SUPERIOR,
  ENDERECO_MOTOR_DESCE,
  ENDERECO_MOTOR_SOBE,
  ENDERECO_ABRIR,
  MARGEM_FC,
  PASSO_ABERTURA_POR_CICLO,
  acionarComandoPortao,
} from './portao'

describe('planta portão', () => {
  it('sobe com motor sobe comandado', () => {
    const estado = criarEstadoPortao()
    const r = avancarPortao(estado, { [ENDERECO_MOTOR_SOBE]: true })
    expect(r.estado.abertura).toBeGreaterThan(ABERTURA_MIN)
    expect(r.falha).toBeNull()
  })

  it('marca motor danificado com sobe e desce juntos', () => {
    const estado = criarEstadoPortao()
    const r = avancarPortao(estado, {
      [ENDERECO_MOTOR_SOBE]: true,
      [ENDERECO_MOTOR_DESCE]: true,
    })
    expect(r.falha).not.toBeNull()
    expect(r.estado.motorDanificado).toBe(true)
  })

  it('botão abrir reflete no endereço de entrada', () => {
    const estado = acionarComandoPortao(criarEstadoPortao(), 'abrir', true)
    const r = avancarPortao(estado, {})
    expect(r.entradas[ENDERECO_ABRIR]).toBe(true)
  })

  it('fim de curso superior (NA) false no topo — lona saiu do ponto do sensor (revisão 2026-09-23)', () => {
    let estado = criarEstadoPortao()
    for (let i = 0; i < 200; i++) {
      estado = avancarPortao(estado, { [ENDERECO_MOTOR_SOBE]: true }).estado
      if (estado.motorDanificado) break
    }
    expect(estado.abertura).toBeGreaterThanOrEqual(ABERTURA_MAX - MARGEM_FC - PASSO_ABERTURA_POR_CICLO)
    const ent = avancarPortao(estado, {}).entradas
    expect(ent[ENDERECO_FC_SUPERIOR]).toBe(false)
  })

  it('fim de curso superior (NA) true enquanto fechado ou entreaberto — lona ainda passa pelo sensor', () => {
    const fechado = avancarPortao(criarEstadoPortao(), {}).entradas
    expect(fechado[ENDERECO_FC_SUPERIOR]).toBe(true)

    let entreaberto = criarEstadoPortao()
    for (let i = 0; i < 90; i++) {
      entreaberto = avancarPortao(entreaberto, { [ENDERECO_MOTOR_SOBE]: true }).estado
    }
    const ent = avancarPortao(entreaberto, {}).entradas
    expect(entreaberto.abertura).toBeGreaterThan(ABERTURA_MIN)
    expect(entreaberto.abertura).toBeLessThan(ABERTURA_MAX - MARGEM_FC)
    expect(ent[ENDERECO_FC_SUPERIOR]).toBe(true)
  })

  it('fim de curso inferior true quando fechado', () => {
    const estado = criarEstadoPortao()
    const ent = avancarPortao(estado, {}).entradas
    expect(ent[ENDERECO_FC_INFERIOR]).toBe(true)
  })

  it('não danifica o motor só porque o FC superior já ligou na margem', () => {
    let estado = criarEstadoPortao()
    while (estado.abertura < ABERTURA_MAX - MARGEM_FC) {
      estado = avancarPortao(estado, { [ENDERECO_MOTOR_SOBE]: true }).estado
    }
    const r = avancarPortao(estado, { [ENDERECO_MOTOR_SOBE]: true })
    expect(r.estado.motorDanificado).toBe(false)
    expect(r.estado.abertura).toBeLessThan(ABERTURA_MAX)
  })

  it('danifica o motor ao forçar no batente superior', () => {
    let estado = criarEstadoPortao()
    for (let i = 0; i < 250; i++) {
      const passo = avancarPortao(estado, { [ENDERECO_MOTOR_SOBE]: true })
      estado = passo.estado
      if (passo.estado.motorDanificado) break
    }
    expect(estado.motorDanificado).toBe(true)
    expect(estado.abertura).toBe(ABERTURA_MAX)
  })

  it('descer reduz abertura', () => {
    let estado = criarEstadoPortao()
    for (let i = 0; i < 30; i++) {
      estado = avancarPortao(estado, { [ENDERECO_MOTOR_SOBE]: true }).estado
    }
    const antes = estado.abertura
    estado = avancarPortao(estado, { [ENDERECO_MOTOR_DESCE]: true }).estado
    expect(estado.abertura).toBeLessThan(antes)
  })
})
