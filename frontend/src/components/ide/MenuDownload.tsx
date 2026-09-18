/**
 * Botão de download no cabeçalho da IDE, ao lado do Compilar (rodada de UX,
 * frente D). A aba "ST gerado" saiu da tela; no lugar, este botão abre um
 * menu com as opções de download que o autor pode querer — hoje, o projeto
 * como JSON e o texto Structured Text. Puramente apresentacional: quem
 * decide quais opções existem e o que cada uma baixa é quem monta `opcoes`
 * (`App`); este componente só mostra o menu e avisa a escolha via
 * `aoEscolher`.
 *
 * Acessibilidade no mesmo espírito de `Modal.tsx`: `role="menu"` com itens
 * `role="menuitem"`, abre focando o primeiro item habilitado, setas ↑/↓
 * navegam com volta nas pontas, Enter/Espaço escolhem, Esc fecha e devolve o
 * foco ao botão que abriu, clique fora fecha, Tab fecha (não há por que
 * reter o foco dentro de um menu solto, diferente do diálogo modal). Item
 * desabilitado (`desabilitadaMotivo` definido) não dispara `aoEscolher` e
 * mostra o motivo como texto pequeno abaixo do rótulo, além de no `title`.
 */
import { Download } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface OpcaoDownload {
  id: 'ld' | 'st'
  /** Ex.: "Ladder (.json)", "Structured Text (.st)". */
  rotulo: string
  /** Definida, a opção fica desabilitada e mostra o motivo (visível e no `title`). */
  desabilitadaMotivo?: string
}

export interface MenuDownloadProps {
  opcoes: OpcaoDownload[]
  aoEscolher: (id: OpcaoDownload['id']) => void
}

/** Tamanho consistente com os demais ícones da barra superior. */
const TAMANHO_ICONE = 16

export default function MenuDownload({ opcoes, aoEscolher }: MenuDownloadProps) {
  const [aberto, setAberto] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itensRef = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!aberto) return

    const indicePrimeiroHabilitado = opcoes.findIndex((opcao) => !opcao.desabilitadaMotivo)
    if (indicePrimeiroHabilitado >= 0) {
      itensRef.current[indicePrimeiroHabilitado]?.focus()
    }

    function aoClicarFora(evento: MouseEvent) {
      if (menuRef.current?.contains(evento.target as Node)) return
      if (botaoRef.current?.contains(evento.target as Node)) return
      setAberto(false)
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto, opcoes])

  function fechar(devolveFoco: boolean) {
    setAberto(false)
    if (devolveFoco) botaoRef.current?.focus()
  }

  function escolher(opcao: OpcaoDownload) {
    if (opcao.desabilitadaMotivo) return
    aoEscolher(opcao.id)
    fechar(true)
  }

  function foca(indice: number) {
    itensRef.current[indice]?.focus()
  }

  function aoTeclarNoMenu(evento: KeyboardEvent<HTMLDivElement>) {
    const total = opcoes.length
    if (total === 0) return

    if (evento.key === 'Escape') {
      evento.preventDefault()
      fechar(true)
      return
    }
    if (evento.key === 'Tab') {
      fechar(false)
      return
    }
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      const atual = itensRef.current.findIndex((el) => el === document.activeElement)
      foca((atual + 1) % total)
      return
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      const atual = itensRef.current.findIndex((el) => el === document.activeElement)
      foca((atual - 1 + total) % total)
    }
  }

  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        title="Baixar projeto"
        aria-label="Baixar projeto"
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-ide-texto hover:bg-ide-elevado"
      >
        <Download aria-hidden="true" size={TAMANHO_ICONE} />
        <span className="hidden sm:inline">Baixar</span>
      </button>

      {aberto && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Baixar projeto"
          onKeyDown={aoTeclarNoMenu}
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-ide-borda bg-ide-painel py-1 text-sm text-ide-texto shadow-lg"
        >
          {opcoes.map((opcao, indice) => {
            const desabilitada = Boolean(opcao.desabilitadaMotivo)
            return (
              <button
                key={opcao.id}
                ref={(el) => {
                  itensRef.current[indice] = el
                }}
                type="button"
                role="menuitem"
                aria-disabled={desabilitada}
                title={opcao.desabilitadaMotivo ?? opcao.rotulo}
                onClick={() => escolher(opcao)}
                className={
                  desabilitada
                    ? 'flex w-full cursor-not-allowed flex-col items-start gap-0.5 px-3 py-1.5 text-left text-ide-suave opacity-50'
                    : 'flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-ide-elevado'
                }
              >
                <span>{opcao.rotulo}</span>
                {opcao.desabilitadaMotivo && <span className="text-xs text-ide-suave">{opcao.desabilitadaMotivo}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
