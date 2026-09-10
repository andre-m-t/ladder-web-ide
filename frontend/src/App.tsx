import { useEffect, useState } from 'react'

import { fetchHealth } from './lib/api'
import type { Health } from './lib/api'

type State =
  | { kind: 'carregando' }
  | { kind: 'ok'; health: Health }
  | { kind: 'erro'; message: string }

/**
 * Página placeholder do boilerplate.
 *
 * Serve como verificação de ponta a ponta do ambiente: se o status aparece
 * aqui, então o front-end, o CORS, a rede do Docker Compose, a API e o
 * compilador MATIEC estão todos operacionais. O editor Ladder, o simulador e a
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
            <dl className="space-y-3 text-sm">
              <Linha rotulo="Backend" valor={state.health.status} ok={state.health.status === 'ok'} />
              <Linha
                rotulo="Compilador MATIEC (iec2c)"
                valor={state.health.iec2c.available ? 'disponível' : 'indisponível'}
                ok={state.health.iec2c.available}
              />
              <div>
                <dt className="text-slate-500">Caminho do binário</dt>
                <dd className="font-mono text-xs break-all">{state.health.iec2c.path}</dd>
              </div>
              {state.health.iec2c.version && (
                <div>
                  <dt className="text-slate-500">Identificação</dt>
                  <dd className="font-mono text-xs break-all">{state.health.iec2c.version}</dd>
                </div>
              )}
            </dl>
          )}
        </section>
      </div>
    </main>
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
