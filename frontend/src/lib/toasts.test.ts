import { describe, expect, it } from 'vitest'

import { LIMITE_TOASTS, adicionarToast, duracaoToast, removerToast, type Toast } from './toasts'

describe('adicionarToast', () => {
  it('acrescenta com id sequencial crescente, começando em 1, e versao 1', () => {
    let toasts = adicionarToast([], 'aviso', 'primeira')
    toasts = adicionarToast(toasts, 'aviso', 'segunda')

    expect(toasts.map((t) => t.id)).toEqual([1, 2])
    expect(toasts.map((t) => t.mensagem)).toEqual(['primeira', 'segunda'])
    expect(toasts.every((t) => t.versao === 1)).toBe(true)
  })

  it('mantém o nível e a mensagem informados, para os quatro níveis', () => {
    for (const nivel of ['info', 'sucesso', 'aviso', 'erro'] as const) {
      const toasts = adicionarToast([], nivel, `mensagem de ${nivel}`)
      expect(toasts[0].nivel).toBe(nivel)
      expect(toasts[0].mensagem).toBe(`mensagem de ${nivel}`)
    }
  })

  it('não muta a lista recebida', () => {
    const original: Toast[] = []
    const resultado = adicionarToast(original, 'aviso', 'x')

    expect(original).toHaveLength(0)
    expect(resultado).toHaveLength(1)
  })

  it('quando o último toast tem mesmo nível e mesma mensagem, não empilha: incrementa versao', () => {
    let toasts = adicionarToast([], 'aviso', 'coluna ocupada')
    toasts = adicionarToast(toasts, 'aviso', 'coluna ocupada')

    expect(toasts).toHaveLength(1)
    expect(toasts[0].id).toBe(1)
    expect(toasts[0].versao).toBe(2)
  })

  it('repetição consecutiva mantém a mesma identidade de objeto para os campos, exceto versao (não muta o antigo)', () => {
    const toasts1 = adicionarToast([], 'aviso', 'coluna ocupada')
    const toasts2 = adicionarToast(toasts1, 'aviso', 'coluna ocupada')

    expect(toasts1[0].versao).toBe(1)
    expect(toasts2[0].versao).toBe(2)
    expect(toasts2[0]).not.toBe(toasts1[0])
  })

  it('mesma mensagem mas nível diferente do último não conta como repetição: empilha', () => {
    let toasts = adicionarToast([], 'aviso', 'mesma mensagem')
    toasts = adicionarToast(toasts, 'erro', 'mesma mensagem')

    expect(toasts).toHaveLength(2)
    expect(toasts.map((t) => t.nivel)).toEqual(['aviso', 'erro'])
  })

  it('mesmo nível e mensagem, mas não é o último da lista, empilha normalmente', () => {
    let toasts = adicionarToast([], 'aviso', 'A')
    toasts = adicionarToast(toasts, 'aviso', 'B')
    toasts = adicionarToast(toasts, 'aviso', 'A')

    expect(toasts).toHaveLength(3)
    expect(toasts.map((t) => t.mensagem)).toEqual(['A', 'B', 'A'])
  })

  it(`descarta os toasts mais antigos acima de ${LIMITE_TOASTS}`, () => {
    let toasts: Toast[] = []
    for (let i = 0; i < LIMITE_TOASTS + 2; i++) {
      toasts = adicionarToast(toasts, 'aviso', `mensagem ${i}`)
    }

    expect(toasts).toHaveLength(LIMITE_TOASTS)
    expect(toasts.map((t) => t.mensagem)).toEqual(['mensagem 2', 'mensagem 3', 'mensagem 4'])
  })
})

describe('removerToast', () => {
  it('remove o toast com o id informado, preservando os demais e a ordem', () => {
    let toasts = adicionarToast([], 'info', 'A')
    toasts = adicionarToast(toasts, 'aviso', 'B')
    toasts = adicionarToast(toasts, 'erro', 'C')

    const resultado = removerToast(toasts, toasts[1].id)

    expect(resultado.map((t) => t.mensagem)).toEqual(['A', 'C'])
  })

  it('não muta a lista recebida', () => {
    const original = adicionarToast([], 'aviso', 'x')
    const resultado = removerToast(original, original[0].id)

    expect(original).toHaveLength(1)
    expect(resultado).toHaveLength(0)
  })

  it('id inexistente não altera a lista (devolve lista equivalente)', () => {
    const original = adicionarToast([], 'aviso', 'x')
    const resultado = removerToast(original, 999)

    expect(resultado).toEqual(original)
  })
})

describe('duracaoToast', () => {
  it('info, sucesso e aviso duram 5000 ms', () => {
    expect(duracaoToast('info')).toBe(5000)
    expect(duracaoToast('sucesso')).toBe(5000)
    expect(duracaoToast('aviso')).toBe(5000)
  })

  it('erro não expira sozinho (null)', () => {
    expect(duracaoToast('erro')).toBeNull()
  })
})
