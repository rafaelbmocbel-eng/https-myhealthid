import type { DetectorQuadro, Intervalo, QuadroPose, TrilhaPose } from './tipos';
import { criarTrilha, pontosDeLandmarks, tempoDeExibicao } from './trilha';

export const FPS_PADRAO = 30;
/** Máximo de quadros rastreados em uma análise (40 s a 30 quadros/s): acima disso a taxa é reduzida para o aparelho aguentar. */
export const MAX_QUADROS_PADRAO = 1200;

/** Limites de produto para vídeos de análise: curtos rodam bem no celular. */
export const LIMITES_VIDEO = { duracaoSugeridaS: 30, duracaoMaximaS: 120, tamanhoSugeridoMB: 200 } as const;

export interface OpcoesRastreio {
  /** Quadros por segundo analisados (padrão 30). Se passar do limite de quadros, a taxa é reduzida. */
  fps?: number;
  /** Trecho do vídeo a rastrear, em segundos (padrão: o vídeo inteiro). */
  intervalo?: Intervalo;
  /** Detector de pose injetável. O padrão é o MediaPipe (modo vídeo), baixado na primeira análise. */
  detector?: DetectorQuadro;
  maxQuadros?: number;
  /** Progresso de 0 a 1. */
  onProgresso?: (p: number) => void;
  /** Verdadeiro enquanto o primeiro quadro não volta: nele o detector baixa o motor e o modelo (cerca de 6 MB), o que pode demorar. */
  onPreparando?: (preparando: boolean) => void;
  /** Chamado a cada quadro pronto (para mostrar o esqueleto enquanto rastreia). */
  onQuadro?: (quadro: QuadroPose, indice: number, total: number) => void;
  /** Cancelamento: a promessa é rejeitada com um erro de nome "AbortError". */
  sinal?: AbortSignal;
}

export const erroCancelado = (): Error => {
  const e = new Error('Rastreamento cancelado.');
  e.name = 'AbortError';
  return e;
};

export const ehCancelamento = (e: unknown): boolean => e instanceof Error && e.name === 'AbortError';

/** Quantos quadros rastrear e a taxa efetiva, respeitando o limite de quadros. */
export function planejarQuadros(duracaoS: number, fpsPedido: number, maxQuadros: number): { fps: number; quadros: number } {
  const fps = Number.isFinite(fpsPedido) && fpsPedido > 0 ? fpsPedido : FPS_PADRAO;
  const quadros = Math.max(1, Math.floor(duracaoS * fps + 1e-6));
  if (quadros > maxQuadros) return { fps: maxQuadros / duracaoS, quadros: maxQuadros };
  return { fps, quadros };
}

/** Avisos sobre o vídeo escolhido (duração e tamanho); `bloqueado` quando passa do máximo. */
export function avaliarVideoParaAnalise(v: { duracaoS: number; tamanhoBytes?: number }): { avisos: string[]; bloqueado: boolean } {
  const avisos: string[] = [];
  let bloqueado = false;
  if (v.duracaoS > LIMITES_VIDEO.duracaoMaximaS) {
    bloqueado = true;
    avisos.push(`O vídeo tem ${Math.round(v.duracaoS)} s: o máximo é ${LIMITES_VIDEO.duracaoMaximaS} s. Corte um trecho curto do gesto.`);
  } else if (v.duracaoS > LIMITES_VIDEO.duracaoSugeridaS) {
    avisos.push(`O vídeo tem ${Math.round(v.duracaoS)} s. Vídeos de até ${LIMITES_VIDEO.duracaoSugeridaS} s são analisados mais rápido e com menos risco de travar o celular: escolha o trecho do gesto.`);
  }
  if (v.tamanhoBytes && v.tamanhoBytes > LIMITES_VIDEO.tamanhoSugeridoMB * 1024 * 1024) {
    avisos.push(`O arquivo tem ${Math.round(v.tamanhoBytes / 1024 / 1024)} MB: arquivos grandes podem demorar para abrir.`);
  }
  return { avisos, bloqueado };
}

/** Espera a promessa, mas devolve o controle na hora se o sinal for cancelado (a promessa original segue sozinha, sem ninguém esperando). */
function esperarOuCancelar<T>(promessa: Promise<T>, sinal?: AbortSignal): Promise<T> {
  if (!sinal) return promessa;
  return new Promise<T>((resolve, reject) => {
    if (sinal.aborted) { reject(erroCancelado()); return; }
    const aoCancelar = () => reject(erroCancelado());
    sinal.addEventListener('abort', aoCancelar, { once: true });
    promessa.then(resolve, reject).finally(() => sinal.removeEventListener('abort', aoCancelar));
  });
}

function aguardarEvento(video: HTMLVideoElement, nome: string, limiteMs: number, sinal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const fim = () => { clearTimeout(timer); video.removeEventListener(nome, aoOcorrer); sinal?.removeEventListener('abort', aoCancelar); };
    const aoOcorrer = () => { fim(); resolve(); };
    const aoCancelar = () => { fim(); reject(erroCancelado()); };
    const timer = setTimeout(() => { fim(); reject(new Error('O vídeo demorou demais para responder.')); }, limiteMs);
    video.addEventListener(nome, aoOcorrer, { once: true });
    sinal?.addEventListener('abort', aoCancelar, { once: true });
  });
}

/** Leva o vídeo ao instante `t` e espera o quadro ficar pronto. */
export function posicionar(video: HTMLVideoElement, t: number, sinal?: AbortSignal): Promise<void> {
  if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2 && !video.seeking) return Promise.resolve();
  const espera = aguardarEvento(video, 'seeked', 8000, sinal);
  video.currentTime = t;
  return espera;
}

/**
 * Duração do vídeo em segundos. Vídeos gravados pelo navegador (WebM do MediaRecorder) chegam sem duração (Infinity):
 * ir ao fim do arquivo obriga o navegador a calculá-la, e depois o vídeo volta ao início.
 */
export async function garantirDuracao(video: HTMLVideoElement): Promise<number> {
  if (video.readyState < 1) await aguardarEvento(video, 'loadedmetadata', 20000);
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  await new Promise<void>((resolve, reject) => {
    const limpar = () => { clearTimeout(timer); video.removeEventListener('timeupdate', checar); video.removeEventListener('durationchange', checar); };
    const checar = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) { limpar(); resolve(); }
    };
    const timer = setTimeout(() => { limpar(); reject(new Error('Não consegui descobrir a duração do vídeo.')); }, 15000);
    video.addEventListener('timeupdate', checar);
    video.addEventListener('durationchange', checar);
    video.currentTime = 1e101;
  });
  const duracao = video.duration;
  await posicionar(video, 0);
  return duracao;
}

/** Detector padrão: MediaPipe em modo vídeo (carregado só quando necessário). */
export function detectorMediaPipe(): DetectorQuadro {
  let base: number | null = null;
  return async (quadro, t) => {
    const mod = await import('../detector');
    if (base === null) base = mod.iniciarSequenciaVideo();
    return mod.detectarPoseNoQuadro(quadro, base + Math.round(t * 1000));
  };
}

/**
 * Percorre o vídeo quadro a quadro (por busca de tempo, em instantes fixos) e devolve a trilha de pontos em pixels.
 * Nada sai do aparelho. Um quadro em que o detector falha vira um quadro vazio; cinco falhas seguidas abortam com uma mensagem clara.
 */
export async function rastrearVideo(video: HTMLVideoElement, opcoes: OpcoesRastreio = {}): Promise<TrilhaPose> {
  const { sinal } = opcoes;
  if (sinal?.aborted) throw erroCancelado();
  const duracaoTotal = await garantirDuracao(video);
  const largura = video.videoWidth, altura = video.videoHeight;
  if (!(largura > 0) || !(altura > 0)) throw new Error('Não consegui ler o tamanho do vídeo.');

  const inicio = Math.max(0, opcoes.intervalo?.inicio ?? 0);
  const fim = Math.min(duracaoTotal, opcoes.intervalo?.fim ?? duracaoTotal);
  if (!(fim - inicio > 0.05)) throw new Error('O trecho escolhido é curto demais para analisar.');
  const { fps, quadros: total } = planejarQuadros(fim - inicio, opcoes.fps ?? FPS_PADRAO, opcoes.maxQuadros ?? MAX_QUADROS_PADRAO);

  const detector = opcoes.detector ?? detectorMediaPipe();
  video.pause();

  const quadros: QuadroPose[] = [];
  let seguidas = 0;
  for (let i = 0; i < total; i++) {
    if (sinal?.aborted) throw erroCancelado();
    const t = inicio + i / fps;
    await posicionar(video, Math.min(tempoDeExibicao(t, fps), Math.max(0, duracaoTotal - 0.001)), sinal);
    if (sinal?.aborted) throw erroCancelado();
    let lm = null;
    try {
      if (i === 0) opcoes.onPreparando?.(true);
      lm = await esperarOuCancelar(detector(video, t), sinal);
      seguidas = 0;
    } catch (e) {
      if (sinal?.aborted) throw erroCancelado();
      seguidas++;
      if (seguidas >= 5) {
        const motivo = e instanceof Error && e.message ? ` (${e.message})` : '';
        throw new Error(`O detector de pose falhou${motivo}. Verifique a conexão para baixar o modelo na primeira análise e tente de novo.`);
      }
    } finally {
      if (i === 0) opcoes.onPreparando?.(false);
    }
    const quadro: QuadroPose = { i, t, pontos: pontosDeLandmarks(lm, largura, altura) };
    quadros.push(quadro);
    opcoes.onQuadro?.(quadro, i, total);
    opcoes.onProgresso?.((i + 1) / total);
  }

  try {
    await posicionar(video, inicio);
  } catch {
    // voltar ao início do trecho é só conforto: a trilha já está pronta
  }
  return criarTrilha(fps, largura, altura, quadros);
}
