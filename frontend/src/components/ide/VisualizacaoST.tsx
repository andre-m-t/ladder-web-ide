/**
 * Visualização somente leitura do Structured Text gerado a partir do
 * diagrama Ladder (spec 003, tarefa #7, plano D-9/Q-1): recebe o
 * `ResultadoSerializacao` já calculado por `serializar` (`ladder/serializador.ts`)
 * — este componente não serializa nada, só exibe.
 *
 * Com `ok: true`, o texto aparece em `<pre>` monoespaçado e rolável, com a
 * numeração de linha numa coluna própria: `aria-hidden` e `select-none` para
 * que copiar o texto não arraste os números junto, e para casar com o
 * rastreio "degrau N" da Q-3 (o `mapaLinhas` que o serializador produz aponta
 * para essas mesmas linhas 1-based).
 *
 * Com `ok: false` (recusa de D-5 ou "nada a compilar" de D-7/Q-6), mostra o
 * `motivo` no lugar do texto, como estado vazio/aviso — sem `role="alert"`,
 * porque não é a IDE recusando uma ação da pessoa, é a descrição de um
 * resultado (a recusa de fato, no botão Compilar, é responsabilidade da
 * frente que integra em `App.tsx`).
 */
import type { ResultadoSerializacao } from '../../ladder/serializador'

export interface VisualizacaoSTProps {
  resultado: ResultadoSerializacao
}

export default function VisualizacaoST({ resultado }: VisualizacaoSTProps) {
  if (!resultado.ok) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-ide-suave">{resultado.motivo}</div>
    )
  }

  const linhas = resultado.st.split('\n')

  return (
    <div
      aria-label="Structured Text gerado a partir do diagrama (somente leitura)"
      className="flex h-full overflow-auto bg-ide-painel font-mono text-xs leading-relaxed"
    >
      <div aria-hidden="true" className="shrink-0 select-none border-r border-ide-borda px-2 py-1.5 text-right text-ide-suave">
        {linhas.map((_linha, indice) => (
          <div key={indice}>{indice + 1}</div>
        ))}
      </div>
      <pre className="flex-1 overflow-visible px-3 py-1.5">{resultado.st}</pre>
    </div>
  )
}
