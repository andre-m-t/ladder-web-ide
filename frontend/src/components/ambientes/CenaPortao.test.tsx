import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ABERTURA_MAX, ABERTURA_MIN, criarEstadoPortao } from '../../ambientes/portao'
import CenaPortao from './CenaPortao'

/** Verde vivo usado pelo `SensorFc` quando o fim de curso está ativo (detectando). */
const VERDE_ACESO = '#2ecc71'

/**
 * Revisão 2026-09-23 (spec 005, §10): o FC superior é NA, mas — diferente do
 * FC inferior — detecta a **presença da lona** no ponto fixo junto ao
 * tambor, não "a folha chegou a esta extremidade". Fechado e entreaberto
 * ainda têm lona passando por ali (contato fechado, aceso); só ao abrir
 * totalmente a lona se afasta do ponto e o contato abre (apaga). O teste
 * desta suíte que antes dizia "aberto: FC superior aceso" tinha a leitura
 * simétrica de FC inferior — incorreta para este sensor; ver nota datada
 * na spec 005 e o JSDoc de `nivelFcSuperior` em `ambientes/portao.ts`.
 */
describe('CenaPortao — fins de curso NA (aceso = detectando)', () => {
  it('portão fechado (abertura mínima): FC inferior e FC superior acesos (lona ainda passa pelos dois pontos)', () => {
    const estado = { ...criarEstadoPortao(), abertura: ABERTURA_MIN }
    const { container } = render(
      <CenaPortao estado={estado} saidas={{}} simulacaoAtiva aoComando={vi.fn()} />,
    )
    const retangulos = Array.from(container.querySelectorAll('rect'))
    const acesos = retangulos.filter((r) => r.getAttribute('fill') === VERDE_ACESO)
    expect(acesos).toHaveLength(2)
  })

  it('portão aberto (abertura máxima): nenhum fim de curso aceso (lona liberou os dois pontos)', () => {
    const estado = { ...criarEstadoPortao(), abertura: ABERTURA_MAX }
    const { container } = render(
      <CenaPortao estado={estado} saidas={{}} simulacaoAtiva aoComando={vi.fn()} />,
    )
    const retangulos = Array.from(container.querySelectorAll('rect'))
    const acesos = retangulos.filter((r) => r.getAttribute('fill') === VERDE_ACESO)
    expect(acesos).toHaveLength(0)
  })

  it('portão entreaberto: só o FC superior aceso (lona ainda passa pelo ponto do tambor)', () => {
    const estado = { ...criarEstadoPortao(), abertura: 50 }
    const { container } = render(
      <CenaPortao estado={estado} saidas={{}} simulacaoAtiva aoComando={vi.fn()} />,
    )
    const retangulos = Array.from(container.querySelectorAll('rect'))
    const acesos = retangulos.filter((r) => r.getAttribute('fill') === VERDE_ACESO)
    expect(acesos).toHaveLength(1)
  })
})
