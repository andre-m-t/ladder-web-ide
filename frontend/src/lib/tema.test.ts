import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { aplicarTema, temaInicial } from './tema'

function mockMatchMedia(clara: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: light)' ? clara : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

describe('temaInicial', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa o tema salvo em localStorage quando existe, ignorando a preferência do sistema', () => {
    localStorage.setItem('ladderflow.tema', 'claro')
    mockMatchMedia(false)

    expect(temaInicial()).toBe('claro')
  })

  it('sem tema salvo, usa a preferência do sistema quando ela pede claro', () => {
    mockMatchMedia(true)

    expect(temaInicial()).toBe('claro')
  })

  it('sem tema salvo e sem preferência por claro, cai para escuro (padrão)', () => {
    mockMatchMedia(false)

    expect(temaInicial()).toBe('escuro')
  })

  it('sem suporte a matchMedia no ambiente, cai para escuro sem lançar erro', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(temaInicial()).toBe('escuro')
  })
})

describe('aplicarTema', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('escuro define data-theme="dark" no documento e persiste a escolha', () => {
    aplicarTema('escuro')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('ladderflow.tema')).toBe('escuro')
  })

  it('claro define data-theme="light" no documento e persiste a escolha', () => {
    aplicarTema('claro')

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('ladderflow.tema')).toBe('claro')
  })
})
