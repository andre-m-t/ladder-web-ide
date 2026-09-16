/**
 * Painel de erro da compilação (RF-4/RF-8).
 *
 * `ErroCompilacao` traz o envelope estruturado (Q-3): `stage`, `code`,
 * `message`, a lista de `diagnostics` e a saída bruta do compilador. Os
 * demais tipos de erro de `lib/api.ts` (`ErroHttpCompilacao`,
 * `ErroRedeCompilacao`) não têm envelope — o painel cai para uma mensagem
 * genérica nesses casos.
 */
import { ErroCompilacao, type ErroHttpCompilacao, type ErroRedeCompilacao } from '../lib/api'

interface PainelErroProps {
  erro: ErroCompilacao | ErroHttpCompilacao | ErroRedeCompilacao
}

export default function PainelErro({ erro }: PainelErroProps) {
  if (!(erro instanceof ErroCompilacao)) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Não foi possível compilar.</p>
        <p className="mt-1">{erro.message}</p>
      </div>
    )
  }

  const { envelope } = erro

  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-medium">
        Falha na compilação — etapa <code className="font-mono">{envelope.stage}</code> (
        <code className="font-mono">{envelope.code}</code>)
      </p>
      <p className="mt-1">{envelope.message}</p>

      {envelope.diagnostics.length > 0 && (
        <ul className="mt-3 space-y-1 rounded bg-white/60 p-2 font-mono text-xs">
          {envelope.diagnostics.map((diagnostico, indice) => (
            <li key={indice}>
              {diagnostico.line ?? '?'}:{diagnostico.column ?? '?'} — {diagnostico.message}
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-red-700">Saída bruta do compilador</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-800">
          {'stdout:\n'}
          {envelope.raw.stdout || '(vazio)'}
          {'\n\nstderr:\n'}
          {envelope.raw.stderr || '(vazio)'}
        </pre>
      </details>
    </div>
  )
}
