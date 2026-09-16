import { describe, expect, it } from 'vitest'

import { diagramaInicial, tentarColocar } from './regras'

// Testes da lógica pura de colocação, independentes de Konva/DOM — ver
// MEDICOES.md item 3 para o porquê de a lógica estar separada da UI.
describe('regras de colocação', () => {
  it('coloca um contato NA na coluna 0 e uma bobina na última coluna do rung', () => {
    let diagrama = diagramaInicial()

    const r1 = tentarColocar(diagrama, 'rung-0', { linha: 0, coluna: 0 }, 'contato_na')
    expect(r1.erro).toBeNull()
    diagrama = r1.diagrama

    const r2 = tentarColocar(diagrama, 'rung-0', { linha: 0, coluna: 5 }, 'bobina')
    expect(r2.erro).toBeNull()
    diagrama = r2.diagrama

    const rung0 = diagrama.rungs.find((r) => r.id === 'rung-0')!
    expect(rung0.elementos).toEqual([
      expect.objectContaining({ tipo: 'contato_na', celula: { linha: 0, coluna: 0 } }),
      expect.objectContaining({ tipo: 'bobina', celula: { linha: 0, coluna: 5 } }),
    ])
  })

  it('rejeita bobina fora da última coluna e não altera o modelo', () => {
    const diagrama = diagramaInicial()

    const resultado = tentarColocar(diagrama, 'rung-0', { linha: 0, coluna: 0 }, 'bobina')

    expect(resultado.erro).not.toBeNull()
    expect(resultado.diagrama).toBe(diagrama)
    expect(resultado.diagrama.rungs[0].elementos).toHaveLength(0)
  })

  it('rejeita contato na última coluna (reservada à bobina)', () => {
    const diagrama = diagramaInicial()

    const resultado = tentarColocar(diagrama, 'rung-0', { linha: 0, coluna: 5 }, 'contato_na')

    expect(resultado.erro).not.toBeNull()
    expect(resultado.diagrama).toBe(diagrama)
  })

  it('rejeita colocar em célula já ocupada', () => {
    let diagrama = diagramaInicial()
    diagrama = tentarColocar(diagrama, 'rung-0', { linha: 0, coluna: 0 }, 'contato_na').diagrama

    const resultado = tentarColocar(diagrama, 'rung-0', { linha: 0, coluna: 0 }, 'contato_na')

    expect(resultado.erro).not.toBeNull()
    expect(resultado.diagrama).toBe(diagrama)
  })
})
