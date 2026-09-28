/**
 * Modal de propriedades do elemento (variável + tipo na mesma família).
 *
 * **Nova variável (spec 002, revisão 2026-09-23):** com `aoCriarVariavel`, o
 * botão "Nova variável…" abre `ModalNovaVariavel` por cima deste — pino entre
 * os livres das classes que o elemento aceita (bobina e contador não
 * oferecem entrada) — e quem monta declara e vincula numa jogada só. Com um
 * ambiente aberto (`pontosAmbiente`), cada pino mostra o ponto da planta que
 * o usa e o nome sugerido é o do contrato.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react'

import { Plus } from 'lucide-react'

import type { PontoAmbiente } from '../../ambientes/contrato'
import { sugerirNomeVariavel } from '../../ambientes/vinculo'
import { classeDaVariavel, type ClasseVariavel } from '../../ladder/enderecos'
import { descritorDe } from '../../ladder/blocos'
import { ehBobina, ehBloco, ehContato, variavelDoElemento, type Elemento, type TipoBobina, type TipoContato, type Variavel } from '../../ladder/modelo'
import ModalNovaVariavel from './ModalNovaVariavel'
import { Bobina, BobinaReset, BobinaSet, ContatoNA, ContatoNF } from './Simbolos'

export interface ModalVariavelProps {
  elemento: Elemento
  variaveis: Variavel[]
  aoEscolher: (nome: string | null) => void
  aoTrocarTipo?: (tipo: Elemento['tipo']) => void
  aoFechar: () => void
  aoAlterarLimite?: (pv: number) => void
  /** Declara uma variável e a vincula a este elemento; devolve o motivo da
   * recusa ou `null`. Ausente, o botão "Nova variável…" não aparece. */
  aoCriarVariavel?: (variavel: { nome: string; endereco?: string }) => string | null
  pontosAmbiente?: readonly PontoAmbiente[]
}

const CLASSES_CONTATO: readonly ClasseVariavel[] = ['entrada', 'saida', 'interna']
const CLASSES_ESCRITA: readonly ClasseVariavel[] = ['saida', 'interna']

const ROTULO_CLASSE: Record<ClasseVariavel, string> = {
  entrada: 'entrada',
  saida: 'saída',
  interna: 'interna',
}

const OPCAO_SEM_VARIAVEL = '__sem-variavel__'

const TIPOS_CONTATO: TipoContato[] = ['contato_na', 'contato_nf']
const TIPOS_BOBINA: TipoBobina[] = ['bobina', 'bobina_set', 'bobina_reset']

function IconeTipo({ tipo, ativo }: { tipo: Elemento['tipo']; ativo: boolean }) {
  const cx = 20
  const cy = 16
  const props = { cx, cy, variavel: null, semRotulo: true, fantasma: !ativo, selecionado: ativo, energizado: undefined as boolean | undefined }

  return (
    <svg width={40} height={32} viewBox="0 0 40 32" aria-hidden="true" className="overflow-visible">
      {tipo === 'contato_na' && <ContatoNA {...props} />}
      {tipo === 'contato_nf' && <ContatoNF {...props} />}
      {tipo === 'bobina' && <Bobina {...props} />}
      {tipo === 'bobina_set' && <BobinaSet {...props} />}
      {tipo === 'bobina_reset' && <BobinaReset {...props} />}
    </svg>
  )
}

export default function ModalVariavel({
  elemento,
  variaveis,
  aoEscolher,
  aoTrocarTipo,
  aoFechar,
  aoAlterarLimite,
  aoCriarVariavel,
  pontosAmbiente,
}: ModalVariavelProps) {
  const idTitulo = useId()
  const idVariavel = useId()
  const idTipo = useId()
  const idLimite = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const [criando, setCriando] = useState(false)
  const ehElementoBobina = ehBobina(elemento.tipo) || ehBloco(elemento)
  const motivoDesabilitada = ehBloco(elemento) ? 'entradas não podem ser escritas pelo bloco' : 'entradas não podem ser escritas por bobina'
  const vinculoAtual = variavelDoElemento(elemento)
  const descBloco = ehBloco(elemento) ? descritorDe(elemento.tipo) : null
  const [preset, setPreset] = useState(() => (ehBloco(elemento) ? String(elemento.preset) : ''))

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('select, button')?.focus()
  }, [])

  function aoTeclarNoDialogo(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      aoFechar()
    }
  }

  function aoClicarOverlay() {
    aoFechar()
  }

  function aoClicarDialogo(evento: MouseEvent<HTMLDivElement>) {
    evento.stopPropagation()
  }

  function aoMudarVariavel(evento: ChangeEvent<HTMLSelectElement>) {
    const valor = evento.target.value
    aoEscolher(valor === OPCAO_SEM_VARIAVEL ? null : valor)
  }

  function confirmarLimite() {
    const numero = Number(preset)
    if (Number.isNaN(numero)) return
    aoAlterarLimite?.(numero)
  }

  function pontoDoEndereco(endereco: string | undefined): PontoAmbiente | undefined {
    return endereco === undefined ? undefined : pontosAmbiente?.find((p) => p.endereco === endereco)
  }

  function fecharCriacao() {
    setCriando(false)
    selectRef.current?.focus()
  }

  const tiposDisponiveis = ehContato(elemento.tipo) ? TIPOS_CONTATO : ehBobina(elemento.tipo) ? TIPOS_BOBINA : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={aoClicarOverlay}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={aoClicarDialogo}
        onKeyDown={aoTeclarNoDialogo}
        className="w-80 rounded-lg border border-ide-borda bg-ide-elevado p-4 shadow-lg"
      >
        <h2 id={idTitulo} className="text-sm font-semibold text-ide-texto">Propriedades do elemento</h2>

        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor={idVariavel} className="text-xs font-medium text-ide-texto">Parâmetro de saída</label>
          <select
            id={idVariavel}
            ref={selectRef}
            value={vinculoAtual ?? OPCAO_SEM_VARIAVEL}
            onChange={aoMudarVariavel}
            className="rounded border border-ide-borda bg-ide-painel px-2 py-1.5 text-sm text-ide-texto"
          >
            <option value={OPCAO_SEM_VARIAVEL}>Sem variável</option>
            {variaveis.map((variavel) => {
              const classe = classeDaVariavel(variavel)
              const desabilitada = ehElementoBobina && classe === 'entrada'
              const rotulo = `${variavel.nome} (${ROTULO_CLASSE[classe]}${variavel.endereco ? ` ${variavel.endereco}` : ''})`
              return (
                <option key={variavel.nome} value={variavel.nome} disabled={desabilitada} title={desabilitada ? motivoDesabilitada : undefined}>
                  {rotulo}
                </option>
              )
            })}
          </select>
          {aoCriarVariavel ? (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="mt-1 inline-flex items-center gap-1 self-start rounded px-1 py-0.5 text-xs font-medium text-ide-destaque hover:bg-ide-painel"
            >
              <Plus aria-hidden="true" size={12} />
              Nova variável…
            </button>
          ) : (
            variaveis.length === 0 && <p className="text-xs text-ide-suave">Crie variáveis na tabela ao lado.</p>
          )}
        </div>

        {tiposDisponiveis.length > 0 && (
          <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-labelledby={idTipo}>
            <span id={idTipo} className="text-xs font-medium text-ide-texto">Tipo</span>
            <div className="flex gap-2">
              {tiposDisponiveis.map((tipo) => {
                const ativo = elemento.tipo === tipo
                return (
                  <button
                    key={tipo}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => {
                      if (!ativo) aoTrocarTipo?.(tipo)
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border ${ativo ? 'border-ide-destaque bg-ide-painel ring-2 ring-ide-destaque' : 'border-ide-borda bg-ide-elevado hover:bg-ide-painel'}`}
                  >
                    <IconeTipo tipo={tipo} ativo={ativo} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {descBloco !== null && (
          <div className="mt-3 flex flex-col gap-1 border-t border-ide-borda pt-3">
            <label htmlFor={idLimite} className="text-xs font-medium text-ide-texto">
              {descBloco.preset.formal} ({descBloco.preset.unidade === 'ms' ? 'ms' : 'contagens'})
            </label>
            <div className="flex gap-2">
              <input
                id={idLimite}
                type="number"
                min={descBloco.preset.min}
                max={descBloco.preset.max}
                step={descBloco.preset.passo}
                value={preset}
                onChange={(evento) => setPreset(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault()
                    confirmarLimite()
                  }
                }}
                className="w-24 rounded border border-ide-borda bg-ide-painel p-1 text-sm text-ide-texto"
              />
              <button type="button" onClick={confirmarLimite} className="rounded border border-ide-borda px-2 py-1 text-xs text-ide-texto hover:bg-ide-painel">
                Aplicar limite
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={aoFechar} className="rounded border border-ide-borda px-3 py-1 text-sm font-medium text-ide-destaque hover:bg-ide-painel">
            Fechar
          </button>
        </div>

        {criando && aoCriarVariavel && (
          <ModalNovaVariavel
            variaveis={variaveis}
            classes={ehElementoBobina ? CLASSES_ESCRITA : CLASSES_CONTATO}
            sugerirNome={(endereco) => {
              const ponto = pontoDoEndereco(endereco)
              return ponto ? sugerirNomeVariavel(ponto, variaveis) : undefined
            }}
            rotuloDoEndereco={(endereco) => pontoDoEndereco(endereco)?.rotulo}
            contexto="A variável criada fica vinculada a este elemento."
            rotuloConfirmar="Criar e vincular"
            aoCriar={(variavel) => {
              const motivo = aoCriarVariavel(variavel)
              if (motivo === null) fecharCriacao()
              return motivo
            }}
            aoCancelar={fecharCriacao}
          />
        )}
      </div>
    </div>
  )
}
