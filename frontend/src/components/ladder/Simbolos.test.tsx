import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Bobina, ContatoNA, ContatoNF } from './Simbolos'

const PROPS_BASE = { cx: 20, cy: 20, variavel: 'M1', selecionado: false }

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

  it('fantasma aplica traço sky com opacidade reduzida', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} fantasma />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-sky-500')
    expect(linha?.getAttribute('class')).toContain('opacity-50')
  })

  it('perigo aplica traço vermelho', () => {
    const { container } = render(
      <svg>
        <Bobina {...PROPS_BASE} perigo />
      </svg>,
    )

    const traco = container.querySelector('path')
    expect(traco?.getAttribute('class')).toContain('stroke-red-600')
  })

  it('perigo tem precedência sobre fantasma e selecionado', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} selecionado fantasma perigo />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-red-600')
    expect(linha?.getAttribute('class')).not.toContain('stroke-sky-500')
    expect(linha?.getAttribute('class')).not.toContain('stroke-sky-600')
  })

  it('perigo também pinta o rótulo da variável de vermelho quando ele é desenhado', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} perigo />
      </svg>,
    )

    const texto = container.querySelector('text')
    expect(texto?.getAttribute('class')).toContain('fill-red-600')
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

    expect(semSelecao.querySelector('line')?.getAttribute('class')).toContain('stroke-slate-700')
    expect(comSelecao.querySelector('line')?.getAttribute('class')).toContain('stroke-sky-600')
  })
})
