/**
 * Barra superior da IDE (spec 002, plano D-14): marca, abas do editor
 * (Ladder/ST), ações de Compilar/Gravar (mesmas regras de habilitação de
 * sempre) e os alternadores de painel de variáveis, console e tema —
 * agora com ícones `lucide-react`.
 *
 * A saúde do servidor de compilação (`/health`) não aparece mais aqui: o
 * `App` registra MATIEC e toolchain ESP32 no console, uma linha cada, ao
 * abrir (plano D-14, item 3).
 *
 * Puramente apresentacional: todo estado (aba ativa, progresso de
 * compilação/gravação, tema) mora em `App`, que decide o que cada botão faz.
 */
import { FileCode2, Hammer, LayoutList, Loader2, Moon, PanelRight, SquareTerminal, Sun, Usb } from 'lucide-react'

import type { Tema } from '../../lib/tema'

export type Aba = 'ladder' | 'st'

export interface BarraSuperiorProps {
  aba: Aba
  aoMudarAba: (aba: Aba) => void
  compilando: boolean
  aoCompilar: () => void
  gravando: boolean
  /** Percentual (0–100) mostrado no botão Gravar durante a gravação. */
  progressoGravacao?: number
  podeGravar: boolean
  aoGravar: () => void
  painelVariaveisAberto: boolean
  aoAlternarPainelVariaveis: () => void
  consoleAberto: boolean
  aoAlternarConsole: () => void
  tema: Tema
  aoAlternarTema: () => void
}

/** Tamanho consistente dos ícones da barra (plano D-14). */
const TAMANHO_ICONE = 16

const ABAS: { aba: Aba; rotulo: string; Icone: typeof FileCode2 }[] = [
  { aba: 'ladder', rotulo: 'Ladder', Icone: LayoutList },
  { aba: 'st', rotulo: 'ST', Icone: FileCode2 },
]

function Separador() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-ide-borda" />
}

export default function BarraSuperior({
  aba,
  aoMudarAba,
  compilando,
  aoCompilar,
  gravando,
  progressoGravacao,
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
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ide-borda bg-ide-painel px-3 text-sm text-ide-texto">
      <div role="tablist" aria-label="Editor" className="flex shrink-0 gap-1 rounded-lg bg-ide-elevado p-1">
        {ABAS.map((item) => {
          const Icone = item.Icone
          return (
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
                  ? 'flex items-center gap-1.5 rounded-md bg-ide-destaque px-2.5 py-1 font-medium text-ide-destaque-texto'
                  : 'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-ide-suave hover:text-ide-texto'
              }
            >
              <Icone aria-hidden="true" size={TAMANHO_ICONE} />
              {item.rotulo}
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={aoCompilar}
          disabled={compilando}
          title={compilando ? 'Compilando…' : 'Compilar'}
          aria-label={compilando ? 'Compilando…' : 'Compilar'}
          className="flex items-center gap-1.5 rounded-lg bg-ide-destaque px-2.5 py-1.5 text-sm font-medium text-ide-destaque-texto shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {compilando ? <Loader2 aria-hidden="true" size={TAMANHO_ICONE} className="animate-spin" /> : <Hammer aria-hidden="true" size={TAMANHO_ICONE} />}
          <span className="hidden sm:inline">{compilando ? 'Compilando…' : 'Compilar'}</span>
        </button>

        <button
          type="button"
          onClick={aoGravar}
          disabled={!podeGravar}
          title={gravando ? `Gravando… ${Math.round(progressoGravacao ?? 0)}%` : 'Gravar no ESP32'}
          aria-label={gravando ? `Gravando… ${Math.round(progressoGravacao ?? 0)}%` : 'Gravar no ESP32'}
          className="flex items-center gap-1.5 rounded-lg bg-ide-destaque px-2.5 py-1.5 text-sm font-medium text-ide-destaque-texto shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {gravando ? <Loader2 aria-hidden="true" size={TAMANHO_ICONE} className="animate-spin" /> : <Usb aria-hidden="true" size={TAMANHO_ICONE} />}
          <span className="hidden sm:inline">{gravando ? `Gravando… ${Math.round(progressoGravacao ?? 0)}%` : 'Gravar no ESP32'}</span>
        </button>

        <Separador />

        <button
          type="button"
          aria-pressed={painelVariaveisAberto}
          title="Alternar painel de variáveis"
          aria-label="Alternar painel de variáveis"
          onClick={aoAlternarPainelVariaveis}
          className={
            painelVariaveisAberto
              ? 'flex items-center gap-1.5 rounded-lg border border-ide-borda bg-ide-elevado px-2 py-1.5 text-xs text-ide-texto'
              : 'flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-xs text-ide-suave hover:border-ide-borda hover:text-ide-texto'
          }
        >
          <PanelRight aria-hidden="true" size={TAMANHO_ICONE} />
          <span className="hidden lg:inline">Variáveis</span>
        </button>

        <button
          type="button"
          aria-pressed={consoleAberto}
          title="Alternar console"
          aria-label="Alternar console"
          onClick={aoAlternarConsole}
          className={
            consoleAberto
              ? 'flex items-center gap-1.5 rounded-lg border border-ide-borda bg-ide-elevado px-2 py-1.5 text-xs text-ide-texto'
              : 'flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-xs text-ide-suave hover:border-ide-borda hover:text-ide-texto'
          }
        >
          <SquareTerminal aria-hidden="true" size={TAMANHO_ICONE} />
          <span className="hidden lg:inline">Console</span>
        </button>

        <Separador />

        <button
          type="button"
          title={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          onClick={aoAlternarTema}
          className="flex items-center rounded-lg border border-ide-borda p-1.5 text-ide-texto hover:bg-ide-elevado"
        >
          {tema === 'escuro' ? <Sun aria-hidden="true" size={TAMANHO_ICONE} /> : <Moon aria-hidden="true" size={TAMANHO_ICONE} />}
        </button>
      </div>
    </header>
  )
}
