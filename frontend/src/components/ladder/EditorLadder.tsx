/**
 * Editor Ladder (spec 002; fatia 1 nas tarefas #7/#21; reescrito na #22,
 * plano `agora-precisamos-trabalhar-em-cozy-dragon.md`, D-12).
 *
 * **Reversão de D-4/R-2 pelo autor (2026-09-16, plano §12):** depois de usar
 * o editor por seleção de ferramenta (D-4/R-2), o autor rejeitou o modelo —
 * elementos pareciam botões, a ferramenta ativa e a seleção persistente
 * atrapalhavam. Este arquivo passa a implementar **só arrastar-e-soltar**:
 * não existe mais `Ferramenta` nem "ferramenta ativa"; a paleta oferece peças
 * arrastáveis (`Paleta.tsx`) que vão para a grade (`GradeDegrau.tsx`) por
 * Pointer Events (mouse/toque) ou pela mesma máquina de estado por teclado
 * (Espaço pega, setas movem o alvo, Espaço/Enter solta, Esc cancela). Clique
 * simples marca um elemento (sem painel); duplo clique ou Enter abre
 * `ModalVariavel` para vincular variável; Delete/Backspace ou a lixeira
 * removem. `TabelaVariaveis` fica ao lado da grade — não há mais vínculo de
 * variável por lá, só declarar/editar/remover.
 *
 * Continua orquestrando o núcleo puro (`ladder/edicao.ts`): todo estado novo
 * do diagrama vem de uma operação do núcleo, nunca de um cálculo local, e
 * toda prévia (D-11) é a própria operação do núcleo chamada sem aplicar —
 * o que a prévia promete é exatamente o que soltar fará.
 *
 * Sem lista de problemas nesta fatia (entra na tarefa #13): `validarDiagrama`
 * não é chamado aqui.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

import {
  declararVariavel,
  diagramaVazio,
  inserirElemento,
  moverElemento,
  removerElemento,
  removerVariavel,
  atualizarVariavel,
  vincularVariavel,
} from '../../ladder/edicao'
import type { ResultadoEdicao } from '../../ladder/edicao'
import { COLUNAS_POR_DEGRAU, type Celula, type Diagrama, type Elemento } from '../../ladder/modelo'
import { descreverCelula } from '../../ladder/validacao'
import GradeDegrau, { type Previa } from './GradeDegrau'
import ModalVariavel from './ModalVariavel'
import Paleta, { type TipoPaleta } from './Paleta'
import { Bobina, ContatoNA, ContatoNF } from './Simbolos'
import TabelaVariaveis from './TabelaVariaveis'

export interface EditorLadderProps {
  /** Diagrama de partida; por padrão, um degrau vazio (`diagramaVazio()`). */
  diagramaInicial?: Diagrama
  /** Chamado a cada mudança bem-sucedida do diagrama (persistência é a tarefa #12). */
  aoMudar?: (diagrama: Diagrama) => void
}

/** Recusa de uma jogada sobre célula, localizada no degrau e na célula afetados. */
interface RecusaCelula {
  rungId: string
  celula: Celula
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

const NOME_TIPO: Record<Elemento['tipo'], string> = {
  contato_na: 'contato NA',
  contato_nf: 'contato NF',
  bobina: 'bobina',
  bobina_set: 'bobina SET',
  bobina_reset: 'bobina RESET',
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

/** Nome de exibição da origem do arrasto, para o anúncio de `aria-live`. */
function nomeOrigem(diagrama: Diagrama, origem: OrigemArrasto): string {
  if (origem.de === 'paleta') return NOME_TIPO[origem.tipo]
  const achado = encontrarElementoPorId(diagrama, origem.elementoId)
  return achado ? NOME_TIPO[achado.elemento.tipo] : 'elemento'
}

/** Prévia da jogada do arrasto sobre `celula`, calculada chamando o núcleo
 * sem aplicar (D-11): origem paleta → `inserirElemento`; origem célula →
 * `moverElemento`. Nenhuma regra de posição é reimplementada aqui. */
function calcularPreviaArrasto(diagrama: Diagrama, origem: OrigemArrasto, rungId: string, celula: Celula): Previa {
  if (origem.de === 'paleta') {
    const resultado = inserirElemento(diagrama, rungId, origem.tipo, celula)
    if (resultado.ok) return { celula, tipo: 'inserir', elemento: origem.tipo }
    return { celula, tipo: 'invalida', motivo: resultado.motivo }
  }
  const resultado = moverElemento(diagrama, origem.elementoId, rungId, celula)
  if (resultado.ok) {
    const achado = encontrarElementoPorId(diagrama, origem.elementoId)
    return { celula, tipo: 'inserir', elemento: achado?.elemento.tipo ?? 'contato_na' }
  }
  return { celula, tipo: 'invalida', motivo: resultado.motivo }
}

/** Mensagem do `aria-live` para o alvo atual do arrasto. */
function mensagemAlvo(diagrama: Diagrama, origem: OrigemArrasto, alvo: AlvoArrasto): string {
  if (alvo === null) return 'fora de qualquer posição válida'
  if (alvo === 'lixeira') return 'sobre a lixeira — soltar remove o elemento'
  const indiceDegrau = diagrama.rungs.findIndex((r) => r.id === alvo.rungId)
  const onde = descreverCelula(indiceDegrau, alvo.celula)
  const previa = calcularPreviaArrasto(diagrama, origem, alvo.rungId, alvo.celula)
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

export default function EditorLadder({ diagramaInicial, aoMudar }: EditorLadderProps = {}) {
  const [diagrama, setDiagrama] = useState<Diagrama>(diagramaInicial ?? diagramaVazio())
  const [marcado, setMarcado] = useState<string | null>(null)
  const [modal, setModal] = useState<{ elementoId: string } | null>(null)
  const [arrasto, setArrasto] = useState<EstadoArrasto | null>(null)
  const [posGhost, setPosGhost] = useState<{ x: number; y: number } | null>(null)
  const [recusa, setRecusa] = useState<RecusaCelula | null>(null)
  const [erroTabela, setErroTabela] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')

  const containerRef = useRef<HTMLDivElement | null>(null)
  const diagramaRef = useRef(diagrama)
  const arrastoRef = useRef<EstadoArrasto | null>(null)
  const aoMudarRef = useRef(aoMudar)
  const pointerPendenteRef = useRef<PointerPendente | null>(null)

  useEffect(() => {
    diagramaRef.current = diagrama
  }, [diagrama])
  useEffect(() => {
    aoMudarRef.current = aoMudar
  }, [aoMudar])

  function atualizarArrasto(novo: EstadoArrasto | null) {
    arrastoRef.current = novo
    setArrasto(novo)
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

  /** Conclui um arrasto (ponteiro ou teclado): aplica a operação do núcleo
   * correspondente à origem/alvo, ou cancela silenciosamente quando não há
   * nada a fazer (alvo nulo, ou paleta solta na lixeira). Nunca lê estado
   * React diretamente — só `diagramaRef`/`aoMudarRef` — porque também é
   * chamado de dentro do listener de `pointerup` em `window`, registrado uma
   * única vez no mount. */
  function finalizarDrop(origem: OrigemArrasto, alvo: AlvoArrasto) {
    setMarcado(null)

    if (alvo === null) {
      setAnuncio('arrasto cancelado')
      return
    }

    if (alvo === 'lixeira') {
      if (origem.de === 'paleta') {
        setAnuncio('arrasto cancelado')
        return
      }
      const resultado = removerElemento(diagramaRef.current, origem.elementoId)
      if (resultado.ok) {
        setDiagrama(resultado.diagrama)
        aoMudarRef.current?.(resultado.diagrama)
        setAnuncio('elemento removido')
      }
      return
    }

    const indiceDegrau = diagramaRef.current.rungs.findIndex((r) => r.id === alvo.rungId)
    const onde = descreverCelula(indiceDegrau, alvo.celula)

    if (origem.de === 'paleta') {
      const resultado: ResultadoEdicao = inserirElemento(diagramaRef.current, alvo.rungId, origem.tipo, alvo.celula)
      if (!resultado.ok) {
        setRecusa({ rungId: alvo.rungId, celula: alvo.celula, motivo: resultado.motivo })
        setAnuncio(`recusado: ${resultado.motivo}`)
        return
      }
      setRecusa(null)
      setDiagrama(resultado.diagrama)
      aoMudarRef.current?.(resultado.diagrama)
      setAnuncio(`solto em ${onde}`)
      const novoElemento = elementoNaCelula(resultado.diagrama, alvo.rungId, alvo.celula)
      if (novoElemento) setModal({ elementoId: novoElemento.id })
      return
    }

    const resultado = moverElemento(diagramaRef.current, origem.elementoId, alvo.rungId, alvo.celula)
    if (!resultado.ok) {
      setRecusa({ rungId: alvo.rungId, celula: alvo.celula, motivo: resultado.motivo })
      setAnuncio(`recusado: ${resultado.motivo}`)
      return
    }
    setRecusa(null)
    setDiagrama(resultado.diagrama)
    aoMudarRef.current?.(resultado.diagrama)
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
    armarPonteiro({ de: 'paleta', tipo }, evento)
  }

  function aoIniciarArrastoPonteiroCelula(evento: ReactPointerEvent<SVGGElement>, rungId: string, celula: Celula) {
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    if (!elemento) return
    armarPonteiro({ de: 'celula', elementoId: elemento.id }, evento)
  }

  function iniciarArrastoTeclado(origem: OrigemArrasto) {
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

  function removerMarcado() {
    if (marcado === null) return
    const resultado = removerElemento(diagrama, marcado)
    if (resultado.ok) {
      setDiagrama(resultado.diagrama)
      aoMudar?.(resultado.diagrama)
      setMarcado(null)
    }
  }

  // Um arrasto que se movimenta o bastante para contar como arrasto (>4px)
  // normalmente não deixa o alvo sob o ponteiro no fim do gesto, então o
  // "clique fantasma" que alguns navegadores sintetizam depois do
  // `pointerup` raramente chega até aqui; quando chega, marcar de novo o
  // mesmo elemento é inofensivo (idempotente).
  function aoClicarCelula(rungId: string, celula: Celula) {
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    setMarcado(elemento ? elemento.id : null)
  }

  function aoDuploClicarCelula(rungId: string, celula: Celula) {
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    if (elemento) setModal({ elementoId: elemento.id })
  }

  function aoTeclarNaCelula(evento: ReactKeyboardEvent<SVGGElement>, rungId: string, celula: Celula) {
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
        setModal({ elementoId: elemento.id })
      }
      return
    }
    if ((evento.key === 'Delete' || evento.key === 'Backspace') && marcado) {
      evento.preventDefault()
      evento.stopPropagation()
      removerMarcado()
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
    if (!modal) return
    const resultado = vincularVariavel(diagrama, modal.elementoId, nome)
    if (resultado.ok) {
      setDiagrama(resultado.diagrama)
      aoMudar?.(resultado.diagrama)
    } else {
      setErroTabela(resultado.motivo)
    }
    fecharModal()
  }

  function aplicarResultadoTabela(resultado: ResultadoEdicao) {
    if (!resultado.ok) {
      setErroTabela(resultado.motivo)
      return
    }
    setDiagrama(resultado.diagrama)
    setErroTabela(null)
    aoMudar?.(resultado.diagrama)
  }

  function aoDeclarar(variavel: { nome: string; endereco?: string }) {
    aplicarResultadoTabela(declararVariavel(diagrama, variavel))
  }

  function aoAtualizar(nomeAtual: string, nova: { nome: string; endereco?: string }) {
    aplicarResultadoTabela(atualizarVariavel(diagrama, nomeAtual, nova))
  }

  function aoRemoverVariavel(nome: string) {
    aplicarResultadoTabela(removerVariavel(diagrama, nome))
  }

  /** Clique fora de qualquer célula da grade desmarca (plano D-12) — não
   * interfere com o modal (que tem sua própria camada por cima). */
  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (modal !== null) return
      const alvo = evento.target
      // A lixeira também age sobre o elemento marcado (plano D-12) — clicar
      // nela não é "clicar fora da grade", é uma ação sobre a marcação.
      if (alvo instanceof Element && (alvo.closest('[data-celula]') || alvo.closest('[data-lixeira]'))) return
      setMarcado(null)
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
    setErroTabela(null)
    setMarcado(null)
  }

  const elementoDoModal = modal ? elementoPorId(diagrama, modal.elementoId) : null
  const tipoGhost: Elemento['tipo'] | null =
    arrasto === null ? null : arrasto.origem.de === 'paleta' ? arrasto.origem.tipo : encontrarElementoPorId(diagrama, arrasto.origem.elementoId)?.elemento.tipo ?? null

  return (
    <div ref={containerRef} onKeyDown={aoTeclarNoContainer}>
      <Paleta
        marcado={marcado !== null}
        emArrasto={arrasto !== null}
        sobreLixeira={arrasto !== null && arrasto.alvo === 'lixeira'}
        aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiroPaleta}
        aoIniciarArrastoTeclado={(tipo) => iniciarArrastoTeclado({ de: 'paleta', tipo })}
        aoPassarLixeira={aoPassarLixeira}
        aoAcionarLixeira={aoAcionarLixeira}
        aoTeclarNaLixeira={aoTeclarNaLixeira}
      />

      <div className="mt-4 lg:grid lg:grid-cols-[auto_28rem] lg:items-start lg:gap-6">
        <div>
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

            return (
              <GradeDegrau
                key={rung.id}
                rung={rung}
                indice={indice}
                marcado={marcado}
                aoClicarCelula={aoClicarCelula}
                aoDuploClicarCelula={aoDuploClicarCelula}
                aoTeclarNaCelula={aoTeclarNaCelula}
                aoIniciarArrastoPonteiro={aoIniciarArrastoPonteiroCelula}
                aoPassarCelula={aoPassarCelula}
                previa={previaAqui}
                recusa={recusa && recusa.rungId === rung.id ? { celula: recusa.celula, motivo: recusa.motivo } : null}
              />
            )
          })}
        </div>

        <div className="mt-4 lg:mt-0">
          <TabelaVariaveis
            variaveis={diagrama.variaveis}
            aoDeclarar={aoDeclarar}
            aoAtualizar={aoAtualizar}
            aoRemover={aoRemoverVariavel}
            erro={erroTabela}
          />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {anuncio}
      </div>

      {arrasto && arrasto.via === 'ponteiro' && posGhost && tipoGhost && (
        <GhostArrasto tipo={tipoGhost} x={posGhost.x} y={posGhost.y} />
      )}

      {modal && elementoDoModal && (
        <ModalVariavel elemento={elementoDoModal} variaveis={diagrama.variaveis} aoEscolher={aoEscolherNoModal} aoFechar={fecharModal} />
      )}
    </div>
  )
}

/** Fantasma do elemento sendo arrastado por ponteiro, seguindo o cursor
 * (plano D-12). `fixed` e `pointer-events-none`: nunca intercepta o próprio
 * arrasto, e a posição vem direto do evento — sem lógica de layout aqui. */
function GhostArrasto({ tipo, x, y }: { tipo: Elemento['tipo']; x: number; y: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 opacity-80"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <svg width={40} height={32} viewBox="0 0 40 32">
        {tipo === 'contato_na' && <ContatoNA cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
        {tipo === 'contato_nf' && <ContatoNF cx={20} cy={16} variavel={null} selecionado={false} fantasma />}
        {(tipo === 'bobina' || tipo === 'bobina_set' || tipo === 'bobina_reset') && (
          <Bobina cx={20} cy={16} variavel={null} selecionado={false} fantasma />
        )}
      </svg>
    </div>
  )
}
