/**
 * Barra superior da IDE (spec 002, tarefa #26): a IDE passa a trabalhar com
 * um **projeto** de linguagem única (LD ou ST — `projeto/projeto.ts`, frente
 * P), criado por "Novo projeto". As antigas abas Ladder/ST saem: agora há
 * uma única área de edição, com sub-abas "Lógica" (sempre) e "Variáveis" (só
 * em projeto Ladder — ST não tem variáveis de E/S mapeadas em ladder). O
 * painel lateral direito de variáveis também sai: seu conteúdo migrou para
 * essa sub-aba.
 *
 * Duas faixas:
 *  - Faixa 1 (~44px): marca "LadderFlow", "Novo projeto", separador, título
 *    do projeto (truncado) + chip da linguagem; à direita, Compilar/Gravar,
 *    separador, alternar painel inferior, separador, tema.
 *  - Faixa 2 (~36px): `tablist` "Área de edição" com as sub-abas Lógica e
 *    Variáveis.
 *
 * `motivoIndisponivel`, quando definido (ex.: nenhum projeto aberto),
 * desabilita Compilar e Gravar juntos — motivo no `title` de cada botão e
 * exposto via `aria-describedby` a um texto `sr-only` — além das regras de
 * sempre (`compilando`, `podeGravar`).
 *
 * Puramente apresentacional: todo estado (aba ativa, progresso de
 * compilação/gravação, tema) mora em `App`, que decide o que cada botão faz.
 */
import { FilePlus, FileText, Hammer, Loader2, Moon, PanelBottom, Sun, Tag, Usb } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'

import type { Tema } from '../../lib/tema'
import type { Linguagem } from '../../projeto/projeto'

export type AbaEdicao = 'logica' | 'variaveis'

export interface BarraSuperiorProps {
  titulo: string
  linguagem: Linguagem
  abaEdicao: AbaEdicao
  aoMudarAbaEdicao: (aba: AbaEdicao) => void
  aoNovoProjeto: () => void
  compilando: boolean
  aoCompilar: () => void
  gravando: boolean
  /** Percentual (0–100) mostrado no botão Gravar durante a gravação. */
  progressoGravacao?: number
  podeGravar: boolean
  aoGravar: () => void
  /** Definido quando Compilar/Gravar não podem agir por um motivo além dos
   * de sempre (ex.: nenhum projeto aberto) — desabilita os dois botões. */
  motivoIndisponivel?: string
  painelInferiorAberto: boolean
  aoAlternarPainelInferior: () => void
  tema: Tema
  aoAlternarTema: () => void
}

/** Tamanho consistente dos ícones da faixa de ações. */
const TAMANHO_ICONE = 16
/** Tamanho dos ícones das sub-abas da área de edição. */
const TAMANHO_ICONE_ABA = 14

const ID_MOTIVO_INDISPONIVEL = 'barra-superior-motivo-indisponivel'

function Separador() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-ide-borda" />
}

function classeAbaEdicao(ativa: boolean): string {
  return ativa
    ? 'flex items-center gap-1.5 rounded-md bg-ide-elevado px-2.5 py-1 text-xs font-medium text-ide-texto'
    : 'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-ide-suave hover:text-ide-texto'
}

export default function BarraSuperior({
  titulo,
  linguagem,
  abaEdicao,
  aoMudarAbaEdicao,
  aoNovoProjeto,
  compilando,
  aoCompilar,
  gravando,
  progressoGravacao,
  podeGravar,
  aoGravar,
  motivoIndisponivel,
  painelInferiorAberto,
  aoAlternarPainelInferior,
  tema,
  aoAlternarTema,
}: BarraSuperiorProps) {
  const refLogica = useRef<HTMLButtonElement | null>(null)
  const refVariaveis = useRef<HTMLButtonElement | null>(null)

  const indisponivel = Boolean(motivoIndisponivel)
  const mostraVariaveis = linguagem === 'ld'

  const rotuloCompilar = compilando ? 'Compilando…' : 'Compilar'
  const rotuloGravar = gravando ? `Gravando… ${Math.round(progressoGravacao ?? 0)}%` : 'Gravar no ESP32'

  /** Navegação por setas do tablist (WAI-ARIA Authoring Practices) — só faz
   * sentido quando as duas sub-abas existem (projeto Ladder). */
  function aoTeclarNaAbaEdicao(evento: KeyboardEvent<HTMLButtonElement>) {
    if (!mostraVariaveis) return
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    evento.preventDefault()
    const proxima: AbaEdicao = abaEdicao === 'logica' ? 'variaveis' : 'logica'
    aoMudarAbaEdicao(proxima)
    ;(proxima === 'logica' ? refLogica : refVariaveis).current?.focus()
  }

  return (
    <header className="flex shrink-0 flex-col border-b border-ide-borda bg-ide-painel text-ide-texto">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-ide-borda px-3 text-sm">
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
      </div>

      <div role="tablist" aria-label="Área de edição" className="flex h-9 shrink-0 items-center gap-1 px-3">
        <button
          ref={refLogica}
          type="button"
          role="tab"
          id="aba-edicao-logica"
          aria-selected={abaEdicao === 'logica'}
          aria-controls="painel-edicao-logica"
          tabIndex={abaEdicao === 'logica' ? 0 : -1}
          onClick={() => aoMudarAbaEdicao('logica')}
          onKeyDown={aoTeclarNaAbaEdicao}
          className={classeAbaEdicao(abaEdicao === 'logica')}
        >
          <FileText aria-hidden="true" size={TAMANHO_ICONE_ABA} />
          Lógica
        </button>

        {mostraVariaveis && (
          <button
            ref={refVariaveis}
            type="button"
            role="tab"
            id="aba-edicao-variaveis"
            aria-selected={abaEdicao === 'variaveis'}
            aria-controls="painel-edicao-variaveis"
            tabIndex={abaEdicao === 'variaveis' ? 0 : -1}
            onClick={() => aoMudarAbaEdicao('variaveis')}
            onKeyDown={aoTeclarNaAbaEdicao}
            className={classeAbaEdicao(abaEdicao === 'variaveis')}
          >
            <Tag aria-hidden="true" size={TAMANHO_ICONE_ABA} />
            Variáveis
          </button>
        )}
      </div>
    </header>
  )
}
