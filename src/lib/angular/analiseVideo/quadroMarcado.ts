import type { PainelParaExportar } from '@/lib/angular/analise';
import { pintarItens } from '@/lib/angular/desenharCanvas';
import type { ItemDesenho } from '@/lib/angular/desenho';
import { escalaDoEstilo, escalaDoEstiloNaArte } from '@/lib/angular/estilo';

/*
 * Um quadro do vídeo parado, com as marcações, num canvas: para o PDF, a arte do Instagram e qualquer saída em
 * imagem. Os itens são desenhados em pixels do vídeo (o canvas pode ser menor que o vídeo, mas o desenho segue
 * proporcional) e o estilo escolhido vale igual à tela.
 */

export type ItensDoQuadro = (k: number) => ItemDesenho[];

export interface OpcoesQuadro {
  /** Maior lado do canvas, em px (o quadro é reduzido, nunca ampliado). */
  ladoMax?: number;
  /** Escala do estilo; sem isso, `escalaDoEstilo` do tamanho do vídeo. */
  k?: number;
  semFoto?: boolean;
  semMarcacoes?: boolean;
}

export function canvasDoQuadro(video: HTMLVideoElement, largura: number, altura: number, itens: ItensDoQuadro | null, o: OpcoesQuadro = {}): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || !(largura > 0) || !(altura > 0)) return null;
  const reduz = Math.min(1, (o.ladoMax ?? 2160) / Math.max(largura, altura));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(largura * reduz));
  cv.height = Math.max(1, Math.round(altura * reduz));
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  if (!o.semFoto) ctx.drawImage(video, 0, 0, cv.width, cv.height);
  if (itens && !o.semMarcacoes) {
    ctx.scale(cv.width / largura, cv.height / altura);
    pintarItens(ctx, itens(o.k ?? escalaDoEstilo(largura, altura)));
  }
  return cv;
}

/** Quadro marcado em JPEG reduzido (para o PDF). */
export function imagemDoQuadro(video: HTMLVideoElement, largura: number, altura: number, itens: ItensDoQuadro | null, larguraMax = 900): { url: string; w: number; h: number } | null {
  const cv = canvasDoQuadro(video, largura, altura, itens, { ladoMax: larguraMax });
  return cv ? { url: cv.toDataURL('image/jpeg', 0.88), w: cv.width, h: cv.height } : null;
}

/**
 * Painel da arte social a partir de um quadro: o quadro marcado e as camadas separadas (foto limpa e marcações), para a
 * arte esconder o rosto na foto e pintar as marcações por cima. Null se o navegador não puder desenhar.
 */
export function painelDoQuadro(video: HTMLVideoElement, largura: number, altura: number, itens: ItensDoQuadro, o: { rotulo?: string; data?: string; ladoMax?: number } = {}): PainelParaExportar | null {
  const ladoMax = o.ladoMax ?? 2160;
  const imagem = canvasDoQuadro(video, largura, altura, itens, { ladoMax });
  const foto = canvasDoQuadro(video, largura, altura, null, { ladoMax });
  const marcacoes = canvasDoQuadro(video, largura, altura, itens, { ladoMax, semFoto: true });
  if (!imagem) return null;
  const reducao = imagem.width / largura;
  const marcacoesNaEscala = (pxArtePorPxFoto: number) => canvasDoQuadro(video, largura, altura, itens, { ladoMax, semFoto: true, k: escalaDoEstiloNaArte(pxArtePorPxFoto * reducao) });
  return {
    rotulo: o.rotulo ?? '', data: o.data, imagem, largura: imagem.width, altura: imagem.height,
    ...(foto && marcacoes ? { camadas: { foto, marcacoes }, marcacoesNaEscala } : {}),
  };
}
