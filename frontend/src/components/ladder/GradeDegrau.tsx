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
 * **SET/RESET e CTU (tarefa #18, D-19):** bobina SET/RESET usam
 * `Simbolos.tsx#BobinaSet/BobinaReset`, na mesma célula terminal de uma
 * bobina comum — nenhuma mudança de geometria aqui. O CTU ocupa a célula
 * terminal da linha 0 (como uma bobina) mas desenha, via `SimboloCtu.tsx`
 * (D-7), uma caixa que desce até a sua `linhaReset` — a única linha extra do
 * degrau sem `Ramo` (o núcleo garante isso, `ctu.ts#linhaResetLivre`). Essa
 * linha ganha um traço próprio do trilho esquerdo até a caixa (sem os
 * conectores de `tracoRamo`: não é um ramo, é o caminho de reinício) e
 * células de contato focáveis/soltáveis iguais às de um ramo, exceto pelo
 * rótulo ("reset do contador" em vez de "ramo L") e pela ausência de célula
 * na coluna terminal (ocupada pela própria caixa, nunca solta nada).
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
 *
 * **Energização (spec 004, tarefa #10, RF-6/RF-14/CA-4/CA-10):** prop
 * opcional `energizacao` (`simulacao.ts#EnergizacaoDegrau`). **Ausente/null =
 * desenho idêntico ao de hoje** — nenhuma leitura de `energizacao` acontece,
 * nenhum atributo novo aparece. Com ela presente:
 * - cada trecho de fio (o antigo traço único por linha virou um traço por
 *   coluna, `estiloTraco`/`celulaEnergizada`) e o trilho esquerdo mostram
 *   `nos`/`celulas` do contrato;
 * - cada elemento (contato, bobina, e a entrada CU do CTU — nunca a caixa
 *   inteira, ver `SimboloCtu.tsx`) mostra `elementos[id]`;
 * - os conectores verticais de um ramo mostram o nó de entrada/saída daquele
 *   ramo (`nos["${ramo.linha}:${coluna}"]`).
 * A distinção é **redundante** (RF-14): cor (`ide-energizado`, token novo em
 * `index.css`) **e** espessura do traço — nunca só a cor. O selo de problema
 * (`SeloProblema`) continua no canto da célula, atributo (`data-problema`)
 * inteiramente separado do traço — os dois nunca disputam o mesmo lugar
 * (CA-10). O `aria-label` da célula ganha o sufixo ", energizado"/",
 * desenergizado" só quando `energizacao` está presente (`rotuloCelula`) —
 * sem simulação, o rótulo não muda uma letra.
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
  ehCtu,
  ehRamoDeSaida,
  variavelDoElemento,
  type Celula,
  type Elemento,
  type Ramo,
  type Rung,
  type TipoBobina,
  type TipoContato,
  type Variavel,
} from '../../ladder/modelo'
import { PV_PADRAO } from '../../ladder/ctu'
import type { Problema } from '../../ladder/validacao'
import type { EnergizacaoDegrau } from '../../ladder/simulacao'
import { Bobina, BobinaReset, BobinaSet, ContatoNA, ContatoNF } from './Simbolos'
import SimboloCtu from './SimboloCtu'

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
 * ramo inteiro é a prévia, desenhada como um ramo fantasma. `linhaReset`
 * (tarefa #18) só é preenchido quando `elemento === 'ctu'`: o núcleo
 * (`ctu.ts#linhaResetLivre`) já escolheu essa linha ao calcular a prévia sem
 * aplicar (`EditorLadder`), e é o que permite desenhar a caixa do CTU
 * fantasma com a altura certa antes de soltar. */
export type Previa =
  | { celula: Celula; tipo: 'inserir'; elemento: Elemento['tipo']; linhaReset?: number }
  | { celula: Celula; tipo: 'remover' }
  | { celula: Celula; tipo: 'invalida'; motivo: string }
  | { tipo: 'ramo-criar'; ramo: { linha: number; colunaInicio: number; colunaFim: number } }

/** Prévia de redimensionamento da alça de um ramo (D-14): calculada por
 * `EditorLadder` chamando `redimensionarRamo` sem aplicar, a cada posição
 * (ponteiro) ou tecla (←/→) reportada por este componente. */
export type PontaAlcaRamo = 'inicio' | 'fim'

export interface PreviaAlca {
  ramoId: string
  colunaInicio: number
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
  aoArrastarAlca?: (rungId: string, ramoId: string, coluna: number, ponta: PontaAlcaRamo) => void
  /** `pointerup` com a alça em arrasto: coluna final sob o ponteiro. */
  aoSoltarAlca?: (rungId: string, ramoId: string, coluna: number, ponta: PontaAlcaRamo) => void
  /** `pointercancel` com a alça em arrasto. */
  aoCancelarAlca?: () => void
  /** Evento de teclado bruto na alça: `EditorLadder` decide Espaço/setas/Esc. */
  aoTeclarNaAlca?: (evento: KeyboardEvent<SVGGElement>, rungId: string, ramoId: string, ponta: PontaAlcaRamo) => void
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
  /** Energização deste degrau (spec 004, tarefa #10), ou `null`/ausente fora
   * de simulação — nesse caso o desenho é exatamente o de hoje. Ver nota no
   * cabeçalho do arquivo. */
  energizacao?: EnergizacaoDegrau | null
  /** Simulação ativa (spec 004, RF-15, D-20): cursor de recusa na célula e na alça. */
  congelado?: boolean
}

const LARGURA_CELULA_MIN = 56
const LARGURA_CELULA_PADRAO = 64
const ALTURA_LINHA = 64
const MARGEM_ESQUERDA = 32
const MARGEM_DIREITA = 32
const MARGEM_TOPO = 24
const RAIO_ALCA = 7
const LARGURA_TRILHO = 5
/** Espessura do trilho esquerdo energizado (spec 004, tarefa #10) —
 * incremento sobre `LARGURA_TRILHO`, redundante com a cor (RF-14). */
const LARGURA_TRILHO_ENERGIZADO = 6

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

// ---------------------------------------------------------------------------
// Energização (spec 004, tarefa #10): leitura do contrato publicado por
// `simulacao.ts#EnergizacaoDegrau` — só leitura de chave, nenhuma lógica de
// propagação (essa é do núcleo, RF-7). `chaveNo`/`chaveCelula` reproduzem o
// formato documentado no próprio tipo (`${linha}:${no}` / `${linha}:${coluna}`).
// ---------------------------------------------------------------------------

function chaveNo(linha: number, no: number): string {
  return `${linha}:${no}`
}

function chaveCelulaEnergizacao(linha: number, coluna: number): string {
  return `${linha}:${coluna}`
}

/** O nó `(linha, no)` está energizado, segundo o contrato — `false` sem
 * simulação (`energizacao` ausente) ou sem entrada para essa chave. */
function noEnergizado(energizacao: EnergizacaoDegrau | null | undefined, linha: number, no: number): boolean {
  return energizacao?.nos[chaveNo(linha, no)] ?? false
}

/** O trecho de fio da célula `(linha, coluna)` está energizado — usado só
 * para células **sem** elemento (fio) ou como pano de fundo sob um elemento;
 * a energização do próprio elemento é `elementos[id]` (ver `celulaGrade`). */
function celulaEnergizada(energizacao: EnergizacaoDegrau | null | undefined, linha: number, coluna: number): boolean {
  return energizacao?.celulas[chaveCelulaEnergizacao(linha, coluna)] ?? false
}

/** Cor e espessura de um traço (fio de célula, trilho ou conector de ramo),
 * com a mesma precedência de `Simbolos.tsx`: `invalido` (perigo) >
 * `fantasma` > `energizado` > `marcado` (seleção) > normal. Redundância
 * cor+espessura (RF-14, D-12) só se aplica ao ramo `energizado`; os demais
 * estados mantêm a espessura normal de hoje. */
function estiloTraco(
  energizado: boolean,
  opts: { fantasma?: boolean; marcado?: boolean; invalido?: boolean } = {},
): { classe: string; largura: number } {
  if (opts.invalido) return { classe: 'stroke-ide-perigo/60', largura: 2 }
  if (opts.fantasma) return { classe: 'stroke-ide-previa opacity-60', largura: 2 }
  if (energizado) return { classe: 'stroke-ide-energizado', largura: 3 }
  if (opts.marcado) return { classe: 'stroke-ide-destaque', largura: 2 }
  return { classe: 'stroke-ide-fio', largura: 2 }
}

function rotuloTipo(tipo: TipoContato | TipoBobina | 'ctu'): string {
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
    case 'ctu':
      return 'contador CTU'
  }
}

/** Rótulo acessível de uma célula — "Degrau N, coluna M" no trilho principal
 * (linha 0), "Degrau N, ramo L, coluna M" num ramo (linha L > 0, D-14) ou
 * "Degrau N, reset do contador, coluna M" na linha de reset de um CTU
 * (`ehLinhaReset`, tarefa #18 — só existe uma por degrau, então dispensa
 * numerá-la como o ramo), mesma convenção de `validacao.ts#descreverCelula`.
 * Com um problema de validação nessa célula (tarefa #13), o rótulo ganha o
 * sufixo "erro: <mensagem>" ou "aviso: <mensagem>". */
function rotuloCelula(
  indiceDegrau: number,
  linha: number,
  coluna: number,
  elemento: Elemento | undefined,
  problema?: ResumoProblema | null,
  ehLinhaReset?: boolean,
  /** `undefined` fora de simulação — nenhum sufixo. `true`/`false` em
   * simulação — sufixo ", energizado"/", desenergizado" (spec 004, tarefa
   * #10). */
  energizado?: boolean,
): string {
  const base =
    linha === 0
      ? `Degrau ${indiceDegrau + 1}, coluna ${coluna + 1}`
      : ehLinhaReset
        ? `Degrau ${indiceDegrau + 1}, reset do contador, coluna ${coluna + 1}`
        : `Degrau ${indiceDegrau + 1}, ramo ${linha}, coluna ${coluna + 1}`
  const conteudo = !elemento ? `${base}, vazia` : `${base}, ${rotuloTipo(elemento.tipo)} ${variavelDoElemento(elemento) ?? 'sem variável'}`
  const comProblema = !problema ? conteudo : `${conteudo}, ${problema.severidade}: ${problema.mensagem}`
  if (energizado === undefined) return comProblema
  return `${comProblema}, ${energizado ? 'energizado' : 'desenergizado'}`
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
  energizacao,
  congelado,
}: GradeDegrauProps) {
  const problemaRung = problemaDoRung(problemas)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const larguraDisponivel = useLarguraDisponivel(wrapperRef)
  const larguraCelula = Math.max(LARGURA_CELULA_MIN, (larguraDisponivel - MARGEM_ESQUERDA - MARGEM_DIREITA) / COLUNAS_POR_DEGRAU)

  const alcaArrastoRef = useRef<{ rungId: string; ramoId: string; pointerId: number; ponta: PontaAlcaRamo } | null>(null)

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
      aoArrastarAlca?.(pendente.rungId, pendente.ramoId, coluna(evento.clientX), pendente.ponta)
    }
    function soltar(evento: PointerEvent) {
      const pendente = alcaArrastoRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      alcaArrastoRef.current = null
      aoSoltarAlca?.(pendente.rungId, pendente.ramoId, coluna(evento.clientX), pendente.ponta)
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
  // Terminal do degrau (bobina/SET/RESET/CTU), se houver — usado pelo fio de
  // fundo da coluna terminal (spec 004, correção pós-verificação em Chromium
  // real, ver nota em `estadoFioColuna` abaixo).
  const terminalDoRung = rung.elementos.find((e) => e.celula.linha === 0 && e.celula.coluna === COLUNA_TERMINAL)
  // CTU (tarefa #18): a linha de reset (real, do próprio rung, ou prevista
  // por uma prévia de inserir/mover um CTU ainda não aplicada) também conta
  // para a maior linha em uso — a altura do degrau precisa caber a caixa
  // inteira, não só o trilho principal.
  const ctuDoRung = rung.elementos.find(ehCtu)
  const linhaResetPrevia = previa?.tipo === 'inserir' && previa.elemento === 'ctu' ? previa.linhaReset : undefined
  const linhasEmUso = rung.ramos.map((r) => r.linha)
  const maiorLinha = Math.max(
    0,
    ...linhasEmUso,
    ...(previaRamoCriar ? [previaRamoCriar.linha] : []),
    ctuDoRung?.linhaReset ?? 0,
    linhaResetPrevia ?? 0,
  )

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

  function iniciarAlca(evento: ReactPointerEvent<SVGGElement>, ramoId: string, ponta: PontaAlcaRamo) {
    evento.preventDefault()
    alcaArrastoRef.current = { rungId: rung.id, ramoId, pointerId: evento.pointerId, ponta }
    aoIniciarArrastoAlca?.(evento, rung.id, ramoId)
  }

  /** Uma célula (linha 0, linha de ramo ou linha de reset de um CTU) —
   * compartilhada pelos três desenhos. `ehLinhaReset` (tarefa #18) só afeta o
   * rótulo acessível ("reset do contador" em vez de "ramo L") — a célula em
   * si funciona igual às de ramo (focável, soltável, marca elemento). */
  function celulaGrade(
    linha: number,
    coluna: number,
    ehTerminal: boolean,
    ramoId?: string,
    ehLinhaReset?: boolean,
  ) {
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
    const endereco = enderecoDaVariavel(variaveis, elemento ? variavelDoElemento(elemento) : null)
    const problemaAqui = problemaDaCelula(problemas, elemento?.id)
    // Energização (spec 004, tarefa #10): `undefined` sem simulação — nada
    // muda. Com elemento, é `elementos[id]` (estado próprio do elemento,
    // inclusive o CU do CTU); sem elemento, é o trecho de fio da célula.
    const estadoEnergizado: boolean | undefined = !energizacao
      ? undefined
      : elemento
        ? (energizacao.elementos[elemento.id] ?? false)
        : celulaEnergizada(energizacao, linha, coluna)

    return (
      <g
        key={`${linha}:${coluna}`}
        tabIndex={0}
        role="button"
        aria-label={rotuloCelula(indice, linha, coluna, elemento, problemaAqui, ehLinhaReset, estadoEnergizado)}
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
        className={`select-none touch-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque ${congelado ? 'cursor-not-allowed' : cursorInvalido ? 'cursor-not-allowed' : elemento ? 'cursor-grab' : 'cursor-pointer'}`}
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
          <ContatoNA
            cx={centroX}
            cy={y}
            variavel={elemento.variavel}
            endereco={endereco}
            selecionado={ativo}
            perigo={ehRemocaoAqui}
            energizado={estadoEnergizado}
          />
        )}
        {elemento?.tipo === 'contato_nf' && (
          <ContatoNF
            cx={centroX}
            cy={y}
            variavel={elemento.variavel}
            endereco={endereco}
            selecionado={ativo}
            perigo={ehRemocaoAqui}
            energizado={estadoEnergizado}
          />
        )}
        {elemento?.tipo === 'bobina' && (
          <Bobina
            cx={centroX}
            cy={y}
            variavel={elemento.variavel}
            endereco={endereco}
            selecionado={ativo}
            perigo={ehRemocaoAqui}
            energizado={estadoEnergizado}
          />
        )}
        {elemento?.tipo === 'bobina_set' && (
          <BobinaSet
            cx={centroX}
            cy={y}
            variavel={elemento.variavel}
            endereco={endereco}
            selecionado={ativo}
            perigo={ehRemocaoAqui}
            energizado={estadoEnergizado}
          />
        )}
        {elemento?.tipo === 'bobina_reset' && (
          <BobinaReset
            cx={centroX}
            cy={y}
            variavel={elemento.variavel}
            endereco={endereco}
            selecionado={ativo}
            perigo={ehRemocaoAqui}
            energizado={estadoEnergizado}
          />
        )}
        {elemento?.tipo === 'ctu' && (
          <SimboloCtu
            cx={centroX}
            yTopo={yDaLinha(0) - ALTURA_LINHA / 2}
            yBase={yDaLinha(elemento.linhaReset) + ALTURA_LINHA / 2}
            largura={larguraCelula}
            yEntradaCu={yDaLinha(0)}
            yEntradaR={yDaLinha(elemento.linhaReset)}
            instancia={elemento.instancia}
            pv={elemento.pv}
            saida={elemento.saida}
            endereco={endereco}
            selecionado={ativo}
            perigo={ehRemocaoAqui}
            cuEnergizado={estadoEnergizado}
          />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'contato_na' && (
          <ContatoNA cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'contato_nf' && (
          <ContatoNF cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'bobina' && (
          <Bobina cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'bobina_set' && (
          <BobinaSet cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'bobina_reset' && (
          <BobinaReset cx={centroX} cy={y} variavel={null} selecionado={false} fantasma />
        )}
        {!elemento && previaAqui?.tipo === 'inserir' && previaAqui.elemento === 'ctu' && (
          <SimboloCtu
            cx={centroX}
            yTopo={yDaLinha(0) - ALTURA_LINHA / 2}
            yBase={yDaLinha(previaAqui.linhaReset ?? 1) + ALTURA_LINHA / 2}
            largura={larguraCelula}
            yEntradaCu={yDaLinha(0)}
            yEntradaR={yDaLinha(previaAqui.linhaReset ?? 1)}
            instancia="?"
            pv={PV_PADRAO}
            saida={null}
            selecionado={false}
            fantasma
          />
        )}
        {problemaAqui && <SeloProblema x={cx + larguraCelula} y={y - ALTURA_LINHA / 2} severidade={problemaAqui.severidade} />}
      </g>
    )
  }

  /** Conectores verticais + traço horizontal de um ramo real ou fantasma
   * (D-14). `fantasma`/`marcado`/`invalido` controlam a cor (tokens `ide-*`)
   * quando não há energização a mostrar. **Energização (spec 004, tarefa
   * #10):** com `energizacao` presente e o ramo **não** fantasma, cada
   * conector reflete o nó da sua própria ponta
   * (`nos["${ramo.linha}:${coluna}"]`) e o traço horizontal vira um
   * segmento por coluna — cada um lido de `celulas`, exatamente como a linha
   * 0 (`fioLinha`). Um ramo fantasma (prévia) nunca lê `energizacao`: não
   * existe no diagrama real, não tem chave no contrato. */
  function tracoRamo(ramo: { linha: number; colunaInicio: number; colunaFim: number }, opts: { fantasma?: boolean; marcado?: boolean; invalido?: boolean }) {
    const y = yDaLinha(ramo.linha)
    const xIni = xDaColuna(ramo.colunaInicio)
    const xFim = xDaColuna(ramo.colunaFim) + larguraCelula
    const usaEnergizacao = !opts.fantasma && energizacao != null
    const ramoSaida = ramo.colunaInicio === COLUNA_TERMINAL && ramo.colunaFim === COLUNA_TERMINAL
    const energiaRamoSaida =
      ramoSaida && terminalDoRung !== undefined ? (energizacao?.elementos[terminalDoRung.id] ?? false) : undefined
    const conectorEsq = estiloTraco(
      usaEnergizacao ? (energiaRamoSaida ?? noEnergizado(energizacao, ramo.linha, ramo.colunaInicio)) : false,
      opts,
    )
    const conectorDir = estiloTraco(
      usaEnergizacao ? (energiaRamoSaida ?? noEnergizado(energizacao, ramo.linha, ramo.colunaFim + 1)) : false,
      opts,
    )
    return (
      <g aria-hidden="true" data-ramo-fantasma={opts.fantasma ? `${ramo.linha}:${ramo.colunaInicio}:${ramo.colunaFim}` : undefined}>
        <line x1={xIni} y1={y0} x2={xIni} y2={y} strokeWidth={conectorEsq.largura} className={conectorEsq.classe} />
        <line x1={xFim} y1={y0} x2={xFim} y2={y} strokeWidth={conectorDir.largura} className={conectorDir.classe} />
        {Array.from({ length: ramo.colunaFim - ramo.colunaInicio + 1 }, (_, i) => {
          const coluna = ramo.colunaInicio + i
          const seg = estiloTraco(
            usaEnergizacao ? (energiaRamoSaida ?? celulaEnergizada(energizacao, ramo.linha, coluna)) : false,
            opts,
          )
          return (
            <line
              key={`seg-${coluna}`}
              x1={xDaColuna(coluna)}
              y1={y}
              x2={xDaColuna(coluna) + larguraCelula}
              y2={y}
              strokeWidth={seg.largura}
              className={seg.classe}
            />
          )
        })}
      </g>
    )
  }

  function alcaDoRamo(ramo: Ramo, ponta: PontaAlcaRamo) {
    const y = yDaLinha(ramo.linha)
    const previaAqui = previaAlca && previaAlca.ramoId === ramo.id ? previaAlca : undefined
    const colunaInicio = previaAqui?.colunaInicio ?? ramo.colunaInicio
    const colunaFim = previaAqui?.colunaFim ?? ramo.colunaFim
    const x = ponta === 'inicio' ? xDaColuna(colunaInicio) : xDaColuna(colunaFim) + larguraCelula
    const marcadoAqui = ramoMarcado === ramo.id
    const classeAlca = previaAqui
      ? previaAqui.valido
        ? 'fill-ide-previa stroke-ide-previa'
        : 'fill-ide-perigo stroke-ide-perigo'
      : marcadoAqui
        ? 'fill-ide-destaque stroke-ide-destaque'
        : 'fill-ide-elevado stroke-ide-fio'
    const ariaLabel =
      ponta === 'inicio'
        ? `Encolher ou estender início do ramo ${ramo.linha}`
        : `Estender ou encolher fim do ramo ${ramo.linha}`
    const valorAgora = ponta === 'inicio' ? colunaInicio + 1 : colunaFim + 1

    return (
      <g
        key={`alca-${ramo.id}-${ponta}`}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuenow={valorAgora}
        aria-valuemin={colunaInicio + 1}
        aria-valuemax={COLUNA_TERMINAL}
        data-alca-ramo={ramo.id}
        data-alca-ponta={ponta}
        onDragStart={(evento) => evento.preventDefault()}
        onPointerDown={(evento) => iniciarAlca(evento, ramo.id, ponta)}
        onKeyDown={(evento) => aoTeclarNaAlca?.(evento, rung.id, ramo.id, ponta)}
        className={`touch-none select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque ${congelado ? 'cursor-not-allowed' : 'cursor-ew-resize'}`}
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
           * emendem visualmente numa escada única (tarefa #25).
           *
           * Energização (spec 004, tarefa #10): só o trilho **esquerdo**
           * reflete o estado da simulação — é o único com semântica elétrica
           * de "sempre vivo" (`nos["0:0"]` é sempre `true` no contrato). O
           * direito é o retorno/fronteira de desenho, sem nó correspondente;
           * fica como sempre foi. */}
          <line
            x1={xEsquerda}
            y1={0}
            x2={xEsquerda}
            y2={altura}
            strokeWidth={energizacao != null ? LARGURA_TRILHO_ENERGIZADO : LARGURA_TRILHO}
            className={energizacao != null ? 'stroke-ide-energizado' : 'stroke-ide-trilho'}
          />
          <line x1={xDireita} y1={0} x2={xDireita} y2={altura} strokeWidth={LARGURA_TRILHO} className="stroke-ide-trilho" />
          {/* fio horizontal atravessando as células vazias — um segmento por
           * coluna (spec 004, tarefa #10), para que cada um possa mostrar o
           * estado de `energizacao.celulas` independente dos vizinhos; sem
           * simulação todos caem no mesmo `stroke-ide-fio`/2px de sempre, sem
           * gap entre eles (visualmente idêntico à linha única de antes).
           *
           * **Correção (verificação em Chromium real, spec 004):** na coluna
           * terminal, `celulas` não serve — o contrato define
           * `celulas[linha:coluna] = entra energizado E conduz`, e uma bobina
           * (ou o CU do CTU) é carga, não conduz para a direita: a chave
           * daria sempre `false`, mesmo com a bobina energizada, e o fio de
           * fundo mostraria "desenergizado" bem atrás de um símbolo laranja
           * — dois estados contraditórios na mesma célula. Ali o fio segue
           * `energizacao.elementos[terminalDoRung.id]` (o próprio estado do
           * terminal — "a energia chegou até aqui"), igual ao que o símbolo
           * já mostra. O núcleo não muda; só a leitura do desenho aqui. */}
          {Array.from({ length: COLUNAS_POR_DEGRAU }, (_, coluna) => {
            const estado =
              coluna === COLUNA_TERMINAL && terminalDoRung !== undefined
                ? (energizacao?.elementos[terminalDoRung.id] ?? false)
                : celulaEnergizada(energizacao, 0, coluna)
            const seg = estiloTraco(estado)
            return (
              <line
                key={`fio-0-${coluna}`}
                x1={xDaColuna(coluna)}
                y1={y0}
                x2={xDaColuna(coluna) + larguraCelula}
                y2={y0}
                strokeWidth={seg.largura}
                className={seg.classe}
                aria-hidden="true"
              />
            )
          })}

          {/* Linha de reset do CTU (tarefa #18, D-19): um traço reto do
           * trilho esquerdo até a borda da caixa do contador — sem os
           * conectores verticais de `tracoRamo`, de propósito: essa linha não
           * é um ramo em paralelo com a linha 0 (não faz sentido elétrico
           * "juntar-se" a ela), é um caminho independente que só alimenta a
           * entrada R do bloco de função. Também vira um segmento por coluna
           * (mesma razão da linha 0), lido de `energizacao.celulas` na linha
           * de reset. */}
          {ctuDoRung &&
            Array.from({ length: COLUNA_TERMINAL }, (_, coluna) => {
              const seg = estiloTraco(celulaEnergizada(energizacao, ctuDoRung.linhaReset, coluna))
              return (
                <line
                  key={`fio-reset-${coluna}`}
                  x1={xDaColuna(coluna)}
                  y1={yDaLinha(ctuDoRung.linhaReset)}
                  x2={xDaColuna(coluna) + larguraCelula}
                  y2={yDaLinha(ctuDoRung.linhaReset)}
                  strokeWidth={seg.largura}
                  aria-hidden="true"
                  className={seg.classe}
                />
              )
            })}

          {rung.ramos.map((ramo) => {
            const previaAqui = previaAlca && previaAlca.ramoId === ramo.id ? previaAlca : undefined
            const ramoDesenhado = previaAqui
              ? { ...ramo, colunaInicio: previaAqui.colunaInicio, colunaFim: previaAqui.colunaFim }
              : ramo
            return (
              <g key={`traco-${ramo.id}`}>
                {tracoRamo(ramoDesenhado, previaAqui ? { invalido: !previaAqui.valido } : { marcado: ramoMarcado === ramo.id })}
              </g>
            )
          })}
          {previaRamoCriar && tracoRamo(previaRamoCriar, { fantasma: true })}

          {Array.from({ length: COLUNAS_POR_DEGRAU }, (_, coluna) => celulaGrade(0, coluna, coluna === COLUNA_TERMINAL))}

          {rung.ramos.map((ramo) =>
            ehRamoDeSaida(ramo)
              ? celulaGrade(ramo.linha, COLUNA_TERMINAL, true, ramo.id)
              : Array.from({ length: ramo.colunaFim - ramo.colunaInicio + 1 }, (_, i) =>
                  celulaGrade(ramo.linha, ramo.colunaInicio + i, false, ramo.id),
                ),
          )}

          {/* Células da linha de reset (tarefa #18): colunas de contato,
           * focáveis/soltáveis como as de um ramo — a coluna terminal fica de
           * fora (ocupada pelo corpo do CTU, desenhado na célula (0,
           * COLUNA_TERMINAL) acima, não aqui: sem célula própria, não é
           * soltável). */}
          {ctuDoRung &&
            Array.from({ length: COLUNA_TERMINAL }, (_, coluna) => celulaGrade(ctuDoRung.linhaReset, coluna, false, undefined, true))}

          {rung.ramos
            .filter((ramo) => !ehRamoDeSaida(ramo))
            .flatMap((ramo) => [alcaDoRamo(ramo, 'inicio'), alcaDoRamo(ramo, 'fim')])}
        </svg>
      </div>
    </div>
  )
}
