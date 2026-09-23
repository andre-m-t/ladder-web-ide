/**
 * Editor Ladder (spec 002; fatia 1 nas tarefas #7/#21; arrastar-e-soltar na
 * #22; controlado e redesenhado como IDE na #23, plano
 * `agora-precisamos-trabalhar-em-cozy-dragon.md`, D-13).
 *
 * **Editor controlado, sem tabela (D-13):** este componente não guarda mais
 * o diagrama em estado próprio — `diagrama` vem por prop e toda mudança sai
 * por `aoMudar`, para a IDE (frente I) decidir o que fazer (persistência,
 * `PainelVariaveis` no painel lateral). A tabela de variáveis não mora mais
 * aqui: declarar/editar/remover variável é responsabilidade de
 * `PainelVariaveis`, fora deste componente.
 *
 * **Segundo clique (D-13):** clique num item não marcado marca; clique no
 * item **já marcado** abre `ModalVariavel`; Enter com foco no item marcado
 * também abre o modal (Enter num item ainda não marcado só marca, para
 * manter a paridade com o clique); duplo clique continua abrindo — é só o
 * caso rápido do mesmo gesto (dois cliques nativos acontecem antes do
 * evento de duplo clique, e o segundo já encontra o item marcado). **Soltar
 * um item novo da paleta marca o item e não abre o modal** — o próximo
 * clique/Enter é que abre.
 *
 * Continua orquestrando o núcleo puro (`ladder/edicao.ts`): todo diagrama
 * novo vem de uma operação do núcleo, nunca de um cálculo local, e toda
 * prévia (D-11) é a própria operação do núcleo chamada sem aplicar — o que a
 * prévia promete é exatamente o que soltar fará.
 *
 * Sem lista de problemas nesta fatia (entra na tarefa #13): `validarDiagrama`
 * não é chamado aqui.
 *
 * **Ramo paralelo (tarefa #24, D-14):** arrastar "Ramo" da paleta até uma
 * célula do trilho principal cria o ramo pelo núcleo (`criarRamo`); marcar a
 * linha de um ramo (clique numa célula vazia dele) e lixeira/Delete o
 * remove (`removerRamo`); a alça na ponta direita redimensiona
 * (`redimensionarRamo`) — por ponteiro, como geometria pura calculada por
 * `GradeDegrau` e reportada aqui como número de coluna, e por teclado
 * (Espaço pega, ←/→ ajustam, Espaço aplica, Esc cancela), inteiramente
 * decidido aqui. Prévia e recusa reaproveitam os mesmos mecanismos de D-11:
 * a operação do núcleo é chamada sem aplicar.
 *
 * **Nenhuma mensagem em texto dentro do editor (tarefa #25):** o alerta
 * visual (`role="alert"`) que mostrava o motivo de uma recusa abaixo do
 * degrau saiu — toda recusa (soltar/mover/criar ramo/alça/remover degrau)
 * agora só é repassada à prop `aoRecusar`, para quem monta a IDE decidir onde
 * mostrar (na tarefa #26, a aba Mensagens do painel inferior; na tarefa #27,
 * um toast no canto da tela — ver `lib/toasts.ts`/`Toasts.tsx`). O anúncio
 * `sr-only` (`aria-live`) e a marcação `aria-invalid` momentânea da célula
 * recusada continuam — são para leitor de tela e destaque visual, não texto
 * solto no editor.
 *
 * **SET/RESET e CTU (tarefa #18, D-19):** bobina SET/RESET seguem o mesmo
 * caminho de arrasto/prévia/recusa de uma bobina comum (mesmo tipo terminal,
 * `ehTerminal` em `modelo.ts`) — nenhum código novo aqui além dos registros
 * de nome (`NOME_TIPO_PALETA`) e do símbolo certo no fantasma
 * (`GhostArrasto`). O CTU também é terminal (mira sempre a coluna 8, como
 * bobina) mas precisa de uma informação extra na prévia — a `linhaReset` que
 * o núcleo escolheria (`ctu.ts#linhaResetLivre`), sem a qual `GradeDegrau`
 * não sabe até onde desenhar a caixa fantasma — calculada comparando o
 * diagrama antes/depois da operação (`linhaResetPrevista`), nunca reimplementada
 * aqui. O modal ganha o campo do limite (PV): `aoAlterarLimiteNoModal` chama
 * `ctu.ts#atualizarCtu` e usa o mesmo caminho de recusa (`aoRecusar`) das
 * demais jogadas.
 *
 * **Bobina sempre na coluna 8 (tarefa #25):** soltar (ou mover) uma bobina —
 * de qualquer origem, sobre qualquer célula do degrau, mesmo numa linha de
 * ramo — passa pelo núcleo (`ladder/edicao.ts#celulaDeSoltura`) antes de
 * calcular prévia/aplicar, que redireciona o alvo para `{ linha: 0, coluna:
 * COLUNA_TERMINAL }`. A célula sob o cursor/foco continua sendo o alvo do
 * arrasto (`AlvoArrasto`) tal como está — só o cálculo de prévia e a jogada
 * final usam a célula redirecionada. Contatos não mudam (a função devolve a
 * própria célula).
 *
 * **Simulação — modo congelado e energização (spec 004, tarefa #11, RF-15,
 * D-9):** `congelado` (true durante a simulação) bloqueia toda mutação do
 * diagrama por este componente — arrastar (paleta ou célula, ponteiro ou
 * teclado), clicar/duplo-clicar numa célula, marcar, abrir o modal, mover a
 * alça de um ramo, inserir/remover degrau, remover elemento/ramo. Cada
 * função que aplicaria uma dessas jogadas passa a checar `congelado` logo no
 * início e sair sem fazer nada — nenhuma tentativa nova de mecanismo. Este
 * componente não passa `congelado` adiante para `GradeDegrau`/`Paleta` (são
 * de outra frente — D e nenhuma dona nesta fatia, respectivamente): a grade
 * continua desenhando os mesmos afetos visuais de "arrastável", só que
 * nenhum gesto tem efeito — o congelamento é imposto aqui, na fronteira que
 * fala com o núcleo, não como um estado visual em cada filho. O botão
 * "Inserir degrau" (deste componente) ganha `disabled` de verdade, já que é
 * seu.
 *
 * `simulacao` (RF-6, RF-14): quando presente, traz a energização de cada
 * degrau (`EnergizacaoDegrau`, `ladder/simulacao.ts`) calculada pelo núcleo
 * de simulação — este componente só repassa `simulacao.energizacao[rung.id]`
 * a cada `GradeDegrau`, pela prop `energizacao` (contrato do plano §5.4,
 * frente D); não interpreta o conteúdo.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { GitBranch, Plus } from 'lucide-react'

import {
  celulaDeSoltura,
  criarRamo,
  declararVariavel,
  inserirDegrau,
  inserirElemento,
  moverElemento,
  redimensionarRamo,
  removerDegrau,
  removerElemento,
  removerRamo,
  trocarTipoElemento,
  vincularVariavel,
} from '../../ladder/edicao'
import type { ResultadoEdicao } from '../../ladder/edicao'
import type { PontoAmbiente } from '../../ambientes/contrato'
import { atualizarCtu } from '../../ladder/ctu'
import { COLUNAS_POR_DEGRAU, ehCtu, type Celula, type Diagrama, type Elemento, type Ramo } from '../../ladder/modelo'
import type { EnergizacaoDegrau } from '../../ladder/simulacao'
import { descreverCelula, type Problema } from '../../ladder/validacao'
import GradeDegrau, { type PontaAlcaRamo, type Previa, type PreviaAlca } from './GradeDegrau'
import ModalConfirmarRemocaoDegrau from './ModalConfirmarRemocaoDegrau'
import ModalVariavel from './ModalVariavel'
import Paleta, { type TipoPaleta } from './Paleta'
import { Bobina, BobinaReset, BobinaSet, ContatoNA, ContatoNF } from './Simbolos'

export interface EditorLadderProps {
  /** Diagrama atual — o editor não guarda estado próprio (D-13, controlado). */
  diagrama: Diagrama
  /** Chamado a cada mudança bem-sucedida do diagrama. Quem monta o editor
   * decide o que fazer (persistência, `PainelVariaveis`, etc.). */
  aoMudar: (diagrama: Diagrama) => void
  /** Problemas já calculados por `validarDiagrama` (tarefa #13) — o editor
   * nunca chama `validarDiagrama` sozinho; quem monta a IDE decide quando
   * revalidar (normalmente a cada `aoMudar`). Repassado a cada `GradeDegrau`,
   * filtrado pelo `rungId` de cada degrau. */
  problemas?: Problema[]
  /** Pede foco para uma célula específica quando `token` muda (ex.: clicar
   * num problema na lista de fora do editor). `elementoId: null`, ou um
   * elemento que não existe mais, leva o foco à primeira célula do degrau
   * `rungId`. */
  foco?: { rungId: string; elementoId: string | null; token: number } | null
  /** Chamado a cada recusa de uma jogada (soltar/mover/criar ramo/alça/
   * remover degrau), com o motivo em português vindo do núcleo — tarefa #25:
   * o editor não mostra mais texto de recusa por conta própria (nem
   * `role="alert"`), quem monta a IDE decide onde exibir (barra de status,
   * Console). Sem esta prop, a recusa fica só na marcação visual momentânea
   * (célula `aria-invalid`, prévia vermelha) e no anúncio `sr-only`. */
  aoRecusar?: (motivo: string) => void
  /** Simulação ativa (spec 004, RF-15, D-9): nenhuma edição, nenhum arrasto,
   * nenhuma paleta ativa, nenhuma remoção — ver o comentário do arquivo. */
  congelado?: boolean
  /** Energização por degrau, calculada pelo motor de simulação (RF-6, RF-14,
   * plano §5.4) — `null`/ausente é o comportamento de hoje (sem simulação). */
  simulacao?: { energizacao: Record<string, EnergizacaoDegrau> } | null
  /** Pontos do ambiente aberto (spec 005, revisão 2026-09-23): no modal do
   * elemento, rotulam os pinos e sugerem o nome da variável nova. */
  pontosAmbiente?: readonly PontoAmbiente[]
}

/** Recusa de uma jogada, localizada no degrau (e, quando há, na célula)
 * afetados — estado interno que só marca a célula com `aria-invalid`
 * momentâneo (tarefa #25: o motivo em texto não é mais exibido pelo editor,
 * só repassado a `aoRecusar`). `celula` fica ausente para recusas que não
 * vêm de uma célula específica — inserir/remover degrau (tarefa #10). */
interface RecusaCelula {
  rungId: string
  celula?: Celula
  motivo: string
}

/** De onde vem o elemento sendo arrastado. */
type OrigemArrasto = { de: 'paleta'; tipo: TipoPaleta } | { de: 'celula'; elementoId: string }

type AlvoCelula = { rungId: string; celula: Celula }
type AlvoArrasto = AlvoCelula | 'lixeira' | null

interface EstadoArrasto {
  origem: OrigemArrasto
  alvo: AlvoArrasto
  via: 'ponteiro' | 'teclado'
}

interface PointerPendente {
  origem: OrigemArrasto
  pointerId: number
  x0: number
  y0: number
  iniciado: boolean
}

const LIMIAR_ARRASTO_PX = 4

/** Quanto a célula recusada fica marcada antes de a marca sumir (#26). */
const DURACAO_MARCA_RECUSA_MS = 3000

/** Recusa complementar (D-20, RF-15/CA-8) quando o gesto parte da grade ou do teclado. */
const MOTIVO_CONGELADO = 'Edição congelada durante a simulação — saia da simulação para editar'

const NOME_TIPO: Record<Elemento['tipo'], string> = {
  contato_na: 'contato NA',
  contato_nf: 'contato NF',
  bobina: 'bobina',
  bobina_set: 'bobina SET',
  bobina_reset: 'bobina RESET',
  ctu: 'contador CTU',
}

const NOME_TIPO_PALETA: Record<TipoPaleta, string> = {
  contato_na: 'contato NA',
  contato_nf: 'contato NF',
  bobina: 'bobina',
  bobina_set: 'bobina SET',
  bobina_reset: 'bobina RESET',
  ramo: 'ramo',
  ctu: 'contador CTU',
}

function elementoNaCelula(diagrama: Diagrama, rungId: string, celula: Celula): Elemento | undefined {
  const rung = diagrama.rungs.find((r) => r.id === rungId)
  return rung?.elementos.find((e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna)
}

function encontrarElementoPorId(diagrama: Diagrama, elementoId: string): { rungId: string; elemento: Elemento } | undefined {
  for (const rung of diagrama.rungs) {
    const elemento = rung.elementos.find((e) => e.id === elementoId)
    if (elemento !== undefined) return { rungId: rung.id, elemento }
  }
  return undefined
}

function elementoPorId(diagrama: Diagrama, id: string | null): Elemento | null {
  if (id === null) return null
  return encontrarElementoPorId(diagrama, id)?.elemento ?? null
}

/** Ramo (de qualquer degrau) cuja `id` é `ramoId`, com o id do degrau dono. */
function encontrarRamoPorId(diagrama: Diagrama, ramoId: string): { rungId: string; ramo: Ramo } | undefined {
  for (const rung of diagrama.rungs) {
    const ramo = rung.ramos.find((r) => r.id === ramoId)
    if (ramo !== undefined) return { rungId: rung.id, ramo }
  }
  return undefined
}

/** Ramo do degrau `rungId` cujo intervalo cobre `celula` (D-14) — usado para
 * decidir se um clique numa célula vazia de linha > 0 marca um ramo. */
function encontrarRamoPorCelula(diagrama: Diagrama, rungId: string, celula: Celula): Ramo | undefined {
  if (celula.linha <= 0) return undefined
  const rung = diagrama.rungs.find((r) => r.id === rungId)
  return rung?.ramos.find((r) => r.linha === celula.linha && celula.coluna >= r.colunaInicio && celula.coluna <= r.colunaFim)
}

/** O `Ramo` presente em `depois.rungs[rungId]` que não existia em `antes`
 * (D-14) — usado para achar a linha que `criarRamo` escolheu, já que a
 * operação só recebe a coluna. */
function ramoAdicionado(antes: Diagrama, depois: Diagrama, rungId: string): Ramo | undefined {
  const rungAntes = antes.rungs.find((r) => r.id === rungId)
  const rungDepois = depois.rungs.find((r) => r.id === rungId)
  if (rungAntes === undefined || rungDepois === undefined) return undefined
  return rungDepois.ramos.find((r) => !rungAntes.ramos.some((a) => a.id === r.id))
}

/** `linhaReset` que o núcleo escolheu (ou manteve) para o CTU em `rungId` de
 * `depois` (tarefa #18, mesmo espírito de `ramoAdicionado`): com
 * `elementoId` conhecido (mover um CTU já existente), busca direto por id;
 * sem ele (inserir um CTU novo da paleta, cujo id só existe depois de
 * `criarCtu`), acha o elemento CTU de `rungId` que não existia em `antes`.
 * `undefined` quando não há CTU nenhum a mostrar (ex.: jogada inválida). */
function linhaResetPrevista(antes: Diagrama, depois: Diagrama, rungId: string, elementoId?: string): number | undefined {
  const rungDepois = depois.rungs.find((r) => r.id === rungId)
  if (rungDepois === undefined) return undefined
  if (elementoId !== undefined) {
    const elemento = rungDepois.elementos.find((e) => e.id === elementoId)
    return elemento !== undefined && ehCtu(elemento) ? elemento.linhaReset : undefined
  }
  const idsAntes = new Set(antes.rungs.find((r) => r.id === rungId)?.elementos.map((e) => e.id) ?? [])
  const novo = rungDepois.elementos.find((e) => !idsAntes.has(e.id) && ehCtu(e))
  return novo !== undefined && ehCtu(novo) ? novo.linhaReset : undefined
}

/** Nome de exibição da origem do arrasto, para o anúncio de `aria-live`. */
function nomeOrigem(diagrama: Diagrama, origem: OrigemArrasto): string {
  if (origem.de === 'paleta') return NOME_TIPO_PALETA[origem.tipo]
  const achado = encontrarElementoPorId(diagrama, origem.elementoId)
  return achado ? NOME_TIPO[achado.elemento.tipo] : 'elemento'
}

/** Prévia da jogada do arrasto sobre `celula`, calculada chamando o núcleo
 * sem aplicar (D-11): origem paleta (contato/bobina) → `inserirElemento`;
 * origem paleta "Ramo" (D-14) → `criarRamo`, cuja linha o núcleo escolhe —
 * a prévia mostra o ramo inteiro, não uma célula; origem célula →
 * `moverElemento`. Nenhuma regra de posição é reimplementada aqui.
 *
 * Tarefa #25: para contato/bobina (não "ramo"), a célula passa antes por
 * `celulaDeSoltura` — uma bobina sempre mira a coluna terminal, não importa
 * onde o cursor estava; a `Previa` devolvida já traz a célula redirecionada
 * (é ela que `GradeDegrau` destaca). */
function calcularPreviaArrasto(diagrama: Diagrama, origem: OrigemArrasto, rungId: string, celula: Celula): Previa {
  if (origem.de === 'paleta') {
    if (origem.tipo === 'ramo') {
      const resultado = criarRamo(diagrama, rungId, celula.coluna)
      if (!resultado.ok) return { celula, tipo: 'invalida', motivo: resultado.motivo }
      const novoRamo = ramoAdicionado(diagrama, resultado.diagrama, rungId)
      if (novoRamo === undefined) return { celula, tipo: 'invalida', motivo: 'não foi possível calcular a prévia do ramo' }
      return { tipo: 'ramo-criar', ramo: { linha: novoRamo.linha, colunaInicio: novoRamo.colunaInicio, colunaFim: novoRamo.colunaFim } }
    }
    const rung = diagrama.rungs.find((r) => r.id === rungId)
    const alvo = celulaDeSoltura(origem.tipo, celula, rung)
    const resultado = inserirElemento(diagrama, rungId, origem.tipo, alvo)
    if (resultado.ok) {
      const linhaReset = origem.tipo === 'ctu' ? linhaResetPrevista(diagrama, resultado.diagrama, rungId) : undefined
      return { celula: alvo, tipo: 'inserir', elemento: origem.tipo, linhaReset }
    }
    return { celula: alvo, tipo: 'invalida', motivo: resultado.motivo }
  }
  const achadoOrigem = encontrarElementoPorId(diagrama, origem.elementoId)
  const tipoOrigem = achadoOrigem?.elemento.tipo ?? 'contato_na'
  const rungMover = diagrama.rungs.find((r) => r.id === rungId)
  const alvo = celulaDeSoltura(tipoOrigem, celula, rungMover, origem.elementoId)
  const resultado = moverElemento(diagrama, origem.elementoId, rungId, alvo)
  if (resultado.ok) {
    const linhaReset = tipoOrigem === 'ctu' ? linhaResetPrevista(diagrama, resultado.diagrama, rungId, origem.elementoId) : undefined
    return { celula: alvo, tipo: 'inserir', elemento: tipoOrigem, linhaReset }
  }
  return { celula: alvo, tipo: 'invalida', motivo: resultado.motivo }
}

/** Mensagem do `aria-live` para o alvo atual do arrasto. Descreve a célula
 * onde a jogada realmente cairia — para bobina (tarefa #25), é a coluna
 * terminal redirecionada por `celulaDeSoltura`/`calcularPreviaArrasto`, não a
 * célula bruta sob o cursor. */
function mensagemAlvo(diagrama: Diagrama, origem: OrigemArrasto, alvo: AlvoArrasto): string {
  if (alvo === null) return 'fora de qualquer posição válida'
  if (alvo === 'lixeira') return 'sobre a lixeira — soltar remove o elemento'
  const indiceDegrau = diagrama.rungs.findIndex((r) => r.id === alvo.rungId)
  const previa = calcularPreviaArrasto(diagrama, origem, alvo.rungId, alvo.celula)
  const celulaDescrita = previa.tipo === 'ramo-criar' ? alvo.celula : previa.celula
  const onde = descreverCelula(indiceDegrau, celulaDescrita)
  if (previa.tipo === 'invalida') return `sobre ${onde} — posição inválida: ${previa.motivo}`
  return `sobre ${onde} — posição válida`
}

/** Lê o `data-celula`/`data-lixeira` mais próximo (via `closest`) a partir do
 * elemento informado, e devolve o alvo de arrasto correspondente, ou `null`
 * se não for nenhum dos dois. Usado pelo hit-test ativo do `pointermove`
 * (ver comentário em `aoMoverPonteiro`). */
function alvoDoElemento(elemento: Element | null): AlvoArrasto {
  if (elemento === null) return null
  if (elemento.closest('[data-lixeira]')) return 'lixeira'
  const celulaEl = elemento.closest('[data-celula]')
  const atributo = celulaEl?.getAttribute('data-celula')
  if (!atributo) return null
  const [rungId, linhaTexto, colunaTexto] = atributo.split(':')
  const linha = Number(linhaTexto)
  const coluna = Number(colunaTexto)
  if (rungId === undefined || Number.isNaN(linha) || Number.isNaN(coluna)) return null
  return { rungId, celula: { linha, coluna } }
}

function alvoIgual(a: AlvoArrasto, b: AlvoArrasto): boolean {
  if (a === b) return true
  if (a === 'lixeira' || b === 'lixeira' || a === null || b === null) return false
  return a.rungId === b.rungId && a.celula.linha === b.celula.linha && a.celula.coluna === b.celula.coluna
}

/** Próximo alvo ao mover com as setas (arrasto por teclado). Regra própria,
 * documentada aqui (plano D-12 deixa a cargo da implementação): ←→ percorrem
 * as colunas do degrau atual, ↑↓ trocam de degrau na mesma coluna, ← na
 * primeira coluna vai para a lixeira, → a partir da lixeira volta à primeira
 * coluna do primeiro degrau. Nas bordas (coluna 8, primeiro/último degrau) a
 * tecla correspondente não move o alvo. */
function proximoAlvo(diagrama: Diagrama, alvo: AlvoArrasto, tecla: string): AlvoArrasto {
  if (alvo === null) return alvo
  if (alvo === 'lixeira') {
    if (tecla === 'ArrowRight') {
      const primeiroRung = diagrama.rungs[0]
      return { rungId: primeiroRung.id, celula: { linha: 0, coluna: 0 } }
    }
    return alvo
  }
  const indiceRung = diagrama.rungs.findIndex((r) => r.id === alvo.rungId)
  const { linha, coluna } = alvo.celula
  if (tecla === 'ArrowLeft') {
    if (coluna === 0) return 'lixeira'
    return { rungId: alvo.rungId, celula: { linha, coluna: coluna - 1 } }
  }
  if (tecla === 'ArrowRight') {
    const proxColuna = Math.min(coluna + 1, COLUNAS_POR_DEGRAU - 1)
    return { rungId: alvo.rungId, celula: { linha, coluna: proxColuna } }
  }
  if (tecla === 'ArrowUp') {
    const proxIndice = Math.max(indiceRung - 1, 0)
    return { rungId: diagrama.rungs[proxIndice].id, celula: { linha, coluna } }
  }
  if (tecla === 'ArrowDown') {
    const proxIndice = Math.min(indiceRung + 1, diagrama.rungs.length - 1)
    return { rungId: diagrama.rungs[proxIndice].id, celula: { linha, coluna } }
  }
  return alvo
}

function extremosRamo(ramo: Ramo, coluna: number, ponta: PontaAlcaRamo): { colunaInicio: number; colunaFim: number } {
  if (ponta === 'inicio') return { colunaInicio: coluna, colunaFim: ramo.colunaFim }
  return { colunaInicio: ramo.colunaInicio, colunaFim: coluna }
}

export default function EditorLadder({
  diagrama,
  aoMudar,
  problemas,
  foco,
  aoRecusar,
  congelado = false,
  simulacao = null,
  pontosAmbiente,
}: EditorLadderProps) {
  const [marcado, setMarcado] = useState<string | null>(null)
  const [ramoMarcado, setRamoMarcado] = useState<string | null>(null)
  const [modal, setModal] = useState<{ elementoId: string } | null>(null)
  const [arrasto, setArrasto] = useState<EstadoArrasto | null>(null)
  const [posGhost, setPosGhost] = useState<{ x: number; y: number } | null>(null)
  const [recusa, setRecusa] = useState<RecusaCelula | null>(null)
  /** Timer da marca de recusa (limpo na próxima recusa e na desmontagem). */
  const timerRecusaRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timerRecusaRef.current !== null) window.clearTimeout(timerRecusaRef.current)
    },
    [],
  )
  const [anuncio, setAnuncio] = useState('')
  /** Prévia (ponteiro ou teclado) da alça de redimensionamento de um ramo
   * (D-14) — `null` quando nenhuma alça está sendo manipulada. `valido`
   * reflete o resultado de `redimensionarRamo` chamado sem aplicar. */
  const [previaAlca, setPreviaAlca] = useState<{
    rungId: string
    ramoId: string
    colunaInicio: number
    colunaFim: number
    ponta: PontaAlcaRamo
    valido: boolean
  } | null>(null)
  const [modalRemoverDegrau, setModalRemoverDegrau] = useState<{ rungId: string; indice: number } | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const diagramaRef = useRef(diagrama)
  const arrastoRef = useRef<EstadoArrasto | null>(null)
  const aoMudarRef = useRef(aoMudar)
  const aoRecusarRef = useRef(aoRecusar)
  const pointerPendenteRef = useRef<PointerPendente | null>(null)
  /** Espelha `congelado` para os listeners de `window` (registrados uma
   * única vez, ver abaixo) — mesmo padrão de `aoMudarRef`/`aoRecusarRef`:
   * eles não podem depender do valor de `congelado` capturado no mount. */
  const congeladoRef = useRef(congelado)

  useEffect(() => {
    diagramaRef.current = diagrama
  }, [diagrama])
  useEffect(() => {
    aoMudarRef.current = aoMudar
  }, [aoMudar])
  useEffect(() => {
    aoRecusarRef.current = aoRecusar
  }, [aoRecusar])
  useEffect(() => {
    congeladoRef.current = congelado
  }, [congelado])

  useEffect(() => {
    try {
      window.getSelection?.()?.removeAllRanges()
    } catch {
      // jsdom pode não expor seleção — sem efeito prático.
    }
  }, [congelado])

  function atualizarArrasto(novo: EstadoArrasto | null) {
    arrastoRef.current = novo
    setArrasto(novo)
  }

  /** Registra uma recusa (marcação visual momentânea, `RecusaCelula`) e
   * repassa o motivo a `aoRecusar` (tarefa #25) — ponto único por onde toda
   * recusa de jogada passa, para que a prop nunca fique dessincronizada da
   * marcação visual.
   *
   * A marcação é **momentânea** de fato: desde a #25 ela não tem mais texto ao
   * lado, e uma célula vermelha parada na tela até a próxima jogada era lida
   * como estado do diagrama, não como resposta ao gesto. O motivo em texto
   * hoje é um toast (tarefa #27, D-18) — some sozinho em 5s, diferente da
   * marca momentânea desta célula, que sempre foi mais curta. */
  function reportarRecusa(nova: RecusaCelula) {
    setRecusa(nova)
    aoRecusarRef.current?.(nova.motivo)
    if (timerRecusaRef.current !== null) window.clearTimeout(timerRecusaRef.current)
    timerRecusaRef.current = window.setTimeout(() => {
      timerRecusaRef.current = null
      setRecusa((atual) => (atual === nova ? null : atual))
    }, DURACAO_MARCA_RECUSA_MS)
  }

  function focarAlvo(alvo: AlvoArrasto) {
    const container = containerRef.current
    if (!container || alvo === null) return
    if (alvo === 'lixeira') {
      container.querySelector<HTMLElement>('[data-lixeira]')?.focus({ preventScroll: true })
      return
    }
    container
      .querySelector<HTMLElement>(`[data-celula="${alvo.rungId}:${alvo.celula.linha}:${alvo.celula.coluna}"]`)
      ?.focus({ preventScroll: true })
  }

  function focarOrigemPaleta(origem: OrigemArrasto) {
    if (origem.de !== 'paleta') return
    containerRef.current?.querySelector<HTMLElement>(`[data-tipo-paleta="${origem.tipo}"]`)?.focus({ preventScroll: true })
  }

  /** Foco pedido por quem monta o editor (`foco`, contrato fixado com a
   * frente I): dispara só quando `foco.token` muda, nunca a cada
   * renderização — por isso a dependência é só o `token`, com o resto lido
   * de `diagramaRef` no momento em que o efeito roda. `elementoId` presente
   * e existente vai para a célula desse elemento; `null`, ou um elemento que
   * não existe mais (ex.: acabou de ser removido), vai para a primeira
   * célula (linha 0, coluna 0) do degrau `rungId`. */
  useEffect(() => {
    if (!foco) return
    if (foco.elementoId !== null) {
      const achado = encontrarElementoPorId(diagramaRef.current, foco.elementoId)
      if (achado) {
        focarAlvo({ rungId: achado.rungId, celula: achado.elemento.celula })
        return
      }
    }
    const rung = diagramaRef.current.rungs.find((r) => r.id === foco.rungId)
    if (rung) focarAlvo({ rungId: rung.id, celula: { linha: 0, coluna: 0 } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.token])

  /** Conclui um arrasto (ponteiro ou teclado): aplica a operação do núcleo
   * correspondente à origem/alvo, ou cancela silenciosamente quando não há
   * nada a fazer (alvo nulo, ou paleta solta na lixeira). Nunca lê estado
   * React diretamente — só `diagramaRef`/`aoMudarRef` — porque também é
   * chamado de dentro do listener de `pointerup` em `window`, registrado uma
   * única vez no mount.
   *
   * D-13: soltar um item **novo** da paleta com sucesso marca o elemento
   * recém-criado e não abre o modal — o próximo clique/Enter é que abre.
   * Mover ou remover continuam desmarcando ao final (D-12, sem regressão). */
  function finalizarDrop(origem: OrigemArrasto, alvo: AlvoArrasto) {
    // Defesa contra simulação iniciar no meio de um arrasto em curso (spec
    // 004, RF-15) — `congeladoRef`, não o `congelado` capturado no fecho,
    // porque este listener é registrado uma única vez no mount (ver o
    // `useEffect` de `window.addEventListener('pointerup', ...)` abaixo).
    if (congeladoRef.current) {
      setMarcado(null)
      atualizarArrasto(null)
      return
    }
    if (alvo === null) {
      setMarcado(null)
      setAnuncio('arrasto cancelado')
      return
    }

    if (alvo === 'lixeira') {
      setMarcado(null)
      if (origem.de === 'paleta') {
        setAnuncio('arrasto cancelado')
        return
      }
      const resultado = removerElemento(diagramaRef.current, origem.elementoId)
      if (resultado.ok) {
        aoMudarRef.current(resultado.diagrama)
        setAnuncio('elemento removido')
      }
      return
    }

    const indiceDegrau = diagramaRef.current.rungs.findIndex((r) => r.id === alvo.rungId)

    if (origem.de === 'paleta') {
      if (origem.tipo === 'ramo') {
        const onde = descreverCelula(indiceDegrau, alvo.celula)
        const resultado = criarRamo(diagramaRef.current, alvo.rungId, alvo.celula.coluna)
        if (!resultado.ok) {
          setMarcado(null)
          reportarRecusa({ rungId: alvo.rungId, celula: alvo.celula, motivo: resultado.motivo })
          setAnuncio(`recusado: ${resultado.motivo}`)
          return
        }
        setRecusa(null)
        aoMudarRef.current(resultado.diagrama)
        setMarcado(null)
        setAnuncio(`ramo criado em ${onde}`)
        return
      }
      // Tarefa #25: bobina redireciona para a coluna terminal, não importa a
      // célula sob o cursor/foco — `alvoReal` é onde a jogada de fato cai.
      const rungSolta = diagramaRef.current.rungs.find((r) => r.id === alvo.rungId)
      const alvoReal = celulaDeSoltura(origem.tipo, alvo.celula, rungSolta)
      const onde = descreverCelula(indiceDegrau, alvoReal)
      const resultado: ResultadoEdicao = inserirElemento(diagramaRef.current, alvo.rungId, origem.tipo, alvoReal)
      if (!resultado.ok) {
        setMarcado(null)
        reportarRecusa({ rungId: alvo.rungId, celula: alvoReal, motivo: resultado.motivo })
        setAnuncio(`recusado: ${resultado.motivo}`)
        return
      }
      setRecusa(null)
      aoMudarRef.current(resultado.diagrama)
      const novoElemento = elementoNaCelula(resultado.diagrama, alvo.rungId, alvoReal)
      setMarcado(novoElemento ? novoElemento.id : null)
      setAnuncio(`solto em ${onde}, marcado — clique ou Enter de novo para escolher a variável`)
      return
    }

    setMarcado(null)
    const achadoOrigem = encontrarElementoPorId(diagramaRef.current, origem.elementoId)
    const tipoOrigem = achadoOrigem?.elemento.tipo ?? 'contato_na'
    const rungMoverSolta = diagramaRef.current.rungs.find((r) => r.id === alvo.rungId)
    const alvoReal = celulaDeSoltura(tipoOrigem, alvo.celula, rungMoverSolta, origem.elementoId)
    const onde = descreverCelula(indiceDegrau, alvoReal)
    const resultado = moverElemento(diagramaRef.current, origem.elementoId, alvo.rungId, alvoReal)
    if (!resultado.ok) {
      reportarRecusa({ rungId: alvo.rungId, celula: alvoReal, motivo: resultado.motivo })
      setAnuncio(`recusado: ${resultado.motivo}`)
      return
    }
    setRecusa(null)
    aoMudarRef.current(resultado.diagrama)
    setAnuncio(`solto em ${onde}`)
  }

  // Listeners de ponteiro em `window`, registrados uma única vez: o arrasto
  // pode terminar fora de qualquer célula, e `pointerup`/`pointercancel` só
  // são confiáveis capturados no nível da janela (plano D-12).
  //
  // Histórico de bug real (Chromium, achado pelo orquestrador após a #22):
  // um segundo arrasto (paleta → célula) depois de soltar o primeiro e
  // fechar o modal (mesmo cancelando, sem escolher variável) nunca armava —
  // a sequência de eventos observada era `pointerdown, pointermove,
  // pointermove, pointercancel`. A hipótese inicial ("perde-se o
  // pointerenter no alvo") estava ERRADA e foi descartada pelo orquestrador
  // com log de eventos no navegador. Causa real: depois da primeira
  // interação a página já tem uma seleção de texto (nada em `armarPonteiro`
  // chamava `preventDefault`/limpava seleção); no segundo gesto, mover o
  // mouse com o botão pressionado sobre essa seleção faz o Chromium iniciar
  // um **drag nativo de conteúdo**, e o navegador cancela o ponteiro
  // (`pointercancel`) para ceder o gesto a esse drag nativo. Corrigido em
  // `armarPonteiro`: `preventDefault()` no `pointerdown` da origem e limpeza
  // de `window.getSelection()`, mais `select-none`/`touch-none` nas origens,
  // células e lixeira (`Paleta.tsx`/`GradeDegrau.tsx`) para não deixar a
  // seleção se formar de novo. O hit-test ativo por `document.elementFromPoint`
  // abaixo NÃO foi a correção do bug relatado (a hipótese que o motivou
  // estava errada) — ficou como reforço legítimo, mas independente: com o
  // ghost `pointer-events-none` sobre a célula, um hit-test que ignore o
  // fantasma é mais robusto que só `pointerenter`/`pointerleave`.
  useEffect(() => {
    function aoMoverPonteiro(evento: PointerEvent) {
      const pendente = pointerPendenteRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      if (!pendente.iniciado) {
        const dx = evento.clientX - pendente.x0
        const dy = evento.clientY - pendente.y0
        if (Math.hypot(dx, dy) < LIMIAR_ARRASTO_PX) return
        pendente.iniciado = true
        const novoEstado: EstadoArrasto = { origem: pendente.origem, alvo: null, via: 'ponteiro' }
        atualizarArrasto(novoEstado)
        setAnuncio(`peguei ${nomeOrigem(diagramaRef.current, pendente.origem)}`)
      }
      setPosGhost({ x: evento.clientX, y: evento.clientY })

      const atual = arrastoRef.current
      if (!atual || typeof document.elementFromPoint !== 'function') return
      const elementoSobPonteiro = document.elementFromPoint(evento.clientX, evento.clientY)
      if (elementoSobPonteiro === null) return
      const novoAlvo = alvoDoElemento(elementoSobPonteiro)
      if (!alvoIgual(atual.alvo, novoAlvo)) {
        atualizarArrasto({ ...atual, alvo: novoAlvo })
        setAnuncio(mensagemAlvo(diagramaRef.current, atual.origem, novoAlvo))
      }
    }

    function aoSoltarPonteiro(evento: PointerEvent) {
      const pendente = pointerPendenteRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      pointerPendenteRef.current = null
      if (pendente.iniciado) {
        const alvoFinal = arrastoRef.current?.alvo ?? null
        atualizarArrasto(null)
        setPosGhost(null)
        finalizarDrop(pendente.origem, alvoFinal)
      }
    }

    function aoCancelarPonteiro(evento: PointerEvent) {
      const pendente = pointerPendenteRef.current
      if (!pendente || evento.pointerId !== pendente.pointerId) return
      pointerPendenteRef.current = null
      atualizarArrasto(null)
      setPosGhost(null)
      setAnuncio('arrasto cancelado')
    }

    window.addEventListener('pointermove', aoMoverPonteiro)
    window.addEventListener('pointerup', aoSoltarPonteiro)
    window.addEventListener('pointercancel', aoCancelarPonteiro)
    return () => {
      window.removeEventListener('pointermove', aoMoverPonteiro)
      window.removeEventListener('pointerup', aoSoltarPonteiro)
      window.removeEventListener('pointercancel', aoCancelarPonteiro)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Arma um possível arrasto por ponteiro: só vira arrasto de fato (fantasma
   * visível, prévia) ao passar do limiar de 4px em `pointermove` — abaixo
   * disso, é um clique. Libera a captura implícita do ponteiro (toque) para
   * que `pointerenter`/`pointerleave` continuem funcionando durante o gesto.
   *
   * `preventDefault()` e limpar a seleção de texto são a correção do bug real
   * do Chromium (ver comentário acima do `useEffect` dos listeners): sem
   * isso, mover o mouse sobre uma seleção deixada por uma interação anterior
   * (ex.: clicar duas vezes rápido, ou o próprio arrasto anterior) faz o
   * navegador iniciar um drag nativo de conteúdo e cancelar o ponteiro
   * (`pointercancel`) no meio do segundo gesto. */
  function armarPonteiro(
    origem: OrigemArrasto,
    evento: { currentTarget: Element; pointerId: number; clientX: number; clientY: number; preventDefault: () => void },
  ) {
    evento.preventDefault()
    try {
      window.getSelection?.()?.removeAllRanges()
    } catch {
      // ambiente sem seleção (ex.: jsdom em certas configurações) — sem efeito prático.
    }
    try {
      const alvo = evento.currentTarget as Element & {
        hasPointerCapture?: (id: number) => boolean
        releasePointerCapture?: (id: number) => void
      }
      if (alvo.hasPointerCapture?.(evento.pointerId)) alvo.releasePointerCapture?.(evento.pointerId)
    } catch {
      // jsdom (testes) não implementa captura de ponteiro — sem efeito prático.
    }
    pointerPendenteRef.current = { origem, pointerId: evento.pointerId, x0: evento.clientX, y0: evento.clientY, iniciado: false }
  }

  function aoIniciarArrastoPonteiroPaleta(tipo: TipoPaleta, evento: ReactPointerEvent<HTMLDivElement>) {
    if (congelado) {
      evento.preventDefault()
      try {
        window.getSelection?.()?.removeAllRanges()
      } catch {
        /* vazio */
      }
      return
    }
    armarPonteiro({ de: 'paleta', tipo }, evento)
  }

  function aoIniciarArrastoPonteiroCelula(evento: ReactPointerEvent<SVGGElement>, rungId: string, celula: Celula) {
    if (congelado) {
      evento.preventDefault()
      reportarRecusa({ rungId, celula, motivo: MOTIVO_CONGELADO })
      return
    }
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    if (!elemento) return
    armarPonteiro({ de: 'celula', elementoId: elemento.id }, evento)
  }

  function iniciarArrastoTeclado(origem: OrigemArrasto) {
    if (congelado) {
      const rungId = diagrama.rungs[0]?.id ?? ''
      const celula = { linha: 0, coluna: 0 }
      reportarRecusa({ rungId, celula, motivo: MOTIVO_CONGELADO })
      return
    }
    const alvoInicial: AlvoArrasto =
      origem.de === 'paleta'
        ? { rungId: diagrama.rungs[0].id, celula: { linha: 0, coluna: 0 } }
        : (() => {
            const achado = encontrarElementoPorId(diagrama, origem.elementoId)
            return achado ? { rungId: achado.rungId, celula: achado.elemento.celula } : null
          })()

    atualizarArrasto({ origem, alvo: alvoInicial, via: 'teclado' })
    setAnuncio(`peguei ${nomeOrigem(diagrama, origem)}, ${mensagemAlvo(diagrama, origem, alvoInicial)}`)
    focarAlvo(alvoInicial)
  }

  function cancelarArrasto() {
    const origemAntes = arrastoRef.current?.origem
    pointerPendenteRef.current = null
    atualizarArrasto(null)
    setPosGhost(null)
    setAnuncio('arrasto cancelado')
    if (origemAntes) {
      if (origemAntes.de === 'paleta') {
        focarOrigemPaleta(origemAntes)
      } else {
        const achado = encontrarElementoPorId(diagrama, origemAntes.elementoId)
        if (achado) focarAlvo({ rungId: achado.rungId, celula: achado.elemento.celula })
      }
    }
  }

  /** Remove o elemento ou o ramo marcado (D-14: lixeira/Delete agem sobre o
   * que estiver marcado; ramo tem prioridade porque marcar um sempre
   * desmarca o outro). Recusa de `removerRamo` (ramo com contato dentro)
   * aparece no mesmo alerta das demais recusas. */
  function removerMarcado() {
    if (congelado) return
    if (ramoMarcado !== null) {
      const resultado = removerRamo(diagrama, ramoMarcado)
      if (resultado.ok) {
        aoMudar(resultado.diagrama)
        setRamoMarcado(null)
        setRecusa(null)
        return
      }
      const achado = encontrarRamoPorId(diagrama, ramoMarcado)
      reportarRecusa({
        rungId: achado?.rungId ?? diagrama.rungs[0].id,
        celula: { linha: achado?.ramo.linha ?? 0, coluna: achado?.ramo.colunaInicio ?? 0 },
        motivo: resultado.motivo,
      })
      setAnuncio(`recusado: ${resultado.motivo}`)
      return
    }
    if (marcado === null) return
    const resultado = removerElemento(diagrama, marcado)
    if (resultado.ok) {
      aoMudar(resultado.diagrama)
      setMarcado(null)
    }
  }

  /** Insere um degrau vazio ao fim da lista (tarefa #10, CA-6). Uma recusa
   * (hoje improvável — `inserirDegrau(diagrama, diagrama.rungs.length)` é
   * sempre uma posição válida) usa o mesmo alerta das demais jogadas,
   * ancorado no último degrau, sem alterar o diagrama. */
  function aoInserirDegrauNoFim() {
    if (congelado) return
    const resultado = inserirDegrau(diagrama, diagrama.rungs.length)
    if (!resultado.ok) {
      const ultimo = diagrama.rungs[diagrama.rungs.length - 1]
      reportarRecusa({ rungId: ultimo.id, motivo: resultado.motivo })
      setAnuncio(`recusado: ${resultado.motivo}`)
      return
    }
    aoMudar(resultado.diagrama)
    setRecusa(null)
    setAnuncio('degrau inserido')
  }

  /** Insere um degrau vazio logo abaixo de `rungId` (tarefa #10, CA-6). */
  function aoInserirDegrauAbaixoDe(rungId: string) {
    if (congelado) return
    const indice = diagrama.rungs.findIndex((r) => r.id === rungId)
    if (indice === -1) return
    const resultado = inserirDegrau(diagrama, indice + 1)
    if (!resultado.ok) {
      reportarRecusa({ rungId, motivo: resultado.motivo })
      setAnuncio(`recusado: ${resultado.motivo}`)
      return
    }
    aoMudar(resultado.diagrama)
    setRecusa(null)
    setAnuncio(`degrau inserido abaixo do degrau ${indice + 1}`)
  }

  /** Remove um degrau inteiro (tarefa #10, CA-6): a recusa do núcleo (hoje só
   * "é o último degrau") aparece no mesmo alerta das demais jogadas, sem
   * alterar o diagrama; um sucesso limpa a marcação de elemento ou ramo que
   * pertencesse ao degrau removido — do contrário ficaria apontando para algo
   * que não existe mais. */
  function executarRemoverDegrau(rungId: string) {
    const indice = diagrama.rungs.findIndex((r) => r.id === rungId)
    const marcadoNesteDegrau = marcado !== null && encontrarElementoPorId(diagrama, marcado)?.rungId === rungId
    const ramoMarcadoNesteDegrau = ramoMarcado !== null && encontrarRamoPorId(diagrama, ramoMarcado)?.rungId === rungId

    const resultado = removerDegrau(diagrama, rungId)
    if (!resultado.ok) {
      reportarRecusa({ rungId, motivo: resultado.motivo })
      setAnuncio(`recusado: ${resultado.motivo}`)
      return
    }

    aoMudar(resultado.diagrama)
    setRecusa(null)
    if (marcadoNesteDegrau) setMarcado(null)
    if (ramoMarcadoNesteDegrau) setRamoMarcado(null)
    setAnuncio(`degrau ${indice + 1} removido`)
  }

  function aoRemoverDegrauHandler(rungId: string) {
    if (congelado) return
    const rung = diagrama.rungs.find((r) => r.id === rungId)
    if (!rung) return
    const indice = diagrama.rungs.findIndex((r) => r.id === rungId)
    const temConteudo = rung.elementos.length > 0 || rung.ramos.length > 0
    if (temConteudo) {
      setModalRemoverDegrau({ rungId, indice })
      return
    }
    executarRemoverDegrau(rungId)
  }

  // Um arrasto que se movimenta o bastante para contar como arrasto (>4px)
  // normalmente não deixa o alvo sob o ponteiro no fim do gesto, então o
  // "clique fantasma" que alguns navegadores sintetizam depois do
  // `pointerup` raramente chega até aqui; quando chega, marcar de novo o
  // mesmo elemento é inofensivo (idempotente).
  //
  // D-13 (segundo clique): célula vazia desmarca; item não marcado marca;
  // item já marcado abre o modal (duplo clique é só esse mesmo gesto, rápido
  // o bastante para dois cliques nativos acontecerem antes do `dblclick`).
  //
  // D-14: célula vazia de linha > 0 dentro de um ramo marca o ramo (visual
  // `ide-destaque`, `aria-selected`) em vez de só desmarcar.
  function aoClicarCelula(rungId: string, celula: Celula) {
    if (congelado) return
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    if (!elemento) {
      const ramo = encontrarRamoPorCelula(diagrama, rungId, celula)
      if (ramo) {
        setMarcado(null)
        setRamoMarcado(ramo.id)
        return
      }
      setMarcado(null)
      setRamoMarcado(null)
      return
    }
    setRamoMarcado(null)
    if (marcado === elemento.id) {
      setModal({ elementoId: elemento.id })
      return
    }
    setMarcado(elemento.id)
  }

  function aoDuploClicarCelula(rungId: string, celula: Celula) {
    if (congelado) return
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    if (elemento) setModal({ elementoId: elemento.id })
  }

  function aoTeclarNaCelula(evento: ReactKeyboardEvent<SVGGElement>, rungId: string, celula: Celula) {
    if (congelado) return
    const elemento = elementoNaCelula(diagrama, rungId, celula)

    if (arrasto && arrasto.via === 'teclado') {
      if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight' || evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
        evento.preventDefault()
        evento.stopPropagation()
        const novoAlvo = proximoAlvo(diagrama, arrasto.alvo, evento.key)
        atualizarArrasto({ ...arrasto, alvo: novoAlvo })
        setAnuncio(mensagemAlvo(diagrama, arrasto.origem, novoAlvo))
        focarAlvo(novoAlvo)
        return
      }
      if (evento.key === ' ' || evento.key === 'Enter') {
        evento.preventDefault()
        evento.stopPropagation()
        const { origem, alvo } = arrasto
        atualizarArrasto(null)
        finalizarDrop(origem, alvo)
        return
      }
      return
    }

    if (evento.key === ' ') {
      evento.preventDefault()
      evento.stopPropagation()
      if (elemento) iniciarArrastoTeclado({ de: 'celula', elementoId: elemento.id })
      return
    }
    if (evento.key === 'Enter') {
      if (elemento) {
        evento.preventDefault()
        evento.stopPropagation()
        // D-13: Enter no item já marcado abre o modal; num item ainda não
        // marcado, Enter só marca (paridade com o clique simples).
        if (marcado === elemento.id) {
          setModal({ elementoId: elemento.id })
        } else {
          setMarcado(elemento.id)
        }
      }
      return
    }
    if ((evento.key === 'Delete' || evento.key === 'Backspace') && (marcado || ramoMarcado)) {
      evento.preventDefault()
      evento.stopPropagation()
      removerMarcado()
    }
  }

  /** Recalcula a prévia da alça chamando `redimensionarRamo` sem aplicar
   * (D-14, mesma disciplina de D-11): usada tanto pelo arrasto por ponteiro
   * (coluna vem da geometria calculada em `GradeDegrau`) quanto por cada
   * tecla de seta durante o arrasto por teclado. Inválida repassa o motivo a
   * `aoRecusar` (tarefa #25), âncorado na linha do ramo. */
  function atualizarPreviaAlca(rungId: string, ramoId: string, coluna: number, ponta: PontaAlcaRamo) {
    if (congelado) return
    const achado = encontrarRamoPorId(diagramaRef.current, ramoId)
    if (!achado) return
    const extremos = extremosRamo(achado.ramo, coluna, ponta)
    const resultado = redimensionarRamo(diagramaRef.current, ramoId, extremos)
    setPreviaAlca({ rungId, ramoId, ...extremos, ponta, valido: resultado.ok })
    if (resultado.ok) {
      setRecusa(null)
      setAnuncio(`alça em coluna ${coluna + 1} — posição válida`)
      return
    }
    // Prévia, não jogada: só marca a célula. `aoRecusar` fica para o soltar
    // (`aplicarAlca`), senão a barra de status e o Console recebem uma recusa
    // a cada `pointermove`.
    setRecusa({ rungId, celula: { linha: achado.ramo.linha, coluna }, motivo: resultado.motivo })
    setAnuncio(`alça em coluna ${coluna + 1} — recusado: ${resultado.motivo}`)
  }

  /** Aplica o redimensionamento na coluna dada (fim do arrasto por ponteiro,
   * ou Espaço com a alça pega pelo teclado). */
  function aplicarAlca(rungId: string, ramoId: string, coluna: number, ponta: PontaAlcaRamo) {
    if (congelado) {
      setPreviaAlca(null)
      return
    }
    const achado = encontrarRamoPorId(diagramaRef.current, ramoId)
    if (!achado) {
      setPreviaAlca(null)
      return
    }
    const extremos = extremosRamo(achado.ramo, coluna, ponta)
    const resultado = redimensionarRamo(diagramaRef.current, ramoId, extremos)
    if (resultado.ok) {
      aoMudarRef.current(resultado.diagrama)
      setRecusa(null)
      setAnuncio('ramo redimensionado')
    } else {
      const achado = encontrarRamoPorId(diagramaRef.current, ramoId)
      reportarRecusa({ rungId, celula: { linha: achado?.ramo.linha ?? 0, coluna }, motivo: resultado.motivo })
      setAnuncio(`recusado: ${resultado.motivo}`)
    }
    setPreviaAlca(null)
  }

  /** Esc durante o arrasto (ponteiro ou teclado) da alça: descarta a prévia
   * sem tocar o diagrama. */
  function cancelarAlca() {
    setPreviaAlca(null)
    setRecusa(null)
    setAnuncio('arrasto cancelado')
  }

  /** Máquina de estado do arrasto por teclado da alça (D-14): a própria
   * presença de `previaAlca` para este `ramoId` é o "pegou" — o primeiro
   * Espaço/Enter só pega (grava a prévia com a coluna atual, sem chamar o
   * núcleo — nada mudou ainda); com a alça pega, ←/→ recalculam a prévia,
   * Espaço/Enter aplicam e Esc cancela. */
  function aoTeclarNaAlca(evento: ReactKeyboardEvent<SVGGElement>, rungId: string, ramoId: string, ponta: PontaAlcaRamo) {
    if (congelado) return
    const achado = encontrarRamoPorId(diagrama, ramoId)
    if (!achado) return
    const pega = previaAlca !== null && previaAlca.ramoId === ramoId && previaAlca.ponta === ponta

    if (!pega) {
      if (evento.key === ' ' || evento.key === 'Enter') {
        evento.preventDefault()
        evento.stopPropagation()
        setPreviaAlca({
          rungId,
          ramoId,
          colunaInicio: achado.ramo.colunaInicio,
          colunaFim: achado.ramo.colunaFim,
          ponta,
          valido: true,
        })
        const col = ponta === 'inicio' ? achado.ramo.colunaInicio : achado.ramo.colunaFim
        setAnuncio(`alça do ramo ${achado.ramo.linha} selecionada, coluna ${col + 1} — use as setas para esticar ou encolher`)
      }
      return
    }

    if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
      evento.preventDefault()
      evento.stopPropagation()
      const atual = ponta === 'inicio' ? (previaAlca?.colunaInicio ?? achado.ramo.colunaInicio) : (previaAlca?.colunaFim ?? achado.ramo.colunaFim)
      const proxima = evento.key === 'ArrowLeft' ? atual - 1 : atual + 1
      if (proxima < 0 || proxima >= COLUNAS_POR_DEGRAU) return
      atualizarPreviaAlca(rungId, ramoId, proxima, ponta)
      return
    }
    if (evento.key === ' ' || evento.key === 'Enter') {
      evento.preventDefault()
      evento.stopPropagation()
      const col =
        ponta === 'inicio' ? (previaAlca?.colunaInicio ?? achado.ramo.colunaInicio) : (previaAlca?.colunaFim ?? achado.ramo.colunaFim)
      aplicarAlca(rungId, ramoId, col, ponta)
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      cancelarAlca()
    }
  }

  /** `pointerenter`/`pointerleave` (e foco/blur) de uma célula: só importa
   * como alvo do arrasto quando há um em curso. */
  function aoPassarCelula(rungId: string, celula: Celula | null) {
    if (!arrastoRef.current) return
    const novoAlvo: AlvoArrasto = celula ? { rungId, celula } : null
    atualizarArrasto({ ...arrastoRef.current, alvo: novoAlvo })
    if (celula) setAnuncio(mensagemAlvo(diagrama, arrastoRef.current.origem, novoAlvo))
  }

  function aoPassarLixeira(sobre: boolean) {
    if (!arrastoRef.current) return
    const novoAlvo: AlvoArrasto = sobre ? 'lixeira' : null
    atualizarArrasto({ ...arrastoRef.current, alvo: novoAlvo })
    if (sobre) setAnuncio(mensagemAlvo(diagrama, arrastoRef.current.origem, 'lixeira'))
  }

  function aoAcionarLixeira() {
    if (arrasto) {
      const { origem, alvo } = arrasto
      atualizarArrasto(null)
      finalizarDrop(origem, alvo)
      return
    }
    removerMarcado()
  }

  function aoTeclarNaLixeira(evento: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!arrasto || arrasto.via !== 'teclado') return
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      const novoAlvo = proximoAlvo(diagrama, 'lixeira', 'ArrowRight')
      atualizarArrasto({ ...arrasto, alvo: novoAlvo })
      setAnuncio(mensagemAlvo(diagrama, arrasto.origem, novoAlvo))
      focarAlvo(novoAlvo)
    }
  }

  function fecharModal() {
    const elementoId = modal?.elementoId ?? null
    setModal(null)
    if (elementoId) {
      const achado = encontrarElementoPorId(diagrama, elementoId)
      if (achado) focarAlvo({ rungId: achado.rungId, celula: achado.elemento.celula })
    }
  }

  function aoEscolherNoModal(nome: string | null) {
    if (congelado) return
    if (!modal) return
    const resultado = vincularVariavel(diagrama, modal.elementoId, nome)
    if (resultado.ok) {
      aoMudar(resultado.diagrama)
      setRecusa(null)
    } else {
      reportarRecusa({
        rungId: diagrama.rungs.find((r) => r.elementos.some((e) => e.id === modal.elementoId))?.id ?? diagrama.rungs[0].id,
        celula: encontrarElementoPorId(diagrama, modal.elementoId)?.elemento.celula,
        motivo: resultado.motivo,
      })
    }
  }

  /** "Nova variável" no modal do elemento (spec 002, revisão 2026-09-23):
   * declara e vincula numa jogada só — um único `aoMudar`, logo uma única
   * entrada no histórico de Desfazer. A recusa volta ao modal de criação,
   * que a mostra junto do campo (um toast ficaria sob o overlay). */
  function aoCriarVariavelNoModal(variavel: { nome: string; endereco?: string }): string | null {
    if (congelado || !modal) return 'edição congelada durante a simulação'
    const declarada = declararVariavel(diagrama, variavel)
    if (!declarada.ok) return declarada.motivo
    const vinculada = vincularVariavel(declarada.diagrama, modal.elementoId, variavel.nome)
    if (!vinculada.ok) return vinculada.motivo
    aoMudar(vinculada.diagrama)
    setRecusa(null)
    setAnuncio(`variável ${variavel.nome} criada e vinculada`)
    return null
  }

  function aoTrocarTipoNoModal(novoTipo: Elemento['tipo']) {
    if (congelado || !modal) return
    const resultado = trocarTipoElemento(diagrama, modal.elementoId, novoTipo)
    if (resultado.ok) {
      aoMudar(resultado.diagrama)
      setRecusa(null)
    } else {
      const achado = encontrarElementoPorId(diagrama, modal.elementoId)
      reportarRecusa({
        rungId: achado?.rungId ?? diagrama.rungs[0].id,
        celula: achado?.elemento.celula,
        motivo: resultado.motivo,
      })
    }
  }

  /** Novo limite (PV) do CTU aberto no modal (tarefa #18, D-19): aplica via
   * `atualizarCtu` (núcleo) e recusa pelo caminho existente (`aoRecusar` →
   * toast) se `pv` estiver fora de `[PV_MIN, PV_MAX]` — o modal só valida
   * pelos atributos nativos do `<input type="number">`, quem decide de fato é
   * o núcleo. Ao contrário de `aoEscolherNoModal`, não fecha o modal: o
   * autor pode querer ajustar o limite e ainda escolher a variável de saída
   * na mesma visita. */
  function aoAlterarLimiteNoModal(pv: number) {
    if (congelado) return
    if (!modal) return
    const achado = encontrarElementoPorId(diagrama, modal.elementoId)
    const resultado = atualizarCtu(diagrama, modal.elementoId, { pv })
    if (resultado.ok) {
      aoMudar(resultado.diagrama)
      setRecusa(null)
      setAnuncio(`limite do contador atualizado para ${pv}`)
      return
    }
    reportarRecusa({
      rungId: achado?.rungId ?? diagrama.rungs[0].id,
      celula: achado?.elemento.celula,
      motivo: resultado.motivo,
    })
    setAnuncio(`recusado: ${resultado.motivo}`)
  }

  /** Clique fora de qualquer célula da grade desmarca (plano D-12) — não
   * interfere com o modal (que tem sua própria camada por cima). */
  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (modal !== null) return
      const alvo = evento.target
      // A lixeira também age sobre o elemento marcado (plano D-12) — clicar
      // nela não é "clicar fora da grade", é uma ação sobre a marcação.
      if (alvo instanceof Element && (alvo.closest('[data-celula]') || alvo.closest('[data-lixeira]') || alvo.closest('[data-alca-ramo]'))) return
      setMarcado(null)
      setRamoMarcado(null)
    }
    window.addEventListener('pointerdown', aoClicarFora)
    return () => window.removeEventListener('pointerdown', aoClicarFora)
  }, [modal])

  function aoTeclarNoContainer(evento: ReactKeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Escape') return
    if (arrasto) {
      cancelarArrasto()
      return
    }
    setRecusa(null)
    setMarcado(null)
    setRamoMarcado(null)
  }

  const elementoDoModal = modal ? elementoPorId(diagrama, modal.elementoId) : null
  const tipoGhost: TipoPaleta | Elemento['tipo'] | null =
    arrasto === null ? null : arrasto.origem.de === 'paleta' ? arrasto.origem.tipo : encontrarElementoPorId(diagrama, arrasto.origem.elementoId)?.elemento.tipo ?? null

  return (
    <div ref={containerRef} onKeyDown={aoTeclarNoContainer} className="flex h-full w-full flex-col">
      <Paleta
        marcado={marcado !== null || ramoMarcado !== null}
        emArrasto={arrasto !== null}
        sobreLixeira={arrasto !== null && arrasto.alvo === 'lixeira'}
        congelado={congelado}
        aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiroPaleta}
        aoIniciarArrastoTeclado={(tipo) => iniciarArrastoTeclado({ de: 'paleta', tipo })}
        aoPassarLixeira={aoPassarLixeira}
        aoAcionarLixeira={aoAcionarLixeira}
        aoTeclarNaLixeira={aoTeclarNaLixeira}
      />

      <div className="flex-1 overflow-auto p-4">
        {diagrama.rungs.map((rung, indice) => {
          const previaAqui = (() => {
            if (!arrasto || arrasto.alvo === null) return null
            if (arrasto.alvo === 'lixeira') {
              if (arrasto.origem.de !== 'celula') return null
              const achado = encontrarElementoPorId(diagrama, arrasto.origem.elementoId)
              if (!achado || achado.rungId !== rung.id) return null
              return { celula: achado.elemento.celula, tipo: 'remover' as const }
            }
            if (arrasto.alvo.rungId !== rung.id) return null
            return calcularPreviaArrasto(diagrama, arrasto.origem, arrasto.alvo.rungId, arrasto.alvo.celula)
          })()

          const previaAlcaAqui: PreviaAlca | null =
            previaAlca && previaAlca.rungId === rung.id
              ? {
                  ramoId: previaAlca.ramoId,
                  colunaInicio: previaAlca.colunaInicio,
                  colunaFim: previaAlca.colunaFim,
                  valido: previaAlca.valido,
                }
              : null

          return (
            <GradeDegrau
              key={rung.id}
              rung={rung}
              indice={indice}
              variaveis={diagrama.variaveis}
              marcado={marcado}
              ramoMarcado={ramoMarcado}
              aoClicarCelula={aoClicarCelula}
              aoDuploClicarCelula={aoDuploClicarCelula}
              aoTeclarNaCelula={aoTeclarNaCelula}
              aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiroCelula}
              aoPassarCelula={aoPassarCelula}
              previa={previaAqui}
              recusa={recusa && recusa.rungId === rung.id ? { celula: recusa.celula, motivo: recusa.motivo } : null}
              aoArrastarAlca={atualizarPreviaAlca}
              aoSoltarAlca={aplicarAlca}
              aoCancelarAlca={cancelarAlca}
              aoTeclarNaAlca={aoTeclarNaAlca}
              previaAlca={previaAlcaAqui}
              problemas={problemas?.filter((p) => p.rungId === rung.id)}
              aoInserirDegrauAbaixo={() => aoInserirDegrauAbaixoDe(rung.id)}
              aoRemoverDegrau={() => aoRemoverDegrauHandler(rung.id)}
              energizacao={simulacao?.energizacao[rung.id] ?? null}
              congelado={congelado}
            />
          )
        })}

        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={aoInserirDegrauNoFim}
            disabled={congelado}
            aria-label="Inserir degrau"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ide-borda bg-ide-elevado px-3 py-1.5 text-sm font-medium text-ide-texto outline-none hover:bg-ide-painel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus aria-hidden="true" size={16} />
            Inserir degrau
          </button>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {anuncio}
      </div>

      {arrasto && arrasto.via === 'ponteiro' && posGhost && tipoGhost && (
        <GhostArrasto tipo={tipoGhost} x={posGhost.x} y={posGhost.y} />
      )}

      {modalRemoverDegrau && (() => {
        const rung = diagrama.rungs.find((r) => r.id === modalRemoverDegrau.rungId)
        if (!rung) return null
        return (
          <ModalConfirmarRemocaoDegrau
            indiceDegrau={modalRemoverDegrau.indice}
            quantidadeElementos={rung.elementos.length}
            quantidadeRamos={rung.ramos.length}
            aoCancelar={() => setModalRemoverDegrau(null)}
            aoConfirmar={() => {
              const id = modalRemoverDegrau.rungId
              setModalRemoverDegrau(null)
              executarRemoverDegrau(id)
            }}
          />
        )
      })()}

      {modal && elementoDoModal && (
        <ModalVariavel
          elemento={elementoDoModal}
          variaveis={diagrama.variaveis}
          aoEscolher={aoEscolherNoModal}
          aoTrocarTipo={aoTrocarTipoNoModal}
          aoFechar={fecharModal}
          aoAlterarLimite={aoAlterarLimiteNoModal}
          aoCriarVariavel={aoCriarVariavelNoModal}
          pontosAmbiente={pontosAmbiente}
        />
      )}
    </div>
  )
}

/** Fantasma do elemento (ou item "Ramo", D-14) sendo arrastado por ponteiro,
 * seguindo o cursor (plano D-12). `fixed` e `pointer-events-none`: nunca
 * intercepta o próprio arrasto, e a posição vem direto do evento — sem
 * lógica de layout aqui. */
function GhostArrasto({ tipo, x, y }: { tipo: TipoPaleta | Elemento['tipo']; x: number; y: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 opacity-80"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {tipo === 'ramo' ? (
        <GitBranch className="text-ide-previa" />
      ) : tipo === 'ctu' ? (
        <span className="rounded border border-dashed border-ide-previa bg-ide-elevado px-2 py-1 font-mono text-xs text-ide-previa opacity-60">
          CTU
        </span>
      ) : (
        <svg width={40} height={32} viewBox="0 0 40 32">
          {tipo === 'contato_na' && <ContatoNA cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
          {tipo === 'contato_nf' && <ContatoNF cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
          {tipo === 'bobina' && <Bobina cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
          {tipo === 'bobina_set' && <BobinaSet cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
          {tipo === 'bobina_reset' && <BobinaReset cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
        </svg>
      )}
    </div>
  )
}
