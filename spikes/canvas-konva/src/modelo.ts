export interface Variavel { nome: string; tipo: 'BOOL' | 'UINT'; endereco?: string }
export interface Celula { linha: number; coluna: number } // linha 0 = trilho principal; linha>0 = ramo paralelo
export type TipoContato = 'contato_na' | 'contato_nf'
export type TipoBobina = 'bobina' | 'bobina_set' | 'bobina_reset'
export type Elemento =
  | { id: string; tipo: TipoContato | TipoBobina; celula: Celula; variavel: string | null }
  | { id: string; tipo: 'ctu'; celula: Celula; instancia: string | null; pv: number; saida: string | null }
export interface Ramo { id: string; linha: number; colunaInicio: number; colunaFim: number }
export interface Rung { id: string; colunas: number; elementos: Elemento[]; ramos: Ramo[] }
export interface Diagrama { versao: 1; variaveis: Variavel[]; rungs: Rung[] }
