/**
 * Símbolos gráficos dos elementos do degrau (plano D-1; padrão reescrito a
 * partir de `spikes/canvas-svg/src/App.tsx`, sem copiar).
 *
 * Cada símbolo é uma função pura de posição (`cx`, `cy` — centro da célula) e
 * estado (`variavel`, `selecionado`): nada aqui lê o diagrama nem decide onde
 * a célula fica na grade, isso é de `GradeDegrau.tsx`. SET/RESET (variantes
 * de bobina) e o contador CTU entram na tarefa #18.
 */

export interface SimboloProps {
  cx: number
  cy: number
  variavel: string | null
  selecionado: boolean
}

const MEIA_ALTURA = 14
const AFASTAMENTO_TRACO = 8

function corTraco(selecionado: boolean): string {
  return selecionado ? 'stroke-sky-600' : 'stroke-slate-700'
}

function corTexto(selecionado: boolean): string {
  return selecionado ? 'fill-sky-700 font-semibold' : 'fill-slate-600'
}

/** Nome da variável acima do símbolo, ou "?" quando ainda não vinculada. */
function RotuloVariavel({ cx, cy, variavel, selecionado }: SimboloProps) {
  return (
    <text
      x={cx}
      y={cy - MEIA_ALTURA - 6}
      textAnchor="middle"
      className={`text-[10px] ${corTexto(selecionado)}`}
    >
      {variavel ?? '?'}
    </text>
  )
}

/** Contato normalmente aberto: `--| |--`. */
export function ContatoNA({ cx, cy, variavel, selecionado }: SimboloProps) {
  const classe = `fill-none ${corTraco(selecionado)}`
  return (
    <g>
      <RotuloVariavel cx={cx} cy={cy} variavel={variavel} selecionado={selecionado} />
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx - AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={2} className={classe} />
      <line x1={cx + AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={2} className={classe} />
    </g>
  )
}

/** Contato normalmente fechado: `--|/|--`. */
export function ContatoNF({ cx, cy, variavel, selecionado }: SimboloProps) {
  const classe = `fill-none ${corTraco(selecionado)}`
  return (
    <g>
      <RotuloVariavel cx={cx} cy={cy} variavel={variavel} selecionado={selecionado} />
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
export function Bobina({ cx, cy, variavel, selecionado }: SimboloProps) {
  const classe = `fill-none ${corTraco(selecionado)}`
  const raio = MEIA_ALTURA
  return (
    <g>
      <RotuloVariavel cx={cx} cy={cy} variavel={variavel} selecionado={selecionado} />
      <path d={`M ${cx - 4} ${cy - raio} A ${raio} ${raio} 0 0 0 ${cx - 4} ${cy + raio}`} strokeWidth={2} className={classe} />
      <path d={`M ${cx + 4} ${cy - raio} A ${raio} ${raio} 0 0 1 ${cx + 4} ${cy + raio}`} strokeWidth={2} className={classe} />
    </g>
  )
}
