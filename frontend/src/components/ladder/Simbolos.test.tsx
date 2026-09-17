import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Bobina, ContatoNA, ContatoNF } from './Simbolos'

const PROPS_BASE = { cx: 20, cy: 20, variavel: 'M1', selecionado: false }

/** Nenhuma cor Tailwind fixa (plano §13, D-13): só tokens `ide-*`. */
const COR_FIXA = /\b(slate|sky|red|emerald|amber)-\d/

describe('Simbolos', () => {
  it('renderiza o rótulo da variável por padrão', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} />
      </svg>,
    )

    expect(container.querySelector('text')).not.toBeNull()
    expect(container.querySelector('text')?.textContent).toBe('M1')
  })

  it('semRotulo não desenha o nome da variável', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} semRotulo />
      </svg>,
    )

    expect(container.querySelector('text')).toBeNull()
  })

  it('fantasma não desenha o nome da variável (implica semRotulo)', () => {
    const { container } = render(
      <svg>
        <ContatoNF {...PROPS_BASE} fantasma />
      </svg>,
    )

    expect(container.querySelector('text')).toBeNull()
  })

  it('fantasma aplica traço ide-previa com opacidade reduzida', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} fantasma />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-previa')
    expect(linha?.getAttribute('class')).toContain('opacity-50')
  })

  it('perigo aplica traço ide-perigo', () => {
    const { container } = render(
      <svg>
        <Bobina {...PROPS_BASE} perigo />
      </svg>,
    )

    const traco = container.querySelector('path')
    expect(traco?.getAttribute('class')).toContain('stroke-ide-perigo')
  })

  it('perigo tem precedência sobre fantasma e selecionado', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} selecionado fantasma perigo />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-perigo')
    expect(linha?.getAttribute('class')).not.toContain('stroke-ide-previa')
    expect(linha?.getAttribute('class')).not.toContain('stroke-ide-destaque')
  })

  it('perigo também pinta o rótulo da variável de vermelho (ide-perigo) quando ele é desenhado', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} perigo />
      </svg>,
    )

    const texto = container.querySelector('text')
    expect(texto?.getAttribute('class')).toContain('fill-ide-perigo')
  })

  it('sem props novas, renderiza igual ao comportamento anterior (selecionado altera cor)', () => {
    const { container: semSelecao } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} />
      </svg>,
    )
    const { container: comSelecao } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} selecionado />
      </svg>,
    )

    expect(semSelecao.querySelector('line')?.getAttribute('class')).toContain('stroke-ide-fio')
    expect(comSelecao.querySelector('line')?.getAttribute('class')).toContain('stroke-ide-destaque')
  })

  it('endereço aparece em texto monoespaçado acima do nome, quando presente', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} endereco="%IX0.1" />
      </svg>,
    )

    const textos = container.querySelectorAll('text')
    expect(textos).toHaveLength(2)
    expect(textos[0].textContent).toBe('%IX0.1')
    expect(textos[0].getAttribute('class')).toContain('font-mono')
    expect(textos[1].textContent).toBe('M1')
    // endereço fica acima do nome (y menor = mais para cima no SVG)
    expect(Number(textos[0].getAttribute('y'))).toBeLessThan(Number(textos[1].getAttribute('y')))
  })

  it('sem endereço, mostra só o nome (uma linha)', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} endereco={null} />
      </svg>,
    )

    expect(container.querySelectorAll('text')).toHaveLength(1)
  })

  it('sem variável vinculada, mostra "?" mesmo com semRotulo ausente', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} variavel={null} />
      </svg>,
    )

    expect(container.querySelector('text')?.textContent).toBe('?')
  })

  it('nenhuma classe de cor fixa (só tokens ide-*), em qualquer combinação de estado', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} endereco="%IX0.1" selecionado />
        <ContatoNF {...PROPS_BASE} fantasma />
        <Bobina {...PROPS_BASE} perigo />
      </svg>,
    )

    expect(container.innerHTML).not.toMatch(COR_FIXA)
  })
})
