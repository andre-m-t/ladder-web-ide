import { useEffect, useState } from 'react'

import EditorST from './components/EditorST'
import PainelErro from './components/PainelErro'
import PainelGravacao, { type EstadoGravacao } from './components/PainelGravacao'
import {
  compilarPacote,
  ErroCompilacao,
  ErroHttpCompilacao,
  ErroRedeCompilacao,
  fetchHealth,
  type Health,
  type Pacote,
  type ToolInfo,
} from './lib/api'
import { BLINK_ST } from './lib/exemplos'
import { ErroGravacao, gravar, webSerialDisponivel } from './lib/gravador'

type ErroDeCompilacao = ErroCompilacao | ErroHttpCompilacao | ErroRedeCompilacao

type EstadoCompilacao =
  | { fase: 'ocioso' }
  | { fase: 'compilando' }
  | { fase: 'sucesso'; pacote: Pacote }
  | { fase: 'erro'; erro: ErroDeCompilacao }

type EstadoSaude =
  | { kind: 'carregando' }
  | { kind: 'ok'; health: Health }
  | { kind: 'erro'; message: string }

/**
 * Tela mínima da fatia vertical (RF-1 a RF-6 da spec 001): ST → compila no
 * servidor → grava no ESP32 pelo navegador via Web Serial. Deliberadamente
 * crua — o editor visual Ladder e o simulador vêm nas specs seguintes.
 */
export default function App() {
  const [fonte, setFonte] = useState(BLINK_ST)
  const [compilacao, setCompilacao] = useState<EstadoCompilacao>({ fase: 'ocioso' })
  const [gravacao, setGravacao] = useState<EstadoGravacao>({ fase: 'ocioso' })
  const [saude, setSaude] = useState<EstadoSaude>({ kind: 'carregando' })

  useEffect(() => {
    let cancelado = false

    fetchHealth()
      .then((health) => {
        if (!cancelado) setSaude({ kind: 'ok', health })
      })
      .catch((erro: unknown) => {
        if (!cancelado) {
          setSaude({ kind: 'erro', message: erro instanceof Error ? erro.message : String(erro) })
        }
      })

    return () => {
      cancelado = true
    }
  }, [])

  const compilando = compilacao.fase === 'compilando'
  const gravando = gravacao.fase === 'gravando'
  const temPacoteValido = compilacao.fase === 'sucesso'
  const web_serial_ok = webSerialDisponivel()

  async function aoCompilar() {
    setCompilacao({ fase: 'compilando' })
    setGravacao({ fase: 'ocioso' })
    try {
      const pacote = await compilarPacote(fonte)
      setCompilacao({ fase: 'sucesso', pacote })
    } catch (erro) {
      if (erro instanceof ErroCompilacao || erro instanceof ErroHttpCompilacao || erro instanceof ErroRedeCompilacao) {
        setCompilacao({ fase: 'erro', erro })
      } else {
        setCompilacao({
          fase: 'erro',
          erro: new ErroRedeCompilacao(erro instanceof Error ? erro.message : String(erro)),
        })
      }
    }
  }

  async function aoGravar() {
    if (compilacao.fase !== 'sucesso') return

    setGravacao({ fase: 'gravando', progresso: 0 })
    try {
      await gravar(compilacao.pacote, {
        onProgresso: (progresso) => setGravacao({ fase: 'gravando', progresso }),
      })
      setGravacao({ fase: 'sucesso' })
    } catch (erro) {
      if (erro instanceof ErroGravacao) {
        setGravacao({ fase: 'erro', erro })
      } else {
        setGravacao({
          fase: 'erro',
          erro: new ErroGravacao('falha_gravacao', erro),
        })
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">LadderFlow</h1>
        <p className="mt-2 text-slate-600">
          Cole um Structured Text, compile no servidor e grave o resultado no ESP32 direto do navegador.
        </p>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <EditorST value={fonte} onChange={setFonte} disabled={compilando} />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={aoCompilar}
              disabled={compilando}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {compilando ? 'Compilando…' : 'Compilar'}
            </button>

            <button
              type="button"
              onClick={aoGravar}
              disabled={!temPacoteValido || !web_serial_ok || gravando}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {gravando ? 'Gravando…' : 'Gravar no ESP32'}
            </button>

            {compilando && (
              <span className="text-sm text-slate-500">o primeiro build pode levar minutos</span>
            )}
          </div>

          {!web_serial_ok && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este navegador não tem suporte à Web Serial API — a gravação fica desabilitada. Use Chrome ou Edge
              89+ em <code className="font-mono">localhost</code> ou por HTTPS.
            </p>
          )}

          {compilacao.fase === 'sucesso' && (
            <p className="mt-3 text-sm text-emerald-700">
              Compilação concluída: {compilacao.pacote.images.length} imagens prontas para{' '}
              {compilacao.pacote.chip}.
            </p>
          )}

          {compilacao.fase === 'erro' && (
            <div className="mt-4">
              <PainelErro erro={compilacao.erro} />
            </div>
          )}

          <PainelGravacao estado={gravacao} />
        </section>

        <RodapeSaude saude={saude} />
      </div>
    </main>
  )
}

/** Status do `/health`, como rodapé compacto — não bloqueia o uso da tela. */
function RodapeSaude({ saude }: { saude: EstadoSaude }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
      <span>Serviço de compilação:</span>
      {saude.kind === 'carregando' && <span>consultando…</span>}
      {saude.kind === 'erro' && <span className="text-red-600">indisponível ({saude.message})</span>}
      {saude.kind === 'ok' && (
        <>
          <StatusFerramenta rotulo="backend" ok={saude.health.status === 'ok'} />
          <StatusFerramenta rotulo="MATIEC" info={saude.health.iec2c} />
          <StatusFerramenta rotulo="toolchain ESP32" info={saude.health.esp_idf} />
        </>
      )}
    </footer>
  )
}

function StatusFerramenta({ rotulo, ok, info }: { rotulo: string; ok?: boolean; info?: ToolInfo }) {
  const disponivel = info ? info.available : Boolean(ok)
  return (
    <span className={disponivel ? 'text-emerald-700' : 'text-red-600'}>
      {rotulo}: {disponivel ? 'ok' : 'indisponível'}
    </span>
  )
}
