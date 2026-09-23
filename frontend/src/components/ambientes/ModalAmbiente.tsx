/**
 * Modal de escolha do ambiente de simulação (spec 005, revisão 2026-09-21).
 */
import { useState } from 'react'
import { Warehouse } from 'lucide-react'

import { CATALOGO_AMBIENTES } from '../../ambientes/catalogo'
import Modal from '../ide/Modal'

export interface ModalAmbienteProps {
  aoConfirmar: (ambienteId: string) => void
  aoCancelar: () => void
}

export default function ModalAmbiente({ aoConfirmar, aoCancelar }: ModalAmbienteProps) {
  const [selecionado, setSelecionado] = useState(CATALOGO_AMBIENTES[0]?.id ?? 'portao')

  return (
    <Modal
      titulo="Ambiente de simulação"
      aoFechar={aoCancelar}
      rodape={
        <>
          <button
            type="button"
            onClick={aoCancelar}
            className="rounded-lg border border-ide-borda px-3 py-1.5 text-sm text-ide-texto hover:bg-ide-elevado"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => aoConfirmar(selecionado)}
            className="rounded-lg bg-ide-destaque px-3 py-1.5 text-sm font-medium text-ide-destaque-texto shadow-sm"
          >
            Abrir ambiente
          </button>
        </>
      }
    >
      <p className="mb-3 text-ide-suave">Escolha o processo que será acoplado ao ciclo de varredura.</p>
      <div role="radiogroup" aria-label="Ambiente" className="flex flex-col gap-2">
        {CATALOGO_AMBIENTES.map((amb) => {
          const ativo = amb.id === selecionado
          return (
            <div
              key={amb.id}
              role="radio"
              aria-checked={ativo}
              tabIndex={ativo ? 0 : -1}
              onClick={() => setSelecionado(amb.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelecionado(amb.id)
                }
              }}
              className={
                ativo
                  ? 'flex cursor-pointer items-start gap-3 rounded-lg border-2 border-ide-destaque bg-ide-elevado p-3'
                  : 'flex cursor-pointer items-start gap-3 rounded-lg border border-ide-borda p-3 hover:bg-ide-elevado'
              }
            >
              <Warehouse aria-hidden size={24} className="mt-0.5 shrink-0 text-ide-texto" />
              <div>
                <span className="text-sm font-medium text-ide-texto">{amb.nome}</span>
                <p className="mt-0.5 text-xs text-ide-suave">{amb.descricao}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
