import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Bobina, BobinaReset, BobinaSet, ContatoNA, ContatoNF } from './Simbolos'

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

  it('BobinaSet desenha a marca "S" dentro do círculo, além do rótulo da variável', () => {
    const { container } = render(
      <svg>
        <BobinaSet {...PROPS_BASE} />
      </svg>,
    )

    const textos = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(textos).toContain('S')
    expect(textos).toContain('M1')
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('BobinaReset desenha a marca "R" dentro do círculo', () => {
    const { container } = render(
      <svg>
        <BobinaReset {...PROPS_BASE} />
      </svg>,
    )

    const textos = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(textos).toContain('R')
  })

  it('fantasma de BobinaSet/BobinaReset não desenha o rótulo da variável, mas mantém a marca', () => {
    const { container: setContainer } = render(
      <svg>
        <BobinaSet {...PROPS_BASE} fantasma />
      </svg>,
    )
    const { container: resetContainer } = render(
      <svg>
        <BobinaReset {...PROPS_BASE} fantasma />
      </svg>,
    )

    expect(Array.from(setContainer.querySelectorAll('text')).map((t) => t.textContent)).toEqual(['S'])
    expect(Array.from(resetContainer.querySelectorAll('text')).map((t) => t.textContent)).toEqual(['R'])
  })

  it('nenhuma classe de cor fixa (só tokens ide-*), em qualquer combinação de estado', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} endereco="%IX0.1" selecionado />
        <ContatoNF {...PROPS_BASE} fantasma />
        <Bobina {...PROPS_BASE} perigo />
        <BobinaSet {...PROPS_BASE} selecionado />
        <BobinaReset {...PROPS_BASE} fantasma />
      </svg>,
    )

    expect(container.innerHTML).not.toMatch(COR_FIXA)
  })
})

describe('Simbolos — energização (spec 004, tarefa #10)', () => {
  it('sem a prop energizado, o traço é idêntico ao de hoje (ausente = sem mudança)', () => {
    const { container: semProp } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} />
      </svg>,
    )
    const { container: comFalso } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} energizado={false} />
      </svg>,
    )

    for (const container of [semProp, comFalso]) {
      const linha = container.querySelector('line')
      expect(linha?.getAttribute('class')).toContain('stroke-ide-fio')
      expect(linha?.getAttribute('class')).not.toContain('stroke-ide-energizado')
      expect(linha?.getAttribute('stroke-width')).toBe('2')
    }
  })

  it('energizado usa o token de cor ide-energizado E aumenta a espessura do traço (RF-14, codificação redundante)', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} energizado />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-energizado')
    expect(Number(linha?.getAttribute('stroke-width'))).toBeGreaterThan(2)
  })

  it('energizado se aplica ao traço de ContatoNF, Bobina, BobinaSet e BobinaReset', () => {
    const { container: nf } = render(
      <svg>
        <ContatoNF {...PROPS_BASE} energizado />
      </svg>,
    )
    expect(nf.querySelector('line')?.getAttribute('class')).toContain('stroke-ide-energizado')

    for (const Componente of [Bobina, BobinaSet, BobinaReset]) {
      const { container } = render(
        <svg>
          <Componente {...PROPS_BASE} energizado />
        </svg>,
      )
      const arco = container.querySelector('path')
      expect(arco?.getAttribute('class')).toContain('stroke-ide-energizado')
      expect(Number(arco?.getAttribute('stroke-width'))).toBeGreaterThan(2)
    }
  })

  it('perigo tem precedência sobre energizado (nunca coexistem de verdade, mas a cor de perigo vence)', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} energizado perigo />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-perigo')
    expect(linha?.getAttribute('class')).not.toContain('stroke-ide-energizado')
  })

  it('energizado tem precedência sobre selecionado (o estado ao vivo é mais saliente que a seleção)', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} energizado selecionado />
      </svg>,
    )

    const linha = container.querySelector('line')
    expect(linha?.getAttribute('class')).toContain('stroke-ide-energizado')
    expect(linha?.getAttribute('class')).not.toContain('stroke-ide-destaque')
  })

  it('nenhuma classe de cor fixa também com energizado (só tokens ide-*)', () => {
    const { container } = render(
      <svg>
        <ContatoNA {...PROPS_BASE} energizado />
        <Bobina {...PROPS_BASE} energizado />
      </svg>,
    )

    expect(container.innerHTML).not.toMatch(COR_FIXA)
  })
})
