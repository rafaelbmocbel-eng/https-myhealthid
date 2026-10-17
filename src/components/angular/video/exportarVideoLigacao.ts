import type { ComponentType } from 'react';
import type { BandaGrafico, MarcadorGrafico, SerieGrafico } from '@/lib/angular/analiseVideo/graficoLayout';
import type { CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import type { EstiloMarcacao } from '@/lib/angular/estilo';
import type { DefinicaoAngulo } from '@/lib/angular/video/angulos';
import type { FormatoVideo } from '@/lib/angular/video/exportarVideoPuro';
import type { Intervalo, TrilhaPose } from '@/lib/angular/video/tipos';

/** Propriedades do diálogo "Baixar vídeo analisado" (ExportarVideoDialog.tsx), montadas pela tela de análise. */
export interface PropsExportarVideoDialog {
  aberto: boolean;
  aoFechar: () => void;
  /** Elemento <video> da análise (a fonte dos quadros). */
  video: HTMLVideoElement | null;
  /** Trilha de pontos já com as correções do profissional. */
  trilha: TrilhaPose;
  /** Ângulos que o vídeo desenha (os do grupo aberto na tela) e que viram a curva do gráfico. */
  definicoes: DefinicaoAngulo[];
  estilo: EstiloMarcacao;
  /** Trecho sugerido (o rastreado). */
  intervalo: Intervalo;
  /** Sentido do paciente no quadro (1 = anda para a direita), como na tela de análise. */
  direcao: 1 | -1;
  /** Nome do gesto, para o título do vídeo e do arquivo. */
  titulo: string;
  /** Texto das métricas já formatadas (uma linha por métrica), para o cartão de métricas do vídeo. */
  linhasMetricas: string[];
  terapeutaId?: string;
  /** Opcionais: com eles o vídeo traz o mesmo gráfico e os mesmos cartões da tela (símbolo dentro/fora, eventos, faixas confirmadas). */
  cartoes?: CartaoMetricaUi[];
  series?: SerieGrafico[];
  marcadores?: MarcadorGrafico[];
  bandas?: BandaGrafico[];
  formatoInicial?: FormatoVideo;
}

/** O diálogo de exportação de vídeo está presente neste build? */
export const exportarVideoDisponivel = (): boolean => true;

/** Carrega o diálogo sob demanda: o módulo de exportação é pesado e só importa quando o profissional pede o vídeo. */
export async function carregarExportarVideoDialog(): Promise<ComponentType<PropsExportarVideoDialog> | null> {
  const m = await import('./ExportarVideoDialog');
  return m.default ?? null;
}
