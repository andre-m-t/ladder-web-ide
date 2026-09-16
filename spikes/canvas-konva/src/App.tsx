import { type KeyboardEvent, useState } from 'react'
import { Layer, Line, Rect, Stage, Text } from 'react-konva'

import { ALTURA_CELULA, ESPACO_ENTRE_RUNGS, LARGURA_CELULA, LARGURA_TRILHO, xDaColuna, yDoRung } from './layout'
import type { Diagrama, Elemento } from './modelo'
import { diagramaInicial, tentarColocar, type TipoPaleta } from './regras'

const FERRAMENTAS: { tipo: TipoPaleta; rotulo: string }[] = [
  { tipo: 'contato_na', rotulo: 'Contato NA' },
  { tipo: 'bobina', rotulo: 'Bobina' },
]

interface Foco {
  rung: number
  coluna: number
}

/**
 * Spike S4 (descartável): mínimo de um editor Ladder sobre react-konva —
 * grade de rungs, paleta de 2 itens, regra "bobina só na última coluna" e
 * leitura do JSON do modelo. Ver MEDICOES.md para as evidências do spike.
 */
export default function App() {
  const [diagrama, setDiagrama] = useState<Diagrama>(() => diagramaInicial())
  const [ferramenta, setFerramenta] = useState<TipoPaleta>('contato_na')
  const [aviso, setAviso] = useState<string | null>(null)
  const [estrutura, setEstrutura] = useState<string | null>(null)
  const [foco, setFoco] = useState<Foco>({ rung: 0, coluna: 0 })

  const colunas = diagrama.rungs[0]?.colunas ?? 0

  function colocar(indiceRung: number, coluna: number) {
    const rung = diagrama.rungs[indiceRung]
    const resultado = tentarColocar(diagrama, rung.id, { linha: 0, coluna }, ferramenta)
    if (resultado.erro) {
      setAviso(resultado.erro)
      return
    }
    setAviso(null)
    setEstrutura(null)
    setDiagrama(resultado.diagrama)
  }

  function aoTeclarNaGrade(evento: KeyboardEvent<HTMLDivElement>) {
    const maxRung = diagrama.rungs.length - 1
    const maxColuna = colunas - 1
    switch (evento.key) {
      case 'ArrowRight':
        setFoco((f) => ({ ...f, coluna: Math.min(maxColuna, f.coluna + 1) }))
        break
      case 'ArrowLeft':
        setFoco((f) => ({ ...f, coluna: Math.max(0, f.coluna - 1) }))
        break
      case 'ArrowDown':
        setFoco((f) => ({ ...f, rung: Math.min(maxRung, f.rung + 1) }))
        break
      case 'ArrowUp':
        setFoco((f) => ({ ...f, rung: Math.max(0, f.rung - 1) }))
        break
      case 'Enter':
      case ' ':
        colocar(foco.rung, foco.coluna)
        break
      default:
        return
    }
    evento.preventDefault()
  }

  const larguraPalco = LARGURA_TRILHO * 2 + colunas * LARGURA_CELULA
  const alturaPalco = diagrama.rungs.length * (ALTURA_CELULA + ESPACO_ENTRE_RUNGS)

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Spike Konva — editor Ladder (protótipo descartável)</h1>

      <div role="toolbar" aria-label="paleta" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {FERRAMENTAS.map((f) => (
          <button
            key={f.tipo}
            type="button"
            aria-pressed={ferramenta === f.tipo}
            onClick={() => setFerramenta(f.tipo)}
            style={{ fontWeight: ferramenta === f.tipo ? 'bold' : 'normal' }}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {/*
        `tabIndex` + `onKeyDown` no contêiner da Stage é o que permite navegar
        por teclado (setas) e colocar elemento com Enter/Espaço, já que formas
        Konva não entram na árvore de foco do DOM (ver MEDICOES.md, item 4).
      */}
      <div
        tabIndex={0}
        role="grid"
        aria-label="grade de rungs"
        data-testid="grade"
        onKeyDown={aoTeclarNaGrade}
        style={{ outline: 'none', border: '1px solid #ccc', display: 'inline-block' }}
      >
        <Stage width={larguraPalco} height={alturaPalco}>
          <Layer>
            {diagrama.rungs.map((rung, indiceRung) => (
              <RungView
                key={rung.id}
                rung={rung}
                indiceRung={indiceRung}
                foco={foco}
                onCelulaClick={(coluna) => colocar(indiceRung, coluna)}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {aviso && (
        <p role="alert" style={{ color: '#b00020' }}>
          {aviso}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={() => setEstrutura(JSON.stringify(diagrama, null, 2))}>
          Ler estrutura
        </button>
        {estrutura && <pre data-testid="estrutura">{estrutura}</pre>}
      </div>
    </main>
  )
}

function RungView({
  rung,
  indiceRung,
  foco,
  onCelulaClick,
}: {
  rung: Diagrama['rungs'][number]
  indiceRung: number
  foco: Foco
  onCelulaClick: (coluna: number) => void
}) {
  const y = yDoRung(indiceRung)
  const larguraTotal = LARGURA_TRILHO * 2 + rung.colunas * LARGURA_CELULA

  return (
    <>
      <Line points={[0, y, 0, y + ALTURA_CELULA]} stroke="#333" strokeWidth={3} />
      <Line points={[larguraTotal, y, larguraTotal, y + ALTURA_CELULA]} stroke="#333" strokeWidth={3} />

      {Array.from({ length: rung.colunas }, (_, coluna) => {
        const x = xDaColuna(coluna)
        const elemento = rung.elementos.find((e) => e.celula.coluna === coluna && e.celula.linha === 0)
        const emFoco = foco.rung === indiceRung && foco.coluna === coluna
        return (
          <CelulaView key={coluna} x={x} y={y} elemento={elemento} emFoco={emFoco} onClick={() => onCelulaClick(coluna)} />
        )
      })}
    </>
  )
}

function CelulaView({
  x,
  y,
  elemento,
  emFoco,
  onClick,
}: {
  x: number
  y: number
  elemento: Elemento | undefined
  emFoco: boolean
  onClick: () => void
}) {
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={LARGURA_CELULA}
        height={ALTURA_CELULA}
        stroke={emFoco ? '#1a73e8' : '#999'}
        strokeWidth={emFoco ? 2 : 1}
        fill="#fff"
        onClick={onClick}
        onTap={onClick}
      />
      {elemento && (
        <Text
          x={x}
          y={y + ALTURA_CELULA / 2 - 8}
          width={LARGURA_CELULA}
          align="center"
          text={rotuloElemento(elemento)}
          listening={false}
        />
      )}
    </>
  )
}

function rotuloElemento(elemento: Elemento): string {
  switch (elemento.tipo) {
    case 'contato_na':
      return '—| |—'
    case 'contato_nf':
      return '—|/|—'
    case 'bobina':
      return '—( )—'
    case 'bobina_set':
      return '—(S)—'
    case 'bobina_reset':
      return '—(R)—'
    case 'ctu':
      return 'CTU'
    default:
      return (elemento as Elemento).tipo
  }
}
