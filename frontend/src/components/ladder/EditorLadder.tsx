/**
 * Editor Ladder da fatia 1 (spec 002, plano D-3/D-4, tarefa #7).
 *
 * Orquestra o núcleo puro (`ladder/edicao.ts`) e os componentes de desenho
 * (`Paleta`, `GradeDegrau`, `PainelVariaveis`): mantém o `Diagrama` em estado
 * React e a ferramenta/seleção ativas, mas nunca decide sozinho se uma edição
 * é válida — toda mudança passa por uma operação de `edicao.ts`, que ou
 * devolve o novo diagrama, ou recusa com um motivo em português. A recusa
 * nunca altera o diagrama e aparece em `role="alert"` (reaproveitando o
 * `erro` de `PainelVariaveis`, já testado com esse papel).
 *
 * Interação por seleção (D-4, R-2): escolhe-se uma ferramenta na paleta (ou
 * nenhuma) e depois a célula de destino. Sem ferramenta, clicar/Enter numa
 * célula só seleciona o elemento ali (ou limpa a seleção, se vazia) — é como
 * se prepara o vínculo de variável no painel. `Esc` cancela a ferramenta
 * ativa e limpa a última recusa.
 *
 * Sem lista de problemas nesta fatia (entra na tarefa #13): `validarDiagrama`
 * não é chamado aqui.
 */
import { useState, type KeyboardEvent } from 'react'

import { declararVariavel, diagramaVazio, inserirElemento, removerElemento, vincularVariavel } from '../../ladder/edicao'
import type { ResultadoEdicao } from '../../ladder/edicao'
import type { Celula, Diagrama, Elemento } from '../../ladder/modelo'
import GradeDegrau from './GradeDegrau'
import Paleta, { type Ferramenta } from './Paleta'
import PainelVariaveis from './PainelVariaveis'

export interface EditorLadderProps {
  /** Diagrama de partida; por padrão, um degrau vazio (`diagramaVazio()`). */
  diagramaInicial?: Diagrama
  /** Chamado a cada mudança bem-sucedida do diagrama (persistência é a tarefa #12). */
  aoMudar?: (diagrama: Diagrama) => void
}

function elementoNaCelula(diagrama: Diagrama, rungId: string, celula: Celula): Elemento | undefined {
  const rung = diagrama.rungs.find((r) => r.id === rungId)
  return rung?.elementos.find((e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna)
}

function elementoPorId(diagrama: Diagrama, id: string | null): Elemento | null {
  if (id === null) return null
  for (const rung of diagrama.rungs) {
    const encontrado = rung.elementos.find((e) => e.id === id)
    if (encontrado !== undefined) return encontrado
  }
  return null
}

export default function EditorLadder({ diagramaInicial, aoMudar }: EditorLadderProps = {}) {
  const [diagrama, setDiagrama] = useState<Diagrama>(diagramaInicial ?? diagramaVazio())
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)

  /** Aplica um `ResultadoEdicao`: recusa vira `motivo` sem tocar no diagrama;
   * sucesso troca o diagrama, limpa `motivo` e avisa `aoMudar`. */
  function aplicarResultado(resultado: ResultadoEdicao) {
    if (!resultado.ok) {
      setMotivo(resultado.motivo)
      return
    }
    setDiagrama(resultado.diagrama)
    setMotivo(null)
    aoMudar?.(resultado.diagrama)
  }

  function aoAtivarCelula(rungId: string, celula: Celula) {
    if (ferramenta === null) {
      const elemento = elementoNaCelula(diagrama, rungId, celula)
      setSelecionado(elemento ? elemento.id : null)
      return
    }

    if (ferramenta === 'remover') {
      const elemento = elementoNaCelula(diagrama, rungId, celula)
      if (elemento === undefined) {
        setMotivo('célula vazia: não há elemento para remover')
        return
      }
      const resultado = removerElemento(diagrama, elemento.id)
      aplicarResultado(resultado)
      if (resultado.ok && selecionado === elemento.id) {
        // ids são reaproveitados pelo núcleo: uma seleção velha não pode
        // continuar apontando para um elemento que ainda nem existe.
        setSelecionado(null)
      }
      return
    }

    const resultado = inserirElemento(diagrama, rungId, ferramenta, celula)
    aplicarResultado(resultado)
    if (resultado.ok) {
      const novoElemento = elementoNaCelula(resultado.diagrama, rungId, celula)
      setSelecionado(novoElemento ? novoElemento.id : null)
    }
  }

  function aoDeclarar(variavel: { nome: string; endereco?: string }) {
    aplicarResultado(declararVariavel(diagrama, variavel))
  }

  function aoVincular(elementoId: string, nome: string | null) {
    aplicarResultado(vincularVariavel(diagrama, elementoId, nome))
  }

  function aoTeclarNoEditor(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      setFerramenta(null)
      setMotivo(null)
    }
  }

  return (
    <div onKeyDown={aoTeclarNoEditor}>
      <Paleta ativa={ferramenta} aoEscolher={setFerramenta} />

      <div className="mt-4">
        {diagrama.rungs.map((rung, indice) => (
          <GradeDegrau key={rung.id} rung={rung} indice={indice} selecionado={selecionado} aoAtivarCelula={aoAtivarCelula} />
        ))}
      </div>

      <div className="mt-4">
        <PainelVariaveis
          variaveis={diagrama.variaveis}
          elementoSelecionado={elementoPorId(diagrama, selecionado)}
          aoDeclarar={aoDeclarar}
          aoVincular={aoVincular}
          erro={motivo}
        />
      </div>
    </div>
  )
}
