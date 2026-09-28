/**
 * Exportação PLCopen XML (TC6 0201) — subconjunto do editor LadderFlow.
 * Leitura de topologia própria (independente do serializador, RF-7).
 */
import {
  COLUNA_TERMINAL,
  ehBloco,
  ehRamoDeSaida,
  type Celula,
  type Diagrama,
  type Elemento,
  type Rung,
} from './modelo'
import { descritorDe } from './blocos'

const NS = 'http://www.plcopen.org/xml/tc6_0201'

function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function posicao(celula: Celula): string {
  const x = celula.coluna * 48
  const y = celula.linha * 48
  return `x="${x}" y="${y}"`
}

function nomeVariavel(elemento: Elemento): string {
  if (ehBloco(elemento)) return elemento.saida ?? elemento.instancia
  return elemento.variavel ?? '_anon'
}

function blocoElemento(elemento: Elemento, localId: number): string {
  const pos = posicao(elemento.celula)
  if (ehBloco(elemento)) {
    const d = descritorDe(elemento.tipo)
    const params = [d.entradaPrincipal]
    if (d.controle) params.push(d.controle.formal)
    params.push(d.preset.formal)
    const inputs = params.map((p) => `<variable formalParameter="${p}"/>`).join('')
    return `<block localId="${localId}" typeName="${d.tipoST}" ${pos} width="48" height="48"><inputVariables>${inputs}</inputVariables><outputVariables><variable formalParameter="Q"/></outputVariables></block>`
  }
  const varName = esc(nomeVariavel(elemento))
  if (elemento.tipo === 'contato_na' || elemento.tipo === 'contato_nf') {
    const neg = elemento.tipo === 'contato_nf' ? ' negated="true"' : ''
    return `<contact localId="${localId}" ${pos} width="48" height="48"${neg}><variable>${varName}</variable></contact>`
  }
  if (elemento.tipo === 'bobina_set') {
    return `<coil localId="${localId}" ${pos} width="48" height="48" storage="set"><variable>${varName}</variable></coil>`
  }
  if (elemento.tipo === 'bobina_reset') {
    return `<coil localId="${localId}" ${pos} width="48" height="48" storage="reset"><variable>${varName}</variable></coil>`
  }
  return `<coil localId="${localId}" ${pos} width="48" height="48"><variable>${varName}</variable></coil>`
}

/** Um corpo `<LD>` por degrau: trilhos, elementos na ordem da linha 0 e conexões em série. */
function ldDoRung(rung: Rung, ids: { next: () => number }): string {
  const ramosContato = rung.ramos.filter((r) => !ehRamoDeSaida(r))

  const elementosLinha0 = rung.elementos
    .filter((e) => e.celula.linha === 0 && e.celula.coluna < COLUNA_TERMINAL)
    .sort((a, b) => a.celula.coluna - b.celula.coluna)

  const terminais = rung.elementos
    .filter((e) => e.celula.coluna === COLUNA_TERMINAL)
    .sort((a, b) => a.celula.linha - b.celula.linha)

  const railEsq = ids.next()
  const railDir = ids.next()
  const partes: string[] = [
    `<leftPowerRail localId="${railEsq}" x="0" y="0" width="8" height="48"/>`,
    `<rightPowerRail localId="${railDir}" x="400" y="0" width="8" height="48"/>`,
  ]

  const nos: number[] = [railEsq]
  for (const el of elementosLinha0) {
    const id = ids.next()
    partes.push(blocoElemento(el, id))
    nos.push(id)
  }

  const blocoLinha0 = rung.elementos.find((e) => ehBloco(e) && e.celula.linha === 0)
  if (blocoLinha0) {
    const id = ids.next()
    partes.push(blocoElemento(blocoLinha0, id))
    nos.push(id)
  }

  for (const bob of terminais) {
    const id = ids.next()
    partes.push(blocoElemento(bob, id))
    nos.push(id)
  }
  nos.push(railDir)

  for (const ramo of ramosContato) {
    const els = rung.elementos
      .filter(
        (e) =>
          e.celula.linha === ramo.linha &&
          e.celula.coluna >= ramo.colunaInicio &&
          e.celula.coluna <= ramo.colunaFim,
      )
      .sort((a, b) => a.celula.coluna - b.celula.coluna)
    for (const el of els) {
      const id = ids.next()
      partes.push(blocoElemento(el, id))
    }
  }

  const conexoes: string[] = []
  for (let i = 0; i < nos.length - 1; i++) {
    conexoes.push(
      `<connection refLocalId="${nos[i + 1]}"><position x="0" y="0"/><position x="0" y="0"/></connection>`,
    )
  }

  return `<LD>\n${partes.join('\n')}\n${conexoes.join('\n')}\n</LD>`
}

export interface OpcoesExportarPlcopen {
  /** Fixa o carimbo do cabeçalho (testes dourados). */
  creationDateTime?: string
}

export function exportarPlcopen(diagrama: Diagrama, titulo: string, opcoes?: OpcoesExportarPlcopen): string {
  const ids = { next: () => ++seq }
  let seq = 0

  const vars = diagrama.variaveis
    .map((v) => {
      const endereco = v.endereco ? `\n            <address>${esc(v.endereco)}</address>` : ''
      return `          <variable name="${esc(v.nome)}">
            <type><BOOL/></type>${endereco}
          </variable>`
    })
    .join('\n')

  const rungsXml = diagrama.rungs.map((rung) => ldDoRung(rung, ids)).join('\n          ')

  const agora = opcoes?.creationDateTime ?? new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="${NS}">
  <fileHeader companyName="LadderFlow" productName="LadderFlow" productVersion="1" creationDateTime="${agora}"/>
  <contentHeader name="${esc(titulo)}"/>
  <types>
    <dataTypes/>
    <pous>
      <pou name="Programa" pouType="program">
        <interface>
          <localVars>
${vars}
          </localVars>
        </interface>
        <body>
          ${rungsXml}
        </body>
      </pou>
    </pous>
  </types>
</project>
`
}
