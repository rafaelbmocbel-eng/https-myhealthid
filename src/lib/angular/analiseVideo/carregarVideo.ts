import { garantirDuracao } from '@/lib/angular/video/rastrear';
import type { ImpressaoVideo } from './persistencia';

export interface VideoCarregado {
  url: string;
  arquivo: File;
  nome: string;
  tamanho: number;
  duracao: number;
  largura: number;
  altura: number;
}

export const FPS_COMUNS = [24, 25, 30, 50, 60, 120, 240] as const;

/** Taxa de quadros "redonda" mais próxima de uma estimativa (24, 25, 30, 50, 60, 120 ou 240). */
export function fpsMaisProximo(estimativa: number): number {
  if (!Number.isFinite(estimativa) || estimativa <= 0) return 30;
  return FPS_COMUNS.reduce((melhor, f) => (Math.abs(f - estimativa) < Math.abs(melhor - estimativa) ? f : melhor), FPS_COMUNS[0]) as number;
}

/** Mediana de intervalos entre quadros (s) → taxa estimada; null com poucas amostras. */
export function fpsPorIntervalos(intervalos: number[]): number | null {
  const v = intervalos.filter((x) => x > 0 && x < 0.5).sort((a, b) => a - b);
  if (v.length < 4) return null;
  const mediana = v[Math.floor(v.length / 2)];
  return fpsMaisProximo(1 / mediana);
}

export const impressaoDoVideo = (v: VideoCarregado): ImpressaoVideo => ({ nome: v.nome, tamanho: v.tamanho, duracao: v.duracao, largura: v.largura, altura: v.altura });

/** Abre o arquivo só para ler duração e dimensões. O endereço devolvido deve ser liberado com `URL.revokeObjectURL`. */
export function lerMetadadosDoVideo(arquivo: File): Promise<VideoCarregado> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir esse vídeo.')); };
    v.src = url;
    // WebM gravado no navegador chega sem duração: o motor força o cálculo (e devolve o vídeo ao início).
    garantirDuracao(v).then((duracao) => {
      if (!v.videoWidth || !v.videoHeight) { URL.revokeObjectURL(url); falha(new Error('Vídeo sem imagem.')); return; }
      ok({ url, arquivo, nome: arquivo.name, tamanho: arquivo.size, duracao, largura: v.videoWidth, altura: v.videoHeight });
    }).catch((e: unknown) => { URL.revokeObjectURL(url); falha(e instanceof Error ? e : new Error('Não consegui abrir esse vídeo.')); });
  });
}

/** Estima os quadros por segundo tocando o vídeo por instantes (onde há `requestVideoFrameCallback`); null se não der. */
export function estimarFps(url: string, limiteMs = 1800): Promise<number | null> {
  return new Promise((ok) => {
    const v = document.createElement('video') as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (agora: number, meta: { mediaTime: number }) => void) => number };
    if (typeof v.requestVideoFrameCallback !== 'function') { ok(null); return; }
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const tempos: number[] = [];
    let encerrado = false;
    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      v.pause(); v.removeAttribute('src'); v.load();
      const dif = tempos.slice(1).map((t, i) => t - tempos[i]);
      ok(fpsPorIntervalos(dif));
    };
    const aoQuadro = (_agora: number, meta: { mediaTime: number }) => {
      tempos.push(meta.mediaTime);
      if (tempos.length >= 24) encerrar(); else v.requestVideoFrameCallback?.(aoQuadro);
    };
    v.requestVideoFrameCallback(aoQuadro);
    v.play().catch(() => encerrar());
    window.setTimeout(encerrar, limiteMs);
  });
}
