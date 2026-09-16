/**
 * Paleta de ferramentas do editor (plano D-4: seleciona-se a ferramenta,
 * depois a célula de destino — sem arrastar). Controlada pelas props, sem
 * estado próprio: quem decide o que "ativa" significa é `EditorLadder.tsx`.
 *
 * `Ferramenta` é a união que a tarefa #10 (mover), #15 (ramo) e #18 (SET,
 * RESET, CTU) estendem — só acrescentar o literal ao tipo e o botão abaixo.
 */

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

export default function Paleta({ ativa, aoEscolher }: PaletaProps) {
  return (
    <section aria-label="Paleta de ferramentas" className="flex flex-wrap gap-2">
      {FERRAMENTAS.map((ferramenta) => {
        const pressionada = ativa === ferramenta.id
        return (
          <button
            key={ferramenta.id}
            type="button"
            aria-pressed={pressionada}
            onClick={() => aoEscolher(pressionada ? null : ferramenta.id)}
            className={
              pressionada
                ? 'rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
            }
          >
            {ferramenta.rotulo}
          </button>
        )
      })}
    </section>
  )
}
