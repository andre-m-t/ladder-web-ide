import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'
import { ALTURA_CELULA, xDaColuna, yDoRung } from './layout'

// Tentativa de teste via UI, disparando eventos de mouse diretamente no
// <canvas> do Konva nas coordenadas de tela conhecidas (calculadas com as
// mesmas funções de layout que o App usa para desenhar). Ver MEDICOES.md
// item 3 para o que isso exigiu (ou não) em jsdom.
function centroDaCelula(rung: number, coluna: number) {
  return {
    x: xDaColuna(coluna) + 45,
    y: yDoRung(rung) + ALTURA_CELULA / 2,
  }
}

function clicarNaCelula(canvas: HTMLCanvasElement, rung: number, coluna: number) {
  const { x, y } = centroDaCelula(rung, coluna)
  fireEvent.mouseDown(canvas, { clientX: x, clientY: y, button: 0 })
  fireEvent.mouseUp(canvas, { clientX: x, clientY: y, button: 0 })
  fireEvent.click(canvas, { clientX: x, clientY: y, button: 0 })
}

describe('App (via UI/canvas)', () => {
  it('coloca contato em (rung 0, col 0) e bobina em (rung 0, col 5), e lê a estrutura resultante', async () => {
    const usuario = userEvent.setup()
    const { container } = render(<App />)

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()

    // ferramenta padrão já é "Contato NA"
    clicarNaCelula(canvas!, 0, 0)

    await usuario.click(screen.getByRole('button', { name: 'Bobina' }))
    clicarNaCelula(canvas!, 0, 5)

    await usuario.click(screen.getByRole('button', { name: 'Ler estrutura' }))

    const pre = await screen.findByTestId('estrutura')
    const diagrama = JSON.parse(pre.textContent ?? '{}')
    const rung0 = diagrama.rungs[0]
    expect(rung0.elementos).toHaveLength(2)
    expect(rung0.elementos[0]).toMatchObject({ tipo: 'contato_na', celula: { linha: 0, coluna: 0 } })
    expect(rung0.elementos[1]).toMatchObject({ tipo: 'bobina', celula: { linha: 0, coluna: 5 } })
  })

  it('bobina na coluna 0 não altera o modelo e mostra aviso', async () => {
    const usuario = userEvent.setup()
    const { container } = render(<App />)
    const canvas = container.querySelector('canvas')!

    await usuario.click(screen.getByRole('button', { name: 'Bobina' }))
    clicarNaCelula(canvas, 0, 0)

    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Ler estrutura' }))
    const pre = await screen.findByTestId('estrutura')
    const diagrama = JSON.parse(pre.textContent ?? '{}')
    expect(diagrama.rungs[0].elementos).toHaveLength(0)
  })

  it('coloca elemento por teclado (Tab até a grade, setas movem o foco, Enter coloca)', async () => {
    const usuario = userEvent.setup()
    render(<App />)

    await usuario.click(screen.getByRole('button', { name: 'Bobina' }))

    const grade = screen.getByTestId('grade')
    grade.focus()
    expect(grade).toHaveFocus()

    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(grade, { key: 'ArrowRight' })
    }
    fireEvent.keyDown(grade, { key: 'Enter' })

    await usuario.click(screen.getByRole('button', { name: 'Ler estrutura' }))
    const pre = await screen.findByTestId('estrutura')
    const diagrama = JSON.parse(pre.textContent ?? '{}')
    expect(diagrama.rungs[0].elementos).toEqual([
      expect.objectContaining({ tipo: 'bobina', celula: { linha: 0, coluna: 5 } }),
    ])
  })
})
