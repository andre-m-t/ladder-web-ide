/**
 * Modal de criação de **uma** variável (spec 005, revisão 2026-09-23; spec
 * 002, revisão 2026-09-23).
 *
 * Serve aos dois caminhos que evitam a ida e volta ao painel de variáveis
 * enquanto o ambiente ocupa o painel lateral:
 * - **contrato de E/S do ambiente** (`PainelAmbiente`): o endereço vem fixo do
 *   ponto e o nome vem sugerido do contrato — só falta confirmar;
 * - **propriedades do elemento** (`ModalVariavel`): o pino é escolhido entre
 *   os livres das classes que o elemento aceita (bobina não oferece entrada),
 *   e a variável criada já fica vinculada ao elemento.
 *
 * O modal não valida regra de negócio: `aoCriar` devolve o motivo da recusa
 * do núcleo (`declararVariavel` — nome inválido ou repetido, endereço em uso)
 * ou `null` no sucesso, e o motivo aparece abaixo do campo de nome, como em
 * `ModalNovoProjeto`. Nada de toast aqui: o overlay cobriria o toast.
 *
 * `sugerirNome(endereco)` propõe um nome para o pino escolhido (o rótulo do
 * ponto do ambiente, quando há ambiente aberto); a proposta acompanha a troca
 * de pino até o usuário digitar no campo — a partir daí o nome é dele.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react'

import { GPIO_DO_ENDERECO, classeDaVariavel, enderecosDaClasse, type ClasseVariavel } from '../../ladder/enderecos'
import type { Variavel } from '../../ladder/modelo'
import Modal from '../ide/Modal'

export interface ModalNovaVariavelProps {
  variaveis: readonly Variavel[]
  /** Endereço imposto por quem abre (ponto do contrato): o pino vira só leitura. */
  enderecoFixo?: string
  /** Classes oferecidas no seletor de pino, na ordem; a primeira com pino livre
   * é a inicial. Ignorado com `enderecoFixo`. */
  classes?: readonly ClasseVariavel[]
  sugerirNome?: (endereco: string | undefined) => string | undefined
  /** Rótulo de contexto por endereço (ex.: o ponto do ambiente que usa o pino). */
  rotuloDoEndereco?: (endereco: string) => string | undefined
  /** Linha de contexto abaixo do título (ex.: "Ponto «Abrir» do ambiente Portão"). */
  contexto?: string
  rotuloConfirmar?: string
  aoCriar: (variavel: { nome: string; endereco?: string }) => string | null
  aoCancelar: () => void
}

const ROTULO_CLASSE: Record<ClasseVariavel, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  interna: 'Memória',
}

const OPCAO_MEMORIA = ''

function enderecosLivres(variaveis: readonly Variavel[], classe: 'entrada' | 'saida'): string[] {
  const usados = new Set(variaveis.map((v) => v.endereco).filter((e): e is string => e !== undefined))
  return enderecosDaClasse(classe).filter((e) => !usados.has(e))
}

function enderecoInicial(variaveis: readonly Variavel[], classes: readonly ClasseVariavel[]): string {
  for (const classe of classes) {
    if (classe === 'interna') return OPCAO_MEMORIA
    const livre = enderecosLivres(variaveis, classe)[0]
    if (livre !== undefined) return livre
  }
  return OPCAO_MEMORIA
}

function rotuloPino(endereco: string, contexto?: string): string {
  return `GPIO ${GPIO_DO_ENDERECO[endereco]} · ${endereco}${contexto ? ` — ${contexto}` : ''}`
}

export default function ModalNovaVariavel({
  variaveis,
  enderecoFixo,
  classes = ['entrada', 'saida', 'interna'],
  sugerirNome,
  rotuloDoEndereco,
  contexto,
  rotuloConfirmar = 'Criar variável',
  aoCriar,
  aoCancelar,
}: ModalNovaVariavelProps) {
  const [endereco, setEndereco] = useState(() => enderecoFixo ?? enderecoInicial(variaveis, classes))
  const [nome, setNome] = useState(() => sugerirNome?.(enderecoFixo ?? (endereco || undefined)) ?? '')
  const [nomeEditado, setNomeEditado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const idBase = useId()
  const idNome = `${idBase}-nome`
  const idPino = `${idBase}-pino`
  const idErro = `${idBase}-erro`
  const inputRef = useRef<HTMLInputElement>(null)

  const enderecoEfetivo = endereco === OPCAO_MEMORIA ? undefined : endereco
  const classe = classeDaVariavel({ endereco: enderecoEfetivo })

  function aoMudarPino(novo: string) {
    setEndereco(novo)
    if (erro !== null) setErro(null)
    if (!nomeEditado) setNome(sugerirNome?.(novo === OPCAO_MEMORIA ? undefined : novo) ?? '')
  }

  function aoMudarNome(valor: string) {
    setNome(valor)
    setNomeEditado(true)
    if (erro !== null) setErro(null)
  }

  function tentarCriar() {
    const nomeLimpo = nome.trim()
    if (nomeLimpo.length === 0) {
      setErro('informe um nome para a variável')
      inputRef.current?.focus()
      return
    }
    const motivo = aoCriar(enderecoEfetivo === undefined ? { nome: nomeLimpo } : { nome: nomeLimpo, endereco: enderecoEfetivo })
    if (motivo !== null) {
      setErro(motivo)
      inputRef.current?.focus()
    }
  }

  function aoTeclarNome(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    tentarCriar()
  }

  return (
    <Modal
      titulo="Nova variável"
      aoFechar={aoCancelar}
      focoInicialRef={inputRef}
      rodape={
        <>
          <button
            type="button"
            onClick={aoCancelar}
            className="rounded-lg border border-ide-borda px-3 py-1.5 text-sm text-ide-texto hover:bg-ide-elevado"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={tentarCriar}
            className="rounded-lg bg-ide-destaque px-3 py-1.5 text-sm font-medium text-ide-destaque-texto shadow-sm"
          >
            {rotuloConfirmar}
          </button>
        </>
      }
    >
      {contexto && <p className="mb-3 text-xs text-ide-suave">{contexto}</p>}

      <div className="flex flex-col gap-1">
        <label htmlFor={idNome} className="text-sm text-ide-texto">
          Nome
        </label>
        <input
          id={idNome}
          ref={inputRef}
          type="text"
          value={nome}
          placeholder="ex.: botao_liga"
          onChange={(evento) => aoMudarNome(evento.target.value)}
          onKeyDown={aoTeclarNome}
          onFocus={(evento) => evento.currentTarget.select()}
          aria-invalid={erro !== null}
          aria-describedby={erro !== null ? idErro : undefined}
          className="rounded border border-ide-borda bg-ide-fundo px-2 py-1 font-mono text-sm text-ide-texto placeholder:text-ide-suave"
        />
        {erro !== null && (
          <p id={idErro} className="text-xs text-ide-perigo">
            {erro}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor={idPino} className="text-sm text-ide-texto">
          Pino
        </label>
        {enderecoFixo !== undefined ? (
          <output id={idPino} className="rounded border border-ide-borda bg-ide-elevado px-2 py-1 font-mono text-sm text-ide-texto">
            {rotuloPino(enderecoFixo)}
          </output>
        ) : (
          <select
            id={idPino}
            value={endereco}
            onChange={(evento) => aoMudarPino(evento.target.value)}
            className="rounded border border-ide-borda bg-ide-fundo px-2 py-1 font-mono text-sm text-ide-texto"
          >
            {classes.map((c) =>
              c === 'interna' ? (
                <option key={c} value={OPCAO_MEMORIA}>
                  Memória (sem pino)
                </option>
              ) : (
                <optgroup key={c} label={c === 'entrada' ? 'Entradas' : 'Saídas'}>
                  {enderecosLivres(variaveis, c).map((e) => (
                    <option key={e} value={e}>
                      {rotuloPino(e, rotuloDoEndereco?.(e))}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-ide-suave">Tipo</dt>
        <dd className="font-mono text-ide-texto">BOOL</dd>
        <dt className="text-ide-suave">Uso</dt>
        <dd className="text-ide-texto">{ROTULO_CLASSE[classe]}</dd>
      </dl>
    </Modal>
  )
}
