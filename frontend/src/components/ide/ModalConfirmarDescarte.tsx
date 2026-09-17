/**
 * Modal de confirmação de descarte do projeto atual (spec 002, tarefa #26, frente M).
 *
 * Primeiro passo do fluxo "Novo projeto": só abre quando já há conteúdo no
 * projeto atual (decisão de quem monta este componente, fora deste arquivo).
 * Casca acessível (foco preso, Esc/overlay fecham) vem de `Modal`; aqui só o
 * texto de aviso e as duas ações — "Cancelar" recebe o foco inicial, porque
 * descartar é a ação menos provável e a de maior custo se escolhida sem querer.
 */
import { useRef } from 'react'

import Modal from './Modal'

export interface ModalConfirmarDescarteProps {
  /** Título do projeto atual, mostrado no aviso de que será substituído. */
  tituloProjeto: string
  aoConfirmar: () => void
  aoCancelar: () => void
}

export default function ModalConfirmarDescarte({ tituloProjeto, aoConfirmar, aoCancelar }: ModalConfirmarDescarteProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      titulo="Descartar projeto atual?"
      aoFechar={aoCancelar}
      focoInicialRef={cancelarRef}
      rodape={
        <>
          <button
            type="button"
            ref={cancelarRef}
            onClick={aoCancelar}
            className="rounded-lg border border-ide-borda px-3 py-1.5 text-sm text-ide-texto hover:bg-ide-elevado"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            className="rounded-lg border-2 border-ide-perigo bg-ide-perigo/10 px-3 py-1.5 text-sm font-medium text-ide-perigo hover:bg-ide-perigo/20"
          >
            Descartar e continuar
          </button>
        </>
      }
    >
      <p>
        <strong className="font-semibold">{tituloProjeto}</strong> será substituído. O conteúdo não salvo em outro
        lugar será perdido.
      </p>
    </Modal>
  )
}
