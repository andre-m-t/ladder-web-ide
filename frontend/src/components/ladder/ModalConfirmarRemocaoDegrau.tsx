import { useRef } from 'react'

import Modal from '../ide/Modal'

export interface ModalConfirmarRemocaoDegrauProps {
  indiceDegrau: number
  quantidadeElementos: number
  quantidadeRamos: number
  aoConfirmar: () => void
  aoCancelar: () => void
}

export default function ModalConfirmarRemocaoDegrau({
  indiceDegrau,
  quantidadeElementos,
  quantidadeRamos,
  aoConfirmar,
  aoCancelar,
}: ModalConfirmarRemocaoDegrauProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const partes: string[] = []
  if (quantidadeElementos > 0) partes.push(`${quantidadeElementos} elemento${quantidadeElementos === 1 ? '' : 's'}`)
  if (quantidadeRamos > 0) partes.push(`${quantidadeRamos} ramo${quantidadeRamos === 1 ? '' : 's'}`)
  const detalhe = partes.length > 0 ? ` e ${partes.join(' e ')}` : ''

  return (
    <Modal
      titulo="Remover degrau?"
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
            Remover
          </button>
        </>
      }
    >
      <p>
        Remover o degrau {indiceDegrau + 1}{detalhe}? Esta ação não pode ser desfeita além de Desfazer.
      </p>
    </Modal>
  )
}
