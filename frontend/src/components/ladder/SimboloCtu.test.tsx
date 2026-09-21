import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SimboloCtu, { type SimboloCtuProps } from './SimboloCtu'

/** Nenhuma cor Tailwind fixa (plano §13, D-13): só tokens `ide-*`. */
const COR_FIXA = /\b(slate|sky|red|emerald|amber)-\d/

const PROPS_BASE: SimboloCtuProps = {
  cx: 100,
  yTopo: 0,
  yBase: 128,
  largura: 64,
  yEntradaCu: 32,
  yEntradaR: 96,
  instancia: 'ctu0',
  pv: 12,
  saida: 'atingiu',
  selecionado: false,
}

describe('SimboloCtu — conteúdo', () => {
  it('mostra o rótulo CTU, a instância, o limite (PV) e a saída vinculada', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} />
      </svg>,
    )

    expect(container.textContent).toContain('CTU')
    expect(container.textContent).toContain('ctu0')
    expect(container.textContent).toContain('PV=12')
    expect(container.textContent).toContain('Q → atingiu')
  })

  it('sem saída vinculada, mostra "Q → ?"', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} saida={null} />
      </svg>,
    )

    expect(container.textContent).toContain('Q → ?')
  })

  it('mostra os rótulos das entradas CU e R', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} />
      </svg>,
    )

    const textos = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(textos).toContain('CU')
    expect(textos).toContain('R')
  })

  it('com endereço, mostra o endereço da saída (como os outros símbolos)', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} endereco="%QX0.0" />
      </svg>,
    )

    expect(container.textContent).toContain('%QX0.0')
  })

  it('sem endereço, não mostra endereço nenhum', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} endereco={null} />
      </svg>,
    )

    const textos = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(textos.some((t) => t?.startsWith('%'))).toBe(false)
  })

  it('a caixa (rect) fica entre yTopo e yBase, ocupando a coluna terminal', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} />
      </svg>,
    )

    const rect = container.querySelector('rect') as SVGRectElement
    expect(Number(rect.getAttribute('y'))).toBeGreaterThanOrEqual(PROPS_BASE.yTopo)
    expect(Number(rect.getAttribute('y')) + Number(rect.getAttribute('height'))).toBeLessThanOrEqual(PROPS_BASE.yBase)
  })
})

describe('SimboloCtu — estados (perigo > fantasma > selecionado > normal)', () => {
  it('selecionado usa o traço de destaque', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} selecionado />
      </svg>,
    )

    expect(container.querySelector('rect')?.getAttribute('class')).toContain('stroke-ide-destaque')
  })

  it('fantasma usa o traço de prévia com opacidade reduzida, e some com endereço/saída', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} fantasma endereco="%QX0.0" />
      </svg>,
    )

    expect(container.querySelector('rect')?.getAttribute('class')).toContain('stroke-ide-previa')
    expect(container.textContent).not.toContain('%QX0.0')
    expect(container.textContent).not.toContain('Q → ')
  })

  it('perigo tem precedência sobre selecionado', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} selecionado perigo />
      </svg>,
    )

    const classe = container.querySelector('rect')?.getAttribute('class')
    expect(classe).toContain('stroke-ide-perigo')
    expect(classe).not.toContain('stroke-ide-destaque')
  })

  it('nenhuma classe de cor fixa (só tokens ide-*), em qualquer combinação de estado', () => {
    const { container } = render(
      <svg>
        <SimboloCtu {...PROPS_BASE} selecionado />
        <SimboloCtu {...PROPS_BASE} fantasma />
        <SimboloCtu {...PROPS_BASE} perigo />
      </svg>,
    )

    expect(container.innerHTML).not.toMatch(COR_FIXA)
  })
})
