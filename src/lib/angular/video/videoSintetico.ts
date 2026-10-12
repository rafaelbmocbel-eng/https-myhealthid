import { desenharFigura, landmarksSinteticos, type ConfigFigura, type OpcoesDetectorFalso } from './figuraSintetica';

/**
 * Gerador de vídeo sintético para testes visuais (só roda em navegador): desenha a figura articulada num canvas, quadro a quadro,
 * e grava com MediaRecorder. O instante desenhado é o relógio real da gravação, então o tempo do vídeo coincide com o do modelo
 * e o detector falso (que responde pelo tempo) concorda com a imagem.
 *
 * Nenhum código de produção importa este módulo. Num teste com Playwright e o servidor de desenvolvimento do Vite:
 *   const m = await import('/src/lib/angular/video/videoSintetico.ts');
 *   const blob = await m.gerarVideoSintetico(m.configurar('marcha'), { duracao: 6 });
 */
export { configurar } from './figuraSintetica';

export interface OpcoesVideoSintetico extends OpcoesDetectorFalso {
  duracao?: number;
  fps?: number;
  bitsPorSegundo?: number;
}

const MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export const mimeDeGravacao = (): string | null =>
  typeof MediaRecorder === 'undefined' ? null : MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;

export async function gerarVideoSintetico(cfg: ConfigFigura, op: OpcoesVideoSintetico = {}): Promise<Blob> {
  const mime = mimeDeGravacao();
  if (!mime) throw new Error('Este navegador não grava vídeo (MediaRecorder).');
  const duracao = op.duracao ?? 6, fps = op.fps ?? 30;
  const canvas = document.createElement('canvas');
  canvas.width = cfg.largura; canvas.height = cfg.altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  const stream = canvas.captureStream(0);
  const faixa = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const manual = typeof faixa.requestFrame === 'function';
  const fluxo = manual ? stream : canvas.captureStream(fps);
  const gravador = new MediaRecorder(fluxo, { mimeType: mime, videoBitsPerSecond: op.bitsPorSegundo ?? 4_000_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    gravador.onerror = () => reject(new Error('Falha ao gravar o vídeo sintético.'));
    gravador.onstop = () => resolve(new Blob(pedacos, { type: mime }));
    const inicio = performance.now();
    gravador.start();
    const passo = () => {
      const t = (performance.now() - inicio) / 1000;
      if (t >= duracao) { gravador.stop(); return; }
      const lm = landmarksSinteticos(cfg, t, op);
      if (lm) desenharFigura(ctx, lm, cfg.largura, cfg.altura);
      else { ctx.fillStyle = '#10243b'; ctx.fillRect(0, 0, cfg.largura, cfg.altura); }
      if (manual) faixa.requestFrame?.();
      setTimeout(passo, 1000 / fps);
    };
    passo();
  });
}
