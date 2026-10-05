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
