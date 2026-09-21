/**
 * Símbolos gráficos dos elementos do degrau (plano D-1; padrão reescrito a
 * partir de `spikes/canvas-svg/src/App.tsx`, sem copiar).
 *
 * Cada símbolo é uma função pura de posição (`cx`, `cy` — centro da célula) e
 * estado (`variavel`, `endereco`, `selecionado`, `semRotulo`, `fantasma`,
 * `perigo`): nada aqui lê o diagrama nem decide onde a célula fica na grade,
 * isso é de `GradeDegrau.tsx`. `BobinaSet`/`BobinaReset` (tarefa #18) marcam
 * "S"/"R" dentro do mesmo traço de bobina; o contador CTU, por ocupar duas
 * linhas e ter rótulos próprios (CU/R/PV/Q), tem desenho isolado em
 * `SimboloCtu.tsx` (D-7), não neste arquivo.
 *
 * `semRotulo` esconde nome e endereço da variável (usado pelo ícone da
 * paleta, que não tem variável nenhuma para mostrar). `fantasma` é a prévia
 * de inserção (traço `ide-previa` com opacidade reduzida) e implica
 * `semRotulo` — a prévia ainda não tem variável vinculada. `perigo` é a
 * prévia de remoção sobre um elemento existente (traço e rótulo em
 * `ide-perigo`). Precedência de cor: `perigo` > `fantasma` > `selecionado` >
 * normal.
 *
 * **Energização (spec 004, RF-6/RF-14/D-12):** `energizado` marca que a
 * simulação encontrou energia neste elemento — contato conduzindo (NA com
 * variável verdadeira, NF com falsa) ou bobina com energia chegando até ela
 * (semântica de `simulacao.ts#EnergizacaoDegrau`, decidida pela frente N e
 * confirmada pelo orquestrador). A distinção é **redundante** (RF-14): cor
 * (`ide-energizado`) **e** espessura do traço (3 em vez de 2), para
 * sobreviver aos dois temas e a quem não distingue a cor. Ausente/falso =
 * exatamente o traço de hoje — nenhum teste existente muda de resultado.
 * Precedência: `perigo` > `fantasma` > `energizado` > `selecionado` > normal
 * — a prévia de edição sempre vence (nunca coexiste com simulação, que
 * congela a edição, D-9), e o estado ao vivo da simulação é mais saliente do
 * que uma mera seleção estrutural.
 *
 * **Tokens só (plano §13, D-13):** nenhuma cor Tailwind fixa (`slate-*`,
 * `sky-*`, `red-*`...) — só classes `stroke-ide-*`/`fill-ide-*`, para que o
 * tema escuro/claro troque a aparência sem tocar este arquivo.
 *
 * **Endereço acima do nome (D-13):** quando a variável vinculada tem
 * `endereco` (`%IX0.1`...), ele aparece em texto pequeno monoespaçado acima
 * do nome, que por sua vez fica acima do símbolo. Sem variável vinculada, o
 * nome mostra "?" e não há linha de endereço.
 */

export interface SimboloProps {
  cx: number
  cy: number
  variavel: string | null
  /** Endereço da variável vinculada (`%IX0.1`...), ou `null`/ausente quando
   * a variável é interna ou não há variável vinculada. */
  endereco?: string | null
  selecionado: boolean
  /** Não desenha nome nem endereço da variável (ícone da paleta). */
  semRotulo?: boolean
  /** Traço `ide-previa` com opacidade reduzida (prévia de inserção); implica semRotulo. */
  fantasma?: boolean
  /** Traço `ide-perigo` (prévia de remoção sobre o elemento). */
  perigo?: boolean
  /** Energia da simulação chega/passa por este elemento (spec 004, RF-6).
   * Ausente/falso = comportamento de hoje. Ver nota de precedência acima. */
  energizado?: boolean
}

const MEIA_ALTURA = 14
const AFASTAMENTO_TRACO = 8
/** Espessura do traço energizado — incremento sobre o traço normal (2px),
 * codificação redundante com a cor (RF-14, D-12). */
const LARGURA_TRACO_ENERGIZADO = 3
const LARGURA_TRACO_NORMAL = 2

function corTraco({ selecionado, fantasma, perigo, energizado }: SimboloProps): string {
  if (perigo) return 'stroke-ide-perigo'
  if (fantasma) return 'stroke-ide-previa opacity-50'
  if (energizado) return 'stroke-ide-energizado'
  if (selecionado) return 'stroke-ide-destaque'
  return 'stroke-ide-fio'
}

/** Espessura do traço: só a energização altera (RF-14) — as demais cores
 * (perigo/fantasma/selecionado) mantêm a espessura normal de hoje. */
function larguraTraco({ perigo, fantasma, energizado }: SimboloProps): number {
  if (!perigo && !fantasma && energizado) return LARGURA_TRACO_ENERGIZADO
  return LARGURA_TRACO_NORMAL
}

function corTexto({ selecionado, perigo }: SimboloProps): string {
  if (perigo) return 'fill-ide-perigo font-semibold'
  if (selecionado) return 'fill-ide-destaque font-semibold'
  return 'fill-ide-suave'
}

function corEndereco({ selecionado, perigo }: SimboloProps): string {
  if (perigo) return 'fill-ide-perigo'
  if (selecionado) return 'fill-ide-destaque'
  return 'fill-ide-suave'
}

/** Cor da marca "S"/"R" dentro da bobina — mesma precedência de `corTraco`,
 * mas como preenchimento de texto (a marca é desenhada com `<text>`, não
 * `<line>`/`<path>`). */
function corMarca({ selecionado, fantasma, perigo }: SimboloProps): string {
  if (perigo) return 'fill-ide-perigo'
  if (fantasma) return 'fill-ide-previa opacity-50'
  if (selecionado) return 'fill-ide-destaque'
  return 'fill-ide-fio'
}

/** Endereço (opcional) e nome da variável acima do símbolo, ou "?" quando
 * ainda não vinculada. O endereço, quando existe, fica na linha de cima, em
 * fonte monoespaçada menor. */
function RotuloVariavel(props: SimboloProps) {
  const { cx, cy, variavel, endereco } = props
  const yNome = cy - MEIA_ALTURA - 6
  const yEndereco = yNome - 10
  return (
    <>
      {endereco && (
        <text x={cx} y={yEndereco} textAnchor="middle" className={`font-mono text-[9px] ${corEndereco(props)}`}>
          {endereco}
        </text>
      )}
      <text x={cx} y={yNome} textAnchor="middle" className={`text-[10px] ${corTexto(props)}`}>
        {variavel ?? '?'}
      </text>
    </>
  )
}

/** Contato normalmente aberto: `--| |--`. */
export function ContatoNA(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  const largura = larguraTraco(props)
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx - AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={largura} className={classe} />
      <line x1={cx + AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={largura} className={classe} />
    </g>
  )
}

/** Contato normalmente fechado: `--|/|--`. */
export function ContatoNF(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  const largura = larguraTraco(props)
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx - AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={largura} className={classe} />
      <line x1={cx + AFASTAMENTO_TRACO} y1={cy - MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy + MEIA_ALTURA} strokeWidth={largura} className={classe} />
      <line x1={cx - AFASTAMENTO_TRACO} y1={cy + MEIA_ALTURA} x2={cx + AFASTAMENTO_TRACO} y2={cy - MEIA_ALTURA} strokeWidth={largura} className={classe} />
    </g>
  )
}

/** Os dois arcos `--( )--`, comuns às três variantes de bobina abaixo. */
function ArcosBobina({ cx, cy, classe, largura }: { cx: number; cy: number; classe: string; largura: number }) {
  const raio = MEIA_ALTURA
  return (
    <>
      <path d={`M ${cx - 4} ${cy - raio} A ${raio} ${raio} 0 0 0 ${cx - 4} ${cy + raio}`} strokeWidth={largura} className={classe} />
      <path d={`M ${cx + 4} ${cy - raio} A ${raio} ${raio} 0 0 1 ${cx + 4} ${cy + raio}`} strokeWidth={largura} className={classe} />
    </>
  )
}

/** Marca "S" ou "R" centralizada dentro do círculo da bobina (tarefa #18). */
function MarcaBobina({ letra, ...props }: SimboloProps & { letra: 'S' | 'R' }) {
  const { cx, cy } = props
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      className={`select-none text-[10px] font-bold ${corMarca(props)}`}
    >
      {letra}
    </text>
  )
}

/** Bobina simples: `--( )--`. */
export function Bobina(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <ArcosBobina cx={cx} cy={cy} classe={classe} largura={larguraTraco(props)} />
    </g>
  )
}

/** Bobina SET: `--(S)--` — liga a variável e a mantém ligada até um RESET. */
export function BobinaSet(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <ArcosBobina cx={cx} cy={cy} classe={classe} largura={larguraTraco(props)} />
      <MarcaBobina {...props} letra="S" />
    </g>
  )
}

/** Bobina RESET: `--(R)--` — desliga a variável e a mantém desligada até um SET. */
export function BobinaReset(props: SimboloProps) {
  const { cx, cy, semRotulo, fantasma } = props
  const classe = `fill-none ${corTraco(props)}`
  return (
    <g>
      {!semRotulo && !fantasma && <RotuloVariavel {...props} />}
      <ArcosBobina cx={cx} cy={cy} classe={classe} largura={larguraTraco(props)} />
      <MarcaBobina {...props} letra="R" />
    </g>
  )
}
