import { describe, expect, it } from 'vitest'

import { BLINK, IO_ESPELHO, SAIDAS_PARALELAS, SELO, SET_RESET } from './fixtures'
import { exportarPlcopen } from './plcopen'

const DATA_FIXA = '2026-09-23T12:00:00.000Z'

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.querySelector('parsererror'), 'XML mal formado').toBeNull()
  return doc
}

function contar(doc: Document, local: string): number {
  return doc.getElementsByTagNameNS('http://www.plcopen.org/xml/tc6_0201', local).length
}

describe('exportarPlcopen', () => {
  it('produz XML bem formado com namespace TC6', () => {
    const xml = exportarPlcopen(IO_ESPELHO, 'Espelho', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(doc.documentElement.namespaceURI).toBe('http://www.plcopen.org/xml/tc6_0201')
    expect(doc.documentElement.localName).toBe('project')
  })

  it('IO_ESPELHO: um contato, uma bobina, endereços em localVars', () => {
    const xml = exportarPlcopen(IO_ESPELHO, 'Espelho', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(contar(doc, 'contact')).toBe(1)
    expect(contar(doc, 'coil')).toBe(1)
    expect(xml).toContain('%IX0.1')
    expect(xml).toContain('%QX0.1')
  })

  it('SELO: ramo paralelo aparece como contato extra', () => {
    const xml = exportarPlcopen(SELO, 'Selo', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(contar(doc, 'contact')).toBe(3)
    expect(contar(doc, 'coil')).toBe(1)
    expect(xml).toContain('negated="true"')
  })

  it('SET_RESET: bobinas com storage set/reset', () => {
    const xml = exportarPlcopen(SET_RESET, 'SetReset', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(contar(doc, 'contact')).toBe(2)
    expect(contar(doc, 'coil')).toBe(2)
    expect(xml).toContain('storage="set"')
    expect(xml).toContain('storage="reset"')
  })

  it('SAIDAS_PARALELAS: duas bobinas no terminal', () => {
    const xml = exportarPlcopen(SAIDAS_PARALELAS, 'Paralelas', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(contar(doc, 'coil')).toBe(2)
  })

  it('BLINK: inclui bloco CTU', () => {
    const xml = exportarPlcopen(BLINK, 'Blink', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(contar(doc, 'block')).toBeGreaterThanOrEqual(1)
    expect(xml).toContain('typeName="CTU"')
  })

  it('cada degrau gera um LD e conexões em série na linha principal', () => {
    const xml = exportarPlcopen(SET_RESET, 'Dois', { creationDateTime: DATA_FIXA })
    const doc = parse(xml)
    expect(contar(doc, 'LD')).toBe(2)
    expect(contar(doc, 'connection')).toBeGreaterThan(0)
  })
})
