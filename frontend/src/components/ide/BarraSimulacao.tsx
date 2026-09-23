/**
 * Faixa de controles de simulação e ambiente (spec 004 D-9 revisado 2026-09-23;
 * spec 005): sempre visível acima do editor. Fora da simulação os controles de
 * execução ficam desabilitados; na simulação a faixa ganha destaque visual.
 * Estado e relógio continuam em `App`.
 */
import { AppWindow, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react'

export interface MarchaSimulacao {
  id: string
  rotulo: string
}

export interface BarraSimulacaoProps {
  simulando: boolean
  simulacaoRodando: boolean
  motivoSimulacaoIndisponivel?: string
  aoAlternarSimulacao: () => void
  aoAlternarExecucaoSimulacao: () => void
  aoPassoSimulacao: () => void
  aoReiniciarSimulacao: () => void
  marchas: MarchaSimulacao[]
  marchaAtual: string
  aoEscolherMarcha: (id: string) => void
  /** Ciclo atual do PLC simulado; omitido fora da simulação. */
  ciclo?: number
  painelAmbienteAberto: boolean
  aoAlternarPainelAmbiente: () => void
  motivoAmbienteIndisponivel?: string
}

const TAMANHO_ICONE = 16
const TITULO_AGUARDE = 'Entre em simulação primeiro'

const ID_MOTIVO_SIMULACAO_INDISPONIVEL = 'barra-simulacao-motivo-simulacao-indisponivel'
const ID_MARCHA_SIMULACAO = 'barra-simulacao-marcha'
const ID_MOTIVO_AMBIENTE_INDISPONIVEL = 'barra-simulacao-motivo-ambiente-indisponivel'

function Separador() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-ide-borda" />
}

export default function BarraSimulacao({
  simulando,
  simulacaoRodando,
  motivoSimulacaoIndisponivel,
  aoAlternarSimulacao,
  aoAlternarExecucaoSimulacao,
  aoPassoSimulacao,
  aoReiniciarSimulacao,
  marchas,
  marchaAtual,
  aoEscolherMarcha,
  ciclo,
  painelAmbienteAberto,
  aoAlternarPainelAmbiente,
  motivoAmbienteIndisponivel,
}: BarraSimulacaoProps) {
  const simulacaoIndisponivel = Boolean(motivoSimulacaoIndisponivel) && !simulando
  const ambienteIndisponivel = Boolean(motivoAmbienteIndisponivel)
  const controlesSecundariosDesabilitados = !simulando

  const classeFaixa = simulando
    ? 'border-b border-ide-destaque/40 bg-ide-destaque/10'
    : 'border-b border-ide-borda bg-ide-painel'

  return (
    <div
      role="toolbar"
      aria-label="Simulação"
      className={`flex h-10 shrink-0 flex-wrap items-center gap-1 px-3 text-sm text-ide-texto ${classeFaixa}`}
    >
      {motivoSimulacaoIndisponivel && (
        <span id={ID_MOTIVO_SIMULACAO_INDISPONIVEL} className="sr-only">
          {motivoSimulacaoIndisponivel}
        </span>
      )}

      <button
        type="button"
        onClick={aoAlternarSimulacao}
        disabled={simulacaoIndisponivel}
        aria-pressed={simulando}
        title={simulacaoIndisponivel ? motivoSimulacaoIndisponivel : simulando ? 'Sair da simulação' : 'Simular'}
        aria-label={simulando ? 'Sair da simulação' : 'Simular'}
        aria-describedby={simulacaoIndisponivel ? ID_MOTIVO_SIMULACAO_INDISPONIVEL : undefined}
        className={
          simulando
            ? 'flex items-center gap-1.5 rounded-md border border-ide-perigo bg-ide-elevado px-2.5 py-1 font-medium text-ide-perigo disabled:cursor-not-allowed disabled:opacity-50'
            : 'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-ide-destaque hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {simulando ? <Square aria-hidden="true" size={TAMANHO_ICONE} /> : <Play aria-hidden="true" size={TAMANHO_ICONE} />}
        <span className="hidden sm:inline">{simulando ? 'Sair da simulação' : 'Simular'}</span>
      </button>

      <button
        type="button"
        onClick={aoAlternarExecucaoSimulacao}
        disabled={controlesSecundariosDesabilitados}
        title={controlesSecundariosDesabilitados ? TITULO_AGUARDE : simulacaoRodando ? 'Pausar' : 'Executar'}
        aria-label={simulacaoRodando ? 'Pausar simulação' : 'Executar simulação'}
        className={`flex items-center rounded-md p-1.5 hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-40 ${
          simulando && simulacaoRodando ? 'text-ide-destaque' : 'text-ide-texto'
        }`}
      >
        {simulacaoRodando ? <Pause aria-hidden="true" size={TAMANHO_ICONE} /> : <Play aria-hidden="true" size={TAMANHO_ICONE} />}
      </button>

      <button
        type="button"
        onClick={aoPassoSimulacao}
        disabled={controlesSecundariosDesabilitados}
        title={controlesSecundariosDesabilitados ? TITULO_AGUARDE : 'Passo — avança exatamente um ciclo'}
        aria-label="Avançar um ciclo"
        className="flex items-center rounded-md p-1.5 text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SkipForward aria-hidden="true" size={TAMANHO_ICONE} />
      </button>

      <button
        type="button"
        onClick={aoReiniciarSimulacao}
        disabled={controlesSecundariosDesabilitados}
        title={controlesSecundariosDesabilitados ? TITULO_AGUARDE : 'Reiniciar simulação'}
        aria-label="Reiniciar simulação"
        className="flex items-center rounded-md p-1.5 text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw aria-hidden="true" size={TAMANHO_ICONE} />
      </button>

      <label htmlFor={ID_MARCHA_SIMULACAO} className="sr-only">
        Marcha da simulação
      </label>
      <select
        id={ID_MARCHA_SIMULACAO}
        value={marchaAtual}
        disabled={controlesSecundariosDesabilitados}
        title={controlesSecundariosDesabilitados ? TITULO_AGUARDE : undefined}
        onChange={(evento) => aoEscolherMarcha(evento.target.value)}
        className="rounded-md border border-ide-borda bg-ide-painel px-1.5 py-1 text-xs text-ide-texto disabled:cursor-not-allowed disabled:opacity-40"
      >
        {marchas.map((marcha) => (
          <option key={marcha.id} value={marcha.id}>
            {marcha.rotulo}
          </option>
        ))}
      </select>

      <span
        className={`ml-1 tabular-nums text-xs ${simulando ? 'font-medium text-ide-destaque' : 'text-ide-suave'}`}
        title="Ciclo de varredura"
      >
        Ciclo: {simulando && ciclo !== undefined ? ciclo : '—'}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {motivoAmbienteIndisponivel && (
          <span id={ID_MOTIVO_AMBIENTE_INDISPONIVEL} className="sr-only">
            {motivoAmbienteIndisponivel}
          </span>
        )}

        {!painelAmbienteAberto && (
          <>
            <Separador />

            <button
              type="button"
              onClick={aoAlternarPainelAmbiente}
              disabled={ambienteIndisponivel}
              title={ambienteIndisponivel ? motivoAmbienteIndisponivel : 'Ambiente de simulação'}
              aria-label="Abrir ambiente de simulação"
              aria-describedby={ambienteIndisponivel ? ID_MOTIVO_AMBIENTE_INDISPONIVEL : undefined}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AppWindow aria-hidden="true" size={TAMANHO_ICONE} />
              <span className="hidden sm:inline">Ambiente</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
