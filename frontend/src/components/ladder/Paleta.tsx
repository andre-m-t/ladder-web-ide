/**
 * Paleta de elementos do editor (tarefa #22, D-12; barra de ferramentas na
 * #23, D-13; ícones `lucide-react` e item **Ramo** na #24,
 * `agora-precisamos-trabalhar-em-cozy-dragon.md`, D-14).
 *
 * Cada item é uma peça arrastável (aparência de peça: borda tracejada,
 * cursor de arrasto), que também pode ser pega por teclado (Espaço).
 * `EditorLadder.tsx` é quem decide o que a máquina de estado do arrasto faz
 * com o `pointerdown`/Espaço — este componente só encaminha.
 *
 * **Sem rótulo "Paleta" e sem SVG duplicado (D-14):** o título discreto da
 * #23 e o mini-SVG de `Simbolos.tsx` saem — cada item mostra só o **glifo
 * monoespaçado** do símbolo (`-| |-`, `-|/|-`, `-( )-`) ou, para o item
 * **Ramo** (novo, essencial para o contato de selo — D-14 do plano), o
 * ícone `GitFork` do `lucide-react`, mais o nome. A lixeira ganha o ícone
 * `Trash2`. Todo ícone é `aria-hidden`: o nome acessível de cada item
 * continua sendo só o texto do rótulo.
 *
 * **Tokens só:** nenhuma cor Tailwind fixa — só `bg-/text-/border-ide-*`.
 *
 * A lixeira é ao mesmo tempo alvo de soltar (pointerenter/leave) e botão de
 * ação (clique ou Espaço/Enter com foco nela remove o elemento ou ramo
 * marcado, ou conclui o arrasto por teclado que estiver em curso sobre ela).
 * Fica desabilitada quando não há nada marcado e nenhum arrasto em curso —
 * nesse estado ela não é alvo de nada, então desabilitar não atrapalha o
 * soltar.
 *
 * `select-none touch-none` nos itens e na lixeira, e `draggable={false}` +
 * `onDragStart` bloqueado: correção de bug real do Chromium (relatado depois
 * da entrega inicial da #22) em que, faltando isso, uma seleção de texto
 * deixada por uma interação anterior fazia o segundo arrasto de ponteiro
 * virar um drag nativo de conteúdo, e o navegador cancelava o gesto
 * (`pointercancel`) no meio — ver o comentário de `armarPonteiro` em
 * `EditorLadder.tsx`, que é quem também limpa a seleção e chama
 * `preventDefault` no `pointerdown`.
 */
import { GitFork, Trash2 } from 'lucide-react'
import type { KeyboardEvent, PointerEvent } from 'react'

/** Elementos que a paleta oferece para arrastar. SET/RESET e o contador
 * entram na tarefa #18, quando este tipo cresce. */
export type TipoPaleta = 'contato_na' | 'contato_nf' | 'bobina' | 'ramo'

export interface PaletaProps {
  /** Há um elemento ou ramo marcado na grade (habilita a lixeira como botão de ação). */
  marcado: boolean
  /** Há um arrasto em curso, de qualquer origem (mantém a lixeira habilitada
   * como alvo de soltar, mesmo sem nada marcado). */
  emArrasto: boolean
  /** O alvo do arrasto em curso é a lixeira (destaque visual). */
  sobreLixeira: boolean
  /** pointerdown num item: início do arrasto por ponteiro (armado; só vira
   * arrasto de fato ao passar do limiar de 4px — decisão de `EditorLadder`). */
  aoIniciarArrastoPonteiro: (tipo: TipoPaleta, evento: PointerEvent<HTMLDivElement>) => void
  /** Espaço num item: início do arrasto por teclado. */
  aoIniciarArrastoTeclado: (tipo: TipoPaleta) => void
  /** pointerenter/leave (e foco/blur, para o arrasto por teclado) na
   * lixeira: avisa que ela é o alvo do arrasto em curso. */
  aoPassarLixeira: (sobre: boolean) => void
  /** Clique (ou Espaço/Enter, via ativação nativa do `<button>`) na lixeira:
   * remove o elemento/ramo marcado, ou conclui o arrasto em curso sobre ela. */
  aoAcionarLixeira: () => void
  /** Outras teclas na lixeira — hoje, ArrowRight devolve o arrasto por
   * teclado para a grade. */
  aoTeclarNaLixeira: (evento: KeyboardEvent<HTMLButtonElement>) => void
}

/** Item com glifo monoespaçado (contatos/bobina) ou ícone `lucide-react`
 * (Ramo, sem glifo textual equivalente que caiba na barra). */
const ITENS: Array<{ tipo: TipoPaleta; rotulo: string; glifo?: string }> = [
  { tipo: 'contato_na', rotulo: 'Contato NA', glifo: '-| |-' },
  { tipo: 'contato_nf', rotulo: 'Contato NF', glifo: '-|/|-' },
  { tipo: 'bobina', rotulo: 'Bobina', glifo: '-( )-' },
  { tipo: 'ramo', rotulo: 'Ramo' },
]

const ID_AJUDA_LIXEIRA = 'paleta-lixeira-ajuda'

export default function Paleta({
  marcado,
  emArrasto,
  sobreLixeira,
  aoIniciarArrastoPonteiro,
  aoIniciarArrastoTeclado,
  aoPassarLixeira,
  aoAcionarLixeira,
  aoTeclarNaLixeira,
}: PaletaProps) {
  function aoTeclarNoItem(evento: KeyboardEvent<HTMLDivElement>, tipo: TipoPaleta) {
    if (evento.key === ' ' || evento.key === 'Spacebar') {
      evento.preventDefault()
      aoIniciarArrastoTeclado(tipo)
    }
  }

  const lixeiraDesabilitada = !marcado && !emArrasto

  return (
    <section
      aria-label="Paleta de elementos"
      className="flex w-full flex-wrap items-center gap-3 border-b border-ide-borda bg-ide-painel px-3 py-2"
    >
      {ITENS.map((item) => {
        const idInstrucao = `paleta-instrucao-${item.tipo}`
        return (
          <div key={item.tipo} className="flex flex-col items-center gap-1">
            <div
              role="button"
              tabIndex={0}
              aria-roledescription="item arrastável"
              aria-describedby={idInstrucao}
              data-tipo-paleta={item.tipo}
              draggable={false}
              onDragStart={(evento) => evento.preventDefault()}
              onPointerDown={(evento) => aoIniciarArrastoPonteiro(item.tipo, evento)}
              onKeyDown={(evento) => aoTeclarNoItem(evento, item.tipo)}
              className="inline-flex cursor-grab touch-none select-none items-center gap-1.5 rounded-lg border border-dashed border-ide-borda bg-ide-elevado px-3 py-1.5 text-sm font-medium text-ide-texto outline-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque"
            >
              {item.glifo ? (
                <span aria-hidden="true" className="font-mono text-[11px] text-ide-suave">
                  {item.glifo}
                </span>
              ) : (
                <GitFork aria-hidden="true" size={16} className="text-ide-suave" />
              )}
              {item.rotulo}
            </div>
            <p id={idInstrucao} className="sr-only">
              Item arrastável. Pressione espaço para pegar; use as setas para escolher a célula de destino; espaço ou
              Enter soltam; Esc cancela.
            </p>
          </div>
        )
      })}

      <button
        type="button"
        data-lixeira="true"
        disabled={lixeiraDesabilitada}
        aria-describedby={ID_AJUDA_LIXEIRA}
        draggable={false}
        onDragStart={(evento) => evento.preventDefault()}
        onClick={aoAcionarLixeira}
        onKeyDown={aoTeclarNaLixeira}
        onPointerEnter={() => aoPassarLixeira(true)}
        onPointerLeave={() => aoPassarLixeira(false)}
        onFocus={() => aoPassarLixeira(true)}
        onBlur={() => aoPassarLixeira(false)}
        className={
          sobreLixeira
            ? 'ml-auto inline-flex touch-none select-none items-center gap-1.5 rounded-lg border-2 border-ide-perigo bg-ide-perigo/10 px-3 py-1.5 text-sm font-medium text-ide-perigo'
            : 'ml-auto inline-flex touch-none select-none items-center gap-1.5 rounded-lg border border-ide-borda bg-ide-elevado px-3 py-1.5 text-sm font-medium text-ide-texto hover:bg-ide-painel disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ide-elevado'
        }
      >
        <Trash2 aria-hidden="true" size={16} />
        Lixeira
      </button>
      <p id={ID_AJUDA_LIXEIRA} className="sr-only">
        {lixeiraDesabilitada
          ? 'Marque um elemento ou ramo no degrau para habilitar a lixeira, ou arraste um item da grade até aqui.'
          : 'Solta remove o elemento ou ramo marcado, ou o item que estiver sendo arrastado até aqui.'}
      </p>
    </section>
  )
}
