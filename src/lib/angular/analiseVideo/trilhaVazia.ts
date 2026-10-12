import type { QuadroPose, TrilhaPose } from '@/lib/angular/video/tipos';
import { criarTrilha } from '@/lib/angular/video/trilha';

/** Mais quadros que isto (vídeo a 240 q/s por 30 s) pesa sem ganho: a marcação à mão acompanha em passos maiores. */
export const MAX_QUADROS_SEM_RASTREIO = 8000;

/**
 * Trilha sem pontos, só com o tempo de cada quadro do trecho: permite parar em qualquer quadro e medir à mão, sem rastrear o corpo.
 * `fps` é a taxa do vídeo; se o trecho tiver quadros demais, o passo é aumentado.
 */
export function trilhaVazia(fps: number, inicio: number, fim: number, largura: number, altura: number): TrilhaPose {
  const dur = Math.max(0, fim - inicio);
  let passo = 1 / Math.max(1, fps);
  if (dur / passo + 1 > MAX_QUADROS_SEM_RASTREIO) passo = dur / (MAX_QUADROS_SEM_RASTREIO - 1);
  const n = Math.max(1, Math.floor(dur / passo + 1e-9) + 1);
  const quadros: QuadroPose[] = Array.from({ length: n }, (_, i) => ({ i, t: Math.round((inicio + i * passo) * 1e5) / 1e5, pontos: {} }));
  return criarTrilha(Math.round(1 / passo * 1000) / 1000, largura, altura, quadros);
}
