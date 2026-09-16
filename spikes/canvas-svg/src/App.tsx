import { useState } from 'react'
import type { Diagrama, Elemento, Rung, TipoContato, TipoBobina } from './modelo'

// ---------------------------------------------------------------------------
// Spike S4 — protótipo descartável: editor Ladder em SVG puro (React + <svg>,
// sem biblioteca de canvas). Escopo mínimo definido no enunciado do spike;
// não é código de produção.
// ---------------------------------------------------------------------------

const COLUNAS_POR_RUNG = 6
const NUM_RUNGS = 3

const CELL_W = 90
const CELL_H = 70
const MARGEM_ESQ = 70
const MARGEM_TOPO = 40
const ESPACO_ENTRE_RUNGS = 100

function criarRungVazio(indice: number): Rung {
  return {
    id: `rung${indice}`,
    colunas: COLUNAS_POR_RUNG,
    elementos: [],
    ramos: [],
  }
}

function criarDiagramaInicial(): Diagrama {
  return {
    versao: 1,
    variaveis: [],
    rungs: Array.from({ length: NUM_RUNGS }, (_, i) => criarRungVazio(i)),
  }
}

type Ferramenta = TipoContato | TipoBobina

function encontrarElemento(rung: Rung, coluna: number): Elemento | undefined {
  return rung.elementos.find((e) => e.celula.linha === 0 && e.celula.coluna === coluna)
}

/** Valida se a ferramenta pode ser colocada na célula indicada. Retorna uma
 * mensagem de erro (string) quando inválido, ou null quando válido. */
function validarColocacao(rung: Rung, coluna: number, ferramenta: Ferramenta): string | null {
  const ultimaColuna = rung.colunas - 1
  if (ferramenta === 'bobina' && coluna !== ultimaColuna) {
    return 'Bobina só pode ser colocada na última coluna do rung.'
  }
  if (ferramenta === 'contato_na' && coluna === ultimaColuna) {
    return 'Contato não pode ser colocado na última coluna do rung.'
  }
  if (encontrarElemento(rung, coluna)) {
    return 'Célula já ocupada.'
  }
  return null
}

function App() {
  const [diagrama, setDiagrama] = useState<Diagrama>(() => criarDiagramaInicial())
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [jsonTexto, setJsonTexto] = useState<string | null>(null)

  function colocarElemento(rungIndex: number, coluna: number) {
    if (!ferramenta) {
      setAviso('Selecione uma ferramenta na paleta antes de clicar na grade.')
      return
    }
    const rung = diagrama.rungs[rungIndex]
    const erro = validarColocacao(rung, coluna, ferramenta)
    if (erro) {
      setAviso(erro)
      return
    }
    setAviso(null)
    const novoElemento: Elemento = {
      id: `${rung.id}-c${coluna}`,
      tipo: ferramenta,
      celula: { linha: 0, coluna },
      variavel: null,
    }
    setDiagrama((atual) => ({
      ...atual,
      rungs: atual.rungs.map((r, i) =>
        i === rungIndex ? { ...r, elementos: [...r.elementos, novoElemento] } : r,
      ),
    }))
  }

  // --- Acessibilidade por teclado (item 4 das medições): a célula é um <g>
  // focável (tabIndex) e Enter/Espaço disparam a mesma ação do clique.
  function handleTeclaCelula(e: React.KeyboardEvent, rungIndex: number, coluna: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      colocarElemento(rungIndex, coluna)
    }
  }

  function lerEstrutura() {
    setJsonTexto(JSON.stringify(diagrama, null, 2))
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Spike S4 — Ladder em SVG puro</h1>

      <section aria-label="Paleta de elementos" style={{ marginBottom: 12 }}>
        <button
          type="button"
          aria-pressed={ferramenta === 'contato_na'}
          onClick={() => setFerramenta('contato_na')}
          style={{ fontWeight: ferramenta === 'contato_na' ? 'bold' : 'normal', marginRight: 8 }}
        >
          Contato NA
        </button>
        <button
          type="button"
          aria-pressed={ferramenta === 'bobina'}
          onClick={() => setFerramenta('bobina')}
          style={{ fontWeight: ferramenta === 'bobina' ? 'bold' : 'normal' }}
        >
          Bobina
        </button>
      </section>

      {aviso && (
        <div role="alert" style={{ color: '#b00020', marginBottom: 12 }}>
          {aviso}
        </div>
      )}

      <svg
        role="img"
        aria-label="Grade de rungs do diagrama Ladder"
        width={MARGEM_ESQ * 2 + COLUNAS_POR_RUNG * CELL_W}
        height={MARGEM_TOPO * 2 + NUM_RUNGS * ESPACO_ENTRE_RUNGS}
      >
        {diagrama.rungs.map((rung, rungIndex) => {
          const y = MARGEM_TOPO + rungIndex * ESPACO_ENTRE_RUNGS
          const xEsq = MARGEM_ESQ
          const xDir = MARGEM_ESQ + rung.colunas * CELL_W
          return (
            <g key={rung.id}>
              {/* trilho de energia esquerdo e direito */}
              <line x1={xEsq} y1={y - 20} x2={xEsq} y2={y + 20} stroke="black" strokeWidth={3} />
              <line x1={xDir} y1={y - 20} x2={xDir} y2={y + 20} stroke="black" strokeWidth={3} />
              {/* fio horizontal conectando os trilhos */}
              <line x1={xEsq} y1={y} x2={xDir} y2={y} stroke="black" strokeWidth={2} />

              {Array.from({ length: rung.colunas }, (_, coluna) => {
                const cx = xEsq + coluna * CELL_W
                const elemento = encontrarElemento(rung, coluna)
                return (
                  <g
                    key={coluna}
                    data-testid={`celula-${rungIndex}-${coluna}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`Rung ${rungIndex}, coluna ${coluna}${elemento ? `, ${elemento.tipo}` : ', vazia'}`}
                    onClick={() => colocarElemento(rungIndex, coluna)}
                    onKeyDown={(e) => handleTeclaCelula(e, rungIndex, coluna)}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    <rect
                      x={cx}
                      y={y - CELL_H / 2}
                      width={CELL_W}
                      height={CELL_H}
                      fill="transparent"
                      stroke="#ccc"
                      strokeDasharray="2,2"
                    />
                    {elemento?.tipo === 'contato_na' && (
                      <>
                        <line x1={cx + CELL_W / 2 - 8} y1={y - 14} x2={cx + CELL_W / 2 - 8} y2={y + 14} stroke="black" strokeWidth={2} />
                        <line x1={cx + CELL_W / 2 + 8} y1={y - 14} x2={cx + CELL_W / 2 + 8} y2={y + 14} stroke="black" strokeWidth={2} />
                      </>
                    )}
                    {elemento?.tipo === 'bobina' && (
                      <>
                        <path d={`M ${cx + CELL_W / 2 - 4} ${y - 14} A 14 14 0 0 0 ${cx + CELL_W / 2 - 4} ${y + 14}`} fill="none" stroke="black" strokeWidth={2} />
                        <path d={`M ${cx + CELL_W / 2 + 4} ${y - 14} A 14 14 0 0 1 ${cx + CELL_W / 2 + 4} ${y + 14}`} fill="none" stroke="black" strokeWidth={2} />
                      </>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={lerEstrutura}>
          Ler estrutura
        </button>
        {jsonTexto !== null && <pre data-testid="json-diagrama">{jsonTexto}</pre>}
      </div>
    </div>
  )
}

export default App
