/**
 * Paleta de ferramentas do editor (plano D-4: seleciona-se a ferramenta,
 * depois a célula de destino — sem arrastar). Controlada pelas props, sem
 * estado próprio: quem decide o que "ativa" significa é `EditorLadder.tsx`.
 *
 * `Ferramenta` é a união que a tarefa #10 (mover), #15 (ramo) e #18 (SET,
 * RESET, CTU) estendem — só acrescentar o literal ao tipo e o botão abaixo.
 *
 * Cada botão traz um mini-símbolo (D-11) à esquerda do nome, reaproveitando
 * `ContatoNA`/`ContatoNF`/`Bobina` de `Simbolos.tsx` com `semRotulo` (a
 * ferramenta não tem variável nenhuma para nomear). `Remover` não tem símbolo
 * de degrau equivalente, então ganha um × desenhado aqui mesmo. O ícone é
 * `aria-hidden`: o nome acessível do botão continua sendo só o texto do
 * rótulo, como os testes por `name` já esperam.
 */

import { Bobina, ContatoNA, ContatoNF, type SimboloProps } from './Simbolos'

export type Ferramenta = 'contato_na' | 'contato_nf' | 'bobina' | 'remover'

export interface PaletaProps {
  ativa: Ferramenta | null
  aoEscolher: (ferramenta: Ferramenta | null) => void
}

const FERRAMENTAS: Array<{ id: Ferramenta; rotulo: string }> = [
  { id: 'contato_na', rotulo: 'Contato NA' },
  { id: 'contato_nf', rotulo: 'Contato NF' },
  { id: 'bobina', rotulo: 'Bobina' },
  { id: 'remover', rotulo: 'Remover' },
]

// viewBox maior que o ícone visível (28×20) porque o símbolo tem meia altura
// fixa de 14 (`Simbolos.tsx`) — a folga evita cortar o traço nas bordas.
const ICONE_LARGURA = 40
const ICONE_ALTURA = 32
const ICONE_CX = ICONE_LARGURA / 2
const ICONE_CY = ICONE_ALTURA / 2

/**
 * Ícone do botão. Os traços de `Simbolos.tsx` usam classes Tailwind fixas
 * (`stroke-slate-700`/`stroke-sky-600`), não `currentColor` — repintar de
 * branco exigiria mudar o modelo de cor do arquivo inteiro, fora do escopo
 * desta tarefa. Repassamos `selecionado` (já existe no contrato) para o
 * traço mudar de slate para sky quando pressionado, mas isso sozinho
 * desaparece: o botão pressionado tem fundo `bg-sky-600`, a mesma cor do
 * traço. O × de `Remover`, desenhado aqui, tem o mesmo problema com
 * `stroke-slate-700`. Por isso o ícone nunca muda de cor sozinho — quem dá
 * contraste é o chip claro em volta dele (ver `Paleta`, abaixo).
 */
function IconeFerramenta({ ferramenta, pressionada }: { ferramenta: Ferramenta; pressionada: boolean }) {
  const props: SimboloProps = {
    cx: ICONE_CX,
    cy: ICONE_CY,
    variavel: null,
    selecionado: pressionada,
    semRotulo: true,
  }
  return (
    <svg
      viewBox={`0 0 ${ICONE_LARGURA} ${ICONE_ALTURA}`}
      width={28}
      height={20}
      aria-hidden="true"
      focusable="false"
    >
      {ferramenta === 'contato_na' && <ContatoNA {...props} />}
      {ferramenta === 'contato_nf' && <ContatoNF {...props} />}
      {ferramenta === 'bobina' && <Bobina {...props} />}
      {ferramenta === 'remover' && (
        <g className="stroke-slate-700">
          <line x1={ICONE_CX - 8} y1={ICONE_CY - 8} x2={ICONE_CX + 8} y2={ICONE_CY + 8} strokeWidth={2} strokeLinecap="round" />
          <line x1={ICONE_CX - 8} y1={ICONE_CY + 8} x2={ICONE_CX + 8} y2={ICONE_CY - 8} strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

export default function Paleta({ ativa, aoEscolher }: PaletaProps) {
  return (
    <section aria-label="Paleta de ferramentas" className="flex flex-wrap gap-2">
      {FERRAMENTAS.map((ferramenta) => {
        const pressionada = ativa === ferramenta.id
        const icone = <IconeFerramenta ferramenta={ferramenta.id} pressionada={pressionada} />
        return (
          <button
            key={ferramenta.id}
            type="button"
            aria-pressed={pressionada}
            onClick={() => aoEscolher(pressionada ? null : ferramenta.id)}
            className={
              pressionada
                ? 'inline-flex items-center gap-1.5 rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-medium text-white'
                : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
            }
          >
            {pressionada ? (
              // Chip claro por trás do ícone: o traço do símbolo (slate/sky
              // fixo, ver comentário de `IconeFerramenta`) fica invisível
              // sobre o fundo sky do botão pressionado sem isso.
              <span data-testid="chip-icone" className="inline-flex items-center justify-center rounded bg-white/90 px-0.5">
                {icone}
              </span>
            ) : (
              icone
            )}
            {ferramenta.rotulo}
          </button>
        )
      })}
    </section>
  )
}
