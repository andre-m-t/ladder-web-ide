/**
 * Toasts de recusa do editor Ladder (spec 002, tarefa #27, plano D-18).
 *
 * Até agora, uma ação recusada pelo editor (ex.: "posição inválida",
 * "coluna ocupada") só aparecia na aba "Mensagens" do painel inferior — o
 * usuário não percebia em tempo real, porque nada chama atenção para uma aba
 * que pode estar fechada. O autor decidiu: essas recusas (nível `aviso`)
 * também viram um toast, no canto da tela, autoexplicativo e temporário. O
 * Console não muda — nada dele vira toast.
 *
 * Só `aviso` é emitido hoje; o tipo suporta os quatro níveis de
 * `EntradaConsole` (`info | sucesso | aviso | erro`) para uso futuro, sem
 * precisar mudar esta assinatura de novo.
 *
 * Módulo puro, no mesmo espírito de `lib/console.ts`: `adicionarToast` e
 * `removerToast` devolvem uma lista nova, nunca mutam a recebida, para caber
 * direto num `setState` funcional em `App`.
 */

export type NivelToast = 'info' | 'sucesso' | 'aviso' | 'erro'

export interface Toast {
  id: number
  nivel: NivelToast
  mensagem: string
  /** Incrementa quando a mesma mensagem (mesmo nível) se repete em sequência,
   * em vez de empilhar um toast idêntico. O componente usa `versao` como
   * parte da chave do temporizador, para reiniciar a contagem a cada repetição. */
  versao: number
}

/** Toasts guardados ao mesmo tempo antes de `adicionarToast` descartar os mais antigos. */
export const LIMITE_TOASTS = 3

/**
 * Acrescenta um toast a `toasts`.
 *
 * Se o ÚLTIMO toast da lista tem o mesmo nível e a mesma mensagem, não
 * empilha um duplicado: devolve a lista com esse toast substituído por uma
 * cópia com `versao + 1`, o que o componente usa para reiniciar o
 * temporizador sem trocar o `id` (evita "piscar" o toast). Só o último é
 * comparado — um toast repetido depois de outro diferente empilha normalmente.
 *
 * Acima de `LIMITE_TOASTS`, descarta os mais antigos (os primeiros do array).
 */
export function adicionarToast(toasts: Toast[], nivel: NivelToast, mensagem: string): Toast[] {
  const ultimo = toasts.at(-1)
  if (ultimo && ultimo.nivel === nivel && ultimo.mensagem === mensagem) {
    return [...toasts.slice(0, -1), { ...ultimo, versao: ultimo.versao + 1 }]
  }

  const proximoId = (toasts.at(-1)?.id ?? 0) + 1
  const atualizado = [...toasts, { id: proximoId, nivel, mensagem, versao: 1 }]
  return atualizado.length > LIMITE_TOASTS ? atualizado.slice(atualizado.length - LIMITE_TOASTS) : atualizado
}

/** Remove o toast com o `id` informado (fechado manualmente ou expirado). */
export function removerToast(toasts: Toast[], id: number): Toast[] {
  return toasts.filter((toast) => toast.id !== id)
}

/** Duração em ms de cada nível antes de fechar sozinho; `null` = só fecha
 * manualmente (nível `erro`: o usuário precisa ler e agir, não some sozinho). */
export function duracaoToast(nivel: NivelToast): number | null {
  return nivel === 'erro' ? null : 5000
}
