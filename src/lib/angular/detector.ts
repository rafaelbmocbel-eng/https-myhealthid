import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from './pose';

const VERSAO = '1.0.1';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO}/wasm`;
const MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let carregando: Promise<PoseLandmarker> | null = null;

// O modelo (~6 MB) e o motor são baixados na primeira análise e ficam em cache;
// a imagem é processada no próprio aparelho e não é enviada a nenhum servidor.
function carregar(): Promise<PoseLandmarker> {
  if (!carregando) {
    carregando = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELO },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })().catch((e) => { carregando = null; throw e; });
  }
  return carregando;
}

/** Detecta a pose em uma imagem já carregada. Devolve null se não achar uma pessoa. */
export async function detectarPose(imagem: HTMLImageElement): Promise<Landmark[] | null> {
  const det = await carregar();
  const r = det.detect(imagem);
  return r.landmarks[0] ?? null;
}

let carregandoVideo: Promise<PoseLandmarker> | null = null;

function carregarVideo(): Promise<PoseLandmarker> {
  if (!carregandoVideo) {
    carregandoVideo = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELO },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    })().catch((e) => { carregandoVideo = null; throw e; });
  }
  return carregandoVideo;
}

const aguardar = (v: HTMLVideoElement, evento: 'seeked' | 'loadeddata') =>
  new Promise<void>((ok) => { v.addEventListener(evento, () => ok(), { once: true }); });

export interface OpcoesVideo { fps?: number; maxSegundos?: number; onProgresso?: (p: number) => void; cancelado?: () => boolean }

/**
 * Percorre o vídeo quadro a quadro (por busca de tempo, a `fps` fixo) e devolve a pose de cada um.
 * O vídeo é processado no aparelho; nada é enviado.
 */
export async function detectarVideo(video: HTMLVideoElement, o: OpcoesVideo = {}): Promise<{ t: number; lm: Landmark[] | null }[]> {
  const fps = o.fps ?? 30;
  const det = await carregarVideo();
  if (video.readyState < 2) await aguardar(video, 'loadeddata');
  const duracao = Math.min(video.duration || 0, o.maxSegundos ?? 20);
  const n = Math.floor(duracao * fps);
  const frames: { t: number; lm: Landmark[] | null }[] = [];
  video.pause();
  for (let i = 0; i < n; i++) {
    if (o.cancelado?.()) break;
    const t = i / fps;
    video.currentTime = t;
    await aguardar(video, 'seeked');
    const r = det.detectForVideo(video, Math.round(t * 1000) + 1);
    frames.push({ t, lm: r.landmarks[0] ?? null });
    o.onProgresso?.((i + 1) / n);
  }
  return frames;
}
