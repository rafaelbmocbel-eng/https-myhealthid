import type { EstiloMarcacao } from '@/lib/angular/estilo';

/*
 * Tipos de apresentação da análise em vídeo: o que os componentes de tela recebem já pronto. A ligação com o
 * motor (trilha, ângulos, eventos, métricas e referências) fica num só lugar, `useResultadosGesto`, e os
 * componentes não conhecem o motor.
 */

export type Lado = 'D' | 'E';

export const COR_LADO: Record<Lado, string> = { D: '#2A78D6', E: '#EB6834' };
export const COR_CENTRO = '#d4d4d8';

export interface PontoPx { x: number; y: number }
export interface PontoQuadroUi extends PontoPx { manual?: boolean }
export type PontosDoQuadro = Record<string, PontoQuadroUi>;

export interface LigacaoUi { a: string; b: string; lado: Lado | null }

/** Ângulo a desenhar no quadro: dois braços a partir do vértice, o arco entre eles e o rótulo. */
export interface MarcacaoAnguloUi {
  id: string;
  vertice: PontoPx;
  a: PontoPx;
  b: PontoPx;
  graus: number;
  lado?: Lado | null;
  /** O braço b é só uma referência (vertical ou horizontal): sai tracejado. */
  tracejadoB?: boolean;
}

/** Articulação com alça de arrasto no quadro. */
export interface AlcaUi { nome: string; rotulo: string }

export type StatusReferencia = 'dentro' | 'fora' | 'sem_referencia';

/** Referência confirmada em fonte, já formatada. Só existe para o que foi verificado (com PMID). */
export interface ReferenciaUi {
  /** Texto da faixa, ex.: "127,2 a 146,2 cm/s" ou "≥ 100 passos/min". */
  faixa: string;
  populacao: string;
  /** Citação completa (autor, ano, periódico). */
  citacao: string;
  /** Forma curta, ex.: "Bohannon, 1997". */
  rotulo?: string;
  pmid?: string;
  /** Ressalva que acompanha o valor (a faixa não é intervalo individual etc.). */
  nota?: string;
  /** Faixa entre médias de grupos, ou limiar prático (ex.: intensidade): não é o mesmo que normalidade. */
  tipo?: 'faixa_de_medias' | 'limiar_heuristico';
}

/** O que a literatura verificada relata quando não há faixa para classificar o valor. */
export interface ContextoUi { texto: string; citacao: string; pmid?: string }

export interface ValorMetricaUi {
  lado: Lado | null;
  texto: string;
  status: StatusReferencia;
  /** Incerteza que o próprio vídeo impõe, já formatada (ex.: "± 1 quadro, 33 ms"). */
  incerteza?: string;
}

export interface CartaoMetricaUi {
  chave: string;
  titulo: string;
  /** Um valor, ou um por lado (D e E) quando a métrica é por lado. */
  valores: ValorMetricaUi[];
  detalhe?: string;
  referencias: ReferenciaUi[];
  contexto: ContextoUi[];
  /** Como o valor foi calculado (a fórmula do índice de simetria, por exemplo). */
  formula?: string;
  avisos: string[];
}

export type TipoEvento = 'contato' | 'saida';

/** Evento do ciclo; `i` é o índice do quadro na trilha e `t` o instante no vídeo. */
export interface EventoUi { id: string; tipo: TipoEvento; lado: Lado; i: number; t: number; origem: 'auto' | 'manual' }

export interface ModeloUi {
  id: string;
  nome: string;
  vista: string;
  descricao: string;
  /** O que o modelo mede, em frases curtas. */
  itens: string[];
  /** O modelo marca eventos (contato e saída do pé). */
  comEventos: boolean;
}

export interface ArticulacaoUi { id: string; nome: string }

export interface EstiloVideoProps { estilo: EstiloMarcacao }

export const NOME_EVENTO: Record<TipoEvento, string> = { contato: 'Contato inicial do pé', saida: 'Saída do pé' };
