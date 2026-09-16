/**
 * Grade SVG de um degrau (plano D-1, spike S4 §3 — SVG puro venceu Konva:
 * ver `docs/specs/002-editor-ladder/spike-canvas.md`).
 *
 * Padrão reescrito a partir de `spikes/canvas-svg/src/App.tsx` (célula = `<g>`
 * com `tabIndex`, `role="button"`, `aria-label`, `onClick` + `onKeyDown`), sem
 * copiar o arquivo: geometria e rótulos são outros, e a leitura do elemento
 * ocupando a célula vem do `Rung` de `frontend/src/ladder/modelo.ts`.
 *
 * Só a linha 0 (trilho principal) é desenhada aqui — ramos entram na tarefa
 * #18 — mas a geometria já é função de `linha`, para reaproveitar no ramo sem
 * reescrever o cálculo de posição.
 *
 * Função pura das props: nenhum estado próprio, nenhuma mutação do `rung`.
 */
import type { KeyboardEvent } from 'react'

import { COLUNAS_POR_DEGRAU, COLUNA_TERMINAL, ehBobina, type Celula, type Elemento, type Rung, type TipoBobina, type TipoContato } from '../../ladder/modelo'
import { Bobina, ContatoNA, ContatoNF } from './Simbolos'

export interface GradeDegrauProps {
  rung: Rung
  /** 0-based; usado nos rótulos "Degrau 1", "Degrau 2"... */
  indice: number
  /** Id do elemento selecionado, ou null se nenhum. */
  selecionado: string | null
  aoAtivarCelula: (rungId: string, celula: Celula) => void
}

const LARGURA_CELULA = 64
const ALTURA_LINHA = 64
const MARGEM_ESQUERDA = 32
const MARGEM_TOPO = 24

/** Posição vertical (centro) de uma linha do degrau — linha 0 é o trilho principal. */
function yDaLinha(linha: number): number {
  return MARGEM_TOPO + ALTURA_LINHA / 2 + linha * ALTURA_LINHA
}

function xDaColuna(coluna: number): number {
  return MARGEM_ESQUERDA + coluna * LARGURA_CELULA
}

function encontrarElemento(rung: Rung, celula: Celula): Elemento | undefined {
  return rung.elementos.find((e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna)
}

function rotuloTipo(tipo: TipoContato | TipoBobina): string {
  switch (tipo) {
    case 'contato_na':
      return 'contato NA'
    case 'contato_nf':
      return 'contato NF'
    case 'bobina':
      return 'bobina'
    case 'bobina_set':
      return 'bobina SET'
    case 'bobina_reset':
      return 'bobina RESET'
  }
}

function rotuloCelula(indiceDegrau: number, coluna: number, elemento: Elemento | undefined): string {
  const base = `Degrau ${indiceDegrau + 1}, coluna ${coluna + 1}`
  if (!elemento) return `${base}, vazia`
  return `${base}, ${rotuloTipo(elemento.tipo)} ${elemento.variavel ?? 'sem variável'}`
}

export default function GradeDegrau({ rung, indice, selecionado, aoAtivarCelula }: GradeDegrauProps) {
  const largura = MARGEM_ESQUERDA * 2 + COLUNAS_POR_DEGRAU * LARGURA_CELULA
  const altura = MARGEM_TOPO * 2 + ALTURA_LINHA
  const y0 = yDaLinha(0)
  const xEsquerda = MARGEM_ESQUERDA
  const xDireita = MARGEM_ESQUERDA + COLUNAS_POR_DEGRAU * LARGURA_CELULA

  function handleTecla(evento: KeyboardEvent<SVGGElement>, celula: Celula) {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      aoAtivarCelula(rung.id, celula)
    }
  }

  return (
    <figure className="my-4" aria-label={`Degrau ${indice + 1}`}>
      <figcaption className="mb-1 text-xs font-medium text-slate-500">Degrau {indice + 1}</figcaption>
      <svg role="group" aria-label={`Degrau ${indice + 1}, grade`} width={largura} height={altura} className="overflow-visible">
        {/* trilhos de energia esquerdo e direito */}
        <line x1={xEsquerda} y1={y0 - ALTURA_LINHA / 2} x2={xEsquerda} y2={y0 + ALTURA_LINHA / 2} strokeWidth={3} className="stroke-slate-700" />
        <line x1={xDireita} y1={y0 - ALTURA_LINHA / 2} x2={xDireita} y2={y0 + ALTURA_LINHA / 2} strokeWidth={3} className="stroke-slate-700" />
        {/* fio horizontal atravessando as células vazias */}
        <line x1={xEsquerda} y1={y0} x2={xDireita} y2={y0} strokeWidth={2} className="stroke-slate-700" />

        {Array.from({ length: COLUNAS_POR_DEGRAU }, (_, coluna) => {
          const celula: Celula = { linha: 0, coluna }
          const elemento = encontrarElemento(rung, celula)
          const cx = xDaColuna(coluna)
          const centroX = cx + LARGURA_CELULA / 2
          const ehTerminal = coluna === COLUNA_TERMINAL
          const ativo = elemento !== undefined && elemento.id === selecionado

          return (
            <g
              key={coluna}
              tabIndex={0}
              role="button"
              aria-label={rotuloCelula(indice, coluna, elemento)}
              aria-pressed={ativo}
              data-terminal={ehTerminal ? 'true' : undefined}
              onClick={() => aoAtivarCelula(rung.id, celula)}
              onKeyDown={(evento) => handleTecla(evento, celula)}
              className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              <rect
                x={cx}
                y={y0 - ALTURA_LINHA / 2}
                width={LARGURA_CELULA}
                height={ALTURA_LINHA}
                strokeWidth={1}
                strokeDasharray={ehTerminal ? undefined : '2,3'}
                className={ehTerminal ? 'fill-slate-100 stroke-slate-300' : 'fill-transparent stroke-slate-200'}
              />
              {elemento?.tipo === 'contato_na' && <ContatoNA cx={centroX} cy={y0} variavel={elemento.variavel} selecionado={ativo} />}
              {elemento?.tipo === 'contato_nf' && <ContatoNF cx={centroX} cy={y0} variavel={elemento.variavel} selecionado={ativo} />}
              {elemento && ehBobina(elemento.tipo) && <Bobina cx={centroX} cy={y0} variavel={elemento.variavel} selecionado={ativo} />}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
