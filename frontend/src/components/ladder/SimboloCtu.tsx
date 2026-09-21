/**
 * Símbolo do contador crescente CTU (spec 002, plano D-7/D-19, tarefa #18).
 *
 * Isolamento do desenho do CTU (D-7, requisito destacável Q-7): tudo que é
 * específico do contador — a caixa de bloco de função, os rótulos CU/R/PV/Q —
 * vive só aqui, para que retirar o CTU (Q-7) baste apagar este arquivo e as
 * referências em `GradeDegrau.tsx`, sem tocar `Simbolos.tsx` (que só conhece
 * contato/bobina). Segue a mesma convenção visual dos outros símbolos: função
 * pura de geometria e estado, sem ler o diagrama nem decidir posição — isso é
 * de `GradeDegrau.tsx`, que também escolhe a linha de reset a mostrar durante
 * a prévia (o núcleo, `ladder/ctu.ts`, é quem decide qual seria de verdade).
 *
 * A caixa ocupa a coluna terminal, da altura da linha 0 (`yTopo`, onde entra
 * o contato de contagem) até a base da linha de reset (`yBase`, onde entra o
 * contato de reinício) — as duas entradas de um bloco de função CTU (IEC
 * 61131-3): "CU" na altura de `yEntradaCu` e "R" na de `yEntradaR`, ambas
 * ancoradas perto da borda esquerda da caixa (onde o fio de fato entra). "Q"
 * é a única saída, escrita na variável vinculada (`saida`): "Q → nome" ou
 * "Q → ?" sem vínculo, com o endereço (se houver) numa linha acima, mesma
 * convenção do `RotuloVariavel` de `Simbolos.tsx` — duplicada aqui de
 * propósito (D-7): os dois arquivos de símbolo não dependem um do outro.
 *
 * **Fundo opaco (ajuste pós-verificação em Chromium):** a caixa preenche com
 * `fill-ide-elevado` (token sólido nos dois temas) para não deixar o fio da
 * linha 0/linha de reset — que atravessa o SVG inteiro, por trás de qualquer
 * símbolo — riscar o texto de dentro. Como este componente é desenhado
 * depois dos traços no SVG (`GradeDegrau.tsx`), o preenchimento sólido já
 * basta para escondê-los; nenhuma mudança de geometria do traço foi
 * necessária. "CU" e "R" ficam na altura real das entradas (`yEntradaCu`/
 * `yEntradaR`, o que corresponde ao ponto em que o fio de fato entra), mas
 * "CTU" e a instância viraram uma única linha no topo — perto o bastante do
 * "CU" para uma caixa pequena (`linhaReset` mínimo, só 2 linhas de grade), e
 * antes só cabiam uma acima da outra bem em cima da altura de "CU". PV,
 * endereço e "Q → nome" ficam centralizados no meio vertical da caixa, longe
 * das duas entradas (que são sempre fixas a 32px do topo/base,
 * independente de `linhaReset` — ver `yEntradaCu`/`yEntradaR`), então nunca
 * colidem com "CU"/"R" nem entre si.
 *
 * Estados `selecionado`/`perigo`/`fantasma` seguem a mesma precedência de
 * `Simbolos.tsx` (perigo > fantasma > selecionado > normal). Só tokens
 * `ide-*` — nenhuma cor Tailwind fixa.
 *
 * **Energização — só o CU, nunca a caixa inteira (spec 004, RF-6/RF-14):**
 * `cuEnergizado` reflete `elementos[id]` do CTU — "a energia chega à entrada
 * de contagem (CU)", **não** o resultado `Q` do contador (esse é lido pelos
 * contatos de outros degraus, fora deste componente). Pintar a caixa inteira
 * de energizado sugeriria "o contador atingiu o limite", que é outra coisa —
 * por isso o desenho é um traço próprio, colado à borda esquerda na altura
 * de `yEntradaCu` (onde o fio de CU de fato entra), com a mesma codificação
 * redundante dos demais símbolos (cor `ide-energizado` **e** espessura maior
 * que o traço normal). A caixa e o restante do rótulo não mudam. Precedência
 * igual à de `Simbolos.tsx`: `perigo` > `fantasma` > `cuEnergizado` >
 * `selecionado` > normal.
 */

export interface SimboloCtuProps {
  /** Centro horizontal da coluna terminal (mesma convenção de `cx` nos demais símbolos). */
  cx: number
  /** Topo da caixa — topo da linha 0. */
  yTopo: number
  /** Base da caixa — base da linha de reset. */
  yBase: number
  /** Largura da coluna terminal; a caixa ocupa quase toda, com uma margem. */
  largura: number
  /** Altura da linha 0 — posição vertical do rótulo "CU". */
  yEntradaCu: number
  /** Altura da linha de reset — posição vertical do rótulo "R". */
  yEntradaR: number
  instancia: string
  pv: number
  /** Variável vinculada à saída Q, ou `null` sem vínculo. */
  saida: string | null
  /** Endereço da variável de saída, ou `null`/ausente sem endereço/vínculo. */
  endereco?: string | null
  selecionado: boolean
  /** Traço `ide-previa` com opacidade reduzida (prévia de inserção). */
  fantasma?: boolean
  /** Traço `ide-perigo` (prévia de remoção sobre o elemento). */
  perigo?: boolean
  /** Energia da simulação chega à entrada de contagem (CU) — spec 004,
   * RF-6. **Tri-estado, de propósito:** `undefined` (sem simulação) não
   * desenha o traço de CU — comportamento idêntico ao de hoje; `true`/
   * `false` (em simulação) desenha o traço, energizado ou não. Ver nota
   * acima: nunca a caixa inteira, só o traço de entrada do CU. */
  cuEnergizado?: boolean
}

const MARGEM_CAIXA = 4
/** Espaço vertical entre as linhas do bloco central (PV/endereço/Q). */
const ALTURA_LINHA_TEXTO = 12
/** Comprimento do traço de entrada do CU, saindo da borda esquerda da caixa. */
const COMPRIMENTO_TRACO_CU = 10
const LARGURA_TRACO_CU_ENERGIZADO = 3
const LARGURA_TRACO_CU_NORMAL = 2

function corTraco({ selecionado, fantasma, perigo }: SimboloCtuProps): string {
  if (perigo) return 'stroke-ide-perigo'
  if (fantasma) return 'stroke-ide-previa opacity-50'
  if (selecionado) return 'stroke-ide-destaque'
  return 'stroke-ide-fio'
}

/** Cor do traço de entrada do CU — mesma precedência de `Simbolos.tsx`
 * (perigo > fantasma > energizado > selecionado > normal). */
function corTracoCu(props: SimboloCtuProps): string {
  if (props.perigo) return 'stroke-ide-perigo'
  if (props.fantasma) return 'stroke-ide-previa opacity-50'
  if (props.cuEnergizado) return 'stroke-ide-energizado'
  if (props.selecionado) return 'stroke-ide-destaque'
  return 'stroke-ide-fio'
}

/** Espessura do traço de entrada do CU: só a energização altera (RF-14). */
function larguraTracoCu({ perigo, fantasma, cuEnergizado }: SimboloCtuProps): number {
  if (!perigo && !fantasma && cuEnergizado) return LARGURA_TRACO_CU_ENERGIZADO
  return LARGURA_TRACO_CU_NORMAL
}

function corTexto({ selecionado, fantasma, perigo }: SimboloCtuProps): string {
  if (perigo) return 'fill-ide-perigo font-semibold'
  if (fantasma) return 'fill-ide-previa opacity-50'
  if (selecionado) return 'fill-ide-destaque font-semibold'
  return 'fill-ide-suave'
}

export default function SimboloCtu(props: SimboloCtuProps) {
  const { cx, yTopo, yBase, largura, yEntradaCu, yEntradaR, instancia, pv, saida, endereco, fantasma, cuEnergizado } = props
  const xEsquerda = cx - largura / 2 + MARGEM_CAIXA
  const xDireita = cx + largura / 2 - MARGEM_CAIXA
  // Fundo sólido (não "fill-none"): sem ele, o fio da linha 0/linha de reset
  // — desenhado antes deste símbolo no SVG, atravessando o degrau inteiro —
  // aparecia riscando o texto por dentro da caixa.
  const classeCaixa = `fill-ide-elevado ${corTraco(props)}`
  const classeTexto = corTexto(props)

  // "CTU" e a instância numa linha só, perto do topo: com a caixa no menor
  // tamanho possível (linhaReset = 1, só duas linhas de grade), uma segunda
  // linha embaixo ficaria colada em "CU" (fixo a 32px do topo, altura da
  // linha 0 — não depende de linhaReset).
  const yTitulo = yTopo + MARGEM_CAIXA + 11

  // PV/endereço/Q centralizados no meio vertical da caixa: essa região cresce
  // com `linhaReset` e fica sempre longe das duas entradas (fixas a 32px do
  // topo/base), então nunca colide com "CTU"/"CU" em cima nem com "R" embaixo.
  const linhasCentro: Array<{ texto: string; mono?: boolean }> = [
    { texto: `PV=${pv}` },
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
        {`CTU ${instancia}`}
      </text>

      {/* Traço de entrada do CU (spec 004, RF-6/RF-14): curto, colado à
       * borda esquerda, na altura real de `yEntradaCu` — onde o fio de
       * contagem entra. Não afeta a caixa nem o restante do rótulo. Só
       * existe fora de edição (`cuEnergizado` presente, ou seja, em
       * simulação): `undefined` (sem simulação) não desenha nada — o
       * desenho fica idêntico ao de hoje. */}
      {cuEnergizado !== undefined && (
        <line
          x1={xEsquerda - COMPRIMENTO_TRACO_CU}
          y1={yEntradaCu}
          x2={xEsquerda}
          y2={yEntradaCu}
          strokeWidth={larguraTracoCu(props)}
          className={corTracoCu(props)}
        />
      )}

      <text x={xEsquerda + 6} y={yEntradaCu + 3} textAnchor="start" className={`select-none text-[9px] font-semibold ${classeTexto}`}>
        CU
      </text>
      <text x={xEsquerda + 6} y={yEntradaR + 3} textAnchor="start" className={`select-none text-[9px] font-semibold ${classeTexto}`}>
        R
      </text>

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
