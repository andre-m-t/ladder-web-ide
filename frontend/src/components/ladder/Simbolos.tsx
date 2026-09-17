/**
 * Símbolos gráficos dos elementos do degrau (plano D-1; padrão reescrito a
 * partir de `spikes/canvas-svg/src/App.tsx`, sem copiar).
 *
 * Cada símbolo é uma função pura de posição (`cx`, `cy` — centro da célula) e
 * estado (`variavel`, `selecionado`, `semRotulo`, `fantasma`, `perigo`): nada
 * aqui lê o diagrama nem decide onde a célula fica na grade, isso é de
 * `GradeDegrau.tsx`. SET/RESET (variantes de bobina) e o contador CTU entram
 * na tarefa #18.
 *
 * `semRotulo` esconde o nome da variável (usado pelo ícone da paleta, que não
 * tem variável nenhuma para mostrar). `fantasma` é a prévia de inserção
 * (traço sky com opacidade reduzida) e implica `semRotulo` — a prévia ainda
 * não tem variável vinculada. `perigo` é a prévia de remoção sobre um
 * elemento existente (traço e rótulo em vermelho). Precedência de cor:
 * `perigo` > `fantasma` > `selecionado` > normal.
 */

export interface SimboloProps {
  cx: number
  cy: number
  variavel: string | null
  selecionado: boolean
  /** Não desenha o nome da variável (ícone da paleta). */
  semRotulo?: boolean
  /** Traço sky com opacidade reduzida (prévia de inserção); implica semRotulo. */
  fantasma?: boolean
  /** Traço vermelho (prévia de remoção sobre o elemento). */
  perigo?: boolean
}

const MEIA_ALTURA = 14
const AFASTAMENTO_TRACO = 8

function corTraco({ selecionado, fantasma, perigo }: SimboloProps): string {
  if (perigo) return 'stroke-red-600'
  if (fantasma) return 'stroke-sky-500 opacity-50'
  if (selecionado) return 'stroke-sky-600'
  return 'stroke-slate-700'
}

function corTexto({ selecionado, perigo }: SimboloProps): string {
  if (perigo) return 'fill-red-600 font-semibold'
  if (selecionado) return 'fill-sky-700 font-semibold'
  return 'fill-slate-600'
}

/** Nome da variável acima do símbolo, ou "?" quando ainda não vinculada. */
function RotuloVariavel(props: SimboloProps) {
  const { cx, cy, variavel } = props
  return (
    <text
      x={cx}
      y={cy - MEIA_ALTURA - 6}
      textAnchor="middle"
      className={`text-[10px] ${corTexto(props)}`}
    >
      {variavel ?? '?'}
    </text>
  )
}

/** Contato normalmente aberto: `--| |--`. */
export function ContatoNA(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx - AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={2} className={classe} />
      <line x1={cx + AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={2} className={classe} />
    </g>
  )
}

/** Contato normalmente fechado: `--|/|--`. */
export function ContatoNF(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx - AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={2} className={classe} />
      <line x1={cx + AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={2} className={classe} />
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy + MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy - MEIA_ALTURA} strokeWidth={2} className={classe} />
    </g>
  )
}

/**
 * Bobina simples: `--( )--`. `bobina_set`/`bobina_reset` (marca SET/RESET
 * dentro do círculo) chegam na tarefa #18; por ora, todo tipo de bobina usa
 * este mesmo traço.
 */
export function Bobina(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  const raio = MEIA_ALTURA
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <path d={`M ${cx - 4} ${cy - raio} A ${raio} ${raio} 0 0 0 ${cx - 4} ${cy + raio}`} strokeWidth={2} className={classe} />
      <path d={`M ${cx + 4} ${cy - raio} A ${raio} ${raio} 0 0 1 ${cx + 4} ${cy + raio}`} strokeWidth={2} className={classe} />
    </g>
  )
}
