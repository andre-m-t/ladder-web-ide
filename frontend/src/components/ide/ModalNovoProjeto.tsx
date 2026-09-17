/**
 * Modal de criação de projeto (spec 002, tarefa #26, frente M).
 *
 * Segundo passo do fluxo "Novo projeto" — só abre depois da confirmação de
 * descarte, quando ela é necessária (decisão de quem monta este componente).
 * Pede o título (pré-preenchido com `TITULO_PADRAO` e já selecionado, para o
 * usuário poder simplesmente digitar por cima) e a linguagem do projeto —
 * decisão que passa a ser única e fixa no projeto (spec 002), não mais uma
 * aba alternável depois de criado.
 *
 * A escolha de linguagem é um `radiogroup` com dois cartões `role="radio"` e
 * tabindex circulante (WAI-ARIA radiogroup): só o cartão selecionado está na
 * sequência de Tab, as setas movem a seleção e o foco entre eles. Título vazio
 * ou inválido (`validarTitulo`, `../../projeto/projeto`) mostra o motivo abaixo
 * do campo e não chama `aoCriar`.
 */
import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react'

import { FileCode, Network } from 'lucide-react'

import { TITULO_PADRAO, validarTitulo, type Linguagem } from '../../projeto/projeto'
import Modal from './Modal'

export interface ModalNovoProjetoProps {
  aoCriar: (titulo: string, linguagem: Linguagem) => void
  aoCancelar: () => void
}

interface OpcaoLinguagem {
  linguagem: Linguagem
  rotulo: string
  descricao: string
  Icone: ComponentType<{ 'aria-hidden'?: boolean; size?: number; className?: string }>
}

const OPCOES: OpcaoLinguagem[] = [
  { linguagem: 'ld', rotulo: 'Ladder (LD)', descricao: 'Diagrama de contatos e bobinas', Icone: Network },
  { linguagem: 'st', rotulo: 'Texto Estruturado (ST)', descricao: 'Programa em texto IEC 61131-3', Icone: FileCode },
]

const TECLAS_SETA = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'])

export default function ModalNovoProjeto({ aoCriar, aoCancelar }: ModalNovoProjetoProps) {
  const [titulo, setTitulo] = useState(TITULO_PADRAO)
  const [linguagem, setLinguagem] = useState<Linguagem>('ld')
  const [erro, setErro] = useState<string | null>(null)

  const idBase = useId()
  const idCampo = `${idBase}-titulo`
  const idErro = `${idBase}-erro`

  const inputRef = useRef<HTMLInputElement>(null)
  const refsOpcoes = useRef(new Map<Linguagem, HTMLDivElement>())

  useEffect(() => {
    // Só na montagem: seleciona o texto pré-preenchido para o usuário digitar por cima.
    inputRef.current?.select()
  }, [])

  function tentarCriar() {
    const motivo = validarTitulo(titulo)
    if (motivo) {
      setErro(motivo)
      return
    }
    aoCriar(titulo.trim(), linguagem)
  }

  function aoMudarTitulo(valor: string) {
    setTitulo(valor)
    if (erro !== null) setErro(null)
  }

  function aoTeclarCampo(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    tentarCriar()
  }

  function escolher(alvo: Linguagem) {
    setLinguagem(alvo)
    refsOpcoes.current.get(alvo)?.focus()
  }

  function aoTeclarRadiogroup(evento: KeyboardEvent<HTMLDivElement>) {
    if (!TECLAS_SETA.has(evento.key)) return
    evento.preventDefault()

    const indiceAtual = OPCOES.findIndex((opcao) => opcao.linguagem === linguagem)
    const delta = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? 1 : -1
    const proximo = OPCOES[(indiceAtual + delta + OPCOES.length) % OPCOES.length]
    escolher(proximo.linguagem)
  }

  return (
    <Modal
      titulo="Novo projeto"
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
            Criar projeto
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCampo} className="text-sm text-ide-texto">
          Título do projeto
        </label>
        <input
          id={idCampo}
          ref={inputRef}
          type="text"
          value={titulo}
          onChange={(evento) => aoMudarTitulo(evento.target.value)}
          onKeyDown={aoTeclarCampo}
          aria-invalid={erro !== null}
          aria-describedby={erro !== null ? idErro : undefined}
          className="rounded border border-ide-borda bg-ide-fundo px-2 py-1 text-sm text-ide-texto"
        />
        {erro !== null && (
          <p id={idErro} className="text-xs text-ide-perigo">
            {erro}
          </p>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm text-ide-texto">Linguagem</legend>
        <div role="radiogroup" aria-label="Linguagem" onKeyDown={aoTeclarRadiogroup} className="mt-2 flex gap-2">
          {OPCOES.map((opcao) => {
            const selecionada = opcao.linguagem === linguagem
            return (
              <div
                key={opcao.linguagem}
                ref={(el) => {
                  if (el) refsOpcoes.current.set(opcao.linguagem, el)
                  else refsOpcoes.current.delete(opcao.linguagem)
                }}
                role="radio"
                aria-checked={selecionada}
                tabIndex={selecionada ? 0 : -1}
                onClick={() => escolher(opcao.linguagem)}
                className={
                  selecionada
                    ? 'flex flex-1 cursor-pointer flex-col items-start gap-1 rounded-lg border-2 border-ide-destaque bg-ide-elevado p-3'
                    : 'flex flex-1 cursor-pointer flex-col items-start gap-1 rounded-lg border border-ide-borda p-3 hover:bg-ide-elevado'
                }
              >
                <opcao.Icone aria-hidden size={20} className="text-ide-texto" />
                <span className="text-sm font-medium text-ide-texto">{opcao.rotulo}</span>
                <span className="text-xs text-ide-suave">{opcao.descricao}</span>
              </div>
            )
          })}
        </div>
      </fieldset>
    </Modal>
  )
}
