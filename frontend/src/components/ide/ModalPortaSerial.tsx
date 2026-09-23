/**
 * Modal de seleção de porta serial antes da gravação (spec 001, revisão 2026-09-23).
 */
import { useCallback, useEffect, useState } from 'react'
import { Cable } from 'lucide-react'

import type { PortaLike } from '../../lib/gravador'
import {
  idPorta,
  listarPortas,
  mesmaPorta,
  observarPortas,
  rotuloPorta,
  solicitarPorta,
  type SerialGerenciadorLike,
} from '../../lib/portasSeriais'
import Modal from './Modal'

export interface ModalPortaSerialProps {
  aoConfirmar: (porta: PortaLike) => void
  aoCancelar: () => void
  /** Substitui `navigator.serial` nos testes. */
  serial?: SerialGerenciadorLike
}

function serialPadrao(): SerialGerenciadorLike | undefined {
  if (typeof navigator === 'undefined' || !('serial' in navigator)) return undefined
  return navigator.serial as SerialGerenciadorLike
}

export default function ModalPortaSerial({ aoConfirmar, aoCancelar, serial: serialProp }: ModalPortaSerialProps) {
  const serial = serialProp ?? serialPadrao()
  const [portas, setPortas] = useState<PortaLike[]>([])
  const [selecionada, setSelecionada] = useState<PortaLike | null>(null)

  const recarregar = useCallback(async () => {
    if (!serial) {
      setPortas([])
      setSelecionada(null)
      return
    }
    const lista = await listarPortas(serial)
    setPortas(lista)
    setSelecionada((atual) => {
      if (atual && lista.some((p) => mesmaPorta(p, atual))) return atual
      return lista[0] ?? null
    })
  }, [serial])

  useEffect(() => {
    void recarregar()
    if (!serial) return
    return observarPortas(serial, () => {
      void recarregar()
    })
  }, [serial, recarregar])

  async function aoAdicionarPorta() {
    if (!serial) return
    const nova = await solicitarPorta(serial)
    if (!nova) return
    const lista = await listarPortas(serial)
    setPortas(lista.length > 0 ? lista : [nova])
    setSelecionada(nova)
  }

  const podeGravar = selecionada != null

  return (
    <Modal
      titulo="Porta serial do ESP32"
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
            onClick={() => void aoAdicionarPorta()}
            disabled={!serial}
            className="rounded-lg border border-ide-borda px-3 py-1.5 text-sm text-ide-texto hover:bg-ide-elevado disabled:opacity-50"
          >
            Adicionar porta…
          </button>
          <button
            type="button"
            disabled={!podeGravar}
            onClick={() => selecionada && aoConfirmar(selecionada)}
            className="rounded-lg bg-ide-destaque px-3 py-1.5 text-sm font-medium text-ide-destaque-texto shadow-sm disabled:opacity-50"
          >
            Gravar
          </button>
        </>
      }
    >
      <p className="mb-3 text-ide-suave">
        Conecte o ESP32 pelo USB e escolha a porta para gravar o firmware.
      </p>
      {portas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ide-borda px-3 py-4 text-sm text-ide-suave">
          <p>Nenhuma porta autorizada ainda.</p>
          <p className="mt-2">
            Clique em <strong className="font-medium text-ide-texto">Adicionar porta…</strong> e selecione o dispositivo no
            diálogo do navegador (o nome do sistema, como COM3 ou /dev/ttyUSB0, aparece só ali).
          </p>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Porta serial" className="flex flex-col gap-2">
          {portas.map((porta) => {
            const ativo = selecionada != null && mesmaPorta(porta, selecionada)
            const chave = idPorta(porta)
            return (
              <div
                key={chave}
                role="radio"
                aria-checked={ativo}
                tabIndex={ativo ? 0 : -1}
                onClick={() => setSelecionada(porta)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelecionada(porta)
                  }
                }}
                className={
                  ativo
                    ? 'flex cursor-pointer items-start gap-3 rounded-lg border-2 border-ide-destaque bg-ide-elevado p-3'
                    : 'flex cursor-pointer items-start gap-3 rounded-lg border border-ide-borda p-3 hover:bg-ide-elevado'
                }
              >
                <Cable aria-hidden size={22} className="mt-0.5 shrink-0 text-ide-texto" />
                <div>
                  <span className="text-sm font-medium text-ide-texto">{rotuloPorta(porta)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
