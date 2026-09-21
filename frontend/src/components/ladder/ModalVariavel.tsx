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
 *
 * **CTU: saída e limite (tarefa #18, D-19):** o CTU é tratado como bobina na
 * escolha de variável (`ehElementoBobina`, entradas desabilitadas) — o
 * vínculo grava `saida` (`variavelDoElemento`/`vincularVariavel` já cobrem
 * essa diferença de forma, nenhuma mudança de lógica de escolha aqui). Só
 * para um CTU, um campo numérico "Limite (PV)" some abaixo da lista: os
 * atributos `min`/`max`/`step` do `<input type="number">` são só uma dica
 * nativa — quem decide de fato se o valor é válido é o núcleo
 * (`ctu.ts#atualizarCtu`), via `aoAlterarLimite`; confirmar não fecha o modal
 * (o autor pode querer também escolher a variável de saída na mesma visita).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

import { classeDaVariavel, type ClasseVariavel } from '../../ladder/enderecos'
import { PV_MAX, PV_MIN } from '../../ladder/ctu'
import { ehBobina, ehCtu, variavelDoElemento, type Elemento, type Variavel } from '../../ladder/modelo'

export interface ModalVariavelProps {
  /** Elemento cujo vínculo está sendo editado — o modal só é montado quando aberto. */
  elemento: Elemento
  variaveis: Variavel[]
  aoEscolher: (nome: string | null) => void
  aoFechar: () => void
  /** CTU (tarefa #18): chamado ao confirmar um novo limite (PV) — o
   * `EditorLadder` aplica via `atualizarCtu` e recusa com motivo se
   * inválido. Sem esta prop, o botão "Aplicar limite" não tem efeito. O
   * campo só aparece quando o elemento é um CTU. */
  aoAlterarLimite?: (pv: number) => void
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
    case 'ctu':
      return 'contador CTU'
  }
}

/** Marcador de "sem variável" nos atributos `data-opcao` (nomes de variável
 * são identificadores IEC — nunca colidem com este marcador). */
const OPCAO_SEM_VARIAVEL = '__sem-variavel__'

export default function ModalVariavel({ elemento, variaveis, aoEscolher, aoFechar, aoAlterarLimite }: ModalVariavelProps) {
  const idTitulo = useId()
  const idLimite = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const ehElementoBobina = ehBobina(elemento.tipo) || elemento.tipo === 'ctu'
  // Mesmo motivo da bobina (RF-9: entrada só é lida, nunca escrita), mas o
  // texto muda para o CTU — "escrita por bobina" não fazia sentido para um
  // contador (ajuste pedido depois da verificação em Chromium).
  const motivoDesabilitada = ehCtu(elemento) ? 'entradas não podem ser escritas pelo contador' : 'entradas não podem ser escritas por bobina'
  const vinculoAtual = variavelDoElemento(elemento)
  const [pv, setPv] = useState(() => (ehCtu(elemento) ? String(elemento.pv) : ''))

  useEffect(() => {
    const container = dialogRef.current
    if (!container) return

    const vinculo = vinculoAtual
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

  /** Confirma o limite (PV) digitado — o núcleo (`atualizarCtu`) é quem
   * decide se o número é válido; aqui só descartamos texto que não vira
   * número nenhum (não há o que enviar). */
  function confirmarLimite() {
    const numero = Number(pv)
    if (Number.isNaN(numero)) return
    aoAlterarLimite?.(numero)
  }

  function aoTeclarNoLimite(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmarLimite()
    }
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
              aria-current={vinculoAtual === null ? 'true' : undefined}
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
                  aria-current={vinculoAtual === variavel.nome ? 'true' : undefined}
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
                  {desabilitada && <span className="block text-xs text-ide-perigo">{motivoDesabilitada}</span>}
                </button>
              </li>
            )
          })}
        </ul>

        {variaveis.length === 0 && <p className="mt-2 text-sm text-ide-suave">Crie variáveis na tabela ao lado.</p>}

        {ehCtu(elemento) && (
          <div className="mt-3 flex flex-col gap-1 border-t border-ide-borda pt-3">
            <label htmlFor={idLimite} className="text-xs font-medium text-ide-texto">
              Limite (PV)
            </label>
            <div className="flex gap-2">
              <input
                id={idLimite}
                type="number"
                min={PV_MIN}
                max={PV_MAX}
                step={1}
                value={pv}
                onChange={(evento) => setPv(evento.target.value)}
                onKeyDown={aoTeclarNoLimite}
                className="w-24 rounded border border-ide-borda bg-ide-painel p-1 text-sm text-ide-texto"
              />
              <button
                type="button"
                onClick={confirmarLimite}
                className="rounded border border-ide-borda px-2 py-1 text-xs text-ide-texto hover:bg-ide-painel"
              >
                Aplicar limite
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={aoFechar} className="rounded border border-ide-borda px-3 py-1 text-sm text-ide-texto hover:bg-ide-painel">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
