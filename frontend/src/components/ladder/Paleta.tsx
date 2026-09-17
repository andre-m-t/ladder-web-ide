/**
 * Paleta de elementos do editor (tarefa #22, plano
 * `agora-precisamos-trabalhar-em-cozy-dragon.md`, D-12): reescrita para o
 * gesto de arrastar-e-soltar, substituindo o modelo de "ferramenta ativa"
 * (D-4/R-2, revertido pelo autor). Não há mais botões de ação nem o tipo
 * `Ferramenta` — cada item é uma peça arrastável (aparência de peça: borda
 * tracejada, cursor de arrasto), que também pode ser pega por teclado
 * (Espaço). `EditorLadder.tsx` é quem decide o que a máquina de estado do
 * arrasto faz com o `pointerdown`/Espaço — este componente só encaminha.
 *
 * Cada item traz um mini-símbolo (herdado de D-11) à esquerda do nome,
 * reaproveitando `ContatoNA`/`ContatoNF`/`Bobina` de `Simbolos.tsx` com
 * `semRotulo` (o item da paleta não tem variável nenhuma para nomear). O
 * ícone é `aria-hidden`: o nome acessível continua sendo só o texto do
 * rótulo.
 *
 * A lixeira é ao mesmo tempo alvo de soltar (pointerenter/leave) e botão de
 * ação (clique ou Espaço/Enter com foco nela remove o elemento marcado, ou
 * conclui o arrasto por teclado que estiver em curso sobre ela). Fica
 * desabilitada quando não há nada marcado e nenhum arrasto em curso — nesse
 * estado ela não é alvo de nada, então desabilitar não atrapalha o soltar.
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
import type { KeyboardEvent, PointerEvent } from 'react'

import { Bobina, ContatoNA, ContatoNF, type SimboloProps } from './Simbolos'

/** Elementos que a paleta oferece para arrastar. SET/RESET e o contador
 * entram na tarefa #18, quando este tipo cresce. */
export type TipoPaleta = 'contato_na' | 'contato_nf' | 'bobina'

export interface PaletaProps {
  /** Há um elemento marcado na grade (habilita a lixeira como botão de ação). */
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
   * remove o elemento marcado, ou conclui o arrasto em curso sobre ela. */
  aoAcionarLixeira: () => void
  /** Outras teclas na lixeira — hoje, ArrowRight devolve o arrasto por
   * teclado para a grade. */
  aoTeclarNaLixeira: (evento: KeyboardEvent<HTMLButtonElement>) => void
}

const ITENS: Array<{ tipo: TipoPaleta; rotulo: string }> = [
  { tipo: 'contato_na', rotulo: 'Contato NA' },
  { tipo: 'contato_nf', rotulo: 'Contato NF' },
  { tipo: 'bobina', rotulo: 'Bobina' },
]

// viewBox maior que o ícone visível (28×20) porque o símbolo tem meia altura
// fixa de 14 (`Simbolos.tsx`) — a folga evita cortar o traço nas bordas.
const ICONE_LARGURA = 40
const ICONE_ALTURA = 32
const ICONE_CX = ICONE_LARGURA / 2
const ICONE_CY = ICONE_ALTURA / 2

function IconeItem({ tipo }: { tipo: TipoPaleta }) {
  const props: SimboloProps = {
    cx: ICONE_CX,
    cy: ICONE_CY,
    variavel: null,
    selecionado: false,
    semRotulo: true,
  }
  return (
    <svg viewBox={`0 0 ${ICONE_LARGURA} ${ICONE_ALTURA}`} width={28} height={20} aria-hidden="true" focusable="false">
      {tipo === 'contato_na' && <ContatoNA {...props} />}
      {tipo === 'contato_nf' && <ContatoNF {...props} />}
      {tipo === 'bobina' && <Bobina {...props} />}
    </svg>
  )
}

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
    <section aria-label="Paleta de elementos" className="flex flex-wrap items-center gap-3">
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
              className="inline-flex cursor-grab touch-none select-none items-center gap-1.5 rounded-lg border border-dashed border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              <span aria-hidden="true" className="flex flex-col gap-0.5">
                <span className="block h-0.5 w-3 rounded bg-slate-400" />
                <span className="block h-0.5 w-3 rounded bg-slate-400" />
                <span className="block h-0.5 w-3 rounded bg-slate-400" />
              </span>
              <IconeItem tipo={item.tipo} />
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
            ? 'inline-flex touch-none select-none items-center gap-1.5 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700'
            : 'inline-flex touch-none select-none items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white'
        }
      >
        Lixeira
      </button>
      <p id={ID_AJUDA_LIXEIRA} className="sr-only">
        {lixeiraDesabilitada
          ? 'Marque um elemento no degrau para habilitar a lixeira, ou arraste um item da grade até aqui.'
          : 'Solta remove o elemento marcado, ou o elemento que estiver sendo arrastado até aqui.'}
      </p>
    </section>
  )
}
