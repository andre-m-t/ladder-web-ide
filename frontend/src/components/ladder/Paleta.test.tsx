import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Paleta from './Paleta'

function propsBase() {
  return {
    marcado: false,
    emArrasto: false,
    sobreLixeira: false,
    aoIniciarArrastoPonteiro: vi.fn(),
    aoIniciarArrastoTeclado: vi.fn(),
    aoPassarLixeira: vi.fn(),
    aoAcionarLixeira: vi.fn(),
    aoTeclarNaLixeira: vi.fn(),
  }
}

describe('Paleta — itens arrastáveis', () => {
  it('cada item é um "item arrastável" (aria-roledescription), não um botão de ação', () => {
    render(<Paleta {...propsBase()} />)

    for (const nome of [/contato na/i, /contato nf/i, /^bobina$/i, /bobina set/i, /bobina reset/i, /^ramo$/i, /contador/i]) {
      const item = screen.getByRole('button', { name: nome })
      expect(item).toHaveAttribute('aria-roledescription', 'item arrastável')
    }
  })

  it('cada item tem aria-describedby com instrução de teclado', () => {
    render(<Paleta {...propsBase()} />)

    const item = screen.getByRole('button', { name: /contato na/i })
    const idInstrucao = item.getAttribute('aria-describedby')
    expect(idInstrucao).toBeTruthy()
    expect(document.getElementById(idInstrucao as string)).toHaveTextContent(/espaço/i)
  })

  it('pointerdown num item chama aoIniciarArrastoPonteiro com o tipo certo', () => {
    const aoIniciarArrastoPonteiro = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    const item = screen.getByRole('button', { name: /^bobina$/i })
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 5, clientY: 5 })

    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledWith('bobina', expect.anything())
  })

  it('Espaço num item chama aoIniciarArrastoTeclado com o tipo certo', async () => {
    const usuario = userEvent.setup()
    const aoIniciarArrastoTeclado = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoTeclado={aoIniciarArrastoTeclado} />)

    const item = screen.getByRole('button', { name: /contato nf/i })
    item.focus()
    await usuario.keyboard(' ')

    expect(aoIniciarArrastoTeclado).toHaveBeenCalledWith('contato_nf')
  })

  it('nome acessível de cada item é exatamente o rótulo, sem texto do ícone', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Contato NA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contato NF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bobina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ramo' })).toBeInTheDocument()
  })

  it('data-tipo-paleta identifica o item, para foco programático durante o arrasto por teclado', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Contato NA' })).toHaveAttribute('data-tipo-paleta', 'contato_na')
    expect(screen.getByRole('button', { name: 'Ramo' })).toHaveAttribute('data-tipo-paleta', 'ramo')
  })
})

describe('Paleta — SET, RESET e Contador (tarefa #18)', () => {
  it('itens "Bobina SET" e "Bobina RESET" mostram os glifos -(S)- e -(R)-', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Bobina SET' })).toHaveTextContent('-(S)-')
    expect(screen.getByRole('button', { name: 'Bobina RESET' })).toHaveTextContent('-(R)-')
  })

  it('pointerdown em "Bobina SET"/"Bobina RESET"/"Contador" chama aoIniciarArrastoPonteiro com o tipo certo', () => {
    const aoIniciarArrastoPonteiro = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Bobina SET' }), { pointerId: 1, clientX: 5, clientY: 5 })
    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledWith('bobina_set', expect.anything())

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Bobina RESET' }), { pointerId: 2, clientX: 5, clientY: 5 })
    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledWith('bobina_reset', expect.anything())

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Contador' }), { pointerId: 3, clientX: 5, clientY: 5 })
    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledWith('ctu', expect.anything())
  })

  it('Espaço no item Contador chama aoIniciarArrastoTeclado com "ctu"', async () => {
    const usuario = userEvent.setup()
    const aoIniciarArrastoTeclado = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoTeclado={aoIniciarArrastoTeclado} />)

    screen.getByRole('button', { name: 'Contador' }).focus()
    await usuario.keyboard(' ')

    expect(aoIniciarArrastoTeclado).toHaveBeenCalledWith('ctu')
  })
})

describe('Paleta — item Ramo (D-14)', () => {
  it('pointerdown no item Ramo chama aoIniciarArrastoPonteiro com "ramo"', () => {
    const aoIniciarArrastoPonteiro = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ramo' }), { pointerId: 1, clientX: 5, clientY: 5 })

    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledWith('ramo', expect.anything())
  })

  it('Espaço no item Ramo chama aoIniciarArrastoTeclado com "ramo"', async () => {
    const usuario = userEvent.setup()
    const aoIniciarArrastoTeclado = vi.fn()
    render(<Paleta {...propsBase()} aoIniciarArrastoTeclado={aoIniciarArrastoTeclado} />)

    screen.getByRole('button', { name: 'Ramo' }).focus()
    await usuario.keyboard(' ')

    expect(aoIniciarArrastoTeclado).toHaveBeenCalledWith('ramo')
  })

  it('o item Ramo tem um ícone aria-hidden (sem glifo monoespaçado)', () => {
    render(<Paleta {...propsBase()} />)

    const item = screen.getByRole('button', { name: 'Ramo' })
    expect(item.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('Paleta — sem SVG de símbolo duplicado nos itens (D-14)', () => {
  it('contato NA, contato NF e bobina não têm nenhum SVG (só o glifo monoespaçado em texto)', () => {
    render(<Paleta {...propsBase()} />)

    for (const nome of [/^contato na$/i, /^contato nf$/i, /^bobina$/i]) {
      const item = screen.getByRole('button', { name: nome })
      expect(item.querySelector('svg')).toBeNull()
    }
  })

  it('contato NA mostra o glifo monoespaçado "-| |-"', () => {
    render(<Paleta {...propsBase()} />)

    const item = screen.getByRole('button', { name: /^contato na$/i })
    expect(item).toHaveTextContent('-| |-')
  })
})

describe('Paleta — lixeira', () => {
  it('desabilitada quando não há marcação nem arrasto em curso', () => {
    render(<Paleta {...propsBase()} marcado={false} emArrasto={false} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeDisabled()
  })

  it('habilitada quando há elemento marcado', () => {
    render(<Paleta {...propsBase()} marcado={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeEnabled()
  })

  it('habilitada durante um arrasto, mesmo sem marcação (alvo de soltar)', () => {
    render(<Paleta {...propsBase()} emArrasto={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeEnabled()
  })

  it('texto de ajuda associado via aria-describedby', () => {
    render(<Paleta {...propsBase()} />)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    const idAjuda = lixeira.getAttribute('aria-describedby')
    expect(idAjuda).toBeTruthy()
    expect(document.getElementById(idAjuda as string)).not.toBeNull()
  })

  it('clique na lixeira chama aoAcionarLixeira', async () => {
    const usuario = userEvent.setup()
    const aoAcionarLixeira = vi.fn()
    render(<Paleta {...propsBase()} marcado={true} aoAcionarLixeira={aoAcionarLixeira} />)

    await usuario.click(screen.getByRole('button', { name: /lixeira/i }))

    expect(aoAcionarLixeira).toHaveBeenCalledTimes(1)
  })

  it('pointerenter/leave na lixeira chamam aoPassarLixeira', () => {
    const aoPassarLixeira = vi.fn()
    render(<Paleta {...propsBase()} emArrasto={true} aoPassarLixeira={aoPassarLixeira} />)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    fireEvent.pointerEnter(lixeira)
    expect(aoPassarLixeira).toHaveBeenLastCalledWith(true)

    fireEvent.pointerLeave(lixeira)
    expect(aoPassarLixeira).toHaveBeenLastCalledWith(false)
  })

  it('destaque visual quando é o alvo do arrasto (sobreLixeira)', () => {
    render(<Paleta {...propsBase()} emArrasto={true} sobreLixeira={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i }).className).toContain('border-ide-perigo')
  })

  it('mostra o ícone Trash2 (svg aria-hidden) e o texto "Lixeira"', () => {
    render(<Paleta {...propsBase()} />)

    const lixeira = screen.getByRole('button', { name: /lixeira/i })
    expect(lixeira.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(lixeira).toHaveTextContent('Lixeira')
  })
})

describe('Paleta — congelado durante a simulação (spec 004, RF-15, D-20)', () => {
  it('sem congelado, o desenho do item é idêntico ao de hoje (cursor-grab, sem aria-disabled)', () => {
    render(<Paleta {...propsBase()} />)

    const item = screen.getByRole('button', { name: 'Contato NA' })
    expect(item.className).toContain('cursor-grab')
    expect(item.className).not.toContain('cursor-not-allowed')
    expect(item.className).not.toContain('opacity-50')
    expect(item).not.toHaveAttribute('aria-disabled')
  })

  it('congelado: cada item vira cursor-not-allowed, opacity-50 e aria-disabled', () => {
    render(<Paleta {...propsBase()} congelado={true} />)

    for (const nome of ['Contato NA', 'Contato NF', 'Bobina', 'Bobina SET', 'Bobina RESET', 'Ramo', 'Contador']) {
      const item = screen.getByRole('button', { name: nome })
      expect(item.className).toContain('cursor-not-allowed')
      expect(item.className).toContain('opacity-50')
      expect(item).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('congelado: a lixeira fica desabilitada mesmo com algo marcado', () => {
    render(<Paleta {...propsBase()} congelado={true} marcado={true} />)

    expect(screen.getByRole('button', { name: /lixeira/i })).toBeDisabled()
  })

  it('congelado: o pointerdown CONTINUA sendo encaminhado — é quem chama preventDefault (correção de 2026-09-22)', () => {
    // Regressão da regressão. A tentativa de 2026-09-21 de deixar a paleta
    // inerte cortou o encaminhamento do `pointerdown`; com isso o
    // `preventDefault` de `EditorLadder` deixou de rodar, o navegador passou a
    // iniciar seleção nativa, e o arrasto SEGUINTE (ao sair da simulação)
    // morria em `pointercancel` — o mesmo defeito da #22, por caminho novo.
    // Quem recusa o gesto é `EditorLadder` (D-9), não a ausência do handler.
    const aoIniciarArrastoPonteiro = vi.fn()
    render(<Paleta {...propsBase()} congelado={true} aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiro} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Bobina' }), { pointerId: 1, clientX: 5, clientY: 5 })

    expect(aoIniciarArrastoPonteiro).toHaveBeenCalledTimes(1)
  })

  it('congelado: o item some do Tab (tabIndex -1) — sem gesto possível, não há o que recusar', () => {
    render(<Paleta {...propsBase()} congelado={true} />)

    for (const nome of ['Contato NA', 'Contato NF', 'Bobina', 'Bobina SET', 'Bobina RESET', 'Ramo', 'Contador']) {
      expect(screen.getByRole('button', { name: nome })).toHaveAttribute('tabIndex', '-1')
    }
  })

  it('sem congelado, o item continua alcançável por Tab (tabIndex 0)', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.getByRole('button', { name: 'Contato NA' })).toHaveAttribute('tabIndex', '0')
  })

  it('congelado: a classe do item NÃO leva pointer-events-none — senão o preventDefault não roda (correção de 2026-09-22)', () => {
    // Guarda explícita contra reintroduzir o defeito pela terceira vez:
    // `pointer-events-none` impediria o item de receber o `pointerdown`, e com
    // ele o `preventDefault` que protege o arrasto seguinte. A inércia visível
    // vem de `opacity-50` + `cursor-not-allowed` + `aria-disabled` + tabIndex.
    render(<Paleta {...propsBase()} congelado={true} />)

    const item = screen.getByRole('button', { name: 'Contato NA' })
    expect(item.className).not.toContain('pointer-events-none')
    expect(item.className).toContain('cursor-not-allowed')
    expect(item.className).toContain('opacity-50')
    expect(item).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('Paleta — barra de ferramentas compacta (D-14)', () => {
  it('não tem mais o rótulo visível "Paleta"', () => {
    render(<Paleta {...propsBase()} />)

    expect(screen.queryByText('Paleta')).not.toBeInTheDocument()
  })

  it('nenhuma classe de cor fixa (só tokens ide-*)', () => {
    const { container } = render(<Paleta {...propsBase()} sobreLixeira={true} emArrasto={true} marcado={true} />)

    expect(container.innerHTML).not.toMatch(/\b(slate|sky|red|emerald|amber)-\d/)
  })
})
