import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Diagrama } from './modelo'

function lerJson(): Diagrama {
  const pre = screen.getByTestId('json-diagrama')
  return JSON.parse(pre.textContent ?? '') as Diagrama
}

describe('App (spike S4 — SVG puro)', () => {
  it('coloca contato NA em (rung0, col0) e bobina em (rung0, col5) via UI, e rejeita bobina fora da última coluna sem alterar o modelo', async () => {
    const user = userEvent.setup()
    render(<App />)

    // 1) contato NA em (rung 0, col 0)
    await user.click(screen.getByRole('button', { name: 'Contato NA' }))
    await user.click(screen.getByTestId('celula-0-0'))

    // 2) bobina em (rung 0, col 5) — última coluna
    await user.click(screen.getByRole('button', { name: 'Bobina' }))
    await user.click(screen.getByTestId('celula-0-5'))

    await user.click(screen.getByRole('button', { name: 'Ler estrutura' }))
    const diagramaValido = lerJson()

    expect(diagramaValido.rungs[0].elementos).toHaveLength(2)
    expect(diagramaValido.rungs[0].elementos).toContainEqual({
      id: 'rung0-c0',
      tipo: 'contato_na',
      celula: { linha: 0, coluna: 0 },
      variavel: null,
    })
    expect(diagramaValido.rungs[0].elementos).toContainEqual({
      id: 'rung0-c5',
      tipo: 'bobina',
      celula: { linha: 0, coluna: 5 },
      variavel: null,
    })

    const jsonAntes = JSON.stringify(diagramaValido)

    // 3) tenta bobina fora da última coluna (rung 1, col 0) — deve ser rejeitado
    await user.click(screen.getByRole('button', { name: 'Bobina' }))
    await user.click(screen.getByTestId('celula-1-0'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Bobina só pode ser colocada na última coluna do rung.',
    )

    await user.click(screen.getByRole('button', { name: 'Ler estrutura' }))
    const diagramaDepois = lerJson()

    // modelo não mudou: rung 1 continua vazio e o resto é idêntico
    expect(diagramaDepois.rungs[1].elementos).toHaveLength(0)
    expect(JSON.stringify(diagramaDepois)).toBe(jsonAntes)
  })

  it('coloca elemento por teclado (Tab + Enter)', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Contato NA' }))
    const celula = screen.getByTestId('celula-2-1')
    celula.focus()
    expect(celula).toHaveFocus()
    await user.keyboard('{Enter}')

    await user.click(screen.getByRole('button', { name: 'Ler estrutura' }))
    const diagrama = lerJson()
    expect(diagrama.rungs[2].elementos).toContainEqual({
      id: 'rung2-c1',
      tipo: 'contato_na',
      celula: { linha: 0, coluna: 1 },
      variavel: null,
    })
  })
})
