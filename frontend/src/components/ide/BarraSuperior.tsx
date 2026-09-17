/**
 * Barra superior da IDE (spec 002, plano D-13): nome, abas do editor
 * (Ladder/ST), status do servidor de compilação (`/health`), ações de
 * Compilar/Gravar (mesmas regras de habilitação de sempre) e os
 * alternadores de painel de variáveis, console e tema.
 *
 * Puramente apresentacional: todo estado (aba ativa, saúde, progresso de
 * compilação/gravação, tema) mora em `App`, que decide o que cada botão faz.
 */
import type { Health } from '../../lib/api'
import type { Tema } from '../../lib/tema'

export type Aba = 'ladder' | 'st'

export type EstadoSaude =
  | { kind: 'carregando' }
  | { kind: 'ok'; health: Health }
  | { kind: 'erro'; message: string }

export interface BarraSuperiorProps {
  aba: Aba
  aoMudarAba: (aba: Aba) => void
  saude: EstadoSaude
  compilando: boolean
  aoCompilar: () => void
  gravando: boolean
  podeGravar: boolean
  aoGravar: () => void
  painelVariaveisAberto: boolean
  aoAlternarPainelVariaveis: () => void
  consoleAberto: boolean
  aoAlternarConsole: () => void
  tema: Tema
  aoAlternarTema: () => void
}

function ChipFerramenta({ rotulo, disponivel }: { rotulo: string; disponivel: boolean }) {
  return (
    <span className={disponivel ? 'text-ide-sucesso' : 'text-ide-perigo'}>
      {rotulo}: {disponivel ? 'ok' : 'indisponível'}
    </span>
  )
}

function ChipSaude({ saude }: { saude: EstadoSaude }) {
  if (saude.kind === 'carregando') {
    return <span className="text-ide-suave">servidor: consultando…</span>
  }
  if (saude.kind === 'erro') {
    return <span className="text-ide-perigo">servidor: indisponível ({saude.message})</span>
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <ChipFerramenta rotulo="MATIEC" disponivel={saude.health.iec2c.available} />
      <ChipFerramenta rotulo="toolchain ESP32" disponivel={saude.health.esp_idf.available} />
    </span>
  )
}

const ABAS: { aba: Aba; rotulo: string }[] = [
  { aba: 'ladder', rotulo: 'Ladder' },
  { aba: 'st', rotulo: 'ST' },
]

export default function BarraSuperior({
  aba,
  aoMudarAba,
  saude,
  compilando,
  aoCompilar,
  gravando,
  podeGravar,
  aoGravar,
  painelVariaveisAberto,
  aoAlternarPainelVariaveis,
  consoleAberto,
  aoAlternarConsole,
  tema,
  aoAlternarTema,
}: BarraSuperiorProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-ide-borda bg-ide-painel px-4 py-2 text-sm text-ide-texto">
      <span className="text-base font-semibold tracking-tight text-ide-destaque">LadderFlow</span>

      <div role="tablist" aria-label="Editor" className="flex gap-1 rounded-lg bg-ide-elevado p-1">
        {ABAS.map((item) => (
          <button
            key={item.aba}
            type="button"
            role="tab"
            id={`aba-${item.aba}`}
            aria-selected={aba === item.aba}
            aria-controls={`painel-${item.aba}`}
            onClick={() => aoMudarAba(item.aba)}
            className={
              aba === item.aba
                ? 'rounded-md bg-ide-destaque px-3 py-1 font-medium text-ide-destaque-texto'
                : 'rounded-md px-3 py-1 text-ide-suave hover:text-ide-texto'
            }
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div className="text-xs">
        <ChipSaude saude={saude} />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={aoCompilar}
          disabled={compilando}
          className="rounded-lg bg-ide-destaque px-3 py-1.5 text-sm font-medium text-ide-destaque-texto shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {compilando ? 'Compilando…' : 'Compilar ST'}
        </button>

        <button
          type="button"
          onClick={aoGravar}
          disabled={!podeGravar}
          className="rounded-lg border border-ide-borda bg-ide-elevado px-3 py-1.5 text-sm font-medium text-ide-texto shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {gravando ? 'Gravando…' : 'Gravar no ESP32'}
        </button>

        <button
          type="button"
          aria-pressed={painelVariaveisAberto}
          onClick={aoAlternarPainelVariaveis}
          className="rounded-lg border border-ide-borda px-2 py-1.5 text-xs text-ide-suave hover:text-ide-texto"
        >
          Variáveis
        </button>

        <button
          type="button"
          aria-pressed={consoleAberto}
          onClick={aoAlternarConsole}
          className="rounded-lg border border-ide-borda px-2 py-1.5 text-xs text-ide-suave hover:text-ide-texto"
        >
          Console
        </button>

        <button
          type="button"
          aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          onClick={aoAlternarTema}
          className="rounded-lg border border-ide-borda px-2 py-1.5 text-sm text-ide-texto hover:bg-ide-elevado"
        >
          {tema === 'escuro' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
