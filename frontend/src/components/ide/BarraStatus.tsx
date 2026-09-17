/**
 * Barra de status da IDE (spec 002, tarefa #25): linha fina no rodapé,
 * abaixo do painel inferior, para recusas de jogada do editor Ladder e do
 * painel de variáveis (`aoRecusar`, contrato fixado com as frentes L e V) —
 * o texto de recusa deixa de aparecer só dentro do editor e passa a
 * aparecer aqui, além de ir para o Console (`App.recusar`).
 *
 * Controlada por `App`: recebe `mensagem` (ou `null`) com um `token`
 * incremental — a cada recusa nova, mesmo que o texto se repita, `token`
 * muda e o temporizador de 6s reinicia. `App` nunca precisa voltar
 * `mensagem` a `null` de novo: quem decide quando some é este componente,
 * sozinho, pelo próprio temporizador.
 *
 * Sem mensagem (ou depois que a mensagem some), a barra continua no layout
 * — nunca ocupa espaço zero — com um texto neutro discreto ("Pronto"), para
 * não dar a impressão de um elemento quebrado ou ausente.
 */
import { useEffect, useState } from 'react'
import { CircleX, TriangleAlert } from 'lucide-react'

export interface MensagemStatus {
  texto: string
  nivel: 'aviso' | 'erro'
  token: number
}

export interface BarraStatusProps {
  mensagem: MensagemStatus | null
}

/** Tempo até a mensagem sumir sozinha (ms). */
export const DURACAO_MENSAGEM_STATUS_MS = 6000

const ICONE_NIVEL = {
  aviso: TriangleAlert,
  erro: CircleX,
} as const

const COR_NIVEL = {
  aviso: 'text-ide-aviso',
  erro: 'text-ide-perigo',
} as const

export default function BarraStatus({ mensagem }: BarraStatusProps) {
  const [visivel, setVisivel] = useState(mensagem !== null)

  useEffect(() => {
    if (mensagem === null) {
      setVisivel(false)
      return
    }
    setVisivel(true)
    const temporizador = window.setTimeout(() => setVisivel(false), DURACAO_MENSAGEM_STATUS_MS)
    return () => window.clearTimeout(temporizador)
    // Só `token` decide quando o temporizador reinicia (ver JSDoc acima) —
    // repetir o mesmo texto/nível sem mudar o token não deve reiniciar nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagem?.token])

  const mostrar = mensagem !== null && visivel
  const Icone = mostrar ? ICONE_NIVEL[mensagem.nivel] : null

  return (
    <div role="status" className="flex h-6 shrink-0 items-center gap-1.5 border-t border-ide-borda bg-ide-painel px-3 text-xs">
      {mostrar && Icone ? (
        <>
          <Icone aria-hidden="true" size={13} className={`shrink-0 ${COR_NIVEL[mensagem.nivel]}`} />
          <span className={`truncate ${COR_NIVEL[mensagem.nivel]}`}>{mensagem.texto}</span>
        </>
      ) : (
        <span className="truncate text-ide-suave">Pronto</span>
      )}
    </div>
  )
}
