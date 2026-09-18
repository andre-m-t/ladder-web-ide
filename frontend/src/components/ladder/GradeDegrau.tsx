/**
 * Grade SVG de um degrau (plano D-1, spike S4 §3 — SVG puro venceu Konva:
 * ver `docs/specs/002-editor-ladder/spike-canvas.md`).
 *
 * Reescrito na tarefa #22 (D-12: arrastar-e-soltar), redesenhado como cartão
 * de IDE na tarefa #23 (D-13) e estendido na tarefa #24
 * (`agora-precisamos-trabalhar-em-cozy-dragon.md`, D-14) com **largura
 * responsiva** e **ramo paralelo**. Este componente continua função pura das
 * props, sem estado próprio de diagrama e sem decidir se uma jogada é
 * válida: só desenha e encaminha os eventos nativos (clique, duplo clique,
 * tecla, pointerdown, pointerenter/leave) para quem manda,
 * `EditorLadder.tsx`, que é quem tem a máquina de estado do arrasto/marcação
 * e chama o núcleo para calcular prévia/recusa.
 *
 * **Degrau responsivo (D-14):** a largura da célula não é mais fixa. Um
 * `ResizeObserver` mede a largura disponível do cartão (o `div` que envolve
 * o `<svg>`) e `larguraCelula = max(56, (largura − margens) / 8)`. Sem
 * `ResizeObserver` (jsdom nos testes) cai num valor padrão fixo que
 * reproduz a largura antiga (64px de célula), então os testes existentes
 * continuam válidos sem mockar nada. Trilho direito e fio horizontal vão
 * até a borda útil calculada a partir dessa largura; abaixo do mínimo, o
 * `overflow-x-auto` do próprio wrapper rola só a área do degrau. A altura
 * cresce com a maior linha de ramo em uso (real ou em prévia de criação).
 *
 * **Ramo paralelo (D-14):** só a linha 0 (trilho principal) tinha desenho
 * até a tarefa #23; agora cada `Ramo` do rung desenha uma linha horizontal
 * entre a borda esquerda de `colunaInicio` e a direita de `colunaFim`, com
 * conectores verticais nas duas pontas até o trilho principal, e expõe uma
 * célula por coluna do intervalo como alvo de arrasto (mesmo mecanismo de
 * `aoClicarCelula`/`aoIniciarArrastoPonteiro` da linha 0 — só bobina nunca
 * entra nelas, e isso é regra do núcleo, não deste componente). A ponta
 * direita ganha uma **alça** focável (`role="slider"`): o arrasto por
 * ponteiro é geometria pura deste componente (não decide validade, só
 * traduz posição de tela em número de coluna e repassa por
 * `aoArrastarAlca`/`aoSoltarAlca`/`aoCancelarAlca`); o arrasto por teclado é
 * encaminhado cru por `aoTeclarNaAlca`, como já acontece com as células.
 *
 * `select-none touch-none` e `onDragStart` bloqueado na célula (SVG não tem o
 * atributo `draggable` do HTML): correção de bug real do Chromium (relatado
 * após a entrega inicial da #22) em que, sem isso, uma seleção de texto
 * residente na página fazia um arrasto de ponteiro seguinte virar um drag
 * nativo de conteúdo, cancelado pelo navegador (`pointercancel`) no meio do
 * gesto — ver `armarPonteiro` em `EditorLadder.tsx`.
 *
 * **Vários degraus (tarefa #10):** o cabeçalho de cada cartão ganha duas
 * ações — "Inserir degrau abaixo" e "Remover degrau" — encaminhadas cruas
 * para `EditorLadder.tsx` (`aoInserirDegrauAbaixo`/`aoRemoverDegrau`), que é
 * quem chama `inserirDegrau`/`removerDegrau` do núcleo e decide o que fazer
 * com uma recusa; este componente só desenha os botões, com `aria-label` que
 * cita o número do degrau (1-based).
 *
 * **Problemas na grade (tarefa #13):** `problemas` traz só os problemas do
 * próprio degrau (filtrados por `EditorLadder`, que é quem chama
 * `validarDiagrama`). Um problema com `elementoId` marca a célula daquele
 * elemento — cor e ícone no canto (círculo vermelho para erro, triângulo
 * amarelo para aviso), sem tocar `classeRetangulo` (a marcação de
 * recusa/prévia/seleção continua tendo a palavra final sobre o preenchimento
 * da célula: o problema é só um selo por cima). Um problema com
 * `elementoId: null` (ex.: `rung_incompleto`) marca o degrau inteiro, com um
 * selo na calha (tarefa #25: ícone só, `role="img"` com `aria-label` — sem
 * texto visível, ver nota abaixo).
 *
 * **Escada contínua, sem cartão por degrau (tarefa #25):** o antigo `figure`
 * com borda/fundo/cabeçalho "Degrau 001" dá lugar a uma única escada: cada
 * degrau é uma linha (calha + SVG) sem margem vertical entre blocos, e os
 * trilhos de energia do próprio SVG vão de `y=0` até `y=altura` (não só ao
 * redor da linha 0 como antes) — com blocos emendados (sem `my-*`), os
 * trilhos de um degrau encontram os do seguinte e parecem uma escada única.
 * A calha (coluna estreita à esquerda do SVG) leva o número do degrau em
 * fonte monoespaçada discreta, o selo de problema do degrau (ícone só) e os
 * botões de inserir/remover — visíveis no hover do bloco (`group-hover`) ou
 * quando qualquer célula/botão dele tem foco (`group-focus-within`), mas
 * sempre no fluxo de tabulação (nunca `display:none`/`disabled`). A separação
 * visual entre degraus é uma borda tracejada sutil, mas só na calha — nunca
 * sob o SVG — para não cortar os trilhos contínuos.
 *
 * **Nenhuma mensagem em texto dentro do editor (tarefa #25):** o parágrafo
 * `role="alert"` que ficava abaixo da grade, e o `<title>` do motivo na
 * célula de prévia inválida, saíram — quem decide o que fazer com uma recusa
 * é `EditorLadder` via `aoRecusar` (prop dele, não deste componente). Este
 * componente continua marcando a célula recusada com `aria-invalid` (sem
 * `aria-describedby`, já que não há mais parágrafo para apontar) e a prévia
 * inválida com a mesma cor de perigo — só a exposição em texto visível saiu.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { CircleAlert, Plus, Trash2, TriangleAlert } from 'lucide-react'

import {
  COLUNAS_POR_DEGRAU,
  COLUNA_TERMINAL,
  ehBobina,
  type Celula,
  type Elemento,
  type Ramo,
  type Rung,
  type TipoBobina,
  type TipoContato,
  type Variavel,
} from '../../ladder/modelo'
import type { Problema } from '../../ladder/validacao'
import { Bobina, ContatoNA, ContatoNF } from './Simbolos'

/** Resumo de um ou mais `Problema` para uma célula ou para o degrau inteiro
 * (tarefa #13): severidade mais grave presente (erro tem precedência sobre
 * aviso) e as mensagens de todos os problemas dessa severidade, unidas — um
 * elemento raramente acumula mais de um problema, mas a marcação nunca perde
 * informação quando acontece. */
interface ResumoProblema {
  severidade: 'erro' | 'aviso'
  mensagem: string
}

function resumirProblemas(lista: Problema[]): ResumoProblema | null {
  if (lista.length === 0) return null
  const erros = lista.filter((p) => p.severidade === 'erro')
  const alvo = erros.length > 0 ? erros : lista
  return { severidade: alvo[0].severidade, mensagem: alvo.map((p) => p.mensagem).join('; ') }
}

/** Problemas do elemento em `elementoId` (não do resto do degrau). */
function problemaDaCelula(problemas: Problema[] | undefined, elementoId: string | undefined): ResumoProblema | null {
  if (!problemas || elementoId === undefined) return null
  return resumirProblemas(problemas.filter((p) => p.elementoId === elementoId))
}

/** Problemas do degrau inteiro (`elementoId: null` — ex.: `rung_incompleto`). */
function problemaDoRung(problemas: Problema[] | undefined): ResumoProblema | null {
  if (!problemas) return null
  return resumirProblemas(problemas.filter((p) => p.elementoId === null))
}

/** Prévia de uma jogada de arrasto sobre uma célula, calculada pelo editor
 * chamando o núcleo (`inserirElemento`/`moverElemento`) sem aplicar (D-11,
 * reaproveitada pela #22 durante o arrasto). O tipo `remover` também é usado
 * para destacar o próprio elemento de origem quando o alvo do arrasto é a
 * lixeira. `ramo-criar` (D-14) é a prévia de soltar "Ramo" da paleta: não
 * tem `celula` própria — o núcleo (`criarRamo`) decide a linha, então o
 * ramo inteiro é a prévia, desenhada como um ramo fantasma. */
export type Previa =
  | { celula: Celula; tipo: 'inserir'; elemento: Elemento['tipo'] }
  | { celula: Celula; tipo: 'remover' }
  | { celula: Celula; tipo: 'invalida'; motivo: string }
  | { tipo: 'ramo-criar'; ramo: { linha: number; colunaInicio: number; colunaFim: number } }

/** Prévia de redimensionamento da alça de um ramo (D-14): calculada por
 * `EditorLadder` chamando `redimensionarRamo` sem aplicar, a cada posição
 * (ponteiro) ou tecla (←/→) reportada por este componente. */
export interface PreviaAlca {
  ramoId: string
  colunaFim: number
  valido: boolean
}

export interface GradeDegrauProps {
  rung: Rung
  /** 0-based; usado nos rótulos "Degrau 1", "Degrau 2"... e no cabeçalho "Degrau 001". */
  indice: number
  /** Variáveis do diagrama, para achar o endereço de cada elemento vinculado (D-13). */
  variaveis: Variavel[]
  /** Id do elemento marcado, ou null se nenhum (clique simples marca; #22/#23). */
  marcado: string | null
  /** Id do ramo marcado (clique na linha do ramo; D-14), ou null/ausente. */
  ramoMarcado?: string | null
  /** Clique simples: marca o elemento da célula, ou abre o modal se já estava marcado (D-13). */
  aoClicarCelula: (rungId: string, celula: Celula) => void
  /** Duplo clique: abre o modal de variável do elemento (célula vazia é no-op). */
  aoDuploClicarCelula: (rungId: string, celula: Celula) => void
  /** Encaminha o evento de teclado bruto: `EditorLadder` decide Espaço/Enter/Delete/setas. */
  aoTeclarNaCelula: (evento: KeyboardEvent<SVGGElement>, rungId: string, celula: Celula) => void
  /** pointerdown na célula: só importa quando há elemento (início do arrasto por ponteiro). */
  aoIniciarArrastoPonteiro: (evento: ReactPointerEvent<SVGGElement>, rungId: string, celula: Celula) => void
  /** Prévia a desenhar na célula (ou no ramo fantasma) sob o arrasto, ou null/ausente. */
  previa?: Previa | null
  /** Avisa qual célula está sob o ponteiro ou o foco (null ao sair) — usado
   * pelo editor para acompanhar o alvo do arrasto. */
  aoPassarCelula?: (rungId: string, celula: Celula | null) => void
  /** Última recusa de uma jogada sobre este degrau, ou null/ausente. `celula`
   * fica ausente quando a recusa não vem de uma célula específica (ex.:
   * remover degrau, tarefa #10) — sem marcar nenhuma célula como inválida
   * nesse caso. Só marca `aria-invalid` na célula (tarefa #25): o motivo em
   * texto não aparece mais aqui, `EditorLadder` é quem o repassa a
   * `aoRecusar`. */
  recusa?: { celula?: Celula; motivo: string } | null
  /** pointerdown na alça de um ramo (D-14): início do arrasto geométrico local. */
  aoIniciarArrastoAlca?: (evento: ReactPointerEvent<SVGGElement>, rungId: string, ramoId: string) => void
  /** Reporta, a cada `pointermove` com o botão pressionado sobre a alça, a
   * coluna sob o ponteiro (geometria deste componente — validade é do núcleo). */
  aoArrastarAlca?: (rungId: string, ramoId: string, coluna: number) => void
  /** `pointerup` com a alça em arrasto: coluna final sob o ponteiro. */
  aoSoltarAlca?: (rungId: string, ramoId: string, coluna: number) => void
  /** `pointercancel` com a alça em arrasto. */
  aoCancelarAlca?: () => void
  /** Evento de teclado bruto na alça: `EditorLadder` decide Espaço/setas/Esc. */
  aoTeclarNaAlca?: (evento: KeyboardEvent<SVGGElement>, rungId: string, ramoId: string) => void
  /** Prévia de redimensionamento da alça em curso (D-14), ou null/ausente. */
  previaAlca?: PreviaAlca | null
  /** Problemas deste degrau (`validarDiagrama`, já filtrados por `rungId`
   * pelo `EditorLadder` — este componente não chama `validarDiagrama`,
   * tarefa #13), ou null/ausente. */
  problemas?: Problema[]
  /** Botão "Inserir degrau abaixo" no cabeçalho (tarefa #10), ou
   * ausente/no-op se quem monta o editor não oferecer a ação. */
  aoInserirDegrauAbaixo?: () => void
  /** Botão "Remover degrau" no cabeçalho (tarefa #10); a recusa (ex.: único
   * degrau) é decidida e mostrada por `EditorLadder`, não aqui. */
  aoRemoverDegrau?: () => void
}

const LARGURA_CELULA_MIN = 56
const LARGURA_CELULA_PADRAO = 64
const ALTURA_LINHA = 64
const MARGEM_ESQUERDA = 32
const MARGEM_DIREITA = 32
const MARGEM_TOPO = 24
const RAIO_ALCA = 7

/** Largura disponível padrão, usada até a primeira medição do
 * `ResizeObserver` e sempre que ele não existe no ambiente (jsdom nos
 * testes de componente). Reproduz a largura de célula antiga (64px), para
 * que nenhum teste existente precise mockar nada. */
const LARGURA_DISPONIVEL_PADRAO = MARGEM_ESQUERDA + MARGEM_DIREITA + COLUNAS_POR_DEGRAU * LARGURA_CELULA_PADRAO

/** Mede a largura de conteúdo de `ref` via `ResizeObserver`, atualizando a
 * cada mudança (redimensionar a janela ou o painel lateral, plano D-14).
 * Sem `ResizeObserver` no ambiente, devolve o padrão fixo sem observar nada. */
function useLarguraDisponivel(ref: RefObject<HTMLElement | null>): number {
  const [largura, setLargura] = useState(LARGURA_DISPONIVEL_PADRAO)

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento || typeof ResizeObserver === 'undefined') return

    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[0]
      if (entrada) setLargura(entrada.contentRect.width)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return largura
}

function yDaLinha(linha: number): number {
  return MARGEM_TOPO + ALTURA_LINHA / 2 + linha * ALTURA_LINHA
}

function encontrarElemento(rung: Rung, celula: Celula): Elemento | undefined {
  return rung.elementos.find((e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna)
}

function celulaIgual(a: Celula, b: Celula): boolean {
  return a.linha === b.linha && a.coluna === b.coluna
}

function rotuloTipo(tipo: TipoContato | TipoBobina): string {
  switch (tipo) {
    case 'contato_na':
      return 'contato NA'
    case 'contato_nf':
      return 'contato NF'
    case 'bobina':
      return 'bobina'
    case 'bobina_set':
      return 'bobina SET'
    case 'bobina_reset':
      return 'bobina RESET'
  }
}

/** Rótulo acessível de uma célula — "Degrau N, coluna M" no trilho principal
 * (linha 0), "Degrau N, ramo L, coluna M" num ramo (linha L > 0, D-14),
 * mesma convenção de `validacao.ts#descreverCelula`. Com um problema de
 * validação nessa célula (tarefa #13), o rótulo ganha o sufixo "erro:
 * <mensagem>" ou "aviso: <mensagem>". */
function rotuloCelula(
  indiceDegrau: number,
  linha: number,
  coluna: number,
  elemento: Elemento | undefined,
  problema?: ResumoProblema | null,
): string {
  const base = linha === 0 ? `Degrau ${indiceDegrau + 1}, coluna ${coluna + 1}` : `Degrau ${indiceDegrau + 1}, ramo ${linha}, coluna ${coluna + 1}`
  const conteudo = !elemento ? `${base}, vazia` : `${base}, ${rotuloTipo(elemento.tipo)} ${elemento.variavel ?? 'sem variável'}`
  if (!problema) return conteudo
  return `${conteudo}, ${problema.severidade}: ${problema.mensagem}`
}

/** Endereço da variável vinculada a `nome`, ou `null` (interna ou sem vínculo). */
function enderecoDaVariavel(variaveis: Variavel[], nome: string | null): string | null {
  if (nome === null) return null
  return variaveis.find((v) => v.nome === nome)?.endereco ?? null
}

/** Número do degrau com três dígitos, para o cabeçalho do cartão ("Degrau 001"). */
function numeroDegrau(indice: number): string {
  return String(indice + 1).padStart(3, '0')
}

/** Selo de problema no canto superior direito da célula (tarefa #13, D-10):
 * círculo vermelho para erro, triângulo amarelo para aviso — cor **e** forma
 * distintas, não só cor, para não depender de percepção de cor. `(x, y)` é o
 * canto superior direito do retângulo da célula; o selo fica sempre por
 * cima, sem alterar `classeRetangulo` (recusa/prévia/seleção mantêm a
 * palavra final sobre o preenchimento da célula). `aria-hidden`: o texto
 * acessível do problema já está no `aria-label` da célula
 * (`rotuloCelula`). */
function SeloProblema({ x, y, severidade }: { x: number; y: number; severidade: 'erro' | 'aviso' }) {
  const cx = x - 9
  const cy = y + 9
  const classe = severidade === 'erro' ? 'fill-ide-perigo stroke-ide-painel' : 'fill-ide-aviso stroke-ide-painel'
  return (
    <g aria-hidden="true" pointerEvents="none">
      {severidade === 'erro' ? (
        <circle cx={cx} cy={cy} r={6} strokeWidth={1} className={classe} />
      ) : (
        <polygon points={`${cx},${cy - 6} ${cx - 6},${cy + 5} ${cx + 6},${cy + 5}`} strokeWidth={1} className={classe} />
      )}
      <text x={cx} y={cy + 3} textAnchor="middle" className="select-none fill-ide-painel text-[8px] font-bold">
        !
      </text>
    </g>
  )
}

/** Classe do retângulo da célula conforme marcação/prévia/recusa (D-11/D-13:
 * precedência recusa > prévia inválida > prévia remover > prévia inserir >
 * marcado > normal). Só tokens `ide-*` — nenhuma cor Tailwind fixa.
 *
 * A coluna terminal (onde a bobina fica, D-13) não tem mais um preenchimento
 * próprio (`fill-ide-elevado`) para se destacar das outras — pedido do
 * autor: a célula da bobina deve se misturar com o resto da linha, sem uma
 * caixa cinza chamando atenção sozinha. */
function classeRetangulo(previa: Previa | undefined, recusada: boolean, marcado: boolean): string {
  if (recusada) return 'fill-ide-perigo/10 stroke-ide-perigo'
  if (previa?.tipo === 'invalida') return 'fill-ide-perigo/10 stroke-ide-perigo/60'
  if (previa?.tipo === 'remover') return 'fill-ide-perigo/10 stroke-ide-perigo/60'
  if (previa?.tipo === 'inserir') return 'fill-ide-previa/10 stroke-ide-previa'
  if (marcado) return 'fill-ide-destaque/10 stroke-ide-destaque'
  return 'fill-transparent stroke-ide-borda'
}

/** Menor coluna livre sob o ponteiro, a partir de um `clientX` de tela e do
 * retângulo do `<svg>` (geometria deste componente — D-14). */
function colunaSobPonteiro(clientX: number, svgLeft: number, larguraCelula: number): number {
  const local = clientX - svgLeft - MARGEM_ESQUERDA
  const coluna = Math.floor(local / larguraCelula)
  return Math.max(0, Math.min(COLUNAS_POR_DEGRAU - 1, coluna))
}

export default function GradeDegrau({
  rung,
  indice,
  variaveis,
  marcado,
  ramoMarcado,
  aoClicarCelula,
  aoDuploClicarCelula,
  aoTeclarNaCelula,
  aoIniciarArrastoPonteiro,
  previa,
  aoPassarCelula,
  recusa,
  aoIniciarArrastoAlca,
  aoArrastarAlca,
  aoSoltarAlca,
  aoCancelarAlca,
  aoTeclarNaAlca,
  previaAlca,
  problemas,
  aoInserirDegrauAbaixo,
  aoRemoverDegrau,
}: GradeDegrauProps) {
  const problemaRung = problemaDoRung(problemas)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const larguraDisponivel = useLarguraDisponivel(wrapperRef)
  const larguraCelula = Math.max(LARGURA_CELULA_MIN, (larguraDisponivel - MARGEM_ESQUERDA - MARGEM_DIREITA) / COLUNAS_POR_DEGRAU)

  const alcaArrastoRef = useRef<{ rungId: string; ramoId: string; pointerId: number } | null>(null)

  // Arrasto geométrico da alça (D-14): só traduz clientX em número de coluna
  // usando o retângulo do próprio `<svg>` — a validade de cada coluna é
  // decidida por `EditorLadder` via `redimensionarRamo`, nunca aqui.
  useEffect(() => {
    function coluna(clientX: number): number {
      const rect = svgRef.current?.getBoundingClientRect()
      return colunaSobPonteiro(clientX, rect?.left ?? 0, larguraCelula)
    }
    function mover(evento: PointerEvent) {
      const pendente = alcaArrastoRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      aoArrastarAlca?.(pendente.rungId, pendente.ramoId, coluna(evento.clientX))
    }
    function soltar(evento: PointerEvent) {
      const pendente = alcaArrastoRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      alcaArrastoRef.current = null
      aoSoltarAlca?.(pendente.rungId, pendente.ramoId, coluna(evento.clientX))
    }
    function cancelar(evento: PointerEvent) {
      const pendente = alcaArrastoRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      alcaArrastoRef.current = null
      aoCancelarAlca?.()
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', cancelar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', cancelar)
    }
  }, [larguraCelula, aoArrastarAlca, aoSoltarAlca, aoCancelarAlca])

  function xDaColuna(coluna: number): number {
    return MARGEM_ESQUERDA + coluna * larguraCelula
  }

  const previaRamoCriar = previa?.tipo === 'ramo-criar' ? previa.ramo : undefined
  const linhasEmUso = rung.ramos.map((r) => r.linha)
  const maiorLinha = Math.max(0, ...linhasEmUso, ...(previaRamoCriar ? [previaRamoCriar.linha] : []))

  const largura = MARGEM_ESQUERDA + MARGEM_DIREITA + COLUNAS_POR_DEGRAU * larguraCelula
  const altura = MARGEM_TOPO * 2 + ALTURA_LINHA * (maiorLinha + 1)
  const y0 = yDaLinha(0)
  const xEsquerda = MARGEM_ESQUERDA
  const xDireita = MARGEM_ESQUERDA + COLUNAS_POR_DEGRAU * larguraCelula

  function aoEntrarNaCelula(celula: Celula) {
    aoPassarCelula?.(rung.id, celula)
  }

  function aoSairDaCelula() {
    aoPassarCelula?.(rung.id, null)
  }

  function iniciarAlca(evento: ReactPointerEvent<SVGGElement>, ramoId: string) {
    evento.preventDefault()
    alcaArrastoRef.current = { rungId: rung.id, ramoId, pointerId: evento.pointerId }
    aoIniciarArrastoAlca?.(evento, rung.id, ramoId)
  }

  /** Uma célula (linha 0 ou linha de ramo) — compartilhada pelos dois desenhos. */
  function celulaGrade(linha: number, coluna: number, ehTerminal: boolean, ramoId?: string) {
    const celula: Celula = { linha, coluna }
    const elemento = encontrarElemento(rung, celula)
    const cx = xDaColuna(coluna)
    const centroX = cx + larguraCelula / 2
    const y = yDaLinha(linha)
    // D-14: uma célula fica "ativa" (destaque + aria-selected) se o próprio
    // elemento está marcado OU se ela pertence ao ramo marcado (mesmo vazia
    // — marcar o ramo destaca a linha inteira, não um elemento específico).
    const ativo = (elemento !== undefined && elemento.id === marcado) || (ramoId !== undefined && ramoId === ramoMarcado)

    const previaAqui = previa && 'celula' in previa && celulaIgual(previa.celula, celula) ? previa : undefined
    const recusada = recusa != null && recusa.celula != null && celulaIgual(recusa.celula, celula)
    const ehRemocaoAqui = previaAqui?.tipo === 'remover'
    const cursorInvalido = previaAqui?.tipo === 'invalida'
    const endereco = enderecoDaVariavel(variaveis, elemento?.variavel ?? null)
    const problemaAqui = problemaDaCelula(problemas, elemento?.id)

    return (
      <g
        key={`${linha}:${coluna}`}
        tabIndex={0}
        role="button"
        aria-label={rotuloCelula(indice, linha, coluna, elemento, problemaAqui)}
        aria-selected={ativo}
        aria-invalid={recusada ? 'true' : undefined}
        data-terminal={ehTerminal ? 'true' : undefined}
        data-previa={previaAqui ? previaAqui.tipo : undefined}
        data-problema={problemaAqui ? problemaAqui.severidade : undefined}
        data-celula={`${rung.id}:${linha}:${coluna}`}
        onDragStart={(evento) => evento.preventDefault()}
        onClick={() => aoClicarCelula(rung.id, celula)}
        onDoubleClick={() => aoDuploClicarCelula(rung.id, celula)}
        onKeyDown={(evento) => aoTeclarNaCelula(evento, rung.id, celula)}
        onPointerDown={(evento) => aoIniciarArrastoPonteiro(evento, rung.id, celula)}
        onPointerEnter={() => aoEntrarNaCelula(celula)}
        onPointerLeave={() => aoSairDaCelula()}
        onFocus={() => aoEntrarNaCelula(celula)}
        onBlur={() => aoSairDaCelula()}
        className={`select-none touch-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque ${cursorInvalido ? 'cursor-not-allowed' : elemento ? 'cursor-grab' : 'cursor-pointer'}`}
      >
        <rect
          x={cx}
          y={y - ALTURA_LINHA / 2}
          width={larguraCelula}
          height={ALTURA_LINHA}
          strokeWidth={1}
          strokeDasharray="2,3"
          className={classeRetangulo(previaAqui, recusada, ativo)}
        />
        {elemento?.tipo === 'contato_na' && (
          <ContatoNA cx={centroX} cy={y} variavel={elemento.variavel} endereco={endereco} selecionado={ativo} perigo={ehRemocaoAqui} />
        )}
        {elemento?.tipo === 'contato_nf' && (
          <ContatoNF cx={centroX} cy={y} variavel={elemento.variavel} endereco={endereco} selecionado={ativo} perigo={ehRemocaoAqui} />
        )}
        {elemento && ehBobina(elemento.tipo) && (
          <Bobina cx={centroX} cy={y} variavel={elemento.variavel} endereco={endereco} selecionado={ativo} perigo={ehRemocaoAqui} />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'contato_na' && (
          <ContatoNA cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'contato_nf' && (
          <ContatoNF cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && ehBobina(previaAqui.elemento) && (
          <Bobina cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {problemaAqui && <SeloProblema x={cx + larguraCelula} y={y - ALTURA_LINHA / 2} severidade={problemaAqui.severidade} />}
      </g>
    )
  }

  /** Linha horizontal + conectores verticais de um ramo real ou fantasma
   * (D-14). `fantasma`/`marcado` controlam só a cor (tokens `ide-*`). */
  function tracoRamo(ramo: { linha: number; colunaInicio: number; colunaFim: number }, opts: { fantasma?: boolean; marcado?: boolean; invalido?: boolean }) {
    const y = yDaLinha(ramo.linha)
    const xIni = xDaColuna(ramo.colunaInicio)
    const xFim = xDaColuna(ramo.colunaFim) + larguraCelula
    const classe = opts.invalido
      ? 'stroke-ide-perigo/60'
      : opts.fantasma
        ? 'stroke-ide-previa opacity-60'
        : opts.marcado
          ? 'stroke-ide-destaque'
          : 'stroke-ide-fio'
    return (
      <g aria-hidden="true" data-ramo-fantasma={opts.fantasma ? `${ramo.linha}:${ramo.colunaInicio}:${ramo.colunaFim}` : undefined}>
        <line x1={xIni} y1={y0} x2={xIni} y2={y} strokeWidth={2} className={classe} />
        <line x1={xFim} y1={y0} x2={xFim} y2={y} strokeWidth={2} className={classe} />
        <line x1={xIni} y1={y} x2={xFim} y2={y} strokeWidth={2} className={classe} />
      </g>
    )
  }

  function alcaDoRamo(ramo: Ramo) {
    const y = yDaLinha(ramo.linha)
    const x = xDaColuna(ramo.colunaFim) + larguraCelula
    const marcadoAqui = ramoMarcado === ramo.id
    const previaAqui = previaAlca && previaAlca.ramoId === ramo.id ? previaAlca : undefined
    const classeAlca = previaAqui
      ? previaAqui.valido
        ? 'fill-ide-previa stroke-ide-previa'
        : 'fill-ide-perigo stroke-ide-perigo'
      : marcadoAqui
        ? 'fill-ide-destaque stroke-ide-destaque'
        : 'fill-ide-elevado stroke-ide-fio'

    return (
      <g
        key={`alca-${ramo.id}`}
        role="slider"
        tabIndex={0}
        aria-label={`Estender ramo ${ramo.linha}`}
        aria-valuenow={ramo.colunaFim + 1}
        aria-valuemin={ramo.colunaInicio + 1}
        aria-valuemax={COLUNA_TERMINAL}
        data-alca-ramo={ramo.id}
        onDragStart={(evento) => evento.preventDefault()}
        onPointerDown={(evento) => iniciarAlca(evento, ramo.id)}
        onKeyDown={(evento) => aoTeclarNaAlca?.(evento, rung.id, ramo.id)}
        className="cursor-ew-resize touch-none select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque"
      >
        <circle cx={x} cy={y} r={RAIO_ALCA} strokeWidth={2} className={classeAlca} />
      </g>
    )
  }

  return (
    <div className="group flex">
      {/* Calha: número do degrau, selo de problema (ícone só) e ações de
       * inserir/remover — tarefa #25. A borda tracejada (só aqui, nunca sob o
       * SVG) separa visualmente este degrau do anterior sem cortar os
       * trilhos, que são contínuos no SVG ao lado. */}
      <div
        className={`flex w-16 flex-none flex-col items-center gap-1 pt-6 ${
          indice > 0 ? 'border-t border-dashed border-ide-borda/60' : ''
        }`}
      >
        <span className="select-none whitespace-nowrap font-mono text-[10px] text-ide-suave">
          Degrau {numeroDegrau(indice)}
        </span>

        {problemaRung && (
          <span
            role="img"
            aria-label={`${problemaRung.severidade}: ${problemaRung.mensagem}`}
            className={problemaRung.severidade === 'erro' ? 'text-ide-perigo' : 'text-ide-aviso'}
          >
            {problemaRung.severidade === 'erro' ? <CircleAlert aria-hidden="true" size={13} /> : <TriangleAlert aria-hidden="true" size={13} />}
          </span>
        )}

        {/* opacity-0 por padrão: visível no hover do bloco (group-hover) ou
         * quando qualquer célula/botão dele tem foco (group-focus-within) —
         * nunca removida do fluxo de tabulação, então continua acessível por
         * teclado mesmo antes de aparecer visualmente. */}
        <div className="flex flex-col gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
          {aoInserirDegrauAbaixo && (
            <button
              type="button"
              onClick={aoInserirDegrauAbaixo}
              aria-label={`Inserir degrau abaixo do degrau ${indice + 1}`}
              title="Inserir degrau abaixo"
              className="rounded p-0.5 text-ide-suave outline-none hover:bg-ide-elevado hover:text-ide-texto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque"
            >
              <Plus aria-hidden="true" size={12} />
            </button>
          )}
          {aoRemoverDegrau && (
            <button
              type="button"
              onClick={aoRemoverDegrau}
              aria-label={`Remover degrau ${indice + 1}`}
              title="Remover degrau"
              className="rounded p-0.5 text-ide-suave outline-none hover:bg-ide-perigo/10 hover:text-ide-perigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque"
            >
              <Trash2 aria-hidden="true" size={12} />
            </button>
          )}
        </div>
      </div>

      <div ref={wrapperRef} className="min-w-0 flex-1 overflow-x-auto">
        <svg ref={svgRef} role="group" aria-label={`Degrau ${indice + 1}, grade`} width={largura} height={altura} className="block overflow-visible">
          {/* trilhos de energia esquerdo e direito, mais espessos que o fio —
           * do topo ao fim do bloco (não só ao redor da linha 0), para que,
           * sem espaço vertical entre os blocos de cada degrau, os trilhos se
           * emendem visualmente numa escada única (tarefa #25). */}
          <line x1={xEsquerda} y1={0} x2={xEsquerda} y2={altura} strokeWidth={5} className="stroke-ide-trilho" />
          <line x1={xDireita} y1={0} x2={xDireita} y2={altura} strokeWidth={5} className="stroke-ide-trilho" />
          {/* fio horizontal atravessando as células vazias */}
          <line x1={xEsquerda} y1={y0} x2={xDireita} y2={y0} strokeWidth={2} className="stroke-ide-fio" />

          {rung.ramos.map((ramo) => {
            const previaAqui = previaAlca && previaAlca.ramoId === ramo.id ? previaAlca : undefined
            const ramoDesenhado = previaAqui ? { ...ramo, colunaFim: previaAqui.colunaFim } : ramo
            return (
              <g key={`traco-${ramo.id}`}>
                {tracoRamo(ramoDesenhado, previaAqui ? { invalido: !previaAqui.valido } : { marcado: ramoMarcado === ramo.id })}
              </g>
            )
          })}
          {previaRamoCriar && tracoRamo(previaRamoCriar, { fantasma: true })}

          {Array.from({ length: COLUNAS_POR_DEGRAU }, (_, coluna) => celulaGrade(0, coluna, coluna === COLUNA_TERMINAL))}

          {rung.ramos.map((ramo) =>
            Array.from({ length: ramo.colunaFim - ramo.colunaInicio + 1 }, (_, i) => celulaGrade(ramo.linha, ramo.colunaInicio + i, false, ramo.id)),
          )}

          {rung.ramos.map((ramo) => alcaDoRamo(ramo))}
        </svg>
      </div>
    </div>
  )
}
