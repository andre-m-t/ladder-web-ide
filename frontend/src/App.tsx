import { useEffect, useState } from 'react'

import { fetchHealth } from './lib/api'
import type { Health, ToolInfo } from './lib/api'

type State =
  | { kind: 'carregando' }
  | { kind: 'ok'; health: Health }
  | { kind: 'erro'; message: string }

/**
 * Página placeholder do boilerplate.
 *
 * Serve como verificação de ponta a ponta do ambiente: se o status aparece
 * aqui, então o front-end, o CORS, a rede do Docker Compose, a API e as duas
 * etapas de compilação (MATIEC e toolchain ESP32) estão todos operacionais. O editor Ladder, o simulador e a
 * gravação virão nas specs seguintes.
 */
export default function App() {
  const [state, setState] = useState<State>({ kind: 'carregando' })

  useEffect(() => {
    let cancelado = false

    fetchHealth()
      .then((health) => {
        if (!cancelado) setState({ kind: 'ok', health })
      })
      .catch((erro: unknown) => {
        if (!cancelado) {
          setState({ kind: 'erro', message: erro instanceof Error ? erro.message : String(erro) })
        }
      })

    return () => {
      cancelado = true
    }
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">LadderFlow</h1>
        <p className="mt-2 text-slate-600">
          Ambiente de desenvolvimento — verificação do serviço de compilação.
        </p>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {state.kind === 'carregando' && <p className="text-slate-500">Consultando a API…</p>}

          {state.kind === 'erro' && (
            <div>
              <p className="font-medium text-red-700">Não foi possível falar com a API.</p>
              <p className="mt-1 text-sm text-slate-600">{state.message}</p>
              <p className="mt-3 text-sm text-slate-500">
                Verifique se o serviço <code className="font-mono">backend</code> está de pé e se{' '}
                <code className="font-mono">VITE_API_URL</code> aponta para ele.
              </p>
            </div>
          )}

          {state.kind === 'ok' && (
            <dl className="space-y-6 text-sm">
              <Linha rotulo="Backend" valor={state.health.status} ok={state.health.status === 'ok'} />
              <Ferramenta
                rotulo="Structured Text → C (MATIEC)"
                info={state.health.iec2c}
              />
              <Ferramenta
                rotulo="C → firmware (toolchain ESP32)"
                info={state.health.esp_idf}
              />
            </dl>
          )}
        </section>
      </div>
    </main>
  )
}

function Ferramenta({ rotulo, info }: { rotulo: string; info: ToolInfo }) {
  return (
    <div className="space-y-3">
      <Linha
        rotulo={rotulo}
        valor={info.available ? 'disponível' : 'indisponível'}
        ok={info.available}
      />
      <div>
        <dt className="text-slate-500">Caminho</dt>
        <dd className="font-mono text-xs break-all">{info.path}</dd>
      </div>
      {info.version && (
        <div>
          <dt className="text-slate-500">Identificação</dt>
          <dd className="font-mono text-xs break-all">{info.version}</dd>
        </div>
      )}
    </div>
  )
}

function Linha({ rotulo, valor, ok }: { rotulo: string; valor: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd
        className={
          ok
            ? 'rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700'
            : 'rounded-full bg-red-50 px-3 py-1 font-medium text-red-700'
        }
      >
        {valor}
      </dd>
    </div>
  )
}
