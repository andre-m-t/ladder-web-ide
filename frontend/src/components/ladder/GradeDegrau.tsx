/**
 * Grade SVG de um degrau (plano D-1, spike S4 §3 — SVG puro venceu Konva:
 * ver `docs/specs/002-editor-ladder/spike-canvas.md`).
 *
 * Reescrito na tarefa #22 (plano `agora-precisamos-trabalhar-em-cozy-dragon.md`,
 * D-12): não existe mais "ferramenta ativa" nem `aoAtivarCelula` — o gesto
 * principal é arrastar (paleta → célula, célula → célula, célula → lixeira),
 * por Pointer Events ou teclado. Este componente continua função pura das
 * props, sem estado próprio e sem decidir se uma jogada é válida: só desenha
 * e encaminha os eventos nativos (clique, duplo clique, tecla, pointerdown,
 * pointerenter/leave) para quem manda, `EditorLadder.tsx`, que é quem tem a
 * máquina de estado do arrasto e chama o núcleo para calcular prévia/recusa.
 *
 * Só a linha 0 (trilho principal) é desenhada aqui — ramos entram na tarefa
 * #18 — mas a geometria já é função de `linha`, para reaproveitar no ramo sem
 * reescrever o cálculo de posição.
 *
 * `select-none touch-none` e `onDragStart` bloqueado na célula (SVG não tem o
 * atributo `draggable` do HTML): correção de bug real do Chromium (relatado
 * após a entrega inicial da #22) em que, sem isso, uma seleção de texto
 * residente na página fazia um arrasto de ponteiro seguinte virar um drag
 * nativo de conteúdo, cancelado pelo navegador (`pointercancel`) no meio do
 * gesto — ver `armarPonteiro` em `EditorLadder.tsx`.
 */
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import { COLUNAS_POR_DEGRAU, COLUNA_TERMINAL, ehBobina, type Celula, type Elemento, type Rung, type TipoBobina, type TipoContato } from '../../ladder/modelo'
import { Bobina, ContatoNA, ContatoNF } from './Simbolos'

/** Prévia de uma jogada de arrasto sobre uma célula, calculada pelo editor
 * chamando o núcleo (`inserirElemento`/`moverElemento`) sem aplicar (D-11,
 * reaproveitada pela #22 durante o arrasto). O tipo `remover` também é usado
 * para destacar o próprio elemento de origem quando o alvo do arrasto é a
 * lixeira. */
export type Previa =
  | { celula: Celula; tipo: 'inserir'; elemento: Elemento['tipo'] }
  | { celula: Celula; tipo: 'remover' }
  | { celula: Celula; tipo: 'invalida'; motivo: string }

export interface GradeDegrauProps {
  rung: Rung
  /** 0-based; usado nos rótulos "Degrau 1", "Degrau 2"... */
  indice: number
  /** Id do elemento marcado, ou null se nenhum (clique simples marca; #22). */
  marcado: string | null
  /** Clique simples: marca o elemento da célula, ou desmarca se vazia. */
  aoClicarCelula: (rungId: string, celula: Celula) => void
  /** Duplo clique: abre o modal de variável do elemento (célula vazia é no-op). */
  aoDuploClicarCelula: (rungId: string, celula: Celula) => void
  /** Encaminha o evento de teclado bruto: `EditorLadder` decide Espaço/Enter/Delete/setas. */
  aoTeclarNaCelula: (evento: KeyboardEvent<SVGGElement>, rungId: string, celula: Celula) => void
  /** pointerdown na célula: só importa quando há elemento (início do arrasto por ponteiro). */
  aoIniciarArrastoPonteiro: (evento: ReactPointerEvent<SVGGElement>, rungId: string, celula: Celula) => void
  /** Prévia a desenhar na célula sob o arrasto, ou null/ausente. */
  previa?: Previa | null
  /** Avisa qual célula está sob o ponteiro ou o foco (null ao sair) — usado
   * pelo editor para acompanhar o alvo do arrasto. */
  aoPassarCelula?: (rungId: string, celula: Celula | null) => void
  /** Última recusa de uma jogada sobre uma célula deste degrau, ou null/ausente. */
  recusa?: { celula: Celula; motivo: string } | null
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

function celulaIgual(a: Celula, b: Celula): boolean {
  return a.linha === b.linha && a.coluna === b.coluna
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

/** Classe do retângulo da célula conforme prévia/recusa (D-11: precedência
 * recusa > prévia inválida > prévia remover > prévia inserir > normal). */
function classeRetangulo(ehTerminal: boolean, previa: Previa | undefined, recusada: boolean): string {
  if (recusada) return 'fill-red-50 stroke-red-500'
  if (previa?.tipo === 'invalida') return 'fill-red-50 stroke-red-300'
  if (previa?.tipo === 'remover') return 'fill-red-50 stroke-red-300'
  if (previa?.tipo === 'inserir') return 'fill-sky-50 stroke-sky-400'
  return ehTerminal ? 'fill-slate-100 stroke-slate-300' : 'fill-transparent stroke-slate-200'
}

export default function GradeDegrau({
  rung,
  indice,
  marcado,
  aoClicarCelula,
  aoDuploClicarCelula,
  aoTeclarNaCelula,
  aoIniciarArrastoPonteiro,
  previa,
  aoPassarCelula,
  recusa,
}: GradeDegrauProps) {
  const largura = MARGEM_ESQUERDA * 2 + COLUNAS_POR_DEGRAU * LARGURA_CELULA
  const altura = MARGEM_TOPO * 2 + ALTURA_LINHA
  const y0 = yDaLinha(0)
  const xEsquerda = MARGEM_ESQUERDA
  const xDireita = MARGEM_ESQUERDA + COLUNAS_POR_DEGRAU * LARGURA_CELULA
  const idAlerta = `recusa-${rung.id}`

  function aoEntrarNaCelula(celula: Celula) {
    aoPassarCelula?.(rung.id, celula)
  }

  function aoSairDaCelula() {
    aoPassarCelula?.(rung.id, null)
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
          const ativo = elemento !== undefined && elemento.id === marcado

          const previaAqui = previa && celulaIgual(previa.celula, celula) ? previa : undefined
          const recusada = recusa != null && celulaIgual(recusa.celula, celula)
          const ehRemocaoAqui = previaAqui?.tipo === 'remover'
          const cursorInvalido = previaAqui?.tipo === 'invalida'

          return (
            <g
              key={coluna}
              tabIndex={0}
              role="button"
              aria-label={rotuloCelula(indice, coluna, elemento)}
              aria-selected={ativo}
              aria-invalid={recusada ? 'true' : undefined}
              aria-describedby={recusada ? idAlerta : undefined}
              data-terminal={ehTerminal ? 'true' : undefined}
              data-previa={previaAqui ? previaAqui.tipo : undefined}
              data-celula={`${rung.id}:${celula.linha}:${celula.coluna}`}
              onDragStart={(evento) => evento.preventDefault()}
              onClick={() => aoClicarCelula(rung.id, celula)}
              onDoubleClick={() => aoDuploClicarCelula(rung.id, celula)}
              onKeyDown={(evento) => aoTeclarNaCelula(evento, rung.id, celula)}
              onPointerDown={(evento) => aoIniciarArrastoPonteiro(evento, rung.id, celula)}
              onPointerEnter={() => aoEntrarNaCelula(celula)}
              onPointerLeave={() => aoSairDaCelula()}
              onFocus={() => aoEntrarNaCelula(celula)}
              onBlur={() => aoSairDaCelula()}
              className={`select-none touch-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${cursorInvalido ? 'cursor-not-allowed' : elemento ? 'cursor-grab' : 'cursor-pointer'}`}
            >
              {previaAqui?.tipo === 'invalida' && <title>{previaAqui.motivo}</title>}
              <rect
                x={cx}
                y={y0 - ALTURA_LINHA / 2}
                width={LARGURA_CELULA}
                height={ALTURA_LINHA}
                strokeWidth={1}
                strokeDasharray={ehTerminal ? undefined : '2,3'}
                className={classeRetangulo(ehTerminal, previaAqui, recusada)}
              />
              {elemento?.tipo === 'contato_na' && <ContatoNA cx={centroX} cy={y0} variavel={elemento.variavel} selecionado={ativo} perigo={ehRemocaoAqui} />}
              {elemento?.tipo === 'contato_nf' && <ContatoNF cx={centroX} cy={y0} variavel={elemento.variavel} selecionado={ativo} perigo={ehRemocaoAqui} />}
              {elemento && ehBobina(elemento.tipo) && <Bobina cx={centroX} cy={y0} variavel={elemento.variavel} selecionado={ativo} perigo={ehRemocaoAqui} />}
              {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'contato_na' && (
                <ContatoNA cx={centroX} cy={y0} variavel={null} selecionado={false} fantasma />
              )}
              {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'contato_nf' && (
                <ContatoNF cx={centroX} cy={y0} variavel={null} selecionado={false} fantasma />
              )}
              {!elemento && previaAqui?.tipo === 'inserir' && ehBobina(previaAqui.elemento) && (
                <Bobina cx={centroX} cy={y0} variavel={null} selecionado={false} fantasma />
              )}
            </g>
          )
        })}
      </svg>
      {recusa && (
        <p id={idAlerta} role="alert" className="mt-1 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900">
          {recusa.motivo}
        </p>
      )}
    </figure>
  )
}
