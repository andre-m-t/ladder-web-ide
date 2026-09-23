/**
 * Barra superior da IDE (spec 002, tarefa #26): projeto de linguagem única,
 * "Novo projeto", título + chip da linguagem; Desfazer/Refazer; à direita Compilar, Baixar,
 * Gravar, alternar painel de variáveis (Ladder), painel inferior e tema.
 * Controles de simulação e ambiente ficam em `BarraSimulacao` (revisão
 * 2026-09-23).
 */
import { FilePlus, Hammer, Loader2, Moon, PanelBottom, PanelRight, Redo2, Sun, Undo2, Usb } from 'lucide-react'

import type { Tema } from '../../lib/tema'
import type { Linguagem } from '../../projeto/projeto'
import MenuDownload, { type OpcaoDownload } from './MenuDownload'

export interface BarraSuperiorProps {
  titulo: string
  linguagem: Linguagem
  aoNovoProjeto: () => void
  compilando: boolean
  aoCompilar: () => void
  gravando: boolean
  progressoGravacao?: number
  podeGravar: boolean
  aoGravar: () => void
  opcoesDownload: OpcaoDownload[]
  aoBaixar: (id: OpcaoDownload['id']) => void
  motivoIndisponivel?: string
  painelVariaveisAberto: boolean
  aoAlternarPainelVariaveis: () => void
  /** Quando o ambiente ocupa o painel lateral, o alternador de variáveis fica desabilitado. */
  motivoPainelVariaveisIndisponivel?: string
  painelInferiorAberto: boolean
  aoAlternarPainelInferior: () => void
  tema: Tema
  aoAlternarTema: () => void
  podeDesfazer?: boolean
  podeRefazer?: boolean
  aoDesfazer?: () => void
  aoRefazer?: () => void
  /** Edição congelada (ex.: simulação ativa) — desabilita Desfazer/Refazer. */
  historicoEdicaoDesabilitado?: boolean
}

const TAMANHO_ICONE = 16
const ID_MOTIVO_INDISPONIVEL = 'barra-superior-motivo-indisponivel'
const ID_MOTIVO_PAINEL_VARIAVEIS = 'barra-superior-motivo-painel-variaveis'

function Separador() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-ide-borda" />
}

export default function BarraSuperior({
  titulo,
  linguagem,
  aoNovoProjeto,
  compilando,
  aoCompilar,
  gravando,
  progressoGravacao,
  podeGravar,
  aoGravar,
  opcoesDownload,
  aoBaixar,
  motivoIndisponivel,
  painelVariaveisAberto,
  aoAlternarPainelVariaveis,
  motivoPainelVariaveisIndisponivel,
  painelInferiorAberto,
  aoAlternarPainelInferior,
  tema,
  aoAlternarTema,
  podeDesfazer = false,
  podeRefazer = false,
  aoDesfazer,
  aoRefazer,
  historicoEdicaoDesabilitado = false,
}: BarraSuperiorProps) {
  const indisponivel = Boolean(motivoIndisponivel)
  const painelVariaveisIndisponivel = Boolean(motivoPainelVariaveisIndisponivel)
  const mostraAlternadorVariaveis = linguagem === 'ld'

  const rotuloCompilar = compilando ? 'Compilando…' : 'Compilar'
  const rotuloGravar = gravando ? `Gravando… ${Math.round(progressoGravacao ?? 0)}%` : 'Gravar no ESP32'

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ide-borda bg-ide-painel px-3 text-sm text-ide-texto">
      <button
        type="button"
        onClick={aoNovoProjeto}
        title="Novo projeto"
        aria-label="Novo projeto"
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-ide-suave hover:bg-ide-elevado hover:text-ide-texto"
      >
        <FilePlus aria-hidden="true" size={TAMANHO_ICONE} />
        <span className="hidden sm:inline">Novo projeto</span>
      </button>

      <Separador />

      <span className="truncate font-medium" title={titulo}>
        {titulo}
      </span>
      <span className="shrink-0 rounded border border-ide-borda px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ide-suave">
        {linguagem}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {indisponivel && (
          <span id={ID_MOTIVO_INDISPONIVEL} className="sr-only">
            {motivoIndisponivel}
          </span>
        )}

        <button
          type="button"
          onClick={() => aoDesfazer?.()}
          disabled={historicoEdicaoDesabilitado || !podeDesfazer}
          title="Desfazer"
          aria-label="Desfazer"
          className="flex items-center rounded-md border border-ide-borda p-1.5 text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 aria-hidden="true" size={TAMANHO_ICONE} />
        </button>
        <button
          type="button"
          onClick={() => aoRefazer?.()}
          disabled={historicoEdicaoDesabilitado || !podeRefazer}
          title="Refazer"
          aria-label="Refazer"
          className="flex items-center rounded-md border border-ide-borda p-1.5 text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Redo2 aria-hidden="true" size={TAMANHO_ICONE} />
        </button>

        <Separador />

        <button
          type="button"
          onClick={aoCompilar}
          disabled={compilando || indisponivel}
          title={indisponivel ? motivoIndisponivel : rotuloCompilar}
          aria-label={rotuloCompilar}
          aria-describedby={indisponivel ? ID_MOTIVO_INDISPONIVEL : undefined}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-ide-destaque hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
        >
          {compilando ? (
            <Loader2 aria-hidden="true" size={TAMANHO_ICONE} className="animate-spin" />
          ) : (
            <Hammer aria-hidden="true" size={TAMANHO_ICONE} />
          )}
          <span className="hidden sm:inline">{rotuloCompilar}</span>
        </button>

        <MenuDownload opcoes={opcoesDownload} aoEscolher={aoBaixar} />

        <button
          type="button"
          onClick={aoGravar}
          disabled={!podeGravar || indisponivel}
          title={indisponivel ? motivoIndisponivel : rotuloGravar}
          aria-label={rotuloGravar}
          aria-describedby={indisponivel ? ID_MOTIVO_INDISPONIVEL : undefined}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
        >
          {gravando ? (
            <Loader2 aria-hidden="true" size={TAMANHO_ICONE} className="animate-spin" />
          ) : (
            <Usb aria-hidden="true" size={TAMANHO_ICONE} />
          )}
          <span className="hidden sm:inline">{rotuloGravar}</span>
        </button>

        <Separador />

        {motivoPainelVariaveisIndisponivel && (
          <span id={ID_MOTIVO_PAINEL_VARIAVEIS} className="sr-only">
            {motivoPainelVariaveisIndisponivel}
          </span>
        )}

        {mostraAlternadorVariaveis && (
          <button
            type="button"
            aria-pressed={painelVariaveisAberto && !painelVariaveisIndisponivel}
            title={painelVariaveisIndisponivel ? motivoPainelVariaveisIndisponivel : 'Alternar painel de variáveis'}
            aria-label="Alternar painel de variáveis"
            aria-describedby={painelVariaveisIndisponivel ? ID_MOTIVO_PAINEL_VARIAVEIS : undefined}
            disabled={painelVariaveisIndisponivel}
            onClick={aoAlternarPainelVariaveis}
            className={
              painelVariaveisAberto && !painelVariaveisIndisponivel
                ? 'flex items-center gap-1.5 rounded-md border border-ide-borda bg-ide-elevado px-2 py-1.5 text-xs text-ide-texto disabled:cursor-not-allowed disabled:opacity-50'
                : 'flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs text-ide-suave hover:border-ide-borda hover:text-ide-texto disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            <PanelRight aria-hidden="true" size={TAMANHO_ICONE} />
          </button>
        )}

        <button
          type="button"
          aria-pressed={painelInferiorAberto}
          title="Alternar painel inferior"
          aria-label="Alternar painel inferior"
          onClick={aoAlternarPainelInferior}
          className={
            painelInferiorAberto
              ? 'flex items-center gap-1.5 rounded-md border border-ide-borda bg-ide-elevado px-2 py-1.5 text-xs text-ide-texto'
              : 'flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs text-ide-suave hover:border-ide-borda hover:text-ide-texto'
          }
        >
          <PanelBottom aria-hidden="true" size={TAMANHO_ICONE} />
        </button>

        <Separador />

        <button
          type="button"
          title={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          onClick={aoAlternarTema}
          className="flex items-center rounded-md border border-ide-borda p-1.5 text-ide-texto hover:bg-ide-elevado"
        >
          {tema === 'escuro' ? <Sun aria-hidden="true" size={TAMANHO_ICONE} /> : <Moon aria-hidden="true" size={TAMANHO_ICONE} />}
        </button>
      </div>
    </header>
  )
}
