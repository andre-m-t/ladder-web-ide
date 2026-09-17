/**
 * Casca de modal genérica da IDE (spec 002, tarefa #26, frente M).
 *
 * Mesmo padrão sem dependência de `ModalVariavel` (frente D1, `components/ladder/`):
 * `role="dialog"` + `aria-modal` + `aria-labelledby`, foco preso com Tab/Shift+Tab
 * calculado a cada tecla, Esc e clique no overlay fecham, clique dentro do
 * diálogo não propaga. Portal não é necessário — o `z-50` já garante a
 * sobreposição sobre o resto da IDE.
 *
 * Só a casca: título, corpo (`children`) e rodapé (`rodape`, tipicamente os
 * botões de ação) ficam a cargo de quem monta. `focoInicialRef` permite ao
 * chamador escolher o elemento que recebe foco ao abrir (ex.: o botão
 * "Cancelar" num modal de confirmação); sem ele, foca o primeiro elemento
 * focável do diálogo.
 *
 * Tokens só (`bg-ide-painel`/`border-ide-borda`/`text-ide-*`), tema claro e
 * escuro; overlay `bg-black/60`, independente de tema.
 */
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'

export interface ModalProps {
  titulo: string
  aoFechar: () => void
  children: ReactNode
  rodape: ReactNode
  /** Elemento a focar ao abrir; sem ele, foca o primeiro focável do diálogo. */
  focoInicialRef?: RefObject<HTMLElement | null>
}

/** Seletor de elementos focáveis dentro do diálogo (botões, campos, cartões
 * de radiogroup com `tabIndex`), excluindo desabilitados e os fora da
 * sequência de Tab (`tabindex="-1"`, ex.: opção de radiogroup não selecionada). */
const SELETOR_FOCAVEL =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'

export default function Modal({ titulo, aoFechar, children, rodape, focoInicialRef }: ModalProps) {
  const idTitulo = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = dialogRef.current
    if (!container) return

    const alvo = focoInicialRef?.current ?? container.querySelector<HTMLElement>(SELETOR_FOCAVEL)
    alvo?.focus()
    // Só na montagem: o alvo de foco inicial não muda depois de aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function focaveis(): HTMLElement[] {
    const container = dialogRef.current
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL))
  }

  function aoTeclarNoDialogo(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      aoFechar()
      return
    }
    if (evento.key !== 'Tab') return

    const lista = focaveis()
    if (lista.length === 0) return
    const primeiro = lista[0]
    const ultimo = lista[lista.length - 1]

    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primeiro.focus()
    }
  }

  function aoClicarOverlay() {
    aoFechar()
  }

  function aoClicarDialogo(evento: MouseEvent<HTMLDivElement>) {
    evento.stopPropagation()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={aoClicarOverlay}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={aoClicarDialogo}
        onKeyDown={aoTeclarNoDialogo}
        className="flex w-full max-w-md flex-col rounded-lg border border-ide-borda bg-ide-painel shadow-lg"
      >
        <header className="border-b border-ide-borda px-4 py-3">
          <h2 id={idTitulo} className="text-sm font-semibold text-ide-texto">
            {titulo}
          </h2>
        </header>

        <div className="px-4 py-4 text-sm text-ide-texto">{children}</div>

        <footer className="flex justify-end gap-2 border-t border-ide-borda px-4 py-3">{rodape}</footer>
      </div>
    </div>
  )
}
