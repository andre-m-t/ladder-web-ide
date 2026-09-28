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
 * monoespaçado** do símbolo (`-| |-`, `-|/|-`, `-( )-`, `-(S)-`, `-(R)-`,
 * `CTU`) ou, para o item **Ramo** (novo, essencial para o contato de selo —
 * D-14 do plano), o ícone `GitFork` do `lucide-react`, mais o nome. A
 * lixeira ganha o ícone `Trash2`. Todo ícone é `aria-hidden`: o nome
 * acessível de cada item continua sendo só o texto do rótulo.
 *
 * **SET/RESET e Contador (tarefa #18, D-19):** `Bobina SET`/`Bobina RESET`
 * são bobinas de escrita condicional (mesma posição/regra de uma bobina
 * comum, D-2); `Contador` insere o CTU (`ladder/ctu.ts` decide a linha de
 * reinício e recusa sem linha livre) — os três chegam à grade pela mesma
 * ferramenta genérica de arrasto que já serve contato/bobina/ramo, sem
 * nenhum código novo aqui além da entrada em `ITENS`.
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
 *
 * **`congelado` (spec 004, RF-15, D-20):** ausente/`false` desenha
 * exatamente como hoje (mesma regra que a Fatia 2 já usou para
 * `energizacao`). `true` (simulação ativa) esmaece cada item e a lixeira
 * (`opacity-50`, `cursor-not-allowed`, `aria-disabled` nos itens — a lixeira
 * é um `<button>` de verdade, então usa `disabled` nativo em vez de
 * `aria-disabled`).
 *
 * **Correção de 2026-09-21 (achado em Chromium real, revisão aditiva de
 * CA-8):** até esta correção, o `pointerdown` de um item congelado era
 * respondido por `EditorLadder` com um toast — e o toast nasce no canto
 * superior esquerdo, embaixo do cabeçalho, exatamente onde ficam os dois
 * primeiros itens ("Contato NA"/"Contato NF"): o aviso cobria o item de que
 * estava falando, e ainda interceptava o ponteiro do arrasto seguinte ao sair
 * da simulação. Decisão do autor: a paleta é **inerte** e não anuncia recusa —
 * sem gesto possível, não há o que anunciar. `EditorLadder` só continua
 * emitindo toast para tentativas que partem da **grade** ou do **teclado**.
 *
 * **Correção de 2026-09-22 (o remédio que virou doença):** a tentativa
 * anterior de tornar a paleta inerte usou `pointer-events-none` na classe e
 * deixou de passar o `onPointerDown` quando congelado. Isso **suprimia o
 * `preventDefault`** — e é ele que impede o navegador de tratar o toque como
 * início de seleção nativa. Sem ele, a seleção residual fazia o arrasto
 * **seguinte** virar drag nativo e morrer em `pointercancel`: exatamente o bug
 * que a #22 já havia corrigido, reintroduzido por um caminho novo (o e2e do
 * CA-8 falhava ao arrastar da paleta depois de sair da simulação).
 *
 * Por isso, e **não** por descuido: o `onPointerDown` é encaminhado *sempre*,
 * inclusive congelado, e a classe congelada **não** leva `pointer-events-none`.
 * Congelado, `EditorLadder` responde com `preventDefault` e sai — sem iniciar
 * arrasto e sem toast. Quem for "simplificar" isto de volta para
 * `pointer-events-none` vai reintroduzir o defeito pela terceira vez.
 *
 * O que sustenta a inércia visível continua: `opacity-50`, `cursor-not-allowed`,
 * `aria-disabled` e `tabIndex={-1}` (não alcançável por Tab). Espaço no item
 * ainda encaminha a `iniciarArrastoTeclado`, sem efeito prático porque o item
 * não recebe foco — quem decide (D-9) continua sendo `EditorLadder`.
 */
import { GitFork, Trash2 } from 'lucide-react'
import type { KeyboardEvent, PointerEvent } from 'react'

/** Elementos que a paleta oferece para arrastar. */
export type TipoPaleta =
  | 'contato_na'
  | 'contato_nf'
  | 'bobina'
  | 'bobina_set'
  | 'bobina_reset'
  | 'ramo'
  | 'ctu'
  | 'ctd'
  | 'ton'
  | 'tof'

export interface PaletaProps {
  /** Há um elemento ou ramo marcado na grade (habilita a lixeira como botão de ação). */
  marcado: boolean
  /** Há um arrasto em curso, de qualquer origem (mantém a lixeira habilitada
   * como alvo de soltar, mesmo sem nada marcado). */
  emArrasto: boolean
  /** O alvo do arrasto em curso é a lixeira (destaque visual). */
  sobreLixeira: boolean
  /** Simulação em andamento (spec 004, RF-15, D-20) — ausente/`false`:
   * desenho idêntico ao de hoje (mesma regra que `energizacao` usou na
   * Fatia 2). `true`: cada item vira `cursor-not-allowed`, `opacity-50` e
   * `aria-disabled`, e a lixeira acompanha — o gesto ainda é encaminhado a
   * `EditorLadder` (dono da regra, D-9), que decide recusar. */
  congelado?: boolean
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
  { tipo: 'bobina_set', rotulo: 'Bobina SET', glifo: '-(S)-' },
  { tipo: 'bobina_reset', rotulo: 'Bobina RESET', glifo: '-(R)-' },
  { tipo: 'ramo', rotulo: 'Ramo' },
  { tipo: 'ctu', rotulo: 'Contador ↑', glifo: 'CTU' },
  { tipo: 'ctd', rotulo: 'Contador ↓', glifo: 'CTD' },
  { tipo: 'ton', rotulo: 'TON', glifo: 'TON' },
  { tipo: 'tof', rotulo: 'TOF', glifo: 'TOF' },
]

const ID_AJUDA_LIXEIRA = 'paleta-lixeira-ajuda'

export default function Paleta({
  marcado,
  emArrasto,
  sobreLixeira,
  congelado,
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

  // Congelado tem prioridade: com simulação ativa a lixeira é inerte mesmo
  // que `marcado` tenha sobrevivido de antes de entrar em simulação (nada
  // limpa a marcação ao congelar — só o próprio gesto de editar é recusado).
  const lixeiraDesabilitada = Boolean(congelado) || (!marcado && !emArrasto)

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
              tabIndex={congelado ? -1 : 0}
              aria-roledescription="item arrastável"
              aria-describedby={idInstrucao}
              aria-disabled={congelado ? true : undefined}
              data-tipo-paleta={item.tipo}
              draggable={false}
              onDragStart={(evento) => evento.preventDefault()}
              // O handler é encaminhado **sempre**, inclusive congelado
              // (correção de 2026-09-22): é ele que chama `preventDefault`, e
              // sem isso o navegador inicia seleção nativa e cancela o arrasto
              // seguinte. Congelado, `EditorLadder` só faz `preventDefault` e
              // sai — sem arrasto e sem toast. Não há guarda equivalente em
              // `onKeyDown`: o item não é alcançável por Tab, basta o `tabIndex`.
              onPointerDown={(evento) => aoIniciarArrastoPonteiro(item.tipo, evento)}
              onKeyDown={(evento) => aoTeclarNoItem(evento, item.tipo)}
              className={
                congelado
                  ? 'inline-flex cursor-not-allowed touch-none select-none items-center gap-1.5 rounded-lg border border-dashed border-ide-borda bg-ide-elevado px-3 py-1.5 text-sm font-medium text-ide-texto opacity-50 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque'
                  : 'inline-flex cursor-grab touch-none select-none items-center gap-1.5 rounded-lg border border-dashed border-ide-borda bg-ide-elevado px-3 py-1.5 text-sm font-medium text-ide-texto outline-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque'
              }
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
        {congelado
          ? 'Edição congelada durante a simulação — a lixeira fica indisponível até sair da simulação.'
          : lixeiraDesabilitada
            ? 'Marque um elemento ou ramo no degrau para habilitar a lixeira, ou arraste um item da grade até aqui.'
            : 'Solta remove o elemento ou ramo marcado, ou o item que estiver sendo arrastado até aqui.'}
      </p>
    </section>
  )
}
