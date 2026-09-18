/**
 * Toasts de recusa do editor Ladder (spec 002, tarefa #27, plano D-18) —
 * substituem a aba Mensagens da tarefa #26.
 *
 * Companheiro de `lib/toasts.ts`: aquele módulo decide a lista (empilhar,
 * mesclar repetição, descartar excesso); este componente só mostra, com um
 * temporizador por toast, e delega o fechamento a `aoFechar` — controlado,
 * o estado da lista vive em `App`, como o `Console` com `entradas`.
 *
 * Empilhados no canto inferior direito, mais novo embaixo (ordem natural do
 * array: `lib/toasts.ts` acrescenta ao fim). Ícone e cor por nível repetem o
 * padrão do `Console` (e da antiga aba Mensagens) (tokens `text-ide-suave/sucesso/
 * aviso/perigo`), com uma borda esquerda colorida a mais, já que aqui a cor
 * precisa ser reconhecível sem ler o texto ao lado de outras entradas.
 *
 * Acessibilidade: a região é `aria-live="polite"` + `aria-relevant="additions"`
 * (só nova entrada é anunciada; fechar um toast não deveria interromper o
 * usuário). Dentro, cada toast tem `role="alert"` se for `erro` — quer
 * interromper o leitor de tela, porque não fecha sozinho — e `role="status"`
 * nos demais.
 *
 * Temporizador: cada toast usa `duracaoToast(nivel)`; `erro` não recebe
 * temporizador (`null`, só fecha pelo botão). Ao passar `versao` (mesma
 * mensagem repetida — ver `lib/toasts.ts`), o tempo total reinicia do zero.
 * Ao pairar o ponteiro OU focar o toast (teclado), o temporizador pausa;
 * decisão de design: ao retomar, continua do tempo QUE FALTAVA (não reinicia
 * do total) — mais previsível para quem só tirou o mouse de cima um
 * instante. Cada toast limpa seu próprio `setTimeout` ao desmontar.
 */
import { CheckCircle2, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { duracaoToast, type NivelToast, type Toast } from '../../lib/toasts'

export interface ToastsProps {
  toasts: Toast[]
  aoFechar: (id: number) => void
}

const ICONE_NIVEL: Record<NivelToast, typeof Info> = {
  info: Info,
  sucesso: CheckCircle2,
  aviso: TriangleAlert,
  erro: CircleX,
}

const COR_ICONE_NIVEL: Record<NivelToast, string> = {
  info: 'text-ide-suave',
  sucesso: 'text-ide-sucesso',
  aviso: 'text-ide-aviso',
  erro: 'text-ide-perigo',
}

const BORDA_NIVEL: Record<NivelToast, string> = {
  info: 'border-l-ide-suave',
  sucesso: 'border-l-ide-sucesso',
  aviso: 'border-l-ide-aviso',
  erro: 'border-l-ide-perigo',
}

export default function Toasts({ toasts, aoFechar }: ToastsProps) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ItemToast key={toast.id} toast={toast} aoFechar={aoFechar} />
      ))}
    </div>
  )
}

interface ItemToastProps {
  toast: Toast
  aoFechar: (id: number) => void
}

function ItemToast({ toast, aoFechar }: ItemToastProps) {
  const duracao = duracaoToast(toast.nivel)
  const restanteRef = useRef(duracao ?? 0)
  const [pairando, setPairando] = useState(false)
  const [focado, setFocado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const pausado = pairando || focado

  // Uma repetição da mesma mensagem (versao muda) reinicia a contagem do zero.
  useEffect(() => {
    restanteRef.current = duracao ?? 0
  }, [toast.versao, duracao])

  useEffect(() => {
    // Leve atraso para a transição de entrada partir de "invisível" (evita
    // entrar já no estado final, o que pularia a transição em alguns navegadores).
    const id = requestAnimationFrame(() => setVisivel(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (duracao === null) return undefined // erro: só fecha manualmente, sem temporizador
    if (pausado) return undefined // pausado: nenhum timer ativo enquanto isso for verdade

    // Retoma do tempo que faltava (não reinicia do total) — ver JSDoc do módulo.
    const inicio = Date.now()
    const timer = setTimeout(() => aoFechar(toast.id), restanteRef.current)

    return () => {
      clearTimeout(timer)
      restanteRef.current = Math.max(0, restanteRef.current - (Date.now() - inicio))
    }
    // aoFechar de propósito fora das deps: é a mesma ação (fechar este id),
    // recriar a função no App não deve reiniciar o temporizador em andamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausado, toast.versao, duracao, toast.id])

  const Icone = ICONE_NIVEL[toast.nivel]

  return (
    <div
      role={toast.nivel === 'erro' ? 'alert' : 'status'}
      onMouseEnter={() => setPairando(true)}
      onMouseLeave={() => setPairando(false)}
      onFocus={() => setFocado(true)}
      onBlur={() => setFocado(false)}
      className={`flex items-start gap-2 rounded-md border border-ide-borda border-l-4 ${BORDA_NIVEL[toast.nivel]} bg-ide-painel px-3 py-2 shadow-lg transition-all duration-200 motion-reduce:transition-none ${visivel ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
    >
      <Icone aria-hidden="true" size={16} className={`mt-0.5 shrink-0 ${COR_ICONE_NIVEL[toast.nivel]}`} />
      <p className="min-w-0 flex-1 text-sm text-ide-texto">{toast.mensagem}</p>
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={() => aoFechar(toast.id)}
        className="shrink-0 rounded text-ide-suave hover:text-ide-texto focus-visible:outline focus-visible:outline-2 focus-visible:outline-ide-destaque"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  )
}
