/**
 * Divisor arrastável entre painéis da IDE (spec 002, plano D-13): usado tanto
 * para redimensionar o painel de variáveis (`orientacao="vertical"`) quanto o
 * console (`orientacao="horizontal"`). Sem dependência: `role="separator"`
 * focável, arrasto por Pointer Events e ajuste fino por teclado.
 *
 * Convenção geométrica (única, para as duas orientações): o painel
 * redimensionado fica do lado do divisor mais distante da origem da tela —
 * à direita dele quando vertical (painel lateral), abaixo dele quando
 * horizontal (console). Arrastar o divisor em direção à origem (esquerda ou
 * cima) sempre AUMENTA o tamanho do painel; a mesma fórmula
 * (`valorInicial - delta`) serve as duas orientações. No teclado, "aumenta"
 * é ArrowLeft (vertical) ou ArrowUp (horizontal) — a tecla que aponta para a
 * mesma direção do arrasto que aumenta.
 *
 * `preventDefault()` no `pointerdown` e `select-none`/`touch-none` são a
 * mesma lição da tarefa #22 (`EditorLadder.tsx`): sem isso, o Chromium pode
 * iniciar uma seleção de texto/drag nativo no meio do arrasto e cancelar o
 * ponteiro.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

export interface DivisorProps {
  orientacao: 'vertical' | 'horizontal'
  /** Tamanho atual do painel controlado por este divisor (largura ou altura, em px). */
  valor: number
  min: number
  max: number
  aoMudar: (novoValor: number) => void
  /** `aria-label` do separador — descreve o que ele redimensiona. */
  rotulo: string
  /** Incremento por tecla de seta, em px. */
  passo?: number
}

const PASSO_PADRAO = 16

interface ArrastoEmCurso {
  pointerId: number
  inicio: number
  valorInicial: number
}

export default function Divisor({ orientacao, valor, min, max, aoMudar, rotulo, passo = PASSO_PADRAO }: DivisorProps) {
  const arrastoRef = useRef<ArrastoEmCurso | null>(null)

  function limitar(v: number): number {
    return Math.min(max, Math.max(min, v))
  }

  function coordenada(evento: { clientX: number; clientY: number }): number {
    return orientacao === 'vertical' ? evento.clientX : evento.clientY
  }

  function aoIniciarPonteiro(evento: PointerEvent<HTMLDivElement>) {
    evento.preventDefault()
    try {
      window.getSelection?.()?.removeAllRanges()
    } catch {
      // ambiente sem seleção de texto (ex.: jsdom) — sem efeito prático.
    }
    arrastoRef.current = { pointerId: evento.pointerId, inicio: coordenada(evento), valorInicial: valor }
    try {
      ;(evento.currentTarget as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
        evento.pointerId,
      )
    } catch {
      // captura de ponteiro indisponível (ex.: jsdom) — o arrasto continua funcionando enquanto o ponteiro estiver sobre o divisor.
    }
  }

  function aoMoverPonteiro(evento: PointerEvent<HTMLDivElement>) {
    const arrasto = arrastoRef.current
    if (!arrasto || evento.pointerId !== arrasto.pointerId) return
    const delta = coordenada(evento) - arrasto.inicio
    aoMudar(limitar(arrasto.valorInicial - delta))
  }

  function aoSoltarPonteiro(evento: PointerEvent<HTMLDivElement>) {
    if (arrastoRef.current?.pointerId !== evento.pointerId) return
    arrastoRef.current = null
    try {
      ;(evento.currentTarget as Element & { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
        evento.pointerId,
      )
    } catch {
      // idem — sem efeito prático quando a captura nunca existiu.
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const teclaAumenta = orientacao === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
    const teclaDiminui = orientacao === 'vertical' ? 'ArrowRight' : 'ArrowDown'
    if (evento.key === teclaAumenta) {
      evento.preventDefault()
      aoMudar(limitar(valor + passo))
    } else if (evento.key === teclaDiminui) {
      evento.preventDefault()
      aoMudar(limitar(valor - passo))
    }
  }

  return (
    <div
      role="separator"
      aria-label={rotulo}
      aria-orientation={orientacao}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(valor)}
      tabIndex={0}
      onPointerDown={aoIniciarPonteiro}
      onPointerMove={aoMoverPonteiro}
      onPointerUp={aoSoltarPonteiro}
      onPointerCancel={aoSoltarPonteiro}
      onKeyDown={aoTeclar}
      className={
        orientacao === 'vertical'
          ? 'w-1.5 shrink-0 cursor-col-resize touch-none select-none bg-ide-borda outline-none hover:bg-ide-destaque focus-visible:bg-ide-destaque'
          : 'h-1.5 shrink-0 cursor-row-resize touch-none select-none bg-ide-borda outline-none hover:bg-ide-destaque focus-visible:bg-ide-destaque'
      }
    />
  )
}
