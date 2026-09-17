/**
 * Modal de vínculo elemento↔variável (plano D-12, tarefa #22, frente D1).
 *
 * Abre (responsabilidade de `EditorLadder`, frente D2) ao soltar um item novo
 * na grade e no duplo clique/Enter sobre um item já existente. Só é montado
 * quando aberto (`elemento` não é opcional), e devolver o foco ao item na
 * grade ao fechar é responsabilidade de quem monta este componente, não
 * deste arquivo.
 *
 * Sem dependência: `role="dialog"` + `aria-modal` + `aria-labelledby`, foco
 * preso com Tab/Shift+Tab calculado a cada tecla (não guardado em estado,
 * porque o conjunto de botões habilitados não muda depois de montado), Esc e
 * "Cancelar" fecham, clique no overlay fecha (clique dentro do diálogo não
 * propaga). Antecipa a validação `bobina_escreve_entrada` (que continua
 * existindo em `validacao.ts`): variável de classe entrada aparece desabilitada
 * quando o elemento é uma bobina, para não deixar o usuário criar o problema
 * pelo modal.
 *
 * **Tokens só (tarefa #23, D-13):** o painel usa `bg-ide-elevado`/`text-ide-*`;
 * o overlay é um escurecimento neutro (`bg-black/60`), independente de tema.
 */
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react'

import { classeDaVariavel, type ClasseVariavel } from '../../ladder/enderecos'
import { ehBobina, type Elemento, type Variavel } from '../../ladder/modelo'

export interface ModalVariavelProps {
  /** Elemento cujo vínculo está sendo editado — o modal só é montado quando aberto. */
  elemento: Elemento
  variaveis: Variavel[]
  aoEscolher: (nome: string | null) => void
  aoFechar: () => void
}

const ROTULO_CLASSE: Record<ClasseVariavel, string> = {
  entrada: 'entrada',
  saida: 'saída',
  interna: 'interna',
}

function rotuloTipoElemento(tipo: Elemento['tipo']): string {
  switch (tipo) {
    case 'contato_na':
      return 'contato NA'
    case 'contato_nf':
      return 'contato NF'
    case 'bobina':
      return 'bobina'
    case 'bobina_set':
      return 'bobina SET'
    case 'bobina_reset':
      return 'bobina RESET'
  }
}

/** Marcador de "sem variável" nos atributos `data-opcao` (nomes de variável
 * são identificadores IEC — nunca colidem com este marcador). */
const OPCAO_SEM_VARIAVEL = '__sem-variavel__'

export default function ModalVariavel({ elemento, variaveis, aoEscolher, aoFechar }: ModalVariavelProps) {
  const idTitulo = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const ehElementoBobina = ehBobina(elemento.tipo)

  useEffect(() => {
    const container = dialogRef.current
    if (!container) return

    const vinculo = elemento.variavel
    const alvoVinculado =
      vinculo !== null
        ? container.querySelector<HTMLButtonElement>(`[data-opcao="${vinculo}"]:not(:disabled)`)
        : container.querySelector<HTMLButtonElement>(`[data-opcao="${OPCAO_SEM_VARIAVEL}"]`)

    const alvo = alvoVinculado ?? container.querySelector<HTMLButtonElement>('button:not(:disabled)')
    alvo?.focus()
    // Só na montagem: o conjunto de opções não muda enquanto o modal está aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function focaveis(): HTMLButtonElement[] {
    const container = dialogRef.current
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  }

  function aoTeclarNoDialogo(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      aoFechar()
      return
    }
    if (evento.key !== 'Tab') return

    const lista = focaveis()
    if (lista.length === 0) return
    const primeiro = lista[0]
    const ultimo = lista[lista.length - 1]

    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primeiro.focus()
    }
  }

  function aoClicarOverlay() {
    aoFechar()
  }

  function aoClicarDialogo(evento: MouseEvent<HTMLDivElement>) {
    evento.stopPropagation()
  }

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
        <h2 id={idTitulo} className="text-sm font-semibold text-ide-texto">
          Variável do {rotuloTipoElemento(elemento.tipo)}
        </h2>

        <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
          <li>
            <button
              type="button"
              data-opcao={OPCAO_SEM_VARIAVEL}
              aria-current={elemento.variavel === null ? 'true' : undefined}
              onClick={() => aoEscolher(null)}
              className="w-full rounded border border-ide-borda px-2 py-1 text-left text-sm text-ide-texto hover:bg-ide-painel"
            >
              Sem variável
            </button>
          </li>

          {variaveis.map((variavel) => {
            const classe = classeDaVariavel(variavel)
            const desabilitada = ehElementoBobina && classe === 'entrada'
            return (
              <li key={variavel.nome}>
                <button
                  type="button"
                  data-opcao={variavel.nome}
                  disabled={desabilitada}
                  aria-current={elemento.variavel === variavel.nome ? 'true' : undefined}
                  onClick={() => aoEscolher(variavel.nome)}
                  className="w-full rounded border border-ide-borda px-2 py-1 text-left text-sm text-ide-texto hover:bg-ide-painel disabled:cursor-not-allowed disabled:bg-ide-fundo disabled:text-ide-suave"
                >
                  <span>
                    <span className="font-mono">{variavel.nome}</span>{' '}
                    <span className="text-ide-suave">
                      ({ROTULO_CLASSE[classe]}
                      {variavel.endereco ? ` ${variavel.endereco}` : ''})
                    </span>
                  </span>
                  {desabilitada && <span className="block text-xs text-ide-perigo">entradas não podem ser escritas por bobina</span>}
                </button>
              </li>
            )
          })}
        </ul>

        {variaveis.length === 0 && <p className="mt-2 text-sm text-ide-suave">Crie variáveis na tabela ao lado.</p>}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={aoFechar} className="rounded border border-ide-borda px-3 py-1 text-sm text-ide-texto hover:bg-ide-painel">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
