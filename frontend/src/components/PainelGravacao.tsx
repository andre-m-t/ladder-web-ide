/** Progresso e resultado da gravação no ESP32 pelo navegador (RF-6). */
import type { ErroGravacao } from '../lib/gravador'

export type EstadoGravacao =
  | { fase: 'ocioso' }
  | { fase: 'gravando'; progresso: number }
  | { fase: 'sucesso' }
  | { fase: 'erro'; erro: ErroGravacao }

export default function PainelGravacao({ estado }: { estado: EstadoGravacao }) {
  if (estado.fase === 'ocioso') return null

  if (estado.fase === 'gravando') {
    const progresso = Math.round(estado.progresso)
    return (
      <div className="mt-4" role="status">
        <p className="text-sm text-slate-600">Gravando no ESP32… {progresso}%</p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-sky-600 transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>
    )
  }

  if (estado.fase === 'sucesso') {
    return (
      <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
        Firmware gravado com sucesso. O ESP32 deve reiniciar executando a lógica.
      </p>
    )
  }

  return (
    <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-medium">Falha na gravação.</p>
      <p className="mt-1">{estado.erro.message}</p>
    </div>
  )
}
