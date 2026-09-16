// Modelo de dados da grade Ladder -- independente de biblioteca de renderizacao.
//
// Spike S4 da futura spec 002 (Editor Ladder). Ainda nao ha spec aprovada
// (constituicao SS1): este arquivo mora em spikes/modelo/, fora de
// frontend/src, e nao e consumido por nenhum codigo de producao.
//
// Ponto de partida OBRIGATORIO do exercicio: esta e a interface fornecida
// pelo autor, reproduzida sem alteracao. Outros agentes prototipam
// renderizacao sobre ela em paralelo -- ver NOTAS.md para o porque de cada
// decisao e para a lista (vazia) de mudancas feitas aqui.

export interface Variavel {
  nome: string
  tipo: 'BOOL' | 'UINT'
  endereco?: string
} // endereco: '%IX0.0' | '%QX0.1' ...

export interface Celula {
  linha: number
  coluna: number
} // linha 0 = trilho principal do rung; linha>0 = ramo paralelo

export type TipoContato = 'contato_na' | 'contato_nf'
export type TipoBobina = 'bobina' | 'bobina_set' | 'bobina_reset'

export type Elemento =
  | { id: string; tipo: TipoContato | TipoBobina; celula: Celula; variavel: string | null }
  | {
      id: string
      tipo: 'ctu'
      celula: Celula
      instancia: string | null
      pv: number
      saida: string | null
    }

export interface Ramo {
  id: string
  linha: number
  colunaInicio: number
  colunaFim: number
} // paralela a linha 0, junta-se nas colunas inicio/fim

export interface Rung {
  id: string
  colunas: number
  elementos: Elemento[]
  ramos: Ramo[]
}

export interface Diagrama {
  versao: 1
  variaveis: Variavel[]
  rungs: Rung[]
}
