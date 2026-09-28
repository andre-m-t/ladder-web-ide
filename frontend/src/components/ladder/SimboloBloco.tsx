/**
 * Símbolo de bloco FB na grade (CTU, CTD, TON, TOF — spec 006).
 */
import type { TipoBloco } from '../../ladder/modelo'
import { descritorDe } from '../../ladder/blocos'

export interface SimboloBlocoProps {
  cx: number
  yTopo: number
  yBase: number
  largura: number
  yEntradaPrincipal: number
  /** Altura da linha de controle (R/LD); omitida se o bloco não tem controle. */
  yEntradaControle?: number
  tipo: TipoBloco
  instancia: string
  preset: number
  saida: string | null
  endereco?: string | null
  selecionado: boolean
  fantasma?: boolean
  perigo?: boolean
  /** Energia na entrada principal (CU/CD/IN) durante simulação. */
  entradaEnergizada?: boolean
  /** Valor interno ao vivo (CV ou ET em ms). */
  valorInterno?: number | null
}

const MARGEM_CAIXA = 4
const ALTURA_LINHA_TEXTO = 12
const COMPRIMENTO_TRACO = 10
const LARGURA_TRACO_ENERGIZADO = 3
const LARGURA_TRACO_NORMAL = 2

function corTraco(props: SimboloBlocoProps): string {
  if (props.perigo) return 'stroke-ide-perigo'
  if (props.fantasma) return 'stroke-ide-previa opacity-50'
  if (props.selecionado) return 'stroke-ide-destaque'
  return 'stroke-ide-fio'
}

function corTracoEntrada(props: SimboloBlocoProps): string {
  if (props.perigo) return 'stroke-ide-perigo'
  if (props.fantasma) return 'stroke-ide-previa opacity-50'
  if (props.entradaEnergizada) return 'stroke-ide-energizado'
  if (props.selecionado) return 'stroke-ide-destaque'
  return 'stroke-ide-fio'
}

function larguraTracoEntrada(props: SimboloBlocoProps): number {
  if (!props.perigo && !props.fantasma && props.entradaEnergizada) return LARGURA_TRACO_ENERGIZADO
  return LARGURA_TRACO_NORMAL
}

function corTexto(props: SimboloBlocoProps): string {
  if (props.perigo) return 'fill-ide-perigo font-semibold'
  if (props.fantasma) return 'fill-ide-previa opacity-50'
  if (props.selecionado) return 'fill-ide-destaque font-semibold'
  return 'fill-ide-suave'
}

export default function SimboloBloco(props: SimboloBlocoProps) {
  const desc = descritorDe(props.tipo)
  const { cx, yTopo, yBase, largura, yEntradaPrincipal, instancia, preset, saida, endereco, fantasma, valorInterno } = props
  const xEsquerda = cx - largura / 2 + MARGEM_CAIXA
  const xDireita = cx + largura / 2 - MARGEM_CAIXA
  const classeCaixa = `fill-ide-elevado ${corTraco(props)}`
  const classeTexto = corTexto(props)
  const yTitulo = yTopo + MARGEM_CAIXA + 11

  const presetRotulo =
    desc.preset.formal === 'PT' ? `${desc.preset.formal}=${preset}ms` : `${desc.preset.formal}=${preset}`
  const internoRotulo =
    valorInterno !== undefined && valorInterno !== null
      ? desc.familiaSimulacao === 'temporizador'
        ? `ET=${valorInterno}ms`
        : `CV=${valorInterno}`
      : null

  const linhasCentro: Array<{ texto: string; mono?: boolean }> = [
    { texto: presetRotulo },
    ...(internoRotulo ? [{ texto: internoRotulo }] : []),
    ...(!fantasma && endereco ? [{ texto: endereco, mono: true }] : []),
    ...(!fantasma ? [{ texto: `Q → ${saida ?? '?'}` }] : []),
  ]
  const yMeio = (yTopo + yBase) / 2
  const yPrimeiraLinhaCentro = yMeio - ((linhasCentro.length - 1) * ALTURA_LINHA_TEXTO) / 2

  return (
    <g>
      <rect
        x={xEsquerda}
        y={yTopo + MARGEM_CAIXA}
        width={xDireita - xEsquerda}
        height={yBase - yTopo - 2 * MARGEM_CAIXA}
        strokeWidth={2}
        className={classeCaixa}
      />

      <text x={cx} y={yTitulo} textAnchor="middle" className={`select-none text-[9px] font-bold ${classeTexto}`}>
        {`${desc.rotuloCurto} ${instancia}`}
      </text>

      {props.entradaEnergizada !== undefined && (
        <line
          x1={xEsquerda - COMPRIMENTO_TRACO}
          y1={yEntradaPrincipal}
          x2={xEsquerda}
          y2={yEntradaPrincipal}
          strokeWidth={larguraTracoEntrada(props)}
          className={corTracoEntrada(props)}
        />
      )}

      <text x={xEsquerda + 6} y={yEntradaPrincipal + 3} textAnchor="start" className={`select-none text-[9px] font-semibold ${classeTexto}`}>
        {desc.entradaPrincipal}
      </text>

      {desc.controle !== null && props.yEntradaControle !== undefined && (
        <text
          x={xEsquerda + 6}
          y={props.yEntradaControle + 3}
          textAnchor="start"
          className={`select-none text-[9px] font-semibold ${classeTexto}`}
        >
          {desc.controle.formal}
        </text>
      )}

      {linhasCentro.map((linha, indice) => (
        <text
          key={linha.texto}
          x={cx}
          y={yPrimeiraLinhaCentro + indice * ALTURA_LINHA_TEXTO}
          textAnchor="middle"
          className={`select-none ${linha.mono ? 'font-mono text-[8px]' : 'text-[9px]'} ${classeTexto}`}
        >
          {linha.texto}
        </text>
      ))}
    </g>
  )
}
