/**
 * Barra superior da IDE (spec 002, tarefa #26; painel lateral restaurado na
 * revisão da mesma tarefa; menu Baixar acrescentado na tarefa #11 da spec
 * 003): a IDE trabalha com um **projeto** de linguagem única (LD ou ST —
 * `projeto/projeto.ts`, frente P), criado por "Novo projeto". Uma única
 * faixa (~44px): marca "LadderFlow", "Novo projeto", separador, título do
 * projeto (truncado) + chip da linguagem; à direita, Compilar, Baixar,
 * Gravar, separador, alternar painel de variáveis (só em projeto Ladder —
 * ST não tem variáveis de E/S mapeadas em ladder), alternar painel inferior,
 * separador, tema.
 *
 * O painel de variáveis em si (conteúdo e redimensionamento) mora em
 * `PainelLateral`, ao lado do editor, em `App`; esta barra só expõe o botão
 * que abre/fecha. O menu Baixar (`MenuDownload`, entre Compilar e Gravar,
 * D-12) é igualmente só apresentacional aqui — `opcoesDownload` (o que
 * existe e o que está desabilitado) e `aoBaixar` (o que cada escolha faz)
 * vêm prontos de `App`.
 *
 * `motivoIndisponivel`, quando definido (ex.: nenhum projeto aberto),
 * desabilita Compilar e Gravar juntos — motivo no `title` de cada botão e
 * exposto via `aria-describedby` a um texto `sr-only` — além das regras de
 * sempre (`compilando`, `podeGravar`). A opção ".st" do menu Baixar usa o
 * mesmo motivo, via `opcoesDownload`, mas isso é decidido por `App`, não
 * por este componente.
 *
 * Puramente apresentacional: todo estado (painel de variáveis, progresso de
 * compilação/gravação, tema) mora em `App`, que decide o que cada botão faz.
 */
import { FilePlus, Hammer, Loader2, Moon, PanelBottom, PanelRight, Sun, Usb } from 'lucide-react'

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
  /** Percentual (0–100) mostrado no botão Gravar durante a gravação. */
  progressoGravacao?: number
  podeGravar: boolean
  aoGravar: () => void
  /** Opções do menu Baixar (D-12), montadas por `App` conforme a linguagem
   * do projeto e o portão de compilação. */
  opcoesDownload: OpcaoDownload[]
  aoBaixar: (id: OpcaoDownload['id']) => void
  /** Definido quando Compilar/Gravar não podem agir por um motivo além dos
   * de sempre (ex.: nenhum projeto aberto) — desabilita os dois botões. */
  motivoIndisponivel?: string
  /** Só relevante em projeto Ladder — ST não tem painel de variáveis. */
  painelVariaveisAberto: boolean
  aoAlternarPainelVariaveis: () => void
  painelInferiorAberto: boolean
  aoAlternarPainelInferior: () => void
  tema: Tema
  aoAlternarTema: () => void
}

/** Tamanho consistente dos ícones da barra. */
const TAMANHO_ICONE = 16

const ID_MOTIVO_INDISPONIVEL = 'barra-superior-motivo-indisponivel'

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
  painelInferiorAberto,
  aoAlternarPainelInferior,
  tema,
  aoAlternarTema,
}: BarraSuperiorProps) {
  const indisponivel = Boolean(motivoIndisponivel)
  const mostraAlternadorVariaveis = linguagem === 'ld'

  const rotuloCompilar = compilando ? 'Compilando…' : 'Compilar'
  const rotuloGravar = gravando ? `Gravando… ${Math.round(progressoGravacao ?? 0)}%` : 'Gravar no ESP32'

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ide-borda bg-ide-painel px-3 text-sm text-ide-texto">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ide-suave">LadderFlow</span>

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

        {mostraAlternadorVariaveis && (
          <button
            type="button"
            aria-pressed={painelVariaveisAberto}
            title="Alternar painel de variáveis"
            aria-label="Alternar painel de variáveis"
            onClick={aoAlternarPainelVariaveis}
            className={
              painelVariaveisAberto
                ? 'flex items-center gap-1.5 rounded-md border border-ide-borda bg-ide-elevado px-2 py-1.5 text-xs text-ide-texto'
                : 'flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs text-ide-suave hover:border-ide-borda hover:text-ide-texto'
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
